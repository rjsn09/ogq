from __future__ import annotations

import gc
import json
import os
from dataclasses import dataclass
from typing import Any

import torch
from diffusers import ControlNetModel, DPMSolverMultistepScheduler, StableDiffusionXLControlNetImg2ImgPipeline
from openai import OpenAI
from PIL import Image, ImageDraw


POSE_JOINTS = (
    "nose",
    "neck",
    "right_shoulder",
    "right_elbow",
    "right_wrist",
    "left_shoulder",
    "left_elbow",
    "left_wrist",
    "right_hip",
    "right_knee",
    "right_ankle",
    "left_hip",
    "left_knee",
    "left_ankle",
)

NEUTRAL_POSE: dict[str, list[float]] = {
    "nose": [0.50, 0.17],
    "neck": [0.50, 0.29],
    "right_shoulder": [0.43, 0.31],
    "right_elbow": [0.40, 0.44],
    "right_wrist": [0.39, 0.57],
    "left_shoulder": [0.57, 0.31],
    "left_elbow": [0.60, 0.44],
    "left_wrist": [0.61, 0.57],
    "right_hip": [0.46, 0.55],
    "right_knee": [0.45, 0.71],
    "right_ankle": [0.44, 0.87],
    "left_hip": [0.54, 0.55],
    "left_knee": [0.55, 0.71],
    "left_ankle": [0.56, 0.87],
}


@dataclass
class StickerPlan:
    prompt: str
    keypoints: dict[str, list[float]]


