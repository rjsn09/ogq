#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x .venv/bin/python ]]; then
    PYTHON_BIN="$PWD/.venv/bin/python"
fi
# Server.py fixes workers=1; do not use reload or a multi-worker process manager.
exec "$PYTHON_BIN" Server.py
