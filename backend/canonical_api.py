from __future__ import annotations

import base64
import io
import json
import random
import threading
import time
import traceback
import uuid
from typing import Any, Callable, Optional

import torch
from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

from canonical_controlnet import (
    ControlNetStickerEngine,
    PromptPlanner,
    render_pose_image,
)


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

        self.router = APIRouter(prefix="/api/canonical", tags=["canonical"])

        self.canonicals: dict[str, dict[str, Any]] = {}
        self.jobs: dict[str, dict[str, Any]] = {}

        self.canonicals_lock = threading.Lock()
        self.jobs_lock = threading.Lock()

        self.prompt_planner: Optional[PromptPlanner] = None
        self.control_engine: Optional[ControlNetStickerEngine] = None
        self.control_engine_generator_id: Optional[int] = None

        self._register_routes()

    @staticmethod
    def _pil_to_dataurl(image: Image.Image) -> str:
        buf = io.BytesIO()
        image.save(buf, format="PNG", optimize=True, compress_level=9)
        return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

    def _generator(self) -> Any:
        generator = self.get_generator()
        if generator is None:
            raise RuntimeError("EmojiGenerator is not initialized")
        return generator

    def _planner(self) -> PromptPlanner:
        if self.prompt_planner is None:
            self.prompt_planner = PromptPlanner()
        return self.prompt_planner

    def _engine(self) -> ControlNetStickerEngine:
        generator = self._generator()
        generator_id = id(generator)

        if self.control_engine is None or self.control_engine_generator_id != generator_id:
            self.control_engine = ControlNetStickerEngine(generator)
            self.control_engine_generator_id = generator_id
        return self.control_engine

    def _select_variant(self, theme_name: str, seed: int) -> str:
        value = self.variant_prompt_map.get(theme_name, theme_name)
        if isinstance(value, list):
            if not value:
                return theme_name
            return random.Random(seed).choice(value)
        return str(value)

    def _parse_targets(self, indices: str, variant_names: str) -> list[tuple[int, str]]:
        try:
            raw_indices = json.loads(indices) if indices else []
            if not isinstance(raw_indices, list):
                raw_indices = []
        except (json.JSONDecodeError, TypeError):
            raw_indices = []

        try:
            raw_names = json.loads(variant_names) if variant_names else {}
            if not isinstance(raw_names, dict):
                raw_names = {}
        except (json.JSONDecodeError, TypeError):
            raw_names = {}

        name_map: dict[int, str] = {}
        for key, value in raw_names.items():
            try:
                name_map[int(key)] = str(value)
            except (TypeError, ValueError):
                pass

        if not raw_indices:
            return [(index, name) for index, name in enumerate(self.default_order, start=1)]

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

            result.append((index, name_map.get(index, fallback)))
        return result

    def _enable_stage1_conditioning(self, generator: Any, ip_scale: float) -> None:
        generator._set_ip_scale(ip_scale)
        try:
            generator.txt2img.enable_lora()
        except Exception:
            pass

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
        self._enable_stage1_conditioning(generator, ip_scale)

        prompt_embeds, pooled_prompt_embeds, negative_prompt_embeds, negative_pooled_prompt_embeds = generator._embed_prompt(prompt)

        kwargs: dict[str, Any] = {
            "prompt_embeds": prompt_embeds,
            "pooled_prompt_embeds": pooled_prompt_embeds,
            "negative_prompt_embeds": negative_prompt_embeds,
            "negative_pooled_prompt_embeds": negative_pooled_prompt_embeds,
            "num_inference_steps": int(num_inference_steps),
            "guidance_scale": 7.0,
            "width": 1024,
            "height": 1024,
            "generator": generator._seeded_generator(seed),
        }

        if ref_image is not None:
            kwargs["ip_adapter_image"] = generator._prepare_reference(ref_image)

        with torch.inference_mode():
            image = generator.txt2img(**kwargs).images[0]

        generator._cleanup_memory()
        return image

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

                auto_caption = (generator.caption_image(ref_image) if ref_image is not None else "")

                original_profile = generator.build_character_profile(auto_caption, original_user_text)

                if not original_profile:
                    raise ValueError("Reference image or character description is None.")

                user_request = original_user_text.strip()
                if edit_request.strip():
                    user_request += "\nCanonical correction requested by user: " + edit_request.strip()

                character_prompt = planner.build_canonical_prompt(
                    character_profile=original_profile,
                    user_request=user_request,
                    emoji_style="",
                )

                canonical_prompt = f"{generator.base_positive}, {character_prompt}"
                seed = (int(uuid.UUID(canonical_id)) + generation_number * 100003) % (2**31 - 1)

                canonical_image = self._generate_canonical_image(
                    generator=generator,
                    prompt=canonical_prompt,
                    ref_image=ref_image,
                    ip_scale=ip_scale,
                    num_inference_steps=steps,
                    seed=seed,
                )

                canonical_caption = generator.caption_image(canonical_image, threshold=0.28, max_tags=28)
                canonical_profile = generator.build_character_profile(canonical_caption, original_user_text)

                with self.canonicals_lock:
                    item = self.canonicals[canonical_id]
                    item.update(
                        {
                            "status": "ready",
                            "approved": False,
                            "original_image": ref_image,
                            "original_profile": original_profile,
                            "canonical_profile": canonical_profile,
                            "canonical_prompt": canonical_prompt,
                            "canonical_image_pil": canonical_image,
                            "canonical_image": self._pil_to_dataurl(canonical_image),
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
                    canonical_profile = canonical["canonical_profile"]
                    original_profile = canonical["original_profile"]

                base_feature = generator.image_feature(canonical_image)
                base_seed = int(uuid.UUID(job_id)) % (2**31 - 1)

                completed = 0

                for index, theme_name in targets:
                    detailed_variant = self._select_variant(theme_name, base_seed + index * 7919)

                    plan = planner.build_sticker_plan(
                        canonical_profile=canonical_profile,
                        original_profile=original_profile,
                        theme_name=theme_name,
                        detailed_variant=detailed_variant,
                        emoji_style=generator.base_positive,
                    )

                    pose_image = render_pose_image(plan.keypoints)

                    candidates = engine.generate_candidates(
                        canonical_image=canonical_image,
                        final_prompt=plan.prompt,
                        pose_image=pose_image,
                        num_inference_steps=steps,
                        strength=img2img_strength,
                        controlnet_scale=controlnet_scale,
                        candidate_count=candidate_count,
                        seed_base=base_seed + index * 100,
                    )

                    prompt_feature = generator.text_feature(plan.prompt)

                    best_image, best_score, score_details = (
                        generator.pick_best_candidate(
                            candidates=candidates,
                            base_feature=base_feature,
                            variant_feature=prompt_feature,
                            ref_feature=None,
                        )
                    )

                    output = generator.to_ogq_sticker(best_image)

                    completed += 1
                    with self.jobs_lock:
                        job = self.jobs[job_id]
                        job["images"].append(
                            {
                                "index": index,
                                "name": theme_name,
                                "image": self._pil_to_dataurl(output),
                                "score": round(best_score, 4),
                                "score_detail": {
                                    key: round(value, 4)
                                    for key, value in score_details.items()
                                },
                                "final_prompt": plan.prompt,
                                "pose_keypoints": plan.keypoints,
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

    def _register_routes(self) -> None:
        @self.router.post("")
        async def create_canonical(
            background_tasks: BackgroundTasks,
            image: Optional[UploadFile] = File(None),
            character_base: str = Form(""),
            ip_scale: float = Form(0.60),
            num_inference_steps: int = Form(30),
        ):
            character_base = character_base.strip()

            ref_image: Optional[Image.Image] = None
            if image is not None:
                raw = await image.read()
                if raw:
                    try:
                        ref_image = Image.open(io.BytesIO(raw)).convert("RGBA")
                    except Exception as exc:
                        return JSONResponse(status_code=400, content={"error": f"Invalid image: {exc}"})

            if ref_image is None and not character_base:
                return JSONResponse(status_code=400, content={"error": "Reference image or character description is required."})

            canonical_id = str(uuid.uuid4())

            ip_scale = max(0.0, min(1.2, float(ip_scale)))
            steps = max(20, min(50, int(num_inference_steps)))

            with self.canonicals_lock:
                self.canonicals[canonical_id] = {
                    "status": "generating",
                    "approved": False,
                    "original_image": ref_image,
                    "original_user_text": character_base,
                    "ip_scale": ip_scale,
                    "steps": steps,
                    "generation_number": 0,
                    "canonical_image": None,
                    "canonical_image_pil": None,
                    "error": None,
                    "created_at": time.time(),
                    "updated_at": time.time(),
                }

            background_tasks.add_task(
                self._run_canonical_job,
                canonical_id=canonical_id,
                ref_image=ref_image,
                original_user_text=character_base,
                edit_request="",
                ip_scale=ip_scale,
                steps=steps,
                generation_number=0,
            )

            return {"canonical_id": canonical_id}

        @self.router.get("/{canonical_id}")
        def get_canonical(canonical_id: str):
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    return JSONResponse(status_code=404, content={"error": "canonical not found"})

                return {
                    "canonical_id": canonical_id,
                    "status": item["status"],
                    "approved": item["approved"],
                    "image": item.get("canonical_image"),
                    "canonical_prompt": item.get("canonical_prompt"),
                    "error": item.get("error"),
                }

        @self.router.post("/{canonical_id}/approve")
        def approve_canonical(canonical_id: str):
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    return JSONResponse(status_code=404, content={"error": "canonical not found"})

                if item["status"] != "ready":
                    return JSONResponse(status_code=409, content={"error": "Canonical is not ready."})

                item["approved"] = True
                item["status"] = "approved"
                item["updated_at"] = time.time()

            return {
                "canonical_id": canonical_id,
                "approved": True,
            }

        @self.router.post("/{canonical_id}/regenerate")
        def regenerate_canonical(
            canonical_id: str,
            background_tasks: BackgroundTasks,
            edit_request: str = Form(""),
        ):
            with self.canonicals_lock:
                item = self.canonicals.get(canonical_id)
                if item is None:
                    return JSONResponse(status_code=404, content={"error": "canonical not found"})

                generation_number = int(item["generation_number"]) + 1
                item["generation_number"] = generation_number
                item["status"] = "generating"
                item["approved"] = False
                item["canonical_image"] = None
                item["canonical_image_pil"] = None
                item["error"] = None

                ref_image = item["original_image"]
                original_user_text = item["original_user_text"]
                ip_scale = item["ip_scale"]
                steps = item["steps"]

            background_tasks.add_task(
                self._run_canonical_job,
                canonical_id=canonical_id,
                ref_image=ref_image,
                original_user_text=original_user_text,
                edit_request=edit_request,
                ip_scale=ip_scale,
                steps=steps,
                generation_number=generation_number,
            )

            return {
                "canonical_id": canonical_id,
                "status": "generating",
            }

        @self.router.post("/{canonical_id}/generate-set")
        def generate_set(
            canonical_id: str,
            background_tasks: BackgroundTasks,
            indices: str = Form(""),
            variant_names: str = Form(""),
            candidate_count: int = Form(2),
            img2img_strength: float = Form(0.55),
            controlnet_scale: float = Form(0.90),
            num_inference_steps: int = Form(30),
        ):
            with self.canonicals_lock:
                canonical = self.canonicals.get(canonical_id)
                if canonical is None:
                    return JSONResponse(status_code=404, content={"error": "canonical not found"})
                if not canonical.get("approved"):
                    return JSONResponse(status_code=409, content={"error": "Approve the canonical first."})

            targets = self._parse_targets(indices, variant_names)
            if not targets:
                return JSONResponse(status_code=400, content={"error": "No valid generation slots."})

            candidate_count = max(1, min(4, int(candidate_count)))
            img2img_strength = max(0.40, min(0.70, float(img2img_strength)))
            controlnet_scale = max(0.30, min(1.50, float(controlnet_scale)))
            steps = max(20, min(50, int(num_inference_steps)))
            job_id = str(uuid.uuid4())

            with self.jobs_lock:
                self.jobs[job_id] = {
                    "status": "running",
                    "completed": 0,
                    "total": len(targets),
                    "images": [],
                    "error": None,
                    "created_at": time.time(),
                    "finished_at": None,
                    "canonical_id": canonical_id,
                }

            background_tasks.add_task(
                self._run_sticker_job,
                job_id=job_id,
                canonical_id=canonical_id,
                targets=targets,
                candidate_count=candidate_count,
                img2img_strength=img2img_strength,
                controlnet_scale=controlnet_scale,
                steps=steps,
            )

            return {"job_id": job_id}

        @self.router.get("/generate-set/{job_id}/status")
        def get_generate_set(job_id: str, since: int = 0):
            with self.jobs_lock:
                job = self.jobs.get(job_id)
                if job is None:
                    return JSONResponse(status_code=404, content={"error": "job not found"})

                images = job["images"]
                new_images = images[since:] if 0 <= since < len(images) else []

                return {
                    "status": job["status"],
                    "completed": job["completed"],
                    "total": job["total"],
                    "images": new_images,
                    "error": job.get("error"),
                }


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
