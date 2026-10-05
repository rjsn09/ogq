export type StorageConfig = { url: string; key: string; bucket: string };

export function validateStorageConfig(config: StorageConfig): StorageConfig {
  if (!config.url || !config.key) throw new Error('Supabase 저장소 연결이 필요합니다. VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY를 설정해 주세요.');
  const url = new URL(config.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Supabase URL 형식이 올바르지 않습니다.');
  if (!/^[a-zA-Z0-9_-]+$/.test(config.bucket)) throw new Error('Supabase 버킷 이름이 올바르지 않습니다.');
  // Secret and service-role keys must never be deployed to the browser.
  if (config.key.startsWith('sb_secret_')) throw new Error('Supabase 공개 키를 사용해 주세요. 비밀 키는 브라우저에서 사용할 수 없습니다.');
  if (config.key.startsWith('ey')) {
    try {
      const payload = JSON.parse(atob(config.key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role === 'service_role') throw new Error('Supabase service_role 키는 브라우저에서 사용할 수 없습니다.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('service_role')) throw error;
    }
  }
  return { ...config, url: url.origin };
}

export function createStorageClient(settings: StorageConfig, token: (refresh?: boolean) => Promise<string>) {
  const config = validateStorageConfig(settings);
  const objectPath = (path: string) => {
    if (!path || path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('상품 파일 경로가 올바르지 않습니다.');
    return `${encodeURIComponent(config.bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`;
  };
  async function request(path: string, options: RequestInit) {
    for (let attempt = 0; attempt < 2; attempt++) {
      options.signal?.throwIfAborted();
      const headers = new Headers(options.headers);
      headers.set('apikey', config.key);
      headers.set('Authorization', `Bearer ${await token(attempt === 1)}`);
      const response = await fetch(`${config.url}/storage/v1/${path}`, { ...options, headers });
      if (response.ok) return response;
      if (response.status === 401 && attempt === 0) continue;
      if (response.status === 401 || response.status === 403) throw new Error('Supabase 접근 권한을 확인해 주세요. Firebase 로그인 연동과 Storage 정책이 필요합니다.');
      const data = await response.json().catch(() => ({}));
      if (response.status === 413) throw new Error('저장소 파일 크기 제한을 초과했습니다.');
      if (response.status === 507 || response.status === 429) throw new Error('Supabase 저장 공간 또는 무료 사용량 한도에 도달했습니다.');
      if (String(data.message ?? data.error).includes('Bucket not found')) throw new Error('Supabase에 product-images 비공개 버킷을 만들어 주세요.');
      throw new Error(`상품 저장소 요청이 실패했습니다. (HTTP ${response.status})`);
    }
    throw new Error('로그인을 다시 확인해 주세요.');
  }
  return {
    upload: async (path: string, blob: Blob) => {
      await request(`object/${objectPath(path)}`, { method: 'POST', headers: { 'Content-Type': blob.type, 'x-upsert': 'false' }, body: blob });
    },
    download: async (path: string, signal?: AbortSignal) => {
      const response = await request(`object/authenticated/${objectPath(path)}`, { signal });
      const declaredSize = Number(response.headers.get('content-length'));
      if (declaredSize > 64 * 1024 * 1024) { await response.body?.cancel(); throw new Error('상품 파일 용량이 너무 큽니다.'); }
      return response.blob();
    },
    remove: async (paths: string[]) => {
      if (!paths.length) return;
      paths.forEach(objectPath);
      await request(`object/${encodeURIComponent(config.bucket)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: paths }) });
    },
  };
}