class PromptPlanner:
    def __init__(self) -> None:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is None ")

        base_url = os.getenv("LLM_BASE_URL", "").strip()
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url: kwargs["base_url"] = base_url

        self.client = OpenAI(**kwargs)
        self.model = os.getenv("PROMPT_LLM_MODEL", "gpt-5.6-luna").strip()

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end <= start:
                raise ValueError(f"LLM did not return JSON: {text[:300]}")
            return json.loads(text[start : end + 1])

    def _json_call(self, system: str, user: str) -> dict[str, Any]:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return self._parse_json(content)

    def build_canonical_prompt(
        self,
        *,
        character_profile: str,
        user_request: str,
        emoji_style: str,
    ) -> str:
        system = """
You create prompts for a character-preserving SDXL emoji pipeline.

Your job is NOT to redesign, beautify, or reinterpret the character.
Treat the supplied character profile as identity facts that must be preserved.
Never invent hair ornaments, clothing details, colors, accessories, eye colors,
or facial traits that are not supported by the input.

The output image is a CANONICAL CHARACTER REFERENCE, not a reaction sticker.

The canonical pose MUST be:
- one single character
- full body
- directly front-facing or almost front-facing
- standing upright in a neutral, balanced posture
- head level, no dramatic tilt
- shoulders level
- both arms relaxed naturally beside the torso and slightly separated from it
- both hands visible and relaxed
- feet visible
- neutral closed-mouth expression or extremely mild friendly expression
- eyes naturally open
- no gesture, no action, no prop, no text, no speech bubble, no decorative effect
- pure/simple white background
- clean readable silhouette

Return JSON only:
{"prompt": "..."}
""".strip()

        user = f"""
CHARACTER PROFILE:
{character_profile}

USER REQUEST:
{user_request or "(none)"}

EXISTING EMOJI STYLE CONTRACT:
{emoji_style}

Build one detailed English generation prompt. Preserve the supplied style contract;
do not replace it with a new art style.
""".strip()

        data = self._json_call(system, user)
        prompt = str(data.get("prompt", "")).strip()
        if not prompt:
            raise ValueError("LLM returned an empty canonical prompt.")
        return prompt

    def build_sticker_plan(
        self,
        *,
        canonical_profile: str,
        original_profile: str,
        theme_name: str,
        detailed_variant: str,
        emoji_style: str,
    ) -> StickerPlan:
        joints = ", ".join(POSE_JOINTS)
        system = f"""
You plan ONE reaction sticker from an approved canonical character.

CRITICAL IDENTITY RULE:
- The canonical/original character traits are fixed facts.
- Do not redesign the character.
- Do not add unsupported hair, eye, face, clothing, accessory, or color traits.
- The character's identity and art style must stay the same.
- Only expression, pose, gesture, action, composition, and small reaction effects may change.

POSE RULE:
The image generator will receive the canonical image separately through img2img.
Your prompt must therefore strongly and concretely describe the NEW pose instead of
describing only an emotion. State torso direction, head direction, both arms, both
hands, legs when visible, facial expression, action, and composition.

You must also output normalized 2D pose keypoints for ControlNet.
Coordinate system: x=0 left, x=1 right, y=0 top, y=1 bottom.
Keep all values inside [0.05, 0.95].
Required joints:
{joints}

The skeleton should match a cute/chibi character and the requested action.
For upper-body compositions, still provide plausible hips/knees/ankles so ControlNet
receives a complete body pose. For sitting/lying/jumping poses, actually move the
whole body accordingly.

Return JSON only in this exact shape:
{{
  "prompt": "one detailed English SDXL prompt",
  "keypoints": {{
    "nose": [0.0, 0.0],
    "neck": [0.0, 0.0],
    "right_shoulder": [0.0, 0.0],
    "right_elbow": [0.0, 0.0],
    "right_wrist": [0.0, 0.0],
    "left_shoulder": [0.0, 0.0],
    "left_elbow": [0.0, 0.0],
    "left_wrist": [0.0, 0.0],
    "right_hip": [0.0, 0.0],
    "right_knee": [0.0, 0.0],
    "right_ankle": [0.0, 0.0],
    "left_hip": [0.0, 0.0],
    "left_knee": [0.0, 0.0],
    "left_ankle": [0.0, 0.0]
  }}
}}
""".strip()

        user = f"""
APPROVED CANONICAL PROFILE:
{canonical_profile}

ORIGINAL CHARACTER PROFILE:
{original_profile}

EMOJI STYLE CONTRACT:
{emoji_style}

THEME:
{theme_name}

PRE-CURATED DETAILED VARIANT:
{detailed_variant}

Turn the pre-curated variant into one coherent final prompt.
The pre-curated variant defines the reaction and composition; do not weaken it.
""".strip()

        data = self._json_call(system, user)
        prompt = str(data.get("prompt", "")).strip()
        raw_kp = data.get("keypoints") or {}

        if not prompt:
            raise ValueError("LLM returned an empty sticker prompt.")

        keypoints: dict[str, list[float]] = {}
        for joint in POSE_JOINTS:
            value = raw_kp.get(joint, NEUTRAL_POSE[joint])
            if not isinstance(value, (list, tuple)) or len(value) != 2:
                value = NEUTRAL_POSE[joint]
            x = max(0.05, min(0.95, float(value[0])))
            y = max(0.05, min(0.95, float(value[1])))
            keypoints[joint] = [x, y]

        return StickerPlan(prompt=prompt, keypoints=keypoints)

LIMBS = (
    ("neck", "right_shoulder"),
    ("right_shoulder", "right_elbow"),
    ("right_elbow", "right_wrist"),
    ("neck", "left_shoulder"),
    ("left_shoulder", "left_elbow"),
    ("left_elbow", "left_wrist"),
    ("neck", "right_hip"),
    ("right_hip", "right_knee"),
    ("right_knee", "right_ankle"),
    ("neck", "left_hip"),
    ("left_hip", "left_knee"),
    ("left_knee", "left_ankle"),
    ("nose", "neck"),
    ("right_hip", "left_hip"),
)

OPENPOSE_COLORS = (
    (255, 0, 0),
    (255, 85, 0),
    (255, 170, 0),
    (255, 255, 0),
    (170, 255, 0),
    (85, 255, 0),
    (0, 255, 0),
    (0, 255, 85),
    (0, 255, 170),
    (0, 255, 255),
    (0, 170, 255),
    (0, 85, 255),
    (0, 0, 255),
    (85, 0, 255),
)


TARGET_IMAGE_SIZE = 768


