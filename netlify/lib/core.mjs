// Lógica compartida de los avisos push: validación de datos y armado de mensajes.
// No depende de Netlify, así se puede probar con `npm test`.
import { createHash } from 'node:crypto';

// ---------- Validación ----------
// Solo se aceptan suscripciones de los servicios de push reales de los navegadores.
// Así nadie puede usar el servidor para enviar peticiones a otras direcciones.
const PUSH_HOSTS = [
  'fcm.googleapis.com',            // Chrome, Edge, Android
  'updates.push.services.mozilla.com', // Firefox
  'push.services.mozilla.com',
  'web.push.apple.com',            // Safari / iPhone
  'push.apple.com',
  'notify.windows.com',            // Edge antiguo
];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function validSubscription(sub) {
  if (!sub || typeof sub !== 'object') return null;
  const { endpoint, keys } = sub;
  if (typeof endpoint !== 'string' || endpoint.length > 1000) return null;
  let u;
  try { u = new URL(endpoint); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  if (!PUSH_HOSTS.some(h => host === h || host.endsWith('.' + h))) return null;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') return null;
  if (!B64URL.test(keys.p256dh) || keys.p256dh.length < 80 || keys.p256dh.length > 120) return null;
  if (!B64URL.test(keys.auth) || keys.auth.length < 16 || keys.auth.length > 40) return null;
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export const subId = endpoint => createHash('sha256').update(endpoint).digest('hex');

const isISO = v => typeof v === 'string' && ISO.test(v) && !Number.isNaN(Date.parse(v));
const int = (v, lo, hi, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const cleanText = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
function validTz(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return 'America/Santiago';
  try { new Intl.DateTimeFormat('es', { timeZone: tz }); return tz; } catch { return 'America/Santiago'; }
}
const stats = o => ({
  sess: int(o && o.sess, 0, 50, 0), ex: int(o && o.ex, 0, 1000, 0),
  hab: int(o && o.hab, 0, 50, 0), xp: int(o && o.xp, 0, 100000, 0),
});

// Deja solo los campos esperados, con tipos y rangos correctos.
export function cleanState(s) {
  s = s && typeof s === 'object' ? s : {};
  const rem = s.rem || {};
  const today = s.today || {};
  const week = s.week || {};
  const days = Array.isArray(s.days) ? [...new Set(s.days.filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].slice(0, 7) : [1, 3, 5];
  return {
    tz: validTz(s.tz),
    rem: { train: rem.train !== false, hab: rem.hab !== false, hour: int(rem.hour, 0, 23, 19) },
    weekly: !!s.weekly,
    days,
    start: isISO(s.start) ? s.start : null,
    today: {
      date: isISO(today.date) ? today.date : null,
      habits: Array.isArray(today.habits) ? today.habits.filter(h => ['agua', 'sueno', 'proteina'].includes(h)) : [],
      session: !!today.session,
    },
    week: { mon: isISO(week.mon) ? week.mon : null, cur: stats(week.cur), prev: stats(week.prev), freq: int(week.freq, 1, 6, 3) },
    name: cleanText(s.name, 30),
    sess: Array.isArray(s.sess) ? s.sess.slice(0, 7).map(x => [cleanText(Array.isArray(x) ? x[0] : '', 40) || 'tu sesión', int(Array.isArray(x) ? x[1] : 0, 5, 180, 30)]) : [],
  };
}

// ---------- Fecha y hora local de cada persona ----------
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function localNow(tz, now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(now).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: WD[p.weekday] };
}
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

// ---------- Textos (los mismos que usa la app) ----------
const TRAIN_MSG = [
  ['Hoy toca {nombre} 🏋️', 'Las pesas no se levantan solas. Te están esperando.'],
  ['¿Listo? 💪', 'Hoy toca {nombre}. Vamos con todo.'],
  ['Solo {min} minutos ⏱', 'Es todo lo que pide tu sesión de {nombre}.'],
  ['Hoy es tu día 💪', 'Toca {nombre}. Una sesión más, un paso más.'],
];
const TRAIN_LAST = [
  ['¿10 minutos en casa? 🏠', 'Si hoy no alcanzas a ir, una versión corta de {nombre} igual cuenta.'],
  ['Otro día lo retomamos 🌙', 'Hoy no se pudo y está bien. Si entrenaste, márcalo en tu rutina.'],
];
const HAB_TITLE = { agua: '¿Ya tomaste agua? 💧', proteina: '¿Comiste tu proteína? 🥚' };
const HAB_NAME = { agua: 'tu agua', proteina: 'tu proteína' };
const HAB_BODY = ['{Falta} {lista} para completar tus hábitos de hoy. 💪', '{Falta} {lista}. Los hábitos también son entrenamiento.'];
export const LAST_HOUR = 21, GAP = 2;

const fill = (t, v) => t.replace(/\{(\w+)\}/g, (_, k) => (v[k] != null ? v[k] : ''));
const lista = ks => { const n = ks.map(k => HAB_NAME[k]); return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0] || ''; };
const dayNum = iso => Math.floor(Date.parse(iso) / 864e5);

export function compose(date, hour, tv, missing, stage) {
  const pick = (arr, salt) => arr[(dayNum(date) + salt) % arr.length];
  const second = Math.min(hour + GAP, LAST_HOUR);
  const v = Object.assign({ lista: lista(missing), Falta: missing.length > 1 ? 'Te faltan' : 'Te falta' }, tv || {});
  if (tv) {
    const m = stage && second >= 18 ? pick(TRAIN_LAST, 0) : pick(TRAIN_MSG, stage);
    return [fill(m[0], v), fill(m[1], v) + (missing.length ? fill(' Y no olvides {lista}.', v) : '')];
  }
  return [HAB_TITLE[missing[0]], fill(pick(HAB_BODY, 1 + stage), v)];
}

function summaryText(st, f) {
  if (st.sess >= f) return `¡Semana completa! Cumpliste tus ${f} días. ✨`;
  if (st.sess > 0) return `Hiciste ${st.sess} de ${f} sesiones. Cada sesión suma: esta semana vamos por una más. 💪`;
  if (st.hab > 0) return 'No entrenaste, pero cuidaste tus hábitos. Esta semana, prueba con una sesión corta. 💪';
  return 'Semana tranquila. No pasa nada: hoy es un buen día para volver. 👊';
}
const weeklyBody = (st, f) => summaryText(st, f) + (st.hab ? ` Además, ${st.hab} hábito${st.hab > 1 ? 's' : ''} cumplido${st.hab > 1 ? 's' : ''}.` : '');

// ---------- ¿Qué avisos tocan ahora? ----------
// Devuelve { messages: [{title, body, url}], sent } con el registro actualizado.
// Misma regla que la app: un aviso a la hora elegida y otro 2 horas después (nunca después de las 21:00),
// solo si falta la sesión del día o algún hábito. El lunes a las 9:00, el resumen de la semana.
export function planMessages(state, sentIn, now = new Date()) {
  const st = state;
  const { date, hour, weekday } = localNow(st.tz, now);
  let sent = sentIn && sentIn.date === date ? { ...sentIn } : { date, n: 0, weekly: sentIn && sentIn.weekly };
  const messages = [];

  const fresh = st.today.date === date;
  const habits = fresh ? st.today.habits : [];
  const session = fresh ? st.today.session : false;
  const started = !st.start || st.start <= date;
  const idx = st.days.indexOf(weekday);
  const H = st.rem.hour, S = Math.min(H + GAP, LAST_HOUR);

  const due = sent.n === 0 ? hour >= H && hour <= LAST_HOUR : sent.n === 1 && S > H && hour >= S && hour <= LAST_HOUR;
  if (due) {
    const sess = st.sess[idx] || ['tu sesión', 30];
    const tv = st.rem.train && idx >= 0 && started && !session ? { nombre: sess[0], min: sess[1] } : null;
    const missing = st.rem.hab ? ['agua', 'proteina'].filter(k => !habits.includes(k)) : [];
    if (tv || missing.length) {
      const [title, body] = compose(date, H, tv, missing, sent.n);
      messages.push({ title, body, url: tv ? '/#rutina' : '/#habitos', tag: 'recordatorio' });
    }
    sent.n = hour >= S ? 2 : sent.n + 1;
  }

  // Resumen del lunes (con los datos de la semana pasada que mandó la app)
  if (st.weekly && weekday === 1 && hour >= 9 && sent.weekly !== date) {
    sent.weekly = date;
    let last = null;
    if (st.week.mon === date) last = st.week.prev;
    else if (st.week.mon === addDays(date, -7)) last = st.week.cur;
    if (last && (last.sess || last.hab || last.ex)) {
      messages.push({ title: 'Tu resumen semanal ✨', body: weeklyBody(last, st.week.freq), url: '/#inicio', tag: 'resumen' });
    }
  }
  return { messages, sent };
}
