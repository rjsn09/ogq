"""RunPod filesystem defaults and a Pod-wide single-server guard."""
import os
from contextlib import contextmanager
from pathlib import Path


def configure_runtime():
    root = Path(__file__).resolve().parent
    from dotenv import load_dotenv
    load_dotenv(root / ".env")
    data = Path(os.getenv("RUNPOD_DATA_DIR", "/workspace/ogq-data")).resolve()
    data.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("HF_HOME", str(data / "huggingface"))
    os.environ.setdefault("TORCH_HOME", str(data / "torch"))
    os.environ.setdefault("U2NET_HOME", str(data / "rembg"))
    os.environ.setdefault("DREAMO_ROOT", str(root / "vendor" / "DreamO"))
    os.environ.setdefault("RUNPOD_LOCK_FILE", str(data / "server.lock"))
    # DreamO downloads some weights into ./models, independently of HF_HOME.
    os.chdir(data)


@contextmanager
def single_server():
    import fcntl  # RunPod runs Linux. Locks are released by the OS on process exit.
    path = Path(os.environ["RUNPOD_LOCK_FILE"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a+") as handle:
        try:
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError(
                "Another backend is already running on this Pod. "
                "Use one process, one Uvicorn worker, and no reload."
            ) from exc
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)
