// Envío de avisos con web-push y almacenamiento en Netlify Blobs.
import webpush from 'web-push';
import { getStore } from '@netlify/blobs';

export const subsStore = () => getStore({ name: 'push-subs', consistency: 'strong' });

let configured = false;
export function vapidReady() {
  const pub = process.env.VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', pub, priv);
    configured = true;
  }
  return true;
}

// Devuelve 'ok', 'gone' (la suscripción ya no existe: hay que borrarla) o 'error'
export async function send(sub, msg) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(msg), { TTL: 3 * 3600, urgency: 'normal' });
    return 'ok';
  } catch (e) {
    if (e && (e.statusCode === 404 || e.statusCode === 410)) return 'gone';
    console.error('push error', e && e.statusCode);
    return 'error';
  }
}

export const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

// Solo se aceptan peticiones que vienen desde la propia web (evita que otro sitio las haga en tu nombre)
export function sameOrigin(req) {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

// Lee el cuerpo con un tope de tamaño
export async function readJson(req, max = 16000) {
  const text = await req.text();
  if (text.length > max) throw new Error('too big');
  return JSON.parse(text);
}
