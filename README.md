# 이모티콘 생성기 (OGQ Emoticon Generator)

이미지/태그/설명을 선택적으로 입력하면 네이버 OGQ마켓 규격에 맞는 24종 스티커 세트를 자동으로 생성해주는 웹입니다.
product URL: https://ogq.vercel.app/

---

## 주요 기능

- 캐릭터 참조 이미지 업로드·태그·설명 입력만으로 이모티콘 세트 생성
- 감정/인사/리액션 등 24종 기본 템플릿 및 12종의 추가 템플릿 기반 자동 생성, 슬롯별로 원하는 종류로 변경 가능
- 전체 재생성뿐 아니라 마음에 들지 않는 슬롯만 선택해서 부분 재생성 가능
- IP-Adapter 기반 캐릭터 일관성 유지 (참조 이미지의 디자인/외형 정체성 유지)
- 생성 결과를 네이버 OGQ마켓 규격에 맞도록 제공
- 개별 PNG 다운로드 및 24종 전체 ZIP 일괄 다운로드 지원
- 생성 진행 상황 실시간 표시 (작업 큐 폴링 방식)

---

## 기술 스택

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui, Radix UI
- JSZip

**Backend**
- FastAPI + uvicorn
- Stable Diffusion XL 기반 이미지 생성 파이프라인 (diffusers, transformers, compel)
- rembg(isnet-anime) 기반 배경 제거
- pyngrok을 통한 로컬 서버 개발/공유

---

## 로컬에서 실행 방법

```bash
# 프론트엔드
npm install
npm run dev      # 개발 서버 실행
```

백엔드는 별도 서버로 구동되며, 프론트엔드는 `/api/generate-set` 엔드포인트를 통해 생성 작업을 요청하고 결과를 폴링합니다.

---

## 사용된 오픈소스 모델

본 프로젝트에는 아래의 오픈소스 모델을 활용하였습니다.

