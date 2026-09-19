"""One GPU queue; replayable SSE that never runs inference on the event loop."""
from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

from fastapi import HTTPException, Request
from fastapi.responses import Response, StreamingResponse


class GenerationQueue:
    def __init__(self, capacity: int = 8):
        if capacity < 1:
            raise ValueError("Queue capacity must be at least one.")
        # All routes share this FIFO executor. Never make worker count configurable.
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="ogq-gpu")
        self.slots = threading.BoundedSemaphore(capacity)
        self.capacity = capacity
        self.lock = threading.Lock()
        self.outstanding = 0
        self.running = 0

    def snapshot(self):
        with self.lock:
            return {"workers": 1, "capacity": self.capacity,
                    "running": self.running, "waiting": self.outstanding - self.running}

    def _run(self, fn, args, kwargs):
        with self.lock:
            self.running += 1
        try:
            return fn(*args, **kwargs)
        finally:
            with self.lock:
                self.running -= 1

    def _release(self, future=None):
        with self.lock:
            self.outstanding -= 1
        self.slots.release()

    def submit(self, fn, *args, **kwargs):
        if not self.slots.acquire(blocking=False):
            raise HTTPException(429, "Generation queue is full. Try again later.")
        with self.lock:
            self.outstanding += 1
        try:
            future = self.executor.submit(self._run, fn, args, kwargs)
        except BaseException:
            self._release()
            raise
        future.add_done_callback(self._release)
        return future

    def shutdown(self):
        self.executor.shutdown(wait=True)


generation_queue = GenerationQueue(max(1, int(os.getenv("MAX_PENDING_JOBS", "8"))))


def encode_event(event: str, data: dict, event_id: int | None = None) -> str:
    prefix = f"id: {event_id}\n" if event_id is not None else ""
    return prefix + f"event: {event}\ndata: " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n\n"


def stream_response(request: Request, snapshot: Callable[[], dict | None], identity: dict, after: int = 0, heartbeat: float = 10.0):
    """snapshot returns an immutable copy. Cursor counts image events, not slot IDs.

    Reconnecting never launches another generation. Inference keeps running if
    a client leaves; its completed images can be replayed until the job expires.
    """
    try:
        cursor = int(request.headers.get("last-event-id", str(after)))
    except ValueError:
        raise HTTPException(400, "Invalid Last-Event-ID.")
    current = snapshot()
    if current is None:
        raise HTTPException(404, "Job not found or expired.")
    count = len(current["images"])
    terminal = current["status"] in {"done", "error"}
    if cursor < 0 or cursor > count + int(terminal):
        raise HTTPException(400, "Cursor is outside the available event history.")
    if terminal and cursor == count + 1:
        return Response(status_code=204)

    async def events():
        nonlocal cursor
        yield encode_event("start", {**identity, "total": current["total"], "completed": cursor})
        last_sent = time.monotonic()
        while True:
            if await request.is_disconnected():
                return
            state = snapshot()
            if state is None:
                yield encode_event("error", {**identity, "error": "Job expired."})
                return
            for item in state["images"][cursor:]:
                cursor += 1
                yield encode_event("image", {**identity, **item, "completed": cursor, "total": state["total"]}, cursor)
                last_sent = time.monotonic()
                await asyncio.sleep(0)
            if state["status"] in {"done", "error"}:
                payload = {**identity, "completed": cursor, "total": state["total"], "status": state["status"]}
                if state.get("error"):
                    payload["error"] = state["error"]
                yield encode_event(state["status"], payload, cursor + 1)
                return
            if time.monotonic() - last_sent >= heartbeat:
                yield ": keep-alive\n\n"
                last_sent = time.monotonic()
            await asyncio.sleep(0.1)

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


def job_snapshot(jobs: dict, lock: threading.Lock, job_id: str):
    with lock:
        job = jobs.get(job_id)
        if job is None:
            return None
        return {"status": job["status"], "images": list(job["images"]), "total": job["total"], "error": job.get("error")}
