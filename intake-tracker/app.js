'use strict';
const KEY = 'intake.v1';
const ML_PER_OZ = 29.5735;
const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  units: 'oz', goalWaterMl: 2840, goalCal: 2000, goalPro: 120,
  remindOn: false, remStart: '09:00', remEnd: '21:00', remEvery: 90,
};

let state = load();
let viewDate = dayKey(new Date());

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return { settings: { ...DEFAULTS, ...s.settings }, days: s.days || {}, recents: s.recents || [] };
  } catch (e) {}
  return { settings: { ...DEFAULTS }, days: {}, recents: [] };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

function dayKey(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function day(k) { return state.days[k] || (state.days[k] = { water: [], food: [] }); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const isOz = () => state.settings.units === 'oz';
const toDisp = (ml) => isOz() ? Math.round(ml / ML_PER_OZ) : Math.round(ml);
const fromDisp = (v) => isOz() ? v * ML_PER_OZ : v;
const unit = () => state.settings.units;

function totals(k) {
  const d = state.days[k] || { water: [], food: [] };
  return {
    water: d.water.reduce((a, w) => a + w.ml, 0),
    cal: d.food.reduce((a, f) => a + f.cal, 0),
    pro: d.food.reduce((a, f) => a + f.pro, 0),
  };
}

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1800);
}

function setBar(id, val, goal) {
  const el = $(id); const pct = Math.min(100, goal ? (val / goal) * 100 : 0);
  el.style.width = pct + '%'; el.classList.toggle('done', goal > 0 && val >= goal);
}

function render() {
  const s = state.settings, t = totals(viewDate);
  const today = dayKey(new Date());
  const d = parseKey(viewDate);
  $('dateLabel').textContent = viewDate === today ? 'Today' :
    d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  $('next').style.visibility = viewDate >= today ? 'hidden' : 'visible';

  $('waterVal').innerHTML = `${toDisp(t.water)} <small>/ ${toDisp(s.goalWaterMl)} ${unit()}</small>`;
  $('calVal').innerHTML = `${Math.round(t.cal)} <small>/ ${s.goalCal} kcal</small>`;
  $('proVal').innerHTML = `${Math.round(t.pro)} <small>/ ${s.goalPro} g</small>`;
  setBar('waterBar', t.water, s.goalWaterMl); setBar('calBar', t.cal, s.goalCal); setBar('proBar', t.pro, s.goalPro);

  const amounts = isOz() ? [8, 12, 16, 24] : [250, 350, 500, 750];
  $('waterQuick').innerHTML = amounts.map((a) => `<button data-a="${a}">+${a}</button>`).join('') +
    `<button data-a="custom" style="grid-column:span 4">Custom amount…</button>`;

  $('recents').innerHTML = state.recents.slice(0, 8).map((r, i) =>
    `<button data-i="${i}">${esc(r.name || 'Food')} · ${r.cal}c · ${r.pro}g</button>`).join('');

  const dd = day(viewDate);
  const items = [
    ...dd.water.map((w) => ({ ...w, kind: 'water' })),
    ...dd.food.map((f) => ({ ...f, kind: 'food' })),
  ].sort((a, b) => b.t - a.t);
  $('empty').style.display = items.length ? 'none' : 'block';
  $('log').innerHTML = items.map((i) => {
    const time = new Date(i.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const body = i.kind === 'water'
      ? `💧 ${toDisp(i.ml)} ${unit()}`
      : `${esc(i.name || 'Food')}<small>${i.cal} kcal · ${i.pro} g protein</small>`;
    return `<li><span class="t">${time}</span><span class="d">${body}</span><button data-del="${i.kind}:${i.id}" aria-label="Delete">✕</button></li>`;
  }).join('');

  let h = '';
  for (let n = 0; n < 7; n++) {
    const dt = new Date(); dt.setDate(dt.getDate() - n);
    const k = dayKey(dt), x = totals(k);
    const w = x.water >= s.goalWaterMl ? 'ok' : '';
    h += `<div class="hrow"><b>${dt.toLocaleDateString(undefined, { weekday: 'short' })}</b>` +
      `<span class="${w}">💧 ${toDisp(x.water)}</span><span>🔥 ${Math.round(x.cal)}</span><span>🥩 ${Math.round(x.pro)}g</span></div>`;
  }
  $('history').innerHTML = h;
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function stamp() {
  // Log entries on past days are stamped at noon of that day.
  const now = new Date();
  if (viewDate === dayKey(now)) return now.getTime();
  const d = parseKey(viewDate); d.setHours(12, 0, 0, 0); return d.getTime();
}

function addWater(amountDisp) {
  const ml = Math.round(fromDisp(amountDisp));
  day(viewDate).water.push({ id: uid(), t: stamp(), ml });
  save(); render(); toast(`+${amountDisp} ${unit()} water`); syncPush();
}

$('waterQuick').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.a === 'custom') {
    const v = parseFloat(prompt(`Amount in ${unit()}`));
    if (v > 0) addWater(v);
  } else addWater(Number(b.dataset.a));
});

$('foodForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const cal = parseFloat($('foodCal').value) || 0, pro = parseFloat($('foodPro').value) || 0;
  const name = $('foodName').value.trim();
  if (!cal && !pro) { toast('Enter calories or protein'); return; }
  day(viewDate).food.push({ id: uid(), t: stamp(), name, cal, pro });
  state.recents = [{ name, cal, pro }, ...state.recents.filter((r) => !(r.name === name && r.cal === cal && r.pro === pro))].slice(0, 20);
  save(); e.target.reset(); render(); toast('Food added');
});

$('recents').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const r = state.recents[Number(b.dataset.i)];
  day(viewDate).food.push({ id: uid(), t: stamp(), ...r });
  save(); render(); toast('Food added');
});

