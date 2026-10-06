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
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({
      error: "Method not allowed",
    });
    return;
  }

  const suffix = querySuffix(req, []);

  // OGQ 마켓 인기 스티커 API 경로 전달
  const targetPath = `/v1/market/stickers/popular${suffix || "?limit=4"}`;

  console.log("[OGQ POPULAR PROXY]", { targetPath });

  await proxyOGQ(
    req,
    res,
    targetPath
  );
}
