import {
  VARIANT_CATALOG,
  DEFAULT_VARIANTS,
} from "../utils/imageGenerator";


export const VARIANT_NAMES: string[] = DEFAULT_VARIANTS.map(
  (v: (typeof DEFAULT_VARIANTS)[number]) => v.name
);


export type CanonicalStatusValue =
  | "generating"
  | "ready"
  | "approved"
  | "error";


export interface CanonicalStatus {
  canonical_id: string;
  status: CanonicalStatusValue;
  approved: boolean;
  image?: string | null;
  canonical_prompt?: string | null;
  error?: string | null;
}


interface GeneratedImage {
  index: number;
  name: string;
  image: string;
}


interface JobStatus {
  status?: "running" | "done" | "error";
  completed?: number;
  total?: number;
  images?: GeneratedImage[];
  image?: GeneratedImage;
  error?: string;
}


/* ---------------------------------------------------------
   공통
--------------------------------------------------------- */

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ?? `요청에 실패했습니다. (${res.status})`
    );
  }

  return data;
}


/* ---------------------------------------------------------
   Canonical 생성
--------------------------------------------------------- */

export async function createCanonical(
  imageDataUrl: string,
  characterBase?: string
): Promise<string> {
  const imageRes = await fetch(imageDataUrl);

  if (!imageRes.ok) {
    throw new Error("참조 이미지를 읽지 못했습니다.");
  }

  const refBlob = await imageRes.blob();

  const formData = new FormData();

  formData.append("image", refBlob, "ref.png");

  if (characterBase?.trim()) {
    formData.append(
      "character_base",
      characterBase.trim()
    );
  }

  formData.append("ip_scale", "0.60");
  formData.append("num_inference_steps", "30");

  formData.append("transport", "job");

  const res = await fetch(
    "/api/canonical",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await readJson(res);

  if (!data.canonical_id) {
    throw new Error(
      "canonical_id를 받지 못했습니다."
    );
  }

  return data.canonical_id as string;
}


/* ---------------------------------------------------------
   Canonical 상태 조회
--------------------------------------------------------- */

export async function getCanonical(
  canonicalId: string
): Promise<CanonicalStatus> {
  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}`,
    {
      method: "GET",
      cache: "no-store",
    }
  );

  return (await readJson(res)) as CanonicalStatus;
}


/* ---------------------------------------------------------
   Canonical 승인
--------------------------------------------------------- */

export async function approveCanonical(
  canonicalId: string
): Promise<void> {
  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}/approve`,
    {
      method: "POST",
    }
  );

  await readJson(res);
}


/* ---------------------------------------------------------
   Canonical 재생성
--------------------------------------------------------- */

