import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  proxyOGQ,
  querySuffix,
} from "../server/ogqProxy.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS 헤더 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const raw = req.query.path;

  // 🌟 [추가] Home.tsx에서 호출할 OGQ 인기 마켓 스티커 전용 라우팅
  if (raw === "ogq-popular") {
    const suffix = querySuffix(req, ["path", "...path"]);
    const targetPath = `/v1/market/stickers/popular${suffix || "?limit=4"}`;
    console.log("[OGQ POPULAR PROXY]", { targetPath });
    await proxyOGQ(req, res, targetPath);
    return;
  }

  // 👇 아래부터는 기존 canonical-proxy 코드 100% 그대로 유지
  if (
    !["GET", "POST"].includes(
      req.method ?? "GET"
    )
  ) {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({
      error: "Method not allowed",
    });
    return;
  }

  const parts =
    Array.isArray(raw)
      ? raw
      : typeof raw === "string" && raw.length > 0
        ? raw.split("/")
        : [];

  if (
    parts.some(
      part =>
        !/^[a-zA-Z0-9_-]+$/.test(part)
    )
  ) {
    res.status(400).json({
      error: "잘못된 canonical 경로입니다.",
    });
    return;
  }

  const path =
    parts
      .map(encodeURIComponent)
      .join("/");

  const suffix =
    querySuffix(
      req,
      [
        "path",
        "...path",
      ]
    );

  console.log(
    "[CANONICAL PROXY]",
    {
      raw,
      parts,
      backendPath:
        `/api/canonical${path ? `/${path}` : ""}${suffix}`,
    }
  );

  await proxyOGQ(
    req,
    res,
    `/api/canonical${path ? `/${path}` : ""}${suffix}`
  );
}
