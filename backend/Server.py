import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"

import base64
import csv
import gc
import io
import json
import logging
import threading
import time
import traceback
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import onnxruntime as rt
import torch
import torch.nn.functional as F
import uvicorn
from compel import Compel, ReturnedEmbeddingsType
from diffusers import (
    AutoPipelineForImage2Image,
    AutoPipelineForText2Image,
    AutoencoderKL,
    DPMSolverMultistepScheduler,
)
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from huggingface_hub import hf_hub_download
from PIL import Image
from pyngrok import ngrok
from rembg import new_session, remove
from transformers import CLIPModel, CLIPProcessor, CLIPVisionModelWithProjection


load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ogq")

if torch.cuda.is_available():
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True
    torch.backends.cudnn.benchmark = True

VARIANT_PROMPTS = [
    ("기본", "neutral face, soft gentle smile, relaxed standing pose, looking at viewer"),
    ("활짝 웃음", "wide open-mouth smile, sparkling bright eyes, cheerful energetic pose, cartoon laughter marks, joyful atmosphere"),
    ("수줍음", "shy blushing cheeks, looking away bashfully, index fingers touching together, nervous sweet smile"),
    ("졸려요", "half-closed sleepy eyes, big yawn, droopy tired posture, stylized sleep bubbles"),
    ("화났어요", "puffed angry cheeks, cartoon anger symbol above head, clenched fists, energetic angry pose"),
    ("슬퍼요", "large glossy teary eyes, crying expression, drooping shoulders, small cartoon rain cloud, gloomy mood"),
    ("깜짝!", "jaw-dropped shocked face, wide eyes, jumping backward in surprise, large comic exclamation marks"),
    ("사랑해요", "making a large heart shape with both arms, blushing, heart-shaped highlights in eyes, floating hearts"),
    ("생각중", "hand resting on chin, head tilted, looking slightly upward, large thought bubble with a question symbol"),
    ("굿!", "large thumbs-up gesture toward viewer, confident proud smile, energetic sticker pose"),
    ("OK!", "making an OK hand sign, confident playful wink, energetic sticker pose"),
    ("파이팅!", "raised fist pumping high into the air, determined shouting face, energetic cartoon flame effects"),
    ("하하하", "laughing out loud, eyes closed happily, one hand holding belly, joyful tears, cartoon laughter marks"),
    ("당황", "flustered deeply blushing cheeks, several large sweat drops, awkward frozen smile, tense pose"),
    ("신남!", "jumping high with joy, arms raised, colorful confetti and sparkling stars, ecstatic grin"),
    ("힘들어요", "slouched exhausted posture, dark circles under eyes, sighing cartoon puff, deflated body language"),
    ("배고파", "hungry expression, holding stomach, tiny drool, cartoon empty-stomach effect"),
    ("냠냠", "eating happily, cheeks puffed with food, tiny crumbs, satisfied delicious smile"),
    ("잘게요", "lying down curled up, eyes closed peacefully, hugging a soft pillow, stylized sleep bubbles"),
    ("안녕!", "waving one hand high enthusiastically, bright friendly welcoming smile, looking at viewer"),
    ("감사해요", "bowing slightly forward, hands clasped together in gratitude, warm gentle grateful smile"),
    ("미안해요", "bowing deeply in apology, one large sweat drop, worried apologetic eyebrows, pleading expression"),
    ("응원해요", "holding a small colorful megaphone, enthusiastic cheering pose, sparkling energetic eyes"),
    ("최고야!", "sparkling star-like eyes, double thumbs up, triumphant proud pose, celebratory glow effects"),
]

