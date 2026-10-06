// api/ogq.ts
export default async function handler(req: any, res: any) {
  // 브라우저용 CORS 헤더 허용
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.VITE_OGQ_API_KEY || process.env.OGQ_API_KEY;

  try {
    // Vercel 서버에서 OGQ 서버로 백엔드 호출 (서버 간 통신은 CORS 제약 없음)
    const response = await fetch("https://api.ogq.me/v1/market/stickers/popular?limit=4", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ 
        error: `OGQ API Error: ${response.statusText}` 
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
