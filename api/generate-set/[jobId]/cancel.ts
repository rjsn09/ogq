import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jobIdParam, proxyOGQ } from '../../../server/ogqProxy.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const jobId = jobIdParam(req);
  if (!jobId) {
    res.status(400).json({ error: '올바른 jobId가 필요합니다.' });
    return;
  }
  await proxyOGQ(req, res, `/api/generate-set/${encodeURIComponent(jobId)}/cancel`);
}
