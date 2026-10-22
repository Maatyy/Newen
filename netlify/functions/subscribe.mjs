// POST /api/subscribe   { sub, state }  → guarda o actualiza la suscripción y el estado del día
// DELETE /api/subscribe { sub }         → la borra
import { validSubscription, cleanState, subId } from '../lib/core.mjs';
import { subsStore, json, sameOrigin, readJson } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST' && req.method !== 'DELETE') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  let body;
  try { body = await readJson(req); } catch { return json(400, { error: 'body' }); }
  const sub = validSubscription(body && body.sub);
  if (!sub) return json(400, { error: 'sub' });
  const store = subsStore(), id = subId(sub.endpoint);

  if (req.method === 'DELETE') { await store.delete(id); return json(200, { ok: true }); }

  const prev = await store.get(id, { type: 'json' }).catch(() => null);
  await store.setJSON(id, {
    sub,
    state: cleanState(body.state),
    sent: (prev && prev.sent) || null,
    lastTest: (prev && prev.lastTest) || 0,
    updated: Date.now(),
  });
  return json(200, { ok: true });
};
export const config = { path: '/api/subscribe' };
