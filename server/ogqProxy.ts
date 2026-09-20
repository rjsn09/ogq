import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";


class ProxyError extends Error {
  constructor(
    message: string,
    public status = 502
  ) {
    super(message);

    this.name =
      "ProxyError";
  }
}


/* ---------------------------------------------------------
   Query String
--------------------------------------------------------- */

export function querySuffix(
  req: VercelRequest,
  omit: string[] = []
): string {
  const query =
    new URLSearchParams();


  for (
    const [key, value]
    of Object.entries(req.query)
  ) {
    if (
      omit.includes(key) ||
      value == null
    ) {
      continue;
    }


    const values =
      Array.isArray(value)
        ? value
        : [value];


    for (
      const item of values
    ) {
      query.append(
        key,
        String(item)
      );
    }
  }


  const suffix =
    query.toString();


  return suffix
    ? `?${suffix}`
    : "";
}


/* ---------------------------------------------------------
   jobId
--------------------------------------------------------- */

export function jobIdParam(
  req: VercelRequest
): string | undefined {
  const value =
    req.query.jobId;


  if (
    typeof value !== "string"
  ) {
    return undefined;
  }


  if (
    !/^[a-zA-Z0-9_-]+$/.test(
      value
    )
  ) {
    return undefined;
  }


  return value;
}


/* ---------------------------------------------------------
   Header
--------------------------------------------------------- */

function requestHeader(
  req: VercelRequest,
  key: string
): string | undefined {
  const value =
    req.headers[key];


  if (
    Array.isArray(value)
  ) {
    return value[0];
  }


  return value;
}


/* ---------------------------------------------------------
   Backend URL
--------------------------------------------------------- */

function backendBase(): string {
  const value = (
    process.env.BACKEND_URL ??
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );


  if (!value) {
    throw new ProxyError(
      "BACKEND_URL 환경변수를 설정해 주세요.",
      500
    );
  }


  let url: URL;


  try {
    url =
      new URL(value);
  } catch {
    throw new ProxyError(
      "BACKEND_URL 형식이 올바르지 않습니다.",
      500
    );
  }


  if (
    ![
      "http:",
      "https:",
    ].includes(
      url.protocol
    )
  ) {
    throw new ProxyError(
      "BACKEND_URL은 HTTP 또는 HTTPS 주소여야 합니다.",
      500
    );
  }


  if (
    url.search ||
    url.hash
  ) {
    throw new ProxyError(
      "BACKEND_URL에는 query 또는 hash를 넣을 수 없습니다.",
      500
    );
  }


  return value;
}


/* ---------------------------------------------------------
   Request Body
--------------------------------------------------------- */

async function readBody(
  req: VercelRequest
): Promise<
  Uint8Array | undefined
> {
  if (
    req.method === "GET" ||
    req.method === "HEAD"
  ) {
    return undefined;
  }


  /*
   * bodyParser:false인데도
   * body가 들어온 경우
   */

  if (
    req.body != null
  ) {
    if (
      Buffer.isBuffer(
        req.body
      )
    ) {
      return new Uint8Array(
        req.body
      );
    }


    if (
      typeof req.body ===
      "string"
    ) {
      return new Uint8Array(
        Buffer.from(
          req.body
        )
      );
    }


    throw new ProxyError(
      "Vercel API Route의 bodyParser를 false로 설정해 주세요.",
      500
    );
  }


  const chunks:
    Uint8Array[] = [];


  let totalBytes = 0;


  for await (
    const chunk of req
  ) {
    const buffer =
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);


    totalBytes +=
      buffer.length;


    if (
      totalBytes >
      32 * 1024 * 1024
    ) {
      throw new ProxyError(
        "업로드 크기가 32MiB를 초과했습니다.",
        413
      );
    }


    chunks.push(new Uint8Array(buffer));
  }


  if (
    chunks.length === 0
  ) {
    return undefined;
  }


  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }
  return body;
}


/* ---------------------------------------------------------
   Response Stream
--------------------------------------------------------- */

