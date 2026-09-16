import type { VercelRequest, VercelResponse } from '@vercel/node';
import { proxyOGQ } from '../server/ogqProxy';

export const config = { api: { bodyParser: false } };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); res.status(405).json({ error: 'Method not allowed' }); return; }
  await proxyOGQ(req, res, '/api/generate-set');
}
