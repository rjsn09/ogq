export interface StreamData {
  job_id?: string;
  canonical_id?: string;
  events_url?: string;
  total?: number;
  completed?: number;
  index?: number;
  name?: string;
  image?: string;
  status?: string;
  error?: string;
  [key: string]: unknown;
}

export interface SSEEvent {
  type: string;
  id?: string;
  data: StreamData;
}

export class OGQStreamError extends Error {
  jobId?: string;
  canonicalId?: string;
  eventsUrl?: string;
  lastEventId = 0;
  constructor(message: string, public retryable = false) {
    super(message);
    this.name = 'OGQStreamError';
  }
}

const env = (import.meta as ImportMeta & { env?: { VITE_BACKEND_URL?: string; DEV?: boolean } }).env;
const defaultBase = env?.VITE_BACKEND_URL?.trim() || (env?.DEV ? 'http://localhost:8000' : '');

export function apiUrl(path: string, baseUrl = defaultBase): string {
  if (!path.startsWith('/api/') || path.startsWith('//')) throw new OGQStreamError('잘못된 API 경로입니다.');
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

export async function responseError(response: Response): Promise<string> {
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    const detail = data.error ?? data.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(item => item.msg ?? JSON.stringify(item)).join(', ');
  } catch { /* Non-JSON proxy errors use the HTTP status below. */ }
  return `서버 요청 실패 (HTTP ${response.status})`;
}

/** Handles UTF-8 and CR/LF split across arbitrary network chunk boundaries. */
export async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', type = 'message', id: string | undefined;
  let lines: string[] = [];
  function acceptLine(line: string): SSEEvent | undefined {
    if (!line) {
      let event: SSEEvent | undefined;
      if (lines.length) {
        let data: unknown;
        try { data = JSON.parse(lines.join('\n')); }
        catch { throw new OGQStreamError('SSE 데이터가 올바른 JSON이 아닙니다.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new OGQStreamError('잘못된 SSE 데이터입니다.');
        event = { type, id, data: data as StreamData };
      }
      type = 'message'; id = undefined; lines = [];
      return event;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') type = value;
    if (field === 'id' && !value.includes('\0')) id = value;
    if (field === 'data') lines.push(value);
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      while (true) {
        const match = /[\r\n]/.exec(buffer);
        if (!match) break;
        const index = match.index;
        if (buffer[index] === '\r' && index === buffer.length - 1 && !done) break;
        const line = buffer.slice(0, index);
        const length = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
        buffer = buffer.slice(index + length);
        const event = acceptLine(line);
        if (event) yield event;
      }
      if (done) break;
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export interface StreamOptions {
  form?: FormData;
  baseUrl?: string;
  signal?: AbortSignal;
  after?: number;
  maxReconnects?: number;
  reconnectDelayMs?: number;
  onStart?: (data: StreamData) => void | Promise<void>;
  onImage?: (data: StreamData) => void | Promise<void>;
  onDone?: (data: StreamData) => void | Promise<void>;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal?.reason ?? new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, ms);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

async function notify(callback: ((data: StreamData) => void | Promise<void>) | undefined, data: StreamData) {
  try { await callback?.(data); }
  catch (error) { throw new OGQStreamError(error instanceof Error ? error.message : '화면 갱신에 실패했습니다.'); }
}

/** POST once. Interrupted streams reconnect by GET to the SAME job only. */
export async function streamOGQ(path: string, options: StreamOptions = {}): Promise<StreamData> {
  let identity: StreamData = {};
  let cursor = options.after ?? 0;
  let eventsPath: string | undefined = options.form ? undefined : path;
  const maxReconnects = Math.max(0, options.maxReconnects ?? 3);
  for (let attempt = 0; ; attempt++) {
    options.signal?.throwIfAborted();
    const starting = attempt === 0 && options.form !== undefined;
    try {
      const headers: Record<string, string> = { Accept: 'text/event-stream', 'ngrok-skip-browser-warning': 'true' };
      if (!starting && cursor > 0) headers['Last-Event-ID'] = String(cursor);
      const response = await fetch(apiUrl(starting ? path : eventsPath ?? path, options.baseUrl), {
        method: starting ? 'POST' : 'GET', body: starting ? options.form : undefined,
        headers, cache: 'no-store', signal: options.signal,
      });
      if (!response.ok) throw new OGQStreamError(await responseError(response), !starting && response.status >= 500);
      if (response.status === 204) return { ...identity, status: 'already_received' };
      if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
        await response.body?.cancel();
        throw new OGQStreamError('SSE 응답이 아닙니다. 백엔드 버전과 API 주소를 확인해 주세요.');
      }
      for await (const event of parseSSE(response.body)) {
        if (event.type === 'start') {
          identity = { ...identity, ...event.data };
          if (typeof event.data.events_url === 'string') eventsPath = event.data.events_url;
          await notify(options.onStart, event.data);
        } else if (event.type === 'image') {
          const eventId = Number(event.id);
          if (!Number.isSafeInteger(eventId) || eventId <= 0) throw new OGQStreamError('잘못된 이미지 이벤트 ID입니다.');
          if (eventId <= cursor) continue;
          if (eventId !== cursor + 1) throw new OGQStreamError('이미지 이벤트 순서가 일치하지 않습니다.');
          await notify(options.onImage, event.data);
          cursor = eventId;
        } else if (event.type === 'done') {
          await notify(options.onDone, event.data);
          return event.data;
        } else if (event.type === 'error') {
          throw new OGQStreamError(event.data.error || '이미지 생성에 실패했습니다.');
        }
      }
      throw new OGQStreamError('완료 전에 연결이 끊겼습니다.', true);
    } catch (error) {
      options.signal?.throwIfAborted();
      const failure = error instanceof OGQStreamError ? error : new OGQStreamError(error instanceof Error ? error.message : '서버 연결 오류', true);
      failure.jobId = identity.job_id;
      failure.canonicalId = identity.canonical_id;
      failure.eventsUrl = eventsPath;
      failure.lastEventId = cursor;
      if (!failure.retryable || !eventsPath || attempt >= maxReconnects) throw failure;
      await pause((options.reconnectDelayMs ?? 1000) * Math.min(attempt + 1, 3), options.signal);
    }
  }
}
