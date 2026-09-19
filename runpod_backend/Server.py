from __future__ import annotations

import io
import logging
import os
import threading
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")
from runtime import configure_runtime, single_server

configure_runtime()
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

from canonical_api import install_canonical_api
from sse_stream import generation_queue, job_snapshot, stream_response

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ogq")
generator: Any = None
generation_lock = threading.Lock()

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


@asynccontextmanager
async def lifespan(app: FastAPI):
    global generator
    with single_server():
        from EmojiGenerator import EmojiGenerator
        generator = EmojiGenerator(model_id=os.getenv("MODEL_ID", ""), lora_model=os.getenv("LORA_MODEL", ""))
        stop = threading.Event()

        def cleanup_loop():
            while not stop.wait(60):
                canonical_api_service.cleanup()

        cleaner = threading.Thread(target=cleanup_loop, daemon=True)
        cleaner.start()
        try:
            yield
        finally:
            stop.set()
            generation_queue.shutdown()
            cleaner.join()
            generator = None


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
canonical_api_service = install_canonical_api(app=app, get_generator=lambda: generator, generation_lock=generation_lock, variant_prompt_map=VARIANT_PROMPT_MAP, default_order=DEFAULT_ORDER)
def print_routes(router, depth=0):
    indent = "  " * depth

    for route in getattr(router, "routes", []):
        print(
            f"{indent}TYPE: {type(route).__name__}",
            f"PATH: {getattr(route, 'path', None)}",
            f"METHODS: {getattr(route, 'methods', None)}",
            f"DEPENDENCIES: {getattr(route, 'dependencies', None)}",
            flush=True
        )

        if hasattr(route, "routes"):
            print_routes(route, depth + 1)


print_routes(app)

def run_direct_set(job_id, canonical_id, ref_image, character_base, targets, candidate_count, steps):
    service = canonical_api_service
    try:
        service._run_canonical_job(canonical_id=canonical_id, ref_image=ref_image, original_user_text=character_base, edit_request="", ip_scale=0.6, steps=steps, generation_number=0)
        with service.canonicals_lock:
            item = service.canonicals[canonical_id]
            if item["status"] != "ready":
                raise RuntimeError(item.get("error") or "Canonical generation failed.")
            item.update(approved=True, status="approved")
        service._run_sticker_job(job_id=job_id, canonical_id=canonical_id, targets=targets, candidate_count=candidate_count, img2img_strength=0.55, controlnet_scale=0.9, steps=steps)
    except Exception as exc:
        logger.exception("Direct sticker set failed")
        with service.jobs_lock:
            service.jobs[job_id].update(status="error", error=str(exc), finished_at=time.time())


@app.post("/api/generate-set")
async def create_job(request: Request, image: Optional[UploadFile] = File(None), character_base: str = Form(""), ip_scale: float = Form(0.5), num_inference_steps: int = Form(0, ge=0, le=50), indices: str = Form(""), variant_names: str = Form(""), candidate_count: int = Form(1, ge=1, le=4), img2img_strength: float = Form(0.55), transport: str = Form("sse", pattern="^sse$")):
    service = canonical_api_service
    service.cleanup()
    service._generator()
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
    targets = service._parse_targets(indices, variant_names)
    if not targets or len(targets) > 24 or len({i for i, _ in targets}) != len(targets):
        raise HTTPException(400, "Choose 1 to 24 unique generation slots.")
    job_id, canonical_id = str(uuid.uuid4()), str(uuid.uuid4())
    now = time.time()
    with service.canonicals_lock:
        service.canonicals[canonical_id] = {"status": "generating", "approved": False, "original_image": ref_image, "original_user_text": character_base.strip(), "ip_scale": ip_scale, "steps": num_inference_steps, "generation_number": 0, "canonical_image": None, "canonical_image_pil": None, "error": None, "created_at": now, "updated_at": now}
    with service.jobs_lock:
        service.jobs[job_id] = {"status": "running", "completed": 0, "total": len(targets), "images": [], "error": None, "created_at": now, "finished_at": None, "canonical_id": canonical_id}
    try:
        generation_queue.submit(run_direct_set, job_id, canonical_id, ref_image, character_base.strip(), targets, candidate_count, num_inference_steps)
    except Exception:
        with service.jobs_lock:
            service.jobs.pop(job_id, None)
        with service.canonicals_lock:
            service.canonicals.pop(canonical_id, None)
        raise
    events_url = f"/api/generate-set/{job_id}/events"
    return stream_response(request, lambda: job_snapshot(service.jobs, service.jobs_lock, job_id), {"job_id": job_id, "events_url": events_url})


@app.get("/api/generate-set/{job_id}/events")
async def job_events(job_id: str, request: Request, after: int = 0):
    service = canonical_api_service
    return stream_response(request, lambda: job_snapshot(service.jobs, service.jobs_lock, job_id), {"job_id": job_id}, after)


@app.get("/api/generate-set/{job_id}")
def get_job(job_id: str, since: int = 0):
    service = canonical_api_service
    state = job_snapshot(service.jobs, service.jobs_lock, job_id)
    if state is None:
        raise HTTPException(404, "Job not found.")
    return {**state, "completed": len(state["images"]), "images": state["images"][max(0, since):]}


@app.get("/api/health")
def health():
    service = canonical_api_service
    with service.jobs_lock:
        active = sum(j["status"] not in {"done", "error"} for j in service.jobs.values())
    return {"status": "ok" if generator else "loading", "device": generator.device if generator else "loading", "active_jobs": active, "queue": generation_queue.snapshot()}

@app.get("/health-test")
async def health_test():
    print("HEALTH TEST HIT", flush=True)
    return {"ok": True}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")), workers=1, reload=False)
