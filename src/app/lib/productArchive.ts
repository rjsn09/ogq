import type { Prompts, Variant } from '../utils/imageGenerator';

export type ProductDraft = {
  title: string;
  tags: string[];
  description: string;
  category: string;
  uploadedImage: string | null;
  canonicalImage: string | null;
  images: string[];
  slotVariants: Variant[];
  slotPrompts: Prompts[];
};

export type SavedProduct = ProductDraft & { version: 1 };
export type ProductSummary = {
  id: string;
  title: string;
  imageCount: number;
  coverImage: string | null;
  storagePath: string;
  updatedAt: number;
};

const imagePattern = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif|bmp);base64,[A-Za-z0-9+/=\r\n]+$/;
const categories = new Set(['감정', '인사', '리액션', '동작']);
export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;

/** Never restore URLs or arbitrary objects from an untrusted archive. */
export function parseProductArchive(value: unknown): SavedProduct {
  if (!value || typeof value !== 'object') throw new Error('저장한 상품 형식이 올바르지 않습니다.');
  const data = value as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    const result = data[key];
    if (typeof result !== 'string' || result.length > limit) throw new Error('저장한 상품 정보가 올바르지 않습니다.');
    return result;
  };
  const title = text('title', 200).trim();
  if (data.version !== 1 || !title) throw new Error('저장한 상품 버전이나 상품명이 올바르지 않습니다.');
  if (!Array.isArray(data.images) || data.images.length !== 24 || data.images.some(image => typeof image !== 'string' || (image && !imagePattern.test(image)))) {
    throw new Error('저장한 상품의 이미지 구성이 올바르지 않습니다.');
  }
  if (!Array.isArray(data.tags) || data.tags.length > 30 || data.tags.some(tag => typeof tag !== 'string' || tag.length > 200)) throw new Error('저장한 태그가 올바르지 않습니다.');
  const optionalImage = (key: string) => {
    const image = data[key];
    if (image === null) return null;
    if (typeof image !== 'string' || !imagePattern.test(image)) throw new Error('저장한 기준 이미지가 올바르지 않습니다.');
    return image;
  };
  if (!Array.isArray(data.slotVariants) || data.slotVariants.length !== 24 || data.slotVariants.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string' || !categories.has(item.category))) {
    throw new Error('저장한 슬롯 정보가 올바르지 않습니다.');
  }
  if (!Array.isArray(data.slotPrompts) || data.slotPrompts.length !== 24 || data.slotPrompts.some(item => !item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.prompt !== 'string' || item.prompt.length > 10000)) {
    throw new Error('저장한 프롬프트가 올바르지 않습니다.');
  }
  return {
    version: 1, title, tags: [...data.tags] as string[], description: text('description', 10000), category: text('category', 200),
    uploadedImage: optionalImage('uploadedImage'), canonicalImage: optionalImage('canonicalImage'),
    images: [...data.images] as string[],
    slotVariants: data.slotVariants.map(({ id, name, category }) => ({ id, name, category })),
    slotPrompts: data.slotPrompts.map(({ id, name, prompt }) => ({ id, name, prompt })),
  };
}

export function encodeProductArchive(draft: ProductDraft): Blob {
  const archive = parseProductArchive({ ...draft, version: 1 });
  const blob = new Blob([JSON.stringify(archive)], { type: 'application/json' });
  if (blob.size > MAX_ARCHIVE_BYTES) throw new Error('상품의 이미지 용량이 너무 큽니다. 기준 이미지를 줄여 주세요.');
  return blob;
}

export function productStoragePath(uid: string, id: string, revision: string) {
  if ([uid, id, revision].some(part => !part || /[/.]/.test(part))) throw new Error('상품 저장 경로가 올바르지 않습니다.');
  return `users/${uid}/products/${id}/${revision}.json`;
}

export function assertProductPath(uid: string, summary: ProductSummary) {
  const prefix = `users/${uid}/products/${summary.id}/`;
  if (!summary.storagePath.startsWith(prefix) || !/^[a-zA-Z0-9_-]+\.json$/.test(summary.storagePath.slice(prefix.length))) {
    throw new Error('이 계정의 상품 저장 경로가 아닙니다.');
  }
}