EXTRA_VARIANT_PROMPTS = [
    ("박수쳐요", "clapping both hands enthusiastically, delighted applauding pose, beaming smile, small motion marks around hands"),
    ("안아줘요", "arms wide open reaching out for a hug, warm affectionate smile, inviting posture"),
    ("토닥토닥", "gently patting forward with one hand, comforting caring expression, soft warm mood"),
    ("메롱", "sticking tongue out playfully, one eye winking, cheeky teasing pose"),
    ("엉엉", "crying loudly with exaggerated cartoon tears, scrunched crying face, dramatic crouched pose"),
    ("두근두근", "both hands clasped over chest, deep blush, floating heart bubbles, excited anticipating eyes"),
    ("헐...", "frozen stunned expression, wide blank eyes, complete disbelief, drained cartoon mood"),
    ("땀뻘뻘", "nervous strained smile, many large sweat drops, tense rigid pose, shaking motion marks"),
    ("축하해요", "popping a party popper, colorful confetti, joyful celebrating pose, small party hat"),
    ("반가워요", "leaning forward and waving both hands rapidly, delighted welcoming grin, bright energetic mood"),
    ("시무룩", "slouched sitting pose, pouting lips, downturned mouth, gloomy deflated posture, soft face shadow"),
    ("으쓱", "shrugging shoulders, palms facing upward, smug closed-eye smile, casual playful pose"),
]

VARIANT_PROMPT_MAP: dict[str, str] = {
    name: desc for name, desc in VARIANT_PROMPTS + EXTRA_VARIANT_PROMPTS
}
DEFAULT_ORDER: list[str] = [name for name, _ in VARIANT_PROMPTS]

VARIANT_STRENGTH_DELTA: dict[str, float] = {
    "기본": -0.10,
    "깜짝!": 0.06,
    "사랑해요": 0.05,
    "신남!": 0.08,
    "잘게요": 0.10,
    "엉엉": 0.06,
    "축하해요": 0.06,
    "시무룩": 0.05,
}

