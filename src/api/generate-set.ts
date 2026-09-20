import { VARIANT_CATALOG, DEFAULT_VARIANTS } from '../app/utils/imageGenerator';
import { streamOGQ } from './sse';
import type { StreamData } from './sse';

export const VARIANT_NAMES: string[] = DEFAULT_VARIANTS.map((v: (typeof DEFAULT_VARIANTS)[number]) => v.name);

export interface GenerateOptions {
  signal?: AbortSignal;
  baseUrl?: string;
  canonicalId?: string;
  userPrompts?: Record<number, string>;
  candidateCount?: number;
  numInferenceSteps?: number;
  img2imgStrength?: number;
  controlnetScale?: number;
  maxReconnects?: number;
  onStart?: (data: StreamData) => void;
}

// Existing callers may keep the original six arguments.
export async function generateOGQImages(imageDataUrl: string, onProgress?: (count: number, images: string[]) => void, characterBase?: string, indices?: number[], variantAssignments?: Record<number, string>, previousImages?: (string | null | undefined)[], options: GenerateOptions = {}): Promise<string[]> {
  const targetIndices = indices?.length ? indices : VARIANT_CATALOG.slice(0, 24).map((_, i) => i + 1);
  if (!targetIndices.length || targetIndices.length > 24 || targetIndices.some(i => !Number.isInteger(i) || i < 1 || i > 24) || new Set(targetIndices).size !== targetIndices.length) {
    throw new Error('생성 슬롯은 1~24 범위의 중복 없는 번호여야 합니다.');
  }
  const candidateCount = options.candidateCount ?? 1;
  const steps = options.numInferenceSteps ?? 0;
  if (!Number.isInteger(candidateCount) || candidateCount < 1 || candidateCount > 4) throw new Error('후보 수는 1~4여야 합니다.');
  if (!Number.isInteger(steps) || steps < 0 || steps > 50) throw new Error('스텝 수는 0~50이어야 합니다.');
  const targetSet = new Set(targetIndices);
  const received = new Set<number>();
  const results = Array.from({ length: 24 }, (_, i) => previousImages?.[i] ?? '');
  const names: Record<number, string> = {};
  for (const index of targetIndices) names[index] = variantAssignments?.[index] ?? DEFAULT_VARIANTS[index - 1]?.name ?? `이모티콘 ${index}`;

  const formData = new FormData();
  if (!options.canonicalId) {
    if (imageDataUrl) {
      const reference = await fetch(imageDataUrl, { signal: options.signal });
      if (!reference.ok) throw new Error('참조 이미지를 읽을 수 없습니다.');
      formData.append('image', await reference.blob(), 'ref.png');
    }
    if (characterBase?.trim()) formData.append('character_base', characterBase.trim());
    if (!imageDataUrl && !characterBase?.trim()) throw new Error('참조 이미지 또는 캐릭터 설명이 필요합니다.');
  }
  formData.append('indices', JSON.stringify(targetIndices));
  formData.append('variant_names', JSON.stringify(names));
  formData.append('variant_prompts', JSON.stringify(Object.fromEntries(
    targetIndices.map(index => [index, options.userPrompts?.[index]?.trim() ?? '']),
  )));
  formData.append('candidate_count', String(candidateCount));
  formData.append('num_inference_steps', String(steps));
  formData.append('img2img_strength', String(options.img2imgStrength ?? 0.68));
  formData.append('controlnet_scale', String(options.controlnetScale ?? 0.90));
  formData.append('transport', 'sse');

  const path = options.canonicalId ? `/api/canonical/${encodeURIComponent(options.canonicalId)}/generate-set` : '/api/generate-set';
  await streamOGQ(path, {
    form: formData, baseUrl: options.baseUrl, signal: options.signal,
    maxReconnects: options.maxReconnects, onStart: options.onStart,
    onImage: data => {
      if (typeof data.index !== 'number' || !targetSet.has(data.index) || typeof data.image !== 'string' || !data.image.startsWith('data:image/')) throw new Error('잘못된 이미지 결과를 받았습니다.');
      results[data.index - 1] = data.image;
      received.add(data.index);
      onProgress?.(received.size, [...results]);
    },
    onDone: data => {
      if (received.size !== targetIndices.length || data.completed !== targetIndices.length) throw new Error('요청한 이미지 일부가 누락되었습니다.');
    },
  });
  if (received.size !== targetIndices.length) throw new Error('요청한 이미지 일부가 누락되었습니다.');
  return results;
}

export function regenerateOGQImages(imageDataUrl: string, slotIndices: number[], variantAssignments: Record<number, string>, previousImages: (string | null | undefined)[], onProgress?: (count: number, images: string[]) => void, characterBase?: string, options: GenerateOptions = {}): Promise<string[]> {
  if (!slotIndices.length) throw new Error('재생성할 슬롯을 선택해 주세요.');
  return generateOGQImages(imageDataUrl, onProgress, characterBase, slotIndices, variantAssignments, previousImages, options);
}