export async function regenerateCanonical(
  canonicalId: string,
  editRequest = ""
): Promise<void> {
  const formData = new FormData();

  formData.append(
    "edit_request",
    editRequest
  );

  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}/regenerate`,
    {
      method: "POST",
      body: formData,
    }
  );

  await readJson(res);
}


/* ---------------------------------------------------------
   최종 이모티콘 생성
--------------------------------------------------------- */

export async function generateOGQImagesFromCanonical(
  canonicalId: string,
  onProgress?: (
    count: number,
    images: string[]
  ) => void,
  indices?: number[],
  variantAssignments?: Record<number, string>,
  previousImages?: (
    string |
    null |
    undefined
  )[]
): Promise<string[]> {
  const targetIndices =
    indices && indices.length > 0
      ? indices
      : VARIANT_CATALOG
          .slice(0, 24)
          .map((_, i) => i + 1);

  const targetSet = new Set(
    targetIndices
  );

  const names: Record<number, string> = {};

  for (const idx of targetIndices) {
    names[idx] =
      variantAssignments?.[idx] ??
      DEFAULT_VARIANTS[idx - 1]?.name ??
      `이모티콘 ${idx}`;
  }


  /* -------------------------------------------------------
     1. 생성 Job 시작
  ------------------------------------------------------- */

  const formData = new FormData();

  formData.append(
    "indices",
    JSON.stringify(targetIndices)
  );

  formData.append(
    "variant_names",
    JSON.stringify(names)
  );

  formData.append(
    "candidate_count",
    "2"
  );

  formData.append(
    "img2img_strength",
    "0.68"
  );

  formData.append(
    "controlnet_scale",
    "0.90"
  );

  formData.append(
    "num_inference_steps",
    "30"
  );


  const startRes = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}/generate-set`,
    {
      method: "POST",
      body: formData,
    }
  );


  const startData =
    await readJson(startRes);


  const jobId =
    startData.job_id as string;


  if (!jobId) {
    throw new Error(
      "생성 서버에서 job_id를 반환하지 않았습니다."
    );
  }


  /* -------------------------------------------------------
     2. 결과 배열 초기화
  ------------------------------------------------------- */

  const results: string[] =
    Array.from(
      { length: 24 },
      (_, i) =>
        previousImages?.[i] ?? ""
    );


  /* -------------------------------------------------------
     3. SSE 연결
  ------------------------------------------------------- */

  return await new Promise<string[]>(
    (resolve, reject) => {
      let finished = false;

      let reconnectTimeout:
        ReturnType<typeof setTimeout> |
        null = null;


      const eventSource =
        new EventSource(
          `/api/generate-set/${encodeURIComponent(jobId)}/events`
        );


      const close = () => {
        if (reconnectTimeout) {
          clearTimeout(
            reconnectTimeout
          );

          reconnectTimeout = null;
        }

        eventSource.close();
      };


      const finish = () => {
        if (finished) {
          return;
        }

        finished = true;

        close();

        resolve([
          ...results,
        ]);
      };


      const fail = (
        message: string
      ) => {
        if (finished) {
          return;
        }

        finished = true;

        close();

        reject(
          new Error(message)
        );
      };


      const applyData = (
        data: JobStatus | GeneratedImage,
        forcedStatus?: "done"
      ) => {
        /*
         * 서버가
         *
         * {
         *   images: [...]
         * }
         *
         * 형태로 보내는 경우
         */

        if (
          "images" in data &&
          Array.isArray(data.images)
        ) {
          for (
            const item of data.images
          ) {
            if (
              targetSet.has(
                item.index
              )
            ) {
              results[
                item.index - 1
              ] = item.image;
            }
          }
        }


        /*
         * 서버가
         *
         * {
         *   image: {...}
         * }
         *
         * 형태로 보내는 경우
         */

        if (
          "image" in data &&
          typeof data.image === "object" &&
          data.image !== null
        ) {
          const item =
            data.image as GeneratedImage;

          if (
            targetSet.has(
              item.index
            )
          ) {
            results[
              item.index - 1
            ] = item.image;
          }
        }


        /*
         * 서버가 단일 이미지 객체 자체를 보내는 경우
         */

        if (
          "index" in data &&
          typeof data.index === "number" &&
          "image" in data &&
          typeof data.image === "string"
        ) {
          const item =
            data as GeneratedImage;

          if (
            targetSet.has(
              item.index
            )
          ) {
            results[
              item.index - 1
            ] = item.image;
          }
        }


        const completed =
          "completed" in data &&
          typeof data.completed === "number"
            ? data.completed
            : results.reduce(
                (
                  count,
                  image,
                  index
                ) => {
                  if (
                    image &&
                    targetSet.has(
                      index + 1
                    )
                  ) {
                    return count + 1;
                  }

                  return count;
                },
                0
              );


        onProgress?.(
          completed,
          [...results]
        );


        const status =
          forcedStatus ??
          (
            "status" in data
              ? data.status
              : undefined
          );


        if (
          status === "done"
        ) {
          finish();

          return;
        }


        if (
          status === "error"
        ) {
          fail(
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "이모티콘 생성 중 오류가 발생했습니다."
          );
        }
      };


      const handleEvent = (
        event: MessageEvent,
        forcedStatus?: "done"
      ) => {
        try {
          if (
            !event.data
          ) {
            return;
          }

          const data =
            JSON.parse(
              event.data
            );

          applyData(
            data,
            forcedStatus
          );
        } catch (error) {
          console.error(
            "[SSE PARSE ERROR]",
            error,
            event.data
          );
        }
      };


      /*
       * 일반 message 이벤트
       */

      eventSource.onmessage =
        event => {
          handleEvent(event);
        };


      /*
       * 백엔드가 named SSE event를 사용하는 경우도 처리
       */

      eventSource.addEventListener(
        "progress",
        event => {
          handleEvent(
            event as MessageEvent
          );
        }
      );


      eventSource.addEventListener(
        "image",
        event => {
          handleEvent(
            event as MessageEvent
          );
        }
      );


      eventSource.addEventListener(
        "status",
        event => {
          handleEvent(
            event as MessageEvent
          );
        }
      );


      eventSource.addEventListener(
        "done",
        event => {
          handleEvent(
            event as MessageEvent,
            "done"
          );
        }
      );


      eventSource.addEventListener(
        "complete",
        event => {
          handleEvent(
            event as MessageEvent,
            "done"
          );
        }
      );


      /*
       * 연결 성공
       */

      eventSource.onopen = () => {
        if (
          reconnectTimeout
        ) {
          clearTimeout(
            reconnectTimeout
          );

          reconnectTimeout = null;
        }
      };


      /*
       * SSE 연결 오류
       *
       * EventSource는 자동 재연결을 지원하기 때문에
       * 바로 실패시키지 않고 잠시 기다린다.
       */

      eventSource.onerror =
        event => {
          if (
            finished
          ) {
            return;
          }


          const messageEvent =
            event as MessageEvent;


          /*
           * backend가 event:error 형태로
           * 데이터를 보낸 경우
           */

          if (
            typeof messageEvent.data ===
              "string" &&
            messageEvent.data.trim()
          ) {
            try {
              const data =
                JSON.parse(
                  messageEvent.data
                );

              fail(
                data.error ??
                "이모티콘 생성 중 오류가 발생했습니다."
              );

              return;
            } catch {
              // transport error로 처리
            }
          }


          /*
           * EventSource가 자동 재연결하도록
           * 30초간 기다린다.
           */

          if (
            !reconnectTimeout
          ) {
            reconnectTimeout =
              setTimeout(
                () => {
                  if (
                    finished
                  ) {
                    return;
                  }

                  if (
                    eventSource.readyState !==
                    EventSource.OPEN
                  ) {
                    fail(
                      "생성 서버와의 SSE 연결이 복구되지 않았습니다."
                    );
                  }
                },
                30000
              );
          }
        };
    }
  );
}


/* ---------------------------------------------------------
   일부 이모티콘 재생성
--------------------------------------------------------- */

export function regenerateOGQImages(
  canonicalId: string,
  slotIndices: number[],
  variantAssignments: Record<number, string>,
  previousImages: (
    string |
    null |
    undefined
  )[],
  onProgress?: (
    count: number,
    images: string[]
  ) => void
): Promise<string[]> {
  return generateOGQImagesFromCanonical(
    canonicalId,
    onProgress,
    slotIndices,
    variantAssignments,
    previousImages
  );
}