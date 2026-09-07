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
  status: "running" | "done" | "error";
  completed: number;
  total: number;
  images: GeneratedImage[];
  error?: string;
}

const POLL_INTERVAL_MS = 2000;

const SERVER_URL = "http://localhost:8000";

function apiUrl(path: string): string {
  return `${SERVER_URL}${path}`;
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error ?? `요청에 실패했습니다. (${res.status})`
    );
  }

  return data;
}

export async function createCanonical(
  imageDataUrl: string,
  characterBase?: string
): Promise<string> {
  const refBlob = await (await fetch(imageDataUrl)).blob();

  const formData = new FormData();
  formData.append("image", refBlob, "ref.png");

  if (characterBase?.trim()) {
    formData.append("character_base", characterBase.trim());
  }
  formData.append("ip_scale", "0.60");
  formData.append("num_inference_steps", "30");

  const res = await fetch(apiUrl("/api/canonical"), {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
    },
    body: formData,
  });

  const data = await readJson(res);
  return data.canonical_id as string;
}

export async function getCanonical(
  canonicalId: string
): Promise<CanonicalStatus> {
  const res = await fetch(
    apiUrl(`/api/canonical/${encodeURIComponent(canonicalId)}`),
    {
      cache: "no-store",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    }
  );

  return (await readJson(res)) as CanonicalStatus;
}

export async function approveCanonical(
  canonicalId: string
): Promise<void> {
  const res = await fetch(
    apiUrl(
      `/api/canonical/${encodeURIComponent(
        canonicalId
      )}/approve`
    ),
    {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
    }
  );

  await readJson(res);
}

export async function regenerateCanonical(
  canonicalId: string,
  editRequest = ""
): Promise<void> {
  const formData = new FormData();
  formData.append("edit_request", editRequest);

  const res = await fetch(
    apiUrl(
      `/api/canonical/${encodeURIComponent(
        canonicalId
      )}/regenerate`
    ),
    {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
      body: formData,
    }
  );

  await readJson(res);
}

export async function generateOGQImagesFromCanonical(
  canonicalId: string,
  onProgress?: (count: number, images: string[]) => void,
  indices?: number[],
  variantAssignments?: Record<number, string>,
  previousImages?: (string | null | undefined)[]
): Promise<string[]> {
  const targetIndices =
    indices && indices.length > 0
      ? indices
      : VARIANT_CATALOG.slice(0, 24).map((_, i) => i + 1);

  const targetSet = new Set(targetIndices);

  const names: Record<number, string> = {};

  for (const idx of targetIndices) {
    names[idx] =
      variantAssignments?.[idx] ??
      DEFAULT_VARIANTS[idx - 1]?.name ??
      `이모티콘 ${idx}`;
  }

  const formData = new FormData();
  formData.append("indices", JSON.stringify(targetIndices));
  formData.append("variant_names", JSON.stringify(names));

  // Stage-2 tuning values.
  formData.append("candidate_count", "2");
  formData.append("img2img_strength", "0.68");
  formData.append("controlnet_scale", "0.90");
  formData.append("num_inference_steps", "30");

  const startRes = await fetch(
    apiUrl(
      `/api/canonical/${encodeURIComponent(
        canonicalId
      )}/generate-set`
    ),
    {
      method: "POST",
      headers: {
        "ngrok-skip-browser-warning": "true",
      },
      body: formData,
    }
  );

  const startData = await readJson(startRes);
  const jobId = startData.job_id as string;

  const results: string[] = Array.from(
    { length: 24 },
    (_, i) => previousImages?.[i] ?? ""
  );

  let receivedCount = 0;

  while (true) {
    await sleep(POLL_INTERVAL_MS);

    const statusRes = await fetch(
      apiUrl(
        `/api/canonical/generate-set/${encodeURIComponent(
          jobId
        )}/status?since=${receivedCount}`
      ),
      {
        cache: "no-store",
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      }
    );

    const job = (await readJson(statusRes)) as JobStatus;

    for (const item of job.images) {
      if (targetSet.has(item.index)) {
        results[item.index - 1] = item.image;
      }
    }

    receivedCount += job.images.length;

    onProgress?.(job.completed, [...results]);

    if (job.status === "done") {
      break;
    }

    if (job.status === "error") {
      throw new Error(
        job.error ?? "생성 중 오류가 발생했습니다."
      );
    }
  }

  return results;
}

export function regenerateOGQImages(
  canonicalId: string,
  slotIndices: number[],
  variantAssignments: Record<number, string>,
  previousImages: (string | null | undefined)[],
  onProgress?: (count: number, images: string[]) => void
): Promise<string[]> {
  return generateOGQImagesFromCanonical(
    canonicalId,
    onProgress,
    slotIndices,
    variantAssignments,
    previousImages
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) =>
    setTimeout(resolve, ms)
  );
}
