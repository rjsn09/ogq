import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

class ProxyError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

export function querySuffix(req: VercelRequest, omit: string[] = []): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (omit.includes(key) || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  return query.size ? `?${query.toString()}` : '';
}

export function jobIdParam(req: VercelRequest): string | undefined {
  const value = req.query.jobId;
  return typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value) ? value : undefined;
}

function header(req: VercelRequest, key: string): string | undefined {
  const value = req.headers[key];
  return Array.isArray(value) ? value[0] : value;
}

function backendBase(): string {
  const value = (process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || '').trim().replace(/\/+$/, '');
  if (!value) throw new ProxyError('BACKEND_URL 환경변수를 설정해 주세요.', 500);
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash) throw new ProxyError('BACKEND_URL은 백엔드 기본 HTTP(S) 주소여야 합니다.', 500);
  return value;
}

async function readBody(req: VercelRequest): Promise<ArrayBuffer> {
  if (req.body != null) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') return new Uint8Array(Buffer.from(req.body)).buffer;
    throw new ProxyError('프록시의 bodyParser를 false로 설정해 주세요.', 500);
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 32 * 1024 * 1024) throw new ProxyError('업로드 크기가 32MiB를 초과했습니다.', 413);
    chunks.push(buffer);
  }
  return new Uint8Array(Buffer.concat(chunks)).buffer;
}

/** JSON passes through unchanged; SSE streams immediately with backpressure. */
export async function proxyOGQ(req: VercelRequest, res: VercelResponse, path: string): Promise<void> {
  const controller = new AbortController();
  const disconnect = () => { if (!res.writableEnded) controller.abort(); };
  req.once('aborted', disconnect);
  res.once('close', disconnect);
  let upstream: Response | undefined;
  try {
    const method = req.method ?? 'GET';
    const headers: Record<string, string> = { 'ngrok-skip-browser-warning': 'true', 'accept-encoding': 'identity' };
    for (const key of ['content-type', 'accept', 'last-event-id', 'authorization']) {
      const value = header(req, key);
      if (value) headers[key] = value;
    }
    const url = `${backendBase()}${path}`;
    const body = ['GET', 'HEAD'].includes(method) ? undefined : await readBody(req);
    upstream = await fetch(url, { method, headers, body, signal: controller.signal, cache: 'no-store' });
    if (upstream.status === 204 || method === 'HEAD') {
      res.status(upstream.status).end();
      await upstream.body?.cancel();
      return;
    }
    const contentType = upstream.headers.get('content-type') ?? '';
    const isSSE = contentType.includes('text/event-stream');
    if (!isSSE && !contentType.includes('application/json')) {
      throw new ProxyError(`백엔드가 JSON/SSE 이외의 응답을 반환했습니다 (HTTP ${upstream.status}).`, upstream.status >= 400 ? upstream.status : 502);
    }
    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', isSSE ? 'no-cache, no-transform' : 'no-store');
    const retryAfter = upstream.headers.get('retry-after');
    if (retryAfter) res.setHeader('Retry-After', retryAfter);
    if (isSSE) res.setHeader('X-Accel-Buffering', 'no');
    // Do not await text()/arrayBuffer(): that buffers the entire generation.
    res.flushHeaders();
    if (!upstream.body) { res.end(); return; }
    const source = Readable.fromWeb(upstream.body as unknown as NodeReadableStream<Uint8Array>);
    await pipeline(source, res, { signal: controller.signal });
  } catch (error) {
    await upstream?.body?.cancel().catch(() => {});
    if (controller.signal.aborted || res.destroyed) return;
    if (res.headersSent) {
      // A transport failure is resumable; do not invent a terminal backend error.
      res.destroy(error instanceof Error ? error : undefined);
    } else {
      const status = error instanceof ProxyError ? error.status : 502;
      res.status(status).json({ error: error instanceof ProxyError ? error.message : '백엔드 서버에 연결할 수 없습니다.' });
    }
  } finally {
    req.off('aborted', disconnect);
    res.off('close', disconnect);
  }
}