- **stabilityai/stable-diffusion-xl-base-1.0**: Text-to-Image 이모티콘 형식의 이미지 생성 (https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- **madebyollin/sdxl-vae-fp16-fix**: fp16 연산 시 NaN 오류 방지 및 Latent-to-Image 복원 (https://huggingface.co/madebyollin/sdxl-vae-fp16-fix)
- **h94/IP-Adapter**: 참조 이미지의 캐릭터 디자인 및 외형 정체성 유지 (https://huggingface.co/h94/IP-Adapter)
- **LoRA**: 이모티콘 및 2D 캐릭터 화풍 적용
  - 현재 사용한 LoRA 모델:
    - cutedoodle_XL-000012 (https://civitai.com/models/132578/lah-cute-social-or-sdxl-and-sd15?modelVersionId=190859)
    - Zzul02 (https://civitai.com/models/134160/xl-zzul)
- **Salesforce/blip-image-captioning-base**: 입력된 참조 이미지의 설명 생성 (https://huggingface.co/Salesforce/blip-image-captioning-base)
- **isnet-anime**: 배경 제거(누끼) (https://huggingface.co/jellybox/isnet-anime)

---

## 오픈소스 패키지 (Open Source Packages)

### 외부 라이브러리

- `torch` (BSD):  PyTorch 딥러닝 연산 및 GPU 가속
- `diffusers` (Apache 2.0):  SDXL 및 IP-Adapter 파이프라인 제어, DPMSolver 스케줄링
- `transformers` (Apache 2.0):  BLIP 캡셔닝 모델 및 SDXL 텍스트 인코더 실행
- `compel` (MIT):  SDXL 듀얼 텍스트 인코더 프롬프트 가중치/임베딩 정밀 제어
- `rembg` (MIT):  ISNet 기반 캐릭터 배경 제거
- `FastAPI` (MIT):  비동기 이모티콘 생성 API 백엔드 서버 구축
- `uvicorn` (BSD):  ASGI 웹 서버 실행
- `pyngrok` (MIT):  로컬 서버 개발용 ngrok 연동
- `Pillow` (HPND):  이미지 처리 및 전/후처리
- `python-dotenv` (BSD):  환경 변수 관리

### 파이썬 표준 라이브러리

파이썬 버전: python 3.13.12

`os`, `gc`, `io`, `json`, `time`, `uuid`, `base64`, `logging`, `traceback`, `threading`, `contextlib`


백엔드 서버를 상시로 켜놓을 수 없어 가끔 서버에 접속할 수 없을 수 있습니다.
---

기존의 BLIP이 원본 이미지의 특징을 제대로 잡아내지 못해 캐릭터의 특징이 이모티콘에 제대로 담기지 않는 이슈 발생(눈 색깔 변경/머리 색깔 변경 등)
-> 기존의 BLIP모델 대신 WD14 Tagger를 사용하여 캡션을 생성
---

set_ip_adapter_scale에 값을 실수 형태로 넣으니 참조이미지의 구도, 체형 등 이모티콘에 참조하지 말아야할 특징까지 참조됨
->  _set_ip_scale함수를 만들어{"up": {"block_0": scale}}의 딕셔너리 형식으로 ip_scale를 조정해 얼굴과 옷 등 필요한 특징만 가져옴
 
---

기존에는 참조 이미지를 IP-Adapter에 직접 입력하여 캐릭터의 특징을 유지하였다. 하지만 IP-Adapter의 영향이 너무 강한 경우 원본 이미지의 얼굴이나 의상뿐만 아니라 자세, 체형, 구도까지 그대로 따라가는 문제 발생

-> IP-Adapter의 적용 강도를 조절하고, 참조 이미지에서 유지해야 할 특징은 WD14 Tagger와 Character Profile을 통해 텍스트 프롬프트로도 함께 전달하도록 변경

-> 캐릭터의 특징과 새로운 포즈 사이의 균형을 맞출 수 있지만, IP-Adapter의 강도를 너무 낮게 설정하면 캐릭터의 특징이 제대로 유지되지 않고, 너무 높게 설정하면 기존과 같이 포즈나 구도를 과하게 따라갈 수 있어 적절한 값을 설정해야 함

---

기존에는 참조 이미지를 모델 입력 크기에 맞추기 위해 정해진 크기로 바로 resize하였다. 이 과정에서 가로세로 비율이 다른 이미지의 경우 캐릭터의 얼굴이나 체형이 눌리거나 늘어나는 문제 발생

-> 원본 이미지의 비율을 유지한 상태로 정사각형 영역에 padding을 추가한 후 모델 입력 크기로 resize하도록 전처리 방식을 변경

---

기존에는 각 이모티콘마다 Text-to-Image 방식으로 완전히 새로운 이미지를 생성하였다. 이로 인해 캐릭터의 기본적인 형태를 일정하게 유지하기 어려운 문제 발생

-> 최초 한 번만 Text-to-Image 방식으로 기준 캐릭터를 생성하고, 이후 감정과 행동별 이모티콘은 해당 기준 이미지를 이용한 Image-to-Image 방식으로 생성하도록 변경하였다.

-> 얼굴, 머리, 의상 등의 기본적인 디자인을 유지하기 쉬워졌지만, 기준 이미지의 형태에 영향을 받기 때문에 Image-to-Image의 strength 값이 너무 낮으면 새로운 포즈나 큰 동작을 생성하기 어려운 단점 발생

---

기존에는 하나의 프롬프트에 대해 이미지 한 장만 생성하고 결과를 바로 사용하였다. 따라서 손이나 얼굴이 깨지거나 캐릭터 특징이 크게 달라진 이미지가 생성되어도 그대로 결과에 포함되는 문제 발생

-> 같은 프롬프트에 대해 여러 개의 후보 이미지를 생성한 후 CLIP을 이용해 참조 이미지 및 기준 이미지와의 유사도를 계산하고, 가장 높은 점수를 받은 이미지를 선택하도록 변경

-> 품질이 낮거나 캐릭터 특징이 크게 달라진 결과가 선택될 가능성을 줄일 수 있지만, CLIP은 이미지의 전체적인 의미와 특징을 비교하기 때문에 손가락 오류나 작은 그림 깨짐과 같은 세부적인 품질 문제까지 정확하게 평가하기는 어렵고, 한 장의 이모티콘을 만드는데 여러 개의 이미지를 생성하기때문에 속도가 느려짐

---

기존에는 LoRA의 적용 강도를 높게 설정하여 이모티콘 및 2D 캐릭터 스타일을 강하게 적용하였다. 이 경우 LoRA가 학습한 스타일이 참조 캐릭터의 특징보다 강하게 나타나 서로 다른 캐릭터가 비슷한 형태로 생성되는 문제 발생

-> LoRA의 가중치를 기존보다 낮추고 IP-Adapter와 Character Profile을 함께 사용하여 캐릭터 특징과 이모티콘 스타일을 동시에 유지하도록 조정

---

기존에는 생성된 이미지를 그대로 rembg에 입력하여 배경을 제거했는데, 이 과정에서 캐릭터의 검은 외곽선이나 머리카락 끝부분처럼 배경과 경계가 복잡한 영역이 함께 제거되거나 깨지는 문제 발생

-> 배경 제거 후 캐릭터가 존재하는 영역을 다시 계산하고, 비율을 유지한 상태로 크기를 조절하여 740×640 크기의 투명 캔버스 중앙에 배치하도록 후처리 과정을 추가

