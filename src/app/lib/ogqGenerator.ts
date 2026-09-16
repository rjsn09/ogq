import { createCanonical as createCanonicalFromFile } from './canonicalFlow';
import { generateOGQImages } from '../../api/generate-set';
import type { GenerateOptions } from '../../api/generate-set';
export { VARIANT_NAMES, generateOGQImages, regenerateOGQImages } from '../../api/generate-set';
export { approveCanonical, getCanonical, regenerateCanonical } from './canonicalFlow';
export type { CanonicalStatus, CanonicalStatusValue } from './canonicalFlow';

export async function createCanonical(imageDataUrl: string, characterBase?: string, options: GenerateOptions = {}) {
  const response = await fetch(imageDataUrl, { signal: options.signal });
  if (!response.ok) throw new Error('참조 이미지를 읽지 못했습니다.');
  return createCanonicalFromFile({ image: await response.blob(), characterBase }, options);
}

export function generateOGQImagesFromCanonical(
  canonicalId: string,
  onProgress?: (count: number, images: string[]) => void,
  indices?: number[],
  variantAssignments?: Record<number, string>,
  previousImages?: (string | null | undefined)[],
  options: GenerateOptions = {},
): Promise<string[]> {
  return generateOGQImages('', onProgress, undefined, indices, variantAssignments, previousImages, {
    candidateCount: 2, numInferenceSteps: 30, ...options, canonicalId,
  });
}
