#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PYTHON_BIN="${PYTHON_BIN:-python3.10}"
"$PYTHON_BIN" -c 'import sys, platform; assert sys.version_info[:2] == (3, 10) and platform.system() == "Linux" and platform.machine() == "x86_64", "Requires Linux x86_64 and Python 3.10"'
"$PYTHON_BIN" -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install torch==2.6.0 torchvision==0.21.0 --index-url https://download.pytorch.org/whl/cu124
.venv/bin/python -m pip install -r requirements.txt
bash install_dreamo.sh
.venv/bin/python -m pip check
.venv/bin/python -c 'import sys; sys.path.insert(0, "vendor/DreamO"); import dreamo_generator'
.venv/bin/python -c 'import torch, nunchaku, diffusers, peft; assert torch.cuda.is_available(), "CUDA GPU is not available"; print(torch.cuda.get_device_name(0))'
echo 'Setup complete. Configure .env, then run: bash start.sh'
