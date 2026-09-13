from __future__ import annotations

import base64
import gc
import io
import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from groq import Groq
from rembg import new_session, remove
from transformers import CLIPModel, CLIPProcessor

logger = logging.getLogger("ogq")


class EmojiGenerator:
    """
    OGQ compatibility wrapper backed by DreamO v1.1.

    Replaces:
      - WD14/local Qwen -> Groq-hosted Qwen Vision character extraction
      - SDXL + IP-Adapter -> DreamO (FLUX.1-dev based)

    The public method names intentionally stay close to the previous
    EmojiGenerator so Server.py needs little or no change.
    """

    def __init__(
        self,
        model_id: str = "",
        lora_model: str = "",
    ) -> None:
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        if self.device != "cuda":
            raise RuntimeError(
                "DreamO generation requires CUDA for this OGQ configuration."
            )

        groq_api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not groq_api_key:
            raise RuntimeError(
                "GROQ_API_KEY is required for character appearance extraction."
            )

        self.groq_vision_model = os.getenv(
            "GROQ_VISION_MODEL",
            "qwen/qwen3.6-27b",
        ).strip()
        self.groq_client = Groq(api_key=groq_api_key)
        self.groq_vision_max_side = max(
            512,
            int(os.getenv("GROQ_VISION_MAX_SIDE", "2048")),
        )

        dreamo_root = Path(
            os.getenv("DREAMO_ROOT", "vendor/DreamO")
        ).resolve()
        if not dreamo_root.exists():
            raise RuntimeError(
                f"DreamO repo not found: {dreamo_root}. "
                "Clone bytedance/DreamO there or set DREAMO_ROOT."
            )

        if str(dreamo_root) not in sys.path:
            sys.path.insert(0, str(dreamo_root))

        try:
            from dreamo_generator import Generator as DreamOGenerator
        except Exception as exc:
            raise RuntimeError(
                "Failed to import DreamO. Install the official DreamO "
                "requirements in the generation environment."
            ) from exc

        quant = os.getenv("DREAMO_QUANT", "nunchaku").strip().lower()
        version = os.getenv("DREAMO_VERSION", "v1.1").strip()
        self.dreamo_memory_mode = os.getenv(
            "DREAMO_MEMORY_MODE",
            "gpu",
        ).strip().lower()

        if self.dreamo_memory_mode not in {"gpu", "low_vram"}:
            raise ValueError(
                "DREAMO_MEMORY_MODE must be either 'gpu' or 'low_vram'."
            )

        offload = self.dreamo_memory_mode == "low_vram"

        no_turbo = os.getenv("DREAMO_NO_TURBO", "0").strip() in {
            "1", "true", "True", "yes", "YES"
        }

        # Small speed-oriented CUDA settings. These do not change model weights
        # or generation quality.
        torch.backends.cuda.matmul.allow_tf32 = True
        if hasattr(torch.backends, "cudnn"):
            torch.backends.cudnn.allow_tf32 = True
            torch.backends.cudnn.benchmark = True

        torch.cuda.empty_cache()

        logger.info(
            "Loading DreamO version=%s quant=%s memory_mode=%s offload=%s GPU=%s",
            version,
            quant,
            self.dreamo_memory_mode,
            offload,
            torch.cuda.get_device_name(0),
        )

        try:
            self.dreamo = DreamOGenerator(
                version=version,
                quant=quant,
                offload=offload,
                no_turbo=no_turbo,
                device="cuda",
            )
        except torch.cuda.OutOfMemoryError as exc:
            torch.cuda.empty_cache()
            raise RuntimeError(
                "DreamO full-GPU loading ran out of VRAM. "
                "RTX 3060 12GB may be too small for DREAMO_MEMORY_MODE=gpu. "
                "Set DREAMO_MEMORY_MODE=low_vram to return to CPU offload, "
                "or use a partial-offload patch."
            ) from exc

        if self.dreamo_memory_mode == "gpu":
            pipeline = getattr(self.dreamo, "dreamo_pipeline", None)
            if pipeline is not None and getattr(pipeline, "offload", False):
                raise RuntimeError(
                    "DreamO unexpectedly enabled CPU offload while "
                    "DREAMO_MEMORY_MODE=gpu."
                )

        free_bytes, total_bytes = torch.cuda.mem_get_info()
        used_gib = (total_bytes - free_bytes) / (1024 ** 3)
        total_gib = total_bytes / (1024 ** 3)
        logger.info(
            "DreamO loaded. CUDA VRAM used %.2f / %.2f GiB",
            used_gib,
            total_gib,
        )

        self.base_positive = os.getenv(
            "OGQ_STYLE_PROMPT",
            (
                "high-quality 2D Korean messenger emoji sticker, "
                "cute chibi character, oversized expressive head, compact but readable chibi body, "
                "clean dark outlines, simple flat colors, minimal cel shading, "
                "clean readable silhouette, single character, centered composition, "
                "pure white background"
            ),
        ).strip()

        self.base_negative = os.getenv(
            "OGQ_NEGATIVE_PROMPT",
            (
                "photorealistic, realistic proportions, 3d render, "
                "complex background, background objects, watermark, logo, text, "
                "multiple characters, duplicate character, collage, grid, "
                "character sheet, extra limbs, missing limbs, malformed hands"
            ),
        ).strip()

        # Keep the existing CLIP candidate scorer.
        self.scorer_device = os.getenv("SCORER_DEVICE", "cpu").strip().lower()
        if self.scorer_device == "cuda" and not torch.cuda.is_available():
            self.scorer_device = "cpu"

        self.clip_processor = CLIPProcessor.from_pretrained(
            "openai/clip-vit-base-patch32"
        )
        self.clip_model = CLIPModel.from_pretrained(
            "openai/clip-vit-base-patch32"
        )
        self.clip_model.to(self.scorer_device)
        self.clip_model.eval()
        self.clip_model.requires_grad_(False)

        self.rembg_session = new_session(
            "isnet-anime",
            providers=["CPUExecutionProvider"],
        )

        if model_id:
            logger.info(
                "MODEL_ID=%s is ignored: DreamO uses FLUX.1-dev internally.",
                model_id,
            )
        if lora_model:
            logger.info(
                "LORA_MODEL=%s is ignored: an SDXL LoRA is not compatible "
                "with the DreamO/FLUX pipeline.",
                lora_model,
            )

    @staticmethod
    def _clamp(value: float, low: float, high: float) -> float:
        return max(low, min(high, value))

    def _cleanup_memory(self) -> None:
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    @staticmethod
    def _on_white(image: Image.Image) -> Image.Image:
        rgba = image.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        bg.alpha_composite(rgba)
        return bg.convert("RGB")

    @staticmethod
    def _pad_to_square(
        image: Image.Image,
        background=(255, 255, 255, 255),
    ) -> Image.Image:
        rgba = image.convert("RGBA")
        size = max(rgba.width, rgba.height)
        canvas = Image.new("RGBA", (size, size), background)
        x = (size - rgba.width) // 2
        y = (size - rgba.height) // 2
        canvas.alpha_composite(rgba, (x, y))
        return canvas

    @staticmethod
    def _clean_profile_json(payload: dict) -> dict[str, list[str]]:
        allowed = (
            "hair",
            "eyes",
            "face",
            "clothing",
            "accessories",
            "distinctive_features",
        )
        cleaned: dict[str, list[str]] = {}

        for key in allowed:
            value = payload.get(key, [])
            if isinstance(value, str):
                value = [value]
            if not isinstance(value, list):
                value = []

            items: list[str] = []
            seen: set[str] = set()
            for raw in value:
                item = str(raw).strip()
                if not item:
                    continue
                normalized = item.casefold()
                if normalized in seen:
                    continue
                seen.add(normalized)
                items.append(item)

            cleaned[key] = items

        return cleaned

    @staticmethod
    def _normalize_framing(value: object) -> str:
        framing = str(value or "unknown").strip().lower()
        aliases = {
            "full": "full_body",
            "fullbody": "full_body",
            "full-body": "full_body",
            "whole_body": "full_body",
            "whole-body": "full_body",
            "upper": "upper_body",
            "upperbody": "upper_body",
            "upper-body": "upper_body",
            "bust": "upper_body",
            "bust_shot": "upper_body",
            "half_body": "upper_body",
            "half-body": "upper_body",
        }
        framing = aliases.get(framing, framing)
        if framing not in {"full_body", "upper_body", "unknown"}:
            return "unknown"
        return framing

    @staticmethod
    def _clean_string_list(value: object) -> list[str]:
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list):
            return []

        out: list[str] = []
        seen: set[str] = set()
        for raw in value:
            item = str(raw).strip()
            if not item:
                continue
            key = item.casefold()
            if key in seen:
                continue
            seen.add(key)
            out.append(item)
        return out

    def _encode_for_groq(self, image: Image.Image) -> str:
        prepared = self._on_white(image)
        if max(prepared.size) > self.groq_vision_max_side:
            prepared.thumbnail(
                (
                    self.groq_vision_max_side,
                    self.groq_vision_max_side,
                ),
                Image.Resampling.LANCZOS,
            )

        buf = io.BytesIO()
        prepared.save(buf, format="PNG", optimize=True)
        return base64.b64encode(buf.getvalue()).decode("ascii")

    def _profile_request(
        self,
        image: Image.Image,
        user_hint: str = "",
    ) -> dict:
        system_prompt = """
You are a strict character-reference analyzer for an image-generation system.

Your job has TWO parts:
1. classify how much of the character is actually visible in the source image;
2. extract only persistent visual identity traits.

FRAMING CLASSIFICATION:
- "full_body": the whole character or almost the whole character is visible,
  including the lower body and feet or nearly all of them. A small crop at the
  extreme edge is acceptable if the image still clearly provides full-body
  information.
- "upper_body": the image shows mainly the head, shoulders, chest, torso,
  waist, or arms, but does not provide the complete lower body and feet.
- "unknown": use only when the framing cannot be determined reliably.

The canonical image must later preserve this information scope: a full-body
source should become a full-body canonical; an upper-body source should remain
upper-body rather than inventing unseen lower-body identity details.

PERSISTENT IDENTITY:
Return only traits that should normally remain when the same character is
redrawn with a completely different pose, action, gesture, facial expression,
gaze direction, and background.

INCLUDE only clearly visible persistent traits:
- hair color, length, cut, hairstyle, bangs, stable colored streaks/sections
- eye color and stable eye-design traits
- stable face identity traits
- clothing type, structure, layers, and colors that are actually visible
- accessories actually worn by the character
- permanent/non-temporary markings
- stable fantasy/non-human traits such as ears, horns, wings, or tail

EXCLUDE from identity traits:
- pose, posture, limb position
- action or gesture
- facial expression or emotion
- temporary open/closed mouth or eyes
- gaze or looking direction
- camera/view direction
- background/environment
- lighting and temporary effects
- temporary held props
- body/clothing details that are not visible and would need to be guessed

Do NOT infer hidden lower-body clothing from an upper-body image.
When uncertain, omit the detail instead of guessing.

Return JSON only, exactly with these keys:
{
  "framing": "full_body | upper_body | unknown",
  "visible_body_parts": [],
  "hair": [],
  "eyes": [],
  "face": [],
  "clothing": [],
  "accessories": [],
  "distinctive_features": []
}
""".strip()

        hint = user_hint.strip()
        user_text = (
            "Analyze this reference image. Determine whether it provides "
            "full-body or upper-body identity information, then extract only "
            "persistent visible character traits."
        )
        if hint:
            user_text += (
                "\nUser identity hint (use only when visually compatible): "
                + hint
            )

        image_b64 = self._encode_for_groq(image)

        try:
            completion = self.groq_client.chat.completions.create(
                model=self.groq_vision_model,
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": user_text,
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": (
                                        "data:image/png;base64,"
                                        + image_b64
                                    )
                                },
                            },
                        ],
                    },
                ],
                response_format={"type": "json_object"},
                reasoning_effort="none",
                temperature=0.1,
                max_completion_tokens=900,
            )
        except Exception as exc:
            raise RuntimeError(
                "Groq Vision character extraction failed "
                f"(model={self.groq_vision_model}): {exc}"
            ) from exc

        content = completion.choices[0].message.content or "{}"

        try:
            raw_profile = json.loads(content)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                "Groq Vision returned invalid JSON: "
                + content[:500]
            ) from exc

        if not isinstance(raw_profile, dict):
            raise RuntimeError(
                "Groq Vision JSON root must be an object."
            )

        profile = self._clean_profile_json(raw_profile)
        framing = self._normalize_framing(raw_profile.get("framing"))
        visible_body_parts = self._clean_string_list(
            raw_profile.get("visible_body_parts", [])
        )

        # Conservative fallback: if Groq is unsure, never invent hidden lower body.
        if framing == "unknown":
            lower_terms = {
                "legs", "leg", "feet", "foot", "shoes", "shoe",
                "full body", "whole body", "lower body",
            }
            visible_lower = any(
                any(term in part.casefold() for term in lower_terms)
                for part in visible_body_parts
            )
            framing = "full_body" if visible_lower else "upper_body"

        return {
            "framing": framing,
            "visible_body_parts": visible_body_parts,
            "profile": profile,
            "text": self._profile_to_text(profile),
        }

    def analyze_reference_image(
        self,
        image: Image.Image,
        user_hint: str = "",
    ) -> dict:
        """Return framing + persistent character appearance from Groq Vision."""
        return self._profile_request(image, user_hint=user_hint)

    def caption_image(
        self,
        image: Image.Image,
        threshold: float = 0.35,
        max_tags: int = 20,
    ) -> str:
        payload = self._profile_request(image)
        text = str(payload.get("text", "")).strip()
        if not text:
            profile = payload.get("profile")
            if isinstance(profile, dict):
                text = self._profile_to_text(profile)
        return text

    @staticmethod
    def _profile_to_text(profile: dict) -> str:
        parts: list[str] = []
        for key in (
            "hair",
            "eyes",
            "face",
            "clothing",
            "accessories",
            "distinctive_features",
        ):
            value = profile.get(key)
            if isinstance(value, str) and value.strip():
                parts.append(value.strip())
            elif isinstance(value, list):
                parts.extend(
                    str(item).strip()
                    for item in value
                    if str(item).strip()
                )
        return ", ".join(dict.fromkeys(parts))

    def build_character_profile(
        self,
        auto_caption: str,
        user_text: str,
    ) -> str:
        auto_caption = auto_caption.strip()
        user_text = user_text.strip()

        parts: list[str] = []
        if auto_caption:
            parts.append(
                "Reference-derived persistent character appearance: "
                + auto_caption
            )
        if user_text:
            parts.append(
                "User-provided character identity facts: "
                + user_text
            )
        return ". ".join(parts)

    def _resolved_steps(self, requested: int) -> int:
        # DreamO turbo is designed around ~12 steps.
        configured = os.getenv("DREAMO_STEPS", "12").strip()
        try:
            return max(8, min(30, int(configured)))
        except ValueError:
            return 12

    def _dreamo_generate(
        self,
        *,
        prompt: str,
        reference_images: list[Image.Image],
        reference_tasks: list[str],
        seed: int,
        requested_steps: int,
        width: int = 1024,
        height: int = 1024,
    ) -> Image.Image:
        ref_res = int(os.getenv("DREAMO_REF_RES", "640"))
        guidance = float(os.getenv("DREAMO_GUIDANCE", "4.5"))
        true_cfg = float(os.getenv("DREAMO_TRUE_CFG", "1.0"))
        neg_guidance = float(os.getenv("DREAMO_NEG_GUIDANCE", "3.5"))

        np_refs = [
            np.asarray(self._on_white(img), dtype=np.uint8)
            for img in reference_images
        ]

        ref_conds, _, resolved_seed = self.dreamo.pre_condition(
            ref_images=np_refs,
            ref_tasks=reference_tasks,
            ref_res=ref_res,
            seed=str(seed),
        )

        result = self.dreamo.dreamo_pipeline(
            prompt=prompt,
            width=int(width),
            height=int(height),
            num_inference_steps=self._resolved_steps(requested_steps),
            guidance_scale=guidance,
            ref_conds=ref_conds,
            generator=torch.Generator(
                device="cpu"
            ).manual_seed(int(resolved_seed)),
            true_cfg_scale=true_cfg,
            true_cfg_start_step=0,
            true_cfg_end_step=0,
            negative_prompt=self.base_negative,
            neg_guidance_scale=neg_guidance,
            first_step_guidance_scale=guidance,
        ).images[0]

        self._cleanup_memory()
        return result

    def generate_prompt_with_reference(
        self,
        *,
        prompt: str,
        ref_image: Optional[Image.Image],
        num_inference_steps: int = 12,
        seed: int = 42,
    ) -> Image.Image:
        refs: list[Image.Image] = []
        tasks: list[str] = []
        if ref_image is not None:
            refs.append(ref_image)
            tasks.append("ip")

        return self._dreamo_generate(
            prompt=prompt,
            reference_images=refs,
            reference_tasks=tasks,
            seed=seed,
            requested_steps=num_inference_steps,
        )

    def generate_base_character(
        self,
        character_profile: str,
        ref_image: Optional[Image.Image],
        ip_scale: float = 0.5,
        num_inference_steps: int = 30,
        seed: int = 42,
        framing_hint: str = "upper_body",
    ) -> Image.Image:
        # ip_scale is retained only for old API compatibility.
        framing_hint = self._normalize_framing(framing_hint)
        if framing_hint == "full_body":
            framing_text = (
                "Full-body canonical: show the complete chibi character from head "
                "to feet, with a compact but readable body, both hands and both "
                "feet clearly visible."
            )
        else:
            framing_text = (
                "Upper-body canonical: preserve the source information scope; show "
                "the head, shoulders and visible torso/arms clearly, and do not "
                "invent hidden lower-body identity details."
            )

        prompt = (
            f"{self.base_positive}. "
            f"{character_profile}. "
            "Create a canonical reusable chibi sticker reference of exactly one "
            "character. Keep the oversized expressive chibi head and compact but "
            "readable body proportions. "
            f"{framing_text} "
            "Use a front-facing or almost front-facing neutral composition, level "
            "head and shoulders, naturally open eyes, and a calm closed-mouth "
            "expression. Preserve persistent hair, eyes, face identity, visible "
            "clothing structure, accessories, markings, and main colors. "
            "Do not preserve the source pose, gesture, expression, gaze, camera "
            "angle, or background."
        )

        return self.generate_prompt_with_reference(
            prompt=prompt,
            ref_image=ref_image,
            num_inference_steps=num_inference_steps,
            seed=seed,
        )

    def generate_variant_candidates(
        self,
        character_profile: str,
        variant_desc: str,
        ref_image: Optional[Image.Image],
        base_image: Image.Image,
        ip_scale: float = 0.5,
        num_inference_steps: int = 28,
        strength: float = 0.55,
        candidate_count: int = 3,
        seed_base: int = 1000,
    ) -> list[Image.Image]:
        prompt = (
            f"{self.base_positive}. "
            f"{character_profile}. "
            f"Reaction/action: {variant_desc}. "
            "Keep exactly the same character identity, hairstyle, eye design, "
            "outfit structure, accessories, distinctive markings, and main colors "
            "as the reference. Change the pose, gesture, action and expression "
            "clearly to match the requested reaction. "
            "One character only, clean sticker composition."
        )

        outputs: list[Image.Image] = []
        for i in range(max(1, int(candidate_count))):
            outputs.append(
                self._dreamo_generate(
                    prompt=prompt,
                    reference_images=[base_image],
                    reference_tasks=["ip"],
                    seed=seed_base + i,
                    requested_steps=num_inference_steps,
                )
            )
        return outputs

    def generate_sticker_candidates(
        self,
        *,
        canonical_image: Image.Image,
        final_prompt: str,
        num_inference_steps: int,
        candidate_count: int,
        seed_base: int,
    ) -> list[Image.Image]:
        prompt = (
            f"{self.base_positive}. "
            f"{final_prompt}. "
            "Use the supplied canonical character as the fixed identity reference. "
            "Preserve identity, outfit structure, accessories, markings and colors; "
            "allow pose, gesture, action, expression and reaction effects to change."
        )

        outputs: list[Image.Image] = []
        for i in range(max(1, int(candidate_count))):
            outputs.append(
                self._dreamo_generate(
                    prompt=prompt,
                    reference_images=[canonical_image],
                    reference_tasks=["ip"],
                    seed=seed_base + i,
                    requested_steps=num_inference_steps,
                )
            )
        return outputs

    def image_feature(self, image: Image.Image) -> torch.Tensor:
        image = self._on_white(image)
        inputs = self.clip_processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self.scorer_device)

        with torch.inference_mode():
            vision_outputs = self.clip_model.vision_model(
                pixel_values=pixel_values
            )
            pooled_output = vision_outputs.pooler_output
            feature = self.clip_model.visual_projection(pooled_output)
            return F.normalize(feature, dim=-1)

    def sanitize_clip_prompt(
        self,
        text: str,
        max_content_tokens: int = 75,
    ) -> str:
        """
        Keep CLIP text within its 77-token context window.

        CLIP adds start/end special tokens, so at most 75 content tokens are kept.
        The sticker planner normally emits a much shorter prompt; this is the hard
        safety guard that prevents the tokenizer warning and indexing failures.
        """
        text = " ".join(str(text).strip().split())
        if not text:
            return "chibi character sticker"

        tokenizer = self.clip_processor.tokenizer
        encoded = tokenizer(
            text,
            add_special_tokens=False,
            truncation=True,
            max_length=max(1, min(75, int(max_content_tokens))),
            return_attention_mask=False,
        )
        token_ids = encoded.get("input_ids", [])
        if token_ids and isinstance(token_ids[0], list):
            token_ids = token_ids[0]
        cleaned = tokenizer.decode(
            token_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=True,
        ).strip()
        return cleaned or "chibi character sticker"

    def text_feature(self, text: str) -> torch.Tensor:
        text = self.sanitize_clip_prompt(text)
        inputs = self.clip_processor(
            text=[text],
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=77,
        )
        input_ids = inputs["input_ids"].to(self.scorer_device)
        attention_mask = inputs["attention_mask"].to(self.scorer_device)

        with torch.inference_mode():
            text_outputs = self.clip_model.text_model(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            pooled_output = text_outputs.pooler_output
            feature = self.clip_model.text_projection(pooled_output)
            return F.normalize(feature, dim=-1)

    @staticmethod
    def _cosine_from_features(
        a: torch.Tensor,
        b: torch.Tensor,
    ) -> float:
        return float(torch.matmul(a, b.T)[0, 0].item())

    def pick_best_candidate(
        self,
        candidates: list[Image.Image],
        base_feature: torch.Tensor,
        variant_feature: torch.Tensor,
        ref_feature: Optional[torch.Tensor] = None,
    ) -> tuple[Image.Image, float, dict[str, float]]:
        if not candidates:
            raise ValueError("Candidate list is empty.")

        best_image = candidates[0]
        best_score = float("-inf")
        best_details: dict[str, float] = {}

        for candidate in candidates:
            candidate_feature = self.image_feature(candidate)
            base_similarity = self._cosine_from_features(
                candidate_feature,
                base_feature,
            )
            prompt_similarity = self._cosine_from_features(
                candidate_feature,
                variant_feature,
            )

            if ref_feature is not None:
                ref_similarity = self._cosine_from_features(
                    candidate_feature,
                    ref_feature,
                )
                score = (
                    0.20 * ref_similarity
                    + 0.55 * base_similarity
                    + 0.25 * prompt_similarity
                )
            else:
                ref_similarity = 0.0
                score = (
                    0.65 * base_similarity
                    + 0.35 * prompt_similarity
                )

            if score > best_score:
                best_score = score
                best_image = candidate
                best_details = {
                    "reference": ref_similarity,
                    "base": base_similarity,
                    "prompt": prompt_similarity,
                }

        return best_image, best_score, best_details

    def to_ogq_sticker(
        self,
        image: Image.Image,
        canvas_size: tuple[int, int] = (740, 640),
        character_fill_ratio: float = 0.84,
    ) -> Image.Image:
        transparent = remove(
            image.convert("RGB"),
            session=self.rembg_session,
        ).convert("RGBA")

        alpha_bbox = transparent.getchannel("A").getbbox()
        if alpha_bbox:
            transparent = transparent.crop(alpha_bbox)

        if transparent.width <= 0 or transparent.height <= 0:
            raise ValueError("Background removal produced an empty image.")

        canvas_w, canvas_h = canvas_size
        max_w = max(1, int(canvas_w * character_fill_ratio))
        max_h = max(1, int(canvas_h * character_fill_ratio))

        resize_ratio = min(
            max_w / transparent.width,
            max_h / transparent.height,
        )
        new_w = max(1, int(transparent.width * resize_ratio))
        new_h = max(1, int(transparent.height * resize_ratio))

        transparent = transparent.resize(
            (new_w, new_h),
            Image.Resampling.LANCZOS,
        )

        canvas = Image.new(
            "RGBA",
            (canvas_w, canvas_h),
            (0, 0, 0, 0),
        )
        x = (canvas_w - new_w) // 2
        y = (canvas_h - new_h) // 2
        canvas.alpha_composite(transparent, (x, y))
        return canvas
