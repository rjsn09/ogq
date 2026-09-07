import logging
import os
import gc

from rembg import new_session, remove
from transformers import CLIPModel, CLIPProcessor, CLIPVisionModelWithProjection
from huggingface_hub import hf_hub_download
from compel import Compel, ReturnedEmbeddingsType
from diffusers import (
    AutoPipelineForImage2Image,
    AutoPipelineForText2Image,
    AutoencoderKL,
    DPMSolverMultistepScheduler,
)
from PIL import Image
from typing import Optional
import numpy as np
import onnxruntime as rt
import torch
import torch.nn.functional as F
import csv


logger = logging.getLogger("ogq")

class EmojiGenerator:
    def __init__(self, model_id: str = "stabilityai/stable-diffusion-xl-base-1.0", lora_model: str = "Zzul02.safetensors"):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.torch_dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.scorer_device = os.getenv("SCORER_DEVICE", "cpu").strip().lower()
        if self.scorer_device == "cuda" and not torch.cuda.is_available(): self.scorer_device = "cpu"

        logger.info("Generation device: %s", self.device.upper())
        logger.info("Candidate scorer device: %s", self.scorer_device.upper())

        vae = AutoencoderKL.from_pretrained("madebyollin/sdxl-vae-fp16-fix", torch_dtype=self.torch_dtype)

        ip_adapter_weight = os.getenv("IP_ADAPTER_WEIGHT", "ip-adapter-plus_sdxl_vit-h.safetensors")

        pipe_kwargs = {
            "vae": vae,
            "torch_dtype": self.torch_dtype,
            "use_safetensors": True,
        }

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

        lora_path = os.path.join("lora_models", lora_model)
        if not os.path.isfile(lora_path):
            logger.error(
                "LoRA file not found at '%s' (cwd=%s)"
                "fall back to the base model",
                lora_path,
                os.getcwd(),
            )

        self.txt2img.load_lora_weights(
            "lora_models",
            weight_name=lora_model,
            adapter_name="emoji_style",
        )
        lora_weight = float(os.getenv("LORA_WEIGHT", "0.65"))
        self.txt2img.set_adapters(["emoji_style"], adapter_weights=[lora_weight])

        active = self.txt2img.get_active_adapters()
        logger.info("LoRA adapter weight requested: %.3f | active adapters on pipeline: %s", lora_weight, active,)
        if "emoji_style" not in active:
            logger.error("'emoji_style' lora did not register as an active adapter")

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
        normalized_lora = lora_model.strip().lower()
        if normalized_lora == "zzul02.safetensors":
            trigger = "chibi"
        elif normalized_lora == "cutedoodle_xl-000012.safetensors":
            trigger = "cute doodle"

        self.base_positive = (
            f"{trigger}, "
            "single character, centered composition, "
            "entire character visible, pure white background"
        )

        self.base_negative = (
            "photorealistic, realistic proportions, 3d render, western comic, "
            "highly detailed background, complex background, background objects, "
            "gradient-heavy rendering, messy lines, blurry, low quality, watermark, logo, "
            "written words, letters, malformed anatomy, bad hands, extra fingers, "
            "missing fingers, extra limbs, missing limbs, duplicate character, cropped body, "
            "multiple characters, character sheet, reference sheet, grid layout, collage, "
            "multiple views, turnaround, contact sheet, tiled images, thumbnail grid, "
            "multiple faces, face grid, icon set, sticker sheet, sticker pack preview"
            "multiple characters, duplicate character, cropped people, side characters, background scene, blue background, extra person, panel composition"
        )

        self.compel = Compel(
            tokenizer=[self.txt2img.tokenizer, self.txt2img.tokenizer_2],
            text_encoder=[self.txt2img.text_encoder, self.txt2img.text_encoder_2],
            returned_embeddings_type=ReturnedEmbeddingsType.PENULTIMATE_HIDDEN_STATES_NON_NORMALIZED,
            requires_pooled=[False, True],
            device=self.device,
            truncate_long_prompts=False,
        )
        self.empty_conditioning = self.compel("")[0]

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

        self.tagger_session = rt.InferenceSession(model_path, providers=ort_providers)

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

        self._set_ip_scale(0.5)

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
        # composition_scale = ip_scale * 0.35
        # style_scale = ip_scale * 0.6

        # scale_config = {
        #     "down": {"block_2": [0.0, composition_scale]},
        #     "up": {"block_0": [0.0, style_scale, 0.0]},
        # }

        try:
            # self.txt2img.set_ip_adapter_scale(scale_config)
            # self.img2img.set_ip_adapter_scale(scale_config)
            self.txt2img.set_ip_adapter_scale(ip_scale)
            self.img2img.set_ip_adapter_scale(ip_scale)
        except Exception:
            logger.warning("falling back to scalar scale %.3f", ip_scale)
            self.txt2img.set_ip_adapter_scale(ip_scale)
            self.img2img.set_ip_adapter_scale(ip_scale)

    def _embed_prompt(self, prompt: str):
        prompt_embeds, pooled_prompt_embeds = self.compel(prompt)
        negative_prompt_embeds, negative_pooled_prompt_embeds = self.compel(
            self.base_negative
        )
        prompt_embeds, negative_prompt_embeds = self.compel.pad_conditioning_tensors_to_same_length(
            [prompt_embeds, negative_prompt_embeds],
            precomputed_padding=self.empty_conditioning,
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

        probs = self.tagger_session.run(None, {input_meta.name: image_array})[0][0]

        candidates: list[tuple[float, str]] = []
        for i, probability in enumerate(probs):
            if i < 4 or i >= len(self.tags): continue
            if float(probability) < threshold: continue

            raw_tag = self.tags[i]
            if raw_tag in self.identity_tag_blacklist: continue
            candidates.append((float(probability), raw_tag.replace("_", " ")))

        candidates.sort(key=lambda item: item[0], reverse=True)
        result_tags = [tag for _, tag in candidates[:max_tags]]
        return self._dedupe_tags(", ".join(result_tags))

    def build_character_profile(self, auto_caption: str, user_text: str) -> str:
        auto_caption = auto_caption.strip()
        user_text = user_text.strip()

        parts: list[str] = []
        if auto_caption: parts.append(f"({auto_caption}:1.05)")
        if user_text: parts.append(f"({user_text}:1.20)")

        return ", ".join(parts)

    def generate_base_character(
        self,
        character_profile: str,
        ref_image: Optional[Image.Image],
        ip_scale: float = 0.5,
        num_inference_steps: int = 30,
        seed: int = 42,
    ) -> Image.Image:
        current_ip_scale = ip_scale if ref_image is not None else 0.0
        self._set_ip_scale(current_ip_scale)

        prompt = (
            f"{self.base_positive}, "
            f"{character_profile}, "
            "neutral reusable reference pose, relaxed natural stance, "
            "clear front-facing character design, preserve the same hairstyle, face impression, "
            "clothing design, main colors and distinctive accessories"
        )

        prompt_embeds, pooled_prompt_embeds, negative_prompt_embeds, negative_pooled_prompt_embeds = self._embed_prompt(prompt)

        kwargs = {
            "prompt_embeds": prompt_embeds,
            "pooled_prompt_embeds": pooled_prompt_embeds,
            "negative_prompt_embeds": negative_prompt_embeds,
            "negative_pooled_prompt_embeds": negative_pooled_prompt_embeds,
            "num_inference_steps": int(num_inference_steps),
            "guidance_scale": 7.0,
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
        ip_scale: float = 0.5,
        num_inference_steps: int = 28,
        strength: float = 0.55,
        candidate_count: int = 3,
        seed_base: int = 1000,
    ) -> list[Image.Image]:
        current_ip_scale = ip_scale if ref_image is not None else 0.0
        self._set_ip_scale(current_ip_scale)

        prompt = (
            f"{self.base_positive}, "
            f"{character_profile}, "
            f"{variant_desc}, "
            "same exact character identity as the base design, preserve hairstyle, face impression, "
            "clothing design, main colors and distinctive accessories, "
            "allow the body pose, facial expression and gesture to change to match the requested reaction"
        )

        prompt_embeds, pooled_prompt_embeds, negative_prompt_embeds, negative_pooled_prompt_embeds = self._embed_prompt(prompt)

        init_image = self._pad_to_square(base_image)
        init_image = self._on_white(init_image).resize((1024, 1024), Image.Resampling.LANCZOS)
        ref_input = self._prepare_reference(ref_image) if ref_image is not None else None

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
                "guidance_scale": 7.0,
                "generator": self._seeded_generator(seed_base + i),
            }
            if ref_input is not None: kwargs["ip_adapter_image"] = ref_input

            with torch.inference_mode(): image = self.img2img(**kwargs).images[0]
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