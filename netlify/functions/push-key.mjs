// GET /api/push-key → clave pública VAPID (es pública: no es un secreto)
import { json } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'method' });
  const key = process.env.VAPID_PUBLIC_KEY || '';
  return json(key ? 200 : 503, { key });
};
export const config = { path: '/api/push-key' };
