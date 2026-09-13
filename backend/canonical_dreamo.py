from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from openai import OpenAI


@dataclass
class StickerPlan:
    prompt: str
    clip_prompt: str


class PromptPlanner:
    """
    Prompt planner for DreamO.

    Groq Vision supplies persistent character appearance plus source framing.
    The LLM composes either a canonical chibi reference or a reaction sticker.
    """

    def __init__(self) -> None:
        api_key = os.getenv("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is required.")

        base_url = os.getenv("LLM_BASE_URL", "").strip()
        kwargs: dict[str, Any] = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url

        self.client = OpenAI(**kwargs)
        self.model = os.getenv(
            "PROMPT_LLM_MODEL",
            "gpt-5.6-luna",
        ).strip()

    @staticmethod
    def _normalize_framing(value: str) -> str:
        value = str(value or "upper_body").strip().lower()
        if value == "full_body":
            return "full_body"
        return "upper_body"

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start < 0 or end <= start:
                raise ValueError(
                    f"LLM did not return JSON: {text[:300]}"
                )
            return json.loads(text[start:end + 1])

    def _json_call(
        self,
        system: str,
        user: str,
    ) -> dict[str, Any]:
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
        framing_hint: str,
    ) -> str:
        framing_hint = self._normalize_framing(framing_hint)

        system = """
You create ONE canonical chibi character-reference prompt for DreamO/FLUX.

PURPOSE:
The canonical is the visual identity AND sticker-style reference used by all
later reaction stickers. It MUST therefore remain a polished chibi messenger
sticker rather than reverting to realistic or normal anime proportions.

IDENTITY:
- CHARACTER PROFILE contains persistent, visible identity facts.
- Preserve those facts faithfully.
- Do not invent unsupported hair details, colors, clothing, accessories,
  markings, lower-body garments, or hidden character features.

CHIBI STYLE IS REQUIRED:
- oversized expressive head
- compact but readable chibi body
- clean dark outlines
- simple flat colors
- minimal cel shading
- clean readable silhouette
- one character only
- plain white background

Do NOT make the body so tiny that anatomy or visible clothing becomes unreadable.

FRAMING:
You will receive FRAMING_HINT.

If FRAMING_HINT is "full_body":
- create a full-body canonical from head to feet
- keep the entire chibi body comfortably inside the frame
- both hands and both feet must be clearly visible
- upright neutral balanced stance
- arms relaxed beside the torso and slightly separated
- legs/feet simple, readable, and not cropped

If FRAMING_HINT is "upper_body":
- create an upper-body canonical only
- preserve roughly the source's available information scope
- prominently show head, hair, shoulders, chest/torso, and visible arms/hands
- DO NOT invent or force unseen legs, feet, shoes, or hidden lower-body clothing
- use a centered neutral upper-body composition

COMMON CANONICAL POSE:
- front-facing or almost front-facing
- head level, shoulders level
- eyes naturally open
- neutral calm closed-mouth expression
- no action
- no dramatic gesture
- no reaction effect
- no prop unless it is a permanent worn identity accessory
- no text or speech bubble

The source reference is for identity, not pose. Do not copy its temporary pose,
facial expression, gaze, action, background, or camera angle.

Write a clear DreamO/FLUX prompt with the most important constraints first.
Avoid redundant prose and repeated identity lists.

Return JSON only:
{"prompt": "..."}
""".strip()

        user = f"""
CHARACTER PROFILE:
{character_profile}

FRAMING_HINT:
{framing_hint}

USER CORRECTION / REQUEST:
{user_request or "(none)"}

OGQ STYLE CONTRACT:
{emoji_style or "(use the required chibi messenger-sticker style)"}

Write one coherent English canonical generation prompt.
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
        framing_hint: str,
    ) -> StickerPlan:
        framing_hint = self._normalize_framing(framing_hint)

        system = """
You plan ONE chibi reaction sticker for DreamO/FLUX.

Return TWO prompts:
1. "prompt": full DreamO generation prompt.
2. "clip_prompt": a short semantic scoring query for OpenAI CLIP ViT-B/32.

IDENTITY RULES FOR "prompt":
- The approved canonical image is supplied separately as DreamO IP reference.
- Preserve the same character identity, visible outfit structure, accessories,
  distinctive markings, and major colors.
- Do not redesign the character or add unsupported identity traits.
- Keep the polished Korean messenger-sticker chibi style.

ACTION RULES FOR "prompt":
- The NEW requested reaction is the main change.
- Make the action and facial expression immediately readable.
- Describe torso/head orientation, both visible arms/hands, posture, expression,
  and small reaction effects when useful.
- Do not weaken a strong pre-curated action into a neutral pose.
- Exactly one character.

FRAMING RULES:
If FRAMING_HINT is "full_body":
- retain a full-body sticker composition
- actions may use legs and feet
- keep the whole body readable and inside frame unless the requested action
  inherently requires a very slight dynamic crop

If FRAMING_HINT is "upper_body":
- retain an upper-body sticker composition
- do not invent unseen lower-body identity details
- reinterpret leg-dependent actions through torso, shoulders, arms, hands,
  head motion, expression, and reaction effects while preserving the reaction
- do not suddenly generate a full-body character

CLIP_PROMPT RULES:
- English only
- maximum 35 words
- concrete comma-separated visual concepts are preferred over long prose
- include ONLY the information useful for candidate ranking:
  * chibi sticker
  * full-body OR upper-body
  * requested action/gesture
  * requested expression/emotion
  * 2-4 highest-value identity cues, usually hair, eye color, and key outfit
- no negative instructions
- no exhaustive accessory list
- no camera-analysis wording
- no redundant synonyms
- it must remain safely below CLIP's 77-token context window

Example style only (do not copy facts):
"upper-body chibi sticker, brown twin-tail hair, blue eyes, dark dress, both fists raised, excited open smile, energetic celebration"

Return JSON only:
{
  "prompt": "...",
  "clip_prompt": "..."
}
""".strip()

        user = f"""
APPROVED CANONICAL PROFILE:
{canonical_profile}

ORIGINAL CHARACTER PROFILE:
{original_profile}

FRAMING_HINT:
{framing_hint}

OGQ STYLE CONTRACT:
{emoji_style}

THEME:
{theme_name}

PRE-CURATED DETAILED VARIANT:
{detailed_variant}

Create the full DreamO prompt and a concise CLIP scoring prompt. Preserve the
requested reaction strongly while respecting the framing hint.
""".strip()

        data = self._json_call(system, user)
        prompt = str(data.get("prompt", "")).strip()
        clip_prompt = str(data.get("clip_prompt", "")).strip()

        if not prompt:
            raise ValueError("LLM returned an empty sticker prompt.")
        if not clip_prompt:
            frame_text = "full-body" if framing_hint == "full_body" else "upper-body"
            clip_prompt = (
                f"{frame_text} chibi sticker, {theme_name}, expressive reaction"
            )

        return StickerPlan(
            prompt=prompt,
            clip_prompt=clip_prompt,
        )


class DreamOStickerEngine:
    def __init__(self, emoji_generator: Any) -> None:
        self.g = emoji_generator

    def generate_candidates(
        self,
        *,
        canonical_image,
        final_prompt: str,
        num_inference_steps: int,
        candidate_count: int,
        seed_base: int,
        strength: float = 0.55,
        controlnet_scale: float = 0.90,
    ):
        return self.g.generate_sticker_candidates(
            canonical_image=canonical_image,
            final_prompt=final_prompt,
            num_inference_steps=num_inference_steps,
            candidate_count=candidate_count,
            seed_base=seed_base,
        )
