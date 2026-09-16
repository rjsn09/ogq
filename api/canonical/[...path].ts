import type {
  VercelRequest,
  VercelResponse,
} from "@vercel/node";

import {
  proxyOGQ,
  querySuffix,
} from "../../server/ogqProxy.js";


export const config = {
  api: {
    bodyParser: false,
  },
};


export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (
    !["GET", "POST"].includes(
      req.method ?? "GET"
    )
  ) {
    res.setHeader(
      "Allow",
      "GET, POST"
    );

    res
      .status(405)
      .json({
        error:
          "Method not allowed",
      });

    return;
  }


  const raw =
    req.query.path;


  const parts =
    Array.isArray(raw)
      ? raw
      : raw
        ? raw.split("/")
        : [];


  if (
    parts.some(
      part =>
        !/^[a-zA-Z0-9_-]+$/.test(
          part
        )
    )
  ) {
    res
      .status(400)
      .json({
        error:
          "잘못된 canonical 경로입니다.",
      });

    return;
  }


  const path =
    parts
      .map(
        encodeURIComponent
      )
      .join("/");


  const suffix =
    querySuffix(
      req,
      ["path"]
    );


  await proxyOGQ(
    req,
    res,
    `/api/canonical${path ? `/${path}` : ""}${suffix}`
  );
}