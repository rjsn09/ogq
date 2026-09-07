import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  api: {
    bodyParser: false,
  },
};

function backendBase() {
  const value =
    process.env.BACKEND_URL ||
    process.env.VITE_BACKEND_URL ||
    "";

  if (!value) {
    throw new Error("BACKEND_URL is not configured.");
  }

  return value.replace(/\/+$/, "");
}

async function readBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
    );
  }

  return Buffer.concat(chunks);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const rawPath = req.query.path;
    const path = Array.isArray(rawPath)
      ? rawPath.join("/")
      : rawPath || "";

    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query)) {
      if (key === "path") continue;

      if (Array.isArray(value)) {
        value.forEach((item) => query.append(key, item));
      } else if (value != null) {
        query.append(key, String(value));
      }
    }

    const suffix = query.toString()
      ? `?${query.toString()}`
      : "";

    const url = `${backendBase()}/api/canonical${
      path ? `/${path}` : ""
    }${suffix}`;

    const headers: Record<string, string> = {};

    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"];
    }

    if (req.headers.accept) {
      headers.accept = req.headers.accept;
    }

    const method = req.method || "GET";
    const hasBody = !["GET", "HEAD"].includes(method);

    const upstream = await fetch(url, {
      method,
      headers,
      body: hasBody ? await readBody(req) : undefined,
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (
        ![
          "content-encoding",
          "transfer-encoding",
          "content-length",
        ].includes(key.toLowerCase())
      ) {
        res.setHeader(key, value);
      }
    });

    const data = Buffer.from(await upstream.arrayBuffer());
    res.send(data);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Canonical proxy failed.",
    });
  }
}
