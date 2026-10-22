// Función programada: corre cada hora (minuto 2) y manda los recordatorios que correspondan
// según la hora local de cada persona. Solo funciona en el sitio publicado (no en vista previa).
import { planMessages } from '../lib/core.mjs';
import { subsStore, vapidReady, send } from '../lib/push.mjs';

export default async () => {
  if (!vapidReady()) { console.error('Faltan las claves VAPID'); return; }
  const store = subsStore();
  const { blobs } = await store.list();
  let sent = 0, removed = 0;
  for (const { key } of blobs) {
    try {
      const rec = await store.get(key, { type: 'json' });
      if (!rec || !rec.sub || !rec.state) continue;
      // Sin abrir la app en 60 días: se deja de avisar
      if (Date.now() - (rec.updated || 0) > 60 * 864e5) { await store.delete(key); removed++; continue; }
      const { messages, sent: newSent } = planMessages(rec.state, rec.sent);
      let gone = false;
      for (const m of messages) {
        const r = await send(rec.sub, m);
        if (r === 'gone') { gone = true; break; }
        if (r === 'ok') sent++;
      }
      if (gone) { await store.delete(key); removed++; continue; }
      if (JSON.stringify(newSent) !== JSON.stringify(rec.sent)) {
        // Se vuelve a leer por si la app actualizó el estado mientras tanto
        const latest = (await store.get(key, { type: 'json' })) || rec;
        latest.sent = newSent; await store.setJSON(key, latest);
      }
    } catch (e) { console.error('reminder error', key.slice(0, 8), e && e.message); }
  }
  console.log(`Recordatorios: ${sent} enviados, ${removed} suscripciones eliminadas, ${blobs.length} revisadas`);
};
export const config = { schedule: '2 * * * *' };