class EmojiGenerator:
    def __init__(
        self,
        model_id: str = "stabilityai/stable-diffusion-xl-base-1.0",
        lora_model: str = "Zzul02.safetensors",
    ):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.scorer_device = os.getenv("SCORER_DEVICE", "cpu").strip().lower()
        if self.scorer_device == "cuda" and not torch.cuda.is_available():
            self.scorer_device = "cpu"

        logger.info("Generation device: %s", self.device.upper())
        logger.info("Candidate scorer device: %s", self.scorer_device.upper())

        vae = AutoencoderKL.from_pretrained(
            "madebyollin/sdxl-vae-fp16-fix",
            torch_dtype=self.torch_dtype,
        )

        ip_adapter_weight = os.getenv(
            "IP_ADAPTER_WEIGHT",
            "ip-adapter-plus_sdxl_vit-h.safetensors",
        )

        pipe_kwargs = {
            "vae": vae,
            "torch_dtype": self.torch_dtype,
            "use_safetensors": True,
        }
        if self.device == "cuda":
            pipe_kwargs["variant"] = "fp16"

        if "plus" in ip_adapter_weight.lower():
            image_encoder = CLIPVisionModelWithProjection.from_pretrained(
                "h94/IP-Adapter",
                subfolder="models/image_encoder",
                torch_dtype=self.torch_dtype,
            )
            pipe_kwargs["image_encoder"] = image_encoder

        self.txt2img = AutoPipelineForText2Image.from_pretrained(
            model_id,
            **pipe_kwargs,
        )

        self.txt2img.scheduler = DPMSolverMultistepScheduler.from_config(
            self.txt2img.scheduler.config,
            algorithm_type="sde-dpmsolver++",
            use_karras_sigmas=True,
        )

        logger.info("Loading IP-Adapter: %s", ip_adapter_weight)
        self.txt2img.load_ip_adapter(
            "h94/IP-Adapter",
            subfolder="sdxl_models",
            weight_name=ip_adapter_weight,
        )

        self.txt2img.load_lora_weights(
            "lora_models",
            weight_name=lora_model,
            adapter_name="emoji_style",
        )
        self.txt2img.set_adapters(["emoji_style"], adapter_weights=[0.65])

        self.img2img = AutoPipelineForImage2Image.from_pipe(self.txt2img)
        self.img2img.scheduler = DPMSolverMultistepScheduler.from_config(
            self.img2img.scheduler.config,
            algorithm_type="sde-dpmsolver++",
            use_karras_sigmas=True,
        )

        self.txt2img.vae.enable_slicing()
        self.txt2img.vae.enable_tiling()

        if self.device == "cuda":
            self.txt2img.enable_model_cpu_offload()
        else:
            self.txt2img.to("cpu")

        trigger = ""
        match lora_model:
            case "ZZul02.safetensors":
                trigger = "chibi"
            case "cutedoodle_XL-000012.safetensors":
                trigger = "cute doodle"

        self.base_positive = (
            f"{trigger}, "
            "high-quality 2D emoji sticker illustration, single character, "
            "2-head chibi proportion, large expressive face, clean silhouette, "
            "thick clean outlines, simple flat colors, minimal cel shading, "
            "centered composition, entire character visible, pure white background"
        )

        self.base_negative = (
            "photorealistic, realistic proportions, 3d render, western comic, "
            "highly detailed background, complex background, background objects, "
            "gradient-heavy rendering, messy lines, blurry, low quality, watermark, logo, "
            "written words, letters, malformed anatomy, bad hands, extra fingers, "
            "missing fingers, extra limbs, missing limbs, duplicate character, cropped body"
        )

        self.compel = Compel(
            tokenizer=[self.txt2img.tokenizer, self.txt2img.tokenizer_2],
            text_encoder=[self.txt2img.text_encoder, self.txt2img.text_encoder_2],
            returned_embeddings_type=ReturnedEmbeddingsType.PENULTIMATE_HIDDEN_STATES_NON_NORMALIZED,
            requires_pooled=[False, True],
        )

        self.rembg_session = new_session(
            "isnet-anime",
            providers=["CPUExecutionProvider"],
        )

        model_repo = "SmilingWolf/wd-v1-4-moat-tagger-v2"
        model_path = hf_hub_download(model_repo, "model.onnx")
        csv_path = hf_hub_download(model_repo, "selected_tags.csv")

        available_ort_providers = rt.get_available_providers()
        ort_providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in available_ort_providers
            else ["CPUExecutionProvider"]
        )
        logger.info("WD14 providers: %s", ort_providers)

        self.tagger_session = rt.InferenceSession(
            model_path,
            providers=ort_providers,
        )

        self.tags: list[str] = []
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader)
            for row in reader:
                self.tags.append(row[1])

        self.identity_tag_blacklist = {
            "simple_background",
            "white_background",
            "transparent_background",
            "solo",
            "looking_at_viewer",
            "full_body",
            "upper_body",
            "standing",
            "sitting",
            "smile",
            "open_mouth",
            "closed_mouth",
            "blush",
            "tears",
            "crying",
        }

        self.clip_processor = CLIPProcessor.from_pretrained(
            "openai/clip-vit-base-patch32"
        )
        self.clip_model = CLIPModel.from_pretrained(
            "openai/clip-vit-base-patch32"
        )
        self.clip_model.to(self.scorer_device)
        self.clip_model.eval()
        self.clip_model.requires_grad_(False)

        self._set_ip_scale(0.72)

    @staticmethod
    def _clamp(value: float, low: float, high: float) -> float:
        return max(low, min(high, value))

    def _cleanup_memory(self) -> None:
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()

    def _seeded_generator(self, seed: int) -> torch.Generator:
        target_device = self.device if self.device == "cuda" else "cpu"
        return torch.Generator(device=target_device).manual_seed(seed)

    @staticmethod
    def _dedupe_tags(text: str) -> str:
        parts = [p.strip() for p in text.split(",") if p.strip()]
        seen: set[str] = set()
        result: list[str] = []
        for part in parts:
            key = part.lower()
            if key not in seen:
                seen.add(key)
                result.append(part)
        return ", ".join(result)

    @staticmethod
    def _pad_to_square(image: Image.Image, background=(255, 255, 255, 255)) -> Image.Image:
        image = image.convert("RGBA")
        width, height = image.size
        size = max(width, height)
        canvas = Image.new("RGBA", (size, size), background)
        x = (size - width) // 2
        y = (size - height) // 2
        canvas.alpha_composite(image, (x, y))
        return canvas

    @staticmethod
    def _on_white(image: Image.Image) -> Image.Image:
        image = image.convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        background.alpha_composite(image)
        return background.convert("RGB")

    def _prepare_reference(self, image: Image.Image) -> Image.Image:
        return self._on_white(image)

    def _set_ip_scale(self, ip_scale: float) -> None:
        ip_scale = self._clamp(float(ip_scale), 0.0, 1.2)

        scale_config = {
            "down": {"block_2": [0.0, ip_scale]},
            "up": {"block_0": [0.0, ip_scale, 0.0]},
        }

        try:
            self.txt2img.set_ip_adapter_scale(scale_config)
            self.img2img.set_ip_adapter_scale(scale_config)
        except Exception:
            logger.warning(
                "Block IP-Adapter scaling is not supported by this environment; "
                "falling back to scalar scale %.3f",
                ip_scale,
            )
            self.txt2img.set_ip_adapter_scale(ip_scale)
            self.img2img.set_ip_adapter_scale(ip_scale)

    def _embed_prompt(self, prompt: str):
        prompt_embeds, pooled_prompt_embeds = self.compel(prompt)
        negative_prompt_embeds, negative_pooled_prompt_embeds = self.compel(
            self.base_negative
        )
        return (
            prompt_embeds,
            pooled_prompt_embeds,
            negative_prompt_embeds,
            negative_pooled_prompt_embeds,
        )

    def caption_image(
        self,
        image: Image.Image,
        threshold: float = 0.35,
        max_tags: int = 20,
    ) -> str:
        image = self._pad_to_square(image)
        image = self._on_white(image)

        input_meta = self.tagger_session.get_inputs()[0]
        shape = input_meta.shape
        target_h = int(shape[1]) if isinstance(shape[1], int) else 448
        target_w = int(shape[2]) if isinstance(shape[2], int) else 448

        image = image.resize((target_w, target_h), Image.Resampling.LANCZOS)
        image_array = np.asarray(image, dtype=np.float32)

        image_array = image_array[:, :, ::-1].copy()
        image_array = np.expand_dims(image_array, axis=0)

        probs = self.tagger_session.run(
            None,
            {input_meta.name: image_array},
        )[0][0]

        candidates: list[tuple[float, str]] = []
        for i, probability in enumerate(probs):
            if i < 4 or i >= len(self.tags):
                continue
            if float(probability) < threshold:
                continue

            raw_tag = self.tags[i]
            if raw_tag in self.identity_tag_blacklist:
                continue

            candidates.append((float(probability), raw_tag.replace("_", " ")))

        candidates.sort(key=lambda item: item[0], reverse=True)
        result_tags = [tag for _, tag in candidates[:max_tags]]
        return self._dedupe_tags(", ".join(result_tags))

    def build_character_profile(self, auto_caption: str, user_text: str) -> str:
        auto_caption = auto_caption.strip()
        user_text = user_text.strip()

        parts: list[str] = []
        if auto_caption:
            parts.append(f"({auto_caption}:1.05)")
        if user_text:
            parts.append(f"({user_text}:1.20)")

        return ", ".join(parts)

    def generate_base_character(
        self,
        character_profile: str,
        ref_image: Optional[Image.Image],
        ip_scale: float = 0.72,
        num_inference_steps: int = 30,
        seed: int = 42,
    ) -> Image.Image:
        current_ip_scale = ip_scale if ref_image is not None else 0.0
        self._set_ip_scale(current_ip_scale)

        prompt = (
            f"{self.base_positive}, "
            "neutral reusable reference pose, relaxed natural stance, "
            "clear front-facing character design, preserve the same hairstyle, face impression, "
            "clothing design, main colors and distinctive accessories, "
            f"{character_profile}"
        )

        (
            prompt_embeds,
            pooled_prompt_embeds,
            negative_prompt_embeds,
            negative_pooled_prompt_embeds,
        ) = self._embed_prompt(prompt)

        kwargs = {
            "prompt_embeds": prompt_embeds,
            "pooled_prompt_embeds": pooled_prompt_embeds,
            "negative_prompt_embeds": negative_prompt_embeds,
            "negative_pooled_prompt_embeds": negative_pooled_prompt_embeds,
            "num_inference_steps": int(num_inference_steps),
            "guidance_scale": 5.5,
            "width": 1024,
            "height": 1024,
            "generator": self._seeded_generator(seed),
        }

        if ref_image is not None:
            kwargs["ip_adapter_image"] = self._prepare_reference(ref_image)

        with torch.inference_mode():
            image = self.txt2img(**kwargs).images[0]

        self._cleanup_memory()
        return image
    
    def generate_variant_candidates(
        self,
        character_profile: str,
        variant_desc: str,
        ref_image: Optional[Image.Image],
        base_image: Image.Image,
        ip_scale: float = 0.72,
        num_inference_steps: int = 28,
        strength: float = 0.55,
        candidate_count: int = 3,
        seed_base: int = 1000,
    ) -> list[Image.Image]:
        current_ip_scale = ip_scale if ref_image is not None else 0.0
        self._set_ip_scale(current_ip_scale)

        prompt = (
            f"{self.base_positive}, "
            f"{variant_desc}, "
            "same exact character identity as the base design, preserve hairstyle, face impression, "
            "clothing design, main colors and distinctive accessories, "
            "allow the body pose, facial expression and gesture to change to match the requested reaction, "
            f"{character_profile}"
        )

        (
            prompt_embeds,
            pooled_prompt_embeds,
            negative_prompt_embeds,
            negative_pooled_prompt_embeds,
        ) = self._embed_prompt(prompt)

        init_image = self._pad_to_square(base_image)
        init_image = self._on_white(init_image).resize(
            (1024, 1024),
            Image.Resampling.LANCZOS,
        )

        ref_input = (
            self._prepare_reference(ref_image)
            if ref_image is not None
            else None
        )

        outputs: list[Image.Image] = []
        for i in range(candidate_count):
            kwargs = {
                "prompt_embeds": prompt_embeds,
                "pooled_prompt_embeds": pooled_prompt_embeds,
                "negative_prompt_embeds": negative_prompt_embeds,
                "negative_pooled_prompt_embeds": negative_pooled_prompt_embeds,
                "image": init_image,
                "strength": float(strength),
                "num_inference_steps": int(num_inference_steps),
                "guidance_scale": 5.2,
                "generator": self._seeded_generator(seed_base + i),
            }
            if ref_input is not None:
                kwargs["ip_adapter_image"] = ref_input

            with torch.inference_mode():
                image = self.img2img(**kwargs).images[0]
            outputs.append(image)

            self._cleanup_memory()

        return outputs

    def image_feature(self, image: Image.Image) -> torch.Tensor:
        image = self._on_white(image)
        inputs = self.clip_processor(images=image, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(self.scorer_device)

        with torch.inference_mode():
            vision_outputs = self.clip_model.vision_model(pixel_values=pixel_values)
            pooled_output = vision_outputs.pooler_output
            feature = self.clip_model.visual_projection(pooled_output)
            feature = F.normalize(feature, dim=-1)
        return feature

    def text_feature(self, text: str) -> torch.Tensor:
        inputs = self.clip_processor(
            text=[text],
            return_tensors="pt",
            padding=True,
            truncation=True,
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
            feature = F.normalize(feature, dim=-1)
        return feature

    @staticmethod
    def _cosine_from_features(a: torch.Tensor, b: torch.Tensor) -> float:
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
            base_similarity = self._cosine_from_features(candidate_feature, base_feature)
            prompt_similarity = self._cosine_from_features(candidate_feature, variant_feature)

            if ref_feature is not None:
                ref_similarity = self._cosine_from_features(candidate_feature, ref_feature)
                score = (
                    0.40 * ref_similarity
                    + 0.35 * base_similarity
                    + 0.25 * prompt_similarity
                )
            else:
                ref_similarity = 0.0
                score = 0.60 * base_similarity + 0.40 * prompt_similarity

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

        canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
        x = (canvas_w - new_w) // 2
        y = (canvas_h - new_h) // 2
        canvas.alpha_composite(transparent, (x, y))
        return canvas



generator: Optional[EmojiGenerator] = None
jobs: dict[str, dict] = {}
jobs_lock = threading.Lock()
generation_lock = threading.Lock()

JOB_DONE_TTL_SECONDS = 10 * 60
JOB_MAX_LIFETIME_SECONDS = 60 * 60
JOB_CLEANUP_INTERVAL_SECONDS = 60


def pil_to_dataurl(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True, compress_level=9)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _cleanup_stale_jobs() -> None:
    now = time.time()
    with jobs_lock:
        stale_ids: list[str] = []
        for jid, job in jobs.items():
            created_at = job.get("created_at", now)
            finished_at = job.get("finished_at")

            if job.get("status") in ("done", "error") and finished_at is not None:
                if now - finished_at > JOB_DONE_TTL_SECONDS:
                    stale_ids.append(jid)
                    continue

            if now - created_at > JOB_MAX_LIFETIME_SECONDS:
                stale_ids.append(jid)

        for jid in stale_ids:
            del jobs[jid]

        if stale_ids:
            logger.info("Cleaned %d stale jobs: %s", len(stale_ids), stale_ids)


def run_job(
    job_id: str,
    ref_img: Optional[Image.Image],
    character_base: str,
    ip_scale: float,
    num_inference_steps: int,
    targets: list[tuple[int, str]],
    candidate_count: int,
    img2img_strength: float,
) -> None:
    """Run one generation job.

    SDXL pipelines are shared globally, so only one job is allowed inside the
    generation section at a time. This prevents concurrent requests from
    changing the IP-Adapter scale underneath one another and reduces GPU OOMs.
    """
    try:
        with generation_lock:
            _run_job_inner(
                job_id=job_id,
                ref_img=ref_img,
                character_base=character_base,
                ip_scale=ip_scale,
                num_inference_steps=num_inference_steps,
                targets=targets,
                candidate_count=candidate_count,
                img2img_strength=img2img_strength,
            )
    except Exception as exc:
        logger.error("run_job(%s) unhandled error", job_id)
        logger.error(traceback.format_exc())
        with jobs_lock:
            if job_id in jobs:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = f"Unexpected generation error: {exc}"
                jobs[job_id]["finished_at"] = time.time()


def _run_job_inner(
    job_id: str,
    ref_img: Optional[Image.Image],
    character_base: str,
    ip_scale: float,
    num_inference_steps: int,
    targets: list[tuple[int, str]],
    candidate_count: int,
    img2img_strength: float,
) -> None:
    if generator is None:
        raise RuntimeError("Generator is not initialized.")
    try:
        auto_caption = generator.caption_image(ref_img) if ref_img is not None else ""
        character_profile = generator.build_character_profile(
            auto_caption,
            character_base,
        )

        if not character_profile:
            raise ValueError("A reference image or a character description is required.")

        with jobs_lock:
            jobs[job_id]["auto_caption"] = auto_caption
            jobs[job_id]["character_profile"] = character_profile

    except Exception as exc:
        logger.error("run_job(%s) reference analysis error", job_id)
        logger.error(traceback.format_exc())
        with jobs_lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = f"Reference analysis failed: {exc}"
            jobs[job_id]["finished_at"] = time.time()
        return
    base_seed = int(uuid.UUID(job_id)) % (2**31 - 1)

    try:
        base_character = generator.generate_base_character(
            character_profile=character_profile,
            ref_image=ref_img,
            ip_scale=ip_scale,
            num_inference_steps=max(24, num_inference_steps),
            seed=base_seed,
        )

        base_feature = generator.image_feature(base_character)
        ref_feature = (
            generator.image_feature(ref_img)
            if ref_img is not None
            else None
        )

    except torch.cuda.OutOfMemoryError:
        logger.error("run_job(%s) CUDA OOM while creating base character", job_id)
        logger.error(traceback.format_exc())
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        gc.collect()
        with jobs_lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = "GPU memory ran out while creating the base character."
            jobs[job_id]["finished_at"] = time.time()
        return
    except Exception as exc:
        logger.error("run_job(%s) base character generation error", job_id)
        logger.error(traceback.format_exc())
        with jobs_lock:
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = f"Base character generation failed: {exc}"
            jobs[job_id]["finished_at"] = time.time()
        return

    done = 0

    for idx, name_kr in targets:
        variant_desc = VARIANT_PROMPT_MAP.get(name_kr, name_kr)
        strength_delta = VARIANT_STRENGTH_DELTA.get(name_kr, 0.0)
        slot_strength = generator._clamp(
            img2img_strength + strength_delta,
            0.35,
            0.75,
        )

        try:
            variant_feature = generator.text_feature(variant_desc)

            candidates = generator.generate_variant_candidates(
                character_profile=character_profile,
                variant_desc=variant_desc,
                ref_image=ref_img,
                base_image=base_character,
                ip_scale=ip_scale,
                num_inference_steps=num_inference_steps,
                strength=slot_strength,
                candidate_count=candidate_count,
                seed_base=base_seed + (idx * 100),
            )

            best_img, best_score, score_details = generator.pick_best_candidate(
                candidates=candidates,
                base_feature=base_feature,
                variant_feature=variant_feature,
                ref_feature=ref_feature,
            )

            out_img = generator.to_ogq_sticker(best_img)

            done += 1
            with jobs_lock:
                jobs[job_id]["images"].append(
                    {
                        "index": idx,
                        "name": name_kr,
                        "image": pil_to_dataurl(out_img),
                        "score": round(best_score, 4),
                        "score_detail": {
                            key: round(value, 4)
                            for key, value in score_details.items()
                        },
                    }
                )
                jobs[job_id]["completed"] = done

        except torch.cuda.OutOfMemoryError:
            logger.error(
                "run_job(%s) CUDA OOM at slot %s (%s)",
                job_id,
                idx,
                name_kr,
            )
            logger.error(traceback.format_exc())
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = (
                    f"GPU memory ran out while generating slot {idx} ({name_kr})."
                )
                jobs[job_id]["finished_at"] = time.time()
            return

        except Exception as exc:
            logger.error(
                "run_job(%s) slot %s (%s) generation error",
                job_id,
                idx,
                name_kr,
            )
            logger.error(traceback.format_exc())
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = (
                    f"Slot {idx} ({name_kr}) generation failed: {exc}"
                )
                jobs[job_id]["finished_at"] = time.time()
            return

    with jobs_lock:
        jobs[job_id]["status"] = "done"
        jobs[job_id]["finished_at"] = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global generator

    model_id = os.getenv(
        "MODEL_ID",
        "stabilityai/stable-diffusion-xl-base-1.0",
    )
    lora_model = os.getenv(
        "LORA_MODEL",
        "Zzul02.safetensors",
    )

    generator = EmojiGenerator(
        model_id=model_id,
        lora_model=lora_model,
    )

    port = int(os.getenv("PORT", "8000"))

    try:
        ngrok_authtoken = os.getenv("NGROK_AUTHTOKEN", "").strip()
        ngrok_domain = os.getenv("NGROK_DOMAIN", "").strip()

        if ngrok_authtoken:
            ngrok.set_auth_token(ngrok_authtoken)

            if ngrok_domain:
                public_url = ngrok.connect(port, domain=ngrok_domain).public_url
            else:
                public_url = ngrok.connect(port).public_url

            logger.info("Public server URL: %s", public_url)
        else:
            logger.info("NGROK_AUTHTOKEN is not set. Starting local API only.")

    except Exception as exc:
        logger.error("ngrok connection failed: %s", exc)

    cleanup_stop = threading.Event()

    def _cleanup_loop() -> None:
        while not cleanup_stop.is_set():
            _cleanup_stale_jobs()
            cleanup_stop.wait(JOB_CLEANUP_INTERVAL_SECONDS)

    cleanup_thread = threading.Thread(target=_cleanup_loop, daemon=True)
    cleanup_thread.start()

    yield

    cleanup_stop.set()
    try:
        ngrok.kill()
    except Exception:
        pass


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s", request.method, request.url)
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"error": f"Internal server error: {exc}"},
    )

