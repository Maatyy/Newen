(function () {
  // ---------- Almacenamiento seguro ----------
  // Cada clave guardada tiene una forma esperada; si viene dañada o manipulada se ignora (la app nunca se cae)
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const ARR = ['measures'], STR = ['section', 'schedule', 'programStart', 'activity', 'foodPhase', 'trainMode', 'sub-tu', 'sub-tips', 'sub-consejos', 'sub-recomendaciones', 'weighLater', 'nudgeOff', 'lastBackup'];
  const OBJ = ['log', 'wlog', 'profile', 'rewards', 'habits', 'kcalAdj', 'foodLog', 'feel', 'cycle', 'bag', 'exDone2', 'foodPrefs', 'pins', 'remSettings', 'xpEarned', 'myRoutine', 'setDraft', 'mealSwap', 'shopChecked', 'remSent', 'pushSub'];
  function shape(k, v) {
    if (v == null) return null;
    if (ARR.includes(k)) return Array.isArray(v) ? v.filter(isObj).slice(-2000) : null;
    if (STR.includes(k)) return typeof v === 'string' ? v.slice(0, 200) : null;
    if (!OBJ.includes(k)) return v;
    if (!isObj(v)) return null;
    if (k === 'log') { const o = {}; Object.keys(v).slice(-3000).forEach(d => { const x = v[d]; if (isObj(x)) o[d] = Object.assign({}, x, { s: isObj(x.s) ? x.s : {}, h: isObj(x.h) ? x.h : {}, xp: +x.xp || 0, ex: +x.ex || 0 }); }); return o; }
    if (k === 'wlog') { const o = {}; Object.keys(v).slice(0, 300).forEach(n => { if (Array.isArray(v[n])) o[n] = v[n].filter(isObj).slice(-500).map(x => Object.assign({}, x, { sets: Array.isArray(x.sets) ? x.sets.filter(isObj) : [] })); }); return o; }
    if (k === 'rewards' && !isObj(v.m)) v.m = {};
    return v;
  }
  const store = {
    get(k) { try { return shape(k, JSON.parse(localStorage.getItem(k))); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  // Premium: por ahora se activa en la vista previa; la suscripción real se conecta después
  const PREVIEW_MODE = !!document.querySelector('.preview-flag');
  const PETS = { gata: ['¡Vamos!', 'coach', '¡Vamos!', '💪'], perro: ['Guau', 'mascota', '¡Guau, guau!', '🐶'], zorro: ['Yip', 'mascota', '¡Yip, yip!', '🦊'], cerdo: ['Oink', 'mascota', '¡Oink, oink!', '🐷'],
    gallina: ['Kikirikí', 'mascota', '¡Cocorocó!', '🐔'], conejo: ['Ñic', 'mascota', '¡Ñic, ñic!', '🐰'], panda: ['Mmm', 'mascota', '¡Abrazo de panda!', '🐼'] };
  function petNow() { const el = document.querySelector('#mascot .cat'); return PETS[(el && el.dataset.pet) || 'gata'] || PETS.gata; }
  function petText(t) { return String(t); }
  function applyPetTexts(k) { return;
    const p = PETS[k] || PETS.gata, set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
    set('[data-go="tu"] span', p[3]); set('[data-sub-go="mascota"]', `${p[3]} Tu ${p[1]}`); set('#h-mascota', `Tu ${p[1]}`);
    const vh = document.querySelector('.mascot-card h3'); if (vh && vh.firstChild) vh.firstChild.textContent = `Viste a tu ${p[1]} `;
    const rh = document.querySelector('#remCard h3'); if (rh) rh.innerHTML = `Recordatorios de tu ${p[1]} <small>${p[3]}</small>`;
    set('.mascot-link', `${p[3]} Vístela en la pestaña Tú`);
    const mb = document.getElementById('mascot'); if (mb) mb.setAttribute('aria-label', `Tu ${p[1]}. Tócala para que reaccione o arrástrala para girarla.`);
  }
  function isPremium() { return true; }
  function openPremium(what) {
    const m = document.getElementById('premModal'); if (!m) return;
    document.getElementById('premWhat').textContent = what || 'Esta función';
    m.hidden = false; document.getElementById('premClose').focus();
  }
  const localISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = localISO();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- Niveles ----------
  const LEVELS = [['🌱', 'Principiante'], ['🔥', 'Constante'], ['💪', 'Decidido'], ['⚡', 'Imparable'], ['🛡️', 'Firme'], ['💎', 'Sólido'], ['🦁', 'Transformado'], ['⭐', 'Estrella'], ['🏆', 'Campeón'], ['👑', 'Leyenda del gym']];
  const THRESH = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
  const thrOf = l => (l < THRESH.length ? THRESH[l] : 3000 + (l - 9) * 800);
  // Tope de seguridad: nunca más de 100 vueltas aunque la XP venga manipulada
  const levelAt = v => { let l = 0; while (l < 100 && v >= thrOf(l + 1)) l++; return l; };
  const lvInfo = l => LEVELS[Math.min(l, LEVELS.length - 1)];
  const badge = document.getElementById('levelBadge');
  const toastEl = document.getElementById('toast');
  // XP siempre entera, finita y entre 0 y 100.000 (un respaldo manipulado no puede colgar la app)
  const XP_MAX = 100000, cleanXP = v => (Number.isFinite(v) ? Math.min(XP_MAX, Math.max(0, Math.floor(v))) : 0);
  let xp = cleanXP(Number(store.get('xp')));
  let toastT;
  function toast(msg, cls) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (cls ? ' ' + cls : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => { toastEl.className = 'toast'; }, cls ? 3200 : 1300);
  }
  function renderLevel() {
    const l = levelAt(xp), lo = thrOf(l), hi = thrOf(l + 1);
    const pct = Math.round((xp - lo) / (hi - lo) * 100);
    badge.textContent = lvInfo(l)[0];
    document.getElementById('levelNum').textContent = 'Nivel ' + (l + 1);
    document.getElementById('levelName').textContent = lvInfo(l)[1];
    document.getElementById('xpFill').style.width = pct + '%';
    document.getElementById('xpBar').setAttribute('aria-valuenow', pct);
    document.getElementById('xpText').textContent = `${xp} / ${hi} XP`;
    document.getElementById('xpBar').title = `Faltan ${hi - xp} XP para el nivel ${l + 2}`;
  }
  // XP una sola vez al día por cada tarea: desmarcar y volver a marcar no suma de nuevo
  const EX_XP_DAILY_MAX = 12;
  function earnXP(key, n) {
    let e = store.get('xpEarned');
    if (!e || e.date !== today) e = { date: today, keys: {}, ex: 0 };
    if (e.keys[key]) return false;
    if (key.startsWith('e:')) { if (e.ex >= EX_XP_DAILY_MAX) return false; e.ex++; }
    e.keys[key] = 1; store.set('xpEarned', e);
    addXP(n); return true;
  }
  function addXP(n) {
    const before = levelAt(xp);
    xp = cleanXP(xp + n);
    store.set('xp', xp);
    const after = levelAt(xp);
    renderLevel();
    if (window.__rw) window.__rw.onXP(n, after > before ? after : -1);
    if (after > before) {
      const un = window.__rw ? window.__rw.unlocks(after) : '';
      toast(`¡Subiste a nivel ${after + 1}: ${lvInfo(after)[1]}! ${lvInfo(after)[0]}${un ? ' Desbloqueaste: ' + un : ''}`, 'level');
      badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
    } else if (n > 0) toast(`+${n} XP`);
  }
  renderLevel();

  // ---------- Hábitos ----------
  const boxes = Array.from(document.querySelectorAll('[data-habit]'));
  const ringBar = document.getElementById('ringBar');
  const ringCount = document.getElementById('ringCount');
  const hTitle = document.getElementById('habitTitle');
  const hSub = document.getElementById('habitSub');
  const CIRC = 263.9;
  const habitsBody = document.getElementById('habitsBody');
  const toggleHabits = document.getElementById('toggleHabits');
  const msgs = [
    ['Empecemos el día', 'Cada pequeño paso cuenta.'],
    ['¡Buen comienzo!', 'Ya llevas uno, sigue así.'],
    ['¡Casi lo logras!', 'Solo te falta uno para completar el día.'],
    ['¡Día completo! ✨', 'Tu cuerpo te lo agradece. Mañana, otra vez.']
  ];
  let savedH = store.get('habits');
  if (!savedH || savedH.date !== today) savedH = { date: today, done: {} };
  function renderHabits() {
    const n = boxes.filter(b => b.checked).length;
    ringBar.style.strokeDashoffset = CIRC - (CIRC * n / boxes.length);
    ringCount.textContent = n + '/' + boxes.length;
    hTitle.textContent = msgs[n][0];
    hSub.textContent = msgs[n][1];
    const complete = n === boxes.length;
    const inHome = !!habitsBody.closest('.habits-home');
    habitsBody.hidden = !inHome && complete && !savedH.open;
    toggleHabits.hidden = inHome || !complete;
    const hk = document.getElementById('habK'); if (hk) hk.textContent = complete ? '✅ Listo' : 'Hábitos';
    toggleHabits.textContent = habitsBody.hidden ? 'Ver hábitos' : 'Minimizar';
  }
  boxes.forEach(b => {
    b.checked = !!savedH.done[b.dataset.habit];
    b.addEventListener('change', () => { savedH.done[b.dataset.habit] = b.checked; savedH.open = false; store.set('habits', savedH); if (window.__rw) window.__rw.onHab(savedH.done); if (b.checked && !earnXP('h:' + b.dataset.habit, 5)) toast('✓ Ya sumaste la XP de este hábito hoy'); renderHabits(); });
  });
  document.getElementById('resetHabits').addEventListener('click', () => {
    const had = boxes.filter(b => b.checked).length;
    boxes.forEach(b => { b.checked = false; }); savedH.done = {}; store.set('habits', savedH); if (window.__rw) window.__rw.onHab({}); renderHabits();
    
  });
  toggleHabits.addEventListener('click', () => { savedH.open = habitsBody.hidden; store.set('habits', savedH); renderHabits(); });
  renderHabits();

  // ---------- Programa de 12 semanas ----------
  const BASE_PHASES = [
    { weeks: 'Semanas 1 a 4', title: 'Fase 1: Aprende la técnica', desc: 'Movimientos básicos y guiados. Elige un peso con el que te sobren unas 3 repeticiones al final de cada serie.' },
    { weeks: 'Semanas 5 a 8', title: 'Fase 2: Construye fuerza', desc: 'Los ejercicios principales se mantienen, con más peso y menos repeticiones. Algunos complementarios cambian para trabajar el músculo desde otro ángulo.' },
    { weeks: 'Semanas 9 a 12', title: 'Fase 3: Sube de nivel', desc: 'Variantes un poco más desafiantes de los mismos movimientos. Te deben sobrar 1 a 2 repeticiones con buena técnica.' }
  ];
  // Cada ejercicio tiene una versión por fase: [nombre, consejo, series, reps, descanso]
  const days = [
    {
      num: 'Día 1', rec: 'Lunes', alt: 'martes', name: 'Piernas',
      desc: 'Fuerza en piernas con movimientos guiados y seguros.', time: '45–50 min', focus: 'Tren inferior',
      slots: [
        [['Sentadilla goblet', 'Mancuerna en el pecho, espalda recta; baja como si te sentaras en una silla.', '3 series', '12 reps', '60 s'],
         ['Sentadilla goblet', 'Mismo movimiento con más peso. Baja controlando 2 segundos.', '3 series', '10 reps', '75 s'],
         ['Sentadilla en máquina Smith', 'Pies un poco adelante, baja hasta donde mantengas la espalda neutra.', '3 series', '8–10 reps', '90 s']],
        [['Hip thrust en máquina o con barra', 'Espalda alta en el banco; aprieta los glúteos arriba 1 segundo.', '3 series', '12 reps', '60 s'],
         ['Hip thrust en máquina o con barra', 'Sube el peso respecto a la fase 1; mantén la pausa arriba.', '3 series', '10 reps', '75 s'],
         ['Hip thrust en máquina o con barra', 'Tu ejercicio estrella: más peso y una serie extra.', '4 series', '8–10 reps', '90 s']],
        [['Prensa de piernas', 'Pies al ancho de caderas; no bloquees las rodillas al estirar.', '3 series', '12 reps', '90 s'],
         ['Prensa de piernas', 'Más peso; baja hasta que la rodilla quede cerca de 90°.', '3 series', '10 reps', '90 s'],
         ['Prensa con pies altos', 'Pies más arriba en la plataforma para dar más trabajo al glúteo.', '3 series', '10 reps', '90 s']],
        [['Peso muerto rumano con mancuernas', 'Rodillas apenas flexionadas; lleva la cadera atrás y siente el estiramiento.', '3 series', '10 reps', '60 s'],
         ['Peso muerto rumano con barra', 'Mismo patrón con barra: pégala a las piernas al bajar.', '3 series', '10 reps', '75 s'],
         ['Peso muerto rumano con barra', 'Más peso, bajando lento en 3 segundos.', '3 series', '8 reps', '90 s']],
        [['Extensión de cuádriceps en máquina', 'Estira la pierna sin bloquear la rodilla y baja lento.', '3 series', '12 reps', '60 s'],
         ['Extensión de cuádriceps en máquina', 'Más peso; pausa de 1 segundo arriba.', '3 series', '12 reps', '60 s'],
         ['Extensión de cuádriceps con pausa', 'Mantén 2 segundos arriba y baja en 3 segundos.', '3 series', '10 reps', '75 s']]
      ]
    },
    {
      num: 'Día 2', rec: 'Miércoles', alt: 'jueves', name: 'Tren superior y core',
      desc: 'Espalda, pecho, hombros y abdomen para una postura más firme.', time: '45 min', focus: 'Tren superior',
      slots: [
        [['Jalón al pecho en polea', 'Barra a la parte alta del pecho, codos hacia abajo; sin balancearte.', '3 series', '12 reps', '60 s'],
         ['Jalón al pecho en polea', 'Más peso; junta las escápulas abajo.', '3 series', '10 reps', '75 s'],
         ['Dominada asistida en máquina', 'La máquina te ayuda; usa la asistencia justa para lograr las reps.', '3 series', '8–10 reps', '90 s']],
        [['Remo sentado en polea', 'Pecho alto; junta las escápulas al tirar hacia el ombligo.', '3 series', '12 reps', '60 s'],
         ['Remo sentado en polea', 'Más peso; pausa de 1 segundo atrás.', '3 series', '10 reps', '75 s'],
         ['Remo en máquina con apoyo de pecho', 'El apoyo protege tu espalda baja y te deja usar más peso.', '3 series', '10 reps', '75 s']],
        [['Press de pecho en máquina', 'Codos un poco por debajo de los hombros; empuja controlado.', '3 series', '10 reps', '60 s'],
         ['Press de pecho con mancuernas', 'En banco plano; baja las mancuernas a la altura del pecho.', '3 series', '10 reps', '75 s'],
         ['Press inclinado con mancuernas', 'Banco a unos 30°; trabaja la parte alta del pecho.', '3 series', '10 reps', '75 s']],
        [['Press de hombros con mancuernas, sentado', 'Espalda apoyada; sube sin arquear la zona lumbar.', '3 series', '10 reps', '60 s'],
         ['Press de hombros con mancuernas, sentado', 'Más peso que en la fase 1.', '3 series', '10 reps', '75 s'],
         ['Elevaciones laterales', 'Sube hasta la altura de los hombros, codos apenas flexionados.', '3 series', '12–15 reps', '45 s']],
        [['Plancha frontal', 'Cuerpo en línea recta; aprieta abdomen y glúteos.', '3 series', '20–30 s', '45 s'],
         ['Plancha frontal', 'Sube el tiempo manteniendo la cadera alineada.', '3 series', '30–40 s', '45 s'],
         ['Plancha con toque de hombro', 'Pies separados; toca el hombro contrario sin girar la cadera.', '3 series', '10 por lado', '45 s']],
        [['Dead bug', 'Espalda baja pegada al suelo; extiende brazo y pierna contrarios.', '3 series', '10 por lado', '45 s'],
         ['Bird dog', 'En cuatro apoyos, extiende brazo y pierna contrarios sin mover la espalda.', '3 series', '10 por lado', '45 s'],
         ['Dead bug con mancuerna ligera', 'Igual que el dead bug, sosteniendo una mancuerna con ambas manos.', '3 series', '10 por lado', '45 s']]
      ]
    },
    {
      num: 'Día 3', rec: 'Viernes', alt: 'sábado', name: 'Full body ligero y cardio',
      desc: 'Una sesión más suave para mover todo el cuerpo y sumar cardio.', time: '50 min', focus: 'Cuerpo completo',
      slots: [
        [['Zancada estática', 'Apóyate en algo si lo necesitas; baja recto, torso erguido.', '2 series', '10 por pierna', '60 s'],
         ['Zancada estática con mancuernas', 'Una mancuerna en cada mano.', '3 series', '10 por pierna', '60 s'],
         ['Zancada caminando', 'Avanza paso a paso alternando piernas, con control.', '3 series', '10 por pierna', '75 s']],
        [['Remo con mancuerna a una mano', 'Rodilla y mano en un banco; lleva el codo hacia la cadera.', '2 series', '12 por lado', '45 s'],
         ['Remo con mancuerna a una mano', 'Más peso que en la fase 1.', '3 series', '12 por lado', '45 s'],
         ['Remo con mancuerna a una mano', 'Más peso; pausa arriba 1 segundo.', '3 series', '10 por lado', '60 s']],
        [['Flexiones inclinadas', 'Manos en un banco alto; cuanto más alto, más fácil.', '2 series', '8–10 reps', '60 s'],
         ['Flexiones inclinadas', 'Usa un apoyo más bajo que en la fase 1.', '3 series', '8–10 reps', '60 s'],
         ['Flexiones en barra baja o de rodillas', 'Elige la que te permita hacer las reps con el cuerpo recto.', '3 series', '8–10 reps', '60 s']],
        [['Puente de glúteos en el suelo', 'Empuja con los talones; pausa arriba.', '2 series', '15 reps', '45 s'],
         ['Puente de glúteos a una pierna', 'Una pierna estirada al aire; cadera nivelada.', '3 series', '10 por lado', '45 s'],
         ['Puente a una pierna con pausa', 'Mantén 2 segundos arriba en cada repetición.', '3 series', '12 por lado', '45 s']],
        [['Caminata inclinada en cinta', 'Inclinación 6–10 %, ritmo en el que puedas conversar.', '1 bloque', '20 min', '—'],
         ['Caminata inclinada en cinta', 'Mismo ritmo, un poco más de tiempo.', '1 bloque', '25 min', '—'],
         ['Intervalos suaves en cinta o bici', 'Alterna 2 minutos más rápido y 2 minutos suave.', '1 bloque', '25 min', '—']]
      ]
    }
  ];

  // ---------- Rutina en casa (mismas fases; cada versión elige según el equipo: mancuernas > bandas > peso corporal) ----------
  const pickV = v => {
    if (Array.isArray(v)) return v;
    const eq = (profile && profile.equip) || [];
    return (eq.includes('db') && v.db) || (eq.includes('band') && v.band) || v.bw;
  };
  const homeDays = [
    {
      num: 'Día 1', name: 'Piernas', desc: 'Piernas en casa, con tu peso corporal o el equipo que tengas.', time: '35–40 min',
      slots: [
        [{ bw: ['Sentadilla a una silla', 'Siéntate apenas en la silla y vuelve a subir; pies al ancho de caderas.', '3 series', '12 reps', '60 s'], db: ['Sentadilla goblet con mancuerna', 'Mancuerna en el pecho; baja como si te sentaras.', '3 series', '12 reps', '60 s'] },
         { bw: ['Sentadilla con pausa abajo', 'Mantén 2 segundos abajo antes de subir.', '3 series', '12 reps', '60 s'], db: ['Sentadilla goblet con mancuerna', 'Más peso o baja en 3 segundos.', '3 series', '12 reps', '60 s'] },
         { bw: ['Sentadilla búlgara', 'Pie de atrás apoyado en una silla; baja recto.', '3 series', '8 por pierna', '75 s'], db: ['Sentadilla búlgara con mancuernas', 'Pie de atrás en una silla; una mancuerna en cada mano.', '3 series', '8 por pierna', '75 s'] }],
        [{ bw: ['Puente de glúteos', 'Empuja con los talones; aprieta arriba 1 segundo.', '3 series', '15 reps', '45 s'], band: ['Puente de glúteos con banda', 'Banda sobre las rodillas; empuja hacia afuera mientras subes.', '3 series', '15 reps', '45 s'], db: ['Puente de glúteos con mancuerna', 'Mancuerna sobre la cadera, sujeta con ambas manos.', '3 series', '15 reps', '45 s'] },
         { bw: ['Hip thrust en el sofá', 'Espalda alta apoyada en el sofá; sube hasta que el cuerpo quede recto.', '3 series', '15 reps', '60 s'], db: ['Hip thrust en el sofá con mancuerna', 'Mancuerna sobre la cadera.', '3 series', '12 reps', '60 s'] },
         { bw: ['Hip thrust a una pierna en el sofá', 'Una pierna en el aire; cadera nivelada.', '3 series', '10 por lado', '60 s'], db: ['Hip thrust en el sofá con mancuerna', 'Más peso y pausa de 2 segundos arriba.', '4 series', '10 reps', '60 s'] }],
        [{ bw: ['Peso muerto rumano sin peso', 'Manos en los muslos; lleva la cadera atrás hasta sentir el estiramiento.', '3 series', '12 reps', '45 s'], band: ['Peso muerto rumano con banda', 'Pisa la banda y sujétala con ambas manos.', '3 series', '12 reps', '45 s'], db: ['Peso muerto rumano con mancuernas', 'Mancuernas pegadas a las piernas al bajar.', '3 series', '10 reps', '60 s'] },
         { bw: ['Peso muerto a una pierna con apoyo', 'Una mano en la pared; la pierna de atrás sube mientras bajas.', '3 series', '10 por lado', '45 s'], db: ['Peso muerto rumano con mancuernas', 'Más peso, bajando en 3 segundos.', '3 series', '10 reps', '60 s'] },
         { bw: ['Peso muerto a una pierna', 'Sin apoyo si ya tienes equilibrio; si no, sigue con la mano en la pared.', '3 series', '10 por lado', '45 s'], db: ['Peso muerto a una pierna con mancuerna', 'Mancuerna en la mano contraria a la pierna de apoyo.', '3 series', '10 por lado', '60 s'] }],
        [{ bw: ['Patada lateral acostada', 'De lado, sube la pierna de arriba sin girar la cadera.', '3 series', '15 por lado', '30 s'], band: ['Caminata lateral con banda', 'Banda sobre las rodillas; pasos laterales cortos y controlados.', '3 series', '12 pasos por lado', '30 s'] },
         { bw: ['Almeja (clamshell)', 'De lado, rodillas flexionadas; abre la rodilla de arriba sin mover la cadera.', '3 series', '15 por lado', '30 s'], band: ['Almeja con banda', 'Igual, con la banda sobre las rodillas.', '3 series', '15 por lado', '30 s'] },
         { bw: ['Patada lateral con pausa', 'Mantén 2 segundos arriba.', '3 series', '12 por lado', '30 s'], band: ['Abducción sentada con banda', 'En el borde de una silla, abre las rodillas contra la banda.', '3 series', '20 reps', '30 s'] }],
        [['Zancada hacia atrás', 'Da un paso atrás y baja recto; apóyate en una silla si lo necesitas.', '2 series', '10 por pierna', '60 s'],
         { bw: ['Zancada hacia atrás', 'Sin apoyo, bajando en 2 segundos.', '3 series', '10 por pierna', '60 s'], db: ['Zancada hacia atrás con mancuernas', 'Una mancuerna en cada mano.', '3 series', '10 por pierna', '60 s'] },
         { bw: ['Zancada hacia atrás con pausa', 'Mantén 2 segundos abajo.', '3 series', '10 por pierna', '60 s'], db: ['Zancada hacia atrás con mancuernas', 'Más peso que en la fase 2.', '3 series', '10 por pierna', '75 s'] }]
      ]
    },
    {
      num: 'Día 2', name: 'Tren superior y core', desc: 'Espalda, pecho, hombros y abdomen sin máquinas.', time: '35 min',
      slots: [
        [['Flexiones en la pared', 'Manos en la pared a la altura del pecho; cuerpo recto.', '3 series', '12 reps', '45 s'],
         ['Flexiones inclinadas en el mesón', 'Manos en el borde de un mesón o mesa firme.', '3 series', '10 reps', '60 s'],
         ['Flexiones de rodillas', 'Rodillas en la colchoneta; cuerpo recto de las rodillas a la cabeza.', '3 series', '8–10 reps', '60 s']],
        [{ bw: ['Remo con mochila', 'Llena una mochila con libros; inclínate con la espalda recta y tira hacia la cadera.', '3 series', '12 reps', '60 s'], band: ['Remo con banda', 'Banda anclada en una puerta cerrada o en tus pies; junta las escápulas al tirar.', '3 series', '12 reps', '60 s'], db: ['Remo con mancuernas', 'Torso inclinado y espalda recta; lleva los codos hacia atrás.', '3 series', '12 reps', '60 s'] },
         { bw: ['Remo con mochila a una mano', 'Mano libre apoyada en una silla.', '3 series', '10 por lado', '45 s'], band: ['Remo con banda con pausa', 'Mantén 2 segundos atrás.', '3 series', '12 reps', '60 s'], db: ['Remo con mancuerna a una mano', 'Mano libre en una silla; codo hacia la cadera.', '3 series', '10 por lado', '45 s'] },
         { bw: ['Remo con mochila a una mano', 'Más carga en la mochila; baja en 3 segundos.', '3 series', '12 por lado', '45 s'], band: ['Remo con banda a una mano', 'Un brazo a la vez, con más tensión.', '3 series', '12 por lado', '45 s'], db: ['Remo con mancuerna a una mano', 'Más peso que en la fase 2.', '3 series', '10 por lado', '60 s'] }],
        [{ bw: ['Elevaciones en Y boca abajo', 'Acostado boca abajo, sube los brazos en forma de Y con los pulgares arriba.', '3 series', '12 reps', '45 s'], band: ['Press de hombros con banda', 'Pisa la banda y empuja hacia arriba sin arquear la espalda.', '3 series', '12 reps', '45 s'], db: ['Press de hombros con mancuernas', 'Sentado en una silla, espalda recta.', '3 series', '10 reps', '60 s'] },
         { bw: ['Elevaciones Y-T boca abajo', 'Alterna brazos en Y y en T, con pausa arriba.', '3 series', '10 de cada', '45 s'], band: ['Elevaciones laterales con banda', 'Pisa la banda; sube hasta la altura de los hombros.', '3 series', '12 reps', '45 s'], db: ['Elevaciones laterales con mancuernas', 'Sube hasta la altura de los hombros, codos apenas flexionados.', '3 series', '12 reps', '45 s'] },
         { bw: ['Flexión pike apoyada en una silla', 'Manos en una silla firme contra la pared, cadera alta; baja la cabeza hacia el borde.', '3 series', '6–8 reps', '60 s'], band: ['Press de hombros con banda', 'Más tensión: pisa la banda más corta.', '3 series', '10 reps', '60 s'], db: ['Press de hombros con mancuernas', 'Más peso que en la fase 1.', '3 series', '8–10 reps', '60 s'] }],
        [{ bw: ['Superman', 'Boca abajo, sube brazos y piernas a la vez; mira al suelo.', '3 series', '12 reps', '45 s'], band: ['Jalón con banda', 'Banda sobre la cabeza con brazos estirados; ábrela llevando los codos hacia abajo.', '3 series', '12 reps', '45 s'] },
         { bw: ['Superman con pausa', 'Mantén 3 segundos arriba.', '3 series', '10 reps', '45 s'], band: ['Jalón con banda', 'Toma la banda más corta para más tensión.', '3 series', '12 reps', '45 s'] },
         { bw: ['Nado boca abajo', 'Boca abajo, alterna brazos y piernas como si nadaras, sin tocar el suelo.', '3 series', '30 s', '45 s'], band: ['Face pull con banda', 'Banda anclada a la altura de la cara; tira hacia ti abriendo los codos.', '3 series', '12 reps', '45 s'] }],
        [['Plancha frontal', 'Puedes empezar con las rodillas apoyadas; cuerpo en línea.', '3 series', '20–30 s', '45 s'],
         ['Plancha frontal', 'Sube el tiempo manteniendo la cadera alineada.', '3 series', '30–40 s', '45 s'],
         ['Plancha con toque de hombro', 'Pies separados; toca el hombro contrario sin girar la cadera.', '3 series', '10 por lado', '45 s']],
        [['Dead bug', 'Espalda baja pegada al suelo; extiende brazo y pierna contrarios.', '3 series', '10 por lado', '45 s'],
         ['Bird dog', 'En cuatro apoyos, extiende brazo y pierna contrarios sin mover la espalda.', '3 series', '10 por lado', '45 s'],
         ['Dead bug con piernas más estiradas', 'Mientras más estiras la pierna, más difícil.', '3 series', '10 por lado', '45 s']]
      ]
    },
    {
      num: 'Día 3', name: 'Full body ligero y cardio', desc: 'Todo el cuerpo y cardio, sin salir de casa.', time: '45 min',
      slots: [
        [['Subida a un escalón', 'Usa un escalón o banco firme; sube empujando con la pierna de arriba.', '2 series', '10 por pierna', '60 s'],
         { bw: ['Subida a un escalón', 'Un escalón más alto o más lento.', '3 series', '10 por pierna', '60 s'], db: ['Subida a un escalón con mancuernas', 'Una mancuerna en cada mano.', '3 series', '10 por pierna', '60 s'] },
         { bw: ['Subida a un escalón con rodilla arriba', 'Al subir, eleva la otra rodilla y mantén 1 segundo.', '3 series', '10 por pierna', '60 s'], db: ['Subida a un escalón con mancuernas', 'Más peso que en la fase 2.', '3 series', '10 por pierna', '75 s'] }],
        [['Flexiones en la pared', 'Cuerpo recto; baja controlando.', '2 series', '12 reps', '45 s'],
         ['Flexiones inclinadas en el mesón', 'Igual que el día 2.', '3 series', '10 reps', '45 s'],
         ['Flexiones inclinadas en una silla firme', 'Silla apoyada contra la pared para que no se mueva.', '3 series', '8–10 reps', '60 s']],
        [{ bw: ['Remo con mochila', 'Espalda recta; tira hacia la cadera.', '2 series', '12 reps', '45 s'], band: ['Remo con banda', 'Junta las escápulas al tirar.', '2 series', '12 reps', '45 s'], db: ['Remo con mancuernas', 'Torso inclinado, espalda recta.', '2 series', '12 reps', '45 s'] },
         { bw: ['Remo con mochila', 'Más carga que en la fase 1.', '3 series', '12 reps', '45 s'], band: ['Remo con banda', 'Más tensión que en la fase 1.', '3 series', '12 reps', '45 s'], db: ['Remo con mancuernas', 'Más peso que en la fase 1.', '3 series', '12 reps', '45 s'] },
         { bw: ['Remo con mochila', 'Baja en 3 segundos.', '3 series', '10 reps', '60 s'], band: ['Remo con banda', 'Pausa de 2 segundos atrás.', '3 series', '12 reps', '60 s'], db: ['Remo con mancuernas', 'Más peso; pausa arriba.', '3 series', '10 reps', '60 s'] }],
        [['Puente de glúteos', 'Pausa arriba en cada repetición.', '2 series', '15 reps', '45 s'],
         ['Puente de glúteos a una pierna', 'Cadera nivelada.', '3 series', '10 por lado', '45 s'],
         ['Puente a una pierna con pausa', 'Mantén 2 segundos arriba.', '3 series', '12 por lado', '45 s']],
        [['Caminata rápida o trote suave', 'Afuera o en el lugar; ritmo en el que puedas conversar.', '1 bloque', '20 min', '—'],
         ['Caminata rápida o trote suave', 'Mismo ritmo, un poco más de tiempo.', '1 bloque', '25 min', '—'],
         ['Intervalos de marcha en el lugar', 'Alterna 1 minuto rápido subiendo las rodillas y 2 minutos suave.', '1 bloque', '25 min', '—']]
      ]
    }
  ];
  // Versión en casa de los ejercicios extra de cada objetivo
  const HOME_SWAP = {
    'Cardio final: caminata inclinada o bici': ['Cardio final: marcha rápida o trote suave', 'Ritmo moderado, en el que puedas hablar con algo de esfuerzo.', '1 bloque', '15 min', '—'],
    'Patada de glúteo en polea': { bw: ['Patada de glúteo en cuatro apoyos', 'Rodilla flexionada; empuja el talón hacia el techo sin arquear la espalda.', '3 series', '15 por lado', '45 s'], band: ['Patada de glúteo con banda', 'En cuatro apoyos, con la banda alrededor de los pies.', '3 series', '12 por lado', '45 s'] },
    'Abducción con banda, sentada': { bw: ['Almeja (clamshell) extra', 'De lado, abre la rodilla de arriba sin mover la cadera.', '2 series', '20 por lado', '30 s'], band: ['Abducción con banda, sentada', 'Banda sobre las rodillas; abre y cierra con control.', '2 series', '20 reps', '30 s'] },
    'Hip thrust ligero': { bw: ['Puente de glúteos con pausa larga', 'Mantén 3 segundos arriba.', '3 series', '12 reps', '45 s'], db: ['Puente con mancuerna', 'Mancuerna sobre la cadera.', '3 series', '12 reps', '45 s'] },
    'Pallof press en polea': { bw: ['Plancha con toque de hombro', 'Pies separados; toca el hombro contrario sin girar la cadera.', '3 series', '8 por lado', '45 s'], band: ['Pallof press con banda', 'Banda anclada a un lado; empuja al frente sin dejar que te gire.', '3 series', '10 por lado', '45 s'] },
    'Press de pecho en máquina': { bw: ['Flexiones de rodillas', 'Cuerpo recto de las rodillas a la cabeza; baja controlando.', '3 series', '10 reps', '60 s'], band: ['Press de pecho con banda', 'Banda por detrás de la espalda; empuja al frente sin encoger los hombros.', '3 series', '12 reps', '60 s'], db: ['Press de pecho con mancuernas en el suelo', 'Acostado en el suelo; baja hasta que los codos toquen.', '3 series', '10 reps', '60 s'] },
    'Sentadilla goblet': { bw: ['Sentadilla con pausa abajo', 'Mantén 2 segundos abajo antes de subir.', '3 series', '12 reps', '60 s'], db: ['Sentadilla goblet con mancuerna', 'Mancuerna en el pecho; baja como si te sentaras.', '3 series', '10 reps', '60 s'] },
    'Curl de bíceps con mancuernas': { bw: ['Curl de bíceps con mochila', 'Sujeta la mochila por las asas; codos pegados al cuerpo.', '2 series', '12 reps', '45 s'], band: ['Curl de bíceps con banda', 'Pisa la banda; codos pegados al cuerpo.', '2 series', '12 reps', '45 s'], db: ['Curl de bíceps con mancuernas', 'Codos pegados al cuerpo; sube y baja lento.', '2 series', '12 reps', '45 s'] },
    'Extensión de tríceps en polea': { bw: ['Fondos de tríceps en una silla', 'Silla firme contra la pared; baja doblando los codos hacia atrás.', '2 series', '10 reps', '45 s'], band: ['Extensión de tríceps con banda', 'Banda anclada arriba o pisada; codos fijos.', '2 series', '12 reps', '45 s'], db: ['Extensión de tríceps con mancuerna', 'Por detrás de la cabeza, con ambas manos.', '2 series', '12 reps', '45 s'] }
  };

  const CARDIO = ['Cardio final: caminata inclinada o bici', 'Ritmo moderado, en el que puedas hablar con algo de esfuerzo.', '1 bloque', '15 min', '—'];
  const GOALS = {
    bajar: {
      emoji: '🔥', label: 'Bajar de peso',
      summary: 'Fuerza para mantener tu músculo y un poco más de cardio para sumar gasto de energía.',
      points: ['Sumamos cardio al final del día 1 y del día 2.', 'Apunta a caminar unos 7.000–8.000 pasos al día.', 'Evita las dietas extremas: porciones normales con proteína y verduras en cada comida.'],
      extras: { 0: [CARDIO], 1: [CARDIO] }
    },
    gluteos: {
      emoji: '💪', label: 'Ganar músculo',
      summary: 'Más volumen repartido en la semana y peso que sube de a poco: así crece el músculo.',
      points: ['Sumamos press de pecho (día 1), sentadilla extra (día 2) y bíceps (día 3).', 'Sube el peso de a poco: el músculo crece cuando el reto aumenta.', 'Come suficiente proteína y duerme bien: ahí es cuando creces.'],
      extras: {
        0: [['Press de pecho en máquina', 'Codos un poco por debajo de los hombros; empuja controlado.', '3 series', '10 reps', '75 s']],
        1: [['Sentadilla goblet', 'Volumen extra para piernas: peso moderado y técnica limpia.', '3 series', '10 reps', '75 s']],
        2: [['Curl de bíceps con mancuernas', 'Codos pegados al cuerpo; sube y baja lento.', '3 series', '10 reps', '60 s']]
      }
    },
    cintura: {
      emoji: '🎯', label: 'Abdomen marcado',
      summary: 'Ningún ejercicio quema grasa de una sola zona; el abdomen se marca con un core fuerte, cardio y buena alimentación.',
      points: ['Sumamos un ejercicio de core extra (día 1), cardio (día 2) y plancha lateral (día 3).', 'Para que se note el abdomen, la clave es bajar grasa: come bien y duerme lo suficiente.'],
      extras: {
        0: [['Pallof press en polea', 'De lado a la polea, empuja el agarre al frente sin dejar que te gire.', '3 series', '10 por lado', '45 s']],
        1: [CARDIO],
        2: [['Plancha lateral', 'Cadera alta y cuerpo en línea. Puedes apoyar las rodillas.', '3 series', '20 s por lado', '30 s']]
      }
    },
    tonificar: {
      emoji: '🦾', label: 'Brazos y pecho',
      summary: 'Más trabajo para brazos y tren superior, sin descuidar el resto del cuerpo.',
      points: ['Sumamos bíceps (día 2) y tríceps (día 3).', 'En tus días libres, una caminata de 20–30 minutos suma mucho.'],
      extras: {
        1: [['Curl de bíceps con mancuernas', 'Codos pegados al cuerpo; sube y baja lento.', '2 series', '12 reps', '45 s']],
        2: [['Extensión de tríceps en polea', 'Codos fijos a los lados; estira el brazo completo.', '2 series', '12 reps', '45 s']]
      }
    },
    energia: {
      emoji: '🔋', label: 'Más energía',
      summary: 'Que disfrutes entrenar y salgas sintiéndote mejor de lo que llegaste.',
      points: ['Sumamos 5 minutos de movilidad al final del día 3.', 'Si un día llegas muy cansado, haz una sesión más corta, pero ve.'],
      extras: { 2: [['Movilidad suave en colchoneta', 'Gato-vaca, rotaciones de columna y postura del niño, respirando lento.', '1 bloque', '5 min', '—']] }
    },
    nose: {
      emoji: '🤔', label: 'Todavía no lo sé',
      summary: 'Empezar sin presión es una gran forma de descubrir qué te gusta.',
      points: ['Sigue la rutina base, que trabaja todo el cuerpo.', 'Al terminar la fase 1 (semana 4), vuelve aquí y elige tus objetivos.'],
      extras: {}
    }
  };
  const MAX_GOALS = 3, MAX_EXTRAS = 3;

  // ---------- Con experiencia: rutina recomendada o la propia ----------
  // [consejo, rol]: main = básicos pesados, acc = complementarios, core = abdomen
  const EXLIB = {
    'Press de banca con barra': ['Escápulas juntas y pies firmes; baja la barra a la mitad del pecho con control.', 'main'],
    'Remo con barra': ['Torso inclinado unos 45°, espalda neutra; lleva la barra al ombligo.', 'main'],
    'Press de hombros con mancuernas, sentado': ['Espalda apoyada; sube sin arquear la zona lumbar.', 'main'],
    'Jalón al pecho en polea': ['Barra a la parte alta del pecho, codos hacia abajo; sin balancearte.', 'acc'],
    'Curl de bíceps con barra': ['Codos pegados al cuerpo; sin balancear el torso.', 'acc'],
    'Curl de bíceps con mancuernas': ['Codos pegados al cuerpo; sube y baja lento.', 'acc'],
    'Extensión de tríceps en polea': ['Codos fijos a los lados; estira el brazo completo.', 'acc'],
    'Sentadilla con barra': ['Barra en la espalda alta; baja hasta la paralela o lo que tu movilidad permita, con la espalda neutra.', 'main'],
    'Peso muerto rumano con barra': ['Rodillas apenas flexionadas; cadera atrás y barra pegada a las piernas.', 'main'],
    'Prensa de piernas': ['Pies al ancho de caderas; no bloquees las rodillas al estirar.', 'acc'],
    'Curl femoral en máquina': ['Movimiento controlado; baja lento en 2 segundos.', 'acc'],
    'Elevación de talones (pantorrilla)': ['Sube lo más alto que puedas, pausa y baja hasta estirar.', 'acc'],
    'Plancha frontal': ['Cuerpo en línea recta; aprieta abdomen y glúteos.', 'core'],
    'Press inclinado con mancuernas': ['Banco a unos 30°; baja las mancuernas a la altura del pecho.', 'main'],
    'Dominadas (o asistidas en máquina)': ['Agarre algo más ancho que los hombros; sube hasta pasar la barbilla.', 'main'],
    'Remo sentado en polea': ['Pecho alto; junta las escápulas al tirar hacia el ombligo.', 'acc'],
    'Elevaciones laterales con mancuernas': ['Sube hasta la altura de los hombros, codos apenas flexionados.', 'acc'],
    'Fondos en paralelas (o asistidos)': ['Torso un poco inclinado; baja hasta que los codos queden a 90°.', 'acc'],
    'Curl martillo con mancuernas': ['Palmas mirándose; sube sin mover los codos.', 'acc'],
    'Peso muerto convencional': ['Barra sobre la mitad del pie, espalda neutra; empuja el suelo con las piernas.', 'main'],
    'Sentadilla búlgara con mancuernas': ['Pie de atrás en el banco; baja recto, controlando.', 'acc'],
    'Hip thrust con barra': ['Espalda alta en el banco; aprieta los glúteos arriba 1 segundo.', 'acc'],
    'Extensión de cuádriceps en máquina': ['Estira la pierna sin bloquear la rodilla y baja lento.', 'acc'],
    'Rueda abdominal': ['Desde rodillas; avanza solo hasta donde mantengas la espalda baja neutra.', 'core'],
    'Zancada con mancuernas': ['Paso largo; baja recto con el torso erguido.', 'acc'],
    'Face pull en polea': ['Polea a la altura de la cara; tira abriendo los codos.', 'acc'],
    'Aperturas en máquina (pec deck)': ['Codos apenas flexionados; junta las manos al frente con control.', 'acc'],
    'Encogimientos con mancuernas': ['Sube los hombros hacia las orejas, pausa y baja lento.', 'acc']
  };
  const TPL = {
    torsoA: ['Press de banca con barra', 'Remo con barra', 'Press de hombros con mancuernas, sentado', 'Jalón al pecho en polea', 'Curl de bíceps con barra', 'Extensión de tríceps en polea'],
    piernaA: ['Sentadilla con barra', 'Peso muerto rumano con barra', 'Prensa de piernas', 'Curl femoral en máquina', 'Elevación de talones (pantorrilla)', 'Plancha frontal'],
    torsoB: ['Press inclinado con mancuernas', 'Dominadas (o asistidas en máquina)', 'Remo sentado en polea', 'Elevaciones laterales con mancuernas', 'Fondos en paralelas (o asistidos)', 'Curl martillo con mancuernas'],
    piernaB: ['Peso muerto convencional', 'Sentadilla búlgara con mancuernas', 'Hip thrust con barra', 'Extensión de cuádriceps en máquina', 'Elevación de talones (pantorrilla)', 'Rueda abdominal'],
    fullA: ['Sentadilla con barra', 'Press de banca con barra', 'Remo con barra', 'Curl femoral en máquina', 'Plancha frontal'],
    fullB: ['Peso muerto convencional', 'Press de hombros con mancuernas, sentado', 'Jalón al pecho en polea', 'Zancada con mancuernas', 'Rueda abdominal'],
    fullC: ['Prensa de piernas', 'Press inclinado con mancuernas', 'Remo sentado en polea', 'Elevaciones laterales con mancuernas', 'Curl de bíceps con barra', 'Extensión de tríceps en polea'],
    empuje: ['Press de banca con barra', 'Press de hombros con mancuernas, sentado', 'Press inclinado con mancuernas', 'Elevaciones laterales con mancuernas', 'Extensión de tríceps en polea', 'Fondos en paralelas (o asistidos)'],
    tiron: ['Peso muerto convencional', 'Dominadas (o asistidas en máquina)', 'Remo con barra', 'Face pull en polea', 'Curl de bíceps con barra', 'Curl martillo con mancuernas'],
    pechoEspalda: ['Press de banca con barra', 'Remo con barra', 'Press inclinado con mancuernas', 'Dominadas (o asistidas en máquina)', 'Aperturas en máquina (pec deck)', 'Remo sentado en polea'],
    hombroBrazo: ['Press de hombros con mancuernas, sentado', 'Elevaciones laterales con mancuernas', 'Curl de bíceps con barra', 'Extensión de tríceps en polea', 'Curl martillo con mancuernas', 'Face pull en polea'],
    tironB: ['Remo con barra', 'Jalón al pecho en polea', 'Remo sentado en polea', 'Face pull en polea', 'Curl de bíceps con mancuernas', 'Encogimientos con mancuernas'],
    pierna: ['Sentadilla con barra', 'Peso muerto rumano con barra', 'Prensa de piernas', 'Curl femoral en máquina', 'Elevación de talones (pantorrilla)', 'Rueda abdominal'],
    pecho: ['Press de banca con barra', 'Press inclinado con mancuernas', 'Aperturas en máquina (pec deck)', 'Fondos en paralelas (o asistidos)', 'Extensión de tríceps en polea'],
    espalda: ['Dominadas (o asistidas en máquina)', 'Remo con barra', 'Jalón al pecho en polea', 'Remo sentado en polea', 'Curl de bíceps con barra'],
    hombro: ['Press de hombros con mancuernas, sentado', 'Elevaciones laterales con mancuernas', 'Face pull en polea', 'Encogimientos con mancuernas', 'Plancha frontal'],
    brazos: ['Curl de bíceps con barra', 'Extensión de tríceps en polea', 'Curl martillo con mancuernas', 'Fondos en paralelas (o asistidos)', 'Curl de bíceps con mancuernas']
  };
  // [nombre, descripción, tipo] — el tipo decide qué extras de tus objetivos se suman ese día
  const DAYN = {
    torsoA: ['Torso A', 'Pecho, espalda, hombros y brazos, con los básicos pesados.', 'up'], torsoB: ['Torso B', 'Pecho, espalda y hombros desde otros ángulos.', 'up'],
    piernaA: ['Pierna A', 'Cuádriceps, femorales y core, empezando por la sentadilla.', 'low'], piernaB: ['Pierna B', 'Cadena posterior y glúteos, empezando por el peso muerto.', 'low'],
    fullA: ['Cuerpo completo A', 'Sentadilla, press de banca y remo.', 'full'], fullB: ['Cuerpo completo B', 'Peso muerto, press de hombros y jalón.', 'full'], fullC: ['Cuerpo completo C', 'Prensa, press inclinado, remo y brazos.', 'full'],
    empuje: ['Empuje', 'Pecho, hombros y tríceps.', 'up'], tiron: ['Tirón', 'Espalda, bíceps y parte de atrás del hombro.', 'up'], tironB: ['Tirón B', 'Espalda y bíceps, sin peso muerto.', 'up'],
    pierna: ['Pierna', 'Cuádriceps, femorales, pantorrillas y core.', 'low'],
    pechoEspalda: ['Pecho y espalda', 'Pecho y espalda en la misma sesión, alternando.', 'up'], hombroBrazo: ['Hombros y brazos', 'Hombros, bíceps y tríceps.', 'up'],
    pecho: ['Pecho', 'Pecho y tríceps.', 'up'], espalda: ['Espalda', 'Espalda y bíceps.', 'up'], hombro: ['Hombros', 'Hombros y core.', 'up'], brazos: ['Brazos', 'Bíceps y tríceps.', 'up']
  };
  const EXTRA_OF = { low: 0, up: 1, full: 2 };
  const REC_SPLIT = { 1: ['fullA'], 2: ['fullA', 'fullB'], 3: ['fullA', 'fullB', 'fullC'], 4: ['torsoA', 'piernaA', 'torsoB', 'piernaB'], 5: ['torsoA', 'piernaA', 'empuje', 'tiron', 'pierna'], 6: ['empuje', 'tiron', 'pierna', 'empuje', 'tironB', 'piernaB'] };
  const REC_TXT = { 1: 'cuerpo completo', 2: 'cuerpo completo A/B', 3: 'cuerpo completo A/B/C', 4: 'torso / pierna, 2 veces cada uno', 5: 'torso / pierna + empuje / tirón / pierna', 6: 'empuje / tirón / pierna, 2 veces' };
  const MINE_CYCLE = { full: ['fullA', 'fullB', 'fullC'], tp: ['torsoA', 'piernaA', 'torsoB', 'piernaB'], ppl: ['empuje', 'tiron', 'pierna'], weider: ['pecho', 'espalda', 'pierna', 'hombro', 'brazos'] };
  const SPLIT_TXT = { full: 'cuerpo completo', tp: 'torso y pierna', ppl: 'empuje, tirón y pierna', weider: 'un grupo muscular por día', otro: 'sin un plan fijo' };
  const EXP_PHASES = [
    { weeks: 'Semanas 1 a 4', title: 'Fase 1: Volumen', desc: 'Más repeticiones (8 a 12) con cargas medias para sumar trabajo. Termina cada serie con 1 a 2 reps en reserva.' },
    { weeks: 'Semanas 5 a 8', title: 'Fase 2: Fuerza', desc: 'Menos repeticiones (5 a 6) y más peso en los básicos. Descansa 2 a 3 minutos entre series pesadas.' },
    { weeks: 'Semanas 9 a 12', title: 'Fase 3: Intensificación', desc: 'Series pesadas de 3 a 6 reps en los básicos. Al terminar, haz una semana más liviana (descarga) y repite el ciclo con más peso.' }
  ];
  const MINE_PHASE = { weeks: 'Semanas 1 a 12', title: 'Tu rutina: a tu manera', desc: 'Sigues tu propia rutina. Anota tus pesos: cuando logres todas las reps 2 veces seguidas, la app te avisa que subas.' };
  function phs() { const pg = progOf(); return pg === 'exp' ? EXP_PHASES : pg === 'mine' ? [MINE_PHASE, MINE_PHASE, MINE_PHASE] : BASE_PHASES; }
  // base = programa de 12 semanas (principiantes) · exp = recomendada para quien ya entrena · mine = su propia rutina
  // Opciones de rutina para quienes ya entrenan. La primera de cada lista es la recomendada.
  // [id, días, cuántas veces por semana se entrena cada músculo]
  const OPTS = {
    fb: ['Cuerpo completo', 'Todo el cuerpo en cada sesión. Ideal si a veces faltas: ningún músculo queda sin entrenar.'],
    tp: ['Torso / Pierna', 'Separa arriba y abajo: sesiones más enfocadas y buena recuperación entre días.'],
    tpf: ['Torso / Pierna / Cuerpo completo', 'Dos días enfocados y uno completo: buen equilibrio con 3 días.'],
    ppl: ['Empuje / Tirón / Pierna', 'Cada día junta músculos que trabajan juntos. Clásico para ganar músculo.'],
    pplf: ['Empuje / Tirón / Pierna + Cuerpo completo', 'El clásico de 3 días más un día completo para repetir los básicos.'],
    tpppl: ['Torso / Pierna + Empuje / Tirón / Pierna', 'Combina dos formas de dividir: mucha variedad y cada músculo 2 veces.'],
    tpfb: ['Torso / Pierna ×2 + Cuerpo completo', 'Torso/pierna dos veces y un día completo más liviano.'],
    weider: ['Un grupo muscular por día', 'Mucho trabajo por músculo en cada sesión, pero cada uno se entrena solo 1 vez por semana.'],
    arnold: ['Pecho-espalda / Hombros-brazos / Pierna', 'La división de Arnold: mucho volumen. Mejor si llevas más de 1 año.']
  };
  const OPTS_BY_F = {
    1: [['fb', ['fullA'], '1 vez']],
    2: [['fb', ['fullA', 'fullB'], '2 veces'], ['tp', ['torsoA', 'piernaA'], '1 vez']],
    3: [['fb', ['fullA', 'fullB', 'fullC'], '3 veces'], ['tpf', ['torsoA', 'piernaA', 'fullC'], '2 veces'], ['ppl', ['empuje', 'tiron', 'pierna'], '1 vez']],
    4: [['tp', ['torsoA', 'piernaA', 'torsoB', 'piernaB'], '2 veces'], ['fb', ['fullA', 'fullB', 'fullC', 'fullA'], '4 veces'], ['pplf', ['empuje', 'tiron', 'pierna', 'fullC'], '2 veces'], ['weider', ['pecho', 'espalda', 'pierna', 'hombroBrazo'], '1 vez']],
    5: [['tpppl', ['torsoA', 'piernaA', 'empuje', 'tiron', 'pierna'], '2 veces'], ['tpfb', ['torsoA', 'piernaA', 'torsoB', 'piernaB', 'fullC'], '2 a 3 veces'], ['weider', ['pecho', 'espalda', 'pierna', 'hombro', 'brazos'], '1 vez']],
    6: [['ppl', ['empuje', 'tiron', 'pierna', 'empuje', 'tironB', 'piernaB'], '2 veces'], ['tp', ['torsoA', 'piernaA', 'torsoB', 'piernaB', 'torsoA', 'piernaA'], '3 veces'], ['arnold', ['pechoEspalda', 'hombroBrazo', 'pierna', 'pechoEspalda', 'hombroBrazo', 'piernaB'], '2 veces']]
  };
  const optsFor = () => OPTS_BY_F[freqOf()] || OPTS_BY_F[3];
  // Rutina elegida: 'base' (programa de 12 semanas), 'mine' (la propia) o el id de una opción
  function choiceNow() {
    if (!profile || profile.exp === 'nunca' || !profile.expTime) return 'base';
    let c = profile.routineChoice;
    if (!c || c === 'rec') c = profile.expTime === 'lt6' ? 'base' : optsFor()[0][0];
    if (c !== 'base' && c !== 'mine' && !optsFor().some(o => o[0] === c)) c = optsFor()[0][0];
    return c;
  }
  function choiceName(c) { c = c || choiceNow(); return c === 'base' ? 'Programa de 12 semanas' : c === 'mine' ? 'Mi propia rutina' : (OPTS[c] || ['Rutina'])[0]; }
  function progOf() { const c = choiceNow(); return c === 'base' || c === 'mine' ? c : 'exp'; }
  // Con algo de experiencia en el programa base, se salta la fase de técnica
  const skipW = () => (profile && profile.exp !== 'nunca' && profile.expTime && progOf() === 'base' ? 4 : 0);
  function scheme(role, p, lvl, name) {
    if (role === 'core') return ['3 series', /^plancha/i.test(name) ? ['30–45 s', '45 s', '45–60 s'][p] : ['10 reps', '12 reps', '12–15 reps'][p], '60 s'];
    if (role === 'main') return [['4 series', '8–10 reps', '2 min'], ['4 series', '5–6 reps', '2–3 min'], [lvl === 'gt12' ? '5 series' : '4 series', lvl === 'gt12' ? '3–5 reps' : '4–6 reps', '3 min']][p];
    return [['3 series', '12 reps', '75 s'], ['3 series', '10 reps', '90 s'], ['3 series', '8–10 reps', '90 s']][p];
  }
  function mkEx(name, p, lvl, mine) {
    const L = EXLIB[name] || ['', 'acc'];
    const s = mine ? (L[1] === 'main' ? ['4 series', '8 reps', '2 min'] : L[1] === 'core' ? scheme('core', 0, lvl, name) : ['3 series', '10–12 reps', '75 s']) : scheme(L[1], p, lvl, name);
    return { name, tip: L[0], series: s[0], reps: s[1], rest: s[2] };
  }
  const estTime = ex => { const m = ex.reduce((a, e) => a + (EXLIB[e.name] && EXLIB[e.name][1] === 'main' ? 12 : 8), 5); return (Math.round(m / 5) * 5) + ' min'; };
  function expDays() {
    const p = phaseOf(week), lvl = profile.expTime;
    const o = optsFor().find(x => x[0] === choiceNow()) || optsFor()[0];
    return o[1].map((k, n) => {
      const ex = TPL[k].map(x => mkEx(x, p, lvl));
      return { num: 'Día ' + (n + 1), name: DAYN[k][0], desc: DAYN[k][1], time: estTime(ex), fixed: ex, extras: [EXTRA_OF[DAYN[k][2]]] };
    });
  }
  const cleanTxt = (s, n) => String(s || '').replace(/[<>"'`&\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  function mineRoutine() {
    const f = freqOf(), sp = (profile && profile.split) || 'otro';
    let r = store.get('myRoutine');
    if (!r || r.freq !== f || r.split !== sp || !Array.isArray(r.days) || r.days.length !== f) {
      const cyc = MINE_CYCLE[sp];
      const keys = cyc ? Array.from({ length: f }, (_, i) => cyc[i % cyc.length]) : REC_SPLIT[f];
      r = { split: sp, freq: f, days: keys.map(k => ({ name: DAYN[k][0], key: k, ex: TPL[k].map(x => mkEx(x, 0, '', true)) })) };
      store.set('myRoutine', r);
    }
    // Datos guardados: se limpian por si el respaldo fue editado a mano
    r.days.forEach(d => { d.name = cleanTxt(d.name, 30) || 'Mi día'; d.ex = (Array.isArray(d.ex) ? d.ex : []).slice(0, 15).map(e => ({ name: cleanTxt(e.name, 60) || 'Ejercicio', tip: cleanTxt(e.tip, 160), series: cleanTxt(e.series, 12) || '3 series', reps: cleanTxt(e.reps, 14) || '10 reps', rest: cleanTxt(e.rest, 10) || '75 s' })); });
    return r;
  }
  function mineDays() {
    return mineRoutine().days.map((d, n) => ({ num: 'Día ' + (n + 1), name: d.name, desc: 'Tu propia rutina. Toca ✏️ Editar para cambiar ejercicios.', time: estTime(d.ex), fixed: d.ex, extras: [], mine: n }));
  }
  function adviceFor(sp, f) {
    if (sp === 'weider') return 'Hoy entrenas cada músculo 1 vez por semana. Con 2 veces por semana, como en la recomendada, se suele ganar más músculo con el mismo tiempo.';
    if (sp === 'otro') return 'Entrenar sin un plan fijo hace difícil progresar. Seguir una rutina y anotar tus pesos es lo que más se nota.';
    if (sp === 'full' && f >= 5) return 'Cuerpo completo 5 o más días deja poco descanso a cada músculo. Dividir el cuerpo te deja recuperar mejor.';
    if (sp === 'ppl' && f <= 3) return `Con ${f} día${f > 1 ? 's' : ''}, empuje/tirón/pierna entrena cada músculo 1 vez por semana. Cuerpo completo te da el doble de estímulo.`;
    if (sp === 'tp' && f <= 3) return `Con ${f} día${f > 1 ? 's' : ''}, torso/pierna queda corto o desbalanceado. Cuerpo completo reparte mejor el trabajo.`;
    return 'Tu forma de entrenar calza bien con tus días. 👍 La recomendada suma progresión por fases y pesos sugeridos.';
  }
  function expBlock() {
    if (!profile || profile.exp === 'nunca' || !profile.expTime) return '';
    const f = freqOf(), cur = choiceNow(), lvl = profile.expTime;
    const L = profile.lifts || {}, nL = Object.values(L).filter(v => v > 0).length;
    const names = keys => keys.map(k => DAYN[k][0]);
    const exList = (title, list) => `<p class="opt-day"><b>${title}:</b> ${list.join(', ')}</p>`;
    // Lista de opciones: id, nombre, explicación, días, frecuencia, detalle de ejercicios
    const items = optsFor().map(([id, keys, per]) => ({ id, name: OPTS[id][0], why: OPTS[id][1], days: names(keys), per,
      detail: [...new Set(keys)].map(k => exList(DAYN[k][0], TPL[k])).join(''), note: 'Fases de 4 semanas: volumen, fuerza e intensificación.' }));
    const bd = baseDays('gym');
    const baseItem = { id: 'base', name: 'Programa de 12 semanas (desde la fase 2)', why: 'Rutina guiada que cambia sus ejercicios cada 4 semanas. Buena si llevas poco tiempo o vuelves después de una pausa.',
      days: bd.map(d => d.name), per: f >= 2 ? '2 veces o más' : '1 vez', detail: bd.map(d => exList(d.name, d.slots.map(s => pickV(s[1])[0]))).join(''), note: 'Parte en la fase de fuerza: te saltas la de técnica.' };
    const md = mineRoutine();
    const mineItem = { id: 'mine', name: 'Mi propia rutina', why: `Partimos con tu forma de entrenar (${SPLIT_TXT[profile.split] || SPLIT_TXT.otro}) y la cambias a tu gusto en Rutina → ✏️ Editar.`,
      days: md.days.map(d => d.name), per: '—', detail: md.days.map(d => exList(d.name, d.ex.map(e => e.name))).join(''), note: 'La app registra tus pesos y te avisa cuándo subir.' };
    const list = (lvl === 'lt6' ? [baseItem, ...items] : [...items, baseItem]).concat(mineItem);
    const recId = list[0].id;
    return `<div class="exp-block" id="rutOpts"><h4>🏋️ Elige tu rutina</h4>
      <p>Hoy entrenas con <b>${SPLIT_TXT[profile.split] || SPLIT_TXT.otro}</b>, ${f} día${f > 1 ? 's' : ''} por semana.</p>
      <p class="exp-tip">💡 ${adviceFor(profile.split, f)}</p>
      ${nL ? `<p>🎯 Con tus ${nL} peso${nL > 1 ? 's' : ''} de referencia te sugerimos con cuánto partir en cada opción.</p>` : ''}
      <div class="opt-list">${list.map(o => `
        <div class="opt${o.id === cur ? ' on' : ''}">
          <div class="opt-head"><b>${o.name}</b>${o.id === recId ? '<span class="goal-tag">⭐ Recomendada</span>' : ''}</div>
          <p>${o.why}</p>
          <p class="opt-meta">📅 ${o.days.join(' · ')}${o.per !== '—' ? `<br>🔁 Cada músculo: ${o.per} por semana` : ''}<br>📈 ${o.note}</p>
          <details class="plan-more"><summary>Ver ejercicios</summary>${o.detail}</details>
          <button type="button" class="choice-btn" data-choice="${o.id}" aria-pressed="${o.id === cur}">${o.id === cur ? '✓ Tu rutina actual' : 'Elegir esta'}</button>
        </div>`).join('')}
      </div>
    </div>`;
  }
  // Pesos de referencia del perfil → peso sugerido la primera vez
  const LIFT_OF = [[/^sentadilla con barra|^sentadilla en máquina smith/i, 'sq', 1], [/^press de banca/i, 'bp', 1], [/^remo con barra/i, 'row', 1], [/^peso muerto convencional/i, 'dl', 1], [/^peso muerto rumano con barra/i, 'dl', .7], [/^press de hombros con mancuernas/i, 'ohp', 1]];
  function seedKg(name) {
    const L = profile && profile.exp !== 'nunca' && profile.lifts;
    if (!L) return 0;
    for (const [re, k, f] of LIFT_OF) if (re.test(name) && L[k] > 0) {
      const ph = progOf() === 'exp' && EXLIB[name] && EXLIB[name][1] === 'main' ? [1, 1.07, 1.12][phaseOf(week)] : 1;
      const kg = L[k] * f * ph;
      return k === 'ohp' ? Math.round(kg * 2) / 2 : Math.round(kg / 2.5) * 2.5;
    }
    return 0;
  }

  let profile = store.get('profile');
  if (profile && !profile.goals && profile.goal) profile.goals = [profile.goal];
  // Calendario: todo se calcula con la fecha local del dispositivo (su zona horaria).
  // La semana 1 es la semana calendario (lunes a domingo) que contiene la fecha de inicio.
  const isISO = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v));
  let start = store.get('programStart');
  if (start !== null && !isISO(start)) start = null;
  let schedule = store.get('schedule') || 'lmv';
  const SCHEDULES = {
    l1: { freq: 1, label: 'Lunes', days: [1], names: ['Lunes'] },
    s1: { freq: 1, label: 'Sábado', days: [6], names: ['Sábado'] },
    lj: { freq: 2, label: 'Lun y Jue', days: [1, 4], names: ['Lunes', 'Jueves'] },
    mv: { freq: 2, label: 'Mar y Vie', days: [2, 5], names: ['Martes', 'Viernes'] },
    lmv: { freq: 3, label: 'Lun, Mié y Vie', days: [1, 3, 5], names: ['Lunes', 'Miércoles', 'Viernes'] },
    mjs: { freq: 3, label: 'Mar, Jue y Sáb', days: [2, 4, 6], names: ['Martes', 'Jueves', 'Sábado'] },
    lmjv: { freq: 4, label: 'Lun, Mar, Jue y Vie', days: [1, 2, 4, 5], names: ['Lunes', 'Martes', 'Jueves', 'Viernes'] },
    lmvs: { freq: 4, label: 'Lun, Mié, Vie y Sáb', days: [1, 3, 5, 6], names: ['Lunes', 'Miércoles', 'Viernes', 'Sábado'] },
    lv: { freq: 5, label: 'Lun a Vie', days: [1, 2, 3, 4, 5], names: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] },
    lmjvs: { freq: 5, label: 'Lun, Mar, Jue, Vie y Sáb', days: [1, 2, 4, 5, 6], names: ['Lunes', 'Martes', 'Jueves', 'Viernes', 'Sábado'] },
    ls: { freq: 6, label: 'Lun a Sáb', days: [1, 2, 3, 4, 5, 6], names: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] }
  };
  const freqOf = () => { const f = profile ? +profile.freq : 3; return f >= 1 && f <= 6 ? f : 3; };
  function fixSchedule() {
    if (!SCHEDULES[schedule] || SCHEDULES[schedule].freq !== freqOf()) {
      schedule = Object.keys(SCHEDULES).find(k => SCHEDULES[k].freq === freqOf());
      store.set('schedule', schedule);
    }
  }
  // Con 2 días: cuerpo completo en ambas sesiones (cada músculo 2 veces por semana).
  // Con 4 días: los 3 días base más un día liviano.
  const PLAN_REFS = {
    gym: {
      2: [{ name: 'Full body A', desc: 'Piernas, glúteos, espalda y pecho en una sola sesión.', time: '50 min', refs: [[0, 0], [0, 1], [1, 0], [1, 2], [1, 4]], extras: [0] },
          { name: 'Full body B', desc: 'Glúteos, piernas, espalda, hombros y core.', time: '50 min', refs: [[0, 3], [0, 2], [1, 1], [1, 3], [0, 4], [1, 5]], extras: [1, 2] }],
      1: { name: 'Full body', desc: 'Todo el cuerpo en una sola sesión.', time: '55 min', refs: [[0, 0], [0, 1], [0, 3], [1, 0], [1, 2], [1, 4]], extras: [0, 1, 2] },
      more: [
        { name: 'Piernas, core y cardio', desc: 'Un día más liviano para sumar frecuencia sin cansarte de más.', time: '40 min', refs: [[0, 1], [0, 3], [1, 1], [1, 4], [2, 4]], extras: [] },
        { name: 'Core y cardio suave', desc: 'Sesión corta y liviana para moverte y recuperarte.', time: '30 min', refs: [[1, 4], [1, 5], [2, 4]], extras: [] },
        { name: 'Descanso activo', desc: 'Solo movimiento suave: camina y disfruta, sin exigirte.', time: '20–30 min', refs: [[2, 4]], extras: [] }
      ]
    },
    casa: {
      2: [{ name: 'Full body A', desc: 'Piernas, glúteos, pecho y espalda en una sola sesión.', time: '40 min', refs: [[0, 0], [0, 1], [1, 0], [1, 1], [1, 4]], extras: [0] },
          { name: 'Full body B', desc: 'Glúteos, piernas, espalda, hombros y core.', time: '40 min', refs: [[0, 2], [0, 4], [1, 3], [1, 2], [0, 3], [1, 5]], extras: [1, 2] }],
      1: { name: 'Full body', desc: 'Todo el cuerpo en una sola sesión, sin máquinas.', time: '45 min', refs: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 4]], extras: [0, 1, 2] },
      more: [
        { name: 'Piernas, core y cardio', desc: 'Un día más liviano para sumar frecuencia sin cansarte de más.', time: '35 min', refs: [[0, 1], [0, 2], [1, 1], [1, 4], [2, 4]], extras: [] },
        { name: 'Core y cardio suave', desc: 'Sesión corta y liviana para moverte y recuperarte.', time: '30 min', refs: [[1, 4], [1, 5], [2, 4]], extras: [] },
        { name: 'Descanso activo', desc: 'Solo movimiento suave: camina o trota suave, sin exigirte.', time: '20–30 min', refs: [[2, 4]], extras: [] }
      ]
    }
  };
  function planDays() {
    if (mode === 'gym' && progOf() === 'exp') return expDays();
    if (mode === 'gym' && progOf() === 'mine') return mineDays();
    return baseDays(mode);
  }
  function baseDays(m) {
    const base = m === 'casa' ? homeDays : days, f = freqOf(), R = PLAN_REFS[m];
    const mk = (r, n) => ({ num: 'Día ' + n, name: r.name, desc: r.desc, time: r.time, slots: r.refs.map(([a, b]) => base[a].slots[b]), extras: r.extras });
    if (f === 1) return [mk(R[1], 1)];
    if (f === 2) return R[2].map((r, k) => mk(r, k + 1));
    const three = base.map((d, k) => Object.assign({}, d, { extras: [k] }));
    return three.concat(R.more.slice(0, f - 3).map((r, k) => mk(r, k + 4)));
  }
  const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const mondayOf = s => { const t = parseISO(s); return t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5; };
  const daysSinceStart = () => (start ? Math.round((parseISO(today) - parseISO(start)) / 864e5) : 0);
  const weeksRaw = () => (start ? Math.floor((mondayOf(today) - mondayOf(start)) / (7 * 864e5)) + 1 : 1) + skipW();
  const notYet = () => !!start && daysSinceStart() < 0;
  const autoWeek = () => Math.min(12, Math.max(1, weeksRaw()));
  const todayIdx = () => SCHEDULES[schedule].days.indexOf(new Date().getDay());
  const phaseOf = w => (w <= 4 ? 0 : w <= 8 ? 1 : 2);
  let week = autoWeek();
  let current = 0;
  let exDone = store.get('exDone2') || {};
  let mode = store.get('trainMode') === 'casa' ? 'casa' : 'gym';

  // Cambios por molestias o etapa: [patrón del nombre, nuevo nombre, consejo]
  const PAIN = {
    rodilla: { label: 'rodilla', swaps: [
      [/^(Sentadilla búlgara|Zancada|Subida a un escalón)/, 'Puente de glúteos con pausa', 'Trabaja glúteo sin cargar la rodilla. Aprieta 2 segundos arriba.'],
      [/^Sentadilla/, 'Sentadilla a una silla (rango corto)', 'Baja solo hasta donde no sientas molestia, con las rodillas en línea con los pies.']] },
    espalda: { label: 'espalda baja', swaps: [
      [/^Peso muerto/, 'Puente de glúteos con pausa', 'Activa glúteos y femorales sin inclinar la espalda.'],
      [/^(Superman|Nado boca abajo)/, 'Bird dog', 'Estira brazo y pierna contraria sin arquear la espalda baja.']] },
    hombro: { label: 'hombro', swaps: [
      [/^(Press de hombros|Flexión pike)/, 'Face pull con banda', 'Tira hacia la cara con los codos altos; fortalece la parte de atrás del hombro.'],
      [/^Fondos de tríceps/, 'Extensión de tríceps con banda', 'Codos pegados al cuerpo y movimiento lento.'],
      [/^Elevaciones laterales/, 'Elevaciones laterales cortas', 'Sube solo hasta la altura del pecho, sin dolor.']] },
    muneca: { label: 'muñeca', swaps: [
      [/^Flexiones/, 'Press de pecho con banda o máquina', 'Mantén la muñeca recta, alineada con el antebrazo.'],
      [/^Plancha/, 'Plancha sobre antebrazos', 'Apoya los antebrazos en vez de las manos.'],
      [/^Fondos de tríceps/, 'Extensión de tríceps con banda', 'Sin apoyar peso en las manos.']] }
  };
  const STAGE_SWAPS = {
    embarazo: [
      [/(Superman|Nado boca abajo|boca abajo)/, 'Remo con banda', 'Espalda recta y hombros abajo. Sin acostarte boca abajo.'],
      [/^(Plancha|Dead bug)/, 'Pallof press con banda', 'Core sin presión en el abdomen. Respira normal, sin aguantar el aire.'],
      [/^(Intervalos|Cardio final)/, 'Caminata a ritmo cómodo', 'Esfuerzo moderado: debes poder conversar mientras caminas.']],
    posparto: [
      [/^Plancha/, 'Respiración con abdomen profundo', 'Bota el aire lento y lleva el ombligo suave hacia adentro. Sin hundir ni empujar la guata.'],
      [/^(Intervalos|Cardio final)/, 'Caminata rápida', 'Sin saltos ni impacto hasta que te den el alta.']]
  };
  // Desde el 2.º trimestre: nada acostada de espalda. En el 3.º: sin ejercicios de equilibrio en una pierna
  const PREG_T2 = [
    [/^(Puente|Dead bug|Movilidad suave en colchoneta)/, 'Abducción de cadera de pie', 'De pie, apoyada en una silla, abre la pierna hacia el lado sin inclinarte. Trabaja glúteo sin acostarte de espalda.']];
  const PREG_T3 = [
    [/^(Zancada|Subida a un escalón|Sentadilla búlgara|Peso muerto a una pierna)/, 'Sentadilla sumo con apoyo', 'Pies abiertos y sujetándote de una silla para no perder el equilibrio. Baja solo hasta donde estés cómoda.']];
  function adapt(ex) {
    if (!profile) return ex;
    const pwk = pregWeekNow();
    const rules = (profile.pain || []).flatMap(p => (PAIN[p] || {}).swaps || []).concat(STAGE_SWAPS[profile.stage] || [])
      .concat(pwk >= 14 || (profile.stage === 'embarazo' && !pwk) ? PREG_T2 : []).concat(pwk >= 28 || (profile.stage === 'embarazo' && !pwk) ? PREG_T3 : []);
    const out = [], seen = new Set();
    ex.forEach(e => {
      const r = rules.find(r => r[0].test(e.name));
      const n = r ? Object.assign({}, e, { name: r[1], tip: r[2], tag: 'adapt' }) : e;
      if (seen.has(n.name)) return;
      seen.add(n.name); out.push(n);
    });
    return out;
  }
  function fitTime(ex) {
    const t = profile && profile.time;
    if (t !== '30' && t !== '45') return ex;
    const base = ex.filter(e => e.tag !== 'extra'), extra = ex.filter(e => e.tag === 'extra');
    return t === '30' ? base.slice(0, 4) : base.slice(0, 5).concat(extra.slice(0, 1));
  }
  function buildDay(i) {
    const d = planDays()[i], p = phaseOf(week);
    const feel = (store.get('feel') || {})[today];
    const soft = feel === 'baja' || pregWeekNow() >= 28;
    const beginner = profile && profile.exp === 'nunca' && week <= 2;
    const ex = d.fixed ? d.fixed.map(e => Object.assign({}, e, { tag: '' })) : d.slots.map(s => {
      const v = pickV(s[p]);
      return {
        name: v[0], tip: v[1], series: beginner && v[2] === '3 series' ? '2 series' : v[2], reps: v[3], rest: v[4],
        tag: p > 0 && v[0] !== pickV(s[p - 1])[0] ? 'new' : ''
      };
    });
    const seen = new Set(ex.map(e => e.name));
    let added = 0;
    ((profile && profile.goals) || []).forEach(g => d.extras.flatMap(ei => (GOALS[g] && GOALS[g].extras[ei]) || []).forEach(x => {
      const y = mode === 'casa' && HOME_SWAP[x[0]] ? pickV(HOME_SWAP[x[0]]) : x;
      // En la rutina para quienes ya entrenan solo se suma cardio y core: el resto ya está cubierto
      if (d.fixed && !/^(Cardio|Pallof|Plancha|Movilidad)/.test(y[0])) return;
      if (added >= MAX_EXTRAS || seen.has(y[0])) return;
      seen.add(y[0]); added++;
      ex.push({ name: y[0], tip: y[1], series: y[2], reps: y[3], rest: y[4], tag: 'extra' });
    }));
    ex.sort((a, b) => (a.name.startsWith('Cardio final') ? 1 : 0) - (b.name.startsWith('Cardio final') ? 1 : 0));
    // Versión suave: una serie menos en cada ejercicio (sin bajar de 2)
    if (soft) ex.forEach(e => { const m = /^(\d+) series/.exec(e.series || ''); if (m && +m[1] >= 3) e.series = (m[1] - 1) + ' series'; });
    // Rutina propia: se respeta tal cual (sin recortes ni cambios automáticos)
    let out = d.mine !== undefined ? ex : fitTime(adapt(ex));
    if (profile && profile.stage === 'posparto')
      out = [{ name: 'Suelo pélvico', tip: 'Aprieta como si aguantaras el pipí durante 3 a 5 segundos y suelta otros 5. Sin aguantar el aire.', series: '2 series', reps: '10 reps', rest: '30 s', tag: 'adapt' }].concat(out);
    const time = d.mine !== undefined ? d.time : profile && profile.time === '30' ? '30 min' : profile && profile.time === '45' ? '45 min' : d.time;
    return Object.assign({}, d, { ex: out, time });
  }

  // ---------- Fase y semanas ----------
  const weekLabel = document.getElementById('weekLabel');
  const weekHint = document.getElementById('weekHint');
  const weekDots = document.getElementById('weekDots');
  const phaseTitle = document.getElementById('phaseTitle');
  const phaseDesc = document.getElementById('phaseDesc');
  const prevBtn = document.getElementById('prevWeek');
  const nextBtn = document.getElementById('nextWeek');
  const backBtn = document.getElementById('backToWeek');
  const restartBtn = document.getElementById('restartProgram');

  function renderPhase() {
    const aw = autoWeek(), p = phaseOf(week);
    weekLabel.textContent = 'Semana ' + week;
    if (!start) weekHint.textContent = 'Vista previa';
    else if (notYet()) weekHint.textContent = 'Tu programa aún no empieza';
    else if (week === aw) weekHint.textContent = weeksRaw() > 12 ? '¡Completaste las 12 semanas! 🎉' : 'Tu semana actual';
    else weekHint.textContent = week > aw ? 'Vista previa' : 'Semana anterior';
    renderToday();
    if (start) {
      phaseDetails.hidden = !phaseOpen; phaseMini.hidden = phaseOpen; collapseBtn.hidden = false;
      phaseMiniTitle.textContent = notYet() ? 'Semana 1 de 12' : weeksRaw() > 12 ? 'Programa completado 🎉' : `Semana ${aw} de 12`;
      phaseMiniText.textContent = phs()[phaseOf(aw)].title;
    } else { phaseDetails.hidden = false; phaseMini.hidden = true; collapseBtn.hidden = true; }
    prevBtn.disabled = week <= 1;
    nextBtn.disabled = week >= 12;
    backBtn.hidden = !start || week === aw;
    restartBtn.hidden = !start;
    weekDots.innerHTML = phs().map((ph, k) => `
      <div class="phase-seg${k === p ? ' active' : ''}">
        <div class="bars">${[1, 2, 3, 4].map(n => {
          const w = k * 4 + n;
          return `<i class="${w === week ? 'now' : start && !notYet() && w < aw ? 'past' : ''}"></i>`;
        }).join('')}</div>
        <small>Fase ${k + 1}</small>
      </div>`).join('');
    phaseTitle.textContent = phs()[p].title;
    phaseDesc.textContent = phs()[p].weeks + '. ' + phs()[p].desc + (weeksRaw() > 12 && week === 12 ? ' Para seguir, repite la fase 3 con más peso o empieza de nuevo; es un buen momento para pedirle a un entrenador del gym que revise tu técnica.' : '');
  }
  function goWeek(w) { week = Math.min(12, Math.max(1, w)); renderPhase(); renderDay(current); }
  prevBtn.addEventListener('click', () => goWeek(week - 1));
  nextBtn.addEventListener('click', () => goWeek(week + 1));
  backBtn.addEventListener('click', () => goWeek(autoWeek()));
  // Un solo lugar para los datos: con perfil, fecha y días se cambian en el perfil
  restartBtn.addEventListener('click', () => (profile ? editProfileAt('profSched') : openStarter()));
  document.getElementById('starterGo').addEventListener('click', (ev) => { if (profile) { ev.preventDefault(); ev.stopPropagation(); editProfileAt('profSched'); } });

  // ---------- Iniciador ----------
  const starter = document.getElementById('starter');
  const phaseBody = document.getElementById('phaseBody');
  const startDate = document.getElementById('startDate');
  const todayBanner = document.getElementById('todayBanner');
  const startedInfo = document.getElementById('startedInfo');
  const phaseDetails = document.getElementById('phaseDetails');
  const phaseMini = document.getElementById('phaseMini');
  const phaseMiniTitle = document.getElementById('phaseMiniTitle');
  const phaseMiniText = document.getElementById('phaseMiniText');
  const collapseBtn = document.getElementById('collapsePhase');
  let phaseOpen = false;
  document.getElementById('togglePhase').addEventListener('click', () => { phaseOpen = true; renderPhase(); });
  collapseBtn.addEventListener('click', () => { phaseOpen = false; week = autoWeek(); renderPhase(); renderDay(current); });
  const tz = ((Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || '').replace(/_/g, ' ');
  const fmtISO = s => new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseISO(s));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  document.getElementById('tzNote').textContent = 'Usamos el calendario y la zona horaria de tu dispositivo' + (tz ? ` (${tz})` : '') + '.';

  function openStarter() {
    startDate.value = start || today;
    renderSchedPills();
    const sg = document.getElementById('starterGo'), quick = starter.querySelector('.starter-quick');
    sg.textContent = profile ? 'Elegir mis días y fecha' : 'Armar mi plan';
    quick.hidden = !!profile;
    starter.hidden = false; phaseBody.hidden = true;
  }
  function renderStarter() {
    if (!start) openStarter();
    else { starter.hidden = true; phaseBody.hidden = false; }
  }
  document.getElementById('startBtn').addEventListener('click', () => {
    const v = startDate.value || today;
    if (v !== start) { exDone = {}; store.set('exDone2', exDone); }
    start = v; store.set('programStart', start);
    schedule = (starter.querySelector('input[name="sched"]:checked') || {}).value || schedule;
    fixSchedule();
    store.set('schedule', schedule);
    phaseOpen = false;
    renderStarter(); updateTabLabels();
    week = autoWeek(); renderPhase(); selectTab(defaultTab()); renderPlan();
  });
  const schedPills = document.getElementById('schedPills');
  function renderSchedPills() {
    fixSchedule();
    schedPills.innerHTML = Object.keys(SCHEDULES).filter(k => SCHEDULES[k].freq === freqOf())
      .map(k => `<label class="pill"><input type="radio" name="sched" value="${k}"${k === schedule ? ' checked' : ''}><span>${SCHEDULES[k].label}</span></label>`).join('');
  }
  function updateTabLabels() { buildTabs(); }
  function nextTraining() {
    const wd = new Date().getDay(), k = SCHEDULES[schedule].days.findIndex(d => d > wd);
    return k === -1 ? 0 : k;
  }
  function defaultTab() { const t = todayIdx(); return t >= 0 ? t : nextTraining(); }
  function renderToday() {
    if (!start) { todayBanner.hidden = true; startedInfo.textContent = ''; return; }
    // "Qué toca hoy" ya lo dice la tarjeta de Inicio y la pestaña marcada "(hoy)": aquí solo si aún no empieza
    todayBanner.hidden = !notYet();
    startedInfo.textContent = (notYet() ? 'Empiezas el ' : 'Empezaste el ') + fmtISO(start) + '.';
    if (notYet()) { todayBanner.innerHTML = `Tu programa empieza el <b>${fmtISO(start)}</b>. Mientras, puedes ver la rutina de la semana 1.`; return; }
    const hoy = cap(new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));
    const t = todayIdx(), n = nextTraining();
    todayBanner.innerHTML = t >= 0
      ? `${hoy}: hoy te toca el <b>Día ${t + 1}</b> 💪`
      : `${hoy}: hoy es día de descanso. Tu próximo entrenamiento es el <b>Día ${n + 1}</b>, el ${SCHEDULES[schedule].names[n].toLowerCase()}.`;
  }

  // ---------- Inicio: tarjeta "Hoy" (lo primero que se ve) ----------
  const todayCard = document.getElementById('todayCard');
  const heroEl = document.querySelector('.hero');
  function renderHoy() {
    if (!todayCard) return;
    heroEl.classList.toggle('compact', !!(profile && start));
    const h1 = heroEl.querySelector('h1');
    h1.innerHTML = profile && profile.name && start ? `Hola, <em>${esc(profile.name)}</em>` : 'Bienvenido a <em>Newen</em>';
    const sh = cap(new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric' }).format(new Date()));
    todayCard.classList.toggle('wide', !start);
    if (!start) {
      todayCard.innerHTML = profile
        ? `<span class="tk a">Paso 2 de 2</span><h4 id="todayTitle">Elige cuándo empiezas</h4><p class="tp">Tu perfil está listo. Solo falta elegir tus días y la fecha de inicio.</p><a class="tgo btn-in" href="#perfil" data-hoy="edit">Elegir mis días</a>`
        : `<span class="tk a">Empieza aquí · 2 minutos</span><h4 id="todayTitle">Arma tu plan</h4><p class="tp">Cuéntanos de ti, elige tus días y listo: la rutina se ajusta sola cada semana.</p><a class="tgo btn-in" href="#perfil">Armar mi plan</a>`;
      return;
    }
    if (notYet()) {
      todayCard.innerHTML = `<span class="tk a">Tu programa</span><span class="te" aria-hidden="true">📅</span><h4 id="todayTitle">Empiezas el ${fmtISO(start)}</h4><p class="tp">Mientras, mira tu primera semana.</p><a class="tgo" href="#rutina">Ver la semana 1 ›</a>`;
      return;
    }
    const t = todayIdx(), w0 = week;
    week = autoWeek();
    const i = t >= 0 ? t : nextTraining(), d = buildDay(i);
    const map = doneMap(dkey(i), d.ex), n = d.ex.filter(e => map[e.name]).length;
    week = w0;
    if (t >= 0) {
      const done = n === d.ex.length, late = !done && new Date().getHours() >= 19;
      todayCard.innerHTML = `<span class="tk a">${sh} · Hoy toca</span><h4 id="todayTitle">${done ? '¡Sesión lista! ✨' : esc(d.name)}</h4><p class="tp">${done ? 'Ahora a estirar y a descansar.' : `${d.time} · ${d.ex.length} ejercicios`}${late ? '<br>¿No alcanzas? 10 minutos en casa también cuentan.' : ''}</p>
        <div class="tbar" role="progressbar" aria-label="Ejercicios hechos hoy" aria-valuemin="0" aria-valuemax="${d.ex.length}" aria-valuenow="${n}"><i style="width:${Math.round(n / d.ex.length * 100)}%"></i></div>
        <button class="tgo btn-in" type="button" data-hoy="go" data-day="${i}">${done ? 'Ver sesión' : n ? `Seguir · ${n}/${d.ex.length}` : 'Empezar ›'}</button>`;
    } else {
      todayCard.innerHTML = `<span class="tk a">${sh}</span><span class="te" aria-hidden="true">🌙</span><h4 id="todayTitle">Hoy descansas</h4><p class="tp">${cap(SCHEDULES[schedule].names[i])}: <b>${esc(d.name)}</b></p><button class="tgo" type="button" data-hoy="go" data-day="${i}">Ver la sesión ›</button>`;
    }
  }
  todayCard.addEventListener('click', ev => {
    const b = ev.target.closest('[data-hoy]'); if (!b) return;
    if (b.dataset.hoy === 'go') { showSection('rutina'); goWeek(autoWeek()); selectTab(+b.dataset.day); }
    if (b.dataset.hoy === 'edit') { ev.preventDefault(); editProfileAt('pStart'); }
  });

  // ---------- Rutina ----------
  const panel = document.getElementById('dayPanel');
  const tabsEl = document.querySelector('.tabs');
  let tabs = [];
  const checkSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const dkey = i => (mode === 'casa' ? 'casa-' : (choiceNow() !== 'base' ? choiceNow() + '-' : '')) + (freqOf() !== 3 ? 'f' + freqOf() + '-' : '') + week + '-' + i;
  const key = () => dkey(current);
  // Las marcas se guardan por nombre del ejercicio, así no se mueven si la lista cambia.
  // Si vienen en el formato antiguo (por posición), se convierten una sola vez.
  function doneMap(k, ex) {
    const v = exDone[k];
    if (Array.isArray(v)) {
      const m = {};
      v.forEach((on, j) => { if (on && ex[j]) m[ex[j].name] = true; });
      exDone[k] = m; store.set('exDone2', exDone);
    }
    return exDone[k] || (exDone[k] = {});
  }
  const countDone = v => Array.isArray(v) ? v.filter(Boolean).length : Object.values(v || {}).filter(Boolean).length;

  function renderDay(i) {
    const d = buildDay(i);
    const map = doneMap(dkey(i), d.ex);
    const done = d.ex.map(e => !!map[e.name]);
    const count = d.ex.filter((_, j) => done[j]).length;
    panel.className = 'day-card' + (count === d.ex.length ? ' complete' : '');
    panel.innerHTML = `
      <div class="day-head">
        <div class="day-num">${d.num} · Semana ${week}</div>
        <h3>${d.name}</h3>
        <p>${d.desc}</p>
        <div class="meta"><span class="chip">📅 ${SCHEDULES[schedule].names[i]}${start && !notYet() && todayIdx() === i ? ' (hoy)' : ''}</span><span class="chip">⏱ ${d.time}</span><span class="chip">${d.ex.length} ejercicios</span></div>
      </div>
      <ol class="ex-list">
        ${d.ex.map((e, j) => { const pt = exPattern(e.name), wl = wCan(e.name, pt), sg = wl ? wSuggest(e.name) : null; return `
          <li class="ex${done[j] ? ' done' : ''}">
            ${myEditing && d.mine !== undefined ? `<button class="ex-rm" type="button" data-myrm="${j}" aria-label="Quitar ${e.name}">✕</button>` : `<button class="ex-btn" type="button" data-j="${j}" aria-pressed="${!!done[j]}" aria-label="Marcar ${e.name} como hecho">${checkSvg}</button>`}
            <button class="ex-fig" type="button" data-open="${j}" aria-label="Ver cómo se hace ${e.name}">${figSVG(pt, e.name)}</button>
            <div class="ex-body">
              <button class="ex-name ex-link" type="button" data-open="${j}">${e.name}${e.tag === 'extra' ? '<span class="goal-tag">✦ Extra</span>' : e.tag === 'new' ? '<span class="goal-tag new">Nuevo</span>' : e.tag === 'adapt' ? '<span class="goal-tag adapt">🩹 Adaptado</span>' : ''}</button>
              <div class="ex-stats">
                <span class="stat"><b>${e.series.replace(' series', '')}</b> × <b>${e.reps}</b></span>
                ${e.rest && e.rest !== '—' ? `<span class="stat rest">⏳ <b>${e.rest}</b></span>` : ''}
                ${wl ? `<button class="stat wchip${sg && sg.up ? ' up' : ''}" type="button" data-open="${j}">${sg && sg.last ? (sg.up ? '⬆ ' + fmtKg(sg.next) : '🏋️ ' + fmtKg(sg.last.kg)) : sg && sg.seed ? '🎯 ' + fmtKg(sg.seed) : '＋ Peso'}</button>` : ''}
              </div>
            </div>
          </li>`; }).join('')}
      </ol>
      ${myEditing && d.mine !== undefined ? `<div class="my-edit">
        <label class="field"><span>Nombre del día</span><input id="myDayName" value="${d.name}" maxlength="30"></label>
        <label class="field"><span>Agregar ejercicio</span><input id="myExName" list="exCatalog" maxlength="60" placeholder="Busca o escribe un ejercicio"></label>
        <div class="my-row">
          <select id="myExSeries" aria-label="Series"><option value="2 series">2 series</option><option value="3 series" selected>3 series</option><option value="4 series">4 series</option><option value="5 series">5 series</option></select>
          <input id="myExReps" value="10 reps" maxlength="14" aria-label="Repeticiones">
          <button class="btn btn-primary" type="button" data-myadd>Agregar</button>
        </div>
        <div class="sum-actions"><button class="btn btn-ghost" type="button" data-myedit="0">✓ Listo</button><button class="reset" type="button" data-myreset>Volver a la versión original del día</button></div>
      </div>` : ''}
      <div class="day-foot">
        <span><b>${count}/${d.ex.length}</b> listos</span>
        <span class="celebrate">¡Sesión lista! ✨</span>
        ${d.mine !== undefined && !myEditing ? '<button class="reset" type="button" data-myedit="1">✏️ Editar este día</button>' : ''}
        <button class="reset" type="button" data-reset>Reiniciar día</button>
      </div>`;
    renderHoy();
  }

  panel.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.ex-btn');
    if (btn) {
      const j = +btn.dataset.j, k = key();
      const d = buildDay(current), map = doneMap(k, d.ex), name = d.ex[j].name;
      if (map[name]) delete map[name]; else map[name] = true;
      const allDone = d.ex.every(e => map[e.name]);
      if (window.__rw) window.__rw.onEx(map[name] ? 1 : -1, k, allDone);
      if (map[name] && !earnXP('e:' + k + ':' + name, 10)) toast('✓ Ya sumaste la XP de este ejercicio hoy');
      store.set('exDone2', exDone);
      renderDay(current);
      const again = panel.querySelector(`.ex-btn[data-j="${j}"]`);
      if (again) again.focus();
      return;
    }
    if (ev.target.closest('[data-reset]')) {
      const d = buildDay(current), map = doneMap(key(), d.ex);
      const had = d.ex.filter(e => map[e.name]).length;
      exDone[key()] = {}; store.set('exDone2', exDone); renderDay(current);
      if (window.__rw) window.__rw.onEx(-had, key(), false);
      
    }
  });

  // ---------- Editor de la rutina propia ----------
  let myEditing = false;
  function saveMine(fn) {
    const r = mineRoutine(), d = r.days[current]; if (!d) return;
    fn(d, r); store.set('myRoutine', r);
    if (window.__rw && window.__rw.sync) window.__rw.sync();
    renderDay(current);
  }
  panel.addEventListener('click', (ev) => {
    const ed = ev.target.closest('[data-myedit]');
    if (ed) { myEditing = ed.dataset.myedit === '1'; renderDay(current); if (myEditing) { const n = document.getElementById('myExName'); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return; }
    const rm = ev.target.closest('[data-myrm]');
    if (rm) { const name = buildDay(current).ex[+rm.dataset.myrm].name; saveMine(d => { if (d.ex.length > 1) d.ex = d.ex.filter(e => e.name !== name); else toast('Deja al menos un ejercicio'); }); return; }
    if (ev.target.closest('[data-myadd]')) {
      const name = cleanTxt(document.getElementById('myExName').value, 60);
      if (!name) { toast('Escribe o elige un ejercicio'); document.getElementById('myExName').focus(); return; }
      const series = document.getElementById('myExSeries').value, reps = cleanTxt(document.getElementById('myExReps').value, 14) || '10 reps';
      saveMine(d => {
        if (d.ex.some(e => e.name.toLowerCase() === name.toLowerCase())) { toast('Ese ejercicio ya está en el día'); return; }
        if (d.ex.length >= 15) { toast('Máximo 15 ejercicios por día'); return; }
        const L = EXLIB[name];
        d.ex.push({ name, tip: L ? L[0] : '', series, reps: /\d$/.test(reps) ? reps + ' reps' : reps, rest: L && L[1] === 'main' ? '2 min' : '75 s' });
        toast('✓ Agregado: ' + name);
      });
      return;
    }
    if (ev.target.closest('[data-myreset]')) {
      saveMine(d => { const k = d.key || (REC_SPLIT[freqOf()] || [])[current]; if (k && TPL[k]) { d.ex = TPL[k].map(x => mkEx(x, 0, '', true)); d.name = DAYN[k][0]; } });
      toast('Día restablecido');
    }
  });
  panel.addEventListener('change', (ev) => {
    if (ev.target.id === 'myDayName') { const v = cleanTxt(ev.target.value, 30); if (v) saveMine(d => { d.name = v; }); }
  });
  // Lista de ejercicios para buscar al agregar
  (function () {
    const dl = document.getElementById('exCatalog'); if (!dl) return;
    const names = new Set(Object.keys(EXLIB));
    days.forEach(d => d.slots.forEach(s => s.forEach(v => names.add(v[0]))));
    dl.innerHTML = [...names].sort((a, b) => a.localeCompare(b, 'es')).map(n => `<option value="${esc(n)}"></option>`).join('');
  })();

  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const homeNote = document.getElementById('homeNote');
  function renderMode() {
    modeBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'));
    if (mode === 'casa') {
      const eq = (profile && profile.equip) || [];
      const txt = eq.length ? 'Rutina con ' + eq.map(e => (e === 'db' ? 'mancuernas' : 'bandas elásticas')).join(' y ') : 'Rutina solo con tu peso corporal';
      homeNote.innerHTML = `${txt}. Puedes cambiar tu equipo en <a href="#perfil">tu perfil</a>. Necesitas una colchoneta o toalla, una silla firme y espacio para moverte.`;
      homeNote.hidden = false;
      if (progOf() !== 'base') homeNote.innerHTML += ' En casa usamos la rutina base; tu rutina de gym sigue intacta.';
    } else homeNote.hidden = true;
    const cr = document.getElementById('changeRoutine');
    if (cr) cr.hidden = !(profile && profile.exp !== 'nunca' && profile.expTime);
  }
  document.getElementById('changeRoutine').addEventListener('click', () => {
    profileHidden = false; store.set('profileHidden', false);
    showSection('perfil'); renderPlan();
    setTimeout(() => { const o = document.getElementById('rutOpts'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  });
  modeBtns.forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode; store.set('trainMode', mode); renderMode(); renderDay(current); }));

  function buildTabs() {
    const n = planDays().length, names = SCHEDULES[schedule].names;
    document.getElementById('h-rutina').textContent = `Tu rutina de ${n} día${n > 1 ? 's' : ''}`;
    tabsEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    tabsEl.classList.toggle('many', n >= 5);
    tabsEl.innerHTML = Array.from({ length: n }, (_, k) => `<button class="tab" role="tab" aria-selected="false" aria-controls="dayPanel" data-day="${k}">Día ${k + 1}<small>${n >= 5 ? names[k].slice(0, 3) : names[k]}</small></button>`).join('');
    tabs = Array.from(tabsEl.querySelectorAll('.tab'));
    tabs.forEach((t, k) => {
      t.addEventListener('click', () => selectTab(k));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const m = (k + (e.key === 'ArrowRight' ? 1 : n - 1)) % n;
          selectTab(m); tabs[m].focus();
        }
      });
    });
  }

  function selectTab(i) {
    i = Math.max(0, Math.min(i, tabs.length - 1));
    current = i;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', k === i ? 'true' : 'false'); t.tabIndex = k === i ? 0 : -1; });
    renderDay(i);
  }

  // ---------- Perfil ----------
  const form = document.getElementById('profileForm');
  const planCard = document.getElementById('planCard');
  const formError = document.getElementById('formError');
  const banner = document.getElementById('routineGoal');
  const proteinTip = document.getElementById('proteinTip');
  const proteinDefault = proteinTip.textContent;
  const profileMini = document.getElementById('profileMini');
  const profileMiniText = document.getElementById('profileMiniText');
  let profileHidden = !!store.get('profileHidden');
  document.getElementById('showProfile').addEventListener('click', () => { profileHidden = false; store.set('profileHidden', false); renderPlan(); });
  const goalBoxes = Array.from(form.querySelectorAll('input[name="goal"]'));

  function updateGoalLimits() {
    const checked = goalBoxes.filter(b => b.checked);
    goalBoxes.forEach(b => { b.disabled = !b.checked && checked.length >= MAX_GOALS; });
  }
  goalBoxes.forEach(b => b.addEventListener('change', () => {
    if (b.checked && b.value === 'nose') goalBoxes.forEach(o => { if (o !== b) o.checked = false; });
    else if (b.checked) { const n = goalBoxes.find(o => o.value === 'nose'); if (n) n.checked = false; }
    formError.textContent = '';
    updateGoalLimits();
  }));

  // Proteína: 1,2–1,6 g por kg. Con peso y estatura, si el IMC supera 30 se usa un peso de referencia
  // (IMC 25 para su estatura), como se hace en nutrición para no sobrestimar la necesidad.
  function proteinRange(p) {
    const w = parseFloat(p.weight), h = parseFloat(p.height) / 100;
    if (!(w > 0)) return null;
    // Igual que el menú: 1,6 g por kilo hasta 1,8–2,2 g según el objetivo (con mucho peso, sobre un peso de referencia)
    let ref = w;
    if (h > 1.2 && w / (h * h) > 27) ref = 27 * h * h;
    const g = p.goals || [], lose = g.includes('bajar'), gain = g.includes('gluteos') || g.includes('tonificar');
    const top = lose && gain ? 2 : lose ? 2.2 : 1.8;
    return { lo: Math.round(ref * 1.6 / 5) * 5, hi: Math.round(ref * top / 5) * 5, withHeight: h > 1.2 };
  }

  function renderPlan() {
    const goals = ((profile && profile.goals) || []).filter(g => GOALS[g]);
    if (!goals.length) {
      planCard.hidden = true; form.hidden = false; banner.hidden = true; profileMini.hidden = true;
      proteinTip.textContent = proteinDefault;
      return;
    }
    const pr = proteinRange(profile);
    const age = parseInt(profile.age, 10);
    const notes = [];
    if (freqOf() > 3 && profile.exp === 'nunca') notes.push('⚠️ Elegiste más de 3 días y es tu primera vez entrenando: no se recomienda al empezar. Si sientes mucho cansancio o dolor que no se va, baja a 3 días.');
    if (profile.exp === 'nunca') notes.push('Como es tu primera vez, en las semanas 1 y 2 haz 2 series en lugar de 3, con poco peso, para aprender bien la técnica.');
    if (goals.includes('bajar') && goals.includes('gluteos')) notes.push('Bajar grasa y ganar músculo a la vez sí es posible cuando recién empiezas, sobre todo si comes suficiente proteína y evitas dietas muy restrictivas.');
    if (pr) notes.push(`Tu meta de proteína aprox.: <b>${pr.lo}–${pr.hi} g al día</b>, repartidos en tus comidas${pr.withHeight ? ' (calculada con tu peso y estatura)' : ''}.`);
    if (parseFloat(profile.height) > 0) notes.push('Al usar las máquinas, ajusta el asiento y los apoyos a tu estatura: las articulaciones (rodilla, hombro) deben quedar alineadas con el eje de giro de la máquina. Si dudas, pide ayuda al personal del gym.');
    if (profile.time === '30') notes.push('⏱ Tienes 30 minutos: cada día hace solo los ejercicios principales, sin los extra.');
    if (profile.time === '45') notes.push('⏱ Tienes 45 minutos: dejamos los ejercicios principales y un extra por día.');
    if ((profile.pain || []).length) notes.push('🩹 Cambiamos los ejercicios que suelen molestar en: <b>' + profile.pain.filter(p => PAIN[p]).map(p => PAIN[p].label).join(', ') + '</b>. Los verás marcados como “Adaptado”. Si algo duele, detente; si la molestia sigue, consulta con un kinesiólogo.');
    if (profile.stage === 'embarazo') {
      const w = pregWeekNow(), tri = w >= 28 ? 3 : w >= 14 ? 2 : 1;
      if (!w) notes.push('🤰 Adaptamos tu rutina al embarazo con la versión más prudente: sin ejercicios boca abajo, acostada de espalda ni de equilibrio en una pierna, y con esfuerzo moderado. Consulta con tu matrona o médico antes de empezar o cambiar tu rutina. ✨ Con Premium la ajustamos a tu semana exacta.');
      if (w)
      notes.push(`🤰 Semana ${w} · ${['', '1.er', '2.º', '3.er'][tri]} trimestre. Adaptamos tu rutina: sin ejercicios boca abajo ni planchas, y con esfuerzo moderado (deberías poder conversar mientras entrenas).` +
        (tri >= 2 ? ' Desde el segundo trimestre también quitamos los ejercicios acostada de espalda.' : '') +
        (tri === 3 ? ' En el tercer trimestre bajamos una serie y cambiamos los ejercicios de equilibrio en una pierna por versiones con apoyo.' : '') +
        ' Consulta con tu matrona o médico antes de empezar o cambiar tu rutina.');
      notes.push('⚠️ <b>Detente y consulta de inmediato</b> si tienes: sangrado vaginal, contracciones dolorosas y seguidas, pérdida de líquido, mareo o desmayo, dolor en el pecho, falta de aire antes de esforzarte, dolor de cabeza fuerte, o dolor o hinchazón en la pantorrilla.');
    }
    if (profile.stage === 'posparto') notes.push('👶 Sumamos ejercicios de suelo pélvico al inicio de cada día y quitamos el impacto. Espera la autorización de tu profesional de salud (suele ser cerca de las 6 semanas) y, si puedes, consulta con un kinesiólogo de suelo pélvico.');
    if (profile.sleep === 'mal' || profile.stress === 'alto') notes.push('😴 Los días que duermas mal o estés con mucho estrés, haz una serie menos de cada ejercicio. Entrenar suave también cuenta.');
    if (profile.waist) notes.push(`📏 Cintura inicial: <b>${esc(profile.waistStart ? profile.waistStart.cm : profile.waist)} cm</b>. Mídela cada 4 semanas a la altura del ombligo, en la mañana: muchas veces cambia aunque el peso no se mueva.` + (profile.waistStart && profile.waistStart.cm !== profile.waist ? ` Hoy: <b>${esc(profile.waist)} cm</b>.` : ''));
    if (age && age < 18) notes.push('Como tienes menos de 18 años, entrena con la guía de un entrenador o un adulto de confianza y prioriza la técnica sobre el peso.');

    planCard.innerHTML = `
      <span class="plan-badge">Tu plan de 12 semanas</span>
      <h3>${profile.name ? 'Hola, ' + esc(profile.name) : 'Tu plan está listo'}</h3>
      <p class="plan-goal">Objetivos: <b>${goals.map(g => GOALS[g].label).join(', ')}</b></p>
      ${goals.map(g => `
        <div class="plan-goal-block">
          <h4><span aria-hidden="true">${GOALS[g].emoji}</span> ${GOALS[g].label}</h4>
          <p>${GOALS[g].summary}</p>
          <ul class="plan-list">${GOALS[g].points.filter(pt => progOf() === 'base' || !/^Sumamos/.test(pt)).map(pt => `<li>${pt}</li>`).join('')}</ul>
        </div>`).join('')}
      ${expBlock()}
      <p class="plan-note">Entrenas <b>${freqOf()} días por semana</b> y tu rutina avanza en 3 fases de 4 semanas. ${start && !notYet() ? `Ahora estás en la <b>semana ${autoWeek()}</b>: ${phs()[phaseOf(autoWeek())].title.split(': ')[1].toLowerCase()}.` : 'Elige tu fecha de inicio en la sección de rutina y las semanas avanzarán solas.'}</p>
      ${(profile.parq || []).length ? '<div class="plan-alert">⚠️ <b>Antes de empezar, habla con tu médico.</b> Marcaste ' + profile.parq.length + ' respuesta' + (profile.parq.length > 1 ? 's' : '') + ' en “Tu salud”. Cuéntale qué marcaste y pregúntale qué tipo de ejercicio te conviene. Mientras tanto, empieza muy suave.</div>' : ''}
      ${(() => {
        // Primero lo de seguridad; se ven 3 notas y el resto queda plegado
        const safe = n => /⚠️|🩹|🤰|👶|menos de 18/.test(n);
        const ord = notes.filter(safe).concat(notes.filter(n => !safe(n)));
        const top = ord.slice(0, 3), rest = ord.slice(3);
        return top.map(n => `<p class="plan-note">${n}</p>`).join('') + (rest.length ? `<details class="plan-more"><summary>Ver ${rest.length} consejo${rest.length > 1 ? 's' : ''} más</summary>${rest.map(n => `<p class="plan-note">${n}</p>`).join('')}</details>` : '');
      })()}
      <div class="plan-actions">
        <a class="btn btn-primary" href="#inicio">Ver mi día de hoy</a>
        <button class="btn btn-ghost" type="button" id="editProfile">Editar perfil</button>
        <button class="reset" type="button" id="hideProfile">Ocultar perfil</button>
      </div>`;
    planCard.hidden = profileHidden; form.hidden = true;
    profileMini.hidden = !profileHidden;
    profileMiniText.textContent = (profile.name ? profile.name + ': ' : '') + goals.map(g => GOALS[g].label).join(', ');

    const hasExtras = goals.some(g => Object.keys(GOALS[g].extras).length);
    const feelT = (store.get('feel') || {})[today];
    const cyc0 = cycleInfo();
    const extraB = feelT === 'baja' ? ' 🌧️ Hoy te sientes con poca energía: hicimos la versión suave (una serie menos). Si duele mucho, descansar también está bien.' : (cyc0 && cyc0.phase === 'menstrual' ? ' 🩸 Estás en tus días: si tienes cólicos, el movimiento suave puede ayudar. Cuéntanos en Inicio cómo te sientes.' : '');
    // Aviso corto: solo la leyenda de las marcas que aparecen y los avisos de seguridad
    const bParts = [];
    if (profile.exp !== 'nunca' && profile.expTime) bParts.push('<b>Rutina:</b> ' + choiceName());
    if (hasExtras && profile.time !== '30') bParts.push('<b>✦ Extra</b> = para tus objetivos');
    if ((profile.pain || []).length || profile.stage !== 'ninguna' && profile.stage) bParts.push('<b>🩹 Adaptado</b> = cambiado por tu perfil');
    if ((profile.parq || []).length) bParts.push('⚠️ Consulta con tu médico antes de empezar');
    banner.innerHTML = bParts.join(' · ') + extraB;
    banner.hidden = !bParts.length && !extraB;
    proteinTip.textContent = pr
      ? `Tu meta: unos ${pr.lo}–${pr.hi} g al día. Huevo, pollo, pescado, legumbres, yogur o tofu.`
      : proteinDefault;
  }

  const freqNote = document.getElementById('freqNote');
  const WARN = '⚠️ Si estás recién empezando, no se recomiendan más de 3 días por semana: tu cuerpo necesita descanso para recuperarse y progresar.';
  const FREQ_NOTES = {
    1: 'Un día es un buen comienzo para crear el hábito. Cuando puedas, sube a 2 o 3 para progresar más.',
    2: 'Con 2 días harás cuerpo completo en cada sesión, así cada músculo trabaja 2 veces por semana.',
    3: 'La mejor opción para empezar: entrenas días alternos y descansas entre sesiones.',
    4: WARN + ' Por eso el cuarto día es más liviano.',
    5: WARN + ' Por eso los días 4 y 5 son más livianos.',
    6: WARN + ' Por eso los días 4 a 6 son livianos, y el último es solo descanso activo.'
  };
  function updateFreqNote() {
    const f = (form.querySelector('input[name="freq"]:checked') || {}).value || '3';
    freqNote.textContent = FREQ_NOTES[f];
    freqNote.classList.toggle('warn', +f > 3);
  }
  // Días y fecha de inicio dentro del perfil: un solo formulario para todo
  const profSched = document.getElementById('profSched'), pStart = document.getElementById('pStart');
  function renderProfSched() {
    const f = +((form.querySelector('input[name="freq"]:checked') || {}).value || 3);
    const cur = (form.querySelector('input[name="psched"]:checked') || {}).value || schedule;
    const opts = Object.keys(SCHEDULES).filter(k => SCHEDULES[k].freq === f);
    const sel = opts.includes(cur) ? cur : opts[0];
    profSched.innerHTML = opts.map(k => `<label class="pill"><input type="radio" name="psched" value="${k}"${k === sel ? ' checked' : ''}><span>${SCHEDULES[k].label}</span></label>`).join('');
  }
  function editProfileAt(id) {
    showSection('perfil');
    fillForm(); planCard.hidden = true; form.hidden = false; profileMini.hidden = true;
    const el = document.getElementById(id);
    if (el) setTimeout(() => { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
  }
  const expBox = document.getElementById('expBox');
  const updateExpBox = () => { expBox.hidden = ((form.querySelector('input[name="exp"]:checked') || {}).value || 'nunca') === 'nunca'; };
  form.addEventListener('change', (ev) => { if (ev.target.name === 'exp') updateExpBox(); });
  form.addEventListener('change', (ev) => { if (ev.target.name === 'freq') { updateFreqNote(); renderProfSched(); } if (ev.target.name === 'stage' || ev.target.name === 'cycTrack') updateCondFields(); });
  function updateCondFields() {
    const st = (form.querySelector('input[name="stage"]:checked') || {}).value || 'ninguna';
    const tr = (form.querySelector('input[name="cycTrack"]:checked') || {}).value || 'no';
    document.getElementById('pregBox').hidden = st !== 'embarazo';
    const prem = isPremium();
    document.getElementById('pPregWeeks').disabled = !prem;
    if (tr === 'si' && !prem) { const no = form.querySelector('input[name="cycTrack"][value="no"]'); if (no) no.checked = true; openPremium('El registro del ciclo menstrual'); return updateCondFields(); }
    document.getElementById('cycleBox').hidden = st === 'embarazo';
    document.getElementById('cycleFields').hidden = tr !== 'si';
    document.getElementById('cycIrregular').hidden = tr !== 'irregular';
    const ps = document.getElementById('pCycStart'); ps.max = today;
  }
  // Semana actual de embarazo: la que dijo + las semanas que pasaron desde entonces
  function pregWeekNow(p) {
    p = p || profile;
    if (!p || p.stage !== 'embarazo' || !p.pregWeeks || !isPremium()) return 0;
    const days = Math.round((Date.parse(today) - Date.parse(p.pregDate || today)) / 864e5);
    return Math.min(42, Math.max(1, +p.pregWeeks + Math.floor(Math.max(0, days) / 7)));
  }
  // Tarjeta de Inicio: embarazo o ciclo + "¿cómo te sientes hoy?"
  const PHASES_TXT = {
    menstrual: ['🩸 Tus días', 'Si tienes cólicos, moverte suave (caminar, estirar) puede aliviarlos. Si no te sientes bien, descansar también cuenta.'],
    folicular: ['🌱 Fase folicular', 'Muchas mujeres se sienten con más energía estos días, pero no todas: guíate por cómo te sientes tú.'],
    ovulacion: ['✨ Ovulación aproximada', 'Es una estimación según tus fechas: no sirve como método anticonceptivo.'],
    lutea: ['🌙 Fase lútea', 'Antes de la regla algunas sienten más cansancio, hambre o hinchazón. Hidrátate y descansa bien.']
  };
  function setFeel(v) {
    const f = store.get('feel') || {}; f[today] = v;
    const keys = Object.keys(f).sort(); while (keys.length > 120) delete f[keys.shift()];
    store.set('feel', f); renderCycleCard();
    try { renderPlan(); renderDay(current); } catch (e) {}
    if (window.__catMood) window.__catMood();
  }
  function periodToday() {
    const c = store.get('cycle'); if (!c) return;
    c.last = today; c.starts = (c.starts || []).filter(d => d !== today).concat(today).sort().slice(-8);
    const gaps = []; for (let i = 1; i < c.starts.length; i++) { const g = Math.round((Date.parse(c.starts[i]) - Date.parse(c.starts[i - 1])) / 864e5); if (g >= 21 && g <= 45) gaps.push(g); }
    if (gaps.length) { const last3 = gaps.slice(-3); c.len = Math.round(last3.reduce((a, b) => a + b, 0) / last3.length); }
    store.set('cycle', c); renderCycleCard();
    try { renderPlan(); } catch (e) {}
    toast('Registrado 🩸 Ajustamos tus próximas fechas');
  }
  function renderCycleCard() {
    const card = document.getElementById('cycleCard'); if (!card) return;
    const c = store.get('cycle') || {}, ci = cycleInfo(), pw = pregWeekNow();
    const feel = (store.get('feel') || {})[today] || '';
    const show = isPremium() && (pw || ci || c.track === 'irregular' || (c.track === 'si' && !(profile && profile.stage === 'embarazo')));
    card.hidden = !show; if (!show) return;
    const feelHTML = `<div class="feel"><p>¿Cómo te sientes hoy?</p><div class="pills">${[['alta', 'Con energía 💪'], ['normal', 'Normal 🙂'], ['baja', pw ? 'Cansada o con molestias 🌧️' : 'Cólicos o poca energía 🌧️']].map(([v, t]) => `<label class="pill"><input type="radio" name="feelToday" value="${v}"${feel === v ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div></div>`;
    let html = '';
    if (pw) {
      const tri = pw >= 28 ? 3 : pw >= 14 ? 2 : 1;
      const tip = { 1: 'Es normal sentir más cansancio o náuseas: haz lo que puedas y descansa cuando lo necesites.', 2: 'Desde ahora evitamos los ejercicios acostada de espalda. Muchas se sienten con más energía en este trimestre.', 3: 'Bajamos la intensidad y usamos apoyo para el equilibrio. Moverte suave sigue siendo muy bueno para ti.' }[tri];
      html = `<h3>🤰 Tu embarazo <small>${['', '1.er', '2.º', '3.er'][tri]} trimestre</small></h3>
        <div class="preg-week"><b>${pw}</b><div style="flex:1"><div style="font-size:.85rem;color:var(--ink-soft)">semanas de 40</div><div class="preg-bar"><i style="width:${Math.min(100, pw / 40 * 100).toFixed(0)}%"></i></div></div></div>
        <p class="cyc-note">${tip}</p>${feelHTML}
        <details class="cyc-note"><summary>Señales para detenerte y consultar</summary><ul class="warn-list"><li>Sangrado vaginal o pérdida de líquido</li><li>Contracciones dolorosas y seguidas</li><li>Mareo, desmayo o dolor de cabeza fuerte</li><li>Dolor en el pecho o falta de aire antes de esforzarte</li><li>Dolor o hinchazón en la pantorrilla</li></ul></details>`;
    } else if (ci) {
      const seg = [['menstrual', ci.per, '#F27AA8'], ['folicular', ci.ov - 2 - ci.per, '#FFD1E6'], ['ovulacion', 3, '#C9A8FF'], ['lutea', ci.len - ci.ov - 1, '#FFD9A8']];
      const ph = PHASES_TXT[ci.phase];
      html = `<h3>🌸 Tu ciclo <small>Día ${ci.day}${ci.late ? '' : ' de ' + ci.len}</small></h3>
        <div class="cyc-bar">${seg.map(([k, n, col]) => `<i style="width:${(Math.max(0, n) / ci.len * 100).toFixed(2)}%;background:${col}"></i>`).join('')}<span class="cyc-dot" style="left:${Math.min(98, ((Math.min(ci.day, ci.len) - .5) / ci.len * 100)).toFixed(1)}%"></span></div>
        <div class="cyc-legend"><span><b style="background:#F27AA8"></b>Regla</span><span><b style="background:#FFD1E6"></b>Folicular</span><span><b style="background:#C9A8FF"></b>Ovulación</span><span><b style="background:#FFD9A8"></b>Lútea</span></div>
        <p class="cyc-note"><b>${ph[0]}.</b> ${ph[1]} ${ci.late ? `<br>Tu regla está atrasada ${ci.day - ci.len} día${ci.day - ci.len === 1 ? '' : 's'} según tus fechas. Si te llegó, regístralo.` : `<br>Próxima regla en unos <b>${ci.next} día${ci.next === 1 ? '' : 's'}</b>.`}</p>
        ${feelHTML}
        <div class="cyc-actions"><button class="btn btn-ghost" type="button" id="periodToday">🩸 Me llegó hoy</button></div>
        <p class="cyc-note" style="font-size:.78rem">La fase del ciclo cambia muy poco el rendimiento en la mayoría de las mujeres: lo que más importa es cómo te sientes tú cada día.</p>`;
    } else {
      html = `<h3>🌸 Cómo te sientes</h3><p class="cyc-note">Cuéntanos cómo estás hoy y ajustamos tu rutina.</p>${feelHTML}`;
    }
    card.innerHTML = html;
    card.querySelectorAll('input[name="feelToday"]').forEach(i => i.addEventListener('change', () => setFeel(i.value)));
    const pt = card.querySelector('#periodToday'); if (pt) pt.addEventListener('click', periodToday);
  }
  // Ciclo: día actual, fase y próxima regla (todo calculado en el teléfono)
  function cycleInfo() {
    const c = store.get('cycle');
    if (!c || c.track !== 'si' || !c.last || (profile && profile.stage === 'embarazo') || !isPremium()) return null;
    const len = Math.min(45, Math.max(21, +c.len || 28)), per = Math.min(10, Math.max(2, +c.per || 5));
    const since = Math.round((Date.parse(today) - Date.parse(c.last)) / 864e5);
    if (since < 0) return null;
    const late = since >= len;
    const day = late ? since + 1 : (since % len) + 1;
    const ov = len - 14;
    const phase = day <= per ? 'menstrual' : day < ov - 1 ? 'folicular' : day <= ov + 1 ? 'ovulacion' : 'lutea';
    return { day, len, per, ov, phase, late, next: late ? 0 : len - day + 1 };
  }

  function fillForm() {
    pStart.value = start || today;
    renderProfSched();
    if (!profile) return;
    document.getElementById('pName').value = profile.name || '';
    document.getElementById('pAge').value = profile.age || '';
    document.getElementById('pWeight').value = profile.weight || '';
    document.getElementById('pHeight').value = profile.height || '';
    document.getElementById('pWaist').value = profile.waist || '';
    const setR = (n, v) => { const el = form.querySelector(`input[name="${n}"][value="${v}"]`); if (el) el.checked = true; };
    setR('ptime', profile.time || '60'); setR('pslot', profile.slot || 'tarde');
    setR('stage', profile.stage || 'ninguna');
    document.getElementById('pPregWeeks').value = profile.stage === 'embarazo' ? (pregWeekNow() || '') : '';
    const cyc = store.get('cycle') || {};
    setR('cycTrack', cyc.track || 'no');
    document.getElementById('pCycStart').value = cyc.last || '';
    document.getElementById('pCycLen').value = cyc.len || 28;
    document.getElementById('pPerLen').value = cyc.per || 5;
    updateCondFields(); setR('sleep', profile.sleep || 'bien'); setR('stress', profile.stress || 'bajo');
    const fp = foodPrefs();
    setR('fStyle', fp.style);
    const setC = (n, arr) => form.querySelectorAll(`input[name="${n}"]`).forEach(b => { b.checked = (arr || []).includes(b.value); });
    setC('pain', profile.pain); setC('parq', profile.parq); setC('fAllergy', fp.allergy); setC('fDislike', fp.dislike);
    form.querySelectorAll('input[name="equip"]').forEach(b => { b.checked = (profile.equip || []).includes(b.value); });
    const fq = form.querySelector(`input[name="freq"][value="${profile.freq || 3}"]`);
    if (fq) fq.checked = true;
    updateFreqNote();
    renderProfSched();
    const ps = form.querySelector(`input[name="psched"][value="${schedule}"]`); if (ps) ps.checked = true;
    const exp = form.querySelector(`input[name="exp"][value="${profile.exp}"]`);
    if (exp) exp.checked = true;
    setR('expTime', profile.expTime || 'lt6'); setR('split', profile.split || 'otro');
    const lf = profile.lifts || {};
    [['lSq', 'sq'], ['lBp', 'bp'], ['lRow', 'row'], ['lDl', 'dl'], ['lOhp', 'ohp']].forEach(([id, k]) => { document.getElementById(id).value = lf[k] || ''; });
    updateExpBox();
    goalBoxes.forEach(b => { b.checked = (profile.goals || []).includes(b.value); });
    updateGoalLimits();
  }

  const radioVal = (n, d) => (form.querySelector(`input[name="${n}"]:checked`) || {}).value || d;
  const checkVals = n => Array.from(form.querySelectorAll(`input[name="${n}"]:checked`)).map(b => b.value);
  ['pAge', 'pWeight', 'pHeight'].forEach(id => document.getElementById(id).addEventListener('input', e => { e.target.classList.remove('bad'); e.target.removeAttribute('aria-invalid'); }));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const goals = goalBoxes.filter(b => b.checked).map(b => b.value);
    // Edad, peso y estatura: obligatorios y dentro de rangos razonables
    const BODY = [['pAge', 14, 99, 'tu edad (entre 14 y 99 años)'], ['pWeight', 35, 250, 'tu peso (entre 35 y 250 kg)'], ['pHeight', 120, 220, 'tu estatura (entre 120 y 220 cm)']];
    const badB = BODY.filter(([id, lo, hi]) => { const v = parseFloat(String(document.getElementById(id).value).replace(',', '.')); return !(v >= lo && v <= hi); });
    BODY.forEach(([id]) => { const el = document.getElementById(id); const bad = badB.some(b => b[0] === id); el.classList.toggle('bad', bad); el.setAttribute('aria-invalid', bad); });
    if (badB.length) {
      formError.textContent = 'Completa ' + (badB.length > 1 ? badB.slice(0, -1).map(b => b[3]).join(', ') + ' y ' + badB[badB.length - 1][3] : badB[0][3]) + '. Lo usamos para calcular tus comidas.';
      const f = document.getElementById(badB[0][0]); f.focus(); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    if (!goals.length) { formError.textContent = 'Elige al menos un objetivo para ver tu plan.'; return; }
    if (radioVal('stage', 'ninguna') === 'embarazo' && isPremium()) { const w = parseInt(document.getElementById('pPregWeeks').value, 10); if (!(w >= 1 && w <= 42)) { formError.textContent = 'Cuéntanos de cuántas semanas estás (entre 1 y 42).'; document.getElementById('pPregWeeks').focus(); return; } }
    formError.textContent = '';
    profile = {
      name: document.getElementById('pName').value.trim(),
      age: document.getElementById('pAge').value,
      weight: document.getElementById('pWeight').value,
      height: document.getElementById('pHeight').value,
      equip: Array.from(form.querySelectorAll('input[name="equip"]:checked')).map(b => b.value),
      exp: (form.querySelector('input[name="exp"]:checked') || {}).value || 'nunca',
      freq: +((form.querySelector('input[name="freq"]:checked') || {}).value || 3),
      goals,
      waist: document.getElementById('pWaist').value,
      time: radioVal('ptime', '60'), slot: radioVal('pslot', 'tarde'),
      stage: radioVal('stage', 'ninguna'), sleep: radioVal('sleep', 'bien'), stress: radioVal('stress', 'bajo'),
      pain: checkVals('pain'), parq: checkVals('parq')
    };
    if (profile.exp !== 'nunca') {
      const kg = id => { const v = parseFloat(document.getElementById(id).value); return v > 0 && v <= 450 ? Math.round(v * 2) / 2 : 0; };
      profile.expTime = radioVal('expTime', 'lt6'); profile.split = radioVal('split', 'otro');
      profile.lifts = { sq: kg('lSq'), bp: kg('lBp'), row: kg('lRow'), dl: kg('lDl'), ohp: kg('lOhp') };
      const pv = store.get('profile'); profile.routineChoice = (pv && pv.routineChoice) || '';
    }
    const pw = parseInt(document.getElementById('pPregWeeks').value, 10);
    if (profile.stage === 'embarazo') { if (pw >= 1 && pw <= 42) { profile.pregWeeks = pw; profile.pregDate = today; } }
    const tr = radioVal('cycTrack', 'no'), old = store.get('cycle') || {};
    const last = document.getElementById('pCycStart').value;
    const cyc = { track: tr, last: last && last <= today ? last : old.last || '', len: Math.min(45, Math.max(21, parseInt(document.getElementById('pCycLen').value, 10) || 28)), per: Math.min(10, Math.max(2, parseInt(document.getElementById('pPerLen').value, 10) || 5)), starts: old.starts || [] };
    if (cyc.last && !cyc.starts.includes(cyc.last)) cyc.starts = cyc.starts.concat(cyc.last).sort().slice(-8);
    store.set('cycle', cyc);
    setTimeout(renderCycleCard, 0);
    if (profile.waist && !profile.waistStart) profile.waistStart = { cm: profile.waist, date: today };
    const prev = store.get('profile');
    if (prev && prev.waistStart) profile.waistStart = prev.waistStart;
    store.set('profile', profile);
    if (window.__rw) { window.__rw.check(); if (window.__rw.autoHour) window.__rw.autoHour(); if (window.__rw.sync) setTimeout(window.__rw.sync, 50); }
    store.set('foodPrefs', { style: radioVal('fStyle', 'todo'), allergy: checkVals('fAllergy'), dislike: checkVals('fDislike') });
    renderFood();
    // Fecha de inicio y días, elegidos en el mismo formulario
    const firstStart = !start;
    const newStart = pStart.value || today;
    if (newStart !== start) { exDone = {}; store.set('exDone2', exDone); }
    start = newStart; store.set('programStart', start);
    schedule = radioVal('psched', schedule); fixSchedule(); store.set('schedule', schedule);
    phaseOpen = false; renderStarter();
    week = autoWeek();
    profileHidden = false; store.set('profileHidden', false);
    renderPlan();
    renderMode();
    renderSchedPills(); buildTabs(); renderPhase(); selectTab(defaultTab());
    if (firstStart) toast('¡Listo! Tu plan empieza ' + (start === today ? 'hoy' : 'el ' + fmtISO(start)) + ' ✨', 'level');
    planCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  planCard.addEventListener('click', (ev) => {
    const ch = ev.target.closest('[data-choice]');
    if (ch && profile) {
      profile.routineChoice = ch.dataset.choice; store.set('profile', profile);
      myEditing = false; week = autoWeek();
      renderPlan(); buildTabs(); renderPhase(); selectTab(defaultTab()); renderMode();
      if (window.__rw && window.__rw.sync) window.__rw.sync();
      toast('✓ Tu rutina: ' + choiceName(), 'level');
      setTimeout(() => { const o = document.querySelector('.opt.on'); if (o) o.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
      return;
    }
    if (ev.target.closest('#hideProfile')) { profileHidden = true; store.set('profileHidden', true); renderPlan(); return; }
    if (ev.target.closest('#editProfile')) {
      fillForm();
      planCard.hidden = true; form.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  fillForm();
  updateCondFields();
  renderCycleCard();
  updateFreqNote();
  fixSchedule();
  updateTabLabels();
  renderStarter();
  renderPlan();
  // Primera vez con niveles: sumar lo que ya tenía marcado.
  if (store.get('xp') === null) {
    const exCount = Object.values(exDone).reduce((a, v) => a + countDone(v), 0);
    xp = exCount * 10 + boxes.filter(b => b.checked).length * 5;
    store.set('xp', xp);
    renderLevel();
  }
  renderPhase();
  renderMode();
  selectTab(defaultTab());


  // ---------- Comida: ideas según el perfil ----------
  function foodPrefs() {
    return Object.assign({ style: 'todo', allergy: [], dislike: [] }, store.get('foodPrefs') || {});
  }
  function renderFood() {
    const F = {
      veg: [['🥬','Lechuga',[]],['🥕','Zanahoria',[]],['🍅','Tomate',[]],['🥦','Brócoli',['brocoli']],['🥒','Pepino',[]],['🫑','Pimentón',[]],['🥑','Palta',['palta']]],
      pro: [['🍗','Pollo',['pollo','carne']],['🥩','Carne magra',['roja','carne']],['🐟','Pescado',['pescado','carne']],['🍳','Huevos',['huevo','animal']],['🫘','Legumbres',['legumbres']],['🧀','Quesillo',['lactosa','animal']],['🥛','Yogur natural',['lactosa','animal']],['🌱','Tofu',['soya']],['🌾','Seitán',['gluten']]],
      carb: [['🍚','Arroz',[]],['🥔','Papa',[]],['🍠','Camote',[]],['🌽','Choclo',[]],['🍞','Pan integral',['gluten']],['🍝','Fideos',['gluten']],['🌾','Quinoa',[]]],
      pre: [['🍌','Plátano',['platano']],['🥣','Avena con fruta',['avena','gluten']],['🍞','Pan con palta',['gluten','palta']],['🥛','Yogur con fruta',['lactosa','animal']],['🍎','Manzana con mantequilla de maní',['frutos']],['🍘','Galletas de arroz con palta',['palta']],['🍓','Fruta picada',[]]],
      post: [['🍳','Huevos con pan',['huevo','animal','gluten']],['🍗','Pollo con arroz',['pollo','carne']],['🐟','Pescado con papas',['pescado','carne']],['🫘','Lentejas con arroz',['legumbres']],['🥛','Yogur con fruta',['lactosa','animal']],['🌱','Tofu salteado con quinoa',['soya']],['🥤','Batido de leche de soya y plátano',['soya','platano']],['🥩','Carne con camote',['roja','carne']]],
      snack: [['🥜','Frutos secos',['frutos']],['🍏','Fruta',[]],['🧀','Quesillo',['lactosa','animal']],['🥚','Huevo duro',['huevo','animal']],['🥕','Zanahoria con hummus',['legumbres']],['🍘','Galletas de arroz',[]],['🫛','Edamame',['soya']]]
    };
    const prefs = foodPrefs();
    const $ = id => document.getElementById(id);
    const ex = new Set([...prefs.allergy, ...prefs.dislike]);
    if (prefs.style === 'vegetariana') ex.add('carne');
    if (prefs.style === 'vegana') { ex.add('carne'); ex.add('animal'); }
    const list = k => F[k].filter(item => !item[2].some(t => ex.has(t)));
    const chipHTML = arr => arr.length
      ? arr.map(i => `<span>${i[0]} ${esc(i[1])}</span>`).join('')
      : '<span class="empty">Sin ideas con tus filtros: pide opciones a un nutricionista</span>';
    $('chipsPre').innerHTML = chipHTML(list('pre'));
    $('chipsPost').innerHTML = chipHTML(list('post'));
    $('chipsSnack').innerHTML = chipHTML(list('snack'));
    const names = arr => arr.length ? arr.map(i => i[1]).join(', ') : 'Consulta opciones con un nutricionista';
    const v = list('veg'), p = list('pro'), c = list('carb');
    $('legVeg').textContent = names(v); $('legPro').textContent = names(p); $('legCarb').textContent = names(c);
    const pos = { veg: [[146,62],[160,100],[146,138],[118,84],[118,118]], pro: [[52,128],[78,156],[66,118]], carb: [[52,72],[78,44],[66,82]] };
    let g = '';
    [['veg', v], ['pro', p], ['carb', c]].forEach(([k, arr]) => arr.slice(0, pos[k].length).forEach((it, n) => {
      g += `<text x="${pos[k][n][0]}" y="${pos[k][n][1]}">${it[0]}</text>`;
    }));
    $('plateEmojis').innerHTML = g;
    const styleTxt = { todo: 'Como de todo', vegetariana: 'Vegetariano', vegana: 'Vegano' }[prefs.style];
    const labels = { lactosa: 'lactosa', gluten: 'gluten', frutos: 'frutos secos', huevo: 'huevo', pescado: 'pescado', soya: 'soya', pollo: 'pollo', roja: 'carne roja', legumbres: 'legumbres', palta: 'palta', platano: 'plátano', avena: 'avena', brocoli: 'brócoli' };
    const sin = [...new Set([...prefs.allergy, ...prefs.dislike])].map(k => labels[k]);
    $('prefSummary').textContent = styleTxt + (sin.length ? ' · sin ' + sin.join(', ') : '');
    const notes = [];
    if (prefs.allergy.length) notes.push('⚠️ Con alergias, revisa siempre las etiquetas: muchos productos tienen trazas.');
    if (prefs.style === 'vegana') notes.push('🌱 Si eres vegano, consulta con tu médico o nutricionista sobre la vitamina B12.');
    if (profile && profile.stage === 'embarazo') notes.push('🤰 En el embarazo evita pescados crudos, quesos sin pasteurizar y carnes poco cocidas. Tu matrona o médico te puede orientar.');
    $('foodAlert').hidden = !notes.length; $('foodAlert').innerHTML = notes.join('<br>');
    const SLOT = {
      manana: '🌅 Entrenas en la mañana: si no tienes hambre al despertar, basta algo pequeño como un plátano o un yogur 30 a 60 minutos antes, y desayuna bien después.',
      tarde: '☀️ Entrenas en la tarde: una colación 1 a 2 horas antes te dará energía, y tu cena puede ser tu comida de recuperación.',
      noche: '🌙 Entrenas en la noche: cena después de entrenar con proteína y algo liviano, para dormir bien.'
    };
    const pre = list('pre'), post = list('post'), snack = list('snack');
    const TIPS = [
      pre.length && `Antes de entrenar prueba ${pre[0][0]} ${pre[0][1].toLowerCase()}: energía sin pesadez.`,
      post.length && `Después de entrenar: ${post[0][0]} ${post[0][1].toLowerCase()}. Tus músculos te lo agradecen.`,
      snack.length && `Colación de hoy: ${snack[snack.length > 1 ? 1 : 0][0]} ${snack[snack.length > 1 ? 1 : 0][1].toLowerCase()}. Fácil de llevar.`,
      'La mitad de tu plato, verduras. Así de simple. 🥗',
      'Un vaso de agua antes de entrenar ayuda mucho. 💧',
      'Si un día comes de más, no pasa nada. Mañana sigues igual. 👊'
    ].filter(Boolean);
    $('mascotSay').dataset.daily = TIPS[Math.floor(parseISO(today) / 864e5) % TIPS.length];
    if (window.__catMood) window.__catMood(); else $('mascotSay').textContent = $('mascotSay').dataset.daily;
    const sl = profile && SLOT[profile.slot];
    $('slotNote').hidden = !sl; $('slotNote').textContent = sl || '';
    if (typeof renderMenu === 'function') renderMenu();
  }
  // ---------- Menú del día con porciones de mano ----------
  // Etiquetas: carne (pollo, vacuno, pescado), animal (huevo, lácteos), y las de alergias y gustos
  const FTAG = { pollo: ['pollo', 'carne'], roja: ['roja', 'carne'], pescado: ['pescado', 'carne'], huevo: ['huevo', 'animal'], lac: ['lactosa', 'animal'], soya: ['soya'], leg: ['legumbres'], glu: ['gluten'], avena: ['avena', 'gluten'], palta: ['palta'], platano: ['platano'], frutos: ['frutos'], brocoli: ['brocoli'] };
  const fd = (label, ...tags) => [label, [].concat(...tags.map(t => FTAG[t] || []))];
  // [plato, { pro, carb, veg, fat }]
  const MEALS = {
    des: [
      ['Marraqueta con palta y huevo revuelto', { pro: fd('Huevos', 'huevo'), carb: fd('Marraqueta', 'glu'), fat: fd('Palta', 'palta') }],
      ['Avena con leche, plátano y maní', { pro: fd('Leche o yogur natural', 'lac'), carb: fd('Avena y plátano', 'avena', 'platano'), fat: fd('Mantequilla de maní', 'frutos') }],
      ['Pan integral con quesillo y tomate', { pro: fd('Quesillo', 'lac'), carb: fd('Pan integral', 'glu'), fat: fd('Nueces', 'frutos') }],
      ['Yogur griego con granola y frutillas', { pro: fd('Yogur griego', 'lac'), carb: fd('Granola y frutillas', 'avena'), fat: fd('Almendras', 'frutos') }],
      ['Huevos revueltos con papas salteadas', { pro: fd('Huevos', 'huevo'), carb: fd('Papas', ''), fat: fd('Aceite de oliva') }],
      ['Tostadas con tofu revuelto y palta', { pro: fd('Tofu', 'soya'), carb: fd('Pan integral', 'glu'), fat: fd('Palta', 'palta') }],
      ['Batido de leche de soya, plátano y avena', { pro: fd('Leche de soya', 'soya'), carb: fd('Plátano y avena', 'platano', 'avena'), fat: fd('Mantequilla de maní', 'frutos') }],
      ['Quinoa con leche de soya y fruta', { pro: fd('Leche de soya', 'soya'), carb: fd('Quinoa y fruta'), fat: fd('Semillas de chía') }],
      ['Tofu revuelto con papas salteadas', { pro: fd('Tofu', 'soya'), carb: fd('Papas'), fat: fd('Palta', 'palta') }],
      ['Panqueques de avena con huevo y fruta', { pro: fd('Huevos', 'huevo'), carb: fd('Avena y fruta', 'avena'), fat: fd('Nueces', 'frutos') }]
    ],
    alm: [
      ['Pollo a la plancha con arroz y ensalada chilena', { pro: fd('Pollo', 'pollo'), carb: fd('Arroz'), veg: fd('Ensalada chilena (tomate y cebolla)'), fat: fd('Palta', 'palta') }],
      ['Porotos con riendas', { pro: fd('Porotos', 'leg'), carb: fd('Tallarines', 'glu'), veg: fd('Zapallo y ensalada de lechuga'), fat: fd('Aceite de oliva') }],
      ['Cazuela de vacuno', { pro: fd('Carne de vacuno', 'roja'), carb: fd('Papa y choclo'), veg: fd('Zapallo y porotos verdes'), fat: fd('Aceite de oliva') }],
      ['Lentejas con arroz', { pro: fd('Lentejas', 'leg'), carb: fd('Arroz'), veg: fd('Ensalada de repollo y zanahoria'), fat: fd('Aceite de oliva') }],
      ['Pescado al horno con papas cocidas', { pro: fd('Merluza o reineta', 'pescado'), carb: fd('Papas'), veg: fd('Ensalada de lechuga y pepino'), fat: fd('Aceite de oliva') }],
      ['Charquicán', { pro: fd('Carne molida', 'roja'), carb: fd('Papa y zapallo'), veg: fd('Choclo y arvejas'), fat: fd('Aceite de oliva') }],
      ['Garbanzos salteados con quinoa', { pro: fd('Garbanzos', 'leg'), carb: fd('Quinoa'), veg: fd('Espinaca y pimentón'), fat: fd('Aceite de oliva') }],
      ['Tofu salteado con arroz y verduras', { pro: fd('Tofu', 'soya'), carb: fd('Arroz'), veg: fd('Brócoli y zanahoria', 'brocoli'), fat: fd('Maní', 'frutos') }],
      ['Fideos con salsa boloñesa', { pro: fd('Carne molida', 'roja'), carb: fd('Fideos', 'glu'), veg: fd('Ensalada de lechuga y tomate'), fat: fd('Aceite de oliva') }],
      ['Pollo arvejado con arroz', { pro: fd('Pollo', 'pollo'), carb: fd('Arroz'), veg: fd('Arvejas y zanahoria'), fat: fd('Aceite de oliva') }]
    ],
    once: [
      ['Marraqueta con quesillo y tomate', { pro: fd('Quesillo', 'lac'), carb: fd('Marraqueta', 'glu'), fat: fd('Palta', 'palta') }],
      ['Pan pita con huevo duro y palta', { pro: fd('Huevo duro', 'huevo'), carb: fd('Pan pita', 'glu'), fat: fd('Palta', 'palta') }],
      ['Yogur con fruta y nueces', { pro: fd('Yogur natural', 'lac'), carb: fd('Fruta de la estación'), fat: fd('Nueces', 'frutos') }],
      ['Galletas de arroz con hummus', { pro: fd('Hummus', 'leg'), carb: fd('Galletas de arroz'), fat: fd('Aceitunas') }],
      ['Sándwich de pavo y palta', { pro: fd('Jamón de pavo', 'pollo'), carb: fd('Pan integral', 'glu'), fat: fd('Palta', 'palta') }],
      ['Plátano con mantequilla de maní y leche', { pro: fd('Leche', 'lac'), carb: fd('Plátano', 'platano'), fat: fd('Mantequilla de maní', 'frutos') }],
      ['Edamame y fruta', { pro: fd('Edamame', 'soya'), carb: fd('Fruta de la estación'), fat: fd('Almendras', 'frutos') }],
      ['Huevos duros con papas cocidas', { pro: fd('Huevo duro', 'huevo'), carb: fd('Papas'), fat: fd('Aceite de oliva') }]
    ],
    cena: [
      ['Omelette de verduras con pan integral', { pro: fd('Huevos', 'huevo'), carb: fd('Pan integral', 'glu'), veg: fd('Espinaca, tomate y cebolla'), fat: fd('Aceite de oliva') }],
      ['Pollo al horno con camote y ensalada', { pro: fd('Pollo', 'pollo'), carb: fd('Camote'), veg: fd('Ensalada verde'), fat: fd('Palta', 'palta') }],
      ['Salmón con quinoa y verduras', { pro: fd('Salmón', 'pescado'), carb: fd('Quinoa'), veg: fd('Zapallo italiano y espárragos'), fat: fd('Aceite de oliva') }],
      ['Wrap de pollo', { pro: fd('Pollo', 'pollo'), carb: fd('Tortilla integral', 'glu'), veg: fd('Lechuga y tomate'), fat: fd('Palta', 'palta') }],
      ['Tortilla de acelga con papas cocidas', { pro: fd('Huevos', 'huevo'), carb: fd('Papas'), veg: fd('Acelga y ensalada'), fat: fd('Aceite de oliva') }],
      ['Ensalada de garbanzos con atún', { pro: fd('Atún en agua', 'pescado'), carb: fd('Garbanzos', 'leg'), veg: fd('Lechuga, pepino y tomate'), fat: fd('Aceite de oliva') }],
      ['Tofu a la plancha con arroz integral', { pro: fd('Tofu', 'soya'), carb: fd('Arroz integral'), veg: fd('Verduras salteadas'), fat: fd('Semillas de sésamo') }],
      ['Lentejas guisadas con verduras', { pro: fd('Lentejas', 'leg'), carb: fd('Arroz'), veg: fd('Zanahoria, zapallo y espinaca'), fat: fd('Aceite de oliva') }],
      ['Carne a la plancha con puré rústico', { pro: fd('Posta o filete de vacuno', 'roja'), carb: fd('Papas'), veg: fd('Ensalada de tomate'), fat: fd('Aceite de oliva') }]
    ]
  };

  // Reemplazos equivalentes (misma porción de mano): si no tienes uno, usa otro del mismo grupo
  const SWAP_GROUPS = [
    { re: /avena|granola|quinoa y fruta/i, items: [['Avena', 'avena'], ['Granola sin azúcar', 'avena'], ['Quinoa cocida'], ['Pan integral', 'glu'], ['Arroz cocido']] },
    { re: /marraqueta|hallulla|pan |pan$|pita|tortilla integral|galletas de arroz/i, items: [['Marraqueta', 'glu'], ['Pan integral', 'glu'], ['Pan pita', 'glu'], ['Hallulla', 'glu'], ['Tortilla de maíz'], ['Galletas de arroz'], ['Papa cocida']] },
    { re: /papa|arroz|fideos|tallarines|camote|quinoa|choclo/i, items: [['Papa'], ['Arroz'], ['Fideos', 'glu'], ['Camote'], ['Quinoa'], ['Choclo'], ['Mote', 'glu']] },
    { re: /fruta|plátano|frutilla/i, items: [['Plátano', 'platano'], ['Manzana'], ['Naranja'], ['Frutillas'], ['Pera'], ['Kiwi']] },
    { re: /^huevo/i, items: [['Quesillo', 'lac'], ['Atún en agua', 'pescado'], ['Jamón de pavo', 'pollo'], ['Tofu', 'soya'], ['Yogur griego', 'lac']] },
    { re: /tofu|tempeh/i, items: [['Tempeh', 'soya'], ['Lentejas o garbanzos', 'leg'], ['Huevos', 'huevo'], ['Seitán', 'glu']] },
    { re: /lentejas|porotos|garbanzos|hummus|edamame/i, items: [['Lentejas', 'leg'], ['Porotos', 'leg'], ['Garbanzos', 'leg'], ['Tofu', 'soya'], ['Huevos', 'huevo']] },
    { re: /leche|yogur|quesillo/i, items: [['Yogur natural', 'lac'], ['Leche descremada', 'lac'], ['Quesillo', 'lac'], ['Leche o yogur sin lactosa', 'huevo-free'], ['Leche de soya', 'soya'], ['Yogur de soya', 'soya', 'yogur de soya']] },
    { re: /pollo|pavo|vacuno|carne|posta|filete|merluza|reineta|salmón|atún|pescado/i, items: [['Pollo', 'pollo'], ['Pavo', 'pollo'], ['Carne magra de vacuno', 'roja', 'vacuno'], ['Pescado', 'pescado'], ['Huevos', 'huevo'], ['Tofu', 'soya'], ['Legumbres', 'leg']] },
    { re: /palta|aceite|nueces|almendras|maní|aceitunas|semillas|chía|sésamo/i, items: [['Palta', 'palta'], ['Aceite de oliva'], ['Nueces', 'frutos'], ['Almendras', 'frutos'], ['Aceitunas'], ['Semillas de chía o maravilla']] }
  ];
  FTAG['huevo-free'] = ['animal'];
  function altsFor(label, kind) {
    if (kind === 'veg') return 'cualquier verdura que tengas: lechuga, tomate, pepino, zapallo, espinaca o repollo';
    const g = SWAP_GROUPS.find(x => x.re.test(label)); if (!g) return '';
    const ex = excludedTags(), base = label.toLowerCase();
    const ok = g.items.filter(([n, t, key]) => !base.includes(key || n.toLowerCase().split(' ')[0]) && !(t ? FTAG[t] || [] : []).some(x => ex.has(x)));
    return ok.slice(0, 3).map(([n]) => n.toLowerCase()).join(', ');
  }
  const MEAL_NAME = { des: ['🌅', 'Desayuno'], alm: ['🍽️', 'Almuerzo'], once: ['☕', 'Once o colación'], cena: ['🌙', 'Cena'] };
  // Porciones base por comida (hombre de ~80 kg, manteniendo peso): [palmas, manos ahuecadas, puños, pulgares]
  
  const HAND = [['✋', 'palma', 'palmas', 'Proteína'], ['🤲', 'mano ahuecada', 'manos ahuecadas', 'Carbohidratos'], ['✊', 'puño', 'puños', 'Verduras'], ['👍', 'pulgar', 'pulgares', 'Grasas']];
  // Etapa de alimentación: la elige la persona o sale de sus objetivos del perfil
  const PHASE_TXT = { bajar: ['🔥', 'Déficit'], mantener: ['🎯', 'Mantener'], ganar: ['💪', 'Volumen'], recomp: ['⚖️', 'Recomposición'] };
  function goalFromProfile() {
    const g = (profile && profile.goals) || [];
    const lose = g.includes('bajar'), gain = g.includes('gluteos') || g.includes('tonificar');
    return lose && gain ? 'recomp' : lose ? 'bajar' : gain ? 'ganar' : 'mantener';
  }
  function foodGoal() { const v = store.get('foodPhase'); return PHASE_TXT[v] ? v : goalFromProfile(); }
  const GOAL_FOOD = {
    bajar: 'Déficit de alrededor de 20 %: deberías bajar 0,5 a 1 % de tu peso por semana.',
    mantener: 'Calorías de mantención: tu peso debería quedarse estable (±1 kg).',
    ganar: 'Superávit pequeño, de alrededor de 10 %: deberías subir 0,25 a 0,5 % de tu peso por semana.',
    recomp: 'Déficit leve, de alrededor de 10 %, con proteína alta: para bajar grasa y ganar músculo a la vez. Funciona mejor si recién empiezas o vuelves después de una pausa.'
  };
  function bodyKg() {
    const m = (store.get('measures') || []).filter(x => x.w > 0).slice(-1)[0];
    const w = parseFloat((m && m.w) || (profile && profile.weight));
    return w >= 35 && w <= 250 ? w : 78;
  }
  // Valores aproximados de una porción de mano (hombre adulto)
  const HAND_KCAL = [120, 110, 25, 100], HAND_PRO = 24;
  // ---------- Gasto diario ----------
  // Con edad y estatura: Mifflin–St Jeor (hombre) × actividad del día + entrenamiento.
  // Sin esos datos: peso × 28 a 37 kcal. Luego se corrige cada semana con el peso real.
  const ACT = { sentado: ['🪑', 'Sentado casi todo el día', 1.25, -2], pie: ['🚶', 'De pie o caminando harto', 1.4, 0], fisico: ['🏗️', 'Trabajo físico pesado', 1.55, 3] };
  function actNow() { const a = store.get('activity'); return ACT[a] ? a : 'sentado'; }
  function bmrOf(w) {
    const a = +(profile && profile.age), h = +(profile && profile.height);
    return a >= 14 && a <= 99 && h >= 120 && h <= 220 ? 10 * w + 6.25 * h - 5 * a + 5 : 0;
  }
  // Proteína por kilo según la etapa; con mucho peso se calcula sobre un peso de referencia
  const PRO_KG = { bajar: 2.2, recomp: 2, mantener: 1.8, ganar: 1.8 };
  function proteinBase(w) {
    const h = +(profile && profile.height);
    if (h >= 120 && h <= 220) { const ref = 27 * (h / 100) ** 2; if (w > ref) return ref; }
    return w;
  }
  function baseTdee() {
    const w = bodyKg(), fq = freqOf(), A = ACT[actNow()], b = bmrOf(w);
    return b ? b * (A[2] + .035 * fq) : w * ((fq <= 2 ? 30 : fq <= 4 ? 32 : 34) + A[3]);
  }
  const GOAL_MULT = { bajar: .8, recomp: .9, mantener: 1, ganar: 1.1 };
  function kcalAdj() { const a = store.get('kcalAdj'); return a && Number.isFinite(a.adj) ? a.adj : 0; }
  function dayTargets() {
    const w = bodyKg(), g = foodGoal();
    const tdee = Math.max(1500, baseTdee() + kcalAdj());
    const kcal = tdee * GOAL_MULT[g];
    const proG = proteinBase(w) * PRO_KG[g];
    const palms = proG / HAND_PRO, veg = g === 'bajar' ? 5 : 4;
    const thumbs = kcal * (g === 'bajar' ? .25 : .27) / HAND_KCAL[3];
    const cupped = Math.max(3, (kcal - palms * HAND_KCAL[0] - veg * HAND_KCAL[2] - thumbs * HAND_KCAL[3]) / HAND_KCAL[1]);
    return { tdee, kcal, proG, gkg: PRO_KG[g], tot: [palms, cupped, veg, thumbs] };
  }

  // ---------- Ajuste semanal con el peso real ----------
  // Cada lunes compara el peso promedio de la semana pasada con el de la anterior.
  // Ritmo esperado, en % del peso por semana:
  const RATE = { bajar: [-1, -.5], recomp: [-.5, 0], mantener: [-.3, .3], ganar: [.25, .5] };
  const WEEK = 7 * 864e5;
  const isoD = t => new Date(t).toISOString().slice(0, 10);
  function weighIns(monT) {
    return (store.get('measures') || []).filter(m => m.w > 0 && m.d && parseISO(m.d) >= monT && parseISO(m.d) < monT + WEEK).map(m => m.w);
  }
  function weekAvg(monT) { const v = weighIns(monT); return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, n: v.length } : null; }
  function adherence(monT) {
    const L = store.get('foodLog') || {}; let n = 0, sum = 0;
    for (let i = 0; i < 7; i++) { const d = isoD(monT + i * 864e5); if (L[d] != null) { n++; sum += L[d]; } }
    return n ? { n, avg: sum / n } : null;
  }
  const kgS = x => String(Math.round(Math.abs(x) * 10) / 10).replace('.', ',');
  function weeklyCheck() {
    const thisMon = mondayOf(today), lastMon = thisMon - WEEK, prevMon = lastMon - WEEK;
    const A = store.get('kcalAdj') || { adj: 0, hist: [] };
    if (!Array.isArray(A.hist)) A.hist = [];
    if (A.done === isoD(thisMon)) return null;
    A.done = isoD(thisMon);
    const cur = weekAvg(lastMon), prev = weekAvg(prevMon);
    if (!cur && !prev) { store.set('kcalAdj', A); return null; } // sin pesajes: nada que decir
    const g = foodGoal(), [lo, hi] = RATE[g];
    const e = { w: isoD(lastMon), g, step: 0 };
    if (!cur || cur.n < 2 || !prev) e.res = 'datos';
    else {
      e.avg = Math.round(cur.avg * 10) / 10; e.diff = cur.avg - prev.avg; e.rate = e.diff / prev.avg * 100;
      const ad = adherence(lastMon);
      if (ad && ad.n >= 3 && ad.avg < .8) e.res = 'adh';
      else if (e.rate < lo || e.rate > hi) {
        const off = e.rate < lo ? lo - e.rate : e.rate - hi;
        const want = (e.rate < lo ? 1 : -1) * (off > .3 ? 150 : 100);       // kcal que se suman o restan al menú
        const next = Math.max(-600, Math.min(600, A.adj + want / GOAL_MULT[g]));
        e.step = Math.round((next - A.adj) * GOAL_MULT[g]);
        e.res = e.step ? 'ajuste' : 'tope';
        A.adj = next;
      } else e.res = 'ok';
    }
    A.hist.push(e); A.hist = A.hist.slice(-16); A.last = e;
    store.set('kcalAdj', A);
    return e;
  }
  function adjText(e) {
    if (!e) return '';
    const mv = e.diff == null ? '' : Math.abs(e.diff) < .05 ? 'Tu peso promedio no cambió' : `Tu peso promedio ${e.diff < 0 ? 'bajó' : 'subió'} ${kgS(e.diff)} kg (${String(Math.round(Math.abs(e.rate) * 10) / 10).replace('.', ',')} %)`;
    const hands = n => { const c = Math.round(Math.abs(n) / 55) / 2; return c >= .5 ? ` (≈ ${half(c)} mano${c > 1 ? 's' : ''} ahuecada${c > 1 ? 's' : ''} de carbohidratos al día)` : ''; };
    if (e.res === 'datos') return 'La semana pasada no alcanzamos a ajustar tu menú: necesitamos al menos 2 pesajes por semana. Mantenemos tus porciones.';
    if (e.res === 'adh') return `${mv}. Como esa semana costó seguir el menú, no lo cambiamos: primero intenta seguirlo unos días más.`;
    if (e.res === 'ok') return `${mv}: justo el ritmo de tu etapa. 👌 Mantenemos tu menú.`;
    if (e.res === 'tope') return `${mv}. Ya ajustamos tu menú todo lo que es razonable; si sigue igual, conviene revisarlo con un nutricionista.`;
    const why = { bajar: e.step > 0 ? 'más rápido de lo sano' : 'menos de lo esperado', recomp: e.step > 0 ? 'más rápido de lo ideal' : 'menos de lo esperado', mantener: 'fuera del rango para mantener', ganar: e.step > 0 ? 'menos de lo esperado' : 'más rápido de lo ideal (puede ser grasa)' }[e.g];
    const why2 = Math.abs(e.diff) < .05 ? `y en tu etapa debería ${e.step > 0 ? 'subir' : 'bajar'} un poco` : why;
    return `${mv}, ${why2}. ${e.step > 0 ? 'Subimos' : 'Bajamos'} tu menú ≈ ${e.step > 0 ? '+' : '−'}${Math.abs(e.step)} kcal${hands(e.step)}.`;
  }
  // Reparto del día: [proteína, carbohidratos, verduras, grasas] por comida
  const SHARE = { des: [.22, .25, 0, .25], alm: [.3, .3, .5, .25], once: [.18, .2, 0, .25], cena: [.3, .25, .5, .25] };
  function allPortions() {
    const dt = dayTargets(), t = dt.tot, r = x => Math.round(x * 2) / 2;
    const P = {};
    Object.keys(SHARE).forEach(m => { P[m] = t.map((v, i) => (SHARE[m][i] ? Math.max(i === 0 ? 1 : .5, r(v * SHARE[m][i])) : 0)); });
    // Al redondear a medias porciones el total se desvía: se corrige con los carbohidratos, de a ½
    const kcalOf = () => Object.values(P).reduce((a, p) => a + p.reduce((b, v, i) => b + v * HAND_KCAL[i], 0), 0);
    for (let k = 0; k < 12; k++) {
      const diff = kcalOf() - dt.kcal; if (Math.abs(diff) <= HAND_KCAL[1] / 2) break;
      const ms = Object.keys(P).sort((a, b) => (diff > 0 ? P[b][1] - P[a][1] : P[a][1] - P[b][1]));
      const m = ms.find(x => diff < 0 || P[x][1] > .5); if (!m) break;
      P[m][1] += diff > 0 ? -.5 : .5;
    }
    return P;
  }
  function portions(meal) { return allPortions()[meal]; }
  function dayTotals() {
    const sum = [0, 0, 0, 0];
    Object.keys(SHARE).forEach(m => portions(m).forEach((v, i) => { sum[i] += v; }));
    return { kcal: sum.reduce((a, v, i) => a + v * HAND_KCAL[i], 0), pro: sum[0] * HAND_PRO };
  }
  const half = x => (x % 1 ? (Math.floor(x) ? Math.floor(x) : '') + '½' : String(x));
  const handTxt = (n, i) => `${half(n)} ${n > 1 ? HAND[i][2] : HAND[i][1]}`;
  function excludedTags() {
    const pr = foodPrefs(), ex = new Set([...pr.allergy, ...pr.dislike]);
    if (pr.style === 'vegetariana') ex.add('carne');
    if (pr.style === 'vegana') { ex.add('carne'); ex.add('animal'); }
    return ex;
  }
  function mealOptions(meal) {
    const ex = excludedTags();
    return MEALS[meal].filter(([, parts]) => !Object.values(parts).some(p => p && p[1].some(t => ex.has(t))));
  }
  const dayN = iso => Math.floor(parseISO(iso) / 864e5);
  let swaps = store.get('mealSwap');
  if (!swaps || swaps.date !== today) swaps = { date: today, s: {} };
  function mealFor(meal, iso, useSwap) {
    const opts = mealOptions(meal); if (!opts.length) return null;
    const salt = { des: 0, alm: 3, once: 5, cena: 7 }[meal];
    if (useSwap && swaps.s[meal]) return opts[(dayN(iso) * 3 + salt + swaps.s[meal]) % opts.length];
    // Cada semana se rota entre 3 platos por comida: menos cosas distintas que comprar
    const wk = Math.floor((dayN(iso) + 3) / 7), pool = [];
    for (let i = 0; i < Math.min(3, opts.length); i++) { const o = opts[(wk * 3 + salt + i) % opts.length]; if (!pool.includes(o)) pool.push(o); }
    return pool[dayN(iso) % pool.length];
  }

  // ---------- Horarios recomendados ----------
  // Según a qué hora te levantas, cuándo entrenas (perfil) y si hoy toca entrenar
  const hhmm = x => { const t = Math.round(x * 4) / 4, hh = Math.floor(t) % 24, mm = Math.round((t - Math.floor(t)) * 60); return hh + ':' + String(mm).padStart(2, '0'); };
  function wakeH() { const w = +store.get('wakeHour'); return w >= 5 && w <= 11 ? w : 7; }
  function mealTimes() {
    const W = wakeH(), slot = (profile && profile.slot) || 'tarde';
    const trainToday = todayIdx() >= 0 && !(start && notYet());
    const T = {
      des: [W + .5, ''], alm: [13.5, ''], once: [17, ''], cena: [20.5, '']
    };
    let train = null, note;
    if (trainToday && slot === 'manana') {
      train = W + 1.25; T.des = [train + 1.5, 'post'];
      note = `Entrenas en la mañana (~${hhmm(train)}): antes, algo pequeño como un plátano o un yogur 30 a 60 minutos antes; el desayuno completo, después.`;
    } else if (trainToday && slot === 'noche') {
      train = 20; T.once = [18, 'pre']; T.cena = [21.75, 'post'];
      note = `Entrenas en la noche (~${hhmm(train)}): la once es tu comida de antes y la cena, liviana y con proteína, la de después.`;
    } else if (trainToday) {
      train = 18; T.once = [16.5, 'pre']; T.cena = [20.25, 'post'];
      note = `Entrenas en la tarde (~${hhmm(train)}): la once, 1 a 2 horas antes, te da energía; la cena es tu comida de recuperación.`;
    } else note = 'Hoy descansas: horarios normales, con 3 a 4 horas entre comidas.';
    T.alm[0] = Math.min(15, Math.max(13.5, W + 4));
    return { T, note, train };
  }
  function missingBody() {
    if (!profile) return [];
    const ok = (v, lo, hi) => { v = parseFloat(v); return v >= lo && v <= hi; };
    return [['age', 14, 99, 'edad', 'pAge'], ['weight', 35, 250, 'peso', 'pWeight'], ['height', 120, 220, 'estatura', 'pHeight']].filter(([k, lo, hi]) => !ok(profile[k], lo, hi));
  }
  function missingTxt() { const m = missingBody().map(x => x[3]); return m.length > 1 ? m.slice(0, -1).join(', ') + ' y ' + m[m.length - 1] : m[0] || ''; }
  function renderBodyCard() {
    const c = document.getElementById('bodyCard'); if (!c) return;
    const m = missingBody(); c.hidden = !m.length;
    if (m.length) document.getElementById('bodyCardTxt').textContent = `Completa tu ${missingTxt()} para calcular bien tus calorías y tu proteína. Son 10 segundos.`;
  }
  document.addEventListener('click', ev => { const b = ev.target.closest('[data-bodyedit]'); if (b) { const m = missingBody(); editProfileAt(m.length ? m[0][4] : 'pAge'); } });
  // ---------- Inicio: recordatorio para pesarse (2 o 3 veces por semana) ----------
  // Días para pesarse: mañanas de descanso, repartidas en la semana y evitando el lunes
  // (después del fin de semana el peso sube por sal y agua). Si hay pocos días libres, se completa con miércoles y viernes.
  const DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function weighDays() {
    const train = (SCHEDULES[schedule] || {}).days || [1, 3, 5];
    const pairs = [[2, 3], [4, 5], [6, 0]], out = [];
    pairs.forEach(p => { const r = p.find(d => !train.includes(d)); if (r != null) out.push(r); });
    [0, 2, 3, 4, 5, 6].filter(d => !train.includes(d)).concat([3, 5, 0]).forEach(d => { if (out.length < 3 && !out.includes(d)) out.push(d); });
    return out.slice(0, 3).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  }
  const weighDaysTxt = () => { const n = weighDays().map(d => DIA[d]); return n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1]; };
  function renderWeighStrip() {
    const el = document.getElementById('weighStrip'); if (!el) return;
    const M = store.get('measures') || [], weighedToday = M.some(m => m.d === today && m.w > 0);
    const n = weighIns(mondayOf(today)).length, wd = new Date().getDay();
    const isDay = weighDays().includes(wd), late = wd === 0 && n < 2;
    el.hidden = !profile || weighedToday || n >= 3 || !(isDay || late) || store.get('weighLater') === today;
    const hint = document.getElementById('progHint'); if (hint && profile) hint.dataset.days = weighDaysTxt();
    if (el.hidden) return;
    const rest = !((SCHEDULES[schedule] || {}).days || []).includes(wd);
    el.querySelector('.strip-t b').textContent = late && !isDay ? '¿Te pesas hoy? Esta semana vas atrasado' : 'Hoy toca pesarte ⚖️';
    document.getElementById('weighTxt').textContent = `${rest ? 'Día de descanso' : 'Antes de entrenar'} · en ayunas · llevas ${n} de 3 esta semana`;
    const inp = document.getElementById('wsW'); if (!inp.value) inp.placeholder = String(Math.round(bodyKg() * 10) / 10).replace('.', ',');
  }
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-wlater]')) { store.set('weighLater', today); renderWeighStrip(); return; }
    if (!ev.target.closest('[data-wsave]')) return;
    const inp = document.getElementById('wsW'), w = parseFloat(String(inp.value).replace(',', '.'));
    if (!(w >= 35 && w <= 250)) { toast('Escribe tu peso en kg'); inp.focus(); return; }
    const M = store.get('measures') || [], last = M[M.length - 1];
    if (last && last.d === today) last.w = w; else M.push({ d: today, w });
    store.set('measures', M); inp.value = '';
    document.dispatchEvent(new Event('measures-changed')); renderMenu(); renderWeighStrip();
    toast('⚖️ Peso anotado · lo ves en Tú → Avance');
  });
  function adjBox() {
    const A = store.get('kcalAdj') || {}, thisMon = mondayOf(today), n = weighIns(thisMon).length;
    const lastTxt = A.last && A.last.w === isoD(thisMon - WEEK) ? adjText(A.last) : '';
    const fl = (store.get('foodLog') || {})[today];
    const adj = kcalAdj();
    return `<div class="adj-box">
      <p class="adj-h">📈 Ajuste semanal</p>
      ${lastTxt ? `<p class="adj-last">${lastTxt}</p>` : '<p class="adj-small">Cada lunes comparamos tu peso promedio con el de la semana anterior y ajustamos tus porciones solos.</p>'}
      ${adj ? `<p class="adj-small">Ajuste acumulado: ${adj > 0 ? '+' : '−'}${Math.round(Math.abs(adj) * GOAL_MULT[foodGoal()] / 10) * 10} kcal sobre el cálculo inicial. <button type="button" class="reset adj-link" data-adjreset>Volver a cero</button></p>` : ''}
      <div class="adj-weigh"><span>Pesajes esta semana: <b>${n}</b> de 2 o 3</span>
        <span class="adj-in"><input type="number" id="adjW" inputmode="decimal" min="30" max="250" step="0.1" placeholder="${String(Math.round(bodyKg() * 10) / 10).replace('.', ',')} kg" aria-label="Tu peso de hoy en kg"><button type="button" class="btn btn-primary" data-weigh>Anotar</button></span></div>
      <p class="adj-small">En ayunas, después del baño, siempre en la misma balanza.</p>
      <p class="adj-q">¿Comiste según el menú hoy?</p>
      <div class="adj-yn" role="group" aria-label="¿Comiste según el menú hoy?">${[[2, '👍 Sí'], [1, '🤏 Más o menos'], [0, '👎 No']].map(([v, t]) => `<button type="button" data-flog="${v}" aria-pressed="${fl === v}">${t}</button>`).join('')}</div>
    </div>`;
  }
  function renderMenu() {
    const box = document.getElementById('menuCard'); if (!box) return;
    // Revisión del lunes (una vez por semana, cuando ya hay perfil)
    const newAdj = profile ? weeklyCheck() : null;
    if (newAdj) setTimeout(() => toast(newAdj.res === 'ajuste' ? '📈 Ajustamos tu menú de esta semana' : newAdj.res === 'ok' ? '👌 Vas al ritmo justo: mismo menú' : '📈 Revisa tu ajuste semanal en Comidas'), 1500);
    const g = foodGoal();
    const MT = mealTimes();
    const cards = Object.keys(MEAL_NAME).map(meal => {
      const tm = MT.T[meal], tag = tm[1] === 'pre' ? '<span class="meal-tag">⚡ Antes de entrenar</span>' : tm[1] === 'post' ? '<span class="meal-tag">💪 Después de entrenar</span>' : '';
      const m = mealFor(meal, today, true), por = portions(meal), [ic, nm] = MEAL_NAME[meal];
      if (!m) return `<div class="meal"><div class="meal-h"><b>${ic} ${nm} <span class="meal-t">🕒 ${hhmm(tm[0])}</span></b></div><p class="meal-empty">Con tus filtros no tenemos opciones para esta comida. Un nutricionista te puede ayudar a cubrir tu proteína.</p></div>`;
      const parts = [['pro', 0], ['carb', 1], ['veg', 2], ['fat', 3]].filter(([k, i]) => m[1][k] && por[i]);
      const n = mealOptions(meal).length;
      return `<div class="meal">
        <div class="meal-h"><b>${ic} ${nm} <span class="meal-t">🕒 ${hhmm(tm[0])}</span></b>${n > 1 ? `<button type="button" class="reset meal-swap" data-swap="${meal}">🔁 Otra opción</button>` : ''}</div>
        ${tag}<p class="meal-n">${m[0]}</p>
        <ul class="meal-p">${parts.map(([k, i]) => `<li><span class="hand">${HAND[i][0]}</span><span><b>${handTxt(por[i], i)}</b> · ${m[1][k][0]}${/^Huevo/.test(m[1][k][0]) && i === 0 ? ` <small>(≈ ${Math.max(2, Math.round(por[i] * 2))} huevos)</small>` : /^(Leche|Yogur)/.test(m[1][k][0]) && i === 0 ? ` <small>(≈ ${Math.max(1, Math.round(por[i]))} vaso${Math.round(por[i]) > 1 ? 's' : ''} o pote${Math.round(por[i]) > 1 ? 's' : ''})</small>` : ''}${(a => a ? `<small class="alt">🔄 o ${a}</small>` : '')(altsFor(m[1][k][0], k))}</span></li>`).join('')}
          ${meal === 'des' || meal === 'once' ? '' : `<li><span class="hand">💧</span><span>Un vaso de agua</span></li>`}</ul>
      </div>`;
    }).join('');
    const tt = dayTotals(), dt = dayTargets(), kf = n => String(Math.round(n / 50) * 50).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    renderBodyCard();
    box.innerHTML = `${missingBody().length ? `<div class="body-miss"><b>⚠️ Faltan datos para tu menú</b><span>Completa tu ${missingTxt()} para calcular bien tus calorías. Mientras, usamos un cálculo aproximado.</span><button type="button" class="btn btn-primary" data-bodyedit>Completar</button></div>` : ''}<div class="menu-top"><h3>📅 Tu menú de hoy</h3></div>
      <div class="phase-pick" role="group" aria-label="Tu etapa">${Object.keys(PHASE_TXT).map(k => `<button type="button" data-phase="${k}" aria-pressed="${k === g}">${PHASE_TXT[k][0]} ${PHASE_TXT[k][1]}</button>`).join('')}</div>
      <div class="kcal-row"><div><b>≈ ${kf(tt.kcal)}</b><small>kcal al día</small></div><div><b>≈ ${Math.round(tt.pro / 5) * 5} g</b><small>de proteína</small></div><div><b>≈ ${kf(dt.tdee)}</b><small>tu gasto estimado</small></div></div>
      <p class="menu-sub">${GOAL_FOOD[g]}</p>
      <p class="menu-sub">Porciones para tus ${String(Math.round(bodyKg()))} kg y ${freqOf()} día${freqOf() > 1 ? 's' : ''} de entrenamiento, medidas con tu mano. Proteína: ${String(dt.gkg).replace('.', ',')} g por kilo. ${store.get('foodPhase') ? '' : 'La etapa sale de tus objetivos; puedes cambiarla arriba.'}</p>
      <div class="time-box"><label>Tu día <select data-act>${Object.keys(ACT).map(k => `<option value="${k}"${k === actNow() ? ' selected' : ''}>${ACT[k][0]} ${ACT[k][1]}</option>`).join('')}</select></label>
</div>
      ${adjBox()}
      <div class="time-box"><p>🕒 ${MT.note} Cena unas 2 horas antes de dormir.</p><label>Me levanto a las <select data-wake>${[5, 6, 7, 8, 9, 10, 11].map(x => `<option value="${x}"${x === wakeH() ? ' selected' : ''}>${x}:00</option>`).join('')}</select></label></div>
      ${cards}
      <p class="menu-note">🔄 Si no tienes algo, cámbialo por otra opción de la misma línea: es la misma porción de tu mano. Si quedas con hambre, suma un puño de verduras. Si entrenas fuerte ese día, puedes agregar ½ mano ahuecada de carbohidratos a la comida de después.</p>`;
    renderShop();
    renderTips();
    renderFoodTips();
    renderNextMeal();
    renderWeighStrip();
  }
  // Consejos de comida dentro de Comidas: los de tu etapa primero
  function renderFoodTips() {
    const box = document.getElementById('foodTips'); if (!box) return;
    const g = foodGoal(), cards = Array.from(document.querySelectorAll('#pro .tip-card'));
    const FOOD = /priorizar|déficit|músculo|Hidratación|Alcohol|Suplementos/i;
    const list = cards.map((c, k) => {
      const gs = (c.dataset.goal || '').split(' '), b = c.querySelector('summary b'), sm = c.querySelector('summary small'), ic = c.querySelector('.tip-ic');
      const mine = gs.includes(g) || (g === 'recomp' && (gs.includes('bajar') || gs.includes('ganar')));
      return { k, t: b ? b.textContent : '', d: sm ? sm.textContent : '', ic: ic ? ic.textContent : '💡', mine, spec: !gs.includes('all') };
    }).filter(x => FOOD.test(x.t) && (!x.spec || x.mine)).sort((a, b) => b.mine - a.mine).slice(0, 4);
    box.innerHTML = `<h3>💡 Consejos para tu etapa: ${PHASE_TXT[g][1].toLowerCase()}</h3>` + list.map(x => `<a class="help-link" href="#pro" data-tipopen="${x.k}"><span aria-hidden="true">${x.ic}</span><div><b>${esc(x.t)}${x.mine && x.spec ? '<span class="ft-tag">PARA TI</span>' : ''}</b><small>${esc(x.d)}</small></div><i aria-hidden="true">›</i></a>`).join('') + '<p class="menu-note">Todos los consejos están en 💡 Consejos.</p>';
  }
  document.addEventListener('click', ev => {
    const a = ev.target.closest('[data-tipopen]'); if (!a) return;
    ev.preventDefault(); ev.stopPropagation(); showSection('pro');
    const c = document.querySelectorAll('#pro .tip-card')[+a.dataset.tipopen];
    if (c) { c.open = true; setTimeout(() => c.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
  }, true);
  // Inicio: tu próxima comida según la hora
  function renderNextMeal() {
    const el = document.getElementById('nextMeal'); if (!el) return;
    if (!profile) { el.hidden = true; return; }
    const MT = mealTimes(), d = new Date(), now = d.getHours() + d.getMinutes() / 60;
    const order = Object.keys(MEAL_NAME);
    let meal = order.find(k => MT.T[k][0] >= now - .5), when = '';
    if (!meal) { meal = 'des'; when = 'Mañana · '; }
    const m = mealFor(meal, today, true), por = portions(meal), [ic, nm] = MEAL_NAME[meal];
    const parts = m ? [['pro', 0], ['carb', 1]].filter(([k, i]) => m[1][k] && por[i]).map(([k, i]) => `${handTxt(por[i], i)} de ${m[1][k][0].toLowerCase()}`).join(' · ') : '';
    const kf = n => String(Math.round(n / 50) * 50).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.hidden = false;
    el.innerHTML = `<span class="tk">Próxima comida</span><span class="te" aria-hidden="true">${ic}</span><h4>${when}${nm} ${hhmm(MT.T[meal][0])}</h4><p class="tp">${m ? esc(m[0]) : 'Revisa tu menú'}</p><span class="tgo">Ver menú ›</span>`;
  }
  // Consejos de dolor: marcar la molestia en el perfil, y abrir la sección desde Básico
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-painedit]')) { editProfileAt('painSet'); return; }
    if (ev.target.closest('[data-tips-pain]')) setTimeout(() => { const h = document.getElementById('dolor'); if (h) h.scrollIntoView({ block: 'start' }); const dl = document.querySelector('[data-tips-dolor]'), pb = document.querySelector('[data-sub-go="pro"]'); if (dl) dl.setAttribute('aria-selected', 'true'); if (pb) pb.setAttribute('aria-selected', 'false'); }, 150);
  });
  // Consejos: marca y sube los que corresponden a tu objetivo
  function renderTips() {
    const g = foodGoal();
    document.querySelectorAll('.tip-card').forEach(c => {
      const gs = (c.dataset.goal || '').split(' ');
      const hit = gs.includes(g) || (g === 'recomp' && (gs.includes('bajar') || gs.includes('ganar')));
      c.classList.toggle('mine', hit); c.style.order = hit ? -1 : 0;
    });
  }
  // ---------- Lista de compras de la semana ----------
  // Cantidad aproximada por porción: [patrón, tipo, cantidad, unidad]
  const QTY = [
    [/^huevo/i, 'u', 2, 'huevos'], [/pollo|vacuno|carne|posta|merluza|reineta|salmón|atún|pavo/i, 'g', 130], [/tofu/i, 'g', 120],
    [/lenteja|poroto|garbanzo(?!s salteados)/i, 'g', 60, 'g (en seco)'], [/^(arroz|fideos|tallarines|quinoa|arroz integral)$/i, 'g', 45, 'g (en seco)'],
    [/marraqueta|pan pita/i, 'u', .5, 'unidades'], [/pan integral|tortilla integral/i, 'u', 1.5, 'rebanadas o unidades'],
    [/^papas?$|camote/i, 'g', 150], [/palta/i, 'u', .25, 'paltas'], [/nueces|almendras|maní$|semillas/i, 'g', 15],
    [/quesillo/i, 'g', 60], [/yogur/i, 'u', 1, 'potes'], [/^leche/i, 'ml', 250]
  ];
  const GROUPS_SHOP = [[0, '🥩 Proteínas'], [1, '🍚 Carbohidratos'], [2, '🥦 Verduras y frutas'], [3, '🥑 Grasas']];
  const isoOf = t => new Date(t).toISOString().slice(0, 10);
  const weekMon = () => isoOf(mondayOf(today));
  function shopList() {
    const mon = weekMon(), agg = {};
    for (let i = 0; i < 7; i++) {
      const d = isoOf(parseISO(mon) + i * 864e5);
      Object.keys(MEAL_NAME).forEach(meal => {
        const m = mealFor(meal, d, d === today); if (!m) return;
        const por = portions(meal);
        [['pro', 0], ['carb', 1], ['veg', 2], ['fat', 3]].forEach(([k, gi]) => {
          if (!m[1][k] || !por[gi]) return;
          const name = m[1][k][0], key = gi + '|' + name;
          (agg[key] = agg[key] || { g: gi, name, n: 0, meals: 0 }).n += por[gi]; agg[key].meals++;
        });
      });
    }
    return Object.values(agg).map(x => {
      const q = QTY.find(r => r[0].test(x.name));
      let amt = `para ${x.meals} comida${x.meals > 1 ? 's' : ''}`;
      if (q) {
        const v = x.n * q[2];
        amt = q[1] === 'g' ? (v >= 1000 ? '≈ ' + String(Math.round(v / 100) / 10).replace('.', ',') + ' kg' : '≈ ' + Math.round(v / 10) * 10 + ' ' + (q[3] || 'g'))
          : q[1] === 'ml' ? '≈ ' + String(Math.round(v / 100) / 10).replace('.', ',') + ' litros'
          : '≈ ' + Math.ceil(v) + ' ' + (Math.ceil(v) === 1 ? ({ huevos: 'huevo', unidades: 'unidad', potes: 'pote', paltas: 'palta', 'rebanadas o unidades': 'rebanada o unidad' }[q[3]] || q[3]) : q[3]);
      }
      if (x.g === 2) amt = `${half(x.n)} puño${x.n > 1 ? 's' : ''} en la semana`;
      return Object.assign(x, { amt });
    }).sort((a, b) => a.g - b.g || a.name.localeCompare(b.name, 'es'));
  }
  function renderShop() {
    const body = document.getElementById('shopBody'); if (!body) return;
    const mon = weekMon(), list = shopList();
    let chk = store.get('shopChecked'); if (!chk || chk.mon !== mon) chk = { mon, k: {} };
    const done = list.filter(x => chk.k[x.g + '|' + x.name]).length;
    document.getElementById('shopCount').textContent = list.length ? `${done} de ${list.length}` : '';
    body.innerHTML = list.length ? GROUPS_SHOP.map(([gi, title]) => {
      const items = list.filter(x => x.g === gi); if (!items.length) return '';
      return `<p class="shop-g">${title}</p>` + items.map(x => { const k = x.g + '|' + x.name; return `<label class="shop-i${chk.k[k] ? ' on' : ''}"><input type="checkbox" data-shop="${esc(k)}"${chk.k[k] ? ' checked' : ''}><span><b>${x.name}</b><small>${x.amt}</small></span></label>`; }).join('');
    }).join('') + `<p class="shop-g">🍎 Además</p><label class="shop-i"><input type="checkbox" disabled><span><b>Fruta de la estación</b><small>1 o 2 al día</small></span></label>
      <div class="sum-actions"><button class="btn btn-ghost" type="button" data-shopcopy>📋 Copiar lista</button><button class="reset" type="button" data-shopclear>Desmarcar todo</button></div>
      <p class="sum-note">Cantidades aproximadas para tu semana (lunes a domingo), según tu menú y tus porciones.</p>` : '<p class="sum-note">Con tus filtros no pudimos armar la lista.</p>';
  }
  (function () {
    const sec = document.getElementById('comida'); if (!sec) return;
    sec.addEventListener('click', ev => {
      const sw = ev.target.closest('[data-swap]');
      const ph = ev.target.closest('[data-phase]');
      if (ph) { store.set('foodPhase', ph.dataset.phase === goalFromProfile() ? null : ph.dataset.phase); renderMenu(); toast(PHASE_TXT[ph.dataset.phase][0] + ' Etapa: ' + PHASE_TXT[ph.dataset.phase][1]); return; }
      const fb = ev.target.closest('[data-flog]');
      if (fb) { const L = store.get('foodLog') || {}; const v = +fb.dataset.flog; if (L[today] === v) delete L[today]; else L[today] = v; Object.keys(L).sort().slice(0, -60).forEach(k => delete L[k]); store.set('foodLog', L); renderMenu(); if (L[today] != null) toast(v === 2 ? '👍 Anotado' : '📝 Anotado: lo tomamos en cuenta'); return; }
      if (ev.target.closest('[data-weigh]')) {
        const inp = document.getElementById('adjW'), w = parseFloat(String(inp.value).replace(',', '.'));
        if (!(w >= 30 && w <= 250)) { toast('Escribe tu peso en kg'); inp.focus(); return; }
        const M = store.get('measures') || [], last = M[M.length - 1];
        if (last && last.d === today) last.w = w; else M.push({ d: today, w });
        store.set('measures', M); document.dispatchEvent(new Event('measures-changed')); renderMenu(); toast('⚖️ Peso anotado'); return;
      }
      if (ev.target.closest('[data-adjreset]')) { const A = store.get('kcalAdj') || {}; A.adj = 0; store.set('kcalAdj', A); renderMenu(); toast('Ajuste en cero'); return; }
      if (sw) { swaps.s[sw.dataset.swap] = (swaps.s[sw.dataset.swap] || 0) + 1; store.set('mealSwap', swaps); renderMenu(); toast('🔁 Nueva opción'); return; }
      if (ev.target.closest('[data-shopcopy]')) {
        const txt = 'Lista de compras de la semana\n' + GROUPS_SHOP.map(([gi, t]) => { const it = shopList().filter(x => x.g === gi); return it.length ? '\n' + t.replace(/^\S+\s/, '') + '\n' + it.map(x => '- ' + x.name + ': ' + x.amt).join('\n') : ''; }).join('\n') + '\n\nFruta de la estación (1 o 2 al día)';
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('📋 Lista copiada')).catch(() => toast('No se pudo copiar en este navegador'));
        return;
      }
      if (ev.target.closest('[data-shopclear]')) { store.set('shopChecked', { mon: weekMon(), k: {} }); renderShop(); }
    });
    sec.addEventListener('change', ev => {
      if (ev.target.matches('[data-wake]')) { store.set('wakeHour', +ev.target.value); renderMenu(); return; }
      if (ev.target.matches('[data-act]')) { store.set('activity', ev.target.value); renderMenu(); toast(ACT[ev.target.value][0] + ' Actualizamos tus calorías'); return; }
      const c = ev.target.closest('[data-shop]'); if (!c) return;
      let chk = store.get('shopChecked'); if (!chk || chk.mon !== weekMon()) chk = { mon: weekMon(), k: {} };
      if (c.checked) chk.k[c.dataset.shop] = 1; else delete chk.k[c.dataset.shop];
      store.set('shopChecked', chk); renderShop();
    });
  })();

  renderFood();


  // ---------- Recompensas, chapitas y resumen semanal ----------
  (function rewards() {
    const $ = id => document.getElementById(id);
    // Registro diario: xp, ejercicios, hábitos y sesiones completas
    let log = store.get('log') || {};
    const day = () => (log[today] = log[today] || { xp: 0, ex: 0, h: {}, s: {} });
    { const hb = store.get('habits'); if (hb && hb.date === today && hb.done) { day().h = Object.assign({}, hb.done); store.set('log', log); } }
    const saveLog = () => store.set('log', log);
    const iso = t => new Date(t).toISOString().slice(0, 10);
    const addDays = (sISO, n) => iso(parseISO(sISO) + n * 864e5);
    // Vista previa: todo desbloqueado para poder probarlo (en la web real se gana subiendo de nivel)
    const PREVIEW = !!document.querySelector('.preview-flag');
    const lvl = () => PREVIEW ? 99 : levelAt(xp);

    // Recompensas por nivel (índice de nivel: 0 = nivel 1)
    // El color de la app queda fijo (grafito y verde lima)
    const THEMES = [['lima','Lima','#A3E635',0]];
    // Avatar, título y diseño de tarjeta para compartir: [valor, nombre, nivel (índice: 0 = nivel 1)]
    const AVATARS = [['💪','Brazo',0],['🦁','León',0],['🐺','Lobo',1],['🦍','Gorila',2],['🦅','Águila',3],['🐻','Oso',4],['🐂','Toro',5],['🦈','Tiburón',6],['🐯','Tigre',7],['🐉','Dragón',9]];
    const TITLES = [['Recién llegado',0],['Con ganas',0],['El constante',1],['Sin excusas',2],['Madrugador',3],['Máquina',4],['Bestia',5],['Disciplina pura',6],['Imparable',7],['Leyenda',9]];
    const CARDS = [['clasica','Clásica',0,['#0F1114','#1E2A12'],'#A3E635'],['neon','Neón',1,['#0B0F1A','#2A0B3A'],'#22D3EE'],['fuego','Fuego',3,['#1A0B05','#4A1A06'],'#FB923C'],['oceano','Océano',5,['#04131F','#0B3B5B'],'#60A5FA'],['oro','Oro',7,['#14110A','#4A3A0A'],'#FACC15']];
    // Mascota: [valor, nombre, nivel (índice), posición]
    const MASCOT = {
      head: [['', 'Nada', 0], ['🎀', 'Moño', 1, 'side'], ['🌸', 'Flor', 2, 'side'], ['🧢', 'Gorra', 3], ['🕶️', 'Lentes', 4], ['🎧', 'Audífonos', 5], ['👑', 'Corona', 6], ['🌟', 'Estrella', 9, 'side']],
      neck: [['', 'Nada', 0], ['🏅', 'Medalla', 4], ['🧣', 'Bufanda', 5], ['💎', 'Diamante', 8]],
      hand: [['', 'Nada', 0], ['🍌', 'Plátano', 0], ['🍎', 'Manzana', 1], ['🥑', 'Palta', 2], ['🍓', 'Frutilla', 3], ['🥤', 'Batido', 5], ['🥕', 'Zanahoria', 7], ['🏋️', 'Pesa', 9, 'left']],
      bg: [['rosa', 'Sala', 0, 'linear-gradient(160deg,#FFE1EC,#FFC2DA)', false, '🛋️'], ['menta', 'Jardín', 0, 'linear-gradient(160deg,#DDF7EE,#A8E6D0)', true, '🌳'], ['lavanda', 'Dormitorio', 0, 'linear-gradient(160deg,#EEE4FF,#CDB6F5)', true, '🌙'], ['cielo', 'Playa', 0, 'linear-gradient(160deg,#E0EFFF,#A9CCF5)', true, '🏖️'], ['dorado', 'Gimnasio', 0, 'linear-gradient(160deg,#FFF3CF,#D9F99D)', true, '🏆']],
      pet: [['gata', 'Gato', 0, '🐱', false], ['perro', 'Perro', 0, '🐶', true], ['zorro', 'Zorro', 0, '🦊', true], ['cerdo', 'Cerdo', 0, '🐷', true], ['gallina', 'Gallina', 0, '🐔', true], ['conejo', 'Conejo', 0, '🐰', true], ['panda', 'Panda', 0, '🐼', true]]
    };
    const SLOT_TXT = { head: 'cabeza', neck: 'cuello', hand: 'mano', bg: 'fondo' };
    const PHRASES = [
      ['Cada repetición cuenta, aunque nadie la vea.', 0], ['Hoy no tienes que ser perfecto, solo constante.', 0],
      ['Tu cuerpo te escucha cuando lo cuidas.', 1], ['Descansar también es parte del plan.', 1],
      ['La fuerza que construyes aquí te acompaña afuera.', 2], ['Más fuerte que ayer, menos que mañana.', 2],
      ['Volver después de una mala semana también es ganar.', 3], ['Lo difícil de hoy es el calentamiento de mañana.', 4],
      ['Tu ritmo es el correcto.', 5], ['No te comparas con nadie: te superas a ti.', 6],
      ['Lo que empezó como un intento ya es un hábito.', 7], ['Mira todo lo que ya lograste.', 8], ['Eres la prueba de que se puede.', 9]
    ];
    let rw = Object.assign({ theme: 'lima', acc: '' }, store.get('rewards') || {});
    rw.m = Object.assign({ head: rw.acc && MASCOT.head.some(i => i[0] === rw.acc) ? rw.acc : '', neck: rw.acc === '🏅' || rw.acc === '💎' ? rw.acc : '', hand: '🍌', bg: 'rosa', pet: 'gata' }, rw.m || {});
    const premOf = (slot, it) => (slot === 'bg' || slot === 'pet') && it && it[4] === true;
    const own = (slot, v) => { const it = MASCOT[slot].find(i => i[0] === v); return it && lvl() >= it[2] && (!premOf(slot, it) || isPremium()) ? it : null; };

    function applyLook() {
      const t = THEMES[0];
      document.documentElement.setAttribute('data-accent', t[0]);
      // Avatar en la barra de nivel y título bajo el saludo
      const av = AVATARS.find(a => a[0] === rw.avatar && lvl() >= a[2]), ti = TITLES.find(a => a[0] === rw.title && lvl() >= a[1]);
      if (av) $('levelBadge').textContent = av[0];
      const hs = document.querySelector('.hero-share'); if (hs) hs.hidden = !profile;
      $('heroTag').hidden = true; // el título solo aparece en la tarjeta para compartir
      const h = own('head', rw.m.head);
      const el = $('logoAcc');
      el.textContent = h ? h[0] : '';
      el.className = 'logo-acc ' + (h ? (h[3] === 'side' ? 'corner' : 'top') : '');
      const cat = document.querySelector('#mascot .cat');
      const HEAD = { '🎀': 'bow', '🌸': 'flower', '🧢': 'cap', '🕶️': 'glasses', '🎧': 'phones', '👑': 'crown', '🌟': 'star' };
      const NECK = { '🏅': 'medal', '🧣': 'scarf', '💎': 'gem' };
      cat.dataset.head = h ? HEAD[h[0]] : '';
      const n = own('neck', rw.m.neck);
      cat.dataset.neck = n ? NECK[n[0]] : '';
      const hd = own('hand', rw.m.hand);
      const holds = hd && hd[0] && hd[0] !== '🏋️';
      cat.dataset.hold = holds ? '1' : '';
      cat.dataset.bell = hd && hd[0] === '🏋️' ? '1' : '';
      cat.querySelector('.held').textContent = holds ? hd[0] : '';
      const pt = own('pet', rw.m.pet) || MASCOT.pet[0];
      cat.dataset.pet = pt[0]; applyPetTexts(pt[0]);
      const bg = own('bg', rw.m.bg) || MASCOT.bg[0];
      $('mascotStage').style.setProperty('--mbg', bg[3]);
      cat.dataset.bg = bg[0];
      setDeco(bg[0]);
    }
    // Fondo animado: cosas que flotan suave según el fondo elegido
    const DECO = { rosa: ['💗', '🌸'], menta: ['🍃', '🌿'], lavanda: ['✨', '💜'], cielo: ['☁️', '🫧'], dorado: ['⭐', '✨'] };
    let decoKey = '';
    function setDeco(k) {
      if (k === decoKey) return; decoKey = k;
      const box = $('stageDeco'), em = DECO[k] || DECO.rosa;
      box.innerHTML = Array.from({ length: 9 }, (_, i) => `<span style="left:${(i * 11 + Math.random() * 6).toFixed(1)}%;font-size:${(0.8 + Math.random() * .8).toFixed(2)}rem;animation-duration:${(10 + Math.random() * 8).toFixed(1)}s;animation-delay:-${(Math.random() * 16).toFixed(1)}s">${em[i % em.length]}</span>`).join('');
    }
    function renderRewards() {
      const L = lvl();
      const lockTxt = n => `<span class="lock">Nv ${n + 1}</span>`;
      $('avatars').innerHTML = AVATARS.map(a => `<button class="acc-btn" type="button" data-av="${a[0]}" aria-label="Avatar ${a[1]}${L < a[2] ? ', se desbloquea en nivel ' + (a[2] + 1) : ''}" aria-pressed="${rw.avatar === a[0]}" ${L < a[2] ? 'disabled' : ''}>${a[0]}${L < a[2] ? lockTxt(a[2]) : ''}</button>`).join('');
      $('titles').innerHTML = TITLES.map(a => `<button type="button" data-ttl="${esc(a[0])}" aria-pressed="${rw.title === a[0]}" ${L < a[1] ? 'disabled' : ''}>${esc(a[0])}${L < a[1] ? `<small>Nv ${a[1] + 1}</small>` : ''}</button>`).join('');
      const cd = CARDS.find(c => c[0] === rw.card && L >= c[2]) || CARDS[0];
      $('cardDesigns').innerHTML = CARDS.map(c => `<button type="button" data-card="${c[0]}" aria-pressed="${cd[0] === c[0]}" ${L < c[2] ? 'disabled' : ''}>${c[1]}${L < c[2] ? `<small>Nv ${c[2] + 1}</small>` : ''}</button>`).join('');
      document.querySelectorAll('[data-slot]').forEach(row => {
        const k = row.dataset.slot;
        row.innerHTML = MASCOT[k].map(i => {
          const lock = L < i[2], prem = premOf(k, i) && !isPremium();
          const sel = (k === 'pet' ? (own('pet', rw.m.pet) || MASCOT.pet[0])[0] : k === 'bg' ? (own('bg', rw.m.bg) || MASCOT.bg[0])[0] : rw.m[k]) === i[0];
          if (k === 'bg') {
            const th = worldThumbs[i[0]];
            const style = th ? `background-image:url(${th})` : `background:${i[3]}`;
            return `<button class="acc-btn world-btn${prem ? ' prem-lock' : ''}" type="button" data-v="${i[0]}" style="${style}" aria-label="Mundo ${i[1]}${prem ? ', disponible con Premium' : ''}" aria-pressed="${sel}">${th ? '' : i[5]}${prem ? '<span class="prem-badge">✨</span>' : ''}<small>${i[1]}</small></button>`;
          }
          const face = k === 'pet' ? i[3] : (i[0] || '✖️');
          return `<button class="acc-btn${prem ? ' prem-lock' : ''}" type="button" data-v="${i[0]}" aria-label="${i[1]}${lock ? ', se desbloquea en nivel ' + (i[2] + 1) : ''}${prem ? ', disponible con Premium' : ''}" aria-pressed="${sel}" ${lock ? 'disabled' : ''}>${face}${lock ? '<span class="lock">Nv ' + (i[2] + 1) + '</span>' : ''}${prem ? '<span class="prem-badge">✨</span>' : ''}</button>`;
        }).join('');
      });
      const mAll = ['head', 'neck', 'hand'].flatMap(k => MASCOT[k]).filter(i => i[0]);
      const mGot = mAll.filter(i => L >= i[2]).length;
      $('mCount').textContent = `${mGot} de ${mAll.length}`;
      const open = PHRASES.filter(f => L >= f[1]);
      const n = Math.floor(parseISO(today) / 864e5);
      $('phrase').textContent = '“' + open[n % open.length][0] + '”';
      const next = PHRASES.find(f => f[1] > L);
      $('phraseMeta').textContent = `Tienes ${open.length} de ${PHRASES.length} frases.` + (next ? ` La próxima se desbloquea en nivel ${next[1] + 1}.` : '');
      const got = AVATARS.filter(a => L >= a[2]).length + TITLES.filter(a => L >= a[1]).length + CARDS.filter(a => L >= a[2]).length + open.length;
      $('rwCount').textContent = `${got} de ${AVATARS.length + TITLES.length + CARDS.length + PHRASES.length}`;
      applyLook();
    }
    $('avatars').addEventListener('click', ev => { const b = ev.target.closest('[data-av]'); if (!b || b.disabled) return; rw.avatar = rw.avatar === b.dataset.av ? '' : b.dataset.av; store.set('rewards', rw); renderRewards(); drawPreview(); });
    $('titles').addEventListener('click', ev => { const b = ev.target.closest('[data-ttl]'); if (!b || b.disabled) return; rw.title = rw.title === b.dataset.ttl ? '' : b.dataset.ttl; store.set('rewards', rw); renderRewards(); drawPreview(); });
    $('cardDesigns').addEventListener('click', ev => { const b = ev.target.closest('[data-card]'); if (!b || b.disabled) return; rw.card = b.dataset.card; store.set('rewards', rw); renderRewards(); drawPreview(); });
    // ---------- Tarjeta para compartir (se dibuja en el teléfono, sin internet) ----------
    // Código QR de la página (calculado de antemano para newenb.netlify.app)
    const QR = ["11111110011111011010001111111", "10000010110010011010001000001", "10111010111110100010101011101", "10111010010011010101101011101", "10111010000000110101001011101", "10000010001011111001101000001", "11111110101010101010101111111", "00000000000110011100000000000", "01110110010001111001000000110", "00111101100100100011011011001", "01000111110101100110101000110", "11010001001010000011000010001", "00011011000010010100010100111", "01000001110000001001001101111", "10011010001110000111010111011", "00000000101010101111111011000", "11111010000110001111010011010", "01110101010000001100100100100", "10101110010101011100001000000", "00110000011001000100111001111", "01001110011100101111111111100", "00000000100100001010100011011", "11111110001001100101101010110", "10000010110010010010100010000", "10111010000001100010111111101", "10111010110111001111000010010", "10111010101010011100100100001", "10000010100100101011110011010", "11111110010001110001110100010"];
    const SITE = 'newenb.netlify.app';
    function qrFooter(g, y, acc, F) {
      const size = 200, n = QR.length, cell = size / (n + 2), x0 = 110;
      g.fillStyle = '#fff'; g.beginPath(); (g.roundRect ? g.roundRect(x0, y, size, size, 18) : g.rect(x0, y, size, size)); g.fill();
      g.fillStyle = '#0F1114';
      QR.forEach((row, r) => { for (let c = 0; c < n; c++) if (row[c] === '1') g.fillRect(Math.floor(x0 + cell * (c + 1)), Math.floor(y + cell * (r + 1)), Math.ceil(cell), Math.ceil(cell)); });
      g.textAlign = 'left';
      g.font = F(700, 44); g.fillStyle = '#F1F5F0'; g.fillText('¿Entrenas conmigo? 💪', 350, y + 62);
      g.font = F(500, 32); g.fillStyle = 'rgba(241,245,240,.75)'; g.fillText('Escanea y arma tu plan gratis', 350, y + 114);
      g.font = F(700, 30); g.fillStyle = acc; g.fillText(SITE, 350, y + 166);
    }
    function bestLift() {
      const W = store.get('wlog') || {}; let b = null;
      Object.keys(W).forEach(name => (W[name] || []).forEach(x => (x.sets || []).forEach(st => { const kg = +st.kg, r = +st.reps; if (kg > 0 && r > 0) { const e = kg * (1 + r / 30); if (!b || e > b.e) b = { e, name, kg, r }; } })));
      return b;
    }
    function drawCard() {
      const cd = CARDS.find(c => c[0] === rw.card && lvl() >= c[2]) || CARDS[0], acc = cd[4];
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 1080, 1920); bg.addColorStop(0, cd[3][0]); bg.addColorStop(1, cd[3][1]); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
      const glow = g.createRadialGradient(540, 620, 40, 540, 620, 620); glow.addColorStop(0, acc + '55'); glow.addColorStop(1, acc + '00'); g.fillStyle = glow; g.fillRect(0, 0, 1080, 1400);
      const F = (w, sz) => `${w} ${sz}px Outfit, "Segoe UI", system-ui, sans-serif`;
      const ctr = (t, y, f, col) => { g.font = f; g.fillStyle = col; g.textAlign = 'center'; g.fillText(t, 540, y); };
      const L = levelAt(xp), info = lvInfo(L), av = AVATARS.find(a => a[0] === rw.avatar && lvl() >= a[2]), ti = TITLES.find(a => a[0] === rw.title && lvl() >= a[1]);
      ctr('NEWEN', 150, F(700, 38), acc);
      g.beginPath(); g.arc(540, 560, 230, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,.06)'; g.fill(); g.lineWidth = 12; g.strokeStyle = acc; g.stroke();
      ctr(av ? av[0] : info[0], 640, F(400, 220), '#fff');
      ctr((profile && profile.name) ? profile.name : 'Mi progreso', 920, F(700, 92), '#F1F5F0');
      if (ti) ctr(ti[0], 1000, F(600, 52), acc);
      ctr(`NIVEL ${L + 1} · ${info[1].toUpperCase()}`, ti ? 1080 : 1010, F(700, 46), 'rgba(241,245,240,.75)');
      const P = window.__planStats ? window.__planStats() : null, B = bestLift();
      const tiles = [['🔥', P ? String(P.cur) : '0', P && P.cur === 1 ? 'semana en racha' : 'semanas en racha'], ['🏋️', String(P ? P.total : totalSess()), 'sesiones'], ['🏆', B ? String(Math.round(B.kg * 2) / 2).replace('.', ',') + ' kg' : '—', B ? (w => (w[1] === 'de' && w[2] ? w.slice(0, 3).join(' ') : w[0]))(B.name.split(' ')) : 'mejor récord']];
      tiles.forEach((t, i) => {
        const x = 80 + i * 320, y = 1180;
        g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); (g.roundRect ? g.roundRect(x, y, 280, 300, 36) : g.rect(x, y, 280, 300)); g.fill();
        g.textAlign = 'center'; g.font = F(400, 70); g.fillStyle = '#fff'; g.fillText(t[0], x + 140, y + 95);
        g.font = F(700, 64); g.fillStyle = acc; g.fillText(t[1], x + 140, y + 185);
        g.font = F(500, 30); g.fillStyle = 'rgba(241,245,240,.7)'; g.fillText(t[2].length > 18 ? t[2].slice(0, 17) + '…' : t[2], x + 140, y + 245);
      });
      if (P && !P.mine) ctr(`Fase ${P.ph + 1} de 3 · ${P.phName} · Semana ${P.wk} de 12`, 1555, F(600, 40), '#F1F5F0');
      const ph = PHRASES.filter(f => lvl() >= f[1]), fr = ph[Math.floor(parseISO(today) / 864e5) % ph.length][0];
      g.font = F(500, 34); let frs = '“' + fr + '”'; while (g.measureText(frs).width > 900 && frs.length > 10) frs = frs.slice(0, -2) + '”';
      ctr(frs, 1620, F(500, 34), 'rgba(241,245,240,.6)');
      g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; g.beginPath(); g.moveTo(110, 1665); g.lineTo(970, 1665); g.stroke();
      qrFooter(g, 1690, acc, F);
      return c;
    }
    // Imagen de la rutina de la semana
    function drawRoutine() {
      const cd = CARDS.find(c => c[0] === rw.card && lvl() >= c[2]) || CARDS[0], acc = cd[4];
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 1080, 1920); bg.addColorStop(0, cd[3][0]); bg.addColorStop(1, cd[3][1]); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
      const F = (w, sz) => `${w} ${sz}px Outfit, "Segoe UI", system-ui, sans-serif`;
      const fit = (t, max, f) => { g.font = f; if (g.measureText(t).width <= max) return t; while (t.length > 3 && g.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; };
      g.textAlign = 'center'; g.font = F(700, 38); g.fillStyle = acc; g.fillText('NEWEN', 540, 130);
      const w0 = week; week = autoWeek();
      const days = planDays().map((_, i) => buildDay(i)); week = w0;
      const P = window.__planStats ? window.__planStats() : null, av = AVATARS.find(a => a[0] === rw.avatar && lvl() >= a[2]);
      g.font = F(700, 84); g.fillStyle = '#F1F5F0'; g.fillText(`${av ? av[0] + ' ' : ''}Mi rutina`, 540, 240);
      g.font = F(600, 38); g.fillStyle = 'rgba(241,245,240,.75)';
      g.fillText(`${days.length} día${days.length > 1 ? 's' : ''} por semana${P && !P.mine ? ' · Fase ' + (P.ph + 1) + ': ' + P.phName : ''}`, 540, 305);
      const n = days.length, top = 370, bottom = 1640, gap = 22, boxH = (bottom - top - gap * (n - 1)) / n;
      const rows = Math.max(3, Math.floor((boxH - 130) / (n > 3 ? 46 : 54)));
      const names = SCHEDULES[schedule].names;
      days.forEach((d, i) => {
        const y = top + i * (boxH + gap);
        g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); (g.roundRect ? g.roundRect(70, y, 940, boxH, 34) : g.rect(70, y, 940, boxH)); g.fill();
        g.textAlign = 'left'; g.font = F(700, 30); g.fillStyle = acc; g.fillText(`${d.num.toUpperCase()} · ${(names[i] || '').toUpperCase()}`, 110, y + 56);
        g.font = F(700, 44); g.fillStyle = '#F1F5F0'; g.fillText(fit(d.name, 860, F(700, 44)), 110, y + 108);
        const lh = n > 3 ? 46 : 54, fs = n > 3 ? 30 : 34, list = d.ex.length > rows ? d.ex.slice(0, rows - 1) : d.ex;
        list.forEach((e, k) => {
          const yy = y + 160 + k * lh, sr = (parseInt(e.series, 10) || '') + (e.reps ? ' × ' + String(e.reps).replace(/\s*reps?$/, '').replace(/ por (pierna|lado|brazo)/, '/$1') : '');
          g.textAlign = 'left'; g.fillStyle = 'rgba(241,245,240,.88)'; g.fillText(fit('• ' + e.name, 590, F(500, fs)), 110, yy);
          g.textAlign = 'right'; g.font = F(600, fs); g.fillStyle = acc; g.fillText(fit(sr, 270, F(600, fs)), 970, yy);
        });
        if (d.ex.length > list.length) { g.textAlign = 'left'; g.font = F(500, fs - 4); g.fillStyle = 'rgba(241,245,240,.55)'; g.fillText(`+ ${d.ex.length - list.length} más`, 110, y + 160 + list.length * lh); }
      });
      qrFooter(g, 1680, acc, F);
      return c;
    }
    let shMode = 'progreso';
    // Imagen con 3 gráficos: sesiones por semana, peso promedio y fuerza
    function drawCharts() {
      const cd = CARDS.find(c => c[0] === rw.card && lvl() >= c[2]) || CARDS[0], acc = cd[4];
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const g = c.getContext('2d');
      const bg = g.createLinearGradient(0, 0, 1080, 1920); bg.addColorStop(0, cd[3][0]); bg.addColorStop(1, cd[3][1]); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
      const F = (w, sz) => `${w} ${sz}px Outfit, "Segoe UI", system-ui, sans-serif`;
      const av = AVATARS.find(a => a[0] === rw.avatar && lvl() >= a[2]);
      g.textAlign = 'center'; g.font = F(700, 38); g.fillStyle = acc; g.fillText('NEWEN', 540, 130);
      g.font = F(700, 84); g.fillStyle = '#F1F5F0'; g.fillText(`${av ? av[0] + ' ' : ''}Mis gráficos`, 540, 240);
      let R = window.__charts ? window.__charts.real() : null;
      const empty = !R || (!R.ses.some(Boolean) && R.pes.filter(v => v != null).length < 2 && !Object.keys(R.lifts).length);
      if (empty && window.__charts) R = window.__charts.demo();
      g.font = F(500, 34); g.fillStyle = 'rgba(241,245,240,.65)'; g.fillText(empty ? 'Ejemplo: entrena y pésate para ver los tuyos' : ((profile && profile.name) || 'Mi progreso'), 540, 300);
      const panel = (y, h, title, sub) => {
        g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); (g.roundRect ? g.roundRect(70, y, 940, h, 34) : g.rect(70, y, 940, h)); g.fill();
        g.textAlign = 'left'; g.font = F(700, 40); g.fillStyle = '#F1F5F0'; g.fillText(title, 110, y + 66);
        g.textAlign = 'right'; g.font = F(600, 34); g.fillStyle = acc; g.fillText(sub, 970, y + 66);
        return { x: 120, y: y + 110, w: 840, h: h - 170 };
      };
      const nf = v => String(Math.round(v * 10) / 10).replace('.', ',');
      // 1) Sesiones
      let A = panel(330, 430, 'Sesiones por semana', `meta ${R.freq}`);
      const n = R.ses.length, mx = Math.max(R.freq, ...R.ses), bw = A.w / n, w = Math.min(60, bw - 14);
      R.ses.forEach((v, i) => { const hh = A.h * v / mx, x = A.x + i * bw + (bw - w) / 2; g.fillStyle = v >= R.freq ? acc : acc + '66'; g.beginPath(); (g.roundRect ? g.roundRect(x, A.y + A.h - hh, w, hh, [12, 12, 0, 0]) : g.rect(x, A.y + A.h - hh, w, hh)); g.fill(); });
      const ty = A.y + A.h - A.h * R.freq / mx; g.setLineDash([14, 10]); g.strokeStyle = '#FBBF24'; g.lineWidth = 4; g.beginPath(); g.moveTo(A.x, ty); g.lineTo(A.x + A.w, ty); g.stroke(); g.setLineDash([]);
      g.textAlign = 'center'; g.font = F(500, 26); g.fillStyle = 'rgba(241,245,240,.55)'; g.fillText(`Últimas ${n} semanas`, 540, A.y + A.h + 46);
      // 2) Peso y 3) Fuerza (líneas)
      const lineP = (A, pts) => {
        const ys = pts.map(p => p[1]); let lo = Math.min(...ys), hi = Math.max(...ys); const pad = (hi - lo) * .2 || 1; lo -= pad; hi += pad;
        const X = i => A.x + (pts.length === 1 ? A.w / 2 : A.w * i / (pts.length - 1)), Y = v => A.y + A.h * (1 - (v - lo) / (hi - lo));
        g.strokeStyle = acc; g.lineWidth = 8; g.lineJoin = 'round'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(i), Y(p[1])) : g.moveTo(X(i), Y(p[1])))); g.stroke();
        [0, pts.length - 1].forEach(i => { g.fillStyle = acc; g.beginPath(); g.arc(X(i), Y(pts[i][1]), 14, 0, Math.PI * 2); g.fill(); g.textAlign = i ? 'right' : 'left'; g.font = F(700, 34); g.fillStyle = '#F1F5F0'; g.fillText(nf(pts[i][1]) + ' kg', X(i) + (i ? -6 : 6), Y(pts[i][1]) - 30); });
      };
      const pp = R.weeks.map((t, i) => [t, R.pes[i]]).filter(p => p[1] != null);
      A = panel(790, 400, 'Peso promedio', pp.length > 1 ? `${pp[pp.length - 1][1] - pp[0][1] < 0 ? '−' : '+'}${nf(Math.abs(pp[pp.length - 1][1] - pp[0][1]))} kg` : '');
      if (pp.length > 1) lineP(A, pp); else { g.textAlign = 'center'; g.font = F(500, 32); g.fillStyle = 'rgba(241,245,240,.55)'; g.fillText('Pésate 2 o 3 veces por semana', 540, A.y + A.h / 2); }
      const ln = Object.keys(R.lifts).sort((a, b) => R.lifts[b].length - R.lifts[a].length)[0];
      const lp = ln ? R.lifts[ln] : [];
      A = panel(1220, 400, ln ? ln.split(' ').slice(0, 3).join(' ') : 'Fuerza', lp.length > 1 ? `+${Math.round((lp[lp.length - 1][1] / lp[0][1] - 1) * 100)} %` : '');
      if (lp.length > 1) lineP(A, lp); else { g.textAlign = 'center'; g.font = F(500, 32); g.fillStyle = 'rgba(241,245,240,.55)'; g.fillText('Anota el peso de tus series', 540, A.y + A.h / 2); }
      g.textAlign = 'center'; g.font = F(500, 26); g.fillStyle = 'rgba(241,245,240,.45)'; g.fillText('Fuerza: 1RM estimado con peso y repeticiones', 540, 1655);
      qrFooter(g, 1690, acc, F);
      return c;
    }
    const drawCurrent = () => (shMode === 'rutina' ? drawRoutine() : shMode === 'graficos' ? drawCharts() : drawCard());
    function drawPreview() { const img = $('cardPrev'); if (img) { try { img.src = drawCurrent().toDataURL('image/jpeg', .7); } catch (e) {} } }
    function cardBlob() { return new Promise(r => drawCurrent().toBlob(r, 'image/png')); }
    const shSheet = $('shareSheet');
    function setShMode(m) {
      shMode = m === 'rutina' || m === 'graficos' ? m : 'progreso';
      shSheet.querySelectorAll('[data-shmode]').forEach(b => b.setAttribute('aria-selected', b.dataset.shmode === shMode));
      $('shNote').textContent = shMode === 'rutina' ? 'Tu rutina de la semana, día por día, con series y repeticiones. Ideal para mandarla a un amigo que quiera entrenar contigo.' : shMode === 'graficos' ? 'Tus sesiones por semana, tu peso promedio y cómo sube tu fuerza, en una sola imagen.' : 'Tu nivel, tu racha, tus sesiones y tu mejor récord, listo para tus historias.';
      drawPreview();
    }
    function openShare(m) {
      if (!profile) { toast('Primero arma tu plan en Tú → Perfil'); return; }
      renderRewards(); setShMode(m);
      shSheet.hidden = false; document.body.classList.add('sheet-open'); requestAnimationFrame(() => shSheet.classList.add('on'));
    }
    function closeShare() { shSheet.classList.remove('on'); document.body.classList.remove('sheet-open'); setTimeout(() => { shSheet.hidden = true; }, 220); }
    shSheet.addEventListener('click', ev => {
      if (ev.target === shSheet || ev.target.closest('[data-close]')) { closeShare(); return; }
      const b = ev.target.closest('[data-shmode]'); if (b) setShMode(b.dataset.shmode);
    });
    document.addEventListener('click', ev => { const b = ev.target.closest('[data-share]'); if (b) openShare(b.dataset.share); });
    function saveBlob(b) { const u = URL.createObjectURL(b), a = document.createElement('a'); a.href = u; a.download = shMode === 'rutina' ? 'mi-rutina-gym.png' : shMode === 'graficos' ? 'mis-graficos-gym.png' : 'mi-progreso-gym.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
    $('cardShare').addEventListener('click', async () => {
      const b = await cardBlob(); if (!b) return;
      const fn = shMode === 'rutina' ? 'mi-rutina-gym.png' : shMode === 'graficos' ? 'mis-graficos-gym.png' : 'mi-progreso-gym.png';
      const f = new File([b], fn, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: shMode === 'rutina' ? 'Mi rutina de gym' : 'Mi progreso en el gym' }); } catch (e) {} }
      else { saveBlob(b); toast('⬇ Imagen guardada: súbela a tus historias'); }
    });
    $('cardSave').addEventListener('click', async () => { const b = await cardBlob(); if (b) { saveBlob(b); toast('⬇ Imagen guardada'); } });

    document.querySelectorAll('[data-slot]').forEach(row => row.addEventListener('click', ev => {
      const b = ev.target.closest('[data-v]'); if (!b || b.disabled) return;
      const it = MASCOT[row.dataset.slot].find(i => i[0] === b.dataset.v);
      if (premOf(row.dataset.slot, it) && !isPremium()) { openPremium(row.dataset.slot === 'pet' ? 'Esta mascota' : 'El mundo ' + it[1]); return; }
      rw.m[row.dataset.slot] = b.dataset.v; store.set('rewards', rw); renderRewards();
      if (row.dataset.slot === 'pet') { catReact('boing', petText('¡Hola! Soy tu nueva mascota. ¿Entrenamos juntas? 💕'), ['💖', '✨', '💕']); return; }
      catSvg.dataset.admire = row.dataset.slot;
      catReact('admire', it && it[0] ? (row.dataset.slot === 'bg' ? '¡Qué lindo fondo! Me encanta. 💕' : (it[1].endsWith('s') ? `¡Me encantan mis ${it[1].toLowerCase()}! ✨` : `¡Me encanta mi ${it[1].toLowerCase()}! ✨`)) : 'Así también me veo bien. 😊', null);
      if (it && it[0]) kitty.admire(row.dataset.slot);
    }));
    // ---------- Reacciones de la gatita ----------
  // ---------- Motor de la gatita: esqueleto, poses y movimiento secundario ----------
  function createKitty(svg) {
    const q = id => svg.querySelector('#' + id);
    const P = { root: q('kRoot'), torso: q('kTorso'), chest: q('kChest'), head: q('kHead'), earL: q('kEarL'), earR: q('kEarR'),
      armL: q('kArmL'), elbL: q('kElbL'), armR: q('kArmR'), elbR: q('kElbR'), legL: q('kLegL'), kneeL: q('kKneeL'),
      legR: q('kLegR'), kneeR: q('kKneeR'), eyes: q('kEyes'), tail: q('kTail'), tailIn: q('kTailIn'), tailTip: q('kTailTip'),
      medal: q('kMedal'), scarf: q('kScarfTail'), bow: q('kBow'), shadow: q('kShadow') };
    const pupils = Array.from(svg.querySelectorAll('.pupil'));
    const held = svg.querySelector('.held'), bell = svg.querySelector('.bell');
    const S = Math.sin, C = Math.cos, ab = Math.abs, R = Math.PI / 180;
    const cyc = (t, f) => 0.5 - 0.5 * C(t * f);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const GROUND = 452, HIP_Y = -4, THIGH = 44, SHIN = 44, FOOT = 9;
    const REST = { x: 0, hop: 0, lean: 0, head: 0, aL: 10, eL: 8, aR: 10, eR: 8, hL: 3, kL: 0, hR: 3, kR: 0, ears: 0, tailAmp: 14, tailSpd: 2.2, look: 0, lookY: 0 };
    const KEYS = Object.keys(REST);

    // Poses con nombre. tags = en qué ánimo aparecen y con qué frecuencia. m(t) = movimiento sobre la pose base.
    const POSES = {
      idle:    { tags: { normal: 3, train: 1, joy: 1 }, base: {}, m: t => ({ lean: 2 * S(t * 1.3), head: 3 * S(t * .9) }) },
      hips:    { tags: { normal: 2, train: 1, joy: 1 }, base: { aL: 50, eL: -76, aR: 50, eR: -76, hL: 6, hR: 6 }, m: t => ({ lean: 3 * S(t * 1.2), head: 6 * S(t * .8) }) },
      wave:    { tags: { normal: 2, joy: 1 }, base: { aR: 140, eR: 18, head: -7 }, m: t => ({ eR: 26 * S(t * 9), lean: -3 }), dur: [1.6, 2.4] },
      flex:    { tags: { normal: 1, train: 3, joy: 1 }, base: { aL: 80, eL: 80, aR: 80, eR: 80, hL: 12, hR: 12 }, m: t => { const s = S(t * 7); return { aL: 6 * s, aR: 6 * s, eL: 10 * s, eR: 10 * s, hop: 2 * ab(s) }; } },
      curl:    { tags: { train: 3, normal: 1 }, base: { aR: 14, aL: 14 }, m: t => ({ eR: 7 + 125 * cyc(t, 4), lean: -2 * cyc(t, 4) }), dur: [2.6, 3.8], bell: 4 },
      press:   { tags: { train: 2 }, base: {}, m: t => { const s = cyc(t, 3.2); return { aL: 60 + 62 * s, aR: 60 + 62 * s, eL: 92 - 64 * s, eR: 92 - 64 * s }; }, dur: [2.6, 3.6], bell: 3 },
      jacks:   { tags: { train: 3, joy: 2 }, base: {}, m: t => { const s = cyc(t, 6); return { aL: 2 + 128 * s, aR: 2 + 128 * s, eL: 4 + 10 * s, eR: 4 + 10 * s, hL: 3 + 15 * s, hR: 3 + 15 * s, hop: 12 * ab(S(t * 6)) }; }, dur: [2.4, 3.4] },
      squat:   { tags: { train: 3 }, base: {}, m: t => { const s = cyc(t, 3); return { hL: 3 + 36 * s, kL: -72 * s, hR: 3 + 36 * s, kR: -72 * s, aL: 30 + 40 * s, aR: 30 + 40 * s, eL: 20 + 80 * s, eR: 20 + 80 * s }; }, dur: [2.8, 4] },
      stretch: { tags: { normal: 2, sleepy: 1 }, base: { aL: 135, eL: 10, aR: 20, eR: 10 }, m: t => ({ lean: 12 * S(t * 1.6), head: 9 * S(t * 1.6) }), dur: [2.2, 3] },
      tree:    { tags: { normal: 1, train: 2 }, base: { aL: 135, eL: 12, aR: 135, eR: 12, hR: 62, kR: -125 }, m: t => ({ lean: 3 * S(t * 2) }), dur: [2, 3] },
      kick:    { tags: { train: 2, joy: 1 }, base: { aL: 70, eL: 60, aR: 70, eR: 60 }, m: t => { const s = cyc(t, 5); return { hR: 4 + 58 * s, kR: -10 * s, lean: -8 * s }; }, dur: [2, 3] },
      dance:   { tags: { joy: 4, normal: 1 }, base: {}, m: t => ({ lean: 9 * S(t * 4), head: 7 * S(t * 4), aL: 45 + 45 * S(t * 4), aR: 45 - 45 * S(t * 4), eL: 52, eR: 52, hop: 6 * ab(S(t * 8)), hL: 6 + 6 * S(t * 4), hR: 6 - 6 * S(t * 4), tailAmp: 26, tailSpd: 5 }), dur: [2.6, 4] },
      cheer:   { tags: { joy: 3 }, base: { aL: 130, eL: 15, aR: 130, eR: 15, tailAmp: 24, tailSpd: 5 }, m: t => ({ hop: 14 * ab(S(t * 5)), head: 5 * S(t * 5) }), dur: [1.6, 2.4] },
      think:   { tags: { normal: 1 }, base: { aR: -10, eR: -150, aL: 20, eL: -78, head: 10, look: -1 }, m: t => ({ head: 3 * S(t * 1.5) }) },
      slouch:  { tags: { thirsty: 4 }, base: { aL: 4, eL: 4, aR: 4, eR: 4, head: 9, ears: -24, kL: -8, kR: -8, hL: 6, hR: 6, tailAmp: 5, tailSpd: 1 }, m: t => ({ lean: 3 * S(t * .9), head: 3 * S(t * .9) }) },
      fan:     { tags: { thirsty: 3 }, base: { aL: 6, eL: 4, aR: 112, eR: 72, head: -6, ears: -20, tailAmp: 5, tailSpd: 1 }, m: t => ({ eR: 22 * S(t * 14) }) },
      nod:     { tags: { sleepy: 4 }, base: { aL: 6, eL: 6, aR: 6, eR: 6, ears: -12, tailAmp: 4, tailSpd: .8 }, m: t => ({ head: 11 * S(t * 1.1), lean: 3 * S(t * 1.1) }) },
      yawn:    { tags: { sleepy: 2 }, base: { aL: 130, eL: 20, aR: 130, eR: 20, ears: -8, tailAmp: 4, tailSpd: .8 }, m: t => ({ lean: 4 * S(t * 1.2) }), dur: [2, 2.8] },
      tummy:   { tags: { hungry: 4 }, base: { aL: 20, eL: -78, aR: 20, eR: -78, head: 9, look: 1, tailAmp: 8 }, m: t => ({ eL: 8 * S(t * 6), eR: -8 * S(t * 6), lean: 3 * S(t * 2) }) },
      drinking:{ base: { aR: -10, eR: -152, aL: 12, eL: 10, head: -9 }, m: t => ({ head: 2 * S(t * 12) }) },
      eating:  { base: { aR: -10, eR: -150, aL: 20, eL: -78, head: -4 }, m: t => ({ eR: 6 * S(t * 14) }) },
      admire_head: { base: { aR: 128, eR: 22, aL: 12, eL: 10, head: -6, look: .25, lookY: -4.6, tailAmp: 18, tailSpd: 3 }, m: t => ({ head: 2 * S(t * 3), eR: 5 * S(t * 4) }) },
      admire_neck: { base: { aR: 22, eR: -96, aL: 14, eL: 10, head: 13, lookY: 4.6, tailAmp: 18, tailSpd: 3 }, m: t => ({ eR: 4 * S(t * 4), head: 2 * S(t * 2) }) },
      admire_hand: { base: { aR: 80, eR: 84, aL: 12, eL: 10, head: 9, look: 1.05, lookY: -1.5, tailAmp: 18, tailSpd: 3 }, m: t => ({ aR: 4 * S(t * 3), eR: 6 * S(t * 3) }) },
      admire_bg:   { base: { aL: 50, eL: -76, aR: 50, eR: -76, lookY: -2.5, tailAmp: 18, tailSpd: 3 }, m: t => ({ look: 1.05 * S(t * 2.4), head: 6 * S(t * 2.4) }) },
      twirl:   { base: { aL: 110, eL: 20, aR: 110, eR: 20, tailAmp: 26, tailSpd: 6 }, m: t => ({ hop: 10 * ab(S(t * 3.5)) }) }
    };
    // Generador: arma poses nuevas combinando brazos, piernas e inclinación al azar
    const ARMS = [[10, 8], [50, -76], [80, 80], [132, 16], [82, 0], [20, -78], [100, 40], [35, 40], [120, -15], [55, 110]];
    const LEGS = [[3, 0], [14, 0], [28, -50], [8, -14]];
    function generate() {
      const a = ARMS[Math.floor(Math.random() * ARMS.length)];
      const b = Math.random() < .45 ? a : ARMS[Math.floor(Math.random() * ARMS.length)];
      const l = LEGS[Math.floor(Math.random() * LEGS.length)];
      const one = Math.random() < .25;
      const base = { aL: a[0] + rnd(-8, 8), eL: a[1] + rnd(-10, 10), aR: b[0] + rnd(-8, 8), eR: b[1] + rnd(-10, 10),
        hL: l[0], kL: l[1], hR: one ? 4 : l[0], kR: one ? 0 : l[1], lean: rnd(-9, 9), head: rnd(-11, 11), look: rnd(-1, 1) };
      const f = rnd(.8, 2.2), amp = rnd(2, 6), bounce = Math.random() < .4 ? rnd(2, 6) : 0;
      return { base, m: t => ({ lean: amp * S(t * f), head: amp * .8 * S(t * f + 1), hop: bounce * ab(S(t * f * 2)) }), dur: [1.8, 3.2] };
    }

    let vals = Object.assign({}, REST), from = Object.assign({}, REST), cur = POSES.idle, curName = 'idle';
    let tPose = 0, trans = .6, hold = 2.5, now = 0, last = 0, forced = null;
    const st = { blinkAt: 1.5, blinkT: -1, lookX: 0, lookY: 0, lookTX: 0, lookTY: 0, lookAt: 1, earL: 0, earLv: 0, earR: 0, earRv: 0,
      prevHead: 0, prevX: 0, prevHop: 0, medal: 0, medalV: 0, scarf: 0, scarfV: 0, bow: 0, bowV: 0, twitchAt: 3, winkUntil: 0 };

    function moodNow() {
      const c = svg.classList;
      for (const m of ['thirsty', 'sleepy', 'hungry', 'train', 'joy']) if (c.contains('mood-' + m)) return m;
      return 'normal';
    }
    function reactionNow() {
      const c = svg.classList;
      if (c.contains('drinking')) return 'drinking';
      if (c.contains('eating')) return 'eating';
      if (c.contains('admire')) return 'admire_' + (svg.dataset.admire || 'head');
      if (c.contains('dress')) return 'twirl';
      if (c.contains('boing')) return 'cheer';
      if (c.contains('flex')) return 'flex';
      if (c.contains('g-wave')) return 'wave';
      return null;
    }
    function setPose(p, name, d) {
      from = Object.assign({}, vals); cur = p; curName = name; tPose = now;
      trans = rnd(.45, .75); hold = d || rnd(...(p.dur || [2.2, 3.6]));
    }
    function pickNext() {
      const mood = moodNow(), hasBell = svg.dataset.bell === '1';
      if ((mood === 'normal' || mood === 'joy' || mood === 'train') && Math.random() < (mood === 'train' ? .15 : .35)) return setPose(generate(), 'gen');
      const pool = [];
      for (const [k, p] of Object.entries(POSES)) {
        if (!p.tags || k === curName) continue;
        let w = p.tags[mood] || 0;
        if (hasBell && p.bell) w += p.bell;
        for (let i = 0; i < w; i++) pool.push(k);
      }
      const k = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'idle';
      setPose(POSES[k], k);
    }
    const footY = (h, k) => HIP_Y + THIGH * C(h * R) + SHIN * C((h + k) * R) + FOOT;
    function tailPath(amp, spd) {
      let x = 16, y = -10, a = .35;
      const pts = [[x, y]];
      for (let i = 1; i <= 9; i++) {
        a += -.3 + (amp * R) * S(now * spd - i * .55) * (.4 + i / 9);
        x += 11 * C(a); y += 11 * S(a);
        pts.push([x, y]);
      }
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        d += ` Q${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
      }
      const n = pts.length - 1, tip = `M${pts[n - 2][0].toFixed(1)} ${pts[n - 2][1].toFixed(1)} Q${pts[n - 1][0].toFixed(1)} ${pts[n - 1][1].toFixed(1)} ${pts[n][0].toFixed(1)} ${pts[n][1].toFixed(1)}`;
      return [d + ` L${pts[n][0].toFixed(1)} ${pts[n][1].toFixed(1)}`, tip];
    }
    const spring = (pos, vel, target, k, c, dt, push) => { const acc = -k * (pos - target) - c * vel + (push || 0); vel += acc * dt; pos += vel * dt; return [pos, vel]; };
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function step(ts) {
      requestAnimationFrame(step);
      const t = ts / 1000, dt = Math.min(.05, last ? t - last : .016); last = t;
      if (document.hidden || !svg.isConnected || !svg.getBoundingClientRect().width) return;
      now += dt;
      // Reacciones mandan sobre las poses normales
      const r = reactionNow();
      if (r && forced !== r) { forced = r; setPose(POSES[r], r, 99); }
      else if (!r && forced) { forced = null; pickNext(); }
      else if (!r && now - tPose > hold && !reduce) pickNext();
      // Mezcla de la pose anterior a la nueva + movimiento propio de la pose
      const tt = now - tPose, k = reduce ? 1 : ease(Math.min(1, tt / trans));
      const mo = reduce ? {} : (cur.m ? cur.m(tt) : {});
      for (const key of KEYS) {
        const target = (key in cur.base ? cur.base[key] : REST[key]) + (mo[key] || 0);
        vals[key] = from[key] + (target - from[key]) * k;
      }
      const v = vals;
      // Raíz: los pies siempre tocan el suelo (si se agacha, el cuerpo baja)
      const lowest = Math.max(footY(v.hL, v.kL), footY(v.hR, v.kR));
      const rootY = GROUND - lowest - Math.max(0, v.hop);
      let sx = 1;
      if (forced === 'twirl') sx = C(Math.min(1, tt / 1.1) * Math.PI * 2);
      P.root.setAttribute('transform', `translate(${(200 + v.x).toFixed(1)} ${rootY.toFixed(1)}) scale(${sx.toFixed(3)} 1)`);
      const breath = 1 + (moodNow() === 'thirsty' ? .02 : .012) * S(now * (moodNow() === 'thirsty' ? 5 : 2.2));
      P.torso.setAttribute('transform', `rotate(${v.lean.toFixed(2)})`);
      P.chest.setAttribute('transform', `scale(${(2 - breath).toFixed(4)} ${breath.toFixed(4)})`);
      P.head.setAttribute('transform', `rotate(${v.head.toFixed(2)} 0 -98)`);
      P.armL.setAttribute('transform', `rotate(${v.aL.toFixed(2)} -26 -88)`);
      P.elbL.setAttribute('transform', `rotate(${v.eL.toFixed(2)} -26 -54)`);
      P.armR.setAttribute('transform', `rotate(${(-v.aR).toFixed(2)} 26 -88)`);
      P.elbR.setAttribute('transform', `rotate(${(-v.eR).toFixed(2)} 26 -54)`);
      P.legL.setAttribute('transform', `rotate(${v.hL.toFixed(2)} -20 -4)`);
      P.kneeL.setAttribute('transform', `rotate(${v.kL.toFixed(2)} -20 40)`);
      P.legR.setAttribute('transform', `rotate(${(-v.hR).toFixed(2)} 20 -4)`);
      P.kneeR.setAttribute('transform', `rotate(${(-v.kR).toFixed(2)} 20 40)`);
      // Movimiento secundario: orejas, medalla, bufanda y moño reaccionan al movimiento
      const headVel = (v.head + v.lean - st.prevHead) / dt; st.prevHead = v.head + v.lean;
      const xAcc = (v.hop - st.prevHop) / dt; st.prevHop = v.hop;
      if (now > st.twitchAt) { st.earLv += rnd(-260, 260); st.earRv += rnd(-260, 260); st.twitchAt = now + rnd(2.5, 6); }
      [st.earL, st.earLv] = spring(st.earL, st.earLv, -v.ears, 120, 9, dt, -headVel * 2);
      [st.earR, st.earRv] = spring(st.earR, st.earRv, v.ears, 120, 9, dt, -headVel * 2);
      P.earL.setAttribute('transform', `rotate(${st.earL.toFixed(2)} -40 -196)`);
      P.earR.setAttribute('transform', `rotate(${st.earR.toFixed(2)} 40 -196)`);
      [st.medal, st.medalV] = spring(st.medal, st.medalV, -v.lean, 40, 3, dt, -headVel * 1.5 + xAcc * .6);
      P.medal.setAttribute('transform', `rotate(${Math.max(-40, Math.min(40, st.medal)).toFixed(2)} 0 -100)`);
      [st.scarf, st.scarfV] = spring(st.scarf, st.scarfV, -v.lean * .6 + 6 * S(now * 3), 60, 4, dt, -headVel * 2);
      P.scarf.setAttribute('transform', `rotate(${st.scarf.toFixed(2)} 6 -90)`);
      [st.bow, st.bowV] = spring(st.bow, st.bowV, 0, 90, 5, dt, -headVel * 3 + xAcc * 1.5);
      P.bow.setAttribute('transform', `translate(36 -198) rotate(${st.bow.toFixed(2)})`);
      // Cola
      const [td, tip] = tailPath(v.tailAmp, v.tailSpd);
      P.tail.setAttribute('d', td); P.tailIn.setAttribute('d', td); P.tailTip.setAttribute('d', tip);
      // Parpadeo y guiño
      if (now > st.blinkAt) {
        st.blinkT = now; st.blinkAt = now + rnd(2, 5.5);
        if ((moodNow() === 'normal' || moodNow() === 'joy') && Math.random() < .12) { svg.classList.add('wink'); st.winkUntil = now + .7; }
      }
      if (st.winkUntil && now > st.winkUntil) { svg.classList.remove('wink'); st.winkUntil = 0; }
      const bt = (now - st.blinkT) / .16, lid = bt >= 0 && bt < 1 ? 1 - .92 * S(bt * Math.PI) : 1;
      P.eyes.setAttribute('transform', `translate(0 -148) scale(1 ${lid.toFixed(3)}) translate(0 148)`);
      // Mirada: busca puntos al azar, o mira hacia abajo si tiene hambre
      if (now > st.lookAt) { st.lookTX = rnd(-4.5, 4.5); st.lookTY = rnd(-3, 3); st.lookAt = now + rnd(1.2, 3.4); }
      const lx = v.look ? v.look * 4 : st.lookTX, ly = v.lookY ? v.lookY : moodNow() === 'hungry' ? 4 : st.lookTY;
      st.lookX += (lx - st.lookX) * Math.min(1, dt * 10); st.lookY += (ly - st.lookY) * Math.min(1, dt * 10);
      pupils.forEach(p => p.setAttribute('transform', `translate(${st.lookX.toFixed(2)} ${st.lookY.toFixed(2)})`));
      // Objeto en la mano: se mece un poco
      const hw = 6 * S(now * 3);
      held.setAttribute('transform', `rotate(${hw.toFixed(2)} 28 -18)`);
      bell.setAttribute('transform', `rotate(${(hw * .5).toFixed(2)} 26 -16)`);
      // Sombra: se achica cuando salta
      const sh = Math.max(.55, 1 - v.hop / 40);
      P.shadow.setAttribute('rx', (66 * sh).toFixed(1)); P.shadow.setAttribute('opacity', (.14 * sh).toFixed(3));
    }
    requestAnimationFrame(step);
    // Brillitos sutiles justo donde está el accesorio nuevo (se mueven con ella)
    const SPOT = { head: { bow: [36, -198], flower: [-38, -196], cap: [0, -214], glasses: [0, -150], phones: [0, -236], crown: [0, -232], star: [48, -178] },
      neck: { medal: [0, -58], scarf: [0, -94], gem: [0, -74] } };
    const NS = 'http://www.w3.org/2000/svg';
    const starD = (r) => { let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * .32 : r; d += (i ? 'L' : 'M') + (rr * Math.sin(a)).toFixed(2) + ' ' + (-rr * Math.cos(a)).toFixed(2); } return d + 'Z'; };
    function admire(slot) {
      let g, c, spread;
      if (slot === 'head') { g = P.head; c = SPOT.head[svg.dataset.head] || [0, -200]; spread = 26; }
      else if (slot === 'neck') { g = P.torso; c = SPOT.neck[svg.dataset.neck] || [0, -80]; spread = 18; }
      else if (slot === 'hand') { g = P.elbR; c = [26, -26]; spread = 18; }
      else { g = P.root; c = [0, -110]; spread = 120; }
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2, r = spread * (.45 + Math.random() * .55);
        const x = c[0] + Math.cos(a) * r, y = c[1] + Math.sin(a) * r * (slot === 'bg' ? 1.3 : .8);
        const wrap = document.createElementNS(NS, 'g');
        wrap.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        const sp = document.createElementNS(NS, 'path');
        sp.setAttribute('d', starD(3 + Math.random() * 3.5));
        sp.setAttribute('class', 'shine');
        sp.style.animationDelay = (.15 + i * .14 + Math.random() * .1).toFixed(2) + 's';
        wrap.appendChild(sp); g.appendChild(wrap);
        setTimeout(() => wrap.remove(), 2600);
      }
    }
    return { pose: name => POSES[name] && setPose(POSES[name], name), poses: () => Object.keys(POSES), admire };
  }

  // ---------- Gatita 3D (three.js): modelo articulado con estilo de dibujo animado ----------
  function createKitty3D(state, box) {
    if (!window.THREE) return null;
    const T = window.THREE;
    let renderer;
    try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return null; }
    if (!renderer.getContext()) return null;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const canvas = renderer.domElement; canvas.className = 'cat3d';
    box.appendChild(canvas);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(30, 1, .1, 100);
    camera.position.set(0, 3.3, 13.6); camera.lookAt(0, 1.95, -.8);
    const hemi = new T.HemisphereLight(0xFFFFFF, 0xE9D2DE, .52); scene.add(hemi);
    const sun = new T.DirectionalLight(0xFFFFFF, .62); sun.position.set(3, 6, 8); scene.add(sun);
    const rim = new T.DirectionalLight(0xFFE3F0, .22); rim.position.set(-5, 3, -4); scene.add(rim);

    // Materiales con sombreado de dibujo animado (3 tonos) y contorno
    const grad = new T.DataTexture(new Uint8Array([150, 150, 150, 210, 210, 210, 255, 255, 255]), 3, 1, T.RGBFormat);
    grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true;
    const toon = (c, extra) => new T.MeshToonMaterial(Object.assign({ color: c, gradientMap: grad }, extra || {}));
    const M = { fur: toon(0xA9A9B3), dark: toon(0x8E8E9A), white: toon(0xFFFFFF), cream: toon(0xFFFDF2), pink: toon(0xFF9EBF), top: toon(0xFF4F9A),
      leg: toon(0x3F2E5C), stripe: toon(0xFF8CC2), iris: toon(0xE9B44C), pupil: new T.MeshBasicMaterial({ color: 0x2A1A12 }), shine: new T.MeshBasicMaterial({ color: 0xFFFFFF }),
      line: new T.MeshBasicMaterial({ color: 0x4A4656 }), nose: toon(0xF27AA8), mouth: toon(0xE8417F), tongue: toon(0xFF6FA5), blush: new T.MeshBasicMaterial({ color: 0xFF8FBF, transparent: true, opacity: .55 }),
      gold: toon(0xE8B83A), goldD: toon(0xC9A13B), blue: toon(0x5B9BF0), blueD: toon(0x3A74C9), purple: toon(0x8E63E6), teal: toon(0x2FB89A), red: toon(0xE8417F), gem: toon(0x8FD3FF, { transparent: true, opacity: .9 }),
      glass: new T.MeshToonMaterial({ color: 0xE4F5FF, gradientMap: grad, transparent: true, opacity: .45 }), water: toon(0x6EC3F5), egg: toon(0xFFE7B0), bow: toon(0xFF4F9A), bowD: toon(0xE8417F), petal: toon(0xFFD1E6), grey: toon(0xC9C3D6), limb: toon(0xA9A9B3), muzzle: toon(0xFFFFFF), tip: toon(0x8E8E9A), earB: toon(0x8B5E3C), noseD: toon(0x2A1A12), comb: toon(0xE8413F), beak: toon(0xF6A623), patch: toon(0x2E2A33), happyL: new T.MeshBasicMaterial({ color: 0x4A4656 }), lid: toon(0xA9A9B3) };
    const OUT = new T.MeshBasicMaterial({ color: 0x5B5866, side: T.BackSide });
    const geo = {};
    const sphG = (seg) => { seg = Math.max(seg, 20); return geo['s' + seg] || (geo['s' + seg] = new T.SphereGeometry(1, seg, Math.round(seg * .75))); };
    function sph(mat, sx, sy, sz, x, y, z, outline, seg) {
      const m = new T.Mesh(sphG(seg || 24), mat); m.scale.set(sx, sy, sz); m.position.set(x || 0, y || 0, z || 0);
      if (outline) { const o = new T.Mesh(sphG(seg || 24), OUT); o.scale.setScalar(1 + outline); m.add(o); }
      return m;
    }
    function cap(mat, r, len, outline) { // cápsula que cuelga hacia -y desde el origen
      const g = new T.Group();
      const c = new T.Mesh(new T.CylinderGeometry(r, r, len, 24, 1, true), mat); c.position.y = -len / 2; g.add(c);
      g.add(sph(mat, r, r, r, 0, 0, 0)); g.add(sph(mat, r, r, r, 0, -len, 0));
      if (outline) { const o = new T.Mesh(new T.CylinderGeometry(r + outline, r + outline, len, 24, 1, true), OUT); o.position.y = -len / 2; g.add(o);
      }
      return g;
    }
    const grp = (x, y, z, parent) => { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; };
    const torus = (mat, R, r, arc, rs) => new T.Mesh(new T.TorusGeometry(R, r, 10, rs || 40, arc || Math.PI * 2), mat);
    const cyl = (mat, r1, r2, h, seg, open) => new T.Mesh(new T.CylinderGeometry(r1, r2, h, seg || 24, 1, !!open), mat);
    function emojiTex(ch, size) {
      const c = document.createElement('canvas'); c.width = c.height = size || 128; const x = c.getContext('2d');
      x.font = `${(size || 128) * .8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, c.width / 2, c.height * .55); const t = new T.CanvasTexture(c); return t;
    }
    function textTex(str, color, font) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
      x.font = font || 'bold 72px Georgia, serif'; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(str, 128, 70);
      return new T.CanvasTexture(c);
    }
    function sparkTex() {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(.3, 'rgba(255,240,180,.6)'); g.addColorStop(1, 'rgba(255,230,150,0)');
      x.fillStyle = g; x.fillRect(0, 0, 64, 64); x.fillStyle = '#FFFBE6';
      x.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 5 : 28; x.lineTo(32 + r * Math.sin(a), 32 - r * Math.cos(a)); } x.fill();
      return new T.CanvasTexture(c);
    }
    const SPARK = sparkTex();
    const sprite = (tex, s, opacity) => { const m = new T.Sprite(new T.SpriteMaterial({ map: tex, transparent: true, opacity: opacity == null ? 1 : opacity, depthWrite: false })); m.scale.set(s, s, 1); return m; };

    // ---------- Modelo ----------
    const root = grp(0, 0, 0); scene.add(root);
    const yawG = grp(0, 0, 0, root);
    const pelvis = grp(0, 1.2, 0, yawG);
    const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(74,21,48,.32)'); g.addColorStop(1, 'rgba(74,21,48,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
    const shadow = new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .01; root.add(shadow);
    // Piernas (calzas) y zapatillas
    const legs = {};
    for (const s of [-1, 1]) {
      const hip = grp(.22 * s, .02, 0, pelvis);
      hip.add(cap(M.leg, .19, .5, .025));
      const stripe = new T.Mesh(new T.BoxGeometry(.035, .5, .02), M.stripe); stripe.position.set(.17 * s, -.25, .06); hip.add(stripe);
      const knee = grp(0, -.5, 0, hip);
      knee.add(cap(M.leg, .17, .5, .025));
      const st2 = new T.Mesh(new T.BoxGeometry(.035, .45, .02), M.stripe); st2.position.set(.155 * s, -.25, .06); knee.add(st2);
      const shoe = sph(M.white, .22, .15, .33, 0, -.58, .1, .1);
      knee.add(shoe);
      const sole = sph(M.grey, .23, .05, .34, 0, -.66, .1); knee.add(sole); const soleB = grp(0, -.71, .1, knee);
      for (let i = 0; i < 2; i++) { const l = new T.Mesh(new T.BoxGeometry(.16, .025, .03), M.top); l.position.set(0, -.5 - i * .045, .36 - i * .02); l.rotation.x = -.5; knee.add(l); }
      legs[s] = { hip, knee, soleB };
    }
    // Cola (cadena de segmentos)
    const tailSegs = []; let tp = grp(.1, .22, -.34, pelvis);
    for (let i = 0; i < 9; i++) {
      const r = .11 - i * .004, seg = cap(i > 6 ? M.tip : M.fur, r, .2, .022);
      seg.rotation.x = Math.PI; tp.add(seg); tailSegs.push(tp);
      tp = grp(0, .2, 0, tp);
    }
    tailSegs.forEach(g => { g.children[0].visible = false; });
    const TN = 28, TRAD = 14, tailV = TN * (TRAD + 1);
    function tubeGeo() {
      const g = new T.BufferGeometry(), idx = [];
      g.setAttribute('position', new T.BufferAttribute(new Float32Array(tailV * 3), 3));
      g.setAttribute('color', new T.BufferAttribute(new Float32Array(tailV * 3), 3));
      for (let i = 0; i < TN - 1; i++) for (let j = 0; j < TRAD; j++) { const a = i * (TRAD + 1) + j, b = a + TRAD + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
      g.setIndex(idx); return g;
    }
    const tailGeo = tubeGeo(), tailOutGeo = tubeGeo();
    const tailMesh = new T.Mesh(tailGeo, new T.MeshToonMaterial({ gradientMap: grad, vertexColors: true })); pelvis.add(tailMesh);
    const tailOutMesh = new T.Mesh(tailOutGeo, OUT); pelvis.add(tailOutMesh);
    tailMesh.frustumCulled = tailOutMesh.frustumCulled = false;
    let tailProfile = 'chain', tailLen = 9;
    const _tp = new T.Vector3(), _tn = new T.Vector3(), _tb = new T.Vector3(), _tt = new T.Vector3(), _up = new T.Vector3(0, 0, 1);
    function tailRadius(u) {
      if (tailProfile === 'bushy') { const end = u > .9 ? (1 - u) / .1 : 1; return (.09 + .21 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05)), .8)) * Math.max(.05, end); }
      const end = u > .93 ? (1 - u) / .07 : 1;
      return (tailProfile === 'short' ? .095 : .1) * (1 - .3 * u) * Math.max(.08, end);
    }
    function paintTail() {
      const col = tailGeo.attributes.color.array, a = M.fur.color, b = M.tip.color;
      for (let i = 0; i < TN; i++) { const u = i / (TN - 1), k = Math.min(1, Math.max(0, (u - (tailProfile === 'bushy' ? .74 : .8)) / .08));
        for (let j = 0; j <= TRAD; j++) { const o = (i * (TRAD + 1) + j) * 3; col[o] = a.r + (b.r - a.r) * k; col[o + 1] = a.g + (b.g - a.g) * k; col[o + 2] = a.b + (b.b - a.b) * k; } }
      tailGeo.attributes.color.needsUpdate = true;
    }
    function updateTail() {
      if (!tailMesh.visible) return;
      pelvis.updateMatrixWorld(true);
      const pts = [];
      for (let i = 0; i < tailLen; i++) { tailSegs[i].getWorldPosition(_tp); pts.push(pelvis.worldToLocal(_tp.clone())); }
      _tp.set(0, .2, 0); tailSegs[tailLen - 1].localToWorld(_tp); pts.push(pelvis.worldToLocal(_tp.clone()));
      const curve = new T.CatmullRomCurve3(pts);
      const pos = tailGeo.attributes.position.array, posO = tailOutGeo.attributes.position.array;
      let n = null;
      for (let i = 0; i < TN; i++) {
        const u = i / (TN - 1); curve.getPoint(u, _tp); curve.getTangent(u, _tt);
        if (!n) { n = new T.Vector3().crossVectors(_tt, _up); if (n.lengthSq() < 1e-6) n.set(1, 0, 0); n.normalize(); }
        else { n.addScaledVector(_tt, -n.dot(_tt)).normalize(); }
        _tb.crossVectors(_tt, n);
        const r = tailRadius(u), ro = r + .022 * Math.min(1, r / .05);
        for (let j = 0; j <= TRAD; j++) {
          const th = j / TRAD * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), o = (i * (TRAD + 1) + j) * 3;
          _tn.copy(n).multiplyScalar(c).addScaledVector(_tb, sn);
          pos[o] = _tp.x + _tn.x * r; pos[o + 1] = _tp.y + _tn.y * r; pos[o + 2] = _tp.z + _tn.z * r;
          posO[o] = _tp.x + _tn.x * ro; posO[o + 1] = _tp.y + _tn.y * ro; posO[o + 2] = _tp.z + _tn.z * ro;
        }
      }
      tailGeo.attributes.position.needsUpdate = true; tailOutGeo.attributes.position.needsUpdate = true;
      tailGeo.computeVertexNormals();
    }
    // Torso
    const torso = grp(0, 0, 0, pelvis);
    const chest = grp(0, 0, 0, torso);
    chest.add(sph(M.fur, .5, .78, .42, 0, .66, 0, .05));
    chest.add(sph(M.white, .26, .34, .14, 0, .52, .32));
    chest.add(sph(M.top, .52, .33, .44, 0, 1.06, 0, .05));
    const trim = torus(M.white, .47, .03); trim.rotation.x = Math.PI / 2; trim.scale.set(1, .85, 1); trim.position.y = .78; chest.add(trim);
    chest.add(sph(M.leg, .5, .26, .42, 0, .1, 0, .05));
    const wstripe = torus(M.stripe, .49, .025); wstripe.rotation.x = Math.PI / 2; wstripe.scale.set(1.02, .86, 1); wstripe.position.y = .22; chest.add(wstripe);
    const swoosh = torus(M.white, .1, .02, Math.PI); swoosh.position.set(0, 1.12, .44); swoosh.rotation.z = Math.PI + .3; chest.add(swoosh);
    // Cuello: accesorios
    const neck = {};
    neck.medal = grp(0, 1.3, .36, torso);
    { const rb1 = new T.Mesh(new T.BoxGeometry(.09, .5, .02), M.red); rb1.position.set(-.07, -.22, .12); rb1.rotation.z = -.25; neck.medal.add(rb1);
      const rb2 = new T.Mesh(new T.BoxGeometry(.09, .5, .02), M.blue); rb2.position.set(.07, -.22, .12); rb2.rotation.z = .25; neck.medal.add(rb2);
      const disc = cyl(M.gold, .15, .15, .05, 32); disc.rotation.x = Math.PI / 2; disc.position.set(0, -.5, .16); neck.medal.add(disc);
      const dOut = cyl(OUT, .17, .17, .04, 32); dOut.rotation.x = Math.PI / 2; dOut.position.set(0, -.5, .14); neck.medal.add(dOut);
      const st = sph(M.cream, .06, .06, .02, 0, -.5, .2, 0, 8); neck.medal.add(st); }
    neck.scarf = grp(0, 1.25, .02, torso);
    { const ring = torus(M.teal, .53, .085, 0, 40); ring.rotation.x = Math.PI / 2 - .08; ring.scale.set(1, .86, 1); neck.scarf.add(ring);
      const o = torus(OUT, .53, .1, 0, 40); o.rotation.x = Math.PI / 2 - .08; o.scale.set(1, .86, 1); neck.scarf.add(o); }
    neck.scarfTail = grp(.2, -.04, .5, neck.scarf);
    { const tl = new T.Mesh(new T.BoxGeometry(.16, .45, .06), M.teal); tl.position.y = -.22; tl.rotation.z = .12; neck.scarfTail.add(tl);
      for (let i = 0; i < 2; i++) { const b = new T.Mesh(new T.BoxGeometry(.17, .03, .065), M.white); b.position.y = -.2 - i * .12; neck.scarfTail.add(b); } }
    neck.gem = grp(0, 1.24, .02, torso);
    { const ch = torus(M.gold, .5, .022, 0, 40); ch.rotation.x = Math.PI / 2 - .55; ch.scale.set(1, .9, 1); neck.gem.add(ch);
      const g = new T.Mesh(new T.OctahedronGeometry(.11, 0), M.gem); g.scale.set(1, 1.3, .7); g.position.set(0, -.26, .5); neck.gem.add(g); neck.gemStone = g; }
    // Cabeza
    const headP = grp(0, 1.32, 0, torso);
    const head = grp(0, .9, 0, headP);
    head.add(sph(M.fur, 1.12, .95, .96, 0, 0, 0, .035, 40));
    const stripes = grp(0, 0, 0, head); for (let i = -1; i <= 1; i++) { const st = new T.Mesh(new T.BoxGeometry(.06, .2, .05), M.dark); st.position.set(i * .17, .8, .45); st.rotation.x = -.55; st.rotation.z = i * -.12; stripes.add(st); }
    const ears = {};
    for (const s of [-1, 1]) {
      const e = grp(.56 * s, .6, 0, head);
      const c = new T.Mesh(new T.ConeGeometry(.4, .78, 4), M.fur); c.rotation.y = Math.PI / 4; c.position.y = .34; c.scale.set(1, 1, .45);
      const co = new T.Mesh(new T.ConeGeometry(.4, .78, 4), OUT); co.scale.setScalar(1.08); co.position.y = -.01; c.add(co);
      e.add(c);
      const inner = new T.Mesh(new T.ConeGeometry(.27, .55, 4), M.pink); inner.rotation.y = Math.PI / 4; inner.scale.set(1, 1, .3); inner.position.set(0, .3, .09); e.add(inner);
      e.rotation.z = -.32 * s;
      ears[s] = e;
    }
    const band = grp(0, .47, 0, head);
    { const b = torus(M.top, .98, .075, 0, 56); b.rotation.x = Math.PI / 2 - .2; b.scale.set(1.03, .9, 1); band.add(b);
      const bo = torus(OUT, .98, .09, 0, 56); bo.rotation.x = Math.PI / 2 - .2; bo.scale.set(1.03, .9, 1); band.add(bo); }
    const muzzleCat = sph(M.muzzle, .42, .27, .3, 0, -.36, .74); head.add(muzzleCat);
    const noseCat = sph(M.nose, .085, .06, .05, 0, -.22, .99, .2, 16); head.add(noseCat);
    const blushL = sph(M.blush, .17, .09, .05, -.68, -.3, .7, 0, 16), blushR = sph(M.blush, .17, .09, .05, .68, -.3, .7, 0, 16); head.add(blushL, blushR);
    const whisk = grp(0, 0, 0, head); for (const s of [-1, 1]) for (const a of [.08, -.06]) { const w = cyl(M.line, .012, .012, .6, 6); w.rotation.z = Math.PI / 2 + a * s; w.position.set(.58 * s, -.36 + a * .6, .78); whisk.add(w); }
    // Ojos con párpados, brillo y mirada
    const eyes = {};
    for (const s of [-1, 1]) {
      const eg = grp(.39 * s, .02, .72, head); eg.rotation.y = .36 * s;
      eg.add(sph(M.cream, .27, .29, .16, 0, 0, 0, .1));
      const iris = grp(0, 0, .1, eg);
      iris.add(sph(M.iris, .2, .21, .07, 0, 0, 0)); iris.add(sph(M.pupil, .13, .14, .05, 0, 0, .04));
      iris.add(sph(M.shine, .06, .06, .03, .07 * s * -1 + .02, .08, .08, 0, 12)); iris.add(sph(M.shine, .03, .03, .02, -.06, -.07, .08, 0, 10));
      const lid = new T.Mesh(new T.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.lid); lid.scale.set(.29, .31, .19);
      const lidG = grp(0, 0, 0, eg); lidG.add(lid);
      const rim = torus(M.happyL, 1, .075, Math.PI, 28); rim.rotation.x = Math.PI / 2; rim.scale.set(.295, .195, 1); lidG.add(rim);
      const lash = new T.Mesh(new T.BoxGeometry(.13, .03, .02), M.line); lash.position.set(.25 * s, .2, .05); lash.rotation.z = .5 * s; eg.add(lash);
      const lash2 = lash.clone(); lash2.position.set(.27 * s, .12, .05); lash2.rotation.z = .2 * s; eg.add(lash2);
      const happy = torus(M.happyL, .17, .035, Math.PI, 20); happy.position.set(.39 * s, -.02, .87); happy.rotation.y = .36 * s; head.add(happy);
      eyes[s] = { eg, iris, lidG, happy };
    }
    // Boca y expresiones
    const mouthG = grp(0, -.4, 1.03, head);
    const smile = grp(0, 0, 0, mouthG);
    for (const s of [-1, 1]) { const a = torus(M.line, .085, .024, Math.PI, 14); a.rotation.z = Math.PI; a.position.x = .085 * s; smile.add(a); }
    const mouthOpen = sph(M.mouth, .12, .1, .05, 0, -.06, -.02, .25, 20); mouthG.add(mouthOpen);
    const tongue = sph(M.tongue, .08, .12, .05, 0, -.17, -.03, 0, 16); mouthG.add(tongue);
    // ---------- Especies: piezas propias de cada animal ----------
    const SPX = {};
    const sgrp = (k, parent) => (SPX[k] = grp(0, 0, 0, parent || head));
    // Perrita: orejas caídas y hocico
    sgrp('dog'); const dogEars = {};
    for (const s of [-1, 1]) { const pv = grp(.86 * s, .5, .02, SPX.dog); const ear = sph(M.earB, .25, .55, .13, .1 * s, -.42, 0, .07, 20); ear.rotation.z = .22 * s; pv.add(ear); dogEars[s] = pv; }
    SPX.dog.add(sph(M.muzzle, .4, .27, .3, 0, -.36, .77, .03, 32)); SPX.dog.add(sph(M.noseD, .12, .08, .07, 0, -.25, 1.05, 0, 24));
    // Zorrita: hocico fino y blanco (usa las orejas de gata, más grandes)
    sgrp('fox'); SPX.fox.add(sph(M.muzzle, .38, .26, .33, 0, -.36, .79, .03, 32)); SPX.fox.add(sph(M.noseD, .09, .065, .06, 0, -.27, 1.1, 0, 24));
    for (const s of [-1, 1]) { const ck = sph(M.muzzle, .34, .22, .12, .6 * s, -.3, .74, 0, 28); ck.rotation.set(0, .55 * s, .25 * s); SPX.fox.add(ck); }
    // Cerdita: orejas dobladas y nariz redonda
    sgrp('pig'); const pigEars = {};
    for (const s of [-1, 1]) { const pv = grp(.6 * s, .9, .02, SPX.pig);
      const ear = sph(M.earB, .2, .27, .07, .05 * s, .14, .04, .1, 28); ear.rotation.set(.85, 0, -.5 * s); pv.add(ear);
      const inner = sph(M.pink, .12, .17, .03, .05 * s, .12, .1, 0, 20); inner.rotation.set(.85, 0, -.5 * s); pv.add(inner);
      pigEars[s] = pv; }
    { const sn = cyl(M.earB, .24, .24, .16, 28); sn.rotation.x = Math.PI / 2; sn.position.set(0, -.3, .95); SPX.pig.add(sn); const so = cyl(OUT, .26, .26, .14, 28); so.rotation.x = Math.PI / 2; so.position.set(0, -.3, .93); SPX.pig.add(so);
      for (const s of [-1, 1]) SPX.pig.add(sph(M.noseD, .045, .065, .02, .08 * s, -.3, 1.035, 0, 10)); }
    // Conejita: orejas largas, nariz rosada y dientitos
    sgrp('bunny'); const bunEars = {};
    for (const s of [-1, 1]) { const pv = grp(.36 * s, .78, 0, SPX.bunny); pv.add(sph(M.fur, .17, .72, .11, 0, .62, 0, .06, 20)); pv.add(sph(M.pink, .09, .55, .04, 0, .6, .085, 0, 16)); bunEars[s] = pv; }
    SPX.bunny.add(sph(M.muzzle, .4, .27, .29, 0, -.36, .75, .05, 32));
    for (const s of [-1, 1]) { const ck = sph(M.muzzle, .3, .2, .1, .52 * s, -.3, .72, 0, 28); ck.rotation.set(0, .5 * s, .2 * s); SPX.bunny.add(ck); }
    SPX.bunny.add(sph(M.nose, .1, .075, .06, 0, -.22, 1.0, 0, 24));
    for (const s of [-1, 1]) { const t2 = new T.Mesh(new T.BoxGeometry(.07, .09, .03), M.white); t2.position.set(.04 * s, -.48, .96); SPX.bunny.add(t2); }
    // Panda: orejas redondas y manchas en los ojos
    sgrp('panda'); const panEars = {};
    for (const s of [-1, 1]) { const pv = grp(.68 * s, .72, -.05, SPX.panda); pv.add(sph(M.patch, .26, .26, .16, 0, 0, 0, .07, 20)); panEars[s] = pv;
      const pt = sph(M.patch, .36, .44, .085, .4 * s, -.07, .81, 0, 32); pt.rotation.set(0, .36 * s, -.5 * s); SPX.panda.add(pt); }
    SPX.panda.add(sph(M.patch, .1, .07, .06, 0, -.22, 1.0, .15, 16));
    // Gallina: cresta, pico y barbilla
    sgrp('hen');
    [[0, .98, .12, .14], [-.17, .9, .22, .11], [.17, .9, .22, .11], [0, .9, -.12, .11]].forEach(([x, y, z, r]) => SPX.hen.add(sph(M.comb, r, r * 1.2, r * .8, x, y, z, .1, 14)));
    { const bk = new T.Mesh(new T.ConeGeometry(.13, .3, 16), M.beak); bk.rotation.x = Math.PI / 2; bk.position.set(0, -.27, 1.08); SPX.hen.add(bk);
      const bo = new T.Mesh(new T.ConeGeometry(.15, .32, 16), OUT); bo.rotation.x = Math.PI / 2; bo.position.set(0, -.27, 1.06); SPX.hen.add(bo); }
    SPX.hen.add(sph(M.comb, .08, .14, .06, 0, -.5, .95, .1, 14));
    SPX.henComb = SPX.hen.children.slice(0, 4);
    // Colas distintas
    const tailX = {};
    tailX.pig = grp(.02, .35, -.46, pelvis); { const c = torus(M.fur, .1, .035, Math.PI * 1.7, 20); c.rotation.y = Math.PI / 2; tailX.pig.add(c); }
    tailX.bunny = grp(.0, .32, -.45, pelvis); tailX.bunny.add(sph(M.white, .2, .2, .2, 0, 0, 0, .06, 20));
    tailX.panda = grp(.0, .32, -.44, pelvis); tailX.panda.add(sph(M.patch, .14, .14, .14, 0, 0, 0, .07, 16));
    tailX.hen = grp(0, .55, -.38, pelvis); for (let i = 0; i < 5; i++) { const f = sph(M.fur, .1, .38, .06, 0, .3, 0, .08, 14); const pv = grp(0, 0, 0, tailX.hen); pv.rotation.set(-.6, 0, (i - 2) * .32); pv.add(f); }
    const SPECIES = {
      gata:    { fur: 0xA9A9B3, limb: 0xA9A9B3, muzzle: 0xFFFFFF, inner: 0xFF9EBF, nose: 0xF27AA8, tip: 0x8E8E9A, dark: 0x8E8E9A, ears: 'cat', tail: 'chain', whisk: true, stripes: true },
      perro:   { fur: 0xC69C6D, limb: 0xC69C6D, muzzle: 0xFFF1DE, inner: 0xFF9EBF, nose: 0x3A2A24, tip: 0xFFF1DE, earB: 0x8B5E3C, ears: 'dog', tail: 'short', face: 'dog', wag: 2.2 },
      zorro:   { fur: 0xF08A3C, limb: 0x6B4434, muzzle: 0xFFFFFF, inner: 0xFFF1DE, nose: 0x2A1A12, tip: 0xFFFFFF, ears: 'cat', earScale: 1.2, tail: 'bushy', face: 'fox', whisk: true },
      cerdo:   { fur: 0xFFB6C8, limb: 0xFFB6C8, muzzle: 0xFFB6C8, inner: 0xF48FB1, nose: 0xF48FB1, earB: 0xF48FB1, ears: 'pig', tail: 'pig', face: 'pig' },
      gallina: { fur: 0xFFFFFF, limb: 0xFFFFFF, muzzle: 0xFFFFFF, inner: 0xFF9EBF, nose: 0xF6A623, ears: 'none', tail: 'hen', face: 'hen' },
      conejo:  { fur: 0xD6BEA8, limb: 0xD6BEA8, muzzle: 0xFFFFFF, inner: 0xFF8FB8, nose: 0xFF8FB1, ears: 'bunny', tail: 'bunny', face: 'bunny', whisk: true },
      panda:   { fur: 0xFFFFFF, limb: 0x2E2A33, muzzle: 0xFFFFFF, inner: 0xFF9EBF, nose: 0x2E2A33, ears: 'panda', tail: 'panda', face: 'panda' }
    };
    let forceYaw = null;
    let petKey = '', curEars = null, curSp = SPECIES.gata;
    const mouthBase = null;
    function applySpecies(k) {
      const sp = SPECIES[k] || SPECIES.gata; petKey = SPECIES[k] ? k : 'gata'; curSp = sp;
      M.fur.color.setHex(sp.fur); M.limb.color.setHex(sp.limb); M.muzzle.color.setHex(sp.muzzle); M.pink.color.setHex(sp.inner);
      M.nose.color.setHex(sp.nose); M.tip.color.setHex(sp.tip || sp.fur); if (sp.earB) M.earB.color.setHex(sp.earB); if (sp.dark) M.dark.color.setHex(sp.dark);
      // orejas
      const catE = sp.ears === 'cat'; ears[-1].visible = ears[1].visible = catE;
      const sc = sp.earScale || 1; ears[-1].scale.setScalar(sc); ears[1].scale.setScalar(sc);
      SPX.dog.visible = sp.face === 'dog'; SPX.fox.visible = sp.face === 'fox'; SPX.pig.visible = sp.face === 'pig';
      SPX.bunny.visible = sp.face === 'bunny'; SPX.panda.visible = sp.face === 'panda'; SPX.hen.visible = sp.face === 'hen';
      curEars = { cat: { L: ears[-1], R: ears[1], b: .32, k: 1 }, dog: { L: dogEars[-1], R: dogEars[1], b: 0, k: 2.2 }, pig: { L: pigEars[-1], R: pigEars[1], b: 0, k: .8 },
        bunny: { L: bunEars[-1], R: bunEars[1], b: .12, k: 1.4 }, panda: { L: panEars[-1], R: panEars[1], b: 0, k: .3 } }[sp.ears] || null;
      // cara
      muzzleCat.visible = !['dog', 'fox', 'pig', 'hen', 'bunny'].includes(sp.face);
      noseCat.visible = !sp.face; whisk.visible = !!sp.whisk; stripes.visible = !!sp.stripes;
            const MA = { dog: [-.45, 1.04, .32], fox: [-.47, 1.07, .38], pig: [-.63, .73, .7], bunny: [-.41, 1.02, .16], panda: [-.41, 1.02, .16] }[sp.face] || [-.41, 1.02, .16];
      mouthG.position.set(0, MA[0], MA[1]); mouthG.rotation.x = MA[2];
      try { layoutHair(); } catch (e) { /* los accesorios aún no existen al iniciar */ }
      M.lid.color.setHex(sp.face === 'panda' ? 0x2E2A33 : sp.fur);
      M.happyL.color.setHex(sp.face === 'panda' ? 0xFFFDF2 : 0x4A4656);
      for (const s2 of [-1, 1]) { eyes[s2].eg.position.z = sp.face === 'panda' ? .78 : .72; eyes[s2].happy.position.z = sp.face === 'panda' ? .94 : .87; }
      // colas
      const chain = ['chain', 'short', 'bushy'].includes(sp.tail);
      tailMesh.visible = tailOutMesh.visible = chain;
      tailProfile = sp.tail; tailLen = sp.tail === 'short' ? 6 : 9; paintTail();
      for (const t of ['pig', 'bunny', 'panda', 'hen']) tailX[t].visible = sp.tail === t;
    }
    applySpecies('gata');
    // Accesorios de cabeza
    const H = {};
    H.bow = grp(.5, .7, .45, head); H.bow.rotation.z = -.3;
    for (const s of [-1, 1]) { const l = new T.Mesh(new T.ConeGeometry(.18, .32, 20), M.bow); l.rotation.z = Math.PI / 2 * -s; l.position.x = .17 * s; l.scale.set(1, 1, .6); H.bow.add(l);
      const tl = new T.Mesh(new T.BoxGeometry(.06, .2, .03), M.bowD); tl.position.set(.06 * s, -.12, 0); tl.rotation.z = .3 * s; H.bow.add(tl); }
    H.bow.add(sph(M.bowD, .08, .08, .06, 0, 0, .02, .15, 16));
    H.flower = grp(-.52, .68, .45, head);
    H.petals = grp(0, 0, 0, H.flower);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; H.petals.add(sph(M.petal, .1, .1, .05, Math.cos(a) * .12, Math.sin(a) * .12, 0, .12, 14)); }
    H.flower.add(sph(M.gold, .065, .065, .05, 0, 0, .03, 0, 14));
    H.cap = grp(0, 0, 0, head);
    { const dome = new T.Mesh(new T.SphereGeometry(1, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2.35), M.blue); dome.scale.set(1.16, 1.0, 1.0); dome.position.y = .08; H.cap.add(dome);
      const dout = new T.Mesh(new T.SphereGeometry(1, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2.35), OUT); dout.scale.set(1.2, 1.04, 1.04); dout.position.y = .08; H.cap.add(dout);
      const brim = cyl(M.blueD, .6, .6, .09, 40); brim.scale.set(1, 1, 1.2); brim.position.set(0, .5, .78); brim.rotation.x = .3; H.cap.add(brim);
      const brimO = cyl(OUT, .63, .63, .07, 40); brimO.scale.set(1, 1, 1.2); brimO.position.set(0, .5, .78); brimO.rotation.x = .3; H.cap.add(brimO);
      H.cap.add(sph(M.blueD, .08, .08, .08, 0, 1.08, 0, .15, 12)); H.cap.add(sph(M.cream, .08, .08, .03, 0, .82, .62, 0, 10)); }
    H.glasses = grp(0, .02, 1.0, head);
    { for (const s of [-1, 1]) { const r = torus(M.top, .29, .04, 0, 32); r.position.x = .39 * s; H.glasses.add(r);
        const arm = cyl(M.top, .025, .025, .5, 8); arm.rotation.x = Math.PI / 2; arm.position.set(.68 * s, 0, -.25); H.glasses.add(arm);
        const gl = new T.Mesh(new T.CircleGeometry(.27, 24), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .14 })); gl.position.x = .39 * s; H.glasses.add(gl); }
      const br = torus(M.top, .07, .025, Math.PI, 10); br.position.y = .02; H.glasses.add(br); }
    H.phones = grp(0, .02, -.3, head);
    { const bnd = torus(M.purple, 1.2, .07, Math.PI, 40); H.phones.add(bnd); const bo = torus(OUT, 1.2, .085, Math.PI, 40); H.phones.add(bo);
      for (const s of [-1, 1]) { const cu = cyl(M.purple, .26, .26, .22, 24); cu.rotation.z = Math.PI / 2; cu.position.x = 1.13 * s; H.phones.add(cu); const cuo = cyl(OUT, .28, .28, .2, 24); cuo.rotation.z = Math.PI / 2; cuo.position.x = 1.13 * s; H.phones.add(cuo);
        const ci = cyl(M.pink, .17, .17, .02, 24); ci.rotation.z = Math.PI / 2; ci.position.x = 1.25 * s; H.phones.add(ci); } }
    H.crown = grp(0, 1.0, 0, head);
    { const ring = cyl(M.gold, .36, .41, .26, 8, true); H.crown.add(ring); const ri = cyl(M.goldD, .35, .4, .26, 8, true); ri.material = M.goldD; ri.scale.setScalar(.97); H.crown.add(ri);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sp = new T.Mesh(new T.ConeGeometry(.08, .24, 8), M.gold); sp.position.set(Math.sin(a) * .37, .24, Math.cos(a) * .37); H.crown.add(sp);
        H.crown.add(sph(i % 2 ? M.blue : M.red, .05, .05, .05, Math.sin(a) * .4, 0, Math.cos(a) * .4, 0, 10)); } }
    H.star = grp(.68, .4, .6, head);
    { const sh = new T.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? .1 : .23; sh[i ? 'lineTo' : 'moveTo'](Math.sin(a) * r, Math.cos(a) * r); }
      const sg = new T.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: true, bevelThickness: .03, bevelSize: .02, bevelSegments: 2 }); sg.center();
      H.starMesh = new T.Mesh(sg, M.gold); H.star.add(H.starMesh); }
    // Moño y flor: en la base de la oreja si tiene orejas de gata; si no, prendidos sobre el cintillo
    function layoutHair() {
      if (curSp.ears === 'cat') { H.bow.position.set(.5, .7, .45); H.flower.position.set(-.52, .68, .45); }
      else { H.bow.position.set(.46, .62, .9); H.flower.position.set(-.46, .62, .9); }
    }
    layoutHair();
    // Efectos de cabeza: sudor, zzz, notas musicales
    const sweat = grp(.95, .45, .4, head); sweat.add(sph(M.water, .07, .09, .07, 0, 0, 0, 0, 14)); { const c = new T.Mesh(new T.ConeGeometry(.068, .12, 14), M.water); c.position.y = .09; sweat.add(c); }
    const zzz = [0, 1, 2].map(i => { const s = sprite(textTex(i ? 'Z' : 'z', '#5B5866'), .35 + i * .12, 0); s.position.set(1.0 + i * .28, .7 + i * .35, 0); head.add(s); return s; });
    const notes = [0, 1, 2].map(i => { const s = sprite(textTex(i % 2 ? '♫' : '♪', '#8E63E6', 'bold 90px sans-serif'), .45, 0); s.position.set(i === 1 ? -1.4 : 1.4, .3 + i * .2, .2); head.add(s); return s; });
    // Vaso y huevo (al beber o comer, junto a la boca)
    const glass = grp(.22, -.98, 1.0, head); glass.scale.setScalar(1.35);
    { const g1 = cyl(M.glass, .13, .11, .36, 20); glass.add(g1); const w = cyl(M.water, .115, .1, .26, 20); w.position.y = -.04; glass.add(w); glass.water = w;
      const straw = cyl(M.top, .018, .018, .5, 8); straw.position.set(-.1, .3, 0); straw.rotation.z = .5; glass.add(straw); }
    const egg = sph(M.egg, .13, .17, .13, .2, -.82, 1.02, .1, 20); head.add(egg);
    // Brazos
    const arms = {};
    for (const s of [-1, 1]) {
      const sh = grp(.44 * s, 1.16, 0, torso);
      sh.add(cap(M.limb, .13, .4, .025));
      const elb = grp(0, -.4, 0, sh);
      elb.add(cap(M.limb, .12, .36, .025));
      const wb = cyl(M.top, .135, .135, .09, 20); wb.position.y = -.3; elb.add(wb);
      const paw = grp(0, -.45, 0, elb); paw.add(sph(M.white, .16, .16, .16, 0, 0, 0, .14, 20));
      const elbPt = grp(0, -.2, 0, elb);
      arms[s] = { sh, elb, paw, elbPt };
    }
    const heldSprite = sprite(emojiTex('🍓'), .55); heldSprite.position.set(0, -.12, .34); arms[1].paw.add(heldSprite);
    const bellG = grp(0, 0, .05, arms[1].paw);
    { const bar = cyl(M.grey, .035, .035, .62, 10); bar.rotation.z = Math.PI / 2; bellG.add(bar);
      for (const s of [-1, 1]) { const pl = cyl(M.top, .12, .12, .1, 20); pl.rotation.z = Math.PI / 2; pl.position.x = .28 * s; bellG.add(pl); } }
    const bellL = bellG.clone(); arms[-1].paw.add(bellL);
    const rope = grp(0, 1.45, .05, yawG);
    { const pts = []; for (let i = 0; i <= 24; i++) { const a = Math.PI * i / 24; pts.push(new T.Vector3(-Math.cos(a) * .66, -Math.sin(a) * 2.95, 0)); }
      rope.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, .025, 6), toon(0xFF4F9A)));
      for (const s3 of [-1, 1]) { const hd = cyl(toon(0xFFD24D), .05, .05, .26, 10); hd.position.set(.66 * s3, .05, 0); rope.add(hd); } }
    let heldChar = '';

    // ---------- Sala de estar ----------
    const room = grp(0, 0, 0); scene.add(room);
    const texCanvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.anisotropy = 4; return t; };
    const woodTex = texCanvas(512, 512, (x, w, h) => { x.fillStyle = '#D9AE84'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#D2A57A' : '#DDB48C'; x.fillRect(i * 64, 0, 62, h); x.fillStyle = 'rgba(150,100,60,.25)'; x.fillRect(i * 64 + 62, 0, 2, h);
        for (let j = 0; j < 3; j++) { x.fillStyle = 'rgba(150,100,60,.18)'; x.fillRect(i * 64, ((i * 97 + j * 173) % 512), 62, 2); } } });
    woodTex.wrapS = woodTex.wrapT = T.RepeatWrapping; woodTex.repeat.set(3, 2);
    const floor = new T.Mesh(new T.PlaneGeometry(16, 10), new T.MeshToonMaterial({ map: woodTex, gradientMap: grad }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -1); room.add(floor);
    const wallMat = new T.MeshBasicMaterial({ color: 0xFFD6E6 }), wainMat = new T.MeshBasicMaterial({ color: 0xFFF1F6 });
    const wall = new T.Mesh(new T.PlaneGeometry(16, 9), wallMat); wall.position.set(0, 4.5, -4.6); room.add(wall);
    const wain = new T.Mesh(new T.PlaneGeometry(16, 1.6), wainMat); wain.position.set(0, .8, -4.58); room.add(wain);
    const rail = new T.Mesh(new T.BoxGeometry(16, .1, .08), M.white); rail.position.set(0, 1.62, -4.55); room.add(rail);
    const base = new T.Mesh(new T.BoxGeometry(16, .22, .1), M.white); base.position.set(0, .11, -4.55); room.add(base);
    // Ventana con cielo
    const skyTex = texCanvas(256, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9CCBFF'); g.addColorStop(1, '#DDEFFF'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = 'rgba(255,255,255,.95)'; [[60, 60, 26], [92, 52, 32], [124, 62, 24], [180, 120, 20], [206, 112, 26], [232, 122, 18]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }); });
    const win = grp(-2.1, 4.3, -4.5, room);
    const winPane = new T.Mesh(new T.PlaneGeometry(2.2, 1.7), new T.MeshBasicMaterial({ map: skyTex })); win.add(winPane);
    for (const [w, h, x, y] of [[2.4, .14, 0, .92], [2.4, .14, 0, -.92], [.14, 1.98, -1.13, 0], [.14, 1.98, 1.13, 0], [.08, 1.7, 0, 0], [2.2, .08, 0, 0]]) { const f = new T.Mesh(new T.BoxGeometry(w, h, .1), M.white); f.position.set(x, y, .03); win.add(f); }
    const sill = new T.Mesh(new T.BoxGeometry(2.7, .1, .35), M.white); sill.position.set(0, -1.02, .15); win.add(sill);
    // Cuadro motivacional
    const posterTex = texCanvas(256, 320, (x, w, h) => { x.fillStyle = '#FFF8E7'; x.fillRect(0, 0, w, h); x.fillStyle = '#FF4F9A'; x.font = 'bold 54px Georgia, serif'; x.textAlign = 'center';
      x.fillText('Tú', w / 2, 120); x.fillText('puedes', w / 2, 185); x.font = '70px sans-serif'; x.fillText('💪', w / 2, 270); });
    const poster = grp(2.3, 4.5, -4.52, room);
    const posterPane = new T.Mesh(new T.PlaneGeometry(1.1, 1.38), new T.MeshBasicMaterial({ map: posterTex })); poster.add(posterPane);
    const pf = new T.Mesh(new T.BoxGeometry(1.26, 1.54, .06), M.goldD); pf.position.z = -.04; poster.add(pf);
    // Alfombra, mat de yoga, puff, pesas y planta
    const rugMat = toon(0xFFF0F5), rugBMat = toon(0xFFB3CF);
    const rug = new T.Mesh(new T.CircleGeometry(2.1, 48), rugMat); rug.rotation.x = -Math.PI / 2; rug.position.set(-.3, .012, .1); room.add(rug);
    const rugB = new T.Mesh(new T.RingGeometry(1.95, 2.1, 48), rugBMat); rugB.rotation.x = -Math.PI / 2; rugB.position.set(-.3, .014, .1); room.add(rugB);
    const SPOT = { home: [-.1, .3], puff: [-2.05, -1.9], mat: [1.7, -.6], bells: [2.15, -2.3] };
    const yogaMat = toon(0x7FD6C2);
    const mat = new T.Mesh(new T.BoxGeometry(1.15, .05, 2.5), yogaMat); mat.position.set(SPOT.mat[0], .03, SPOT.mat[1]); room.add(mat);
    const matEdge = new T.Mesh(new T.BoxGeometry(1.2, .03, 2.55), toon(0x4FB8A2)); matEdge.position.set(SPOT.mat[0], .015, SPOT.mat[1]); room.add(matEdge);
    const puffMat = toon(0xC9A8FF);
    const puff = sph(puffMat, .95, .55, .95, SPOT.puff[0], .55, SPOT.puff[1], .04, 32); room.add(puff);
    const seamMat = toon(0xB08CEB);
    const seam = torus(seamMat, 1.0, .05, 0, 48); seam.rotation.x = Math.PI / 2; seam.position.set(SPOT.puff[0], .62, SPOT.puff[1]); seam.scale.set(.92, .92, 1); room.add(seam);
    const bellsFloor = grp(SPOT.bells[0], 0, SPOT.bells[1], room);
    const rack = new T.Mesh(new T.BoxGeometry(1.3, .12, .55), toon(0x8E8E9A)); rack.position.y = .06; bellsFloor.add(rack);
    const floorPair = grp(0, .26, 0, bellsFloor);
    for (const x of [-.32, .32]) { const b = bellG.clone(); b.visible = true; b.position.set(x, 0, 0); b.rotation.y = Math.PI / 2; b.scale.setScalar(1.15); floorPair.add(b); }
    const kb = grp(.0, .12, -.05, bellsFloor); kb.position.x = .9; kb.add(sph(toon(0xFF4F9A), .26, .24, .26, 0, .26, 0, .06, 20)); { const hdl = torus(M.line, .14, .045, Math.PI, 16); hdl.position.y = .48; kb.add(hdl); }
    const plant = grp(3.6, 0, -3.7, room);
    { const pot = cyl(toon(0xF2A07B), .38, .3, .6, 20); pot.position.y = .3; plant.add(pot);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const lf = sph(toon(i % 2 ? 0x6CC28A : 0x52AE74), .16, .55, .1, Math.sin(a) * .22, 1.05, Math.cos(a) * .22, .05, 16); lf.rotation.set(Math.cos(a) * .5, a, -Math.sin(a) * .5); plant.add(lf); } }
    // ---------- Ambientes: cada fondo es una sala distinta ----------
    const winTex = {
      day: skyTex,
      garden: texCanvas(256, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#A9DBFF'); g.addColorStop(.55, '#E4F6FF'); g.addColorStop(.56, '#8FD49A'); g.addColorStop(1, '#5DB874'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#4FA866'; [[30, 130, 34], [90, 140, 28], [170, 128, 40], [235, 138, 30]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
        x.fillStyle = '#FFE36E'; x.beginPath(); x.arc(205, 40, 18, 0, 7); x.fill();
        ['#FF8FBF', '#FFF', '#FFD24D'].forEach((c, i) => { x.fillStyle = c; for (let j = 0; j < 6; j++) { x.beginPath(); x.arc(20 + j * 42 + i * 9, 170 + (j % 2) * 10, 5, 0, 7); x.fill(); } }); }),
      night: texCanvas(256, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1E1B4B'); g.addColorStop(1, '#4C3A8F'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#FFF6C8'; x.beginPath(); x.arc(190, 55, 26, 0, 7); x.fill(); x.fillStyle = '#2A2560'; x.beginPath(); x.arc(178, 47, 24, 0, 7); x.fill();
        x.fillStyle = '#FFFFFF'; for (let i = 0; i < 40; i++) { x.globalAlpha = .4 + (i % 5) / 8; x.fillRect((i * 67) % w, (i * 41) % (h - 20), 2, 2); } x.globalAlpha = 1; }),
      ocean: texCanvas(256, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#7EC8FF'); g.addColorStop(.5, '#D8F0FF'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#FFE36E'; x.beginPath(); x.arc(60, 70, 22, 0, 7); x.fill();
        const s2 = x.createLinearGradient(0, 110, 0, h); s2.addColorStop(0, '#2F8FDB'); s2.addColorStop(1, '#5CC3E8'); x.fillStyle = s2; x.fillRect(0, 110, w, 60);
        x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 3; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(10 + i * 64, 130 + (i % 2) * 14); x.quadraticCurveTo(30 + i * 64, 122 + (i % 2) * 14, 50 + i * 64, 130 + (i % 2) * 14); x.stroke(); }
        x.fillStyle = '#F6DDA8'; x.fillRect(0, 170, w, 30); }),
      sunset: texCanvas(256, 200, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#FF9E7A'); g.addColorStop(.6, '#FFD27A'); g.addColorStop(1, '#FFE9B8'); x.fillStyle = g; x.fillRect(0, 0, w, h);
        x.fillStyle = '#FFF3C8'; x.beginPath(); x.arc(128, 150, 40, 0, 7); x.fill(); x.fillStyle = 'rgba(180,90,70,.45)'; x.fillRect(0, 160, w, 40);
        x.fillStyle = 'rgba(255,255,255,.7)'; [[50, 50, 18], [72, 46, 22], [200, 70, 16], [220, 66, 20]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); }); })
    };
    const posterOf = (l1, l2, emo, bg, fg) => texCanvas(256, 320, (x, w, h) => { x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.font = 'bold 50px Georgia, serif'; x.textAlign = 'center'; x.fillText(l1, w / 2, 115); x.fillText(l2, w / 2, 180); x.font = '70px sans-serif'; x.fillText(emo, w / 2, 270); });
    // Extras de cada ambiente
    const extras = {};
    extras.menta = grp(0, 0, 0, room);
    { const mk = (x, z, s, c) => { const p = plant.clone(); p.position.set(x, 0, z); p.scale.setScalar(s); extras.menta.add(p); };
      mk(-3.7, -3.9, 1.25); mk(-1.0, -4.1, .7); mk(3.0, -1.5, .8);
      const hang = grp(.8, 6.2, -4.35, extras.menta);
      for (let i = 0; i < 9; i++) { const lf = sph(toon(i % 2 ? 0x6CC28A : 0x52AE74), .12, .28, .06, Math.sin(i) * .35, -i * .2, 0, .05, 12); lf.rotation.z = Math.sin(i * 1.7) * .6; hang.add(lf); }
      const pot = cyl(toon(0xFFFFFF), .28, .22, .3, 16); hang.add(pot); }
    extras.lavanda = grp(0, 0, 0, room);
    { const lights = []; const cols = [0xFFF3B0, 0xFFB3E1, 0xB8E1FF, 0xD8C2FF];
      for (let i = 0; i < 16; i++) { const t = i / 15, x = -6 + t * 12, y = 6.6 - Math.sin(t * Math.PI * 2) ** 2 * .45; const b = new T.Mesh(sphG(12), new T.MeshBasicMaterial({ color: cols[i % 4] })); b.scale.setScalar(.09); b.position.set(x, y, -4.45); extras.lavanda.add(b); lights.push(b); }
      extras.lights = lights;
      for (let i = 0; i < 9; i++) { const st = H.starMesh.clone(); st.material = new T.MeshBasicMaterial({ color: 0xFFF6C8 }); st.scale.setScalar(.45 + (i % 3) * .2); st.position.set(-4 + (i * 1.13) % 8.2, 2.6 + (i * .77) % 3.4, -4.5); extras.lavanda.add(st); }
      const moon = new T.Mesh(new T.CircleGeometry(.5, 32), new T.MeshBasicMaterial({ color: 0xFFF6C8 })); moon.position.set(.6, 5.6, -4.52); extras.lavanda.add(moon);
      const bite = new T.Mesh(new T.CircleGeometry(.45, 32), new T.MeshBasicMaterial({ color: 0xD9C9F5 })); bite.position.set(.82, 5.72, -4.51); extras.lavanda.add(bite); extras.moonBite = bite;
      const lamp = grp(3.2, 0, -2.8, extras.lavanda); const pole = cyl(M.line, .04, .04, 2.2, 8); pole.position.y = 1.1; lamp.add(pole);
      const shade = cyl(new T.MeshBasicMaterial({ color: 0xFFE9A8 }), .25, .45, .5, 20, true); shade.position.y = 2.3; lamp.add(shade); lamp.add(cyl(M.line, .3, .3, .05, 16)); }
    extras.cielo = grp(0, 0, 0, room);
    { const cloudM = new T.MeshBasicMaterial({ color: 0xFFFFFF });
      [[-4.2, 6, 1], [1.2, 6.4, .8], [4.4, 5.3, 1.1], [-.6, 3.0, .6]].forEach(([x, y, s]) => { const c = grp(x, y, -4.5, extras.cielo); [[0, 0, .5], [.45, .1, .42], [-.45, .05, .38], [.15, .3, .4]].forEach(([a, b, r]) => { const m = new T.Mesh(new T.CircleGeometry(r * s, 24), cloudM); m.position.set(a * s, b * s, 0); c.add(m); }); });
      const ballTex = texCanvas(256, 128, (x, w, h) => { ['#FF4F9A', '#FFFFFF', '#5B9BF0', '#FFFFFF', '#FFD24D', '#FFFFFF'].forEach((c, i) => { x.fillStyle = c; x.fillRect(i * w / 6, 0, w / 6 + 1, h); }); });
      const ball = new T.Mesh(sphG(24), new T.MeshToonMaterial({ map: ballTex, gradientMap: grad })); ball.scale.setScalar(.38); ball.position.set(-1.0, .38, -2.6); extras.cielo.add(ball); extras.ball = ball;
      const board = sph(toon(0x5CC3E8), .32, 1.6, .08, 3.4, 1.6, -4.25, .06, 24); board.rotation.z = -.12; extras.cielo.add(board);
      const strip = new T.Mesh(new T.BoxGeometry(.06, 2.8, .02), M.white); strip.position.set(3.4, 1.6, -4.15); strip.rotation.z = -.12; extras.cielo.add(strip); }
    extras.dorado = grp(0, 0, 0, room);
    {
      const shelf = new T.Mesh(new T.BoxGeometry(2.2, .1, .5), toon(0xB8862A)); shelf.position.set(-3.5, 2.6, -4.3); extras.dorado.add(shelf);
      for (const [x, s] of [[-4.1, 1], [-3.5, 1.3], [-2.9, .9]]) { const tr = grp(x, 2.65, -4.3, extras.dorado); tr.scale.setScalar(s);
        const cup = cyl(M.gold, .2, .1, .3, 16); cup.position.y = .35; tr.add(cup); const st2 = cyl(M.gold, .04, .04, .2, 8); st2.position.y = .12; tr.add(st2); const bs = cyl(M.goldD, .14, .16, .08, 12); bs.position.y = .04; tr.add(bs);
        for (const sg of [-1, 1]) { const hd = torus(M.gold, .08, .02, Math.PI, 10); hd.rotation.z = sg * Math.PI / 2; hd.position.set(.2 * sg, .38, 0); tr.add(hd); } }
      const bigStar = H.starMesh.clone(); bigStar.material = M.gold; bigStar.scale.setScalar(1.6); bigStar.position.set(3.6, 5.8, -4.45); extras.dorado.add(bigStar); extras.goldStar = bigStar; }
    // ---------- Poses (mismos nombres y ángulos que la versión 2D, más giro del cuerpo) ----------
    const S = Math.sin, C = Math.cos, ab = Math.abs, R = Math.PI / 180;
    const cyc = (t, f) => .5 - .5 * C(t * f), rnd = (a, b) => a + Math.random() * (b - a);
    const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const REST = { x: 0, hop: 0, lean: 0, head: 0, aL: 10, eL: 8, aR: 10, eR: 8, hL: 3, kL: 0, hR: 3, kR: 0, ears: 0, tailAmp: 14, tailSpd: 2.2, look: 0, lookY: 0, yaw: 0, fwdL: 0, fwdR: 0, nod: 0, bfL: 0, bfR: 0, fhL: 0, fhR: 0, fkL: 0, fkR: 0 };
    const KEYS = Object.keys(REST);
    const POSES = {
      idle:    { tags: { normal: 3, train: 1, joy: 1 }, base: {}, m: t => ({ lean: 2 * S(t * 1.3), head: 3 * S(t * .9), yaw: 14 * S(t * .5) }) },
      hips:    { tags: { normal: 2, train: 1, joy: 1 }, base: { aL: 50, eL: -76, aR: 50, eR: -76, hL: 6, hR: 6, fwdL: -20, fwdR: -20 }, m: t => ({ lean: 3 * S(t * 1.2), head: 6 * S(t * .8), yaw: -18 + 6 * S(t * .7) }) },
      wave:    { tags: { normal: 2, joy: 1 }, base: { aR: 140, eR: 18, head: -7, yaw: 12 }, m: t => ({ eR: 26 * S(t * 9), lean: -3 }), dur: [1.6, 2.4] },
      flex:    { tags: { normal: 1, train: 3, joy: 1 }, base: { aL: 80, eL: 80, aR: 80, eR: 80, hL: 12, hR: 12 }, m: t => { const s = S(t * 7); return { aL: 6 * s, aR: 6 * s, eL: 10 * s, eR: 10 * s, hop: 2 * ab(s), yaw: 10 * S(t * 1.5) }; } },
      curl:    { tags: { train: 3, normal: 1 }, base: { aR: 14, aL: 14, yaw: -22 }, m: t => ({ fwdR: -10, bfR: -10 - 125 * cyc(t, 4), lean: -2 * cyc(t, 4) }), dur: [2.6, 3.8], bell: 4 },
      press:   { tags: { train: 2 }, base: {}, m: t => { const s = cyc(t, 3.2); return { aL: 60 + 62 * s, aR: 60 + 62 * s, eL: 92 - 64 * s, eR: 92 - 64 * s }; }, dur: [2.6, 3.6], bell: 3 },
      jacks:   { tags: { train: 3, joy: 2 }, base: {}, m: t => { const s = cyc(t, 6); return { aL: 2 + 128 * s, aR: 2 + 128 * s, eL: 4 + 10 * s, eR: 4 + 10 * s, hL: 3 + 15 * s, hR: 3 + 15 * s, hop: 12 * ab(S(t * 6)) }; }, dur: [2.4, 3.4] },
      squat:   { tags: { train: 3 }, base: { yaw: 25 }, m: t => { const s = cyc(t, 3); return { hL: 3 + 36 * s, kL: -72 * s, hR: 3 + 36 * s, kR: -72 * s, fwdL: -80 * s, fwdR: -80 * s }; }, dur: [2.8, 4] },
      stretch: { tags: { normal: 2, sleepy: 1 }, base: { aL: 135, eL: 10, aR: 20, eR: 10 }, m: t => ({ lean: 12 * S(t * 1.6), head: 9 * S(t * 1.6) }), dur: [2.2, 3] },
      tree:    { tags: { normal: 1, train: 2 }, base: { aL: 135, eL: 12, aR: 135, eR: 12, hR: 62, kR: -125 }, m: t => ({ lean: 3 * S(t * 2) }), dur: [2, 3] },
      kick:    { tags: { train: 2, joy: 1 }, base: { aL: 70, eL: 60, aR: 70, eR: 60 }, m: t => { const s = cyc(t, 5); return { hR: 4 + 58 * s, kR: -10 * s, lean: -8 * s }; }, dur: [2, 3] },
      dance:   { tags: { joy: 4, normal: 1 }, base: {}, m: t => ({ lean: 9 * S(t * 4), head: 7 * S(t * 4), aL: 45 + 45 * S(t * 4), aR: 45 - 45 * S(t * 4), eL: 52, eR: 52, hop: 6 * ab(S(t * 8)), hL: 6 + 6 * S(t * 4), hR: 6 - 6 * S(t * 4), tailAmp: 26, tailSpd: 5, yaw: 25 * S(t * 2) }), dur: [2.6, 4] },
      cheer:   { tags: { joy: 3 }, base: { aL: 130, eL: 15, aR: 130, eR: 15, tailAmp: 24, tailSpd: 5 }, m: t => ({ hop: 14 * ab(S(t * 5)), head: 5 * S(t * 5) }), dur: [1.6, 2.4] },
      think:   { tags: { normal: 1 }, base: { aR: -10, eR: -150, aL: 20, eL: -78, head: 10, look: -1, yaw: -15 }, m: t => ({ head: 3 * S(t * 1.5) }) },
      spin:    { tags: { joy: 1, normal: 1 }, base: { aL: 60, eL: 20, aR: 60, eR: 20 }, m: t => ({ yaw: Math.min(1, t / 1.4) * 360, hop: 6 * ab(S(t * 4.5)) }), dur: [1.8, 2.2] },
      peek:    { tags: { normal: 1 }, base: { yaw: 70, aL: 20, eL: -78, aR: 20, eR: -78 }, m: t => ({ head: 8 * S(t * 2), look: S(t * 2) }), dur: [1.8, 2.6] },
      slouch:  { tags: { thirsty: 4 }, base: { aL: 4, eL: 4, aR: 4, eR: 4, head: 9, nod: 10, ears: -24, kL: -8, kR: -8, hL: 6, hR: 6, tailAmp: 5, tailSpd: 1 }, m: t => ({ lean: 3 * S(t * .9), head: 3 * S(t * .9) }) },
      fan:     { tags: { thirsty: 3 }, base: { aL: 6, eL: 4, aR: 112, eR: 72, head: -6, ears: -20, tailAmp: 5, tailSpd: 1, yaw: -10 }, m: t => ({ eR: 22 * S(t * 14) }) },
      nod:     { tags: { sleepy: 4 }, base: { aL: 6, eL: 6, aR: 6, eR: 6, ears: -12, tailAmp: 4, tailSpd: .8 }, m: t => ({ head: 11 * S(t * 1.1), nod: 12 + 8 * S(t * 1.1), lean: 3 * S(t * 1.1) }) },
      yawn:    { tags: { sleepy: 2 }, base: { aL: 130, eL: 20, aR: 130, eR: 20, ears: -8, tailAmp: 4, tailSpd: .8, nod: -10 }, m: t => ({ lean: 4 * S(t * 1.2) }), dur: [2, 2.8] },
      tummy:   { tags: { hungry: 4 }, base: { aL: 20, eL: -78, aR: 20, eR: -78, fwdL: -35, fwdR: -35, head: 9, nod: 12, look: 1, tailAmp: 8 }, m: t => ({ eL: 8 * S(t * 6), eR: -8 * S(t * 6), lean: 3 * S(t * 2) }) },
      drinking:{ base: { aR: -6, eR: -120, fwdR: -75, aL: 12, eL: 10, head: -9, nod: -14 }, m: t => ({ head: 2 * S(t * 12) }) },
      eating:  { base: { aR: -6, eR: -120, fwdR: -75, aL: 20, eL: -78, head: -4, nod: -6 }, m: t => ({ eR: 6 * S(t * 14) }) },
      pickup:  { base: { hL: 30, kL: -62, hR: 30, kR: -62, fwdL: -70, fwdR: -70, aL: 14, aR: 14, nod: 22 }, m: t => ({}) },
      curl2:   { base: { aL: 14, aR: 14, fwdL: -10, fwdR: -10 }, m: t => ({ bfL: -10 - 120 * cyc(t, 4), bfR: -10 - 120 * cyc(t + .8, 4), lean: 2 * S(t * 4) }) },
      press2:  { base: {}, m: t => { const s = cyc(t, 3.2); return { aL: 60 + 62 * s, aR: 60 + 62 * s, eL: 92 - 64 * s, eR: 92 - 64 * s }; } },
      relax:   { base: { aL: 18, eL: -40, aR: 18, eR: -40, fwdL: -45, fwdR: -45, nod: -4 }, m: t => ({ head: 7 * S(t * .8), look: S(t * .6) }) },
      sitnod:  { base: { aL: 18, eL: -40, aR: 18, eR: -40, fwdL: -45, fwdR: -45, ears: -10, tailAmp: 4, tailSpd: .8 }, m: t => ({ head: 9 * S(t * 1.1), nod: 14 + 8 * S(t * 1.1) }) },
      gaze:    { base: { aL: 20, eL: -78, aR: 20, eR: -78, fwdL: 30, fwdR: 30, nod: -22, tailAmp: 10, tailSpd: 1.5 }, m: t => ({ head: 6 * S(t * .9) }) },
      smell:   { base: { hL: 20, kL: -40, hR: 20, kR: -40, nod: 26, aL: 30, eL: 40, aR: 30, eR: 40, fwdL: -40, fwdR: -40, tailAmp: 20, tailSpd: 4 }, m: t => ({ head: 5 * S(t * 3) }) },
      rope:    { base: { aL: 26, eL: 22, aR: 26, eR: 22, fwdL: -25, fwdR: -25 }, m: t => ({ hop: 15 * Math.pow(Math.max(0, C(t * 6)), 2), eL: 6 * S(t * 6), eR: 6 * S(t * 6) }) },
      kickball:{ base: { aL: 50, eL: 20, aR: 50, eR: 20 }, m: t => { const s = Math.sin(Math.min(1, t / .9) * Math.PI); return { fhR: -70 * s, fkR: 20 * s, lean: 6 * s }; } },
      walkpose:{ base: { aL: 8, eL: 10, aR: 8, eR: 10 }, m: t => ({ head: 3 * S(t * 4) }) },
      admire_head: { base: { aR: 128, eR: 22, aL: 12, eL: 10, head: -6, nod: -16, look: .25, lookY: -1, tailAmp: 18, tailSpd: 3 }, m: t => ({ head: 2 * S(t * 3), eR: 5 * S(t * 4) }) },
      admire_neck: { base: { aR: 22, eR: -96, fwdR: -30, aL: 14, eL: 10, head: 6, nod: 20, lookY: 1, tailAmp: 18, tailSpd: 3 }, m: t => ({ eR: 4 * S(t * 4), head: 2 * S(t * 2) }) },
      admire_hand: { base: { aR: 70, eR: 70, fwdR: -40, aL: 12, eL: 10, head: 9, nod: 6, look: 1, lookY: -.3, yaw: 15, tailAmp: 18, tailSpd: 3 }, m: t => ({ aR: 4 * S(t * 3), eR: 6 * S(t * 3) }) },
      admire_bg:   { base: { aL: 50, eL: -76, aR: 50, eR: -76, lookY: -.6, tailAmp: 18, tailSpd: 3 }, m: t => ({ look: S(t * 2.4), head: 6 * S(t * 2.4), yaw: 30 * S(t * 1.6) }) }
    };
    const ARMS = [[10, 8], [50, -76], [80, 80], [132, 16], [82, 0], [20, -78], [100, 40], [35, 40], [120, -15], [55, 110]];
    const LEGS = [[3, 0], [14, 0], [28, -50], [8, -14]];
    function generate() {
      const a = ARMS[Math.floor(Math.random() * ARMS.length)], b = Math.random() < .45 ? a : ARMS[Math.floor(Math.random() * ARMS.length)];
      const l = LEGS[Math.floor(Math.random() * LEGS.length)], one = Math.random() < .25;
      const base = { aL: a[0] + rnd(-8, 8), eL: a[1] + rnd(-10, 10), aR: b[0] + rnd(-8, 8), eR: b[1] + rnd(-10, 10), fwdL: rnd(-30, 10), fwdR: rnd(-30, 10),
        hL: l[0], kL: l[1], hR: one ? 4 : l[0], kR: one ? 0 : l[1], lean: rnd(-9, 9), head: rnd(-11, 11), look: rnd(-1, 1), yaw: rnd(-35, 35), nod: rnd(-8, 8) };
      const f = rnd(.8, 2.2), amp = rnd(2, 6), bounce = Math.random() < .4 ? rnd(2, 6) : 0;
      return { base, m: t => ({ lean: amp * S(t * f), head: amp * .8 * S(t * f + 1), hop: bounce * ab(S(t * f * 2)), yaw: amp * 2 * S(t * f * .5) }), dur: [1.8, 3.2] };
    }
    let vals = Object.assign({}, REST), from = Object.assign({}, REST), cur = POSES.idle, curName = 'idle';
    let tPose = 0, trans = .6, hold = 2.5, now = 0, last = 0, forced = null;
    const st = { blinkAt: 1.5, blinkT: -9, lookX: 0, lookY: 0, lookTX: 0, lookTY: 0, lookAt: 1, earL: 0, earLv: 0, earR: 0, earRv: 0, prevHead: 0, prevHop: 0,
      medal: 0, medalV: 0, scarf: 0, scarfV: 0, bow: 0, bowV: 0, twitchAt: 3, winkUntil: 0, lid: 0, userYaw: 0, userYawV: 0, dragging: false, lastDrag: -9 };
    const moodNow = () => { const c = state.classList; for (const m of ['thirsty', 'sleepy', 'hungry', 'train', 'joy']) if (c.contains('mood-' + m)) return m; return 'normal'; };
    function reactionNow() {
      const c = state.classList;
      if (c.contains('drinking')) return 'drinking'; if (c.contains('eating')) return 'eating';
      if (c.contains('admire')) return 'admire_' + (state.dataset.admire || 'head');
      if (c.contains('boing')) return 'cheer'; if (c.contains('flex')) return 'flex'; if (c.contains('g-wave')) return 'wave';
      return null;
    }
    function setPose(p, name, d) { from = Object.assign({}, vals); if (curName === 'spin') from.yaw = ((from.yaw % 360) + 540) % 360 - 180; cur = p; curName = name; tPose = now; trans = rnd(.45, .75); hold = d || rnd(...(p.dur || [2.2, 3.6])); }
    function pickNext() {
      const mood = moodNow(), hasBell = state.dataset.bell === '1';
      if ((mood === 'normal' || mood === 'joy' || mood === 'train') && Math.random() < (mood === 'train' ? .15 : .35)) return setPose(generate(), 'gen');
      const pool = [];
      for (const [k, p] of Object.entries(POSES)) { if (!p.tags || k === curName) continue; let w = p.tags[mood] || 0; if (hasBell && p.bell) w += p.bell; for (let i = 0; i < w; i++) pool.push(k); }
      const k = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 'idle'; setPose(POSES[k], k);
    }
    const spring = (pos, vel, target, k, c, dt, push) => { vel += (-k * (pos - target) - c * vel + (push || 0)) * dt; return [pos + vel * dt, vel]; };
    // ---------- Actividades: cuando nadie la toca, se mueve sola por la sala ----------
    st.px = SPOT.home[0]; st.pz = SPOT.home[1]; st.fy = 0; st.fyT = 0; st.walkAmt = 0; st.sitAmt = 0; st.ph = 0; st.carry = false; st.lastTouch = 0; st.nextAct = 4;
    let act = null;
    // ---------- Mundos: cada fondo es un lugar distinto, con sus propias cosas ----------
    const W = { rosa: room };
    const worldOf = k => { const g = grp(0, 0, 0); scene.add(g); W[k] = g; return g; };
    const ground = (g, mat2) => { const f = new T.Mesh(new T.PlaneGeometry(18, 12), mat2); f.rotation.x = -Math.PI / 2; f.position.set(0, 0, -1); g.add(f); return f; };
    const backdrop = (g, tex, z, w, h, y) => { const b = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex })); b.position.set(0, y, z); g.add(b); return b; };
    const box3 = (mat2, w, h, d, x, y, z, parent, outline) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat2); m.position.set(x, y, z); parent.add(m);
      if (outline) { const o = new T.Mesh(new T.BoxGeometry(w + outline, h + outline, d + outline), OUT); m.add(o); } return m; };
    // Rosa: lo que ya había
    const SPOTS = { rosa: { seat: { x: SPOT.puff[0], z: SPOT.puff[1] + .25, y: 1.12, ax: SPOT.puff[0], az: SPOT.puff[1] + 1.25 }, bells: { x: SPOT.bells[0], z: SPOT.bells[1], pair: floorPair }, yoga: { x: SPOT.mat[0], z: SPOT.mat[1] }, acts: ['sit', 'bells', 'yoga'] } };
    // ===== Menta: jardín al aire libre =====
    { const g = worldOf('menta');
      const grassTex = texCanvas(256, 256, (x, w, h) => { x.fillStyle = '#6FBF6A'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = i % 3 ? 'rgba(50,120,60,.4)' : 'rgba(170,230,160,.45)'; x.fillRect((i * 97) % w, (i * 61) % h, 2, 6); } });
      grassTex.wrapS = grassTex.wrapT = T.RepeatWrapping; grassTex.repeat.set(5, 4);
      ground(g, new T.MeshToonMaterial({ map: grassTex, gradientMap: grad }));
      backdrop(g, texCanvas(512, 256, (x, w, h) => { const s2 = x.createLinearGradient(0, 0, 0, h); s2.addColorStop(0, '#8CCBFF'); s2.addColorStop(.7, '#DDF2FF'); x.fillStyle = s2; x.fillRect(0, 0, w, h);
        x.fillStyle = '#FFE36E'; x.beginPath(); x.arc(420, 50, 28, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.95)'; [[80, 60, 22], [110, 52, 28], [140, 62, 20], [300, 90, 18], [325, 84, 24]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
        x.fillStyle = '#7CC48A'; x.beginPath(); x.ellipse(120, 250, 220, 80, 0, 0, 7); x.fill(); x.fillStyle = '#6BB57B'; x.beginPath(); x.ellipse(400, 260, 240, 90, 0, 0, 7); x.fill(); }), -6.5, 22, 11, 4.2);
      for (let i = -8; i <= 8; i++) { box3(M.white, .2, 1.1, .08, i * .55, .55, -4.3, g); const tip = new T.Mesh(new T.ConeGeometry(.14, .2, 4), M.white); tip.position.set(i * .55, 1.2, -4.3); tip.rotation.y = Math.PI / 4; g.add(tip); }
      box3(M.white, 9.5, .1, .06, 0, .75, -4.26, g); box3(M.white, 9.5, .1, .06, 0, .35, -4.26, g);
      const tree = (x, z, s) => { const t = grp(x, 0, z, g); t.scale.setScalar(s); const tr = cyl(toon(0x9C6B4A), .18, .26, 2.2, 12); tr.position.y = 1.1; t.add(tr);
        [[0, 2.6, 0, 1.1], [-.6, 2.2, .2, .75], [.6, 2.3, .1, .8], [0, 3.3, -.1, .8]].forEach(([a, b, c, r]) => t.add(sph(toon(0x5DB874), r, r * .9, r, a, b, c, .04, 20)));
        for (let i = 0; i < 4; i++) t.add(sph(toon(0xFF6F91), .1, .1, .1, Math.sin(i * 2) * .9, 2.4 + (i % 2) * .6, .85, 0, 10)); };
      tree(-4.0, -3.6, 1.15); tree(4.1, -3.2, 1);
      // Banca de madera
      const bench = grp(-2.1, 0, -2.0, g); const wood = toon(0xC98B58), woodD = toon(0x9C6B4A);
      box3(wood, 1.9, .12, .6, 0, .86, 0, bench, .05); box3(wood, 1.9, .5, .1, 0, 1.3, -.3, bench, .05);
      for (const x of [-.8, .8]) { box3(woodD, .12, .86, .5, x, .43, 0, bench); }
      // Cantero de flores
      const bed = grp(2.0, 0, -2.4, g); box3(toon(0x9C6B4A), 1.8, .3, .8, 0, .15, 0, bed, .04);
      const fcol = [0xFF6F91, 0xFFD24D, 0xFFFFFF, 0xC9A8FF, 0xFF9EBF];
      for (let i = 0; i < 10; i++) { const fx = -.75 + (i % 5) * .37, fz = i < 5 ? -.15 : .18; const st2 = cyl(toon(0x52AE74), .025, .025, .5, 6); st2.position.set(fx, .5, fz); bed.add(st2);
        const fl = sph(toon(fcol[i % 5]), .12, .1, .12, fx, .78, fz, .1, 12); bed.add(fl); bed.add(sph(M.gold, .045, .045, .045, fx, .83, fz + .08, 0, 8)); }
      const can = grp(3.1, 0, -1.9, g); can.add(cyl(toon(0x7EC8FF), .2, .22, .4, 16)); can.children[0].position.y = .2; const sp2 = cyl(toon(0x7EC8FF), .04, .05, .45, 8); sp2.position.set(-.27, .35, 0); sp2.rotation.z = .9; can.add(sp2);
      // Mariposas
      W.butterflies = [0, 1].map(i => { const b = sprite(emojiTex('🦋'), .45); b.position.set(i ? 2 : -1, 2.5, -2); g.add(b); return b; });
      SPOTS.menta = { seat: { x: -2.1, z: -1.85, y: 1.02, ax: -2.1, az: -.9 }, flowers: { x: 2.0, z: -2.4 }, rope: { x: 1.1, z: -.3 }, acts: ['sit', 'flowers', 'rope'] }; }
    // ===== Lavanda: dormitorio de noche =====
    { const g = worldOf('lavanda');
      const f = ground(g, new T.MeshToonMaterial({ map: woodTex, gradientMap: grad, color: 0xB9A3DE }));
      const wl = new T.Mesh(new T.PlaneGeometry(16, 9), new T.MeshBasicMaterial({ color: 0xAE97E2 })); wl.position.set(0, 4.5, -4.6); g.add(wl);
      box3(new T.MeshBasicMaterial({ color: 0xFFFFFF }), 16, .22, .1, 0, .11, -4.55, g);
      const w2 = grp(1.7, 4.4, -4.5, g); w2.add(new T.Mesh(new T.PlaneGeometry(2.0, 2.2), new T.MeshBasicMaterial({ map: winTex.night })));
      for (const [w, h, x, y] of [[2.2, .14, 0, 1.17], [2.2, .14, 0, -1.17], [.14, 2.48, -1.03, 0], [.14, 2.48, 1.03, 0], [.08, 2.2, 0, 0]]) box3(M.white, w, h, .1, x, y, .03, w2);
      const curtain = toon(0xF5B8E0); for (const s of [-1, 1]) { const c = box3(curtain, .45, 2.8, .06, 1.7 + s * 1.3, 4.3, -4.4, g); }
      // Cama
      const bedG = grp(-2.5, 0, -2.6, g);
      box3(toon(0xE8DDF8), 2.4, .5, 3.0, 0, .3, 0, bedG, .05); box3(M.white, 2.3, .25, 2.9, 0, .66, 0, bedG);
      box3(toon(0x8E63E6), 2.36, .14, 1.9, 0, .82, .55, bedG); box3(toon(0xB59CF0), 2.36, .05, .25, 0, .9, -.38, bedG);
      box3(toon(0xE8DDF8), 2.6, 1.6, .2, 0, .9, -1.55, bedG, .05);
      for (const x of [-.55, .55]) bedG.add(sph(M.white, .45, .18, .3, x, .95, -1.0, .06, 20));
      const plush = grp(.6, .92, -.6, bedG); const pp = toon(0xFFB6C8), ppD = toon(0xF48FB1);
      plush.add(sph(pp, .24, .26, .21, 0, .25, 0, .06, 24)); plush.add(sph(pp, .2, .19, .19, 0, .6, 0, .06, 24));
      for (const s of [-1, 1]) { const ear = new T.Mesh(new T.ConeGeometry(.08, .13, 4), ppD); ear.position.set(.12 * s, .77, .02); ear.rotation.set(.4, Math.PI / 4, -.4 * s); plush.add(ear);
        plush.add(sph(M.pupil, .025, .03, .02, .07 * s, .65, .175, 0, 10)); plush.add(sph(pp, .07, .07, .07, .1 * s, .03, .12, .05, 14));
        const armP = sph(pp, .06, .12, .06, .14 * s, .28, .14, .05, 14); armP.rotation.z = -.9 * s; plush.add(armP); }
      { const sn = cyl(ppD, .075, .075, .05, 20); sn.rotation.x = Math.PI / 2; sn.position.set(0, .56, .19); plush.add(sn); for (const s of [-1, 1]) plush.add(sph(M.pupil, .012, .018, .01, .025 * s, .56, .218, 0, 8)); }
      { const berry = grp(0, .3, .24, plush); const b1 = new T.Mesh(new T.ConeGeometry(.1, .17, 16), toon(0xE8413F)); b1.rotation.x = Math.PI; berry.add(b1);
        const b1o = new T.Mesh(new T.ConeGeometry(.115, .19, 16), OUT); b1o.rotation.x = Math.PI; b1o.position.y = -.005; berry.add(b1o);
        for (let i = 0; i < 5; i++) { const lf = new T.Mesh(new T.ConeGeometry(.035, .08, 4), toon(0x52AE74)); const a2 = i / 5 * Math.PI * 2; lf.position.set(Math.cos(a2) * .05, .09, Math.sin(a2) * .05); lf.rotation.set(Math.sin(a2) * 1.2, 0, -Math.cos(a2) * 1.2); berry.add(lf); }
        for (let i = 0; i < 6; i++) berry.add(sph(toon(0xFFE36E), .012, .016, .008, Math.cos(i * 1.1) * .055, -.02 - (i % 3) * .03, .07, 0, 8)); }
      // Velador con lámpara
      const ns = grp(-.75, 0, -3.8, g); box3(toon(0xE8DDF8), .7, .8, .6, 0, .4, 0, ns, .04);
      const lampS = cyl(new T.MeshBasicMaterial({ color: 0xFFE9A8 }), .18, .3, .35, 16, true); lampS.position.y = 1.2; ns.add(lampS); const lb = cyl(M.line, .03, .03, .3, 8); lb.position.y = .95; ns.add(lb);
      W.glow = sprite(SPARK, 1.4, .55); W.glow.position.set(-.75, 1.2, -3.6); g.add(W.glow);
      const rugN = new T.Mesh(new T.CircleGeometry(1.4, 40), toon(0xD9C2FA)); rugN.rotation.x = -Math.PI / 2; rugN.position.set(1.4, .012, -.6); g.add(rugN);
      const rugN2 = new T.Mesh(new T.RingGeometry(1.25, 1.4, 40), toon(0x9C82E0)); rugN2.rotation.x = -Math.PI / 2; rugN2.position.set(1.4, .014, -.6); g.add(rugN2);
      g.add(extras.lavanda); extras.lavanda.children.forEach(c => { if (c.position.x > -.2 && c.position.x < 1.4 && c.geometry && c.geometry.type === 'CircleGeometry') c.position.x -= 1.4; });
      SPOTS.lavanda = { seat: { x: -2.2, z: -1.0, y: 1.0, ax: -2.2, az: -.1 }, yoga: { x: 1.4, z: -.6 }, gaze: { x: 1.7, z: -3.0 }, acts: ['sit', 'yoga', 'gaze'] }; }
    // ===== Cielo: playa =====
    { const g = worldOf('cielo');
      const sandTex = texCanvas(256, 256, (x, w, h) => { x.fillStyle = '#E8C487'; x.fillRect(0, 0, w, h); for (let i = 0; i < 700; i++) { x.fillStyle = i % 2 ? 'rgba(190,145,85,.4)' : 'rgba(255,235,195,.55)'; x.fillRect((i * 83) % w, (i * 47) % h, 3, 3); } });
      sandTex.wrapS = sandTex.wrapT = T.RepeatWrapping; sandTex.repeat.set(5, 4);
      ground(g, new T.MeshToonMaterial({ map: sandTex, gradientMap: grad }));
      const seaTex = texCanvas(512, 256, (x, w, h) => { const s2 = x.createLinearGradient(0, 0, 0, h * .55); s2.addColorStop(0, '#6EC1FF'); s2.addColorStop(1, '#D8F0FF'); x.fillStyle = s2; x.fillRect(0, 0, w, h);
        x.fillStyle = '#FFE36E'; x.beginPath(); x.arc(110, 70, 30, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.95)'; [[300, 50, 20], [325, 44, 26], [350, 54, 18]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); });
        const s3 = x.createLinearGradient(0, h * .55, 0, h); s3.addColorStop(0, '#2F8FDB'); s3.addColorStop(1, '#6FD3EC'); x.fillStyle = s3; x.fillRect(0, h * .55, w, h * .45); });
      backdrop(g, seaTex, -7, 24, 10, 3.6);
      const waveTex = texCanvas(256, 32, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h); x.strokeStyle = '#FFFFFF'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i <= w; i += 4) x.lineTo(i, 16 + 7 * Math.sin(i / 16)); x.stroke(); });
      waveTex.wrapS = T.RepeatWrapping; waveTex.repeat.set(6, 1);
      W.waves = new T.Mesh(new T.PlaneGeometry(24, .45), new T.MeshBasicMaterial({ map: waveTex, transparent: true })); W.waves.position.set(0, .2, -5.5); W.waves.rotation.x = -.3; g.add(W.waves);
      // Palmera
      const palm = grp(3.9, 0, -3.6, g); let pp = palm;
      for (let i = 0; i < 7; i++) { const seg = cyl(toon(i % 2 ? 0xB98552 : 0xA87444), .2 - i * .015, .22 - i * .015, .55, 10); seg.position.y = .27; const n2 = grp(0, i ? .5 : 0, 0, pp); n2.rotation.z = .07; n2.add(seg); pp = n2; }
      const crown2 = grp(0, .6, 0, pp); for (let i = 0; i < 7; i++) { const lf = sph(toon(0x52AE74), .22, .07, 1.0, 0, 0, .9, .04, 16); const lg = grp(0, 0, 0, crown2); lg.rotation.set(.45, i / 7 * Math.PI * 2, 0); lg.add(lf); }
      crown2.add(sph(toon(0x8B5A2B), .14, .14, .14, .12, -.1, .1, .1, 10)); crown2.add(sph(toon(0x8B5A2B), .14, .14, .14, -.1, -.12, .05, .1, 10));
      // Quitasol y silla de playa
      const umb = grp(-2.6, 0, -2.6, g); const pole = cyl(M.white, .05, .05, 3.1, 8); pole.position.y = 1.55; umb.add(pole);
      const umbTex = texCanvas(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#FFFFFF' : '#FF6F91'; x.fillRect(i * w / 8, 0, w / 8 + 1, h); } });
      const canopy = new T.Mesh(new T.ConeGeometry(1.6, .7, 16, 1, true), new T.MeshToonMaterial({ map: umbTex, gradientMap: grad, side: T.DoubleSide })); canopy.position.y = 3.15; umb.add(canopy);
      const chair = grp(-2.1, 0, -1.8, g); const frame = toon(0xFFFFFF), cloth = toon(0x5CC3E8);
      box3(cloth, 1.1, .08, .8, 0, .66, 0, chair, .04); const back = box3(cloth, 1.1, .9, .08, 0, 1.05, -.42, chair, .04); back.rotation.x = -.35;
      for (const x of [-.5, .5]) for (const z of [-.35, .35]) box3(frame, .06, .66, .06, x, .33, z, chair);
      // Toalla, pelota y castillo de arena
      const towelTex = texCanvas(64, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = ['#FFD24D', '#FFFFFF', '#FF6F91', '#FFFFFF'][i % 4]; x.fillRect(0, i * h / 8, w, h / 8 + 1); } });
      const towel = new T.Mesh(new T.PlaneGeometry(1.2, 2.4), new T.MeshToonMaterial({ map: towelTex, gradientMap: grad })); towel.rotation.x = -Math.PI / 2; towel.position.set(1.5, .015, -.7); g.add(towel);
      g.add(extras.ball); extras.ball.position.set(1.0, .38, -1.6); W.ballHome = extras.ball.position.clone();
      const castle = grp(2.9, 0, -2.4, g); const sandM = toon(0xE9C78A);
      castle.add(cyl(sandM, .45, .55, .5, 12)); castle.children[0].position.y = .25; for (const [x, z] of [[-.4, .2], [.4, .2], [0, -.35]]) { const t2 = cyl(sandM, .16, .18, .7, 10); t2.position.set(x, .35, z); castle.add(t2); const c2 = new T.Mesh(new T.ConeGeometry(.2, .3, 10), toon(0xFF6F91)); c2.position.set(x, .85, z); castle.add(c2); }
      for (let i = 0; i < 4; i++) g.add(sph(toon([0xFFB3CF, 0xFFFFFF, 0xFFD9A8][i % 3]), .09, .05, .09, -1 + i * 1.2, .03, .9 - (i % 2) * .5, .1, 10));
      W.gulls = [0, 1].map(i => { const b = sprite(textTex('〰', '#5B5866', 'bold 80px sans-serif'), .5); b.position.set(-1 + i * 2, 5.4 + i * .4, -5); g.add(b); return b; });
      SPOTS.cielo = { seat: { x: -2.1, z: -1.75, y: .78, ax: -2.1, az: -.75 }, ball: { x: 1.0, z: -1.6 }, yoga: { x: 1.5, z: -.7 }, acts: ['sit', 'ball', 'yoga'] }; }
    // ===== Dorado: gimnasio de campeona =====
    { const g = worldOf('dorado');
      const tileTex = texCanvas(256, 256, (x, w, h) => { x.fillStyle = '#3A3346'; x.fillRect(0, 0, w, h); x.strokeStyle = '#2A2434'; x.lineWidth = 4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.stroke(); x.beginPath(); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); } });
      tileTex.wrapS = tileTex.wrapT = T.RepeatWrapping; tileTex.repeat.set(4, 3);
      ground(g, new T.MeshToonMaterial({ map: tileTex, gradientMap: grad }));
      const wl = new T.Mesh(new T.PlaneGeometry(16, 9), new T.MeshBasicMaterial({ color: 0xF2DDA4 })); wl.position.set(0, 4.5, -4.6); g.add(wl);
      box3(new T.MeshBasicMaterial({ color: 0x3F2E5C }), 16, 1.2, .05, 0, .6, -4.57, g);
      box3(new T.MeshBasicMaterial({ color: 0xE8B83A }), 16, .12, .06, 0, 1.24, -4.55, g);
      const mirror = grp(-1.9, 3.6, -4.53, g); mirror.add(new T.Mesh(new T.PlaneGeometry(2.6, 2.6), new T.MeshBasicMaterial({ color: 0xD8E4EE })));
      [[-.6, .3], [.3, .5]].forEach(([x, r]) => { const sh = new T.Mesh(new T.PlaneGeometry(.16, 2.2), new T.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: .7 })); sh.position.set(x, 0, .01); sh.rotation.z = r; mirror.add(sh); });
      box3(M.gold, 2.8, 2.8, .05, 0, 0, -.03, mirror);
      const banner = texCanvas(512, 128, (x, w, h) => { x.fillStyle = '#3F2E5C'; x.fillRect(0, 0, w, h); x.fillStyle = '#F2C94C'; x.font = 'bold 66px Georgia, serif'; x.textAlign = 'center'; x.fillText('★ CAMPEONA ★', w / 2, 86); });
      const bn = new T.Mesh(new T.PlaneGeometry(3.2, .8), new T.MeshBasicMaterial({ map: banner })); bn.position.set(2.0, 5.6, -4.5); g.add(bn);
      g.add(extras.dorado); extras.dorado.position.set(5.6, -0.2, 0);
      // Banca de pesas
      const wb = grp(-2.2, 0, -1.8, g); const pad = toon(0xE8417F), metal = toon(0x8E8E9A);
      box3(pad, .6, .2, 1.9, 0, .82, 0, wb, .05); for (const z of [-.75, .75]) { box3(metal, .1, .72, .1, 0, .36, z, wb); box3(metal, .7, .08, .1, 0, .04, z, wb); }
      // Rack de mancuernas doradas
      const rk = grp(-.5, 0, -3.0, g); box3(metal, 2.0, .1, .6, 0, .6, 0, rk); box3(metal, 2.0, .1, .6, 0, .2, 0, rk); for (const x of [-.95, .95]) box3(metal, .08, .65, .55, x, .32, 0, rk);
      const pair2 = grp(0, .78, 0, rk);
      for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const b = bellG.clone(); b.visible = true; b.position.set(-.55 + i * .55 + s * .12, 0, 0); b.rotation.y = Math.PI / 2; b.scale.setScalar(.75); b.traverse(o => { if (o.material === M.top) o.material = M.gold; }); (i === 1 ? pair2 : rk).add(b); if (i !== 1) b.position.y = .78; }
      // Trotadora
      const tm = grp(1.5, 0, -.8, g); tm.rotation.y = -Math.PI / 2; const beltTex = texCanvas(64, 256, (x, w, h) => { x.fillStyle = '#2A2434'; x.fillRect(0, 0, w, h); x.fillStyle = '#4A4256'; for (let i = 0; i < 8; i++) x.fillRect(0, i * 32, w, 6); });
      beltTex.wrapS = beltTex.wrapT = T.RepeatWrapping; beltTex.repeat.set(1, 3);
      box3(metal, 1.3, .22, 2.6, 0, .11, 0, tm, .04);
      const belt = new T.Mesh(new T.PlaneGeometry(1.0, 2.5), new T.MeshBasicMaterial({ map: beltTex })); belt.rotation.x = -Math.PI / 2; belt.position.y = .23; tm.add(belt); W.belt = beltTex;
      for (const s of [-1, 1]) { const up = box3(metal, .08, 1.5, .08, .6 * s, .9, -1.15, tm); }
      box3(toon(0x3F2E5C), 1.3, .45, .12, 0, 1.7, -1.15, tm, .04); box3(new T.MeshBasicMaterial({ color: 0x6EC3F5 }), .6, .22, .02, 0, 1.75, -1.08, tm);
      box3(metal, 1.3, .08, .08, 0, 1.45, -1.05, tm);
      SPOTS.dorado = { seat: { x: -2.2, z: -1.8, y: .98, ax: -2.2, az: -.6 }, bells: { x: -.5, z: -3.0, pair: pair2 }, tread: { x: 1.5, z: -.8, y: .24, hx: 1.3, hz: .62 }, acts: ['sit', 'bells', 'tread'] }; }
    for (const k of ['menta', 'cielo']) if (extras[k].parent === room) room.remove(extras[k]);
    if (extras.menta.parent === room) room.remove(extras.menta);
    room.remove(extras.cielo);
    let themeKey = '', SP = SPOTS.rosa;
    const LIGHT = { rosa: [.52, .62, 0xFFFFFF], menta: [.5, .6, 0xF2FFF2], lavanda: [.42, .4, 0xD9C9FF], cielo: [.5, .6, 0xFFFBEF], dorado: [.5, .62, 0xFFF3DC] };
    function applyTheme(k) {
      if (!W[k]) k = 'rosa';
      const first = !themeKey; themeKey = k; SP = SPOTS[k];
      for (const key of ['rosa', 'menta', 'lavanda', 'cielo', 'dorado']) W[key].visible = key === k;
      hemi.intensity = LIGHT[k][0]; sun.intensity = LIGHT[k][1]; hemi.color.setHex(LIGHT[k][2]);
      if (!first) { act = null; st.sitT = 0; st.sitAmt = 0; st.carry = false; st.tread = false; st.rope = false; st.walking = false; st.px = -.1; st.pz = .3; st.fyT = 0; st.nextAct = now + 2; }
    }
    const H0 = () => [['walk', -.1, .3], ['face', 0]];
    const ACTS = {
      sit: () => [['walk', SP.seat.ax, SP.seat.az], ['face', 0], ['sit', 1], ['pose', moodNow() === 'sleepy' ? 'sitnod' : 'relax', rnd(5, 8)], ['sit', 0], ...H0()],
      bells: () => [['walk', SP.bells.x, SP.bells.z + .85], ['face', 180], ['pose', 'pickup', 1.1], ['carry', true], ['pose', 'walkpose', .4], ['face', 0], ['pose', 'curl2', rnd(3.5, 5)], ['pose', 'press2', rnd(3, 4)], ['face', 180], ['pose', 'pickup', 1.1], ['carry', false], ...H0()],
      yoga: () => [['walk', SP.yoga.x, SP.yoga.z], ['face', 0], ['pose', 'tree', 3], ['pose', 'stretch', 3], ['pose', Math.random() < .5 ? 'jacks' : 'squat', 3.2], ...H0()],
      gaze: () => [['walk', SP.gaze.x, SP.gaze.z], ['face', 180], ['pose', 'gaze', 4], ['face', 0], ['pose', 'wave', 1.8], ...H0()],
      flowers: () => [['walk', SP.flowers.x, SP.flowers.z + .95], ['face', 180], ['pose', 'pickup', 1.0], ['fx', 'flowers'], ['pose', 'smell', 2.4], ['face', 0], ['pose', 'cheer', 1.6], ...H0()],
      rope: () => [['walk', SP.rope.x, SP.rope.z], ['face', 0], ['rope', true], ['pose', 'rope', rnd(4.5, 6)], ['rope', false], ['pose', 'flex', 1.4], ...H0()],
      ball: () => [['walk', SP.ball.x - .75, SP.ball.z + .2], ['face', 90], ['pose', 'kickball', .9], ['ball', 1], ['face', 0], ['pose', 'cheer', 2.2], ...H0()],
      tread: () => [['walk', SP.tread.x - 2.1, SP.tread.z + .05], ['walk', SP.tread.x - .25, SP.tread.z], ['face', 90], ['tread', true], ['pose', 'walkpose', rnd(5, 7)], ['tread', false], ['walk', SP.tread.x - 2.1, SP.tread.z + .05], ...H0()]
    };
    function chooseAct() {
      const m = moodNow();
      const pref = { normal: {}, train: { bells: 3, yoga: 2, rope: 3, tread: 3 }, joy: { yoga: 2, ball: 3, rope: 2, flowers: 2 }, sleepy: { sit: 4, gaze: 2 }, thirsty: { sit: 4 }, hungry: { sit: 3 } }[m] || {};
      const pool = []; for (const a of SP.acts) { const n = pref[a] != null ? pref[a] : (Object.keys(pref).length ? 0 : 1); for (let i = 0; i < Math.max(n, a === 'sit' ? 1 : 0); i++) pool.push(a); }
      const k = pool[Math.floor(Math.random() * pool.length)] || 'sit';
      return { steps: ACTS[k](), i: 0, t0: now, started: false };
    }
    function runAct(dt) {
      if (!act) { if (!forced && now - st.lastTouch > 5 && now > st.nextAct) act = chooseAct(); return; }
      if (forced) { st.walking = false; act.t0 += dt; return; }
      const sp = act.steps[act.i];
      if (!sp) { act = null; st.nextAct = now + rnd(5, 10); pickNext(); return; }
      const next = () => { act.i++; act.t0 = now; act.started = false; };
      if (sp[0] === 'walk') {
        const dx = sp[1] - st.px, dz = sp[2] - st.pz, d = Math.hypot(dx, dz);
        if (!act.started) { act.started = true; setPose(POSES.walkpose, 'walkpose', 99); }
        if (d < .04) { st.walking = false; next(); return; }
        st.walking = true; st.fyT = Math.atan2(dx, dz);
        const turn = Math.abs(((st.fyT - st.fy + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        const spd = turn > .6 ? .25 : 1.35, stepLen = Math.min(d, spd * dt);
        st.px += dx / d * stepLen; st.pz += dz / d * stepLen;
      } else if (sp[0] === 'face') { st.fyT = sp[1] * R; if (Math.abs(((st.fyT - st.fy + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < .05 || now - act.t0 > 1.5) next(); }
      else if (sp[0] === 'sit') { st.sitT = sp[1]; if (!act.started) { act.started = true; setPose(POSES.relax, 'relax', 99); } if (now - act.t0 > .9) next(); }
      else if (sp[0] === 'pose') { if (!act.started) { act.started = true; setPose(POSES[sp[1]], sp[1], 99); } if (now - act.t0 > sp[2]) next(); }
      else if (sp[0] === 'carry') { st.carry = sp[1]; next(); }
      else if (sp[0] === 'tread') { st.tread = sp[1]; next(); }
      else if (sp[0] === 'rope') { st.rope = sp[1]; next(); }
      else if (sp[0] === 'ball') { st.ballT = now; next(); }
      else if (sp[0] === 'fx') { const pos = new T.Vector3(SP.flowers.x, 1.0, SP.flowers.z + .2); for (let i = 0; i < 7; i++) { const spk = sprite(emojiTex(i % 2 ? '💗' : '✨', 64), .3, 0); spk.position.set(pos.x + rnd(-.6, .6), pos.y + rnd(0, .5), pos.z); W[themeKey].add(spk); sparks.push({ sp: spk, t0: now + i * .15, size: .25 + Math.random() * .15 }); } next(); }
    }
    box.addEventListener('pointerdown', () => { st.lastTouch = now; });
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const THIGH = .5, SHIN = .5, FOOT = .21;

    // Arrastrar para girarla; un toque corto sigue contando como "tocarla"
    let downX = 0, downY = 0;
    canvas.addEventListener('pointerdown', e => { st.dragging = true; downX = e.clientX; downY = e.clientY; st.dragX = e.clientX; box.dataset.dragged = ''; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
    canvas.addEventListener('pointermove', e => { if (!st.dragging) return; const dx = e.clientX - st.dragX; st.dragX = e.clientX; st.userYawV = dx * .012 / .016; st.userYaw += dx * .012; if (ab(e.clientX - downX) + ab(e.clientY - downY) > 8) box.dataset.dragged = '1'; st.lastDrag = now; });
    const up = () => { st.dragging = false; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.style.touchAction = 'pan-y';

    function resize() {
      const w = box.clientWidth || 300, h = Math.round(w * 1.05);
      renderer.setSize(w, h, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize(); window.addEventListener('resize', resize);

    // Volúmenes de choque (en coordenadas del torso): cuerpo, top, calzas y cabeza
    const HIT = [[0, .66, 0, .5, .78, .42], [0, 1.06, 0, .52, .33, .44], [0, .1, 0, .5, .26, .42], [0, 2.22, 0, 1.12, .95, .96]];
    const _v = new T.Vector3();
    function limbHits(obj, pad) {
      obj.getWorldPosition(_v); torso.worldToLocal(_v);
      for (const h of HIT) { const dx = (_v.x - h[0]) / (h[3] + pad), dy = (_v.y - h[1]) / (h[4] + pad), dz = (_v.z - h[2]) / (h[5] + pad); if (dx * dx + dy * dy + dz * dz < 1) return true; }
      return false;
    }
    function setVis(o, v) { o.visible = v; }
    function step(ts) {
      requestAnimationFrame(step);
      const t = ts / 1000, dt = Math.min(.05, last ? t - last : .016); last = t;
      if (document.hidden || !box.isConnected || !box.offsetWidth) return;
      if (canvas.width < 4) resize();
      now += dt;
      const r = reactionNow();
      if (r && forced !== r) { forced = r; setPose(POSES[r], r, 99); }
      else if (!r && forced) { forced = null; if (act) act.started = false; else pickNext(); }
      else if (!r && !act && now - tPose > hold && !reduce) pickNext();
      if (r) st.lastTouch = now;
      if (!reduce) runAct(dt);
      const tt = now - tPose, k = reduce ? 1 : ease(Math.min(1, tt / trans));
      const mo = reduce ? {} : (cur.m ? cur.m(tt) : {});
      for (const key of KEYS) { const target = (key in cur.base ? cur.base[key] : REST[key]) + (mo[key] || 0); vals[key] = from[key] + (target - from[key]) * k; }
      const v = vals, mood = moodNow(), cls = state.classList;
      // Pies en el suelo
      // Caminar y sentarse (se mezclan suave)
      st.walkAmt += ((st.walking || st.tread ? 1 : 0) - st.walkAmt) * Math.min(1, dt * 8);
      st.sitAmt += ((st.sitT || 0) - st.sitAmt) * Math.min(1, dt * 3.5);
      if (st.walkAmt > .01) st.ph += dt * 9 * Math.max(.3, st.walkAmt);
      const wa = st.walkAmt, sa = st.sitAmt, ph = st.ph;
      // Hacia el puff: al sentarse se desliza hasta el asiento
      const seatX = SP.seat.x, seatZ = SP.seat.z;
      root.position.set(st.px + (seatX - st.px) * sa, 0, st.pz + (seatZ - st.pz) * sa);
      const dyaw = ((st.fyT - st.fy + Math.PI * 3) % (Math.PI * 2)) - Math.PI; st.fy += dyaw * Math.min(1, dt * 6);
      // Giro: el de la pose + el que le das con el dedo (vuelve solo de a poco)
      if (!st.dragging) { st.userYaw += st.userYawV * dt; st.userYawV *= Math.pow(.04, dt); if (now - st.lastDrag > 2.5) st.userYaw *= Math.pow(.25, dt); }
      yawG.rotation.y = forceYaw != null ? forceYaw : st.fy + v.yaw * R * (1 - wa) * (1 - sa) + st.userYaw;
      const breath = 1 + (mood === 'thirsty' ? .025 : .014) * S(now * (mood === 'thirsty' ? 5 : 2.2));
      torso.rotation.z = -v.lean * R; chest.scale.set(2 - breath, breath, 2 - breath);
      headP.rotation.z = -v.head * R; headP.rotation.x = v.nod * R;
      const swing = 24 * S(ph) * wa;
      arms[-1].sh.rotation.set((v.fwdL + swing) * R, 0, -v.aL * R); arms[-1].elb.rotation.set(v.bfL * R, 0, -v.eL * R);
      arms[1].sh.rotation.set((v.fwdR - swing) * R, 0, v.aR * R); arms[1].elb.rotation.set(v.bfR * R, 0, v.eR * R);
      const legW = 1 - sa;
      const fhL = (v.fhL - 26 * S(ph) * wa) * legW - 88 * sa, fhR = (v.fhR + 26 * S(ph) * wa) * legW - 88 * sa;
      const fkL = (v.fkL + 34 * Math.max(0, S(ph + 1.3)) * wa) * legW + 84 * sa, fkR = (v.fkR + 34 * Math.max(0, S(ph + 1.3 + Math.PI)) * wa) * legW + 84 * sa;
      legs[-1].hip.rotation.set(fhL * R, 0, -v.hL * legW * R); legs[-1].knee.rotation.set(fkL * R, 0, -v.kL * legW * R);
      legs[1].hip.rotation.set(fhR * R, 0, v.hR * legW * R); legs[1].knee.rotation.set(fkR * R, 0, v.kR * legW * R);
      torso.rotation.x = -.1 * sa;
      // Pies en el suelo (cinemática real) o sentada en el puff
      pelvis.position.y = 1.2; root.updateMatrixWorld(true);
      const _p = new T.Vector3();
      const footMin = Math.min(legs[-1].soleB.getWorldPosition(_p).y, legs[1].soleB.getWorldPosition(_p).y);
      const bob = 3.5 * (.5 - .5 * Math.cos(2 * ph)) * wa * .01 * (st.tread ? .55 : 1);
      const baseY = 1.2 - footMin + .01 + bob;
      st.sy = st.sy == null ? baseY : st.sy + (baseY - st.sy) * Math.min(1, dt * (st.tread ? 9 : 16));
      const standY = st.sy + Math.max(0, v.hop) * .012;
      const onTm = SP.tread && Math.abs(st.px - SP.tread.x) < SP.tread.hx && Math.abs(st.pz - SP.tread.z) < SP.tread.hz;
      st.plat = (st.plat || 0) + ((onTm ? SP.tread.y : 0) - (st.plat || 0)) * Math.min(1, dt * 10);
      pelvis.position.y = (standY + st.plat) * (1 - sa) + SP.seat.y * sa;
      // Evitar que brazos atraviesen cuerpo o cabeza: se empuja el brazo hacia adelante hasta quedar fuera
      torso.updateMatrixWorld(true);
      for (const s2 of [-1, 1]) {
        const a = arms[s2];
        for (let it = 0; it < 14; it++) {
          a.sh.updateMatrixWorld(true);
          if (!limbHits(a.paw, .17) && !limbHits(a.elbPt, .13)) break;
          a.sh.rotation.x -= .07;
        }
      }
      // Secundario
      const hv = (v.head + v.lean - st.prevHead) / dt; st.prevHead = v.head + v.lean;
      const hopA = (v.hop - st.prevHop) / dt; st.prevHop = v.hop;
      if (now > st.twitchAt) { st.earLv += rnd(-260, 260); st.earRv += rnd(-260, 260); st.twitchAt = now + rnd(2.5, 6); }
      [st.earL, st.earLv] = spring(st.earL, st.earLv, v.ears, 120, 9, dt, -hv * 2);
      [st.earR, st.earRv] = spring(st.earR, st.earRv, v.ears, 120, 9, dt, hv * 2);
      if (curEars) { const ce = curEars; ce.L.rotation.z = ce.b - st.earL * R * ce.k; ce.R.rotation.z = -ce.b + st.earR * R * ce.k; ce.L.rotation.x = ce.R.rotation.x = Math.min(0, v.ears) * -.012 * ce.k; }
      const pk = state.dataset.pet || 'gata'; if (pk !== petKey) applySpecies(pk);
      if (SPX.hen.visible) { const hideComb = ['cap', 'crown', 'phones'].includes(state.dataset.head); SPX.henComb.forEach(c => c.visible = !hideComb); }
      [st.medal, st.medalV] = spring(st.medal, st.medalV, v.lean, 40, 3, dt, hv * 1.5 - hopA * .6);
      neck.medal.rotation.z = Math.max(-40, Math.min(40, st.medal)) * R; neck.medal.rotation.x = -.08 + .05 * S(now * 2);
      [st.scarf, st.scarfV] = spring(st.scarf, st.scarfV, v.lean * .6 + 6 * S(now * 3), 60, 4, dt, hv * 2);
      neck.scarfTail.rotation.z = st.scarf * R; neck.scarfTail.rotation.x = -.2 + .12 * S(now * 3.3);
      neck.gemStone.rotation.y = now * 1.6;
      [st.bow, st.bowV] = spring(st.bow, st.bowV, 0, 90, 5, dt, -hv * 3 + hopA * 1.5);
      H.bow.rotation.z = -.3 + st.bow * R; H.bow.scale.setScalar(1 + .05 * S(now * 4));
      H.petals.rotation.z = now * .7; H.starMesh.rotation.y = now * 1.8; H.crown.rotation.y = .1 * S(now * 1.2);
      // Cola
      tailSegs.forEach((g, i) => { g.rotation.x = (i ? .17 : -1.3) + (i ? .05 * S(now * 1.3 - i * .4) : 0); g.rotation.z = (v.tailAmp * R) * S(now * v.tailSpd * (curSp.wag || 1) - i * .55) * (.35 + i / 9); });
      updateTail();
      tailX.pig.rotation.y = .3 * S(now * 6); tailX.bunny.position.y = .32 + .02 * S(now * 5); tailX.hen.rotation.x = .1 * S(now * 3);
      // Ojos: parpadeo, guiño, cansancio, felicidad
      if (now > st.blinkAt) { st.blinkT = now; st.blinkAt = now + rnd(2, 5.5); if ((mood === 'normal' || mood === 'joy') && Math.random() < .12) { st.winkUntil = now + .7; } }
      const bt = (now - st.blinkT) / .16, blink = bt >= 0 && bt < 1 ? S(bt * Math.PI) : 0;
      const happy = cls.contains('happy') || cls.contains('drinking') || cls.contains('eating');
      const tired = (mood === 'thirsty' || mood === 'sleepy') && !happy;
      const baseLid = tired ? (mood === 'sleepy' ? .85 : .55) : 0;
      for (const s of [-1, 1]) {
        const e = eyes[s];
        const wink = s === 1 && st.winkUntil > now;
        const lid = Math.max(baseLid, blink, wink ? 1 : 0);
        e.lidG.rotation.x = -1.65 + lid * 3.05;
        e.eg.visible = !happy; e.happy.visible = happy;
      }
      if (now > st.lookAt) { st.lookTX = rnd(-1, 1); st.lookTY = rnd(-.7, .7); st.lookAt = now + rnd(1.2, 3.4); }
      const lx = v.look || st.lookTX, ly = v.lookY || (mood === 'hungry' ? -.8 : st.lookTY);
      st.lookX += (lx - st.lookX) * Math.min(1, dt * 10); st.lookY += (ly - st.lookY) * Math.min(1, dt * 10);
      for (const s of [-1, 1]) eyes[s].iris.position.set(st.lookX * .06, st.lookY * .06, .1);
      // Boca
      const admire = cls.contains('admire'), eating = cls.contains('eating');
      const open = happy || admire;
      smile.visible = !open && mood !== 'thirsty';
      mouthOpen.visible = open || (mood === 'sleepy' && (now % 6) > 4);
      mouthOpen.scale.set(.12, (eating ? .05 + .06 * ab(S(now * 10)) : mood === 'sleepy' && !open ? .16 : .1), .05);
      tongue.visible = (mood === 'thirsty' || mood === 'hungry') && !happy;
      if (curSp.face === 'hen') { smile.visible = false; mouthOpen.visible = false; tongue.visible = false; }
      tongue.scale.y = mood === 'thirsty' ? .12 + .025 * S(now * 12) : .07;
      tongue.position.x = mood === 'hungry' ? .05 * S(now * 4) : 0;
      blushL.material.opacity = admire || mood === 'joy' ? .85 : .55;
      // Accesorios visibles según lo que tenga puesto
      const hd = state.dataset.head || '', nk = state.dataset.neck || '';
      for (const kk of ['bow', 'flower', 'cap', 'glasses', 'phones', 'crown', 'star']) setVis(H[kk], hd === kk);
      setVis(band, hd !== 'cap');
      for (const kk of ['medal', 'scarf', 'gem']) setVis(neck[kk], nk === kk);
      const ch = state.dataset.hold === '1' ? (state.querySelector('.held') || {}).textContent || '' : '';
      if (ch !== heldChar) { heldChar = ch; if (ch) { heldSprite.material.map = emojiTex(ch); heldSprite.material.needsUpdate = true; } }
      const busy = cls.contains('drinking') || eating;
      setVis(heldSprite, !!ch && !busy && !st.carry); setVis(bellG, (state.dataset.bell === '1' || st.carry) && !busy);
      heldSprite.material.rotation = .12 * S(now * 3);
      setVis(glass, cls.contains('drinking')); if (glass.visible) { const g = Math.max(.08, 1 - Math.max(0, tt - .4) / 1.9); glass.water.scale.y = g; glass.water.position.y = -.17 + .13 * g; }
      setVis(egg, eating); if (eating) { const k2 = Math.max(.05, 1 - Math.floor(Math.max(0, tt - .2) / .45) * .25); egg.scale.set(.13 * k2, .17 * k2, .13 * k2); }
      // Efectos
      setVis(sweat, mood === 'thirsty' && !happy); if (sweat.visible) { const d = (now % 1.8) / 1.8; sweat.position.y = .45 - d * .45; sweat.scale.setScalar(d < .15 ? d / .15 : 1); }
      zzz.forEach((z, i) => { const on = mood === 'sleepy' && !happy, d = ((now + i * .6) % 3) / 3; z.material.opacity = on ? Math.sin(d * Math.PI) : 0; z.position.y = .7 + i * .35 + d * .3; });
      notes.forEach((n, i) => { const on = hd === 'phones', d = ((now + i * .8) % 2.4) / 2.4; n.material.opacity = on ? Math.sin(d * Math.PI) * .9 : 0; n.position.y = .3 + i * .2 + d * .6; });
      // Sombra
      const shs = Math.max(.55, 1 - v.hop / 40); shadow.scale.set(shs, shs, 1); shadow.material.opacity = shs * (1 - sa);
      // Pesas: en el piso o en sus manos
      if (SP.bells) SP.bells.pair.visible = !st.carry; setVis(bellL, st.carry);
      const bgk = state.dataset.bg || 'rosa'; if (bgk !== themeKey) applyTheme(bgk);
      if (themeKey === 'lavanda') { extras.lights.forEach((b, i) => b.scale.setScalar(.08 + .035 * (.5 + .5 * S(now * 3 + i * 1.3)))); W.glow.material.opacity = .45 + .1 * S(now * 2); }
      if (themeKey === 'dorado') { extras.goldStar.rotation.y = now * 1.2; if (st.tread) W.belt.offset.y += dt * 1.6; }
      if (themeKey === 'menta') W.butterflies.forEach((b, i) => { b.position.set(S(now * .5 + i * 3) * 2.6, 2.4 + .6 * S(now * 1.3 + i), -2.2 + C(now * .4 + i) * 1.2); b.scale.set(.45 * (.6 + .4 * ab(S(now * 12 + i))), .45, 1); });
      if (themeKey === 'cielo') {
        W.waves.material.map.offset.x = now * .05; W.waves.position.z = -5.5 + .15 * S(now * 1.2);
        W.gulls.forEach((b, i) => { b.position.x = ((now * .4 + i * 4) % 10) - 5; b.position.y = 5.4 + i * .4 + .2 * S(now * 2 + i); });
        const bt2 = st.ballT != null ? now - st.ballT : 99, ball = extras.ball, h0 = W.ballHome;
        if (bt2 < 3.2) { const k3 = bt2 / 3.2, out = Math.sin(k3 * Math.PI); ball.position.set(h0.x + out * 2.4, .38 + Math.abs(S(bt2 * 7)) * .9 * (1 - k3), h0.z + out * .6); ball.rotation.z = -bt2 * 8 * (k3 < .5 ? 1 : -1); }
        else { ball.position.copy(h0); ball.rotation.y = now * .4; }
      }
      // Cuerda para saltar
      rope.visible = !!st.rope; if (st.rope) rope.rotation.x = -(now - tPose) * 6;
      // Brillitos
      for (let i = sparks.length - 1; i >= 0; i--) { const s = sparks[i], a = (now - s.t0) / 1.3; if (a < 0) { s.sp.material.opacity = 0; continue; } if (a > 1) { s.sp.parent.remove(s.sp); sparks.splice(i, 1); continue; } s.sp.material.opacity = Math.sin(a * Math.PI) * .95; const sc = s.size * (.4 + .6 * Math.sin(a * Math.PI)); s.sp.scale.set(sc, sc, 1); s.sp.material.rotation = a * 1.5; }
      renderer.render(scene, camera);
    }
    const sparks = [];
    function admireFx(slot) {
      const hd = state.dataset.head, nk = state.dataset.neck;
      let parent, c, spread;
      if (slot === 'head') { parent = head; const o = { bow: [.5, .7, .5], flower: [-.52, .68, .5], cap: [0, .9, .5], glasses: [0, 0, 1.05], phones: [0, 1.1, .2], crown: [0, 1.0, .4], star: [.68, .4, .65] }[hd] || [0, .8, .5]; c = o; spread = .35; }
      else if (slot === 'neck') { parent = torso; c = nk === 'medal' ? [0, .82, .5] : nk === 'scarf' ? [0, 1.3, .45] : [0, 1.02, .5]; spread = .28; }
      else if (slot === 'hand') { parent = arms[1].paw; c = [0, 0, .2]; spread = .3; }
      else { parent = root; c = [0, 2.2, .8]; spread = 1.7; }
      for (let i = 0; i < 6; i++) {
        const sp = sprite(SPARK, .2, 0); const a = Math.random() * Math.PI * 2, rr = spread * (.45 + Math.random() * .55);
        sp.position.set(c[0] + Math.cos(a) * rr, c[1] + Math.sin(a) * rr * (slot === 'bg' ? 1.2 : .8), c[2] + .05);
        parent.add(sp); sparks.push({ sp, t0: now + .15 + i * .14 + Math.random() * .1, size: .16 + Math.random() * .12 });
      }
    }
    // Miniaturas reales de cada mundo (para los botones de "Fondo")
    function worldThumbs(size) {
      const out = {}, prevW = canvas.width, prevH = canvas.height, prevK = themeKey;
      const vis = root.visible; root.visible = false;
      renderer.setSize(size, size, false); camera.aspect = 1; camera.updateProjectionMatrix();
      for (const k of ['rosa', 'menta', 'lavanda', 'cielo', 'dorado']) {
        for (const key of ['rosa', 'menta', 'lavanda', 'cielo', 'dorado']) W[key].visible = key === k;
        hemi.intensity = LIGHT[k][0]; sun.intensity = LIGHT[k][1]; hemi.color.setHex(LIGHT[k][2]);
        renderer.render(scene, camera); out[k] = canvas.toDataURL('image/jpeg', .82);
      }
      root.visible = vis; themeKey = ''; applyTheme(prevK || 'rosa');
      resize(); return out;
    }
    requestAnimationFrame(step);
    return { view: d => { forceYaw = d == null ? null : d * R; }, thumbs: worldThumbs, pose: n => POSES[n] && setPose(POSES[n], n), poses: () => Object.keys(POSES), admire: admireFx, is3d: true, act: k => { act = { steps: ACTS[k](), i: 0, t0: now, started: false }; }, world: k => applyTheme(k) };
  }

    const catBox = $('mascot'), catSvg = catBox.querySelector('.cat'), say = $('mascotSay');
    let kitty = null;
    const worldThumbs = {};
    try { kitty = createKitty3D(catSvg, catBox); } catch (e) { kitty = null; }
    if (kitty) catBox.classList.add('is3d'); else kitty = createKitty(catSvg);
    if (kitty && kitty.thumbs) setTimeout(() => { try { Object.assign(worldThumbs, kitty.thumbs(128)); renderRewards(); } catch (e) {} }, 600);
    const TAPS = [['¡Purr, purr! 💕', ['💖', '💕', '💗']], ['¡Miau! ¿Entrenamos? 💪', ['💪', '✨']], ['Jiji, me haces cosquillas. 😆', ['😆', '💕']], ['¡Mira mis músculos! 🏋️', ['💪', '⭐', '💪']], ['¡Te quiero mucho! 🐾', ['🐾', '💖', '🐾']]];
    let tapN = 0, reactT, reacting = false;
    function catReact(kind, text, fx) {
      clearTimeout(reactT); reacting = true;
      catSvg.classList.remove('boing', 'dress', 'admire', 'flex', 'happy', 'drinking', 'eating'); void catSvg.getBBox();
      catSvg.classList.add(kind); if (kind !== 'admire') catSvg.classList.add('happy');
      say.textContent = petText(text); say.classList.remove('talk'); void say.offsetWidth; say.classList.add('talk');
      // Los efectos se reparten por todo el recuadro de la gatita (no salen de él)
      const stage = $('mascotStage');
      const list = fx && fx.length ? Array.from({ length: 12 }, (_, i) => fx[i % fx.length]) : [];
      list.forEach((e, i) => {
        const f = document.createElement('span');
        f.className = 'float-fx'; f.textContent = e;
        f.style.left = (4 + Math.random() * 88) + '%';
        f.style.top = (12 + Math.random() * 78) + '%';
        f.style.fontSize = (1.1 + Math.random() * .9).toFixed(2) + 'rem';
        f.style.setProperty('--dx', Math.round(Math.random() * 80 - 40) + 'px');
        f.style.setProperty('--dy', -Math.round(40 + Math.random() * 70) + 'px');
        f.style.setProperty('--rot', Math.round(Math.random() * 60 - 30) + 'deg');
        f.style.animationDelay = (Math.random() * .6).toFixed(2) + 's';
        stage.appendChild(f); setTimeout(() => f.remove(), 2400);
      });
      reactT = setTimeout(() => { catSvg.classList.remove('boing', 'dress', 'admire', 'flex', 'happy', 'drinking', 'eating'); reacting = false; updateMood(); }, 2600);
    }
    function tap() {
      if (catBox.dataset.dragged === '1') { catBox.dataset.dragged = ''; return; }
      const t = TAPS[tapN++ % TAPS.length];
      catReact(t[0].includes('músculos') || t[0].includes('Entrenamos') ? 'flex' : 'boing', t[0], t[1]);
    }
    catBox.addEventListener('click', tap);
    catBox.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); tap(); } });
    // De vez en cuando sonríe sola
    // ---------- Estado de ánimo según tus hábitos y tu día ----------
    const habitsToday = () => { const h = store.get('habits'); return h && h.date === today ? h.done || {} : {}; };
    let mood = 'normal';
    function computeMood() {
      const h = habitsToday(), hr = new Date().getHours();
      const ti = todayIdx(), trainPending = ti >= 0 && !(start && notYet()) && !sessOf(log[today]);
      const lowDay = (store.get('feel') || {})[today] === 'baja';
      if (!h.agua) return ['thirsty', lowDay ? 'Hoy vamos suave, ¿ya? 💗 ¿Tomamos agua juntas? Ayuda a sentirse mejor, sobre todo con cólicos.' : 'Tengo sed… 🥵 ¿Tomamos agua juntas? Yo no puedo sola, no tengo pulgares.', '💧 Ya tomé agua'];
      if (!h.sueno && hr < 12) return ['sleepy', 'Uaaah… 😴 ¿Dormiste tus 7 u 8 horas anoche?', '🌙 Sí, dormí bien'];
      if (!h.proteina && hr >= 12) return ['hungry', 'Mi guatita está sonando… 🥚 ¿Comiste tu proteína hoy?', '🥚 Ya comí proteína'];
      const feelT = (store.get('feel') || {})[today];
      if (feelT === 'baja') return ['normal', 'Hoy vamos suave, ¿ya? 💗 Una caminata tranquila o estirar puede ayudar. Y si necesitas descansar, también está bien.', ''];
      if (trainPending) return ['train', '¡Hoy toca entrenar! Ya estoy lista. 💪', '🏋️ Ir a mi rutina'];
      if (hr >= 22) return ['sleepy', 'Ya es tarde… A dormir, que tus músculos crecen mientras descansas. 🌙', ''];
      if (h.agua && h.sueno && h.proteina) return ['joy', '¡Hoy cumpliste todo! Estoy bailando de orgullo. 💖', ''];
      const pw2 = typeof pregWeekNow === 'function' ? pregWeekNow() : 0;
      if (pw2) return ['normal', `Semana ${pw2} 🤰 ¡Qué emoción! Recuerda tomar agua, comer rico y descansar. Yo te cuido. 💗`, ''];
      return ['normal', say.dataset.daily || 'Miau. 🐾', ''];
    }
    const act = $('catAction');
    function updateMood() {
      const [m, text, btn] = computeMood();
      ['normal', 'thirsty', 'sleepy', 'hungry', 'train', 'joy'].forEach(k => catSvg.classList.toggle('mood-' + k, k === m));
      mood = m;
      if (!reacting) { say.textContent = petText(text); }
      act.hidden = !btn; act.textContent = btn; act.dataset.mood = m;
    }
    window.__catMood = updateMood;
    function markHabit(k) {
      const box = document.querySelector(`[data-habit="${k}"]`);
      if (box && !box.checked) box.click();
    }
    act.addEventListener('click', () => {
      const m = act.dataset.mood;
      if (m === 'thirsty') { catReact('drinking', 'Glu, glu, glu… 💧', ['💧', '💦', '💧']); markHabit('agua'); setTimeout(() => { if (reacting) say.textContent = '¡Ahhh, qué rica! Ya me siento mejor. 😊'; }, 1700); }
      else if (m === 'hungry') { catReact('eating', 'Ñam, ñam, ñam… 🥚', ['😋', '✨']); markHabit('proteina'); setTimeout(() => { if (reacting) say.textContent = '¡Mis músculos te lo agradecen! 💪'; }, 1700); }
      else if (m === 'sleepy') { catReact('flex', '¡Bien! Descansadas rendimos mucho más. ☀️', ['☀️', '✨']); markHabit('sueno'); }
      else if (m === 'train') { const b = document.querySelector('[data-go="rutina"]'); if (b) b.click(); }
    });
    // Al abrir la pestaña, saluda
    document.querySelector('[data-go="tu"]').addEventListener('click', () => setTimeout(() => { if (!reacting) { catSvg.classList.add('g-wave'); setTimeout(() => catSvg.classList.remove('g-wave'), 1500); } }, 250));
    setInterval(updateMood, 60000);
    setTimeout(updateMood, 0); // espera a que todo el módulo esté listo
    function unlocks(L) {
      const u = [];
      AVATARS.filter(a => a[2] === L).forEach(a => u.push('avatar ' + a[0]));
      TITLES.filter(a => a[1] === L).forEach(a => u.push('título «' + a[0] + '»'));
      CARDS.filter(a => a[2] === L).forEach(a => u.push('tarjeta ' + a[1]));
      if (PHRASES.some(f => f[1] === L)) u.push('una frase nueva');
      return u.join(', ');
    }

    // ---------- Estadísticas ----------
    const sessOf = d => Object.keys((d && d.s) || {}).length;
    const totalSess = () => Object.values(log).reduce((a, d) => a + sessOf(d), 0);
    function weekStats(monISO) {
      const st = { xp: 0, ex: 0, sess: 0, hab: 0, full: 0, active: 0 };
      for (let i = 0; i < 7; i++) {
        const d = log[addDays(monISO, i)];
        if (!d) continue;
        const h = Object.values(d.h || {}).filter(Boolean).length;
        st.xp += Math.max(0, d.xp); st.ex += Math.max(0, d.ex); st.sess += sessOf(d); st.hab += h;
        if (h === 3) st.full++;
        if (d.ex > 0 || h > 0) st.active++;
      }
      return st;
    }
    const thisMon = () => iso(mondayOf(today));
    function streakOf(habit) {
      let best = 0, cur = 0;
      Object.keys(log).sort().forEach((k, i, arr) => {
        const ok = log[k].h && log[k].h[habit];
        const prevOk = i > 0 && addDays(arr[i - 1], 1) === k;
        cur = ok ? (prevOk && cur ? cur + 1 : 1) : 0;
        best = Math.max(best, cur);
      });
      return best;
    }
    function weeksMet() {
      const mons = [...new Set(Object.keys(log).map(k => iso(mondayOf(k))))].sort();
      let best = 0, cur = 0, prev = null;
      mons.forEach(m => {
        const ok = weekStats(m).sess >= freqOf();
        cur = ok ? (prev && addDays(prev, 7) === m && cur ? cur + 1 : 1) : 0;
        best = Math.max(best, cur); prev = m;
      });
      return best;
    }

    // ---------- Chapitas (sin nombres: solo el dibujo; al tocar dice cómo se gana) ----------
    const PINS = [
      ['s1', '🎉', '#65A30D', 'Completa tu primera sesión', () => totalSess() >= 1],
      ['s10', '🔟', '#4D7C0F', 'Completa 10 sesiones', () => totalSess() >= 10],
      ['s25', '🏅', '#3F6212', 'Completa 25 sesiones', () => totalSess() >= 25],
      ['wk1', '📅', '#0E7490', 'Cumple todos tus días de una semana', () => weeksMet() >= 1],
      ['wk4', '🔗', '#155E75', 'Cumple tus días 4 semanas seguidas', () => weeksMet() >= 4],
      ['agua', '💧', '#2F7FD6', 'Toma agua 7 días seguidos', () => streakOf('agua') >= 7],
      ['sueno', '😴', '#4B5BC9', 'Duerme bien 7 días seguidos', () => streakOf('sueno') >= 7],
      ['prot', '🥚', '#E0962E', 'Come tu proteína 7 días seguidos', () => streakOf('proteina') >= 7],
      ['full', '⭐', '#84CC16', 'Completa los 3 hábitos en un día', () => Object.values(log).some(d => Object.values(d.h || {}).filter(Boolean).length === 3)],
      ['perfil', '📝', '#475569', 'Arma tu perfil', () => !!profile],
      ['cint', '📏', '#12967A', 'Registra tu cintura', () => !!(profile && profile.waist)],
      ['f1', '🥉', '#9A3412', 'Termina la fase 1 (4 semanas)', () => !!start && weeksRaw() >= 5],
      ['f2', '🥈', '#64748B', 'Termina la fase 2 (8 semanas)', () => !!start && weeksRaw() >= 9],
      ['fin', '🏆', '#B8862A', 'Termina el programa de 12 semanas', () => !!start && weeksRaw() >= 13],
      ['lv5', '⚡', '#CA8A04', 'Llega al nivel 5', () => lvl() >= 4]
    ];
    let pins = store.get('pins') || {};
    if (PREVIEW) PINS.forEach(p => { if (!pins[p[0]]) pins[p[0]] = today; });
    let fresh = [];
    function check(quiet) {
      const neu = PINS.filter(p => !pins[p[0]] && p[4]());
      neu.forEach(p => { pins[p[0]] = today; });
      if (neu.length) {
        store.set('pins', pins);
        fresh = neu.map(p => p[0]);
        if (!quiet) setTimeout(() => toast(`¡Ganaste una chapita nueva! ${neu.map(p => p[1]).join(' ')}`, 'level'), 1400);
      }
      renderPins();
    }
    // Se muestran las ganadas y solo las 3 próximas por ganar; el resto, al tocar "Ver todas"
    let pinsAll = false;
    $('pinsMore').addEventListener('click', () => { pinsAll = !pinsAll; renderPins(); });
    function renderPins() {
      let locked = 0;
      const shown = PINS.filter(p => pins[p[0]]).concat(PINS.filter(p => !pins[p[0]] && (pinsAll || locked++ < 3)));
      const hiddenN = PINS.length - shown.length;
      $('pinsMore').hidden = !pinsAll && hiddenN === 0;
      $('pinsMore').textContent = pinsAll ? 'Ver menos' : `Ver todas (${hiddenN} más)`;
      $('pinsMore').setAttribute('aria-expanded', pinsAll);
      $('pins').innerHTML = shown.map(p => pins[p[0]]
        ? `<button class="pin${fresh.includes(p[0]) ? ' new' : ''}" type="button" data-pin="${p[0]}" style="--pc:${p[2]}" aria-label="Chapita ganada: ${p[3]}">${p[1]}</button>`
        : `<button class="pin locked" type="button" data-pin="${p[0]}" aria-label="Chapita por ganar: ${p[3]}">?</button>`).join('');
      const n = PINS.filter(p => pins[p[0]]).length;
      $('pinCount').textContent = `${n} de ${PINS.length}`;
    }
    $('pins').addEventListener('click', ev => {
      const b = ev.target.closest('[data-pin]'); if (!b) return;
      const p = PINS.find(x => x[0] === b.dataset.pin);
      const d = pins[p[0]];
      $('pinHint').textContent = d ? `${p[1]} Ganada el ${d.split('-').reverse().join('/')}: ${p[3].toLowerCase()}.` : `🔒 ${p[3]}.`;
    });

    // ---------- Resumen semanal ----------
    const fmt = s => { const [y, m, d] = s.split('-'); return `${+d}/${+m}`; };
    function summaryText(st) {
      const f = freqOf();
      if (st.sess >= f) return `¡Semana completa! Cumpliste tus ${f} días. ✨`;
      if (st.sess > 0) return `Hiciste ${st.sess} de ${f} sesiones. Cada sesión suma: esta semana vamos por una más. 💪`;
      if (st.hab > 0) return 'No entrenaste, pero cuidaste tus hábitos. Esta semana, prueba con una sesión corta. 💪';
      return 'Semana tranquila. No pasa nada: hoy es un buen día para volver. 👊';
    }
    // Aviso del lunes: primero el mensaje; los números solo si hay algo que contar
    const weeklyBody = st => summaryText(st) + (st.hab ? ` Además, ${st.hab} hábito${st.hab > 1 ? 's' : ''} cumplido${st.hab > 1 ? 's' : ''}.` : '');
    function renderSummary(demo) {
      const mon = addDays(thisMon(), -7);
      const st = demo || weekStats(mon);
      const has = demo || Object.keys(log).some(k => k >= mon && k < thisMon());
      $('weekCard').hidden = false;
      if (!has) {
        const cur = weekStats(thisMon());
        // Sin actividad todavía: no mostramos una tarjeta llena de ceros
        if (!cur.sess && !cur.ex && !cur.hab && !cur.xp) { $('weekCard').hidden = true; return; }
        $('sumRange').textContent = 'esta semana';
        $('sumBody').innerHTML = `<div class="sum-grid"><div><b>${cur.sess}</b><span>sesiones</span></div><div><b>${cur.ex}</b><span>ejercicios</span></div><div><b>${cur.hab}</b><span>hábitos</span></div><div><b>${cur.xp}</b><span>XP ganada</span></div></div><p class="sum-msg">Tu primer resumen llega el lunes.</p>`;
        return;
      }
      const pinsWeek = PINS.filter(p => pins[p[0]] && pins[p[0]] >= mon && pins[p[0]] < thisMon()).map(p => p[1]);
      $('sumRange').textContent = `${fmt(mon)} al ${fmt(addDays(mon, 6))}`;
      $('sumBody').innerHTML = `<div class="sum-grid"><div><b>${st.sess}</b><span>sesiones completas</span></div><div><b>${st.ex}</b><span>ejercicios</span></div><div><b>${st.hab}</b><span>hábitos cumplidos</span></div><div><b>${st.xp}</b><span>XP ganada</span></div></div>
        <p class="sum-msg">${summaryText(st)}${(demo ? ['💧', '⭐'] : pinsWeek).length ? ' Chapitas nuevas: ' + (demo ? ['💧', '⭐'] : pinsWeek).join(' ') : ''}</p>`;
    }

    // ---------- Notificación de cada lunes ----------
    const canNotify = 'Notification' in window;
    function notifState() {
      const on = store.get('weeklyNotif') && canNotify && Notification.permission === 'granted';
      const p2 = typeof pushOn === 'function' && pushOn();
      $('testPush').hidden = !p2;
      $('notifBtn').textContent = (on || p2) ? '🔕 Desactivar avisos' : '🔔 Activar avisos';
      const iosNoPwa = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator.standalone || matchMedia('(display-mode: standalone)').matches);
      $('notifNote').textContent = iosNoPwa ? 'En iPhone, primero agrega la app a tu pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí para activar los avisos.'
        : !canNotify ? 'Este navegador no permite notificaciones.'
        : Notification.permission === 'denied' ? 'Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio.'
        : (typeof pushOn === 'function' && pushOn()) ? 'Avisos activados, aunque la web esté cerrada.'
        : on ? 'Te avisaremos cada lunes.' : '';
    }
    async function notify(title, body) {
      title = petText(title); body = petText(body);
      const opts = { body, tag: title.slice(0, 20) };
      try {
        const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration();
        if (reg) return await reg.showNotification(title, opts);
      } catch (e) {}
      try { new Notification(title, opts); } catch (e) {}
    }
    // ---------- Notificaciones push (llegan aunque la web esté cerrada) ----------
    const pushReady = 'serviceWorker' in navigator && 'PushManager' in window && location.protocol === 'https:';
    const pushOn = () => !!store.get('pushOn') && canNotify && Notification.permission === 'granted';
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});
    const b64u = s2 => { const p = '='.repeat((4 - s2.length % 4) % 4); const b = atob((s2 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); };
    function pushState() {
      const h = (store.get('habits') || {}); const hd = h.date === today ? h.done || {} : {};
      const mon = thisMon();
      return {
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Santiago',
        rem: Object.assign({ train: true, hab: true, hour: 19 }, store.get('remSettings') || {}),
        weekly: !!store.get('weeklyNotif'),
        days: SCHEDULES[schedule].days, start: start || null,
        today: { date: today, habits: ['agua', 'sueno', 'proteina'].filter(k => hd[k]), session: !!sessOf(log[today]) },
        week: { mon, cur: weekStats(mon), prev: weekStats(addDays(mon, -7)), freq: freqOf() },
        name: (profile && profile.name) || '',
        sess: planDays().map(d => [d.name.toLowerCase(), +((d.time.match(/\d+/) || ['30'])[0])]),
        pet: petNow().slice(0, 2)
      };
    }
    let syncT;
    function syncPush() {
      if (!pushOn()) return;
      clearTimeout(syncT);
      syncT = setTimeout(() => {
        const sub = store.get('pushSub'); if (!sub) return;
        fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub, state: pushState() }), keepalive: true }).catch(() => {});
      }, 800);
    }
    async function enablePush() {
      let perm = Notification.permission;
      try { if (perm === 'default') perm = await Notification.requestPermission(); } catch (e) {}
      if (perm !== 'granted') { notifState(); return false; }
      try {
        const reg = await navigator.serviceWorker.ready;
        const r = await fetch('/api/push-key'); const { key } = await r.json();
        if (!key) throw new Error('sin clave');
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64u(key) });
        store.set('pushSub', sub.toJSON()); store.set('pushOn', true); store.set('weeklyNotif', true);
        syncPush(); return true;
      } catch (e) { store.set('pushOn', false); store.set('weeklyNotif', true); return false; }
    }
    async function disablePush() {
      store.set('pushOn', false); store.set('weeklyNotif', false);
      const sub = store.get('pushSub');
      if (sub) fetch('/api/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub }) }).catch(() => {});
      try { const reg = await navigator.serviceWorker.ready; const s3 = await reg.pushManager.getSubscription(); if (s3) await s3.unsubscribe(); } catch (e) {}
      store.set('pushSub', null);
    }
    $('testPush').addEventListener('click', async () => {
      const sub = store.get('pushSub'); if (!sub) return;
      try { const r = await fetch('/api/test-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub }) }); toast(r.ok ? 'Aviso enviado 🔔' : 'No se pudo enviar: revisa las claves en Netlify'); } catch (e) { toast('Sin conexión'); }
    });
    $('notifBtn').addEventListener('click', async () => {
      if (pushReady) {
        if (pushOn()) { await disablePush(); notifState(); remNote(); return; }
        const ok = await enablePush(); notifState(); remNote();
        if (ok) toast('¡Listo! Te avisaremos aunque la web esté cerrada 🔔', 'level');
        return;
      }
      if (!canNotify) return notifState();
      if (store.get('weeklyNotif') && Notification.permission === 'granted') { store.set('weeklyNotif', false); return notifState(); }
      let perm = Notification.permission;
      try { if (perm === 'default') perm = await Notification.requestPermission(); } catch (e) {}
      store.set('weeklyNotif', perm === 'granted');
      notifState(); remNote();
      if (perm === 'granted') notify('¡Listo! 🔔', 'Cada lunes te llegará el resumen de tu semana.');
    });
    function weeklyNotify() {
      if (pushOn()) return;
      if (!store.get('weeklyNotif') || !canNotify || Notification.permission !== 'granted') return;
      const mon = thisMon();
      if (store.get('lastWeeklyNotif') === mon) return;
      if (!Object.keys(log).some(k => k >= addDays(mon, -7) && k < mon)) return;
      const st = weekStats(addDays(mon, -7));
      store.set('lastWeeklyNotif', mon);
      notify('Tu resumen semanal ✨', weeklyBody(st));
    }

    // Vista previa: botón para ver un resumen de ejemplo
    if (document.querySelector('.preview-flag')) {
      $('demoWeek').hidden = false;
      $('demoWeek').addEventListener('click', () => renderSummary({ sess: 3, ex: 17, hab: 15, xp: 245 }));
    }


    // ---------- Recordatorios de la gatita ----------
    // Un solo aviso por momento (entrenamiento + hábitos juntos), con el nombre de la sesión
    // y nombrando lo que falta. El segundo llega 2 horas después, nunca más tarde de las 21:00.
    const TRAIN_MSG = [
      ['Hoy toca {nombre} 🏋️', 'Las pesas no se levantan solas. Te están esperando.'],
      ['¿Listo? 💪', 'Hoy toca {nombre}. Vamos con todo.'],
      ['Solo {min} minutos ⏱', 'Es todo lo que pide tu sesión de {nombre}.'],
      ['Hoy es tu día 💪', 'Toca {nombre}. Una sesión más, un paso más.']
    ];
    const TRAIN_LAST = [
      ['¿10 minutos en casa? 🏠', 'Si hoy no alcanzas a ir, una versión corta de {nombre} igual cuenta.'],
      ['Otro día lo retomamos 🌙', 'Hoy no se pudo y está bien. Si entrenaste, márcalo en tu rutina.']
    ];
    const HAB_TITLE = { agua: '¿Ya tomaste agua? 💧', proteina: '¿Comiste tu proteína? 🥚', sueno: '¿Dormiste bien anoche? 🌙' };
    const HAB_NAME = { agua: 'tu agua', proteina: 'tu proteína', sueno: 'tus horas de sueño' };
    const HAB_BODY = ['{Falta} {lista} para completar tus hábitos de hoy. 💪', '{Falta} {lista}. Los hábitos también son entrenamiento.'];
    const LAST_HOUR = 21, GAP = 2;
    const SLOT_HOUR = { manana: 7, tarde: 16, noche: 19 };
    let rem = Object.assign({ train: true, hab: true, hour: 19 }, store.get('remSettings') || {});
    // Si nunca la cambió a mano, la hora del aviso sale de cuándo entrena (perfil)
    function autoHour() {
      const h = !rem.custom && profile && SLOT_HOUR[profile.slot];
      if (h && rem.hour !== h) { rem.hour = h; store.set('remSettings', rem); syncPush(); }
      $('remTime').value = String(rem.hour); remNote();
    }
    $('remTrain').checked = rem.train; $('remHab').checked = rem.hab; $('remTime').value = String(rem.hour);
    const saveRem = () => { store.set('remSettings', rem); remNote(); checkReminders(); syncPush(); };
    $('remTrain').addEventListener('change', e => { rem.train = e.target.checked; saveRem(); });
    $('remHab').addEventListener('change', e => { rem.hab = e.target.checked; saveRem(); });
    $('remTime').addEventListener('change', e => { rem.hour = +e.target.value; rem.custom = true; saveRem(); });
    function remNote() {
      const ok = canNotify && Notification.permission === 'granted';
      const slotTxt = { manana: 'en la mañana', tarde: 'en la tarde', noche: 'en la noche' }[profile && profile.slot];
      $('remNote').textContent = [!rem.custom && slotTxt ? `Ajustada a tu horario: entrenas ${slotTxt}.` : '', ok ? 'También te llegan como notificación.' : ''].filter(Boolean).join(' ');
    }
    const secondHour = () => Math.min(rem.hour + GAP, LAST_HOUR);
    const pick = (arr, salt) => arr[(Math.floor(parseISO(today) / 864e5) + salt) % arr.length];
    const fill = (t, v) => petText(t).replace(/\{(\w+)\}/g, (_, k) => v[k] != null ? v[k] : '');
    const lista = ks => { const n = ks.map(k => HAB_NAME[k]); return n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0] || ''; };
    const trainVars = d => ({ nombre: d.name.toLowerCase(), min: (d.time.match(/\d+/) || ['30'])[0] });
    // El sueño se refiere a la noche anterior: no hay nada que hacer en ese momento, así que no se recuerda
    const habMissing = (done) => ['agua', 'proteina'].filter(k => !done[k]);
    // Arma el mensaje: stage 0 = primer aviso, 1 = segundo
    function compose(tv, missing, stage) {
      const v = Object.assign({ lista: lista(missing), Falta: missing.length > 1 ? 'Te faltan' : 'Te falta', pet: petNow()[3] }, tv || {});
      if (tv) {
        // El "último aviso" solo tiene sentido en la tarde/noche; en la mañana el 2.º es otro recordatorio normal
        const m = stage && secondHour() >= 18 ? pick(TRAIN_LAST, 0) : pick(TRAIN_MSG, stage);
        return [fill(m[0], v), fill(m[1], v) + (missing.length ? fill(' Y no olvides {lista}.', v) : '')];
      }
      return [petText(HAB_TITLE[missing[0]]), fill(pick(HAB_BODY, 1 + stage), v)];
    }
    function pending() {
      const ti = todayIdx(), h = new Date().getHours();
      const tv = rem.train && ti >= 0 && !(start && notYet()) && !sessOf(log[today]) ? trainVars(buildDay(ti)) : null;
      const hb = store.get('habits'), hd = hb && hb.date === today ? hb.done || {} : {};
      return { tv, missing: rem.hab ? habMissing(hd) : [] };
    }
    function renderNudge() {
      const hidden = store.get('nudgeOff') === today, p = pending(), el = $('nudge'), h = new Date().getHours();
      // Los hábitos ya están en Inicio: la tarjeta solo aparece para recordar la sesión del día
      if (hidden || !p.tv || h < Math.min(rem.hour, 12)) { el.hidden = true; return; }
      const [t, b] = compose(p.tv, p.missing, h >= secondHour() && secondHour() > rem.hour ? 1 : 0);
      $('nudgeTitle').textContent = t; $('nudgeBody').textContent = b;
      $('nudgeGo').href = p.tv ? '#rutina' : '#habitos';
      $('nudgeGo').textContent = p.tv ? 'Ir a mi rutina' : 'Marcar hábitos';
      el.hidden = false;
    }
    $('nudgeLater').addEventListener('click', () => { store.set('nudgeOff', today); renderNudge(); });
    function checkReminders() {
      renderNudge();
      if (pushOn()) return;
      if (!canNotify || Notification.permission !== 'granted') return;
      const h = new Date().getHours();
      let sent = store.get('remSent');
      if (!sent || sent.date !== today || !('n' in sent)) sent = { date: today, n: 0 };
      const S = secondHour(), due = sent.n === 0 ? h >= rem.hour && h <= LAST_HOUR : sent.n === 1 && S > rem.hour && h >= S && h <= LAST_HOUR;
      const p = pending();
      if (due && (p.tv || p.missing.length)) { const [t, b] = compose(p.tv, p.missing, sent.n); notify(t, b); }
      if (due) sent.n = h >= S ? 2 : sent.n + 1;
      store.set('remSent', sent);
    }
    autoHour();
    remNote();
    checkReminders();
    setInterval(checkReminders, 60000);

    // ---------- Simulación de avisos: misma lógica que los recordatorios reales ----------
    (function simulator() {
      const sim = $('simSheet'), list = $('simList'), tl = $('simTl'), range = $('simHour');
      const hh = h => String(h).padStart(2, '0') + ':00';
      const val = n => (sim.querySelector(`input[name="${n}"]:checked`) || {}).value;
      let playT = null, lastFocus = null;
      // Día de gym de ejemplo: el primero de tus días que no sea lunes (el lunes tiene su propio escenario)
      const trainIdx = () => { const n = SCHEDULES[schedule].names, k = n.findIndex(x => x !== 'Lunes'); return val('simDay') === 'mon' ? 0 : (k < 0 ? 0 : k); };
      function trainInfo() {
        const w0 = week; week = autoWeek();
        const d = buildDay(trainIdx()); week = w0;
        return trainVars(d);
      }
      function events() {
        const day = val('simDay'), sess = val('simSess'), hab = val('simHab'), H = rem.hour, S = secondHour(), ev = [];
        const trainDay = day === 'train' || (day === 'mon' && SCHEDULES[schedule].days.includes(1));
        if (day === 'mon') {
          const st = { sess: 2, hab: 12, xp: 180 };
          ev.push({ h: 9, title: 'Tu resumen semanal ✨', body: weeklyBody(st), why: 'Resumen de la semana pasada (ejemplo)' });
        }
        // "1 de 3": ya tomó agua; le faltan los demás
        const doneAt = hab === 'all' ? { agua: 1, proteina: 1, sueno: 1 } : hab === 'some' ? { agua: 1 } : {};
        [[H, 0], [S, 1]].forEach(([h, stage]) => {
          if (stage && S <= H) return;
          const tv = rem.train && trainDay && (stage ? sess === 'never' : sess !== 'before') ? trainInfo() : null;
          const missing = rem.hab ? habMissing(doneAt) : [];
          if (!tv && !missing.length) return;
          const [title, body] = compose(tv, missing, stage);
          const why = [tv ? (stage ? 'la sesión sigue sin marcar' : 'no has marcado tu sesión') : '', missing.length ? 'faltan ' + missing.length + ' hábito' + (missing.length > 1 ? 's' : '') : ''].filter(Boolean).join(' y ');
          ev.push({ h, title, body, why: (stage ? 'Segundo aviso: ' : 'Primer aviso: ') + why });
        });
        return ev.sort((a, b) => a.h - b.h);
      }
      function render() {
        const h = +range.value, ev = events(), shown = ev.filter(e => e.h <= h).reverse();
        // Solo se anima el aviso que recién llega, no los que ya estaban
        const key = val('simDay') + val('simSess') + val('simHab'), fresh = key === render.k ? shown.length - (render.n || 0) : 0;
        render.k = key; render.n = shown.length;
        $('simClock').textContent = hh(h); $('simBarTime').textContent = hh(h); $('simHourTxt').textContent = hh(h);
        const dname = { train: SCHEDULES[schedule].names[trainIdx()], rest: 'Domingo', mon: 'Lunes' }[val('simDay')];
        $('simDate').textContent = dname.charAt(0).toUpperCase() + dname.slice(1);
        list.innerHTML = shown.length
          ? shown.map((e, i) => `<article class="sim-n${i ? ' old' : ''}${i < fresh ? '' : ' still'}"><header><i aria-hidden="true">${esc(petNow()[3])}</i>Newen<time>${hh(e.h)}</time></header><b>${esc(e.title)}</b><span>${esc(e.body)}</span></article>`).join('')
          : `<p class="sim-empty">${ev.length ? 'Todavía no hay avisos. El primero llega a las ' + hh(ev[0].h) + '.' : 'Hoy no te llega ningún aviso. 🎉'}</p>`;
        const off = [];
        if (!rem.train) off.push('Recordatorio de entrenamiento apagado');
        if (!rem.hab) off.push('Recordatorio de hábitos apagado');
        tl.innerHTML = (ev.length ? ev.map(e => `<li><b>${hh(e.h)}</b><span>${esc(e.why)}</span></li>`).join('') : '<li class="off"><b>—</b><span>Sin avisos con esta combinación</span></li>')
          + off.map(t => `<li class="off"><b>⏻</b><span>${t} (cámbialo en Tú → Ajustes)</span></li>`).join('')
          + `<li class="off"><b>ℹ️</b><span>En la app, la tarjeta de tu ${esc(petNow()[1])} aparece en Inicio desde las ${hh(Math.min(rem.hour, 12))}.</span></li>`;
      }
      function stop() { clearInterval(playT); playT = null; $('simPlay').textContent = '▶ Reproducir el día'; }
      function open() {
        lastFocus = document.activeElement; range.value = 23; render();
        sim.hidden = false; document.body.classList.add('sheet-open');
        requestAnimationFrame(() => sim.classList.add('on'));
        setTimeout(() => sim.querySelector('.sheet-x').focus({ preventScroll: true }), 30);
      }
      function close() {
        stop(); sim.classList.remove('on'); document.body.classList.remove('sheet-open');
        setTimeout(() => { sim.hidden = true; }, 220);
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      }
      // Un solo toque: llega una notificación real de ejemplo (solo si los avisos están activados)
      $('simOpen').addEventListener('click', () => {
        const iosNoPwa = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window.navigator.standalone || matchMedia('(display-mode: standalone)').matches);
        if (iosNoPwa) { toast('En iPhone, primero instala la app en tu pantalla de inicio y ábrela desde el ícono'); return; }
        if (!canNotify || Notification.permission !== 'granted') {
          toast('Primero activa los avisos con el botón 🔔 Activar avisos');
          const nb = $('notifBtn'); if (nb && !nb.hidden) { nb.scrollIntoView({ behavior: 'smooth', block: 'center' }); nb.classList.add('pulse'); setTimeout(() => nb.classList.remove('pulse'), 2400); }
          return;
        }
        const [t, b] = compose(trainInfo(), [], 0);
        notify('Así se mostrarán tus avisos 🔔', `Desde ahora te llegarán así. Por ejemplo: «${t}. ${b}»`);
        toast('🔔 Listo: revisa las notificaciones de tu teléfono');
      });
      sim.addEventListener('click', ev => { if (ev.target === sim || ev.target.closest('[data-close]')) close(); });
      sim.addEventListener('change', ev => { if (ev.target.name && ev.target.name.startsWith('sim')) { stop(); render(); } });
      range.addEventListener('input', () => { stop(); render(); });
      document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && !sim.hidden) close(); });
      $('simPlay').addEventListener('click', () => {
        if (playT) return stop();
        range.value = 7; render(); $('simPlay').textContent = '⏸ Pausar';
        playT = setInterval(() => { if (+range.value >= 23) return stop(); range.value = +range.value + 1; render(); }, 650);
      });
      $('simTest').addEventListener('click', async () => {
        const ev = events(), e = ev.filter(x => x.h <= +range.value).pop() || ev[0];
        if (!e) { toast('Con esta combinación no hay avisos'); return; }
        if (!canNotify) { toast('Este navegador no permite notificaciones'); return; }
        let perm = Notification.permission;
        try { if (perm === 'default') perm = await Notification.requestPermission(); } catch (_) {}
        if (perm !== 'granted') { toast('Activa las notificaciones para este sitio'); return; }
        notify(e.title, e.body); toast('🔔 Aviso de prueba enviado');
      });
    })();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

    window.__rw = {
      onXP(n) { day().xp += n; saveLog(); renderRewards(); check(); renderSummary(); renderNudge(); },
      onEx(n, k, allDone) { const d = day(); d.ex += n; if (allDone) d.s[k] = 1; else delete d.s[k]; saveLog(); syncPush(); if (window.__catMood) window.__catMood(); renderNudge(); },
      onHab(done) { renderNudge(); day().h = Object.assign({}, done); saveLog(); check(); renderSummary(); if (window.__catMood) window.__catMood(); syncPush(); },
      unlocks, check, autoHour, sync: syncPush
    };
    renderRewards();
    check(true); fresh = [];
    renderPins();
    renderSummary();
    notifState();
    weeklyNotify();
    syncPush();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPush(); });
  })();

  // =====================================================================
  // Newen (antes BETA N°1): dibujos animados, registro de peso, avance y primer día
  // =====================================================================
  var BETA_POSES;
  function betaPoses() {
    if (BETA_POSES) return BETA_POSES;
    // Articulaciones: cabeza, cuello, cadera, rodilla1, pie1, rodilla2, pie2, codo1, mano1, codo2, mano2
    const S = [[60,16],[60,27],[60,55],[62,73],[62,91],[58,73],[58,91],[62,41],[62,55],[58,41],[58,55]];
    const F = [[60,16],[60,27],[60,55],[55,73],[54,91],[65,73],[66,91],[52,40],[50,54],[68,40],[70,54]];
    const Q = [[86,60],[76,64],[44,64],[46,90],[28,90],[44,89],[26,90],[77,77],[78,90],[75,77],[76,90]];
    const W = (base, ch) => base.map((p, i) => ch[i] ? ch[i] : p);
    const seat = { 1: [50,46], 0: [51,35], 2: [50,74], 3: [68,70], 4: [68,91], 5: [66,70], 6: [66,91] };
    BETA_POSES = {
      squat: { A: W(S, { 7: [66,40], 8: [68,32], 9: [64,40], 10: [66,32] }),
               B: [[68,37],[62,46],[46,70],[64,72],[62,91],[60,72],[58,91],[70,56],[72,48],[68,56],[70,48]], w: 1 },
      chair: { A: W(S, { 7: [68,38], 8: [76,36], 9: [66,38], 10: [74,36] }),
               B: [[68,37],[62,46],[46,70],[64,72],[62,91],[60,72],[58,91],[72,46],[80,44],[70,46],[78,44]], prop: [[22,70,22,22]] },
      hinge: { A: W(S, { 8: [62,57], 10: [58,57] }),
               B: [[86,38],[76,42],[50,54],[56,72],[60,91],[52,72],[56,91],[77,55],[77,68],[75,55],[75,68]], w: 2 },
      slhinge: { A: W(S, { 8: [62,57], 10: [58,57] }),
               B: [[86,38],[76,42],[50,54],[56,72],[60,91],[34,50],[18,46],[77,55],[77,68],[75,55],[75,68]], w: 1 },
      bridge: { A: [[18,84],[28,86],[54,88],[70,72],[80,91],[68,72],[78,91],[38,90],[48,90],[38,90],[48,90]],
               B: [[18,84],[28,86],[54,72],[74,70],[80,91],[72,70],[78,91],[38,90],[48,90],[38,90],[48,90]] },
      hipthrust: { A: [[18,67],[28,70],[46,86],[66,72],[76,91],[64,72],[74,91],[36,80],[46,84],[34,80],[44,84]],
               B: [[18,67],[28,70],[50,68],[70,68],[76,91],[68,68],[74,91],[40,72],[50,66],[38,72],[48,66]], prop: [[4,70,28,22]], w: 1 },
      lunge: { A: S, B: [[57,27],[56,38],[54,66],[70,74],[72,91],[48,82],[32,91],[58,52],[58,66],[54,52],[54,66]], w: 2 },
      bulg: { A: [[56,16],[56,27],[56,55],[60,73],[60,91],[46,70],[32,74],[58,41],[58,55],[54,41],[54,55]],
               B: [[56,29],[55,40],[52,68],[66,76],[62,91],[40,84],[30,74],[57,54],[57,68],[53,54],[53,68]], prop: [[6,74,30,18]], w: 2 },
      stepup: { A: [[50,17],[50,28],[50,56],[66,62],[74,76],[50,74],[50,91],[52,42],[52,56],[48,42],[48,56]],
               B: [[72,5],[72,16],[72,44],[74,60],[74,76],[80,52],[78,68],[74,30],[74,44],[70,30],[70,44]], prop: [[62,76,44,16]] },
      press: { A: [[20,43],[26,52],[42,74],[54,56],[74,58],[52,58],[72,60],[34,64],[40,72],[32,64],[38,72]],
               B: [[20,43],[26,52],[42,74],[62,67],[82,59],[60,69],[80,61],[34,64],[40,72],[32,64],[38,72]], prop: [[18,76,32,6]], plate: 1 },
      pushup: { A: [[88,58],[78,62],[50,75],[34,83],[18,91],[34,83],[20,91],[79,77],[80,91],[77,77],[78,91]],
               B: [[89,77],[78,80],[50,85],[34,88],[18,91],[34,88],[20,91],[68,74],[80,91],[66,74],[78,91]] },
      row: { A: [[52,36],[50,47],[44,74],[62,66],[78,76],[60,66],[76,77],[62,50],[78,56],[60,50],[76,56]],
             B: [[46,35],[44,46],[44,74],[62,66],[78,76],[60,66],[76,77],[34,56],[48,58],[32,56],[46,58]], prop: [[30,76,30,6]], cable: [114,58] },
      pull: { A: W(S, Object.assign({}, seat, { 7: [54,22], 8: [56,6], 9: [52,22], 10: [54,6] })),
              B: W(S, Object.assign({}, seat, { 7: [44,56], 8: [56,40], 9: [42,56], 10: [54,40] })), prop: [[40,76,30,6]], cable: [56,-8] },
      ohp: { A: W(S, Object.assign({}, seat, { 7: [62,44], 8: [58,32], 9: [60,44], 10: [56,32] })),
             B: W(S, Object.assign({}, seat, { 7: [56,26], 8: [54,10], 9: [54,26], 10: [52,10] })), prop: [[40,76,30,6]], w: 2 },
      chest: { A: [[16,62],[26,64],[56,64],[74,66],[78,91],[72,66],[76,91],[27,48],[28,34],[25,48],[26,34]],
               B: [[16,62],[26,64],[56,64],[74,66],[78,91],[72,66],[76,91],[20,66],[28,52],[18,66],[26,52]], prop: [[10,68,64,6]], w: 2 },
      lateral: { A: F, B: W(F, { 7: [47,30], 8: [34,28], 9: [73,30], 10: [86,28] }), w: 2 },
      abduct: { A: W(F, { 7: [50,44], 8: [56,54], 9: [70,44], 10: [64,54] }), B: W(F, { 5: [72,71], 6: [82,86], 7: [50,44], 8: [56,54], 9: [70,44], 10: [64,54] }), band: 1 },
      kick: { A: Q, B: W(Q, { 5: [28,60], 6: [26,42] }) },
      birddog: { A: Q, B: W(Q, { 5: [28,62], 6: [12,62], 7: [90,58], 8: [102,56] }) },
      deadbug: { A: [[20,84],[30,86],[58,86],[60,68],[76,68],[58,68],[74,68],[32,72],[32,58],[30,72],[30,58]],
                 B: [[20,84],[30,86],[58,86],[60,68],[76,68],[76,80],[94,84],[18,82],[6,80],[30,72],[30,58]] },
      prone: { A: [[90,84],[80,86],[48,88],[30,88],[12,88],[30,89],[12,89],[92,87],[104,88],[92,88],[104,89]],
               B: [[91,79],[80,82],[48,88],[30,86],[12,80],[30,87],[12,82],[92,79],[104,76],[92,80],[104,77]] },
      plank: { A: [[88,71],[78,74],[48,82],[32,86],[16,91],[32,86],[18,91],[78,91],[94,91],[76,91],[92,91]],
               B: [[88,70],[78,74],[48,79],[32,85],[16,91],[32,85],[18,91],[78,91],[94,91],[76,91],[92,91]] },
      walk: { A: W(S, { 3: [64,72], 4: [68,90], 5: [54,73], 6: [48,90], 7: [56,40], 8: [52,52], 9: [64,40], 10: [68,52] }),
              B: W(S, { 3: [54,73], 4: [48,90], 5: [64,72], 6: [68,90], 7: [64,40], 8: [68,52], 9: [56,40], 10: [52,52] }), slow: 1 },
      curl: { A: W(S, { 7: [61,41], 8: [62,55], 9: [59,41], 10: [60,55] }), B: W(S, { 7: [61,41], 8: [72,32], 9: [59,41], 10: [70,32] }), w: 2 },
      tri: { A: W(S, { 7: [62,42], 8: [72,32], 9: [60,42], 10: [70,32] }), B: W(S, { 7: [62,42], 8: [63,56], 9: [60,42], 10: [61,56] }), cable: [76,-8] },
      pallof: { A: W(S, { 7: [64,42], 8: [68,36], 9: [62,42], 10: [66,36] }), B: W(S, { 7: [72,34], 8: [84,34], 9: [70,34], 10: [82,34] }), cable: [4,36] },
      mobil: { A: Q, B: W(Q, { 0: [84,70], 1: [76,66], 2: [44,60] }), slow: 1 },
      stand: { A: S, B: W(S, { 7: [64,15], 8: [66,4], 9: [56,15], 10: [54,4] }), slow: 1 },
      calf: { A: S, B: S.map((q, i) => [q[0], q[1] - (i === 4 || i === 6 ? 2 : 6)]), w: 2 }
    };
    return BETA_POSES;
  }
  function exPattern(n) {
    n = String(n).toLowerCase();
    const R = [
      [/cardio|caminata|cinta|bici|intervalo|baile|marcha|trote|el[ií]ptica/, 'walk'], [/cu[aá]driceps/, 'press'], [/talones|pantorrilla/, 'calf'], [/curl femoral/, 'kick'], [/rueda abdominal/, 'plank'], [/press de banca|aperturas|pec deck/, 'chest'], [/encogimiento/, 'calf'],
      [/movilidad|estir|gato|respira|suelo p[eé]lvico|kegel/, 'mobil'],
      [/hip thrust/, 'hipthrust'], [/puente/, 'bridge'],
      [/peso muerto.*una pierna/, 'slhinge'], [/peso muerto|buenos d[ií]as/, 'hinge'],
      [/b[uú]lgara/, 'bulg'], [/zancada/, 'lunge'], [/escal[oó]n|step/, 'stepup'],
      [/prensa/, 'press'], [/sentadilla.*silla/, 'chair'], [/sentadilla/, 'squat'],
      [/abducci|almeja|clamshell|caminata lateral|patada lateral/, 'abduct'],
      [/patada de gl[uú]teo|kickback/, 'kick'], [/bird dog/, 'birddog'], [/dead bug/, 'deadbug'],
      [/superman|nado|boca abajo/, 'prone'], [/plancha/, 'plank'], [/flexi/, 'pushup'],
      [/jal[oó]n|dominada/, 'pull'], [/remo|face pull/, 'row'],
      [/press de hombro|hombros/, 'ohp'], [/press.*pecho|press inclinado|aperturas/, 'chest'],
      [/elevaci/, 'lateral'], [/curl/, 'curl'], [/tr[ií]ceps|fondos/, 'tri'], [/pallof/, 'pallof']
    ];
    for (const [re, k] of R) if (re.test(n)) return k;
    return 'stand';
  }
  function figSVG(pt, name, big) {
    const BETA_RM = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const P = betaPoses()[pt] || betaPoses().stand, A = P.A, B = P.B;
    const dur = P.slow ? '1.6s' : '2.6s';
    const kt = 'keyTimes="0;0.42;0.58;1" calcMode="spline" keySplines=".45 0 .55 1;0 0 1 1;.45 0 .55 1"';
    const anim = (attr, a, b) => BETA_RM || (a === b) ? '' : `<animate attributeName="${attr}" values="${a};${b};${b};${a}" dur="${dur}" repeatCount="indefinite" ${kt}/>`;
    const line = (i, j, cls) => {
      const [a1, a2, b1, b2] = [A[i], A[j], B[i], B[j]], s0 = BETA_RM ? b1 : a1, s1 = BETA_RM ? b2 : a2;
      return `<line class="${cls}" x1="${s0[0]}" y1="${s0[1]}" x2="${s1[0]}" y2="${s1[1]}">${anim('x1', a1[0], b1[0])}${anim('y1', a1[1], b1[1])}${anim('x2', a2[0], b2[0])}${anim('y2', a2[1], b2[1])}</line>`;
    };
    const dot = (i, r, cls, dx = 0, dy = 0) => {
      const a = A[i], b = B[i], st = BETA_RM ? b : a;
      return `<circle class="${cls}" cx="${st[0] + dx}" cy="${st[1] + dy}" r="${r}">${anim('cx', a[0] + dx, b[0] + dx)}${anim('cy', a[1] + dy, b[1] + dy)}</circle>`;
    };
    const lname = String(name || '').toLowerCase();
    const heavy = P.w || /mancuern|goblet|barra|con peso/.test(lname);
    let props = (P.prop || []).map(r => `<rect class="fg-prop" x="${r[0]}" y="${r[1]}" width="${r[2]}" height="${r[3]}" rx="2"/>`).join('');
    let cable = '';
    if (P.cable && /polea|m[aá]quina|banda|jal[oó]n|face pull|cable/.test(lname)) {
      const [cx, cy] = P.cable, a = A[8], b = B[8], st = BETA_RM ? b : a;
      cable = `<line class="fg-cable" x1="${cx}" y1="${cy}" x2="${st[0]}" y2="${st[1]}">${anim('x2', a[0], b[0])}${anim('y2', a[1], b[1])}</line>`;
    }
    let band = '';
    if (P.band && /banda/.test(lname)) band = line(3, 5, 'fg-band');
    let plate = '';
    if (P.plate) {
      const a = A[4], b = B[4], st = BETA_RM ? b : a;
      plate = `<line class="fg-plate" x1="${st[0] + 3}" y1="${st[1] - 12}" x2="${st[0] + 3}" y2="${st[1] + 8}">${anim('x1', a[0] + 3, b[0] + 3)}${anim('y1', a[1] - 12, b[1] - 12)}${anim('x2', a[0] + 3, b[0] + 3)}${anim('y2', a[1] + 8, b[1] + 8)}</line>`;
    }
    const far = line(1, 9, 'fg-far') + line(9, 10, 'fg-far') + line(2, 5, 'fg-far') + line(5, 6, 'fg-far');
    const near = line(1, 2, 'fg-limb') + line(2, 3, 'fg-limb') + line(3, 4, 'fg-limb') + line(1, 7, 'fg-limb') + line(7, 8, 'fg-limb');
    // Pesas dibujadas como mancuernas (barra con dos discos). Si ambas manos quedan casi en el
    // mismo punto, se dibuja solo la del lado cercano para que no se vean dos anillos encimados.
    const bell = (i, cls) => {
      const a = A[i], b = B[i], st = BETA_RM ? b : a, seg = (dx, w, c) => `<line class="${c}" stroke-width="${w}" x1="${st[0] - dx}" y1="${st[1]}" x2="${st[0] + dx}" y2="${st[1]}">${anim('x1', a[0] - dx, b[0] - dx)}${anim('y1', a[1], b[1])}${anim('x2', a[0] + dx, b[0] + dx)}${anim('y2', a[1], b[1])}</line>`;
      return `<g class="${cls}">${seg(5, 2, 'fg-db-bar')}${seg(5, 6, 'fg-db-end')}</g>`;
    };
    const near2 = (i, j) => Math.hypot(A[i][0] - A[j][0], A[i][1] - A[j][1]) < 8 && Math.hypot(B[i][0] - B[j][0], B[i][1] - B[j][1]) < 8;
    const both = P.w === 2 || /mancuernas|barra/.test(lname);
    const wts = heavy ? (both && !near2(8, 10) ? bell(10, 'fg-w2') : '') + bell(8, '') : '';
    // Encuadre: recorta al cuerpo y sus elementos para que el dibujo se vea grande
    const xs = [], ys = [];
    A.concat(B).forEach(q => { xs.push(q[0]); ys.push(q[1]); });
    xs.push(A[0][0] - 8, A[0][0] + 8, B[0][0] - 8, B[0][0] + 8); ys.push(A[0][1] - 8, B[0][1] - 8, 92);
    (P.prop || []).forEach(r => { xs.push(r[0], r[0] + r[2]); ys.push(r[1]); });
    let x0 = Math.min(...xs) - 6, x1 = Math.max(...xs) + 6, y0 = Math.min(...ys) - 5, y1 = 95;
    let vw = x1 - x0, vh = y1 - y0; const ar = 1.1;
    if (vw / vh < ar) { const nw = vh * ar; x0 -= (nw - vw) / 2; vw = nw; } else { const nh = vw / ar; y0 -= nh - vh; vh = nh; }
    return `<svg class="fig${big ? ' big' : ''}" viewBox="${x0.toFixed(1)} ${y0.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" aria-hidden="true" focusable="false"><line class="fg-floor" x1="${(x0 + 2).toFixed(1)}" y1="92" x2="${(x0 + vw - 2).toFixed(1)}" y2="92"/>${props}${cable}${far}${band}${near}${plate}${dot(0, 7, 'fg-head')}${wts}</svg>`;
  }

  // ---------- Registro de peso ----------
  var BETA_WLOG;
  function wlog() { if (!BETA_WLOG) BETA_WLOG = store.get('wlog') || {}; return BETA_WLOG; }
  function wCan(name, pt) {
    const n = String(name).toLowerCase();
    if (/mancuern|barra|polea|m[aá]quina|prensa|smith|goblet/.test(n)) return true;
    return mode === 'gym' && !['walk', 'mobil', 'plank', 'deadbug', 'birddog', 'prone', 'pushup', 'stand'].includes(pt);
  }
  function fmtKg(k) { return k > 0 ? String(k).replace('.', ',') + ' kg' : 'Sin peso'; }
  function wStep(name, kg) { if (/barra/i.test(name) && kg >= 20) return 2.5; const lower = ['squat', 'hinge', 'hipthrust', 'press', 'bridge', 'lunge', 'bulg'].includes(exPattern(name)); return lower && kg >= 10 ? 2.5 : 1; }
  function wSuggest(name) {
    const L = wlog()[name] || [], last = L[L.length - 1];
    if (!last) { const k = seedKg(name); return k ? { last: null, seed: k, next: k } : { last: null }; }
    const prev = L[L.length - 2];
    const up = last.ok && prev && prev.ok && prev.kg === last.kg && last.kg > 0;
    return { last, up, next: up ? Math.round((last.kg + wStep(name, last.kg)) * 2) / 2 : last.kg };
  }
  function wSave(name, kg, ok, sets) {
    const all = wlog(), L = all[name] || (all[name] = []);
    const last = L[L.length - 1], e = { d: today, kg, ok };
    if (sets && sets.length) e.sets = sets.slice(0, 10);
    if (last && last.d === today) L[L.length - 1] = e; else L.push(e);
    if (L.length > 30) L.splice(0, L.length - 30);
    store.set('wlog', all);
  }

  // ---------- Series, récords, calentamiento y descanso ----------
  const repTarget = r => { const m = String(r || '').match(/(\d+)(?:\s*[–-]\s*(\d+))?/); return m ? { lo: +m[1], hi: +(m[2] || m[1]) } : { lo: 10, hi: 10 }; };
  const restSecs = r => { const m = String(r || '').match(/(\d+)(?:\s*[–-]\s*(\d+))?\s*(min|s)\b/); if (!m) return 0; const v = m[2] ? (+m[1] + +m[2]) / 2 : +m[1]; return Math.round(m[3] === 'min' ? v * 60 : v); };
  const nSeries = s => { const m = /^(\d+)/.exec(s || ''); return m ? Math.min(8, Math.max(1, +m[1])) : 3; };
  // 1RM estimado (fórmula de Epley): cuánto podrías levantar 1 sola vez
  const e1rm = (kg, reps) => (kg > 0 && reps > 0 ? (reps === 1 ? kg : kg * (1 + Math.min(reps, 12) / 30)) : 0);
  const kgTxt = k => String(Math.round(k * 2) / 2).replace('.', ',') + ' kg';
  function sessionBest(x) { let b = 0; (x.sets || []).forEach(s => { b = Math.max(b, e1rm(s.kg, s.reps)); }); return b; }
  function bestOf(name) {
    let b = null;
    (wlog()[name] || []).forEach(x => (x.sets || []).forEach(s => { const v = e1rm(s.kg, s.reps); if (v && (!b || v > b.e)) b = { e: v, kg: s.kg, reps: s.reps, d: x.d }; }));
    return b;
  }
  function sparkSvg(vals) {
    if (vals.length < 2) return '';
    const lo = Math.min(...vals), hi = Math.max(...vals), rg = hi - lo || 1;
    const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * 96 + 2).toFixed(1)},${(30 - ((v - lo) / rg) * 26).toFixed(1)}`).join(' ');
    const lp = pts.split(' ').pop().split(',');
    return `<svg class="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/><circle cx="${lp[0]}" cy="${lp[1]}" r="2.6"/></svg>`;
  }
  // Discos por lado para una barra olímpica de 20 kg
  function platesFor(kg) {
    if (!(kg >= 20)) return '';
    let side = (kg - 20) / 2;
    if (side <= 0) return 'Solo la barra (20 kg)';
    const out = [];
    for (const p of [25, 20, 15, 10, 5, 2.5, 1.25]) while (side >= p - 1e-9) { out.push(p); side -= p; }
    return 'Discos por lado: ' + out.map(x => String(x).replace('.', ',')).join(' + ') + (side > 0.01 ? ' (aprox.)' : '') + ' · barra de 20 kg';
  }
  const isBar = n => /con barra|barra\b/i.test(n) && !/polea|m[aá]quina|mancuern|asistid/i.test(n);
  function warmupTxt(name, kg) {
    if (!(kg > 0)) return '';
    const bar = isBar(name), main = EXLIB[name] ? EXLIB[name][1] === 'main' : ['squat', 'hinge', 'chest', 'ohp', 'hipthrust'].includes(exPattern(name));
    if (!main && !bar) return '';
    const rd = x => (bar ? Math.max(20, Math.round(x / 2.5) * 2.5) : Math.max(1, Math.round(x)));
    const steps = bar ? (kg >= 50 ? [[0, 10], [.4, 8], [.6, 5], [.8, 3]] : [[0, 10], [.6, 6]]) : [[.5, 10], [.75, 5]];
    const parts = [];
    steps.forEach(([f, n]) => { const w = f ? rd(kg * f) : 20; if (w < kg && !parts.some(p => p[0] === w)) parts.push([w, n]); });
    return parts.map(([w, n]) => (bar && w === 20 ? 'Barra sola' : kgTxt(w)) + ' × ' + n).join(' · ');
  }

  // ---------- Cronómetro de descanso ----------
  const restBar = document.getElementById('restBar');
  let restEnd = 0, restTotal = 0, restT = null, audioCtx = null;
  function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} }
  function beep() {
    try { if (!audioCtx) return; [0, .25, .5].forEach(t => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination); g.gain.setValueAtTime(.18, audioCtx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + t + .18); o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + .2); }); } catch (e) {}
  }
  function startRest(secs, label) {
    if (!(secs > 0)) return;
    unlockAudio();
    restTotal = secs; restEnd = Date.now() + secs * 1000;
    restBar.classList.remove('done'); restBar.hidden = false;
    document.getElementById('restLabel').textContent = label || 'Descanso';
    clearInterval(restT); restT = setInterval(tickRest, 250); tickRest();
  }
  function tickRest() {
    if (restBar.hidden || !restEnd) return;
    const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
    document.getElementById('restTime').textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    document.getElementById('restFill').style.width = (100 - Math.min(100, left / restTotal * 100)).toFixed(1) + '%';
    if (left <= 0) {
      clearInterval(restT); restT = null; restEnd = 0;
      restBar.classList.add('done');
      document.getElementById('restLabel').textContent = '¡A la siguiente serie! 💪';
      try { if (navigator.vibrate) navigator.vibrate([250, 120, 250]); } catch (e) {}
      beep();
      setTimeout(() => { if (!restEnd) { restBar.hidden = true; restBar.classList.remove('done'); } }, 5000);
    }
  }
  restBar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-rest]'); if (!b) return;
    if (b.dataset.rest === 'skip') { clearInterval(restT); restT = null; restEnd = 0; restBar.hidden = true; return; }
    if (!restEnd) return;
    restEnd = Math.max(Date.now() + 1000, restEnd + +b.dataset.rest * 1000);
    restTotal = Math.max(restTotal, Math.ceil((restEnd - Date.now()) / 1000));
    tickRest();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tickRest(); });

  // ---------- Hoja de detalle del ejercicio ----------
  const sheet = document.getElementById('exSheet');
  const sheetBody = document.getElementById('exSheetBody');
  let sheetJ = -1, sheetKg = 0, sheetLast = null, sheetEx = null;
  // Series que vas marcando hoy (por si cierras la hoja a mitad del ejercicio)
  let draft = store.get('setDraft');
  if (!draft || draft.date !== today) draft = { date: today, k: {} };
  const draftKey = name => dkey(current) + '|' + name;
  const fmtD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d)); };
  function setRow(i, s) {
    return `<div class="set-row${s.done ? ' done' : ''}" data-set="${i}">
      <span class="set-n">${i + 1}</span>
      <label class="set-in"><input type="number" class="set-kg" inputmode="decimal" step="0.5" min="0" max="500" value="${s.kg}" aria-label="Peso de la serie ${i + 1}"><small>kg</small></label>
      <span class="set-x">×</span>
      <label class="set-in"><input type="number" class="set-reps" inputmode="numeric" min="0" max="100" value="${s.reps}" aria-label="Repeticiones de la serie ${i + 1}"><small>reps</small></label>
      <button type="button" class="set-ok" data-setok="${i}" aria-pressed="${!!s.done}" aria-label="Serie ${i + 1} hecha">✓</button>
    </div>`;
  }
  function openSheet(j) {
    const d = buildDay(current), e = d.ex[j];
    if (!e) return;
    sheetJ = j; sheetEx = e;
    const pt = exPattern(e.name), wl = wCan(e.name, pt), sg = wl ? wSuggest(e.name) : null;
    const isDone = !!doneMap(dkey(current), d.ex)[e.name];
    sheetKg = (sg && (sg.last ? sg.next : sg.seed)) || 0;
    const tgt = repTarget(e.reps), n = nSeries(e.series), rs = restSecs(e.rest);
    const dr = draft.k[draftKey(e.name)];
    const rows = Array.from({ length: n }, (_, i) => (dr && dr[i]) || { kg: sheetKg, reps: tgt.hi, done: false });
    if (dr && dr[0]) sheetKg = dr[0].kg;
    const hist = (wlog()[e.name] || []).slice(-4).reverse();
    const best = wl ? bestOf(e.name) : null;
    const curve = (wlog()[e.name] || []).map(sessionBest).filter(v => v > 0).slice(-12);
    const msg = !sg ? '' : !sg.last && sg.seed
      ? `<p class="sh-tip">🎯 <b>Partimos con ${fmtKg(sg.seed)}</b>, según los pesos de tu perfil. Ajústalo si lo necesitas.</p>`
      : !sg.last
      ? `<p class="sh-tip">🎯 <b>Primera vez:</b> elige un peso con el que las últimas 2 reps cuesten, sin perder la forma.</p>`
      : sg.up ? `<p class="sh-tip up">⬆ <b>¡Lo lograste 2 veces!</b> Hoy prueba ${fmtKg(sg.next)}.</p>`
      : sg.last.ok ? `<p class="sh-tip">👍 Repite ${fmtKg(sg.last.kg)}. Si lo logras otra vez, subes.</p>`
      : `<p class="sh-tip">💪 Mantén ${fmtKg(sg.last.kg)} hasta lograr todas las reps.</p>`;
    const wu = wl ? warmupTxt(e.name, sheetKg) : '';
    sheetBody.innerHTML = `
      <div class="sh-fig">${figSVG(pt, e.name, true)}</div>
      <h3 id="exSheetTitle">${e.name}</h3>
      <div class="sh-stats"><span><b>${e.series.replace(' series', '')}</b><small>series</small></span><span><b>${String(e.reps).replace(/ reps$/, '')}</b><small>reps</small></span><span><b>${e.rest && e.rest !== '—' ? e.rest : 'Continuo'}</b><small>${e.rest && e.rest !== '—' ? 'descanso' : 'sin pausas'}</small></span></div>
      <p class="sh-cue">💡 ${e.tip || 'Movimiento controlado y buena técnica antes que más peso.'}</p>
      ${wl ? `
      <div class="sh-w">
        ${msg}
        ${best ? `<div class="sh-pr"><div>🏆 Récord: <b>${kgTxt(best.kg)} × ${best.reps}</b><br><small>1RM estimado: ${kgTxt(best.e)} · ${fmtD(best.d)}</small></div>${sparkSvg(curve)}</div>` : ''}
        <p class="sh-lbl">Peso para todas las series</p>
        <div class="stepper" role="group" aria-label="Peso usado">
          <button type="button" data-kg="-1" aria-label="Menos peso">−</button>
          <output id="shKg" aria-live="polite">${fmtKg(sheetKg)}</output>
          <button type="button" data-kg="1" aria-label="Más peso">+</button>
        </div>
        <p class="sh-plates" id="shPlates">${isBar(e.name) ? platesFor(sheetKg) : ''}</p>
        <p class="sh-wu" id="shWu"${wu ? '' : ' hidden'}>🔥 <b>Calentamiento:</b> <span>${wu}</span></p>
        <p class="sh-lbl">Tus series <small>· toca ✓ al terminar cada una${rs ? ' y parte el descanso' : ''}</small></p>
        <div class="sets" id="shSets">${rows.map((s, i) => setRow(i, s)).join('')}</div>
        <p class="sh-goal">Meta: ${tgt.lo === tgt.hi ? tgt.hi : tgt.lo + ' a ' + tgt.hi} reps por serie. Si logras ${tgt.hi} en todas, 2 veces seguidas, subes de peso.</p>
        ${hist.length ? `<div class="sh-hist">${hist.map(h => `<span>${fmtD(h.d)} <b>${fmtKg(h.kg)}</b>${h.sets && h.sets.length ? ' × ' + h.sets.map(s => s.reps).join(',') : ''} ${h.ok ? '✓' : '·'}</span>`).join('')}</div>` : ''}
      </div>` : (rs ? `<button class="btn btn-ghost btn-block" type="button" data-restgo style="margin-top:12px">⏱ Iniciar descanso (${e.rest})</button>` : '')}
      <button class="btn btn-primary btn-block" type="button" id="shSave">${wl ? (isDone ? 'Guardar series' : 'Guardar y marcar ✓') : (isDone ? 'Listo' : 'Marcar como hecho ✓')}</button>`;
    sheetLast = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    requestAnimationFrame(() => sheet.classList.add('on'));
    const sv = document.getElementById('shSave'); if (sv) sv.focus({ preventScroll: true });
  }
  function readRows() {
    return Array.from(sheet.querySelectorAll('.set-row')).map(r => ({
      kg: Math.max(0, Math.min(500, Math.round((parseFloat(r.querySelector('.set-kg').value) || 0) * 2) / 2)),
      reps: Math.max(0, Math.min(100, parseInt(r.querySelector('.set-reps').value, 10) || 0)),
      done: r.classList.contains('done')
    }));
  }
  function saveDraft() { if (!sheetEx) return; draft.k[draftKey(sheetEx.name)] = readRows(); store.set('setDraft', draft); }
  function refreshKgInfo() {
    if (!sheetEx) return;
    const pl = document.getElementById('shPlates'); if (pl) pl.textContent = isBar(sheetEx.name) ? platesFor(sheetKg) : '';
    const wu = document.getElementById('shWu'); if (wu) { const t = warmupTxt(sheetEx.name, sheetKg); wu.hidden = !t; wu.querySelector('span').textContent = t; }
  }
  function closeSheet() {
    saveDraft();
    sheet.classList.remove('on');
    document.body.classList.remove('sheet-open');
    setTimeout(() => { sheet.hidden = true; sheetBody.innerHTML = ''; }, 220);
    if (sheetLast && document.contains(sheetLast)) sheetLast.focus({ preventScroll: true });
  }
  sheet.addEventListener('change', ev => {
    if (ev.target.classList.contains('set-kg') || ev.target.classList.contains('set-reps')) saveDraft();
  });
  sheet.addEventListener('click', (ev) => {
    if (ev.target === sheet || ev.target.closest('[data-close]')) { closeSheet(); return; }
    const kb = ev.target.closest('[data-kg]');
    if (kb) {
      const e = sheetEx, st = wStep(e.name, sheetKg + (+kb.dataset.kg > 0 ? 0 : -0.01));
      sheetKg = Math.max(0, Math.round((sheetKg + st * +kb.dataset.kg) * 2) / 2);
      document.getElementById('shKg').textContent = fmtKg(sheetKg);
      // El peso nuevo se aplica a las series que aún no marcas
      sheet.querySelectorAll('.set-row:not(.done) .set-kg').forEach(i => { i.value = sheetKg; });
      refreshKgInfo(); saveDraft(); return;
    }
    const so = ev.target.closest('[data-setok]');
    if (so) {
      const row = so.closest('.set-row'), on = !row.classList.contains('done');
      row.classList.toggle('done', on); so.setAttribute('aria-pressed', on);
      saveDraft();
      if (on) {
        const rows = readRows(), left = rows.filter(r => !r.done).length;
        if (left) startRest(restSecs(sheetEx.rest), `Descanso · serie ${rows.filter(r => r.done).length} de ${rows.length}`);
        else { toast('✓ ¡Todas las series! Guarda para registrar'); startRest(restSecs(sheetEx.rest), 'Descanso · siguiente ejercicio'); const sv = document.getElementById('shSave'); if (sv) sv.focus({ preventScroll: true }); }
      }
      return;
    }
    if (ev.target.closest('[data-restgo]')) { startRest(restSecs(sheetEx.rest), 'Descanso'); return; }
    if (ev.target.closest('#shSave')) {
      const d = buildDay(current), e = d.ex[sheetJ];
      const wl = wCan(e.name, exPattern(e.name));
      let pr = false, kgSaved = sheetKg;
      if (wl) {
        const rows = readRows(), marked = rows.filter(r => r.done), use = (marked.length ? marked : rows).filter(r => r.reps > 0);
        const tgt = repTarget(e.reps), n = nSeries(e.series);
        const sets = use.map(r => ({ kg: r.kg, reps: r.reps }));
        const before = bestOf(e.name);
        kgSaved = sets.length ? Math.max(...sets.map(s => s.kg)) : sheetKg;
        const ok = sets.length >= n && sets.every(s => s.reps >= tgt.hi && s.kg >= kgSaved);
        wSave(e.name, kgSaved, ok, sets);
        const now = bestOf(e.name);
        pr = !!(before && now && now.e > before.e + 0.01);
        delete draft.k[draftKey(e.name)]; store.set('setDraft', draft);
        renderRecords();
      }
      const map = doneMap(dkey(current), d.ex);
      const j = sheetJ;
      sheetEx = null;
      sheet.classList.remove('on'); document.body.classList.remove('sheet-open');
      setTimeout(() => { sheet.hidden = true; sheetBody.innerHTML = ''; }, 220);
      if (!map[e.name]) { const b = panel.querySelector(`.ex-btn[data-j="${j}"]`); if (b) b.click(); }
      else renderDay(current);
      if (wl) setTimeout(() => toast(pr ? `🏆 ¡Nuevo récord en ${e.name}!` : '🏋️ Guardado: ' + fmtKg(kgSaved), pr ? 'level' : ''), pr ? 0 : 900);
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !sheet.hidden) closeSheet(); });
  panel.addEventListener('click', (ev) => { const o = ev.target.closest('[data-open]'); if (o) openSheet(+o.dataset.open); });

  // ---------- Tus récords (pestaña Tú → Avance) ----------
  function renderRecords() {
    const box = document.getElementById('prList'); if (!box) return;
    const all = wlog(), rows = Object.keys(all).map(n => ({ n, b: bestOf(n), c: (all[n] || []).map(sessionBest).filter(v => v > 0).slice(-12), last: (all[n].slice(-1)[0] || {}).d || '' }))
      .filter(r => r.b).sort((a, b) => (a.last < b.last ? 1 : -1));
    document.getElementById('prCount').textContent = rows.length ? rows.length + ' ejercicio' + (rows.length > 1 ? 's' : '') : '';
    box.innerHTML = rows.length ? rows.map(r => `<div class="pr-row"><div><b>${esc(r.n)}</b><small>${kgTxt(r.b.kg)} × ${r.b.reps} · 1RM est. ${kgTxt(r.b.e)}</small></div>${sparkSvg(r.c)}</div>`).join('')
      : '<p class="prog-hint">Aquí verás tu mejor marca de cada ejercicio y cómo va subiendo. Registra tus series en la rutina para empezar.</p>';
  }
  renderRecords();

  // ---------- Tu avance (peso y cintura) ----------
  (function () {
    const tiles = document.getElementById('progTiles'), hint = document.getElementById('progHint');
    const iw = document.getElementById('mW'), ic = document.getElementById('mC');
    let M = store.get('measures') || [];
    function spark(vals) {
      if (vals.length < 2) return '';
      const lo = Math.min(...vals), hi = Math.max(...vals), rg = hi - lo || 1;
      const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 96 + 2},${30 - ((v - lo) / rg) * 26}`).join(' ');
      const lp = pts.split(' ').pop().split(',');
      return `<svg class="spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/><circle cx="${lp[0]}" cy="${lp[1]}" r="2.6"/></svg>`;
    }
    function tile(label, unit, key, icon) {
      const vals = M.filter(m => m[key] > 0).map(m => m[key]);
      if (!vals.length) return `<div class="ptile empty"><i>${icon}</i><b>—</b><span>${label}</span></div>`;
      const last = vals[vals.length - 1], diff = Math.round((last - vals[0]) * 10) / 10;
      const dtxt = vals.length < 2 ? 'Primer registro' : diff === 0 ? 'Igual que al inicio' : (diff > 0 ? '+' : '−') + String(Math.abs(diff)).replace('.', ',') + ' ' + unit + ' desde el inicio';
      return `<div class="ptile"><i>${icon}</i><b>${String(last).replace('.', ',')}<small> ${unit}</small></b><span>${label}</span>${spark(vals.slice(-12))}<em>${dtxt}</em></div>`;
    }
    function render() {
      // Sin registros: solo el formulario (sin casillas vacías que repitan las etiquetas)
      tiles.hidden = !M.length;
      tiles.innerHTML = M.length ? tile('Peso', 'kg', 'w', '⚖️') + tile('Cintura', 'cm', 'c', '📏') : '';
      renderTrend();
      const last = M[M.length - 1];
      const dd = typeof weighDaysTxt === 'function' ? weighDaysTxt() : 'martes, jueves y sábado';
      hint.textContent = (last ? `Último registro: ${fmtD(last.d)}. ` : '') + `Tus días para pesarte: ${dd}, en ayunas. Cada lunes ajustamos tu menú. La cintura, cada 2 semanas.`;
      if (!M.length && profile) { if (profile.weight) iw.placeholder = profile.weight + ' kg'; if (profile.waist) ic.placeholder = profile.waist + ' cm'; }
    }
    document.getElementById('mSave').addEventListener('click', () => {
      const w = parseFloat(iw.value), c = parseFloat(ic.value);
      const ok = (w >= 30 && w <= 250) || (c >= 40 && c <= 200);
      if (!ok) { toast('Escribe tu peso o tu cintura'); (iw.value ? ic : iw).focus(); return; }
      const e = { d: today }; if (w >= 30 && w <= 250) e.w = w; if (c >= 40 && c <= 200) e.c = c;
      const last = M[M.length - 1];
      if (last && last.d === today) Object.assign(last, e); else M.push(e);
      store.set('measures', M); iw.value = ''; ic.value = ''; render(); if (typeof renderMenu === 'function') renderMenu(); toast('📏 Avance guardado');
    });
    function renderTrend() {
      const box = document.getElementById('trendBox'); if (!box) return;
      const thisMon = mondayOf(today), weeks = [];
      for (let i = 9; i >= 0; i--) { const a = weekAvg(thisMon - i * WEEK); if (a) weeks.push([thisMon - i * WEEK, a.avg]); }
      const hist = ((store.get('kcalAdj') || {}).hist || []).filter(e => e.res !== 'datos').slice(-4).reverse();
      if (weeks.length < 2 && !hist.length) { box.hidden = true; return; }
      box.hidden = false;
      const first = weeks[0], lastW = weeks[weeks.length - 1], d = lastW[1] - first[1];
      box.innerHTML = `<h3>📈 Peso promedio por semana</h3>
        ${weeks.length >= 2 ? `<div class="trend-row"><div><b>${String(Math.round(lastW[1] * 10) / 10).replace('.', ',')}<small> kg</small></b><span>${Math.abs(d) < .05 ? 'Igual' : (d < 0 ? '−' : '+') + kgS(d) + ' kg'} en ${weeks.length} semanas</span></div>${sparkSvg(weeks.map(x => x[1]))}</div>` : ''}
        ${hist.length ? `<p class="shop-g">Ajustes de tu menú</p><ul class="trend-list">${hist.map(e => `<li><b>${fmtD(e.w)}</b> · ${e.res === 'ajuste' ? (e.step > 0 ? '+' : '−') + Math.abs(e.step) + ' kcal' : e.res === 'ok' ? 'Sin cambios 👌' : e.res === 'adh' ? 'Sin cambios (semana difícil)' : 'Sin cambios'}</li>`).join('')}</ul>` : ''}
        <p class="sum-note">El peso de un día sube y baja por agua y sal; el promedio de la semana es lo que importa.</p>`;
    }
    document.addEventListener('measures-changed', () => { M = store.get('measures') || []; render(); });
    render();
  })();

  // ---------- Bolso del primer día ----------
  (function () {
    const bag = store.get('bag') || {}, btns = Array.from(document.querySelectorAll('[data-bag]')), cnt = document.getElementById('bagCount');
    function render() { btns.forEach(b => b.setAttribute('aria-pressed', !!bag[b.dataset.bag])); const n = btns.filter(b => bag[b.dataset.bag]).length; cnt.textContent = n === btns.length ? '¡Listo! ✅' : n + '/' + btns.length; }
    btns.forEach(b => b.addEventListener('click', () => { bag[b.dataset.bag] = !bag[b.dataset.bag]; store.set('bag', bag); render(); }));
    render();
  })();

  // ---------- Respaldo del progreso (archivo o texto; todo queda en el teléfono) ----------
  (function backup() {
    const APP = 'mi-guia-gym-hombre', $b = id => document.getElementById(id);
    const KEYS = ['bag','exDone2','feel','foodPrefs','habits','howSeen','lastBackup','lastWeeklyNotif','log','measures','nudgeOff','pins','profile','profileHidden','programStart','remSent','remSettings','rewards','schedule','section','trainMode','weeklyNotif','wlog','xp','xpEarned','myRoutine','setDraft','mealSwap','shopChecked','foodPhase','wakeHour','activity','kcalAdj','foodLog','tourSeen','installLater','installed','sub-tu','sub-tips','sub-consejos','firstOff','weighLater','sub-recomendaciones'];
    const okVal = v => { if (typeof v !== 'string' || v.length > 500000) return false; try { JSON.parse(v); return true; } catch (e) { return false; } };
    let pendingData = null;
    function dump() {
      const data = {};
      try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && KEYS.includes(k)) data[k] = localStorage.getItem(k); } } catch (e) {}
      return { app: APP, v: 1, saved: new Date().toISOString(), data };
    }
    function note() {
      const last = store.get('lastBackup');
      if (!last) { $b('bkNote').textContent = 'Aún no tienes un respaldo.'; return; }
      const d = Math.round((parseISO(today) - parseISO(last)) / 864e5);
      $b('bkNote').textContent = 'Último respaldo: ' + (d <= 0 ? 'hoy' : d === 1 ? 'ayer' : 'hace ' + d + ' días') + (d >= 14 ? '. Es buen momento para hacer otro.' : '.');
    }
    const done = () => { store.set('lastBackup', today); note(); };
    // Dentro de claude.ai la descarga pasa por la capacidad "downloads"; fuera (Netlify), con un enlace normal
    const dlCap = window.claude && typeof window.claude.use === 'function' ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
    $b('bkDown').addEventListener('click', async () => {
      const name = `newen-respaldo-${today}.json`;
      const dl = await dlCap;
      if (dl) {
        try { await dl.save({ filename: name, data: JSON.stringify(dump()) }); done(); toast('💾 Respaldo descargado'); }
        catch (e) { if (!e || e.code !== 'declined') toast('No se pudo descargar: usa la opción de texto'); }
        return;
      }
      try {
        const blob = new Blob([JSON.stringify(dump())], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        done(); toast('💾 Respaldo descargado');
      } catch (e) { toast('No se pudo descargar: usa la opción de texto'); }
    });
    $b('bkCopy').addEventListener('click', async () => {
      const txt = JSON.stringify(dump());
      try { await navigator.clipboard.writeText(txt); done(); toast('📋 Respaldo copiado. Guárdalo en tus notas'); }
      catch (e) { const t = $b('bkText'); t.value = txt; t.focus(); t.select(); done(); toast('Copia el texto del cuadro y guárdalo en tus notas'); }
    });
    function load(text) {
      let o = null;
      try { o = JSON.parse(text); } catch (e) {}
      if (!o || o.app !== APP || !o.data || typeof o.data !== 'object') { toast('Ese archivo no es un respaldo de esta app'); return; }
      pendingData = o.data; pendingData.__saved = o.saved;
      const when = o.saved ? new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(o.saved)) : '';
      $b('bkInfo').textContent = (when ? `Respaldo del ${when}. ` : '') + 'Lo que tienes ahora en este teléfono se reemplaza.';
      $b('bkConfirm').hidden = false; $b('bkYes').focus();
    }
    $b('bkUpBtn').addEventListener('click', () => $b('bkFile').click());
    $b('bkFile').addEventListener('change', ev => {
      const f = ev.target.files && ev.target.files[0]; if (!f) return;
      const r = new FileReader(); r.onload = () => load(String(r.result)); r.readAsText(f); ev.target.value = '';
    });
    $b('bkPaste').addEventListener('click', () => load($b('bkText').value.trim()));
    $b('bkNo').addEventListener('click', () => { pendingData = null; $b('bkConfirm').hidden = true; });
    $b('bkYes').addEventListener('click', () => {
      if (!pendingData) return;
      try {
        const saved = pendingData.__saved; delete pendingData.__saved;
        const keep = { pushSub: localStorage.getItem('pushSub'), pushOn: localStorage.getItem('pushOn') };
        localStorage.clear();
        Object.entries(keep).forEach(([k, v]) => { if (v !== null) localStorage.setItem(k, v); });
        Object.entries(pendingData).forEach(([k, v]) => { if (KEYS.includes(k) && okVal(v)) localStorage.setItem(k, v); });
        if (saved) localStorage.setItem('lastBackup', JSON.stringify(String(saved).slice(0, 10)));
        localStorage.setItem('section', JSON.stringify('inicio'));
      } catch (e) { toast('No se pudo recuperar en este navegador'); return; }
      try { history.replaceState(null, '', '#inicio'); } catch (e) {}
      location.reload();
    });
    note();
  })();

  // ---------- Secciones: solo se ve la que está elegida ----------
  const SECS = ['inicio', 'consejos', 'rutina', 'comidas', 'tu'];
  const GROUPS = { tu: ['perfil', 'avance', 'ajustes'], consejos: ['primer', 'esencial', 'pro'] };
  const TIPS = ['primer', 'esencial', 'pro'];
  const tipsDefault = () => (TIPS.includes(store.get('sub-tips')) ? store.get('sub-tips') : start ? 'esencial' : 'primer');
  // Nombres antiguos (enlaces y datos guardados de la versión anterior)
  const ALIAS = { recomendaciones: tipsDefault, comida: () => 'comidas', habitos: () => { setTimeout(() => { const c = document.getElementById('habitsHome'); if (c) c.scrollIntoView({ block: 'center' }); }, 60); return 'inicio'; } };
  const SUBS = Object.values(GROUPS).flat();
  const groupOf = sub => Object.keys(GROUPS).find(g => GROUPS[g].includes(sub));
  function showSub(sub, group) {
    group = group || groupOf(sub);
    if (!GROUPS[group].includes(sub)) { const st = store.get('sub-' + group); sub = group === 'consejos' ? tipsDefault() : !profile ? 'perfil' : GROUPS[group].includes(st) ? st : 'perfil'; }
    GROUPS[group].forEach(k => {
      const el = document.querySelector(`[data-sub="${k}"]`);
      if (el) el.classList.toggle('sub-off', k !== sub);
      const b = document.querySelector(`[data-sub-go="${k}"]`);
      if (b) b.setAttribute('aria-selected', k === sub);
    });
    const isTip = TIPS.includes(sub);
    const bar = document.getElementById('tipsBar'); if (bar) bar.classList.toggle('sub-off', !isTip);
    const tb = document.querySelector('[data-tips-tab]'); if (tb) tb.setAttribute('aria-selected', isTip);
    const dl = document.querySelector('[data-tips-dolor]'); if (dl) dl.setAttribute('aria-selected', 'false');
    if (isTip) store.set('sub-tips', sub);
    store.set('sub-' + group, sub);
  }
  document.querySelectorAll('[data-sub-go]').forEach(b => b.addEventListener('click', () => showSub(b.dataset.subGo)));
  document.querySelectorAll('[data-tips-tab]').forEach(b => b.addEventListener('click', () => showSub(tipsDefault(), 'tu')));
  document.querySelectorAll('[data-tips-dolor]').forEach(b => b.addEventListener('click', () => {
    showSub('pro', 'consejos'); b.setAttribute('aria-selected', 'true'); document.querySelector('[data-sub-go="pro"]').setAttribute('aria-selected', 'false');
    setTimeout(() => { const d = document.getElementById('dolor'); if (d) d.scrollIntoView({ block: 'start' }); }, 80);
  }));
  const secEls = Array.from(document.querySelectorAll('[data-sec]'));
  const navBtns = Array.from(document.querySelectorAll('.nav-btn'));
  function showSection(name) {
    if (ALIAS[name]) name = ALIAS[name]();
    if (SUBS.includes(name)) { const g = groupOf(name); showSub(name, g); name = g; } else if (GROUPS[name]) showSub(null, name);
    if (!SECS.includes(name)) name = 'inicio';
    secEls.forEach(el => { el.hidden = el.dataset.sec !== name; });
    navBtns.forEach(b => b.setAttribute('aria-current', b.dataset.go === name ? 'page' : 'false'));
    store.set('section', name);
    // La guía "cómo usar la rutina" se muestra solo en la primera visita
    if (name === 'rutina') { const hr = document.getElementById('howRow'); if (hr) hr.hidden = !!store.get('howSeen'); store.set('howSeen', true); }
    try { history.replaceState(null, '', '#' + name); } catch (e) {}
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); }
  }
  navBtns.forEach(b => b.addEventListener('click', () => showSection(b.dataset.go)));
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (SECS.includes(id) || SUBS.includes(id) || ALIAS[id]) { ev.preventDefault(); showSection(id); }
  });
  // ---------- Tu plan: fase, racha y calendario ----------
  // La racha cuenta semanas en que cumples tus días de entrenamiento (descansar no la rompe).
  (function () {
    const DAY = 864e5, WK = 7 * DAY;
    const isoT = t => new Date(t).toISOString().slice(0, 10);
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const dTxt = t => { const x = new Date(t); return x.getUTCDate() + ' ' + MES[x.getUTCMonth()].slice(0, 3); };
    const logNow = () => store.get('log') || {};
    const sessOn = (L, iso) => { const d = L[iso]; return d && d.s ? Object.keys(d.s).length : 0; };
    const habOn = (L, iso) => { const d = L[iso]; return d && d.h ? Object.values(d.h).filter(Boolean).length : 0; };
    const planned = t => SCHEDULES[schedule].days.includes(new Date(t).getUTCDay());
    const week1 = () => mondayOf(start) - skipW() * WK;          // lunes de la semana 1 del plan
    function weekReq(monT) {                                       // días que tocaban esa semana
      const st = parseISO(start); let n = 0;
      for (let i = 0; i < 7; i++) { const t = monT + i * DAY; if (t >= st && planned(t)) n++; }
      return Math.max(1, Math.min(freqOf(), n));
    }
    function stats() {
      const L = logNow(), m0 = mondayOf(start), mNow = mondayOf(today);
      let run = 0, best = 0, total = 0;
      for (let t = m0; t < mNow; t += WK) {
        let n = 0; for (let i = 0; i < 7; i++) n += sessOn(L, isoT(t + i * DAY));
        total += n; if (n >= weekReq(t)) { run++; best = Math.max(best, run); } else run = 0;
      }
      let tw = 0; for (let i = 0; i < 7; i++) tw += sessOn(L, isoT(mNow + i * DAY));
      total += tw;
      const req = weekReq(mNow); let cur = run;
      if (tw >= req) { cur = run + 1; best = Math.max(best, cur); }
      let left = 0; for (let i = 0; i < 7; i++) { const t = mNow + i * DAY, iso = isoT(t); if (iso >= today && planned(t) && !sessOn(L, iso)) left++; }
      return { cur, prev: run, best, total, tw, req, left };
    }
    const phName = k => phs()[k].title.replace(/^Fase \d+:\s*/, '');
    function render() {
      const card = document.getElementById('phaseCard'), first = document.getElementById('firstCard');
      const hs = document.querySelector('.hero-share'); if (hs) hs.hidden = !profile;
      if (!card) return;
      if (!start || !profile) { card.hidden = true; if (first) first.hidden = true; return; }
      const L = logNow(), raw = weeksRaw(), wk = autoWeek(), ph = phaseOf(wk), mine = progOf() === 'mine';
      const S = stats(), mNow = mondayOf(today);
      // Solo hasta el primer entrenamiento, y se puede ocultar
      if (first) first.hidden = !(progOf() === 'base' && !skipW() && S.total === 0 && !store.get('firstOff'));
      const sub0 = notYet() ? `Empiezas el ${dTxt(parseISO(start))} 💪`
        : raw > 12 ? 'Completaste tus 12 semanas 🎉'
        : mine ? `Semana ${wk} de 12`
        : ph < 2 && wk % 4 === 0 ? `Semana ${wk} de 12 · el lunes empiezas la Fase ${ph + 2} 💪`
        : ph < 2 ? `Semana ${wk} de 12 · en ${4 - (wk - 1) % 4} semanas empiezas la Fase ${ph + 2}`
        : `Semana ${wk} de 12 · la última fase`;
      const days = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((dl, i) => {
        const t = mNow + i * DAY, iso = isoT(t), pre = iso < start;
        const cls = sessOn(L, iso) ? 'd' : iso === today ? 't' : pre || !planned(t) ? '' : iso > today ? 'p' : '';
        return `<i class="${cls}">${cls === 'd' ? '✓' : dl}</i>`;
      }).join('');
      const need = S.req - S.tw;
      const msg = notYet() ? 'Empiezas pronto 💪' : need <= 0 ? '¡Semana cumplida! 🔥' : `${S.tw} de ${S.req} esta semana`;
      card.hidden = false;
      card.innerHTML = `<span class="tk">${mine ? 'Tu rutina' : `Fase ${ph + 1} · Semana ${wk}`}</span>
        <div class="tfl${S.cur ? '' : ' off'}"><b>🔥 ${S.cur}</b><span>semana${S.cur === 1 ? '' : 's'}<br>en racha</span></div>
        <div class="wk7" aria-label="Esta semana">${days}</div>
        <p class="tp">${msg}</p>
        <button type="button" class="tgo" data-cal>Calendario ›</button>`;
    }
    // Calendario del mes
    let calM = null;
    const sheet = document.getElementById('calSheet');
    function renderCal() {
      const L = logNow(), S = stats();
      const y = calM[0], mo = calM[1], firstT = Date.UTC(y, mo, 1), lead = (new Date(firstT).getUTCDay() + 6) % 7;
      const nDays = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
      const endT = week1() + 12 * WK, stT = parseISO(start);
      let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<div class="hd">${x}</div>`).join('');
      for (let i = 0; i < lead; i++) cells += '<div class="c out"></div>';
      for (let d = 1; d <= nDays; d++) {
        const t = Date.UTC(y, mo, d), iso = isoT(t), ns = sessOn(L, iso), nh = habOn(L, iso);
        let cls = 'c';
        if (ns) cls += ' done'; else if (iso >= today && t >= stT && t < endT && planned(t)) cls += ' plan'; else if (t < stT) cls += ' pre';
        if (iso === today) cls += ' today';
        cells += `<div class="${cls}">${d}${!ns && nh ? `<u>${'<i></i>'.repeat(Math.min(3, nh))}</u>` : ''}</div>`;
      }
      const w1 = week1(), wk = autoWeek(), ph = phaseOf(wk), mine = progOf() === 'mine';
      const phases = mine ? '' : [0, 1, 2].map(k => { const a = w1 + k * 4 * WK, b = a + 4 * WK - DAY; return `<div class="${k === ph ? 'on' : ''}"><em>${k + 1}</em><span><b>${phName(k)}</b><small>${dTxt(a)} – ${dTxt(b)}${k === ph && !notYet() ? ' · estás aquí' : ''}</small></span></div>`; }).join('');
      const minM = new Date(stT), maxM = new Date(endT);
      const canPrev = y * 12 + mo > minM.getUTCFullYear() * 12 + minM.getUTCMonth(), canNext = y * 12 + mo < maxM.getUTCFullYear() * 12 + maxM.getUTCMonth();
      document.getElementById('calBody').innerHTML = `<div class="cal-m"><button type="button" data-calm="-1" aria-label="Mes anterior"${canPrev ? '' : ' disabled'}>‹</button><b>${MES[mo]} ${y}</b><button type="button" data-calm="1" aria-label="Mes siguiente"${canNext ? '' : ' disabled'}>›</button></div>
        <div class="cal-g">${cells}</div>
        <div class="cal-leg"><span><i style="background:var(--accent)"></i>Entrenaste</span><span><i style="border:1.5px dashed var(--accent)"></i>Toca entrenar</span><span><i style="background:#38BDF8;border-radius:50%;width:8px;height:8px"></i>Hábitos cumplidos</span></div>
        ${phases ? `<div class="cal-ph">${phases}</div>` : ''}
        <div class="cal-st"><div><b>🔥 ${S.cur}</b>semanas en racha</div><div><b>${S.total}</b>sesiones hechas</div><div><b>${S.best}</b>mejor racha</div></div>
        <p class="sum-note" style="text-align:center;margin-top:10px">La racha cuenta semanas en que cumples tus días. Descansar no la rompe.</p>`;
    }
    function openCal() {
      if (!start) return;
      const t = new Date(parseISO(today)); calM = [t.getUTCFullYear(), t.getUTCMonth()];
      renderCal(); sheet.hidden = false; document.body.classList.add('sheet-open'); requestAnimationFrame(() => sheet.classList.add('on'));
    }
    function closeCal() { sheet.classList.remove('on'); document.body.classList.remove('sheet-open'); setTimeout(() => { sheet.hidden = true; }, 220); }
    sheet.addEventListener('click', ev => {
      if (ev.target === sheet || ev.target.closest('[data-close]')) { closeCal(); return; }
      const b = ev.target.closest('[data-calm]'); if (b && !b.disabled) { const v = calM[0] * 12 + calM[1] + +b.dataset.calm; calM = [Math.floor(v / 12), v % 12]; renderCal(); }
    });
    document.addEventListener('click', ev => {
      if (ev.target.closest('[data-cal]')) openCal();
      if (ev.target.closest('[data-firstoff]')) { store.set('firstOff', true); render(); toast('Listo, ya no la mostramos. Está en 💡 Consejos → 1.er día'); }
    });
    window.__plan = render;
    window.__planStats = () => (start && profile ? Object.assign(stats(), { wk: autoWeek(), ph: phaseOf(autoWeek()), phName: phName(phaseOf(autoWeek())), mine: progOf() === 'mine' }) : null);
    render();
    // Se actualiza cuando cambia el registro (sesiones, hábitos) o el perfil
    const _set = store.set;
    store.set = function (k, v) { const r = _set.apply(this, arguments); if (k === 'log' || k === 'profile' || k === 'programStart' || k === 'schedule') setTimeout(render, 0); return r; };
  })();

  // ---------- Tu nivel: chapitas y recompensas en una hoja ----------
  (function () {
    const sh = document.getElementById('levelSheet'); if (!sh) return;
    function open() {
      const pct = document.getElementById('xpFill').style.width || '0%';
      document.getElementById('lvSum').innerHTML = `<span class="lv-b" aria-hidden="true">${esc(document.getElementById('levelBadge').textContent)}</span><div style="flex:1;min-width:0"><small>${esc(document.getElementById('levelNum').textContent)}</small><b>${esc(document.getElementById('levelName').textContent)}</b><div class="xp-bar"><i style="width:${esc(pct)}"></i></div><p>${esc(document.getElementById('xpText').textContent)} · ${esc(document.getElementById('xpBar').title || '')}</p></div>`;
      sh.hidden = false; document.body.classList.add('sheet-open'); requestAnimationFrame(() => sh.classList.add('on'));
    }
    function close() { sh.classList.remove('on'); document.body.classList.remove('sheet-open'); setTimeout(() => { sh.hidden = true; }, 220); }
    sh.addEventListener('click', ev => { if (ev.target === sh || ev.target.closest('[data-close]')) close(); });
    document.addEventListener('click', ev => { if (ev.target.closest('[data-level]')) open(); });
    document.addEventListener('keydown', ev => { if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest && ev.target.closest('[data-level]')) { ev.preventDefault(); open(); } if (ev.key === 'Escape' && !sh.hidden) close(); });
  })();

  // ---------- Gráficos (Tú → Avance) ----------
  // Una serie por gráfico, color verde de la app; toca una barra o un punto para ver el valor.
  window.__charts = (function () {
    const DAY = 864e5, WK = 7 * DAY, isoT = t => new Date(t).toISOString().slice(0, 10);
    const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const dShort = t => { const x = new Date(t); return x.getUTCDate() + ' ' + MES[x.getUTCMonth()]; };
    const nf = (v, d = 1) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
    let tab = 'sesiones', exSel = '', example = false;
    // ----- Datos -----
    function weeksRange() {
      const end = mondayOf(today), first = start ? mondayOf(start) : end - 7 * WK;
      const from = Math.max(first, end - 11 * WK), out = [];
      for (let t = from; t <= end; t += WK) out.push(t);
      return out;
    }
    function real() {
      const L = store.get('log') || {}, W = store.get('wlog') || {}, weeks = weeksRange();
      const sum = (t, f) => { let n = 0; for (let i = 0; i < 7; i++) { const d = L[isoT(t + i * DAY)]; if (d) n += f(d); } return n; };
      const ses = weeks.map(t => sum(t, d => Object.keys(d.s || {}).length));
      const hab = weeks.map(t => sum(t, d => Object.values(d.h || {}).filter(Boolean).length));
      const pes = weeks.map(t => { const a = weekAvg(t); return a ? a.avg : null; });
      const lifts = {};
      Object.keys(W).forEach(n => (W[n] || []).forEach(x => { let b = 0; (x.sets || []).forEach(st => { const kg = +st.kg, r = +st.reps; if (kg > 0 && r > 0) b = Math.max(b, kg * (1 + r / 30)); }); if (b && x.d) (lifts[n] = lifts[n] || []).push([parseISO(x.d), b]); }));
      Object.values(lifts).forEach(a => a.sort((p, q) => p[0] - q[0]));
      return { weeks, ses, hab, pes, lifts, freq: freqOf() };
    }
    function demo() {
      const end = mondayOf(today), weeks = Array.from({ length: 10 }, (_, k) => end - (9 - k) * WK);
      const ses = [2, 3, 3, 2, 3, 3, 3, 1, 3, 2], hab = [8, 11, 13, 9, 14, 15, 16, 10, 17, 9];
      const pes = [82.4, 82.1, 81.7, 81.6, 81.2, 80.8, 80.6, 80.7, 80.2, 79.9];
      const mk = (base, step) => weeks.flatMap((t, k) => [[t, base + k * step], [t + 2 * DAY, base + k * step + step / 2]]);
      return { weeks, ses, hab, pes, freq: 3, lifts: { 'Press de banca con barra': mk(62, 1.6), 'Sentadilla con barra': mk(78, 2.2), 'Remo con barra': mk(55, 1.2) } };
    }
    // ----- SVG -----
    const W0 = 320, H0 = 170, PL = 26, PR = 8, PT = 14, PB = 22;
    function scale(vals, zero) {
      const v = vals.filter(x => x != null); let lo = zero ? 0 : Math.min(...v), hi = Math.max(...v);
      if (!zero) { const pad = (hi - lo) * .2 || 1; lo -= pad; hi += pad; }
      if (hi === lo) hi = lo + 1;
      return { lo, hi, y: x => PT + (H0 - PT - PB) * (1 - (x - lo) / (hi - lo)) };
    }
    function grid(sc, fmt, ticks) {
      return (ticks || [0, .5, 1].map(f => sc.lo + (sc.hi - sc.lo) * f)).map(v => { const y = sc.y(v); return `<line class="gl" x1="${PL}" x2="${W0 - PR}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="ax" x="${PL - 4}" y="${(y + 3).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`; }).join('');
    }
    function bars(vals, labels, o) {
      const sc = scale(vals.concat(o.target || 0), true), n = vals.length, bw = (W0 - PL - PR) / n, w = Math.min(22, bw - 4);
      const top = Math.ceil(sc.hi), mid = Math.round(top / 2);
      let g = grid(sc, v => Math.round(v), mid > 0 && mid < top ? [0, mid, top] : [0, top]);
      vals.forEach((v, i) => {
        const x = PL + i * bw + (bw - w) / 2, y = sc.y(v), hgt = Math.max(0, H0 - PB - y), r = Math.min(4, hgt / 2);
        const cls = 'bar' + (i === n - 1 ? ' cur' : o.target && v < o.target ? ' low' : '');
        g += hgt > 0 ? `<path class="${cls}" d="M${x},${H0 - PB} v${-(hgt - r)} q0,${-r} ${r},${-r} h${w - 2 * r} q${r},0 ${r},${r} v${hgt - r} z"/>` : '';
        if (n <= 12 && (i % (n > 8 ? 2 : 1) === 0 || i === n - 1)) g += `<text class="ax" x="${(x + w / 2).toFixed(1)}" y="${H0 - 6}" text-anchor="middle">${labels[i]}</text>`;
        g += `<rect class="hit" x="${(PL + i * bw).toFixed(1)}" y="${PT}" width="${bw.toFixed(1)}" height="${H0 - PT - PB}" data-i="${i}"/>`;
      });
      if (o.target) { const y = sc.y(o.target); g += `<line class="tgt" x1="${PL}" x2="${W0 - PR}" y1="${y}" y2="${y}"/><text class="tgt-l" x="${W0 - PR}" y="${y - 4}" text-anchor="end">meta ${o.target}</text>`; }
      return `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${o.aria}">${g}</svg>`;
    }
    function line(pts, o) {
      const ys = pts.map(p => p[1]), sc = scale(ys, false), n = pts.length;
      const x = i => PL + (n === 1 ? (W0 - PL - PR) / 2 : (W0 - PL - PR) * i / (n - 1));
      let g = grid(sc, o.fmt);
      const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${sc.y(p[1]).toFixed(1)}`).join(' ');
      if (n > 1) g += `<path class="ar" d="${path} L${x(n - 1).toFixed(1)},${H0 - PB} L${x(0).toFixed(1)},${H0 - PB} Z"/><path class="ln" d="${path}"/>`;
      const step = Math.max(1, Math.ceil(n / 5));
      pts.forEach((p, i) => {
        if (i === 0 || i === n - 1 || n <= 8) g += `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${sc.y(p[1]).toFixed(1)}" r="4"/>`;
        if (i % step === 0 || i === n - 1) g += `<text class="ax" x="${x(i).toFixed(1)}" y="${H0 - 6}" text-anchor="middle">${p[2]}</text>`;
        const hw = (W0 - PL - PR) / Math.max(1, n - 1);
        g += `<rect class="hit" x="${(x(i) - hw / 2).toFixed(1)}" y="${PT}" width="${hw.toFixed(1)}" height="${H0 - PT - PB}" data-i="${i}"/>`;
      });
      return `<svg viewBox="0 0 ${W0} ${H0}" role="img" aria-label="${o.aria}">${g}</svg>`;
    }
    // ----- Pestañas -----
    const TABS = [['sesiones', '🏋️ Sesiones'], ['peso', '⚖️ Peso'], ['fuerza', '💪 Fuerza'], ['habitos', '💧 Hábitos']];
    function model() {
      const R = example ? demo() : real();
      const wl = R.weeks.map((t, i) => 'S' + (start && !example ? Math.round((t - mondayOf(start)) / WK) + 1 + skipW() : i + 1));
      if (tab === 'sesiones') {
        if (!R.ses.some(Boolean)) return null;
        const ok = R.ses.slice(0, -1).filter(v => v >= R.freq).length;
        return { svg: bars(R.ses, wl, { target: R.freq, aria: 'Sesiones por semana' }), tip: i => `<b>${wl[i]}</b> (${dShort(R.weeks[i])}): ${R.ses[i]} de ${R.freq} sesiones`, cap: `Sesiones por semana · meta ${R.freq}`, note: `Cumpliste tu meta en ${ok} de ${R.ses.length - 1} semanas. La barra más clara es esta semana.` };
      }
      if (tab === 'habitos') {
        if (!R.hab.some(Boolean)) return null;
        return { svg: bars(R.hab, wl, { target: 21, aria: 'Hábitos cumplidos por semana' }), tip: i => `<b>${wl[i]}</b>: ${R.hab[i]} de 21 hábitos (agua, sueño y proteína)`, cap: 'Hábitos cumplidos por semana · máximo 21', note: 'Cada día suma hasta 3: agua, sueño y proteína.' };
      }
      const remind = example ? '' : (() => { const n = weighIns(mondayOf(today)).length; return `<span class="ch-rem">⚖️ Recuerda anotar tu peso 2 o 3 veces por semana (tus días: ${weighDaysTxt()}) para que el gráfico sea más preciso. ${n ? `Esta semana llevas ${n}.` : 'Esta semana aún no te pesas.'} <button type="button" class="reset" data-chweigh>Anotar ahora</button></span>`; })();
      if (tab === 'peso') {
        const pts = R.weeks.map((t, i) => [t, R.pes[i], wl[i]]).filter(p => p[1] != null);
        if (pts.length < 2) return { empty: 'Pésate 2 o 3 veces por semana y verás tu peso promedio semana a semana.', rem: remind };
        const d = pts[pts.length - 1][1] - pts[0][1];
        return { svg: line(pts, { fmt: v => nf(v), aria: 'Peso promedio por semana' }), tip: i => `<b>${pts[i][2]}</b>: ${nf(pts[i][1])} kg promedio`, cap: 'Peso promedio por semana (kg)', note: `${Math.abs(d) < .05 ? 'Sin cambios' : (d < 0 ? 'Bajaste ' : 'Subiste ') + nf(Math.abs(d)) + ' kg'} desde ${pts[0][2]}. Se usa el promedio porque el peso de un día varía por agua y sal.`, rem: remind };
      }
      const names = Object.keys(R.lifts).sort((a, b) => R.lifts[b].length - R.lifts[a].length).slice(0, 4);
      if (!names.length) return { empty: 'Anota el peso de tus series en la rutina y aquí verás cómo sube tu fuerza.' };
      if (!names.includes(exSel)) exSel = names[0];
      const pts = R.lifts[exSel].map(p => [p[0], p[1], dShort(p[0])]);
      if (pts.length < 2) return { empty: `Con 2 sesiones de ${exSel.toLowerCase()} anotadas aparece tu gráfico.`, names };
      const g = (pts[pts.length - 1][1] / pts[0][1] - 1) * 100;
      return { names, svg: line(pts, { fmt: v => Math.round(v), aria: 'Fuerza estimada en ' + exSel }), tip: i => `<b>${pts[i][2]}</b>: ${nf(pts[i][1])} kg (1RM estimado)`, cap: `${exSel} · fuerza estimada (kg)`, note: `${g >= 0 ? '+' : ''}${nf(g, 0)} % desde tu primera sesión. El 1RM estimado combina peso y repeticiones, así se puede comparar aunque cambies las reps.`, rem: example ? '' : '<span class="ch-rem">🏋️ Recuerda anotar el peso de cada serie en tu rutina para que el gráfico sea más preciso.</span>' };
    }
    function render() {
      const box = document.getElementById('chBox'); if (!box) return;
      const has = !!((store.get('log') && Object.keys(store.get('log')).length) || store.get('wlog'));
      document.getElementById('chTabs').innerHTML = TABS.map(([k, t]) => `<button type="button" role="tab" data-chtab="${k}" aria-pressed="${k === tab}">${t}</button>`).join('');
      document.getElementById('chEx').hidden = !example;
      const M = model();
      const ex2 = document.getElementById('chEx2');
      const short = n => { const w = n.split(' '); return w[1] === 'de' && w[2] ? w.slice(0, 3).join(' ') : w[0]; };
      ex2.innerHTML = M && M.names && M.names.length > 1 ? M.names.map(n => `<button type="button" data-chex="${esc(n)}" aria-pressed="${n === exSel}">${esc(short(n))}</button>`).join('') : '';
      if (!M || M.empty) {
        document.getElementById('chCap').textContent = '';
        box.innerHTML = `<div class="ch-empty">${M && M.empty ? M.empty : 'Todavía no hay datos para este gráfico.'}${example ? '' : '<br><button type="button" class="reset" data-chdemo style="margin-top:8px">Ver con datos de ejemplo</button>'}</div>`;
        document.getElementById('chNote').innerHTML = (M && M.rem) || '';
        render.tip = null; return;
      }
      document.getElementById('chCap').innerHTML = M.cap;
      box.innerHTML = M.svg;
      document.getElementById('chNote').innerHTML = M.note + (example ? ' <button type="button" class="reset" data-chdemo>Volver a mis datos</button>' : '') + (M.rem || '');
      render.tip = M.tip; render.cap = M.cap;
    }
    document.addEventListener('click', ev => {
      const t = ev.target.closest('[data-chtab]'); if (t) { tab = t.dataset.chtab; render(); return; }
      const e = ev.target.closest('[data-chex]'); if (e) { exSel = e.dataset.chex; render(); return; }
      if (ev.target.closest('[data-chdemo]')) { example = !example; render(); return; }
      if (ev.target.closest('[data-chweigh]')) { const i = document.getElementById('mW'); if (i) { i.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => i.focus({ preventScroll: true }), 350); } return; }
      const hbx = ev.target.closest('#chBox .hit');
      if (hbx && render.tip) {
        document.querySelectorAll('#chBox .sel').forEach(x => x.remove());
        const r = document.createElementNS('http://www.w3.org/2000/svg', 'line'), cx = +hbx.getAttribute('x') + +hbx.getAttribute('width') / 2;
        r.setAttribute('class', 'sel'); r.setAttribute('x1', cx); r.setAttribute('x2', cx); r.setAttribute('y1', PT); r.setAttribute('y2', H0 - PB);
        hbx.parentNode.insertBefore(r, hbx);
        document.getElementById('chCap').innerHTML = render.tip(+hbx.dataset.i);
      }
    });
    document.addEventListener('mouseover', ev => { const hbx = ev.target.closest && ev.target.closest('#chBox .hit'); if (hbx && render.tip) document.getElementById('chCap').innerHTML = render.tip(+hbx.dataset.i); });
    document.addEventListener('mouseout', ev => { if (ev.target.closest && ev.target.closest('#chBox svg') && !ev.relatedTarget?.closest?.('#chBox svg') && render.cap) document.getElementById('chCap').innerHTML = render.cap; });
    document.addEventListener('click', ev => { if (ev.target.closest('[data-sub-go="avance"], [data-go="tu"]')) setTimeout(render, 30); });
    const _set = store.set;
    store.set = function (k) { const r = _set.apply(this, arguments); if (k === 'log' || k === 'measures' || k === 'wlog') setTimeout(render, 0); return r; };
    render();
    return { real, demo, render };
  })();

  // ---------- Instalar en la pantalla de inicio ----------
  // Enlaces opcionales a videos (YouTube no listado). Si están vacíos, no se muestran.
  const VIDEOS = { install_ios: '', install_android: '', tour: '' };
  const isStandalone = () => !!(window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  const osNow = () => (/iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'ios');
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; const b = document.getElementById('installNative'); if (b) b.hidden = false; });
  window.addEventListener('appinstalled', () => { store.set('installed', true); renderInstallCard(); toast('📲 ¡App instalada!', 'level'); });
  function renderInstallCard() {
    const c = document.getElementById('installCard'); if (!c) return;
    const later = store.get('installLater');
    c.hidden = isStandalone() || !!store.get('installed') || !!(later && Date.now() - later < 7 * 864e5);
    document.getElementById('installWhy').textContent = osNow() === 'ios' ? 'En iPhone es necesario para recibir avisos. Toma 30 segundos.' : 'Se abre como app, a pantalla completa y más rápido.';
  }
  const instSheet = document.getElementById('installSheet');
  function setOS(os) {
    instSheet.querySelectorAll('[data-os]').forEach(b => b.setAttribute('aria-selected', b.dataset.os === os));
    instSheet.querySelectorAll('[data-for]').forEach(el => { el.hidden = el.dataset.for !== os; });
    const v = VIDEOS['install_' + os];
    document.getElementById('vidInstall').innerHTML = v ? `<a class="btn btn-ghost btn-block" href="${esc(v)}" target="_blank" rel="noopener">🎬 Ver el video (1 minuto)</a>` : '';
  }
  function openInstall() {
    setOS(osNow());
    document.getElementById('installNative').hidden = !deferredInstall;
    instSheet.hidden = false; document.body.classList.add('sheet-open');
    requestAnimationFrame(() => instSheet.classList.add('on'));
  }
  function closeInstall() { instSheet.classList.remove('on'); document.body.classList.remove('sheet-open'); setTimeout(() => { instSheet.hidden = true; }, 220); }
  instSheet.addEventListener('click', ev => {
    if (ev.target === instSheet || ev.target.closest('[data-close]')) { closeInstall(); return; }
    const o = ev.target.closest('[data-os]'); if (o) { setOS(o.dataset.os); return; }
    if (ev.target.closest('#installNative') && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; closeInstall(); }); }
  });
  document.addEventListener('click', ev => {
    if (ev.target.closest('[data-install]')) { openInstall(); return; }
    if (ev.target.closest('#installLater')) { store.set('installLater', Date.now()); renderInstallCard(); toast('Te lo recordamos en una semana'); }
  });
  renderInstallCard();

  // ---------- Guía de bienvenida (la primera vez) ----------
  const TOUR = [
    { big: '👋', t: 'Bienvenido a Newen', p: 'Tu plan de gym en el bolsillo: rutina, comidas, hábitos y avisos. Todo se guarda en tu teléfono.' },
    { big: '🏋️', t: 'Tu rutina', p: 'Toca un ejercicio para ver cómo se hace. Anota el peso y las reps de cada serie y toca ✓: el descanso parte solo.',
      demo: '<div class="set-row done"><span class="set-n">1</span><span class="set-in"><input value="60" readonly tabindex="-1" aria-label="Peso"><small>kg</small></span><span class="set-x">×</span><span class="set-in"><input value="10" readonly tabindex="-1" aria-label="Reps"><small>reps</small></span><span class="set-ok" aria-pressed="true" style="display:grid;place-items:center">✓</span></div>' },
    { big: '🍽️', t: 'Tu menú', p: 'Porciones medidas con tu mano, según si estás en déficit o en volumen. Con horarios y lista de compras.',
      demo: '<div class="demo-hands"><div><b>✋</b>Proteína</div><div><b>🤲</b>Carbos</div><div><b>✊</b>Verduras</div><div><b>👍</b>Grasas</div></div>' },
    { big: '💧', t: 'Hábitos y avisos', p: 'Marca agua, sueño y proteína cada día. Activa los avisos en Tú → ⚙️ Ajustes y te recordamos entrenar.',
      demo: '<div class="demo-habit"><i>✓</i>Tomar 2,5 a 3 litros de agua</div><div class="demo-habit"><i>✓</i>Dormir de 7 a 8 horas</div>' },
    { big: '📲', t: 'Instálala', p: 'Agrégala a tu pantalla de inicio para usarla como app. En iPhone es necesario para recibir los avisos.', last: true }
  ];
  let tourI = 0;
  const tourEl = document.getElementById('tour');
  function renderTour() {
    const s = TOUR[tourI];
    document.getElementById('tourSlides').innerHTML = `<div class="tour-slide"><div class="big" aria-hidden="true">${s.big}</div><h3 id="tourTitle">${s.t}</h3><p>${s.p}</p>${s.demo ? `<div class="tour-demo">${s.demo}</div>` : ''}${s.last && VIDEOS.tour ? `<a class="btn btn-ghost btn-block" style="margin-top:14px" href="${esc(VIDEOS.tour)}" target="_blank" rel="noopener">🎬 Ver video de la app</a>` : ''}</div>`;
    document.getElementById('tourDots').innerHTML = TOUR.map((_, k) => `<i class="${k === tourI ? 'on' : ''}"></i>`).join('');
    const prev = tourEl.querySelector('[data-tour="prev"]'), next = tourEl.querySelector('[data-tour="next"]');
    prev.style.visibility = tourI ? 'visible' : 'hidden';
    next.textContent = s.last ? (isStandalone() ? '¡Empezar!' : '📲 Cómo instalar') : 'Siguiente';
  }
  function openTour() { tourI = 0; renderTour(); tourEl.hidden = false; document.body.classList.add('sheet-open'); }
  function closeTour() { tourEl.hidden = true; document.body.classList.remove('sheet-open'); store.set('tourSeen', true); }
  tourEl.addEventListener('click', ev => {
    const b = ev.target.closest('[data-tour]'); if (!b) return;
    const a = b.dataset.tour;
    if (a === 'skip') closeTour();
    else if (a === 'prev') { tourI = Math.max(0, tourI - 1); renderTour(); }
    else if (a === 'next') { if (TOUR[tourI].last) { closeTour(); if (!isStandalone()) openInstall(); } else { tourI++; renderTour(); } }
  });
  document.addEventListener('click', ev => { if (ev.target.closest('[data-tour="open"]')) openTour(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') { if (!tourEl.hidden) closeTour(); if (!instSheet.hidden) closeInstall(); } });
  if (!store.get('tourSeen')) setTimeout(openTour, 400);

  showSection((location.hash || '').slice(1) || store.get('section') || 'inicio');

  // Si cambia el día (medianoche en su zona horaria), se actualiza solo.
  const checkDay = () => { if (localISO() !== today) location.reload(); };
  setInterval(checkDay, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
})();
