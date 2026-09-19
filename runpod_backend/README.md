# RunPod 백엔드

`backend`의 DreamO 생성 코드와 API를 독립적으로 복사한 **RunPod GPU Pod용 HTTP 서버**입니다. 이 폴더만 업로드해 실행할 수 있습니다. RunPod Serverless handler 방식은 사용하지 않습니다.

기준 캐릭터 생성·승인·재생성, 전체/일부 스티커 생성, 후보 평가, 배경 제거, SSE 진행 상황/재접속과 기존 상태 조회 API를 유지합니다. `styles/reference.png`도 기존 파일을 포함합니다. 비밀키, 가상환경, 모델 파일은 복사하지 않았습니다. 앞으로 `backend`의 생성 로직을 수정하면 이 복사본에도 반영해야 합니다.

## 1. Pod에서 직접 설치

Linux x86_64, Python **3.10**, CUDA 12.4를 지원하는 NVIDIA 드라이버가 필요합니다. 설치 스크립트는 PyTorch 2.6.0/CUDA 12.4와 Nunchaku 0.3.1을 사용합니다. 다른 Python 버전이나 GPU 세대에서는 해당 바이너리 호환성을 별도로 확인해야 합니다. 모델 다운로드와 로딩을 위한 충분한 디스크·RAM을 확보하세요.

Pod에서 다음을 실행합니다. Ubuntu 22.04 기준 시스템 패키지 설치가 포함되어 있습니다.

```bash
apt-get update
apt-get install -y python3.10 python3.10-venv python3.10-dev git build-essential libgl1 libglib2.0-0
cd /workspace/runpod_backend
bash setup.sh
cp .env.example .env
# 편집기로 .env의 GROQ_API_KEY, HF_TOKEN, 모델/프롬프트 설정을 입력합니다.
bash start.sh
```

- `GROQ_API_KEY`: 필수. `GROQ_VISION_MODEL`은 기존 서버에서 실제 사용하는 이미지 입력 지원 모델 ID를 지정합니다.
- `HF_TOKEN`: FLUX.1-dev 다운로드 권한이 있는 Hugging Face 토큰을 지정합니다. 해당 모델 접근 승인이 필요할 수 있습니다.
- 기존과 같은 동작을 위해 기존 `.env`의 모델, 프롬프트, 스타일 관련 설정을 옮깁니다. LLM 프롬프트 계획을 사용했다면 `PROMPT_PLANNER_MODE=llm`, `PROMPT_LLM_MODEL`, `LLM_BASE_URL` 및 해당 API 키도 옮깁니다. 예시의 `template`은 외부 프롬프트 LLM을 호출하지 않습니다.
- `DREAMO_ROOT`는 생략하면 이 폴더의 `vendor/DreamO`를 사용합니다. 기존 Windows 절대 경로는 옮기지 않습니다.
- `DREAMO_MEMORY_MODE=low_vram`이 기본입니다. 모델을 GPU에 상주시킬 메모리가 충분하면 `gpu`로 설정할 수 있습니다.
- ngrok은 필요하지 않습니다. RunPod용 서버는 `0.0.0.0:8000`으로 실행됩니다.

첫 시작에는 모델 다운로드와 로딩 때문에 시간이 걸리며, 완료된 뒤 API 요청을 받을 수 있습니다. 설치 시 `pip check`, CUDA 및 주요 패키지 import를 확인합니다. 실제 이미지 생성까지 성공했는지는 Pod에서 확인해야 합니다.

## 2. Docker 이미지로 배포

저장소 루트에서:

```bash
docker build -t YOUR_REGISTRY/ogq-runpod:latest ./runpod_backend
docker push YOUR_REGISTRY/ogq-runpod:latest
```

RunPod Pod의 Container Image에 이 이미지를 지정하고, 환경 변수를 Pod 설정에 입력합니다. 시작 명령은 이미지의 기본 CMD를 사용합니다. HTTP 포트 `8000`을 노출하고 영구 볼륨을 `/workspace`에 마운트합니다. 로컬 Docker GPU 실행 예시는 다음과 같습니다.

