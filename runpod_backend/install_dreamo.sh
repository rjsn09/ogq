#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
# Same revision as the existing backend/vendor/DreamO checkout.
revision=461e35ba6b068f42ca53b43f289b3d91b7f911cd
if [[ ! -d vendor/DreamO ]]; then
    mkdir -p vendor
    git clone https://github.com/bytedance/DreamO.git vendor/DreamO
    git -C vendor/DreamO checkout "$revision"
elif [[ "$(git -C vendor/DreamO rev-parse HEAD)" != "$revision" ]]; then
    echo "Existing vendor/DreamO differs from required revision $revision; use a fresh installation directory." >&2
    exit 1
fi