def render_pose_image(keypoints: dict[str, list[float]], size: tuple[int, int] = (TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE)) -> Image.Image:
    w, h = size
    image = Image.new("RGB", size, (0, 0, 0))
    draw = ImageDraw.Draw(image)

    def point(name: str) -> tuple[int, int]:
        x, y = keypoints.get(name, NEUTRAL_POSE[name])
        return int(x * w), int(y * h)

    line_width = max(6, int(min(w, h) * 0.010))
    joint_radius = max(5, int(min(w, h) * 0.008))

    for i, (a, b) in enumerate(LIMBS):
        color = OPENPOSE_COLORS[i % len(OPENPOSE_COLORS)]
        draw.line([point(a), point(b)], fill=color, width=line_width)

    for i, joint in enumerate(POSE_JOINTS):
        x, y = point(joint)
        color = OPENPOSE_COLORS[i % len(OPENPOSE_COLORS)]
        draw.ellipse(
            [x - joint_radius, y - joint_radius, x + joint_radius, y + joint_radius],
            fill=color,
        )

    return image

class ControlNetStickerEngine:
    def __init__(self, emoji_generator: Any) -> None:
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA is not availabel")

        self.g = emoji_generator
        self.g.device = "cuda"
        self.g.torch_dtype = torch.float16

        controlnet_model = os.getenv("OPENPOSE_CONTROLNET_MODEL", "thibaud/controlnet-openpose-sdxl-1.0").strip()
        self.g._cleanup_memory()

        self.controlnet = ControlNetModel.from_pretrained(
            controlnet_model,
            torch_dtype=torch.float16,
            use_safetensors=True,
        )

        self.pipe = StableDiffusionXLControlNetImg2ImgPipeline.from_pipe(self.g.img2img, controlnet=self.controlnet)

        self.pipe.scheduler = DPMSolverMultistepScheduler.from_config(
            self.pipe.scheduler.config,
            algorithm_type="sde-dpmsolver++",
            use_karras_sigmas=True,
        )

        self.pipe.vae.enable_slicing()
        self.pipe.vae.enable_tiling()

        self.pipe.enable_model_cpu_offload()

    def generate_candidates(
        self,
        *,
        canonical_image: Image.Image,
        final_prompt: str,
        pose_image: Image.Image,
        num_inference_steps: int,
        strength: float,
        controlnet_scale: float,
        candidate_count: int,
        seed_base: int,
    ) -> list[Image.Image]:
        self.g._set_ip_scale(0.0)
        try:
            self.pipe.enable_lora()
        except Exception:
            pass

        try:
            lora_weight = float(os.getenv("LORA_WEIGHT", "0.65"))
            self.pipe.set_adapters(["emoji_style"], adapter_weights=[lora_weight])
        except Exception:
            pass

        prompt_embeds, pooled_prompt_embeds, negative_prompt_embeds, negative_pooled_prompt_embeds = self.g._embed_prompt(final_prompt)

        gc.collect()
        torch.cuda.empty_cache()

        init_image = self.g._pad_to_square(canonical_image)
        init_image = self.g._on_white(init_image).resize((TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE), Image.Resampling.LANCZOS)
        pose_image = pose_image.convert("RGB").resize((TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE), Image.Resampling.NEAREST)

        outputs: list[Image.Image] = []
        for i in range(candidate_count):
            with torch.inference_mode():
                result = self.pipe(
                    prompt_embeds=prompt_embeds,
                    pooled_prompt_embeds=pooled_prompt_embeds,
                    negative_prompt_embeds=negative_prompt_embeds,
                    negative_pooled_prompt_embeds=negative_pooled_prompt_embeds,
                    image=init_image,
                    control_image=pose_image,
                    strength=float(strength),
                    controlnet_conditioning_scale=float(controlnet_scale),
                    control_guidance_start=0.0,
                    control_guidance_end=0.90,
                    num_inference_steps=int(num_inference_steps),
                    guidance_scale=7.0,
                    generator=self.g._seeded_generator(seed_base + i),
                )
                out = result.images[0]

            outputs.append(out)

            del result
            gc.collect()
            torch.cuda.empty_cache()
            self.g._cleanup_memory()

        return outputs
