import { apiUrl, responseError } from '../../api/sse.ts';

export type ApprovedReference = {
  source: string; description: string; image: string; id: string | null;
  canonicalProfile?: string; originalProfile?: string; prompt?: string;
};

export function referenceMatches(reference: ApprovedReference | null, source: string | null, description: string) {
  return !!reference && reference.source === source && reference.description === description.trim();
}

export async function ensureApprovedReference(reference: ApprovedReference, signal?: AbortSignal): Promise<string> {
  if (reference.id) {
    const response = await fetch(apiUrl(`/api/canonical/${encodeURIComponent(reference.id)}`), { signal, headers: { 'ngrok-skip-browser-warning': 'true' } });
    if (response.ok) {
      const state = await response.json();
      if (state.approved) return reference.id;
    } else if (response.status !== 404) throw new Error(await responseError(response));
  }
  const form = new FormData();
  form.append('image', await (await fetch(reference.image, { signal })).blob(), 'canonical.png');
  form.append('original_image', await (await fetch(reference.source, { signal })).blob(), 'source.png');
  form.append('character_base', reference.description);
  form.append('canonical_profile', reference.canonicalProfile ?? '');
  form.append('original_profile', reference.originalProfile ?? '');
  form.append('canonical_prompt', reference.prompt ?? '');
  const response = await fetch(apiUrl('/api/canonical/restore'), { method: 'POST', body: form, signal, headers: { 'ngrok-skip-browser-warning': 'true' } });
  if (!response.ok) throw new Error(await responseError(response));
  const state = await response.json();
  if (typeof state.canonical_id !== 'string' || !state.approved) throw new Error('기준 이미지 복구에 실패했습니다.');
  return state.canonical_id;
}

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ogq-approved-reference', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('references');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function referenceStorage(uid: string, action: 'read' | 'write' | 'delete', value?: ApprovedReference): Promise<ApprovedReference | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('references', action === 'read' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('references');
      const request = action === 'read' ? store.get(uid) : action === 'write' ? store.put(value, uid) : store.delete(uid);
      transaction.oncomplete = () => resolve(action === 'read' ? request.result ?? null : null);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
