import os

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"

import base64
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

os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
os.environ["OMP_NUM_THREADS"] = "1"

os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import torch
import uvicorn
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pyngrok import ngrok
from EmojiGenerator import EmojiGenerator
from canonical_api import install_canonical_api

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
            raise ValueError("character_profile is False.")

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
            jobs[job_id]["error"] = "OOM while creating base character"
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
        slot_strength = generator._clamp(img2img_strength + strength_delta, 0.35, 0.75,)
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
                            key: round(value, 4) for key, value in score_details.items()
                        },
                    }
                )
                jobs[job_id]["completed"] = done

        except torch.cuda.OutOfMemoryError:
            logger.error("run_job(%s) CUDA OOM at slot %s (%s)", job_id, idx, name_kr,)
            logger.error(traceback.format_exc())
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            gc.collect()
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = f"GPU memory ran out while generating slot {idx} ({name_kr})."
                jobs[job_id]["finished_at"] = time.time()
            return

        except Exception as exc:
            logger.error("run_job(%s) slot %s (%s) generation error", job_id, idx, name_kr,)
            logger.error(traceback.format_exc())
            with jobs_lock:
                jobs[job_id]["status"] = "error"
                jobs[job_id]["error"] = f"Slot {idx} ({name_kr}) generation failed: {exc}"
                jobs[job_id]["finished_at"] = time.time()
            return

    with jobs_lock:
        jobs[job_id]["status"] = "done"
        jobs[job_id]["finished_at"] = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global generator

    model_id = os.getenv( "MODEL_ID", "stabilityai/stable-diffusion-xl-base-1.0",)
    lora_model = os.getenv("LORA_MODEL", "Zzul02.safetensors",)
    generator = EmojiGenerator(model_id=model_id, lora_model=lora_model,)

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
            logger.info("NGROK_AUTHTOKEN is not set.")

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

canonical_api_service = install_canonical_api(
    app=app,
    get_generator=lambda: generator,
    generation_lock=generation_lock,
    variant_prompt_map=VARIANT_PROMPT_MAP,
    default_order=DEFAULT_ORDER,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s", request.method, request.url)
    logger.error(traceback.format_exc())
    return JSONResponse(status_code=500, content={"error": f"Internal server error: {exc}"},)

@app.post("/api/generate-set")
async def create_job(
    background_tasks: BackgroundTasks,
    image: Optional[UploadFile] = File(None),
    character_base: str = Form(""),
    ip_scale: float = Form(0.5),
    num_inference_steps: int = Form(28),
    indices: str = Form(""),
    variant_names: str = Form(""),
    candidate_count: int = Form(3),
    img2img_strength: float = Form(0.55),
):
    _cleanup_stale_jobs()

    character_base = character_base.strip()

    ref_img: Optional[Image.Image] = None
    if image is not None:
        ref_bytes = await image.read()
        if ref_bytes:
            try:
                ref_img = Image.open(io.BytesIO(ref_bytes)).convert("RGBA")
            except Exception as exc:
                return JSONResponse(status_code=400, content={"error": f"Invalid image file: {exc}"},)

    if ref_img is None and not character_base:
        return JSONResponse(status_code=400, content={"error": "A reference image or character description is required."},)

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
            try: i = int(raw_index)
            except (TypeError, ValueError): continue

            if i <= 0: continue

            default_name = DEFAULT_ORDER[i - 1] if 1 <= i <= len(DEFAULT_ORDER) else f"이모티콘 {i}"
            name = name_map.get(i) or default_name
            targets.append((i, name))

    if not targets:
        return JSONResponse(status_code=400, content={"error": "No valid generation slots were provided."},)

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
    with jobs_lock:
        job = jobs.get(job_id)
        if job is None:
            return JSONResponse(status_code=404, content={"error": "job not found"},)

        all_images = job["images"]
        if 0 <= since < len(all_images): new_images = all_images[since:]
        else: new_images = []

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