```bash
docker run --gpus all --env-file runpod_backend/.env -p 8000:8000 \
  -v ogq-data:/workspace YOUR_REGISTRY/ogq-runpod:latest
```

`.env`는 이미지에 포함되지 않습니다. 커스텀 스타일 이미지는 빌드 전에 `styles/reference.png`를 교체하거나, 별도 마운트 후 `OGQ_STYLE_REFERENCE`에 컨테이너 내부 절대 경로를 지정하세요.

## 3. 프론트엔드 연결

RunPod의 Connect 화면에서 노출한 HTTP 8000 주소를 확인합니다. 일반적인 형태는 `https://POD_ID-8000.proxy.runpod.net`입니다. 기존 프론트엔드 배포 환경의 `BACKEND_URL`을 이 주소로 변경하고 재배포합니다. 주소 끝에 `/api`를 추가하지 않습니다.

```bash
curl https://POD_ID-8000.proxy.runpod.net/api/health
curl -N -X POST https://POD_ID-8000.proxy.runpod.net/api/canonical \
  -F 'character_base=cute white cat'
```

`/api/health`는 기존 응답에 `queue` 정보를 추가합니다.

```json
{"status":"ok","device":"cuda","active_jobs":1,"queue":{"workers":1,"capacity":8,"running":1,"waiting":2}}
```

`active_jobs`는 기존과 같이 스티커 작업 수이고, `queue`에는 기준 캐릭터 작업도 포함됩니다. 대기 중인 요청도 기존 API의 `running`/`generating` 상태를 유지하며 실제 실행 수는 `queue.running`으로 확인합니다.

## 순차 실행 보장 범위

- 기준 캐릭터 생성/재생성, 승인 캐릭터 기반 스티커 세트, 직접 스티커 세트 생성이 **하나의 FIFO 큐**를 공유합니다.
- 작업자 수는 **1로 고정**되어 있습니다. 한 세트의 모든 생성 과정이 끝나야 다음 작업을 시작합니다. HTTP/SSE 연결 여러 개를 유지해도 추론 작업은 병렬 실행되지 않습니다.
- `MAX_PENDING_JOBS=8`은 실행 중 1개를 포함한 전체 수용량입니다. 나머지 최대 7개가 대기하며 초과 요청은 HTTP 429를 받습니다. 이 값을 늘려도 동시 실행 수는 늘지 않습니다.
- 작업 하나가 실패해도 다음 작업을 처리합니다. SSE 연결이 끊겨도 작업은 계속 진행되며 기존 events 주소로 재연결할 수 있습니다.
- Uvicorn은 `workers=1`, `reload=False`로 실행합니다. 같은 Pod의 서버들은 동일한 `RUNPOD_LOCK_FILE`을 사용해야 합니다. 기본 경로의 OS 파일 잠금으로 중복 프로세스가 모델을 로드하기 전에 실패하도록 했습니다.
- **Pod는 하나만 실행하세요.** 서로 다른 Pod/컨테이너의 독립 볼륨에는 전역 큐나 분산 잠금이 없습니다. 여러 Pod를 만들면 Pod마다 작업 하나가 실행될 수 있습니다.
- 큐와 결과는 메모리 저장입니다. 재시작하면 대기 작업, 생성 결과, 재접속 기록이 사라집니다. `/workspace/ogq-data`에는 모델/캐시만 보존합니다. 종료 시에는 큐를 마칠 때까지 기다리지만 Pod 강제 종료 시에는 보장되지 않습니다.

## 검증

GPU 없이 큐 순서, 동시 실행 제한, 포화/실패/취소 처리, 기존 API 경로, SSE 생성/재접속을 검사할 수 있습니다. API 테스트에서는 추론만 모의 처리합니다. Linux에서는 프로세스 잠금도 검사합니다.

```bash
python -m pip install fastapi httpx python-multipart python-dotenv Pillow uvicorn
python -m unittest discover -s tests -v
```

참고: [RunPod HTTP 포트 노출](https://docs.runpod.io/pods/configuration/expose-ports), [DreamO 공식 설치 안내](https://github.com/bytedance/DreamO), [Nunchaku 릴리스](https://github.com/nunchaku-tech/nunchaku/releases/tag/v0.3.1).
