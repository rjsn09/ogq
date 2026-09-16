import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jobIdParam, proxyOGQ, querySuffix } from '../../../server/ogqProxy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'Method not allowed' }); return; }
  const jobId = jobIdParam(req);
  if (!jobId) { res.status(400).json({ error: '올바른 jobId가 필요합니다.' }); return; }
  await proxyOGQ(req, res, `/api/generate-set/${encodeURIComponent(jobId)}/events${querySuffix(req, ['jobId'])}`);
}
