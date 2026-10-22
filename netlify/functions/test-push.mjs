// POST /api/test-push { sub } → manda un aviso de prueba, solo a una suscripción ya guardada
// y como máximo uno cada 30 segundos (así nadie puede usarlo para mandar spam).
import { validSubscription, subId } from '../lib/core.mjs';
import { subsStore, json, sameOrigin, readJson, vapidReady, send } from '../lib/push.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!sameOrigin(req)) return json(403, { error: 'origin' });
  if (!vapidReady()) return json(503, { error: 'vapid' });
  let body;
  try { body = await readJson(req); } catch { return json(400, { error: 'body' }); }
  const sub = validSubscription(body && body.sub);
  if (!sub) return json(400, { error: 'sub' });
  const store = subsStore(), id = subId(sub.endpoint);
  const rec = await store.get(id, { type: 'json' }).catch(() => null);
  if (!rec) return json(404, { error: 'unknown' });
  if (Date.now() - (rec.lastTest || 0) < 30000) return json(429, { error: 'wait' });
  rec.lastTest = Date.now();
  await store.setJSON(id, rec);
  const r = await send(rec.sub, { title: 'Aviso de prueba 🔔', body: '¡Funciona! Así te llegarán tus recordatorios.', url: '/#inicio', tag: 'prueba' });
  if (r === 'gone') { await store.delete(id); return json(410, { error: 'gone' }); }
  return json(r === 'ok' ? 200 : 502, { ok: r === 'ok' });
};
export const config = { path: '/api/test-push' };
