import { test } from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import { createECDH, randomBytes } from 'node:crypto';
import { validSubscription, cleanState, planMessages, localNow } from '../netlify/lib/core.mjs';

const b64u = b => b.toString('base64url');
const fakeSub = host => {
  const ecdh = createECDH('prime256v1'); ecdh.generateKeys();
  return { endpoint: `https://${host}/push/abc123`, keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(randomBytes(16)) } };
};
const at = (iso) => new Date(iso);   // hora UTC; Santiago en octubre = UTC-3

const base = (o = {}) => cleanState(Object.assign({
  tz: 'America/Santiago', rem: { train: true, hab: true, hour: 19 }, weekly: true,
  days: [1, 3, 5], start: '2026-10-01',
  today: { date: '2026-10-21', habits: [], session: false },
  week: { mon: '2026-10-19', cur: { sess: 2, ex: 10, hab: 6, xp: 100 }, prev: { sess: 3, ex: 15, hab: 12, xp: 200 }, freq: 3 },
  name: 'Matías', sess: [['piernas', 50], ['tren superior y core', 45], ['full body ligero y cardio', 50]],
}, o));

test('acepta suscripciones de los servicios reales', () => {
  for (const h of ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com']) assert.ok(validSubscription(fakeSub(h)), h);
});
test('rechaza direcciones que no son de push (evita SSRF)', () => {
  for (const h of ['evil.com', 'fcm.googleapis.com.evil.com', '127.0.0.1', 'localhost', 'web.push.apple.com:8080'])
    assert.equal(validSubscription(fakeSub(h)), null, h);
  const s = fakeSub('fcm.googleapis.com'); s.endpoint = s.endpoint.replace('https', 'http'); assert.equal(validSubscription(s), null);
  const k = fakeSub('fcm.googleapis.com'); k.keys.auth = '<script>'; assert.equal(validSubscription(k), null);
  assert.equal(validSubscription(null), null); assert.equal(validSubscription('x'), null);
});
test('limpia el estado: rangos, tipos y textos', () => {
  const s = cleanState({ tz: 'Mars/Base', rem: { hour: 99 }, days: [1, 1, 9, 'x', 3], start: '<b>', name: '<img src=x onerror=alert(1)>'.repeat(5), sess: [['<x>', 9999]], week: { cur: { sess: -5 } }, extra: 'nope' });
  assert.equal(s.tz, 'America/Santiago'); assert.equal(s.rem.hour, 23); assert.deepEqual(s.days, [1, 3]);
  assert.equal(s.start, null); assert.ok(!/[<>]/.test(s.name)); assert.ok(s.name.length <= 30);
  assert.equal(s.sess[0][1], 180); assert.equal(s.week.cur.sess, 0); assert.equal(s.extra, undefined);
});
test('hora local por zona horaria', () => {
  const l = localNow('America/Santiago', at('2026-10-21T22:30:00Z'));
  assert.deepEqual(l, { date: '2026-10-21', hour: 19, weekday: 3 });
});
test('día de entrenamiento: primer aviso a la hora elegida', () => {
  const r = planMessages(base(), null, at('2026-10-21T22:02:00Z')); // miércoles 19:02
  assert.equal(r.messages.length, 1); assert.match(r.messages[0].title + r.messages[0].body, /tren superior y core/);
  assert.match(r.messages[0].body, /agua y tu proteína/); assert.equal(r.sent.n, 1);
});
test('antes de la hora no avisa', () => {
  const r = planMessages(base(), null, at('2026-10-21T20:02:00Z')); // 17:02
  assert.equal(r.messages.length, 0); assert.equal(r.sent.n, 0);
});
test('segundo aviso 2 horas después, y no repite', () => {
  const r1 = planMessages(base(), null, at('2026-10-21T22:02:00Z'));
  const r20 = planMessages(base(), r1.sent, at('2026-10-21T23:02:00Z')); assert.equal(r20.messages.length, 0);
  const r2 = planMessages(base(), r1.sent, at('2026-10-22T00:02:00Z')); // 21:02
  assert.equal(r2.messages.length, 1); assert.equal(r2.sent.n, 2);
  const r3 = planMessages(base(), r2.sent, at('2026-10-22T01:02:00Z')); assert.equal(r3.messages.length, 0);
});
test('si ya entrenó y cumplió hábitos, no avisa', () => {
  const s = base({ today: { date: '2026-10-21', habits: ['agua', 'proteina'], session: true } });
  assert.equal(planMessages(s, null, at('2026-10-21T22:02:00Z')).messages.length, 0);
});
test('estado de ayer no cuenta como hecho hoy', () => {
  const s = base({ today: { date: '2026-10-20', habits: ['agua', 'proteina'], session: true } });
  assert.equal(planMessages(s, null, at('2026-10-21T22:02:00Z')).messages.length, 1);
});
test('día de descanso: solo hábitos', () => {
  const r = planMessages(base(), null, at('2026-10-22T22:02:00Z')); // jueves
  assert.equal(r.messages.length, 1); assert.match(r.messages[0].title, /agua/); assert.equal(r.messages[0].url, '/#habitos');
});
test('recordatorios apagados', () => {
  const s = base({ rem: { train: false, hab: false, hour: 19 } });
  assert.equal(planMessages(s, null, at('2026-10-21T22:02:00Z')).messages.length, 0);
});
test('programa que aún no empieza: no recuerda entrenar', () => {
  const s = base({ start: '2026-11-01', rem: { train: true, hab: false, hour: 19 } });
  assert.equal(planMessages(s, null, at('2026-10-21T22:02:00Z')).messages.length, 0);
});
test('resumen del lunes a las 9 y una sola vez', () => {
  const s = base({ week: { mon: '2026-10-19', cur: { sess: 3, ex: 15, hab: 12, xp: 200 }, prev: {}, freq: 3 }, rem: { train: false, hab: false, hour: 19 } });
  const r = planMessages(s, null, at('2026-10-26T12:05:00Z')); // lunes 9:05
  assert.equal(r.messages.length, 1); assert.match(r.messages[0].body, /Semana completa/);
  assert.equal(planMessages(s, r.sent, at('2026-10-26T13:05:00Z')).messages.length, 0);
});
test('web-push cifra el aviso correctamente', () => {
  const k = webpush.generateVAPIDKeys();
  const d = webpush.generateRequestDetails(fakeSub('fcm.googleapis.com'), JSON.stringify({ title: 'x', body: 'y' }),
    { vapidDetails: { subject: 'mailto:test@example.com', publicKey: k.publicKey, privateKey: k.privateKey } });
  assert.equal(d.method, 'POST'); assert.equal(d.headers['Content-Encoding'], 'aes128gcm'); assert.match(d.headers.Authorization, /^vapid t=/);
});
