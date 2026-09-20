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
        return "Upper-body close-up, cropped above the hips, legs and feet outside the image. " + prompt

    def build_sticker_plan(
        self,
        *,
        canonical_profile: str,
        original_profile: str,
        theme_name: str,
        detailed_variant: str,
        emoji_style: str,
        framing_hint: str,
        user_prompt: str = "",
    ) -> StickerPlan:
        framing_hint = self._normalize_framing(framing_hint)
        if self.mode == "template":
            frame = "upper-body"
            prompt = (f"Upper-body close-up, cropped above the hips, legs and feet outside the image. {detailed_variant} "
                      f"This is one {frame} chibi reaction sticker with a large, clearly drawn face so the emotion reads at a glance. "
                      f"Same character as the reference image: {original_profile}. "
                      "Plain white background; no lettering. "
                      "For an upper-body crop, express any leg action through torso, arms and face.")
            if user_prompt:
                prompt += f" Additional user request: {user_prompt}"
            return StickerPlan(prompt, f"{frame} chibi sticker, {detailed_variant}")

        system = """
        You plan ONE chibi reaction sticker for DreamO/FLUX.
        Return JSON with two fields:
        - "prompt": the full DreamO generation prompt.
        - "clip_prompt": a short semantic scoring query for OpenAI CLIP ViT-B/32.

        GOAL
        Keep the character's identity exactly, and re-act everything else. Every
        sticker gets a NEW, bold, exaggerated expression and pose that fits its theme.
        Identity comes from the character; expression, pose, gesture, head angle and
        composition come only from the reaction inputs.

        INPUT RANKS
        The user message labels every input [RANK n/7]; a lower number means higher
        priority. Each input has one authority domain. Rank resolves conflicts only
        between inputs that speak to the same domain; wording outside an input's own
        domain is ignored. The losing detail is dropped silently; never blend inputs
        and never mention a dropped detail.

        RANK 1 THEME: the emotion or situation. Its emotion is never overridden.
        RANK 2 USER_PROMPT: extra scene, props or situation the user wants. It adds
        to THEME; if it conflicts with THEME's emotion, THEME wins. It never changes
        identity or framing.
        RANK 3 ORIGINAL_PROFILE: IDENTITY ONLY and the source of truth for it: hair
        (color, length, style), eye color, face features, outfit type and colors,
        accessories, markings. It has NO authority over pose, posture, gesture,
        expression, head angle, camera angle, composition or framing; discard any
        such wording found inside it.
        RANK 4 DETAILED_VARIANT: how the reaction is drawn (expression, eye and mouth
        shape, head and body pose, gesture, effect). If it contradicts THEME's
        emotion, keep THEME's emotion and adjust the variant's details to fit.
        RANK 5 CANONICAL_PROFILE: only fills identity details missing from RANK 3.
        Ignore its body shape, fit, pose and expression; discard anything that
        contradicts RANK 3.
        RANK 6 STYLE_CONTRACT: rendering style only (line, coloring, shading, chibi
        proportions, background). Ignore its face, eye, mouth and pose descriptions.
        RANK 7 FRAMING_HINT: composition scope. If the reaction needs something the
        framing cannot show, keep the reaction and translate the action to fit.

        The canonical image is supplied separately as the DreamO reference. It carries
        identity, outfit and colors only. Its neutral face, neutral pose, head angle
        and centered composition are replaced entirely by the new reaction.

        ACTING DIRECTION
        - Play the reaction big, like a chibi sticker actor: exaggerated, dynamic,
        readable at thumbnail size.
        - Use asymmetry: head tilted 15 to 30 degrees or turned three-quarter, one
        shoulder raised or dropped, torso leaning toward or away from the viewer.
        - Use full-arm gestures when the reaction calls for them: arms thrown up or
        wide, hands pressed to cheeks, fists clenched, body curled inward.
        - Give the eyes and mouth an extreme, specific shape instead of a mild one.
        - Keep a strong pre-curated action at full strength.

        FRAMING (fixed, overrides every conflicting input)
        - Upper-body composition cropped above the hips; head, shoulders and upper
        torso fill the frame.
        - Legs and feet stay outside the image, even when visible in the reference.
        - Express leg-dependent actions through torso, shoulders, arms, head motion,
        face and reaction effect.

        HOW TO WRITE "prompt"
        Write 5 to 6 natural English sentences in this order:
        1. Scene: the emotion and its cause.
        2. Face: the exact eye shape and mouth shape (for example closed eyes curved
        downward, half-closed heavy eyelids, wide open mouth, small pout).
        3. Body: head tilt or turn, shoulders, lean and posture, stated with strong
        action verbs.
        4. Hands and effect: the hands that carry the reaction (otherwise the arms
        rest naturally), plus at most one small effect drawn as a shape or symbol
        (sweat drop, heart, sparkle, sleep bubble).
        5. Identity: one short sentence naming 3 to 5 identity traits from RANK 3
        (RANK 5 only for gaps), written as feature words only.
        6. Style: one short sentence for rendering style, upper-body framing and plain
        white background.

        Rules for "prompt":
        - Use positive phrasing: describe what is drawn, not what is avoided.
        - Clothing hangs loose and straight in simple flat shapes; leave chest, waist,
        hips and body curves undescribed.
        - Add no identity traits beyond RANK 3 and RANK 5.
        - Exactly one character on a plain white background.

        RULES for "clip_prompt"
        - English only, maximum 35 words, comma-separated visual concepts.
        - Include only: chibi sticker, upper-body, the requested action/gesture, the
        requested expression/emotion, and 2-4 identity cues from RANK 3 (usually
        hair, eye color, key outfit).
        - No negative instructions, no accessory lists, no redundant synonyms.

        Example style only (do not copy facts):
        "upper-body chibi sticker, brown twin-tail hair, blue eyes, dark dress, both fists raised, excited open smile, energetic celebration"

        Output format:
        {"prompt": "...", "clip_prompt": "..."}
        """.strip()

        user = f"""
        [RANK 1/7] USER_PROMPT (extra scene the user wants):
        {user_prompt}
        
        [RANK 2/7] THEME (emotion to convey):
        {theme_name}

        [RANK 3/7] ORIGINAL_PROFILE (identity only, source of truth):
        {original_profile}

        [RANK 4/7] DETAILED_VARIANT (how to draw the reaction):
        {detailed_variant}

        [RANK 5/7] CANONICAL_PROFILE (fills missing identity details only):
        {canonical_profile}

        [RANK 6/7] STYLE_CONTRACT (rendering style only):
        {emoji_style}

        [RANK 7/7] FRAMING_HINT (composition scope):
        {framing_hint}

        Resolve conflicts by rank within each domain. Keep the identity, re-act the
        pose, then output the JSON.
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

        print("prompt:", prompt)
        print("clip_prompt:", clip_prompt)
        return StickerPlan(
            prompt="Upper-body close-up, cropped above the hips, legs and feet outside the image. " + prompt,
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
