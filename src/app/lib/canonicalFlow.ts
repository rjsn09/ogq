export type CanonicalStatusValue =
  | "generating"
  | "ready"
  | "approved"
  | "error";

export type CanonicalStatus = {
  canonical_id: string;
  status: CanonicalStatusValue;
  approved: boolean;
  image?: string | null;
  canonical_prompt?: string | null;
  error?: string | null;
};

export type StickerJobImage = {
  index: number;
  name: string;
  image: string;
  score?: number;
  score_detail?: Record<string, number>;
  final_prompt?: string;
  pose_keypoints?: Record<string, [number, number]>;
};

export type StickerJobStatus = {
  status: "running" | "done" | "error";
  completed: number;
  total: number;
  images: StickerJobImage[];
  error?: string | null;
};

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export async function createCanonical(params: {
  image?: File | null;
  characterBase?: string;
  ipScale?: number;
  steps?: number;
}): Promise<string> {
  const form = new FormData();

  if (params.image) form.append("image", params.image);
  form.append("character_base", params.characterBase ?? "");
  form.append("ip_scale", String(params.ipScale ?? 0.60));
  form.append("num_inference_steps", String(params.steps ?? 30));

  const res = await fetch("/api/canonical", {
    method: "POST",
    body: form,
  });

  const data = await readJson(res);
  return data.canonical_id;
}

export async function getCanonical(
  canonicalId: string,
): Promise<CanonicalStatus> {
  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}`,
  );
  return readJson(res);
}

export async function approveCanonical(
  canonicalId: string,
): Promise<void> {
  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}/approve`,
    { method: "POST" },
  );
  await readJson(res);
}

export async function regenerateCanonical(
  canonicalId: string,
  editRequest = "",
): Promise<void> {
  const form = new FormData();
  form.append("edit_request", editRequest);

  const res = await fetch(
    `/api/canonical/${encodeURIComponent(canonicalId)}/regenerate`,
    {
      method: "POST",
      body: form,
    },
  );
  await readJson(res);
}

export async function generateStickerSet(params: {
  canonicalId: string;
  indices: number[];
  variantNames: Record<number, string>;
  candidateCount?: number;
  img2imgStrength?: number;
  controlnetScale?: number;
  steps?: number;
}): Promise<string> {
  const form = new FormData();

  form.append("indices", JSON.stringify(params.indices));
  form.append("variant_names", JSON.stringify(params.variantNames));
  form.append(
    "candidate_count",
    String(params.candidateCount ?? 2),
  );
  form.append(
    "img2img_strength",
    String(params.img2imgStrength ?? 0.68),
  );
  form.append(
    "controlnet_scale",
    String(params.controlnetScale ?? 0.90),
  );
  form.append(
    "num_inference_steps",
    String(params.steps ?? 30),
  );

  const res = await fetch(
    `/api/canonical/${encodeURIComponent(
      params.canonicalId,
    )}/generate-set`,
    {
      method: "POST",
      body: form,
    },
  );

  const data = await readJson(res);
  return data.job_id;
}

export async function getStickerJob(
  jobId: string,
  since = 0,
): Promise<StickerJobStatus> {
  const res = await fetch(
    `/api/canonical/generate-set/${encodeURIComponent(
      jobId,
    )}/status?since=${since}`,
  );
  return readJson(res);
}