$('log').addEventListener('click', (e) => {
  const b = e.target.closest('[data-del]'); if (!b) return;
  const [kind, id] = b.dataset.del.split(':'), dd = day(viewDate);
  if (kind === 'water') dd.water = dd.water.filter((x) => x.id !== id);
  else dd.food = dd.food.filter((x) => x.id !== id);
  save(); render(); syncPush();
});

$('prev').onclick = () => { const d = parseKey(viewDate); d.setDate(d.getDate() - 1); viewDate = dayKey(d); render(); };
$('next').onclick = () => { const d = parseKey(viewDate); d.setDate(d.getDate() + 1); viewDate = dayKey(d); render(); };

// ---------- Settings ----------
const dlg = $('settings');
function fillSettings() {
  const s = state.settings;
  $('units').value = s.units;
  document.querySelectorAll('.u').forEach((el) => (el.textContent = s.units));
  $('goalWater').value = toDisp(s.goalWaterMl);
  $('goalCal').value = s.goalCal; $('goalPro').value = s.goalPro;
  $('remindOn').checked = s.remindOn; $('remStart').value = s.remStart;
  $('remEnd').value = s.remEnd; $('remEvery').value = String(s.remEvery);
  updateHint();
}
$('openSettings').onclick = () => { fillSettings(); dlg.showModal(); };
$('units').onchange = () => {
  // Convert the displayed goal when switching units so the real goal stays the same.
  const goalMl = fromDisp(Number($('goalWater').value) || 0);
  state.settings.units = $('units').value;
  $('goalWater').value = toDisp(goalMl);
  document.querySelectorAll('.u').forEach((el) => (el.textContent = state.settings.units));
};
dlg.addEventListener('close', () => {
  if (dlg.returnValue !== 'save') { state = { ...state, settings: load().settings }; render(); return; }
});
$('settingsForm').addEventListener('submit', async (e) => {
  if (e.submitter && e.submitter.value !== 'save') return;
  const s = state.settings;
  s.units = $('units').value;
  s.goalWaterMl = Math.round(fromDisp(Number($('goalWater').value) || 64));
  s.goalCal = Number($('goalCal').value) || DEFAULTS.goalCal;
  s.goalPro = Number($('goalPro').value) || DEFAULTS.goalPro;
  s.remStart = $('remStart').value || '09:00'; s.remEnd = $('remEnd').value || '21:00';
  s.remEvery = Number($('remEvery').value);
  const wantOn = $('remindOn').checked;
  s.remindOn = wantOn ? await enableReminders() : false;
  if (!wantOn) await disableReminders();
  save(); render(); syncPush(); startLocalTimer();
});

function updateHint() {
  const el = $('notifHint');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    el.textContent = ios && !standalone
      ? 'On iPhone: tap Share → Add to Home Screen, then open the app from your home screen to enable reminders.'
      : 'Notifications are not supported in this browser.';
  } else if (Notification.permission === 'denied') {
    el.textContent = 'Notifications are blocked. Enable them in Settings → Notifications → Intake.';
  } else {
    el.textContent = 'Reminders are sent in the background while you are inside your chosen window, and skipped once you hit your water goal.';
  }
}

// ---------- Push / reminders ----------
function b64ToU8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function enableReminders() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) { updateHint(); toast('Notifications unavailable here'); return false; }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { updateHint(); toast('Notifications not allowed'); return false; }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await (await fetch('/api/config')).json();
      if (!publicKey) throw new Error('no key');
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(publicKey) });
    }
    state.settings.remindOn = true;
    await syncPush(sub);
    toast('Reminders on');
  } catch (err) {
    console.warn(err);
    toast('Background push unavailable; reminders work while app is open');
  }
  return true; // local fallback still works
}

async function disableReminders() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch (e) {}
}

let syncTimer;
function syncPush(subArg) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const s = state.settings; if (!s.remindOn || !('serviceWorker' in navigator)) return;
    try {
      const sub = subArg || await (await navigator.serviceWorker.ready).pushManager.getSubscription();
      if (!sub) return;
      const today = dayKey(new Date());
      await fetch('/api/sync', {
        method: 'POST',
        body: JSON.stringify({
          subscription: sub.toJSON(),
          tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
          settings: { start: s.remStart, end: s.remEnd, everyMin: s.remEvery, goalMl: s.goalWaterMl, units: s.units },
          date: today, waterMl: totals(today).water,
        }),
      });
    } catch (e) { console.warn('sync failed', e); }
  }, subArg ? 0 : 600);
}

// Foreground fallback: remind while the app is open.
let localTimer;
function startLocalTimer() {
  clearInterval(localTimer);
  if (!state.settings.remindOn) return;
  localTimer = setInterval(() => {
    const s = state.settings, now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = s.remStart.split(':').map(Number), [eh, em] = s.remEnd.split(':').map(Number);
    if (mins < sh * 60 + sm || mins > eh * 60 + em) return;
    const last = Number(localStorage.getItem('intake.lastLocal') || 0);
    if (Date.now() - last < s.remEvery * 60000) return;
    const t = totals(dayKey(now));
    if (t.water >= s.goalWaterMl) return;
    localStorage.setItem('intake.lastLocal', String(Date.now()));
    toast('💧 Time to drink some water!');
  }, 60000);
}

$('testNotif').onclick = async () => {
  if (!('Notification' in window)) return toast('Notifications unavailable');
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return toast('Not allowed');
  const reg = await navigator.serviceWorker.ready;
  reg.showNotification('💧 Time to drink water', { body: 'This is a test reminder.', icon: 'icon-192.png', tag: 'water' });
};

// ---------- Boot ----------
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { render(); syncPush(); }
});
render(); startLocalTimer();
