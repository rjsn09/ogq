import { assertProductPath, MAX_ARCHIVE_BYTES, parseProductArchive, type ProductDraft, type ProductSummary, type SavedProduct } from './productArchive.ts';

export type ProductFiles = {
  manifest: SavedProduct & { fileVersion: 1 };
  files: { path: string; blob: Blob }[];
};

export async function commitProductFiles<T>(storage: {
  upload: (path: string, blob: Blob) => Promise<void>;
  remove: (paths: string[]) => Promise<void>;
}, files: ProductFiles['files'], publish: () => Promise<T>, onProgress: (percent: number) => void): Promise<T> {
  const total = files.reduce((sum, file) => sum + file.blob.size, 0);
  let uploaded = 0;
  try {
    for (const file of files) {
      await storage.upload(file.path, file.blob);
      uploaded += file.blob.size;
      onProgress(Math.round(uploaded / total * 95));
    }
    const result = await publish();
    onProgress(100);
    return result;
  } catch (error) {
    await storage.remove(files.map(file => file.path)).catch(() => {});
    throw error;
  }
}

const mimeTypes: Record<string, string> = {
  png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', avif: 'image/avif', bmp: 'image/bmp',
};

export function revisionPaths(uid: string, id: string, archivePath: string): string[] {
  assertProductPath(uid, { id, storagePath: archivePath } as ProductSummary);
  const prefix = archivePath.slice(0, -5) + '/';
  const names = ['source', 'canonical', ...Array.from({ length: 24 }, (_, index) => `slot-${index + 1}`)];
  return names.flatMap(name => Object.keys(mimeTypes).map(extension => `${prefix}${name}.${extension}`));
}

export function createProductFiles(uid: string, id: string, archivePath: string, draft: ProductDraft): ProductFiles {
  const archive = parseProductArchive({ ...draft, version: 1 });
  revisionPaths(uid, id, archivePath);
  const prefix = archivePath.slice(0, -5) + '/';
  const files: ProductFiles['files'] = [];
  let total = 0;
  const convert = (data: string | null, name: string) => {
    if (!data) return data;
    const [, extension, encoded] = /^data:image\/([^;]+);base64,([\s\S]+)$/.exec(data)!;
    const binary = atob(encoded);
    const blob = new Blob([Uint8Array.from(binary, character => character.charCodeAt(0))], { type: mimeTypes[extension] });
    total += blob.size;
    if (total > MAX_ARCHIVE_BYTES || blob.size > 50 * 1024 * 1024) throw new Error('상품 이미지 용량이 너무 큽니다.');
    const path = `${prefix}${name}.${extension}`;
    files.push({ path, blob });
    return path;
  };
  const manifest = {
    ...archive, fileVersion: 1 as const,
    uploadedImage: convert(archive.uploadedImage, 'source'),
    canonicalImage: convert(archive.canonicalImage, 'canonical'),
    images: archive.images.map((image, index) => convert(image, `slot-${index + 1}`) ?? ''),
  };
  files.push({ path: archivePath, blob: new Blob([JSON.stringify(manifest)], { type: 'application/json' }) });
  return { manifest, files };
}

export async function restoreProductFiles(uid: string, id: string, archivePath: string, value: unknown, download: (path: string) => Promise<Blob>): Promise<SavedProduct> {
  const allowed = new Set(revisionPaths(uid, id, archivePath));
  if (!value || typeof value !== 'object') throw new Error('상품 보관 파일이 올바르지 않습니다.');
  const manifest = value as Record<string, unknown>;
  if (manifest.fileVersion !== 1 || !Array.isArray(manifest.images) || manifest.images.length !== 24) throw new Error('상품 보관 파일이 올바르지 않습니다.');
  // Validate every reference before making any download request.
  for (const path of [manifest.uploadedImage, manifest.canonicalImage, ...manifest.images]) {
    if (path !== null && path !== '' && (typeof path !== 'string' || !allowed.has(path))) throw new Error('다른 상품의 이미지 경로는 불러올 수 없습니다.');
  }
  let total = 0;
  const restore = async (path: unknown): Promise<string | null> => {
    if (path === null) return null;
    if (path === '') return '';
    const filePath = path as string;
    const blob = await download(filePath);
    total += blob.size;
    if (total > MAX_ARCHIVE_BYTES) throw new Error('상품 이미지 용량이 너무 큽니다.');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const parts: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 32768) parts.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
    const extension = filePath.slice(filePath.lastIndexOf('.') + 1);
    return `data:${mimeTypes[extension]};base64,${btoa(parts.join(''))}`;
  };
  // Limit simultaneous image reads to avoid large bursts on the free tier.
  const images: string[] = [];
  for (let index = 0; index < 24; index += 4) {
    images.push(...await Promise.all(manifest.images.slice(index, index + 4).map(async path => await restore(path) ?? '')));
  }
  return parseProductArchive({ ...manifest, images,
    uploadedImage: await restore(manifest.uploadedImage), canonicalImage: await restore(manifest.canonicalImage) });
}