@app.post("/api/generate-set")
async def create_job(
    background_tasks: BackgroundTasks,
    image: Optional[UploadFile] = File(None),
    character_base: str = Form(""),
    ip_scale: float = Form(0.72),
    num_inference_steps: int = Form(28),
    indices: str = Form(""),
    variant_names: str = Form(""),
    candidate_count: int = Form(3),
    img2img_strength: float = Form(0.55),
):
    """Register a generation job and immediately return its job_id.

    - image: optional reference character image
    - character_base: optional character description; required if image is absent
    - indices: JSON list of 1-based slot numbers
    - variant_names: JSON object mapping slot number to variant name
    - candidate_count: candidates generated per slot (1-4)
    - img2img_strength: base-character edit strength (0.35-0.75 recommended)
    """
    _cleanup_stale_jobs()

    character_base = character_base.strip()

    ref_img: Optional[Image.Image] = None
    if image is not None:
        ref_bytes = await image.read()
        if ref_bytes:
            try:
                ref_img = Image.open(io.BytesIO(ref_bytes)).convert("RGBA")
            except Exception as exc:
                return JSONResponse(
                    status_code=400,
                    content={"error": f"Invalid image file: {exc}"},
                )

    if ref_img is None and not character_base:
        return JSONResponse(
            status_code=400,
            content={"error": "A reference image or character description is required."},
        )

    try:
        idx_list = json.loads(indices) if indices else []
        if not isinstance(idx_list, list):
            idx_list = []
    except (json.JSONDecodeError, TypeError):
        idx_list = []

    try:
        name_map_raw = json.loads(variant_names) if variant_names else {}
        if not isinstance(name_map_raw, dict):
            name_map_raw = {}
    except (json.JSONDecodeError, TypeError):
        name_map_raw = {}

    name_map: dict[int, str] = {}
    for key, value in name_map_raw.items():
        try:
            name_map[int(key)] = str(value)
        except (TypeError, ValueError):
            continue

    if not idx_list:
        targets = [(i, name) for i, name in enumerate(DEFAULT_ORDER, start=1)]
    else:
        targets: list[tuple[int, str]] = []
        for raw_index in idx_list:
            try:
                i = int(raw_index)
            except (TypeError, ValueError):
                continue

            if i <= 0:
                continue

            default_name = (
                DEFAULT_ORDER[i - 1]
                if 1 <= i <= len(DEFAULT_ORDER)
                else f"이모티콘 {i}"
            )
            name = name_map.get(i) or default_name
            targets.append((i, name))

    if not targets:
        return JSONResponse(
            status_code=400,
            content={"error": "No valid generation slots were provided."},
        )

    ip_scale = max(0.0, min(1.2, float(ip_scale)))
    num_inference_steps = max(12, min(50, int(num_inference_steps)))
    candidate_count = max(1, min(4, int(candidate_count)))
    img2img_strength = max(0.35, min(0.75, float(img2img_strength)))

    job_id = str(uuid.uuid4())

    with jobs_lock:
        jobs[job_id] = {
            "status": "running",
            "completed": 0,
            "total": len(targets),
            "images": [],
            "auto_caption": "",
            "character_profile": "",
            "created_at": time.time(),
            "finished_at": None,
        }

    background_tasks.add_task(
        run_job,
        job_id,
        ref_img,
        character_base,
        ip_scale,
        num_inference_steps,
        targets,
        candidate_count,
        img2img_strength,
    )

    return {"job_id": job_id}


@app.get("/api/generate-set/{job_id}")
def get_job(job_id: str, since: int = 0):
    """Return only images completed after the client's `since` count."""
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            return JSONResponse(
                status_code=404,
                content={"error": "job not found"},
            )

        all_images = job["images"]
        if 0 <= since < len(all_images):
            new_images = all_images[since:]
        else:
            new_images = []

        return {
            "status": job["status"],
            "completed": job["completed"],
            "total": job["total"],
            "images": new_images,
            "error": job.get("error"),
        }


@app.get("/api/health")
def health():
    with jobs_lock:
        job_count = len(jobs)

    return {
        "status": "ok",
        "device": generator.device if generator else "loading",
        "active_jobs": job_count,
    }


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
    )
