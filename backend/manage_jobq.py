from typing import Any
import threading
import os
from collections import deque
from concurrent.futures import Future
from functools import partial

from fastapi import HTTPException
from sse_stream import generation_queue


canonicals: dict[str, dict[str, Any]] = {}
jobs: dict[str, dict[str, Any]] = {}

canonicals_lock = threading.Lock()
jobs_lock = threading.Lock()


class JobQueue:
    def __init__(self, executor, capacity=8):
        self.executor = executor
        self.capacity = capacity
        self.pending = deque()
        self.condition = threading.Condition()
        self.outstanding = 0
        self.closed = False
        self.cancellations = {}
        self.worker = threading.Thread(target=self._run, name="ogq-jobq", daemon=True)
        self.worker.start()

    def submit(self, fn, *args, key=None, **kwargs):
        return self.submit_steps(iter([partial(fn, *args, **kwargs)]), key=key)

    def submit_steps(self, steps, *, key=None):
        result = Future()
        result.set_running_or_notify_cancel()
        with self.condition:
            if self.closed:
                raise RuntimeError("Job queue is shut down.")
            if self.outstanding >= self.capacity:
                raise HTTPException(429, "Generation queue is full. Try again later.")
            if key is not None and key in self.cancellations:
                raise RuntimeError("Job is already queued.")
            cancelled = threading.Event()
            if key is not None:
                self.cancellations[key] = cancelled
            self.outstanding += 1
            self.pending.append((iter(steps), result, key, cancelled))
            self.condition.notify()
        return result

    def cancel(self, key):
        finished = []
        with self.condition:
            cancelled = self.cancellations.get(key)
            if cancelled is None:
                return
            cancelled.set()
            kept = deque()
            for entry in self.pending:
                if entry[2] == key:
                    finished.append(entry[1])
                    self.outstanding -= 1
                    self.cancellations.pop(key, None)
                else:
                    kept.append(entry)
            self.pending = kept
        for result in finished:
            result.set_result(None)

    @staticmethod
    def _execute(step, cancelled):
        if not cancelled.is_set():
            step()

    def snapshot(self):
        with self.condition:
            return {"capacity": self.capacity, "outstanding": self.outstanding,
                    "waiting": len(self.pending)}

    def _run(self):
        while True:
            with self.condition:
                self.condition.wait_for(lambda: self.pending or self.closed)
                if not self.pending:
                    return
                steps, result, key, cancelled = self.pending.popleft()
            try:
                if cancelled.is_set():
                    raise StopIteration
                step = next(steps)
                execution = self.executor.submit(self._execute, step, cancelled)
                released = threading.Event()
                execution.add_done_callback(lambda _: released.set())
                released.wait()
                execution.result()
            except StopIteration:
                result.set_result(None)
            except BaseException as exc:
                result.set_exception(exc)
            else:
                with self.condition:
                    if not cancelled.is_set():
                        self.pending.append((steps, result, key, cancelled))
                        continue
                result.set_result(None)
            with self.condition:
                self.outstanding -= 1
                if key is not None:
                    self.cancellations.pop(key, None)

    def shutdown(self):
        with self.condition:
            self.closed = True
            self.condition.notify_all()
        self.worker.join()
        self.executor.shutdown()


jobq = JobQueue(generation_queue, max(1, int(os.getenv("MAX_PENDING_JOBS", "8"))))


def cancel_job(job_id):
    import time
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Job not found.")
        newly_cancelled = job["status"] not in {"done", "error", "cancelled"}
        if newly_cancelled:
            job.update(status="cancelled", finished_at=time.time())
        status = job["status"]
        canonical_id = job["canonical_id"]
    jobq.cancel(job_id)
    return {"job_id": job_id, "status": status}


def cancel_canonical(canonical_id):
    import time
    with canonicals_lock:
        item = canonicals.get(canonical_id)
        if item is None:
            raise HTTPException(404, "Canonical not found.")
        if item["status"] == "generating":
            item.update(status="cancelled", updated_at=time.time())
        status = item["status"]
    jobq.cancel("canonical:" + canonical_id)
    return {"canonical_id": canonical_id, "status": status}
