import { collection, doc, getDoc, onSnapshot, orderBy, query, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { assertProductPath, encodeProductArchive, productStoragePath, type ProductDraft, type ProductSummary, type SavedProduct } from './productArchive';
import { commitProductFiles, createProductFiles, restoreProductFiles, revisionPaths } from './productFiles';
import { createStorageClient } from './supabaseStorage';

function storageClient(uid: string) {
  return createStorageClient({
    url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? '',
    key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '',
    bucket: import.meta.env.VITE_SUPABASE_STORAGE_BUCKET?.trim() || 'product-images',
  }, async refresh => {
    const user = auth.currentUser;
    if (!user || user.uid !== uid) throw new Error('상품을 저장한 계정으로 로그인해 주세요.');
    return user.getIdToken(refresh);
  });
}

export function subscribeProducts(uid: string, onProducts: (products: ProductSummary[]) => void, onError: (error: Error) => void) {
  return onSnapshot(query(collection(db, 'users', uid, 'products'), orderBy('updatedAt', 'desc')), snapshot => {
    onProducts(snapshot.docs.map(item => {
      const data = item.data();
      return { id: item.id, title: data.title, imageCount: data.imageCount, coverImage: data.coverImage ?? null,
        storagePath: data.storagePath, updatedAt: data.updatedAt?.toMillis?.() ?? Date.now() };
    }));
  }, onError);
}

async function thumbnail(image: string | undefined): Promise<string | null> {
  if (!image) return null;
  const source = new Image();
  source.src = image;
  await source.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const scale = Math.min(128 / source.naturalWidth, 128 / source.naturalHeight);
  const width = source.naturalWidth * scale, height = source.naturalHeight * scale;
  context.drawImage(source, (128 - width) / 2, (128 - height) / 2, width, height);
  const cover = canvas.toDataURL('image/webp', 0.75);
  return cover.length < 60000 ? cover : null;
}

export async function saveProduct(uid: string, id: string, draft: ProductDraft, onProgress: (percent: number) => void): Promise<void> {
  const storage = storageClient(uid);
  encodeProductArchive(draft); // Validate schema and total original size before any upload.
  const productRef = doc(db, 'users', uid, 'products', id);
  const storagePath = productStoragePath(uid, id, crypto.randomUUID());
  const { files, manifest } = createProductFiles(uid, id, storagePath, draft);
  const coverImage = await thumbnail(draft.images.find(Boolean) || draft.uploadedImage || undefined);
  // The manifest is the final file; publish the list only after every file exists.
  const previous = await commitProductFiles(storage, files, () => runTransaction(db, async transaction => {
      const old = (await transaction.get(productRef)).data();
      transaction.set(productRef, {
        title: draft.title.trim(), imageCount: draft.images.filter(Boolean).length, coverImage,
        storagePath, imagePaths: manifest.images, updatedAt: serverTimestamp(), version: 3, provider: 'supabase',
      });
      return old;
    }), onProgress);
  if (previous?.version === 3 && previous.provider === 'supabase' && previous.storagePath) {
    try {
      const paths = revisionPaths(uid, id, previous.storagePath);
      await storage.remove([...paths, previous.storagePath]);
    } catch { /* The new revision remains usable even if cleanup needs to be retried later. */ }
  }
}

export async function loadProduct(uid: string, summary: ProductSummary, signal?: AbortSignal): Promise<SavedProduct> {
  signal?.throwIfAborted();
  assertProductPath(uid, summary);
  const storage = storageClient(uid);
  const manifest = (await getDoc(doc(db, 'users', uid, 'products', summary.id))).data();
  signal?.throwIfAborted();
  if (!manifest || manifest.version !== 3 || manifest.provider !== 'supabase') {
    throw new Error('이 상품은 이전 저장 방식입니다. 기존 편집 화면에서 다시 저장해 주세요.');
  }
  assertProductPath(uid, { ...summary, storagePath: manifest.storagePath });
  const archive = await storage.download(manifest.storagePath, signal);
  if (archive.size > 1024 * 1024) throw new Error('상품 보관 파일이 올바르지 않습니다.');
  const value = JSON.parse(await archive.text());
  return restoreProductFiles(uid, summary.id, manifest.storagePath, value, path => storage.download(path, signal));
}
