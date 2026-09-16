import os
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq


ENV_PATH = Path(__file__).resolve().parent / ".env"

load_dotenv(ENV_PATH)


api_key = os.getenv("GROQ_API_KEY", "").strip()

print("ENV_PATH:", ENV_PATH)
print("ENV EXISTS:", ENV_PATH.exists())
print("GROQ_API_KEY:", "SET" if api_key else "MISSING")


if not api_key:
    raise RuntimeError(
        "GROQ_API_KEY를 .env에서 읽지 못했습니다."
    )


client = Groq(
    api_key=api_key
)


models = client.models.list()


for model in models.data:
    print(model.id)