async function pipeResponse(
  upstream: Response,
  res: VercelResponse,
  signal: AbortSignal
): Promise<void> {
  if (
    !upstream.body
  ) {
    if (
      !res.writableEnded
    ) {
      res.end();
    }

    return;
  }


  const reader =
    upstream.body.getReader();


  try {
    while (true) {
      if (
        signal.aborted
      ) {
        break;
      }


      const {
        done,
        value,
      } =
        await reader.read();


      if (done) {
        break;
      }


      if (
        !value ||
        value.length === 0
      ) {
        continue;
      }


      const canContinue =
        res.write(
          Buffer.from(value)
        );


      if (
        !canContinue
      ) {
        await new Promise<void>(
          resolve => {
            res.once(
              "drain",
              resolve
            );
          }
        );
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore
    }
  }


  if (
    !res.writableEnded &&
    !res.destroyed
  ) {
    res.end();
  }
}


/* ---------------------------------------------------------
   Main Proxy
--------------------------------------------------------- */

export async function proxyOGQ(
  req: VercelRequest,
  res: VercelResponse,
  path: string
): Promise<void> {
  const controller =
    new AbortController();


  let upstream:
    Response |
    undefined;


  const disconnect = () => {
    if (
      !controller.signal.aborted &&
      !res.writableEnded
    ) {
      controller.abort();
    }
  };


  req.once(
    "aborted",
    disconnect
  );


  res.once(
    "close",
    disconnect
  );


  try {
    const backend =
      backendBase();


    const url =
      `${backend}${path}`;


    console.log(
      "[OGQ PROXY]",
      {
        method:
          req.method,
        path,
        backendConfigured:
          Boolean(
            process.env
              .BACKEND_URL
          ),
      }
    );


    const method =
      req.method ??
      "GET";


    const headers:
      Record<
        string,
        string
      > = {
        "ngrok-skip-browser-warning":
          "true",

        "accept-encoding":
          "identity",
      };


    for (
      const key of [
        "content-type",
        "accept",
        "last-event-id",
        "authorization",
      ]
    ) {
      const value =
        requestHeader(
          req,
          key
        );


      if (value) {
        headers[key] =
          value;
      }
    }


    const body =
      await readBody(req);


    upstream =
      await fetch(
        url,
        {
          method,
          headers,
          body:
            body as
              BodyInit |
              undefined,
          signal:
            controller.signal,
          cache:
            "no-store",
        }
      );


    console.log(
      "[OGQ UPSTREAM]",
      {
        status:
          upstream.status,
        path,
        contentType:
          upstream.headers.get(
            "content-type"
          ),
      }
    );


    if (
      method === "HEAD" ||
      upstream.status === 204
    ) {
      res
        .status(
          upstream.status
        )
        .end();


      await upstream.body
        ?.cancel()
        .catch(
          () => {}
        );


      return;
    }


    const contentType =
      upstream.headers.get(
        "content-type"
      ) ?? "";


    const isSSE =
      contentType.includes(
        "text/event-stream"
      );


    const isJSON =
      contentType.includes(
        "application/json"
      );


    if (
      !isSSE &&
      !isJSON
    ) {
      const preview =
        await upstream
          .text()
          .catch(
            () => ""
          );


      console.error(
        "[OGQ INVALID RESPONSE]",
        {
          status:
            upstream.status,
          contentType,
          preview:
            preview.slice(
              0,
              500
            ),
        }
      );


      throw new ProxyError(
        `백엔드가 JSON/SSE 이외의 응답을 반환했습니다. HTTP ${upstream.status}`,
        upstream.status >= 400
          ? upstream.status
          : 502
      );
    }


    res.status(
      upstream.status
    );


    res.setHeader(
      "Content-Type",
      contentType
    );


    res.setHeader(
      "Cache-Control",
      isSSE
        ? "no-cache, no-transform"
        : "no-store"
    );


    if (isSSE) {
      res.setHeader(
        "X-Accel-Buffering",
        "no"
      );


      res.setHeader(
        "Connection",
        "keep-alive"
      );
    }


    const retryAfter =
      upstream.headers.get(
        "retry-after"
      );


    if (
      retryAfter
    ) {
      res.setHeader(
        "Retry-After",
        retryAfter
      );
    }


    res.flushHeaders();


    await pipeResponse(
      upstream,
      res,
      controller.signal
    );
  } catch (error) {
    console.error(
      "[OGQ PROXY ERROR]",
      error
    );


    if (
      error instanceof Error
    ) {
      console.error(
        "[OGQ PROXY ERROR MESSAGE]",
        error.message
      );


      console.error(
        "[OGQ PROXY ERROR STACK]",
        error.stack
      );
    }


    await upstream?.body
      ?.cancel()
      .catch(
        () => {}
      );


    if (
      controller.signal.aborted ||
      res.destroyed
    ) {
      return;
    }


    if (
      res.headersSent
    ) {
      res.destroy(
        error instanceof Error
          ? error
          : undefined
      );

      return;
    }


    const status =
      error instanceof ProxyError
        ? error.status
        : 502;


    res
      .status(status)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "백엔드 서버에 연결할 수 없습니다.",
      });
  } finally {
    req.off(
      "aborted",
      disconnect
    );


    res.off(
      "close",
      disconnect
    );
  }
}
