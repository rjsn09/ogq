from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any



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
        print("=== API CONFIG ===")
        print("PROMPT_PLANNER_MODE:", os.getenv("PROMPT_PLANNER_MODE"))
        print("PROMPT_LLM_MODEL:", os.getenv("PROMPT_LLM_MODEL"))
        print("LLM_BASE_URL:", os.getenv("LLM_BASE_URL") or "(default)")
        print("OPENAI_API_KEY:", "SET" if os.getenv("OPENAI_API_KEY") else "MISSING")
        print("GROQ_API_KEY:", "SET" if os.getenv("GROQ_API_KEY") else "MISSING")
        print("GROQ_VISION_MODEL:", os.getenv("GROQ_VISION_MODEL"))
        print("==================")
        self.mode = os.getenv("PROMPT_PLANNER_MODE", "template").strip().lower()
        if self.mode not in {"template", "llm"}:
            raise ValueError("PROMPT_PLANNER_MODE must be template or llm.")
        self.client = None
        self.model = os.getenv("PROMPT_LLM_MODEL", "").strip()
        if self.mode == "llm":
            from openai import OpenAI

            base_url = os.getenv(
                "LLM_BASE_URL",
                "https://api.openai.com/v1"
            ).strip()

            if "api.groq.com" in base_url:
                api_key = os.getenv(
                    "GROQ_API_KEY",
                    ""
                ).strip()
            else:
                api_key = os.getenv(
                    "OPENAI_API_KEY",
                    ""
                ).strip()

            if not api_key:
                raise RuntimeError(
                    "LLM API key is missing."
                )

            if not self.model:
                raise RuntimeError(
                    "PROMPT_LLM_MODEL is missing."
                )

            self.client = OpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=45.0,
                max_retries=1
            )

    @staticmethod
    def _normalize_framing(value: str) -> str:
        # Output composition is fixed regardless of reference framing.
        return "upper_body"

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        text = text.strip()
        if text.startswith("```"):
            lines = text.splitlines()
            if lines[-1].strip() == "```":
                text = "\n".join(lines[1:-1]).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            # Preserve the root type even when the model adds introductory text.
            starts = [index for index in (text.find("{"), text.find("[")) if index >= 0]
            if not starts:
                raise ValueError("LLM did not return a JSON object.")
            data, _ = json.JSONDecoder().raw_decode(text[min(starts):])
        if isinstance(data, list) and len(data) == 1:
            data = data[0]
        if not isinstance(data, dict):
            raise ValueError("LLM must return one JSON object, not a list or scalar.")
        if not isinstance(data.get("prompt"), str) or not data["prompt"].strip():
            raise ValueError("LLM JSON must contain a non-empty prompt string.")
        return data

    def _json_call(
        self,
        system: str,
        user: str,
    ) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        for attempt in range(2):
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or "{}"
            try:
                return self._parse_json(content)
            except ValueError as exc:
                if attempt == 1:
                    raise ValueError(
                        "LLM이 올바른 프롬프트 JSON을 반환하지 못했습니다. 다시 생성해 주세요."
                    ) from exc
                messages.append({
                    "role": "user",
                    "content": "Return exactly ONE JSON object with a non-empty string field "
                               "'prompt' and the other requested fields. Do not return an array.",
                })

    def build_canonical_prompt(
        self,
        *,
        character_profile: str,
        user_request: str,
        emoji_style: str,
        framing_hint: str,
    ) -> str:
        framing_hint = self._normalize_framing(framing_hint)
        # Shared by template and LLM modes: identity reference must not lock acting.
        detailed_variant = (
            detailed_variant + ". Re-stage the head, torso and both arms for this reaction; "
            "use the reference only for character appearance, never as a pose template. "
            "Keep the requested turn, lean and asymmetric hand positions visible within the upper-body crop."
        )
        if self.mode == "template":
            frame = "Upper-body close-up, head, shoulders and upper torso filling the frame, cropped above the hips; legs and feet outside the image"
            return (f"{emoji_style}. {frame}. One neutral front-facing chibi character, arms relaxed, "
                    f"eyes open, closed mouth, no props or text. Identity: {character_profile}. "
                    f"Requested correction: {user_request or 'none'}. Preserve only supported identity features.")

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

Always use upper-body framing, regardless of reference image or other inputs:
- create an upper-body canonical only
- crop above the hips with head, shoulders and upper torso filling the frame
- keep legs, feet and lower-body clothing outside the image, even if visible in the reference
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
        return "Upper-body sticker, lower edge cuts across the mid-torso. Head, shoulders and arms fill the image; hips, legs and feet are outside the crop. " + prompt

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
        # Shared by template and LLM modes: identity reference must not lock acting.
        detailed_variant = (
            detailed_variant + ". Re-stage the head, torso and both arms for this reaction; "
            "use the reference only for character appearance, never as a pose template. "
            "Keep the requested turn, lean and asymmetric hand positions visible within the upper-body crop."
        )
        if self.mode == "template":
            frame = "upper-body"
            prompt = (f"Upper-body sticker, lower edge cuts across the mid-torso. Head, shoulders and arms fill the image; hips, legs and feet are outside the crop. One {frame} chibi reaction sticker. Action and expression: {detailed_variant}. "
                      "Make the hands, silhouette and facial expression clearly readable. "
                      f"Preserve character identity from the approved reference: {canonical_profile}. "
                      "Change the pose to match the reaction. Plain white background; no lettering. "
                      "For an upper-body crop, express any leg action through torso, arms and face.")
            return StickerPlan(prompt, f"{frame} chibi sticker, {detailed_variant}")


        system = """
You plan ONE chibi reaction sticker for DreamO/FLUX.
HARD CONSTRAINT: upper-body crop overrides every other input.
Write crop first, then torso direction and both hand positions, then expression,
then brief identity and style. Preserve appearance, not the reference pose.
Never reduce a directed turn or lean to a straight-on neutral bust.

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
This fixed composition overrides any conflicting profile, style or reaction detail.
- Crop above the hips; head, shoulders and upper torso fill the frame.
- Legs and feet stay outside the image even when visible in the reference.
Always use upper-body framing, regardless of reference image or other inputs:
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
  * upper-body
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
            frame_text = "upper-body"
            clip_prompt = (
                f"{frame_text} chibi sticker, {theme_name}, expressive reaction"
            )

        return StickerPlan(
            prompt="Upper-body sticker, lower edge cuts across the mid-torso. Head, shoulders and arms fill the image; hips, legs and feet are outside the crop. " + prompt,
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
