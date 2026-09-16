import { apiUrl, responseError, streamOGQ, type StreamOptions } from '../../api/sse';

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

type CanonicalOptions = Pick<StreamOptions, 'signal' | 'baseUrl'>;

async function canonicalStream(path: string, options: StreamOptions): Promise<CanonicalStatus> {
  let image: string | undefined;
  let prompt: string | undefined;
  const result = await streamOGQ(path, {
    ...options,
    onImage: data => {
      if (typeof data.image !== 'string' || !data.image.startsWith('data:image/')) throw new Error('잘못된 캐릭터 이미지입니다.');
      image = data.image;
      prompt = typeof data.canonical_prompt === 'string' ? data.canonical_prompt : undefined;
    },
  });
  if (!image || typeof result.canonical_id !== 'string') throw new Error('캐릭터 결과가 누락되었습니다.');
  return { canonical_id: result.canonical_id, status: 'ready', approved: false, image, canonical_prompt: prompt };
}

export async function createCanonical(params: {
  image?: File | Blob | null; characterBase?: string; ipScale?: number; steps?: number;
}, options: CanonicalOptions = {}): Promise<CanonicalStatus> {
  const form = new FormData();
  if (params.image) form.append('image', params.image, 'ref.png');
  form.append('character_base', params.characterBase ?? '');
  form.append('ip_scale', String(params.ipScale ?? 0.60));
  form.append('num_inference_steps', String(params.steps ?? 30));
  form.append('transport', 'sse');
  return canonicalStream('/api/canonical', { ...options, form });
}

export function getCanonical(canonicalId: string, options: CanonicalOptions = {}): Promise<CanonicalStatus> {
  return canonicalStream(`/api/canonical/${encodeURIComponent(canonicalId)}/events`, options);
}

export async function approveCanonical(canonicalId: string): Promise<void> {
  const response = await fetch(apiUrl(`/api/canonical/${encodeURIComponent(canonicalId)}/approve`), {
    method: 'POST', headers: { 'ngrok-skip-browser-warning': 'true' },
  });
  if (!response.ok) throw new Error(await responseError(response));
}

export function regenerateCanonical(canonicalId: string, editRequest = '', options: CanonicalOptions = {}): Promise<CanonicalStatus> {
  const form = new FormData();
  form.append('edit_request', editRequest);
  form.append('transport', 'sse');
  return canonicalStream(`/api/canonical/${encodeURIComponent(canonicalId)}/regenerate`, { ...options, form });
}

export async function generateStickerSet(params: {
  canonicalId: string; indices: number[]; variantNames: Record<number, string>;
  candidateCount?: number; img2imgStrength?: number; controlnetScale?: number; steps?: number;
}, options: StreamOptions = {}): Promise<string> {
  const form = new FormData();
  form.append('indices', JSON.stringify(params.indices));
  form.append('variant_names', JSON.stringify(params.variantNames));
  form.append('candidate_count', String(params.candidateCount ?? 2));
  form.append('img2img_strength', String(params.img2imgStrength ?? 0.68));
  form.append('controlnet_scale', String(params.controlnetScale ?? 0.90));
  form.append('num_inference_steps', String(params.steps ?? 30));
  form.append('transport', 'sse');
  const result = await streamOGQ(`/api/canonical/${encodeURIComponent(params.canonicalId)}/generate-set`, { ...options, form });
  if (typeof result.job_id !== 'string') throw new Error('작업 ID가 누락되었습니다.');
  return result.job_id;
}

export async function getStickerJob(jobId: string, since = 0, options: StreamOptions = {}): Promise<StickerJobStatus> {
  const images: StickerJobImage[] = [];
  const result = await streamOGQ(`/api/canonical/generate-set/${encodeURIComponent(jobId)}/events`, {
    ...options, after: since,
    onImage: async data => { images.push(data as StickerJobImage); await options.onImage?.(data); },
  });
  return { status: 'done', completed: Number(result.completed), total: Number(result.total), images };
}
