from __future__ import annotations

import base64
import io
import os
import json
import random
import threading
import time
import traceback
import uuid
from typing import Any, Callable, Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from canonical_dreamo import DreamOStickerEngine, PromptPlanner
from sse_stream import generation_queue, job_snapshot, stream_response


class CanonicalApiService:
    def __init__(
        self,
        *,
        get_generator: Callable[[], Any],
        generation_lock: threading.Lock,
        variant_prompt_map: dict[str, Any],
        default_order: list[str],
    ) -> None:
        self.get_generator = get_generator
        self.generation_lock = generation_lock
        self.variant_prompt_map = variant_prompt_map
        self.default_order = default_order

        self.router = APIRouter(
            prefix="/api/canonical",
            tags=["canonical"],
        )

        self.canonicals: dict[str, dict[str, Any]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}

        self.canonicals_lock = threading.Lock()
        self.jobs_lock = threading.Lock()

        self.prompt_planner: Optional[PromptPlanner] = None
        self.sticker_engine: Optional[DreamOStickerEngine] = None
        self.engine_generator_id: Optional[int] = None

        self._register_routes()

    @staticmethod
    def _pil_to_dataurl(image: Image.Image) -> str:
        buf = io.BytesIO()
        image.save(
            buf,
            format="PNG",
            optimize=False,
            compress_level=3,
        )
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return "data:image/png;base64," + encoded

    def _generator(self) -> Any:
        generator = self.get_generator()
        if generator is None:
            raise RuntimeError("EmojiGenerator is not initialized yet.")
        return generator

    def _planner(self) -> PromptPlanner:
        if self.prompt_planner is None:
            self.prompt_planner = PromptPlanner()
        return self.prompt_planner

    def _engine(self) -> DreamOStickerEngine:
        generator = self._generator()
        gid = id(generator)
        if (
            self.sticker_engine is None
            or self.engine_generator_id != gid
        ):
            self.sticker_engine = DreamOStickerEngine(generator)
            self.engine_generator_id = gid
        return self.sticker_engine

    def _select_variant(
        self,
        theme_name: str,
        seed: int,
    ) -> str:
        value = self.variant_prompt_map.get(
            theme_name,
            theme_name,
        )
        if isinstance(value, list):
            if not value:
                return theme_name
            return random.Random(seed).choice(value)
        return str(value)

    def _parse_targets(
        self,
        indices: str,
        variant_names: str,
    ) -> list[tuple[int, str]]:
        try:
            raw_indices = json.loads(indices) if indices else []
            if not isinstance(raw_indices, list):
                raise HTTPException(400, "indices must be a JSON array.")
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "indices must be a JSON array.")

        try:
            raw_names = (
                json.loads(variant_names)
                if variant_names
                else {}
            )
            if not isinstance(raw_names, dict):
                raise HTTPException(400, "variant_names must be a JSON object.")
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "variant_names must be a JSON object.")

        name_map: dict[int, str] = {}
        for key, value in raw_names.items():
            try:
                name_map[int(key)] = str(value)
            except (TypeError, ValueError):
                pass

        if not raw_indices:
            return [
                (index, name_map.get(index, name))
                for index, name
                in enumerate(self.default_order, start=1)
            ]

        result: list[tuple[int, str]] = []
        for raw_index in raw_indices:
            try:
                index = int(raw_index)
            except (TypeError, ValueError):
                continue

            if index <= 0:
                continue

            if index <= len(self.default_order):
                fallback = self.default_order[index - 1]
            else:
                fallback = f"이모티콘 {index}"

            result.append(
                (index, name_map.get(index, fallback))
            )
        return result

    @staticmethod
    def _parse_prompts(targets: list[tuple[int, str]], variant_prompts: str) -> list[tuple[int, str]]:
        try:
            prompts = json.loads(variant_prompts) if variant_prompts else {}
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(400, "variant_prompts must be a JSON object of strings.")
        if not isinstance(prompts, dict) or any(not isinstance(value, str) for value in prompts.values()):
            raise HTTPException(400, "variant_prompts must be a JSON object of strings.")
        return [(index, prompts.get(str(index), "").strip()) for index, _ in targets]

    def _generate_canonical_image(
        self,
        *,
        generator: Any,
        prompt: str,
        ref_image: Optional[Image.Image],
        ip_scale: float,
        num_inference_steps: int,
        seed: int,
    ) -> Image.Image:
        # ip_scale is retained for frontend compatibility.
        return generator.generate_prompt_with_reference(
            prompt=prompt,
            ref_image=ref_image,
            num_inference_steps=num_inference_steps,
            seed=seed,
        )

    def _run_canonical_job(
        self,
        *,
        canonical_id: str,
        ref_image: Optional[Image.Image],
        original_user_text: str,
        edit_request: str,
        ip_scale: float,
        steps: int,
        generation_number: int,
    ) -> None:
        try:
            with self.generation_lock:
                generator = self._generator()
                planner = self._planner()

                if ref_image is not None:
                    original_analysis = generator.analyze_reference_image(
                        ref_image,
                        user_hint=original_user_text,
                    )
                    original_caption = str(
                        original_analysis.get("text", "")
                    ).strip()
                    framing_hint = str(
                        original_analysis.get("framing", "upper_body")
                    ).strip()
                else:
                    original_analysis = {
                        "framing": "upper_body",
                        "visible_body_parts": [],
                        "profile": {},
                        "text": "",
                    }
                    original_caption = ""
                    framing_hint = "upper_body"

                # Reference framing and legacy environment settings do not control output.
                framing_hint = "upper_body"
                original_profile = generator.build_character_profile(
                    original_caption,
                    original_user_text,
                )

                if not original_profile:
                    raise ValueError(
                        "Reference image or character description is required."
                    )

                user_request = original_user_text.strip()
                if edit_request.strip():
                    user_request += (
                        "\nCanonical correction requested by user: "
                        + edit_request.strip()
                    )

                character_prompt = planner.build_canonical_prompt(
                    character_profile=original_profile,
                    user_request=user_request,
                    emoji_style=generator.base_positive,
                    framing_hint=framing_hint,
                )

                seed = (
                    int(uuid.UUID(canonical_id))
                    + generation_number * 100003
                ) % (2**31 - 1)

                canonical_image = self._generate_canonical_image(
                    generator=generator,
                    prompt=character_prompt,
                    ref_image=ref_image,
                    ip_scale=ip_scale,
                    num_inference_steps=steps,
                    seed=seed,
                )
                # The original identity stays authoritative; do not turn generation
                # mistakes into new identity facts through a second vision call.
                canonical_analysis = None
                canonical_profile = original_profile
                if edit_request.strip():
                    canonical_profile += ". User-approved correction: " + edit_request.strip()
                encoded_image = self._pil_to_dataurl(canonical_image)

                with self.canonicals_lock:
                    item = self.canonicals[canonical_id]
                    item.update(
                        {
                            "status": "ready",
                            "approved": False,
                            "original_image": ref_image,
                            "original_profile": original_profile,
                            "canonical_profile": canonical_profile,
                            "original_analysis": original_analysis,
                            "canonical_analysis": canonical_analysis,
                            "framing": framing_hint,
                            "canonical_prompt": character_prompt,
                            "canonical_image_pil": canonical_image,
                            "canonical_image": encoded_image,
                            "error": None,
                            "updated_at": time.time(),
                        }
                    )

        except Exception as exc:
            print(traceback.format_exc())
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is not None:
                    item["status"] = "error"
                    item["error"] = str(exc)
                    item["updated_at"] = time.time()

    def _run_sticker_job(
        self,
        *,
        job_id: str,
        canonical_id: str,
        targets: list[tuple[int, str]],
        candidate_count: int,
        img2img_strength: float,
        controlnet_scale: float,
        steps: int,
        user_prompts: list[tuple[int, str]] | None = None,
    ) -> None:
        try:
            with self.generation_lock:
                generator = self._generator()
                planner = self._planner()
                engine = self._engine()

                with self.canonicals_lock:
                    canonical = self.canonicals.get(canonical_id)
                    if canonical is None:
                        raise ValueError("Canonical not found.")
                    if not canonical.get("approved"):
                        raise ValueError("Canonical is not approved.")

                    canonical_image: Image.Image = (
                        canonical["canonical_image_pil"].copy()
                    )
                    canonical_profile = canonical[
                        "canonical_profile"
                    ]
                    original_profile = canonical[
                        "original_profile"
                    ]
                    framing_hint = "upper_body"

                base_feature = generator.image_feature(canonical_image) if candidate_count > 1 else None
                base_seed = (
                    int(uuid.UUID(job_id))
                    % (2**31 - 1)
                )

                completed = 0

                for index, theme_name in targets:
                    user_prompt = dict(user_prompts or []).get(index, "")
                    image_started = time.perf_counter()
                    detailed_variant = self._select_variant(
                        theme_name,
                        base_seed + index * 7919,
                    )

                    plan = planner.build_sticker_plan(
                        canonical_profile=canonical_profile,
                        original_profile=original_profile,
                        theme_name=theme_name,
                        detailed_variant=detailed_variant,
                        emoji_style=generator.base_positive,
                        framing_hint=framing_hint,
                        user_prompt=user_prompt,
                    )

                    candidates = engine.generate_candidates(
                        canonical_image=canonical_image,
                        final_prompt=plan.prompt,
                        num_inference_steps=steps,
                        strength=img2img_strength,
                        controlnet_scale=controlnet_scale,
                        candidate_count=candidate_count,
                        seed_base=base_seed + index * 100,
                    )

                    clip_prompt = plan.clip_prompt
                    if len(candidates) == 1:
                        best_image, best_score, score_details = candidates[0], None, {}
                    else:
                        clip_prompt = generator.sanitize_clip_prompt(plan.clip_prompt, max_content_tokens=75)
                        prompt_feature = generator.text_feature(clip_prompt)
                        best_image, best_score, score_details = generator.pick_best_candidate(candidates=candidates, base_feature=base_feature, variant_feature=prompt_feature, ref_feature=None)

                    output = generator.to_ogq_sticker(
                        best_image
                    )

                    encoded_image = self._pil_to_dataurl(output)
                    completed += 1
                    with self.jobs_lock:
                        job = self.jobs[job_id]
                        job["images"].append(
                            {
                                "index": index,
                                "name": theme_name,
                                "image": encoded_image,
                                "elapsed_seconds": round(time.perf_counter() - image_started, 3),
                                "score": round(best_score, 4) if best_score is not None else None,
                                "score_detail": {
                                    key: round(value, 4)
                                    for key, value
                                    in score_details.items()
                                },
                                "final_prompt": plan.prompt,
                                "clip_prompt": clip_prompt,
                                "framing": framing_hint,
                                "pose_keypoints": None,
                            }
                        )
                        job["completed"] = completed

                with self.jobs_lock:
                    self.jobs[job_id]["status"] = "done"
                    self.jobs[job_id]["finished_at"] = time.time()

        except Exception as exc:
            print(traceback.format_exc())
            with self.jobs_lock:
                job = self.jobs.get(job_id)
                if job is not None:
                    job["status"] = "error"
                    job["error"] = str(exc)
                    job["finished_at"] = time.time()

    def cleanup(self):
        now = time.time()
        with self.jobs_lock:
            active = {j["canonical_id"] for j in self.jobs.values() if j["status"] not in {"done", "error"}}
            for jid in list(self.jobs):
                job = self.jobs[jid]
                if job.get("finished_at") and now - job["finished_at"] > 3600:
                    del self.jobs[jid]
        with self.canonicals_lock:
            for cid in list(self.canonicals):
                item = self.canonicals[cid]
                if cid not in active and item["status"] != "generating" and now - item["updated_at"] > 86400:
                    del self.canonicals[cid]

    def _canonical_snapshot(self, canonical_id):
        with self.canonicals_lock:
            item = self.canonicals.get(canonical_id)
            if item is None:
                return None
            ready = item["status"] in {"ready", "approved"}
            images = [{"index": 1, "name": "canonical", "image": item["canonical_image"], "framing": item.get("framing"), "canonical_prompt": item.get("canonical_prompt")}] if ready else []
            return {"status": "done" if ready else item["status"], "images": images, "total": 1, "error": item.get("error")}

    def _register_routes(self) -> None:
        @self.router.post("")
        async def create_canonical(request: Request, image: Optional[UploadFile] = File(None), character_base: str = Form(""), ip_scale: float = Form(0.60), num_inference_steps: int = Form(0, ge=0, le=50), transport: str = Form("sse", pattern="^sse$")):
            self.cleanup()
            ref_image = None
            if image is not None:
                raw = await image.read()
                if raw:
                    try:
                        with Image.open(io.BytesIO(raw)) as source:
                            ref_image = source.convert("RGBA")
                    except Exception:
                        raise HTTPException(400, "Invalid reference image.")
            if ref_image is None and not character_base.strip():
                raise HTTPException(400, "Reference image or character description is required.")
            self._generator()
            canonical_id = str(uuid.uuid4())
            with self.canonicals_lock:
                self.canonicals[canonical_id] = {
                    "status": "generating", "approved": False, "original_image": ref_image,
                    "original_user_text": character_base.strip(), "ip_scale": ip_scale,
                    "steps": num_inference_steps, "generation_number": 0,
                    "canonical_image": None, "canonical_image_pil": None, "error": None,
                    "created_at": time.time(), "updated_at": time.time(),
                }
            try:
                generation_queue.submit(self._run_canonical_job, canonical_id=canonical_id, ref_image=ref_image, original_user_text=character_base.strip(), edit_request="", ip_scale=ip_scale, steps=num_inference_steps, generation_number=0)
            except Exception:
                with self.canonicals_lock:
                    self.canonicals.pop(canonical_id, None)
                raise
            events_url = f"/api/canonical/{canonical_id}/events"
            return stream_response(request, lambda: self._canonical_snapshot(canonical_id), {"canonical_id": canonical_id, "events_url": events_url})

        @self.router.get("/{canonical_id}/events")
        async def canonical_events(canonical_id: str, request: Request, after: int = 0):
            return stream_response(request, lambda: self._canonical_snapshot(canonical_id), {"canonical_id": canonical_id}, after)

        @self.router.get("/{canonical_id}")
        def get_canonical(canonical_id: str):
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    raise HTTPException(404, "Canonical not found.")
                return {"canonical_id": canonical_id, "status": item["status"], "approved": item["approved"], "image": item.get("canonical_image"), "canonical_prompt": item.get("canonical_prompt"), "framing": item.get("framing"), "error": item.get("error")}

        @self.router.post("/{canonical_id}/approve")
        def approve_canonical(canonical_id: str):
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    raise HTTPException(404, "Canonical not found.")
                if item["status"] not in {"ready", "approved"}:
                    raise HTTPException(409, "Canonical is not ready.")
                item.update(approved=True, status="approved", updated_at=time.time())
            return {"canonical_id": canonical_id, "approved": True}

        @self.router.post("/{canonical_id}/regenerate")
        async def regenerate_canonical(canonical_id: str, request: Request, edit_request: str = Form(""), transport: str = Form("sse", pattern="^sse$")):
            with self.jobs_lock:
                if any(j["canonical_id"] == canonical_id and j["status"] not in {"done", "error"} for j in self.jobs.values()):
                    raise HTTPException(409, "Wait until the current sticker set finishes.")
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    raise HTTPException(404, "Canonical not found.")
                if item["status"] == "generating":
                    raise HTTPException(409, "Canonical generation is already running.")
                old_item = dict(item)
                item.update(generation_number=item["generation_number"] + 1, status="generating", approved=False, canonical_image=None, canonical_image_pil=None, error=None, updated_at=time.time())
            try:
                generation_queue.submit(self._run_canonical_job, canonical_id=canonical_id, ref_image=item["original_image"], original_user_text=item["original_user_text"], edit_request=edit_request, ip_scale=item["ip_scale"], steps=item["steps"], generation_number=item["generation_number"])
            except Exception:
                with self.canonicals_lock:
                    self.canonicals[canonical_id] = old_item
                raise
            events_url = f"/api/canonical/{canonical_id}/events"
            return stream_response(request, lambda: self._canonical_snapshot(canonical_id), {"canonical_id": canonical_id, "events_url": events_url})

        @self.router.post("/{canonical_id}/generate-set")
        async def generate_set(canonical_id: str, request: Request, indices: str = Form(""), variant_names: str = Form(""), variant_prompts: str = Form(""), candidate_count: int = Form(1, ge=1, le=4), img2img_strength: float = Form(0.55), controlnet_scale: float = Form(0.90), num_inference_steps: int = Form(0, ge=0, le=50), transport: str = Form("sse", pattern="^sse$")):
            self.cleanup()
            with self.canonicals_lock:
                canonical = self.canonicals.get(canonical_id)
                if canonical is None:
                    raise HTTPException(404, "Canonical not found.")
                if not canonical.get("approved"):
                    raise HTTPException(409, "Approve the canonical first.")
                canonical["updated_at"] = time.time()
            targets = self._parse_targets(indices, variant_names)
            user_prompts = self._parse_prompts(targets, variant_prompts)
            if not targets or len(targets) > 24 or len({i for i, _ in targets}) != len(targets):
                raise HTTPException(400, "Choose 1 to 24 unique generation slots.")
            job_id = str(uuid.uuid4())
            with self.jobs_lock:
                self.jobs[job_id] = {"status": "running", "completed": 0, "total": len(targets), "images": [], "error": None, "created_at": time.time(), "finished_at": None, "canonical_id": canonical_id}
            try:
                generation_queue.submit(self._run_sticker_job, job_id=job_id, canonical_id=canonical_id, targets=targets, candidate_count=candidate_count, img2img_strength=img2img_strength, controlnet_scale=controlnet_scale, steps=num_inference_steps, user_prompts=user_prompts)
            except Exception:
                with self.jobs_lock:
                    self.jobs.pop(job_id, None)
                raise
            events_url = f"/api/canonical/generate-set/{job_id}/events"
            return stream_response(request, lambda: job_snapshot(self.jobs, self.jobs_lock, job_id), {"job_id": job_id, "canonical_id": canonical_id, "events_url": events_url})

        @self.router.get("/generate-set/{job_id}/events")
        async def set_events(job_id: str, request: Request, after: int = 0):
            return stream_response(request, lambda: job_snapshot(self.jobs, self.jobs_lock, job_id), {"job_id": job_id}, after)

        @self.router.get("/generate-set/{job_id}/status")
        def get_generate_set(job_id: str, since: int = 0):
            state = job_snapshot(self.jobs, self.jobs_lock, job_id)
            if state is None:
                raise HTTPException(404, "Job not found.")
            return {**state, "completed": len(state["images"]), "images": state["images"][max(0, since):]}


def install_canonical_api(
    *,
    app: Any,
    get_generator: Callable[[], Any],
    generation_lock: threading.Lock,
    variant_prompt_map: dict[str, Any],
    default_order: list[str],
) -> CanonicalApiService:
    service = CanonicalApiService(
        get_generator=get_generator,
        generation_lock=generation_lock,
        variant_prompt_map=variant_prompt_map,
        default_order=default_order,
    )
    app.include_router(service.router)
    return service
