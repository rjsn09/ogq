FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python-is-python3 git ca-certificates libgl1 libglib2.0-0 build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/runpod_backend
COPY requirements.txt .
RUN python -c 'import sys; assert sys.version_info[:2] == (3, 10)' \
    && python -m pip install --upgrade pip \
    && python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124 \
    && python -m pip install -r requirements.txt && python -m pip check
COPY . .
RUN bash install_dreamo.sh \
    && python -c "import sys; sys.path.insert(0, 'vendor/DreamO'); import dreamo_generator; import nunchaku"
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30m --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:' + os.getenv('PORT', '8000') + '/api/health', timeout=4)"
CMD ["bash", "/opt/runpod_backend/start.sh"]
