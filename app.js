import { LEVELS, WOODS, PAINTS, HOOPS, W, L, P, dist, makeGeo, S, inv, paintCourt, drawScene, stateAt, endOf, plen, lineDist } from './court.js';

const CFG = window.TIMEOUT_CONFIG || {};
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const wait = ms => new Promise(r => setTimeout(r, ms));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : r & 3 | 8).toString(16); }));
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};

/* ================= settings and playbook ================= */
const settings = Object.assign({ wood: 'oak', paint: 'navy', side: 'bottom', feel: 'clean', markers: 'discs', speed: 'normal', level: 'hs' }, LS.get('timeout.settings', {}));
const SPEEDS = { slow: 1900, normal: 1300, fast: 850 };
const TAGS = ['Offense', 'Defense', 'BLOB', 'SLOB', 'Press', 'Drill'];

function formation(o, d) { const pos = {}; o.forEach((p, i) => pos['o' + (i + 1)] = P(p[0], p[1])); d.forEach((p, i) => pos['x' + (i + 1)] = P(p[0], p[1])); return pos; }
function blankStep(pos) { return { ball: 'o1', ballPos: null, note: '', lines: [], marks: [], pos }; }
function newPlay(name) {
  return { id: uuid(), name: name || 'New play', tag: 'Offense', court: { view: 'half', level: settings.level }, updatedAt: Date.now(),
    steps: [blankStep(formation([[25, 34], [7, 26], [43, 26], [4, 7], [46, 7]], [[25, 30], [10, 23], [40, 23], [8, 8], [42, 8]]))] };
}
function examplePlay() {
  const p = newPlay('Horns Flare (example)');
  const s1 = blankStep(formation([[25, 34], [4, 8], [46, 8], [17, 21], [33, 21]], [[25, 30], [7, 10], [43, 10], [19, 18], [31, 18]]));
  s1.note = '5 sets a ball screen, 1 attacks the right elbow';
  s1.lines = [{ type: 'screen', from: 'o5', pts: [P(33, 21), P(30, 26), P(28, 30.5)] }, { type: 'dribble', from: 'o1', pts: [P(25, 34), P(30, 33.5), P(34.5, 29), P(37, 23)] }];
  const s2 = blankStep(clone(s1.pos)); Object.assign(s2.pos, { o5: P(28, 30.5), o1: P(37, 23), x1: P(31, 28), x5: P(34, 21) });
  s2.note = '5 rolls to the rim, 4 lifts to the top';
  s2.lines = [{ type: 'cut', from: 'o5', pts: [P(28, 30.5), P(27, 22), P(26.5, 10)] }, { type: 'cut', from: 'o4', pts: [P(17, 21), P(17.5, 27), P(21, 32)] }];
  const s3 = blankStep(clone(s2.pos)); Object.assign(s3.pos, { o5: P(26.5, 10), o4: P(21, 32), x5: P(35, 19) });
  s3.note = 'Hit the roller for the finish'; s3.lines = [{ type: 'pass', from: 'o1', to: 'o5', pts: [P(37, 23), P(26.5, 10)] }];
  p.steps = [s1, s2, s3]; return p;
}
/** Make sure a play loaded from storage, the cloud or a link has every field the app expects. */
function normalize(p) {
  if (!p || !Array.isArray(p.steps) || !p.steps.length) return null;
  p.id = p.id || uuid(); p.name = String(p.name || 'Untitled play').slice(0, 60); p.tag = TAGS.includes(p.tag) ? p.tag : 'Offense';
  p.court = p.court || {}; if (p.court.view !== 'full') p.court.view = 'half'; if (!LEVELS[p.court.level]) p.court.level = 'hs';
  p.updatedAt = +p.updatedAt || Date.now();
  const num = v => (Number.isFinite(+v) ? +v : 0);
  p.steps = p.steps.slice(0, 40).map(s => {
    const pos = {}; for (const k in (s.pos || {})) if (/^[ox][1-5]$/.test(k)) pos[k] = P(num(s.pos[k].x), num(s.pos[k].y));
    return {
      ball: pos[s.ball] ? s.ball : null, ballPos: s.ballPos ? P(num(s.ballPos.x), num(s.ballPos.y)) : null, note: String(s.note || '').slice(0, 140), pos,
      lines: (s.lines || []).filter(l => ['cut', 'dribble', 'pass', 'screen', 'shot'].includes(l.type) && Array.isArray(l.pts) && l.pts.length > 1)
        .map(l => ({ type: l.type, from: pos[l.from] ? l.from : null, to: pos[l.to] ? l.to : undefined, pts: l.pts.slice(0, 400).map(q => P(num(q.x), num(q.y))) })),
      marks: (s.marks || []).filter(m => ['cone', 'coach', 'text'].includes(m.kind)).map(m => ({ id: m.id || uuid().slice(0, 8), kind: m.kind, x: num(m.x), y: num(m.y), text: String(m.text || '').slice(0, 40) })),
    };
  });
  return p;
}

let book = LS.get('timeout.plays', null);       // scratch plays kept on this device
if (!Array.isArray(book)) book = [examplePlay()];
book = book.filter(p => !p.deleted).map(normalize).filter(Boolean);
const livePlays = () => book.slice().sort((a, b) => b.updatedAt - a.updatedAt);
function saveBook() { LS.set('timeout.plays', book); }

// The play on screen, and where it lives: a scratch play on this device, a play in a cloud playbook, or one opened from a shared link.
let play, where = { kind: 'draft' };
const st = { tool: 'move', cur: 0, showEnd: false, defense: true };
let undo = [], redo = [];

function save() {
  play.updatedAt = Date.now();
  if (where.kind === 'draft') { const i = book.findIndex(p => p.id === play.id); if (i >= 0) book[i] = play; else book.push(play); saveBook(); }
  else if (where.kind === 'cloud' && canEdit(where.pb)) queueCloudSave(play, where.pb.id);
}
function setEditorChrome() {
  const viewOnly = where.kind === 'cloud' && !canEdit(where.pb);
  $('banner').hidden = !(where.kind === 'shared' || viewOnly);
  $('bannerText').textContent = viewOnly ? 'View only. Changes you make here are not saved.' : 'This play was shared with you.';
  $('bannerBtn').hidden = viewOnly;
  $('btnAdd').hidden = where.kind !== 'draft' || !cloudOn;
  $('pbLabel').hidden = where.kind !== 'cloud'; $('pbLabel').textContent = where.kind === 'cloud' ? where.pb.name : '';
}
function loadPlay(p, w) {
  stopAnim(); play = p; where = w || { kind: 'draft' }; st.cur = 0; st.showEnd = false; undo = []; redo = [];
  $('playName').value = play.name; $('level').value = play.court.level; $('tag').value = play.tag;
  press($('segView'), 'view', play.court.view); setEditorChrome();
  renderSteps(); renderTools(); showEditor();
}

/* ================= editing with undo and step-to-step carry-over ================= */
let editEnds = null;
function beginEdit() { undo.push(JSON.stringify(play.steps)); if (undo.length > 80) undo.shift(); redo = []; editEnds = clone(play.steps.map(endOf)); }
function finishEdit() {
  // If a player's finishing spot in a step changed, move their starting spot in the next step with it.
  for (let i = st.cur; i < play.steps.length - 1; i++) {
    const oe = editEnds[i], ne = endOf(play.steps[i]), nx = play.steps[i + 1];
    for (const id in nx.pos) {
      if (!oe.pos[id] || !ne.pos[id] || dist(nx.pos[id], oe.pos[id]) > .05 || dist(ne.pos[id], oe.pos[id]) < .01) continue;
      nx.pos[id] = P(ne.pos[id].x, ne.pos[id].y);
      nx.lines.forEach(l => { if (l.from === id) l.pts[0] = P(ne.pos[id].x, ne.pos[id].y); if (l.to === id) l.pts[l.pts.length - 1] = P(ne.pos[id].x, ne.pos[id].y); });
    }
    if (nx.ball === oe.ball && (ne.ball !== oe.ball || JSON.stringify(ne.ballPos) !== JSON.stringify(oe.ballPos))) { nx.ball = ne.ball; nx.ballPos = ne.ballPos ? clone(ne.ballPos) : null; }
  }
  editEnds = null; save(); renderSteps(); renderTools(); render();
}
function edit(fn) { beginEdit(); fn(play.steps[st.cur]); finishEdit(); }
function doUndo(from, to) {
  if (!from.length) return; stopAnim(); to.push(JSON.stringify(play.steps)); play.steps = JSON.parse(from.pop());
  st.cur = Math.min(st.cur, play.steps.length - 1); st.showEnd = false; save(); renderSteps(); renderTools(); render();
}

/* ================= canvas ================= */
const cv = $('cv'), ctx = cv.getContext('2d'), cache = document.createElement('canvas');
let g = makeGeo(300, 300, 'half');
function layout() {
  const wrap = $('courtWrap'), ww = wrap.clientWidth, wh = wrap.clientHeight; if (!ww || !wh || !play) return;
  g = makeGeo(ww, wh, play.court.view);
  const d = Math.min(2.5, window.devicePixelRatio || 1);
  [cv, cache].forEach(c => { c.width = Math.round(g.w * d); c.height = Math.round(g.h * d); });
  cv.style.width = g.w + 'px'; cv.style.height = g.h + 'px';
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const cc = cache.getContext('2d'); cc.setTransform(d, 0, 0, d, 0, 0); paintCourt(cc, g, settings, play.court.level);
  render();
}
let anim = null, draft = null;
function render() {
  if (!play) return;
  ctx.clearRect(0, 0, g.w, g.h); ctx.drawImage(cache, 0, 0, g.w, g.h);
  const t = anim ? anim.t : (st.showEnd ? 1 : 0);
  drawScene(ctx, g, play, st.cur, t, settings, { draft, defense: st.defense, caption: anim ? play.steps[st.cur].note : '' });
}

/* ================= pointer input ================= */
function evPt(e) { const b = cv.getBoundingClientRect(); return inv(g, e.clientX - b.left, e.clientY - b.top); }
function nearestPlayer(p, rad) { const step = play.steps[st.cur]; let best = rad, id = null; for (const k in step.pos) { if (k[0] === 'x' && !st.defense) continue; const d = dist(step.pos[k], p); if (d < best) { best = d; id = k; } } return id; }
function nearestMark(p, rad) { let best = rad, hit = null; (play.steps[st.cur].marks || []).forEach(m => { const d = dist(m, p); if (d < best) { best = d; hit = m; } }); return hit; }
const clampPt = p => P(Math.max(-2, Math.min(W + 2, p.x)), Math.max(-2, Math.min(L + 2, p.y)));
const DRAW = ['cut', 'dribble', 'pass', 'screen', 'shot'];
let drag = null;

cv.addEventListener('pointerdown', e => {
  if (e.button > 0) return;
  if (anim) stopAnim();
  if (st.showEnd) { st.showEnd = false; render(); }
  const p = evPt(e), step = play.steps[st.cur], grab = Math.max(2.6, 22 / g.s);
  if (st.tool === 'move') {
    const id = nearestPlayer(p, grab), m = id ? null : nearestMark(p, grab);
    if (id || m) { beginEdit(); drag = { id, m }; cv.setPointerCapture(e.pointerId); }
    return;
  }
  if (st.tool === 'erase') {
    const m = nearestMark(p, grab); if (m) { edit(s => { s.marks = s.marks.filter(x => x !== m); }); return; }
    let bi = -1, bd = Math.max(1.8, 16 / g.s); step.lines.forEach((l, i) => { const d = lineDist(l, p); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) edit(s => { s.lines.splice(bi, 1); });
    return;
  }
  if (st.tool === 'ball') { const id = nearestPlayer(p, grab); if (id) edit(s => { s.ball = id; s.ballPos = null; }); else toast('Tap a player to give them the ball.'); return; }
  if (st.tool === 'cone' || st.tool === 'coach') { const q = clampPt(p); edit(s => { s.marks.push({ id: uuid().slice(0, 8), kind: st.tool, x: q.x, y: q.y, text: '' }); }); return; }
  if (st.tool === 'text') { const m = nearestMark(p, grab); textSheet(m && m.kind === 'text' ? m : null, clampPt(p)); return; }
  const id = nearestPlayer(p, grab);
  draft = { type: st.tool, from: id, pts: [id ? P(step.pos[id].x, step.pos[id].y) : p] }; cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!drag && !draft) return;
  const p = evPt(e), step = play.steps[st.cur];
  if (drag) {
    const q = clampPt(p);
    if (drag.m) { drag.m.x = q.x; drag.m.y = q.y; }
    else { step.pos[drag.id] = q; step.lines.forEach(l => { if (l.from === drag.id) l.pts[0] = P(q.x, q.y); if (l.to === drag.id) l.pts[l.pts.length - 1] = P(q.x, q.y); }); }
    render(); return;
  }
  if (draft.type === 'pass' || draft.type === 'shot') draft.pts = [draft.pts[0], p];
  else if (dist(draft.pts[draft.pts.length - 1], p) > .6) draft.pts.push(p);
  render();
});
function pointerUp() {
  if (drag) { drag = null; finishEdit(); return; }
  if (!draft) return;
  const d = draft; draft = null;
  if (plen(d.pts) < 2) { render(); return; }
  edit(step => {
    if (d.type === 'shot') {
      const e = d.pts[1], hoops = play.court.view === 'full' ? HOOPS : HOOPS.slice(0, 1), h = hoops.reduce((a, b) => (dist(b, e) < dist(a, e) ? b : a));
      d.pts[1] = P(h.x, h.y);
    } else if (d.type === 'pass') {
      const e = d.pts[1]; let best = 3.5;
      for (const k in step.pos) if (k[0] === 'o' && k !== d.from && dist(step.pos[k], e) < best) { best = dist(step.pos[k], e); d.to = k; }
      if (d.to) d.pts[1] = P(step.pos[d.to].x, step.pos[d.to].y);
    }
    // A player does one movement and the ball does one thing per step: a new line replaces the old one.
    const fly = t => t === 'pass' || t === 'shot';
    if (d.from) step.lines = step.lines.filter(l => !(l.from === d.from && fly(l.type) === fly(d.type)));
    step.lines.push(d);
  });
}
cv.addEventListener('pointerup', pointerUp); cv.addEventListener('pointercancel', pointerUp);

/* ================= steps and animation ================= */
function renderSteps() {
  const box = $('chips'); box.innerHTML = '';
  play.steps.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = i + 1;
    b.setAttribute('aria-pressed', i === st.cur); b.setAttribute('aria-label', 'Step ' + (i + 1));
    b.onclick = () => { stopAnim(); st.showEnd = false; st.cur = i; renderSteps(); render(); }; box.appendChild(b);
  });
  $('delStep').hidden = play.steps.length < 2;
  if (document.activeElement !== $('stepNote')) $('stepNote').value = play.steps[st.cur].note || '';
}
function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); const cb = anim.done; anim = null; $('btnPlay').textContent = '▶ Play'; if (cb) cb(); } }
function playAnim(done) {
  st.showEnd = false; st.cur = 0; renderSteps();
  anim = { t: 0, t0: performance.now(), raf: 0, done }; $('btnPlay').textContent = '■ Stop';
  const DUR = SPEEDS[settings.speed] || 1300, HOLD = 450;
  const tick = now => {
    if (!anim) return;
    const e = now - anim.t0, k = Math.min(1, e / DUR); anim.t = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; render();
    if (e > DUR + HOLD) {
      if (st.cur < play.steps.length - 1) { st.cur++; anim.t0 = now; anim.t = 0; renderSteps(); }
      else { st.showEnd = true; stopAnim(); render(); return; }
    }
    anim.raf = requestAnimationFrame(tick);
  };
  anim.raf = requestAnimationFrame(tick);
}

/* ================= toolbar ================= */
const TOOLS = [
  ['move', 'Move', '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>'],
  ['cut', 'Cut', '<path d="M4 20L19 5M11 5h8v8"/>'],
  ['dribble', 'Dribble', '<path d="M3 20l3-5 3 3 3-5 3 3 3-6"/><path d="M14 6h5v5"/>'],
  ['pass', 'Pass', '<path d="M4 20L17 7" stroke-dasharray="3 4"/><path d="M11 5h8v8"/>'],
  ['screen', 'Screen', '<path d="M5 19L16 8M11 3l10 10"/>'],
  ['shot', 'Shot', '<path d="M4 20L16 8" stroke-dasharray="0.5 4"/><circle cx="18" cy="6" r="3"/>'],
  ['ball', 'Ball', '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5v17M6 6c3 3 3 9 0 12M18 6c-3 3-3 9 0 12"/>'],
  ['text', 'Text', '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'],
  ['cone', 'Cone', '<path d="M12 4l6 14H6zM4 20h16"/>'],
  ['coach', 'Coach', '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M15 9.5a3.5 3.5 0 100 5"/>'],
  ['erase', 'Erase', '<path d="M8 19l-4-4L14 5l6 6-8 8H8zM4 21h16"/>'],
];
function renderTools() {
  const box = $('tools'); box.innerHTML = '';
  const add = (label, svg, on, pressed, disabled) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tool'; if (pressed != null) b.setAttribute('aria-pressed', pressed); b.disabled = !!disabled;
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg>' + label; b.onclick = on; box.appendChild(b);
  };
  TOOLS.forEach(([k, label, svg]) => add(label, svg, () => { st.tool = k; renderTools(); }, st.tool === k));
  add('Undo', '<path d="M8 6L3 11l5 5M3 11h11a5 5 0 010 10h-3"/>', () => doUndo(undo, redo), null, !undo.length);
  add('Redo', '<path d="M16 6l5 5-5 5M21 11H10a5 5 0 000 10h3"/>', () => doUndo(redo, undo), null, !redo.length);
  cv.style.cursor = st.tool === 'move' ? 'grab' : 'crosshair';
}

/* ================= sheets, toast ================= */
let toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3200); }
function sheet(html) { const s = $('scrim'); s.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>'; s.hidden = false; const f = s.querySelector('[autofocus]'); if (f) f.focus(); }
function closeSheet() { $('scrim').hidden = true; $('scrim').innerHTML = ''; }
function press(box, attr, v) { box.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset[attr] === v)); }
const head = t => '<h2>' + t + ' <button type="button" class="btn" data-act="close">Close</button></h2>';

function textSheet(mark, at) {
  textTarget = { mark, at };
  sheet(head(mark ? 'Edit label' : 'Add a label') +
    '<form data-form="text" class="field"><input id="markText" maxlength="40" autofocus autocomplete="off" placeholder="e.g. Screen away" value="' + esc(mark ? mark.text : '') + '">' +
    '<div class="btns"><button class="btn primary" type="submit">' + (mark ? 'Save' : 'Add to court') + '</button></div></form>');
}
let textTarget = null;

function settingsSheet() {
  const group = (title, key, items) => '<h3>' + title + '</h3><div class="opts">' + items.map(([v, label, sw]) =>
    '<button type="button" class="opt" data-act="set" data-k="' + key + '" data-v="' + v + '" aria-pressed="' + (settings[key] === v) + '">' + (sw ? '<i class="sw" style="background:' + sw + '"></i>' : '') + label + '</button>').join('') + '</div>';
  sheet(head('Settings') +
    group('Wood colour', 'wood', Object.entries(WOODS).map(([k, w]) => [k, w.label, 'rgb(' + w.base.join(',') + ')'])) +
    group('Paint colour', 'paint', Object.entries(PAINTS).map(([k, p]) => [k, p.label, p.hex])) +
    group('Tool side', 'side', [['bottom', 'Bottom'], ['left', 'Left'], ['right', 'Right'], ['top', 'Top']]) +
    group('Drawing feel', 'feel', [['clean', 'Clean lines'], ['marker', 'Dry-erase marker']]) +
    group('Player markers', 'markers', [['discs', 'Numbered discs'], ['chalk', "Coach's O and X"], ['pos', 'Positions (PG, SG…)']]) +
    group('Animation speed', 'speed', [['slow', 'Slow'], ['normal', 'Normal'], ['fast', 'Fast']]) +
    '<h3>Account</h3><div class="btns"><button type="button" class="btn" data-act="account">' + (user ? 'Account' : 'Sign in') + '</button></div>' +
    '<p class="note">To install Timeout as an app, open your browser menu and choose “Add to Home Screen” or “Install”.</p>');
}

// Starting spots for players 1-5 (x across the court, y up from the baseline, in feet). "ball" is who starts with it.
const FORMATIONS = [
  { group: 'Half-court sets', items: [
    { k: '5out', name: '5 out', desc: 'All five outside the key', o: [[25, 34], [7, 26], [43, 26], [4, 7], [46, 7]] },
    { k: '4out', name: '4 out, 1 in', desc: 'Four outside, one post player', o: [[17, 33], [33, 33], [5, 14], [45, 14], [31, 9]] },
    { k: '3out', name: '3 out, 2 in', desc: 'Three outside, two in the key', o: [[25, 34], [6, 22], [44, 22], [19, 9], [31, 9]] },
    { k: '2out', name: '2 out, 3 in', desc: 'Two guards out, a high post and two blocks', o: [[17, 33], [33, 33], [25, 20], [19, 9], [31, 9]] },
    { k: 'horns', name: 'Horns', desc: 'Two at the elbows, two in the corners', o: [[25, 34], [4, 8], [46, 8], [17, 21], [33, 21]] },
    { k: '14high', name: '1-4 high', desc: 'Four across the free-throw line', o: [[25, 36], [5, 20], [45, 20], [19, 20], [31, 20]] },
    { k: 'box', name: 'Box', desc: 'Two at the elbows, two on the blocks', o: [[25, 34], [19, 9], [31, 9], [19, 20], [31, 20]] },
  ] },
  { group: 'Baseline inbounds (3 takes it out)', tag: 'BLOB', ball: 'o3', items: [
    { k: 'blobBox', name: 'Baseline: box', desc: 'Two at the elbows, two on the blocks', o: [[19, 20], [31, 20], [34, -1.5], [19, 8], [31, 8]] },
    { k: 'blobStack', name: 'Baseline: stack', desc: 'Four in a line up the lane', o: [[32, 21], [32, 16.5], [34, -1.5], [32, 12], [32, 7.5]] },
    { k: 'blobLine', name: 'Baseline: line', desc: 'Four across the free-throw line', o: [[8, 19], [42, 19], [34, -1.5], [19, 19], [31, 19]] },
  ] },
  { group: 'Sideline inbounds (3 takes it out)', tag: 'SLOB', ball: 'o3', items: [
    { k: 'slobBox', name: 'Sideline: box', desc: 'Two up top, two at the elbows', o: [[20, 32], [32, 32], [50.6, 30], [19, 19], [31, 19]] },
    { k: 'slobStack', name: 'Sideline: stack', desc: 'Four in a line facing the inbounder', o: [[40, 30], [34, 30], [50.6, 30], [28, 30], [22, 30]] },
    { k: 'slobLine', name: 'Sideline: line', desc: 'Four across the free-throw line', o: [[8, 19], [42, 19], [50.6, 30], [19, 19], [31, 19]] },
  ] },
];
function formationSheet() {
  sheet(head('Formation') + '<p class="note">Sets where the players start on this step. Lines already drawn on this step are cleared. Undo brings them back.</p>' +
    FORMATIONS.map(g => '<h3>' + g.group + '</h3>' + g.items.map(f => '<button type="button" class="row" data-act="setFormation" data-k="' + f.k + '"><span class="main"><b>' + f.name + '</b><span>' + f.desc + '</span></span></button>').join('')).join(''));
}
function applyFormation(key) {
  const g = FORMATIONS.find(x => x.items.some(f => f.k === key)); if (!g) return;
  const f = g.items.find(x => x.k === key), hoop = HOOPS[0], pos = {};
  f.o.forEach((p, i) => {
    pos['o' + (i + 1)] = P(p[0], p[1]);
    // each defender starts between their player and the basket
    const dx = hoop.x - p[0], dy = hoop.y - p[1], d = Math.hypot(dx, dy) || 1, k = Math.min(3.5, d * .6) / d;
    pos['x' + (i + 1)] = P(p[0] + dx * k, p[1] + dy * k);
  });
  edit(s => { s.pos = pos; s.lines = []; s.ball = g.ball || 'o1'; s.ballPos = null; });
  if (g.tag && play.tag === 'Offense') { play.tag = g.tag; $('tag').value = g.tag; save(); }
  closeSheet(); toast(f.name + ' set. Drag any player to adjust.');
}

function shareSheet() {
  sheet(head('Share this play') +
    '<button type="button" class="row" data-act="shLink"><span class="main"><b>Link</b><span>Opens the animated play in any browser. No account needed to view.</span></span></button>' +
    '<button type="button" class="row" data-act="shImage"><span class="main"><b>Image</b><span>One picture with every step, for texts and group chats.</span></span></button>' +
    '<button type="button" class="row" data-act="shPdf"><span class="main"><b>Print or PDF</b><span>A printable sheet. Choose “Save as PDF” in the print window.</span></span></button>' +
    '<button type="button" class="row" data-act="shVideo"><span class="main"><b>Video</b><span>Records the animation as a short clip.</span></span></button>');
}

/* ================= sharing ================= */
const b64u = bytes => { let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
function slim(p) {
  const r = v => Math.round(v * 10) / 10, q = clone(p); delete q.id; delete q.updatedAt;
  q.steps.forEach(s => { for (const k in s.pos) s.pos[k] = P(r(s.pos[k].x), r(s.pos[k].y)); s.lines.forEach(l => { l.pts = l.pts.map(a => P(r(a.x), r(a.y))); }); s.marks.forEach(m => { m.x = r(m.x); m.y = r(m.y); }); if (s.ballPos) s.ballPos = P(r(s.ballPos.x), r(s.ballPos.y)); });
  return q;
}
async function pack(obj) {
  const json = JSON.stringify(obj);
  try { const buf = await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'z' + b64u(new Uint8Array(buf)); }
  catch { return 'j' + b64u(new TextEncoder().encode(json)); }
}
async function unpack(str) {
  const bytes = unb64u(str.slice(1));
  if (str[0] === 'z') return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text());
  return JSON.parse(new TextDecoder().decode(bytes));
}
const baseUrl = () => location.origin + location.pathname;
async function makeLink() {
  const data = slim(play);
  if (sb && user) { // signed in: store the play and hand out a short link
    const { data: row, error } = await sb.from('timeout_shares').insert({ data }).select('id').single();
    if (!error && row) return baseUrl() + '#s=' + row.id;
  }
  return baseUrl() + '#p=' + await pack(data);
}
async function openFromHash() {
  const h = location.hash; if (!/^#[ps]=/.test(h)) return false;
  try {
    let data;
    if (h[1] === 'p') data = await unpack(h.slice(3));
    else { const c = await cloud(); if (!c) throw new Error('no cloud'); const r = await c.rpc('timeout_get_share', { share_id: h.slice(3) }); if (r.error || !r.data) throw new Error('missing'); data = r.data; }
    const p = normalize(data); if (!p) throw new Error('bad');
    p.id = uuid(); loadPlay(p, { kind: 'shared' }); return true;
  } catch { toast('That shared link could not be opened. It may be incomplete.'); return false; }
}

function tile(p, i, width) {
  const tg = makeGeo(width, p.court.view === 'full' ? width : 1e5, p.court.view), c = document.createElement('canvas');
  c.width = tg.w; c.height = tg.h; const x = c.getContext('2d');
  paintCourt(x, tg, settings, p.court.level); drawScene(x, tg, p, i, 0, settings, { defense: st.defense }); return c;
}
function composeImage(p) {
  const n = p.steps.length, cols = n > 1 ? 2 : 1, TW = cols === 1 ? 900 : 620, pad = 24, capH = 58, headH = 84;
  const tiles = p.steps.map((_, i) => tile(p, i, TW)), th = tiles[0].height, rows = Math.ceil(n / cols);
  const c = document.createElement('canvas'); c.width = pad + cols * (TW + pad); c.height = headH + rows * (th + capH + pad);
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#17202b'; x.textBaseline = 'middle'; x.font = '700 40px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; x.fillText(p.name.toUpperCase(), pad, 46, c.width - 190);
  x.fillStyle = '#cf4f1b'; x.textAlign = 'right'; x.font = '700 26px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; x.fillText('TIMEOUT', c.width - pad, 46); x.textAlign = 'left';
  tiles.forEach((t, i) => {
    const tx = pad + (i % cols) * (TW + pad), ty = headH + Math.floor(i / cols) * (th + capH + pad);
    x.drawImage(t, tx, ty);
    x.fillStyle = '#17202b'; x.font = '700 22px "Barlow Condensed","Arial Narrow",Arial,sans-serif'; x.fillText('STEP ' + (i + 1), tx, ty + th + 20);
    x.fillStyle = '#566373'; x.font = '18px Barlow,"Segoe UI",Arial,sans-serif'; x.fillText(p.steps[i].note || '', tx, ty + th + 44, TW);
  });
  return c;
}
const fileBase = () => (play.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'play').toLowerCase();
let pending = null;
function deliverSheet(title, blob, filename, kind) {
  if (pending) URL.revokeObjectURL(pending.url);
  const url = URL.createObjectURL(blob), file = new File([blob], filename, { type: blob.type });
  pending = { url, file, filename };
  const canSend = !!(navigator.canShare && navigator.canShare({ files: [file] }));
  sheet(head(title) + (kind === 'video' ? '<video src="' + url + '" controls playsinline loop style="width:100%;border-radius:8px;max-height:50vh;background:#000"></video>'
    : '<img src="' + url + '" alt="Preview of the play" style="width:100%;border:1px solid var(--line);border-radius:8px;max-height:50vh;object-fit:contain">') +
    '<div class="btns">' + (canSend ? '<button type="button" class="btn primary" data-act="sendFile">Send</button>' : '') +
    '<a class="btn' + (canSend ? '' : ' primary') + '" href="' + url + '" download="' + esc(filename) + '" style="text-decoration:none;display:inline-flex;align-items:center">Download</a></div>');
}
async function recordVideo() {
  if (!window.MediaRecorder || !cv.captureStream) { toast('This browser cannot record video. Try Chrome, Edge or Safari.'); return; }
  const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) { toast('This browser cannot record video. Try Chrome, Edge or Safari.'); return; }
  closeSheet(); stopAnim(); toast('Recording the animation…');
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: mime, videoBitsPerSecond: 4e6 }), chunks = [];
  rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(); st.cur = 0; st.showEnd = false; render(); await wait(400);
  await new Promise(r => playAnim(r)); await wait(700); rec.stop(); await stopped;
  const type = mime.split(';')[0];
  deliverSheet('Video ready', new Blob(chunks, { type }), fileBase() + (type === 'video/mp4' ? '.mp4' : '.webm'), 'video');
}
async function printPlays(list) {
  const box = $('print');
  box.innerHTML = list.map(p => '<section><h1>' + esc(p.name) + '</h1><p class="meta">' + esc(p.tag) + ' · ' + LEVELS[p.court.level].label + ' lines</p><div class="grid' + (p.steps.length === 1 ? ' one' : '') + '">' +
    p.steps.map((s, i) => '<figure><img alt="" src="' + tile(p, i, 760).toDataURL('image/jpeg', .9) + '"><figcaption><b>Step ' + (i + 1) + '</b>' + (s.note ? ' — ' + esc(s.note) : '') + '</figcaption></figure>').join('') + '</div></section>').join('');
  await Promise.all([...box.querySelectorAll('img')].map(im => (im.decode ? im.decode().catch(() => {}) : null)));
  closeSheet(); window.print();
}

/* ================= cloud: accounts, playbooks, people ================= */
let sb = null, user = null, cloudP = null;
const cloudOn = !!(CFG.supabaseUrl && CFG.supabaseKey);
const ROLES = {
  owner: ['Owner', 'Full control of the playbook'], admin: ['Admin', 'Edit plays and manage people'],
  editor: ['Editor', 'Create and edit plays'], viewer: ['Viewer', 'View plays only'],
};
function canEdit(pb) { return pb.role !== 'viewer'; }
function canManage(pb) { return pb.role === 'owner' || pb.role === 'admin'; }
const kept = LS.get('timeout.cache', { pbs: [], plays: {} });   // last copy from the cloud, for opening offline
const pendingSaves = LS.get('timeout.pending', {});             // play id -> row waiting to be sent
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
function cloud() {
  if (!cloudOn) return Promise.resolve(null);
  if (!cloudP) cloudP = (async () => {
    if (!window.supabase) await loadScript('vendor/supabase.js');
    const c = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
    const { data } = await c.auth.getSession(); user = data.session ? data.session.user : null;
    c.auth.onAuthStateChange((_e, s) => { user = s ? s.user : null; });
    sb = c; return c;
  })().catch(e => { cloudP = null; throw e; });
  return cloudP;
}
let saveT = null, saveWarned = false;
function queueCloudSave(p, pbId) {
  pendingSaves[p.id] = { id: p.id, playbook_id: pbId, data: p, rev: p.updatedAt }; LS.set('timeout.pending', pendingSaves);
  clearTimeout(saveT); saveT = setTimeout(flushSaves, 1200);
}
async function flushSaves() {
  clearTimeout(saveT);
  const rows = Object.values(pendingSaves); if (!rows.length || !sb || !user || !navigator.onLine) return;
  const { error } = await sb.from('timeout_plays').upsert(rows);
  if (error) { if (!saveWarned) toast('Could not save to the playbook right now. Your changes are kept on this device and will be sent later.'); saveWarned = true; return; }
  saveWarned = false; rows.forEach(r => { if (pendingSaves[r.id] && pendingSaves[r.id].rev === r.rev) delete pendingSaves[r.id]; }); LS.set('timeout.pending', pendingSaves);
}
async function fetchPlaybooks() {
  const [a, b] = await Promise.all([sb.from('timeout_playbooks').select('id,name,owner_id').order('name'), sb.from('timeout_playbook_members').select('playbook_id,role').eq('user_id', user.id)]);
  if (a.error) throw a.error;
  const roles = new Map((b.data || []).map(m => [m.playbook_id, m.role]));
  kept.pbs = a.data.map(p => ({ id: p.id, name: p.name, role: p.owner_id === user.id ? 'owner' : (roles.get(p.id) || 'viewer') }));
  LS.set('timeout.cache', kept); return kept.pbs;
}
async function fetchPlays(pbId) {
  const { data, error } = await sb.from('timeout_plays').select('id,data,rev').eq('playbook_id', pbId);
  if (error) throw error;
  const list = data.map(r => normalize(Object.assign({}, r.data, { id: r.id, updatedAt: r.rev }))).filter(Boolean);
  Object.values(pendingSaves).forEach(r => { if (r.playbook_id !== pbId) return; const i = list.findIndex(p => p.id === r.id); if (i >= 0) list[i] = r.data; else list.push(r.data); });
  list.sort((x, y) => x.name.localeCompare(y.name));
  kept.plays[pbId] = list; LS.set('timeout.cache', kept); return list;
}

/* ================= screens: sign in, home, playbook ================= */
let view = { name: 'auth' };
function showScreen(html) { stopAnim(); $('app').hidden = true; const s = $('screen'); s.innerHTML = html; s.hidden = false; }
function showEditor() { $('screen').hidden = true; $('app').hidden = false; layout(); }
const GEAR = '<button type="button" class="btn icon" data-act="settings" aria-label="Settings" title="Settings"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg></button>';
const playRow = (p, open, extra) => '<div class="row"><button type="button" class="main" data-act="' + open + '" data-id="' + p.id + '"><b>' + esc(p.name) + '</b><span>' + esc(p.tag) + ' · ' + p.steps.length + (p.steps.length === 1 ? ' step' : ' steps') + '</span></button>' + extra + '</div>';

function renderAuth(msg) {
  view = { name: 'auth' };
  showScreen('<div class="hero"><div class="brand big">Timeout</div><p class="tagline">Basketball play designer</p>' +
    '<form data-form="auth" class="card">' +
    '<label class="field">Email<input id="authEmail" type="email" required autocomplete="email"></label>' +
    '<label class="field">Password<input id="authPass" type="password" required minlength="8" autocomplete="current-password"></label>' +
    (msg ? '<p class="' + (msg.ok ? 'note' : 'err') + '">' + esc(msg.text) + '</p>' : '') +
    '<div class="btns"><button class="btn primary" type="submit" data-mode="in">Sign in</button><button class="btn" type="submit" data-mode="up">Create account</button></div>' +
    '<p class="note">New passwords need at least 8 characters.</p></form>' +
    '<button type="button" class="btn ghost" data-act="guest">Continue without signing in</button>' +
    '<p class="note">Without an account you can use the scratchboard on this device. Playbooks and adding people need an account.</p></div>');
}
function renderHome(pbs, loading) {
  const drafts = livePlays();
  let books;
  if (!cloudOn) books = '';
  else if (!user) books = '<h3>Playbooks</h3><p class="note">Sign in to create playbooks and share them with your staff and players.</p><div class="btns"><button type="button" class="btn primary" data-act="account">Sign in</button></div>';
  else books = '<h3>Playbooks</h3>' + (pbs.length ? pbs.map(b => '<div class="row"><button type="button" class="main" data-act="openPb" data-id="' + b.id + '"><b>' + esc(b.name) + '</b><span>' + ROLES[b.role][1] + '</span></button><span class="pill">' + ROLES[b.role][0] + '</span></div>').join('')
    : '<p class="note">' + (loading ? 'Loading your playbooks…' : 'You have no playbooks yet. Create one to save plays and add people.') + '</p>') +
    '<div class="btns"><button type="button" class="btn" data-act="newPb">New playbook</button></div>';
  showScreen('<header class="bar"><span class="brand">Timeout</span><span class="sp"></span>' + (cloudOn ? '<button type="button" class="btn" data-act="account">' + (user ? 'Account' : 'Sign in') + '</button>' : '') + GEAR + '</header><div class="wrap">' +
    '<button type="button" class="card big" data-act="scratch"><b>Scratchboard</b><span>Open a blank court and start drawing.</span></button>' + books +
    (drafts.length ? '<h3>Scratch plays on this device</h3>' + drafts.map(p => playRow(p, 'openDraft', '<button type="button" class="btn danger" data-act="askDelDraft" data-id="' + p.id + '">Delete</button>')).join('') : '') + '</div>');
}
async function goHome() {
  view = { name: 'home', pbs: user ? kept.pbs : [] }; renderHome(view.pbs, !!user);
  if (!user || !sb) return;
  try { const pbs = await fetchPlaybooks(); if (view.name === 'home') { view.pbs = pbs; renderHome(pbs); } }
  catch { if (view.name === 'home') { renderHome(view.pbs); toast('You seem to be offline. Showing the last saved copy.'); } }
}
function renderPb(pb, plays) {
  const ed = canEdit(pb), owner = pb.role === 'owner';
  showScreen('<header class="bar"><button type="button" class="btn" data-act="home">‹ Home</button><b class="title">' + esc(pb.name) + '</b><span class="pill">' + ROLES[pb.role][0] + '</span></header><div class="wrap">' +
    '<div class="btns">' + (ed ? '<button type="button" class="btn primary" data-act="newCloudPlay">New play</button>' : '') +
    '<button type="button" class="btn" data-act="people">People</button><button type="button" class="btn" data-act="printPb">Print playbook</button>' +
    (owner ? '<button type="button" class="btn" data-act="renamePb">Rename</button><button type="button" class="btn danger" data-act="askDelPb">Delete playbook</button>' : '<button type="button" class="btn danger" data-act="askLeavePb">Leave</button>') + '</div>' +
    (plays === null ? '<p class="note">Loading plays…</p>' : plays.length ? plays.map(p => playRow(p, 'openCloud', ed ? '<button type="button" class="btn" data-act="dupCloud" data-id="' + p.id + '">Copy</button><button type="button" class="btn danger" data-act="askDelCloud" data-id="' + p.id + '">Delete</button>' : '')).join('')
      : '<p class="note">' + (ed ? 'No plays here yet. Press “New play”, or add one from the scratchboard.' : 'No plays in this playbook yet.') + '</p>') + '</div>');
}
async function openPb(pb) {
  view = { name: 'pb', pb, plays: kept.plays[pb.id] || null }; renderPb(pb, view.plays);
  try { await flushSaves(); const plays = await fetchPlays(pb.id); if (view.name === 'pb' && view.pb.id === pb.id) { view.plays = plays; renderPb(pb, plays); } }
  catch { if (view.name === 'pb' && view.pb.id === pb.id) { view.plays = view.plays || []; renderPb(pb, view.plays); toast('You seem to be offline. Showing the last saved copy.'); } }
}
async function afterSignIn() {
  try { const r = await sb.rpc('timeout_accept_invites'); if (r.data > 0) toast('You were added to ' + r.data + (r.data === 1 ? ' playbook.' : ' playbooks.')); } catch { /* offline */ }
  flushSaves(); goHome();
}

const roleSelect = (cur, attrs) => '<select ' + attrs + ' aria-label="Role">' + ['admin', 'editor', 'viewer'].map(r => '<option value="' + r + '"' + (r === cur ? ' selected' : '') + '>' + ROLES[r][0] + '</option>').join('') + '</select>';
async function peopleSheet(msg) {
  const pb = view.pb, manage = canManage(pb);
  sheet(head('People') + '<p class="note">Loading…</p>');
  const [pp, inv] = await Promise.all([sb.rpc('timeout_playbook_people', { pb: pb.id }), manage ? sb.from('timeout_invites').select('email,role').eq('playbook_id', pb.id) : Promise.resolve({ data: [] })]);
  if (pp.error) { sheet(head('People') + '<p class="err">Could not load the people on this playbook. Check your connection and try again.</p>'); return; }
  const people = pp.data.map(p => '<div class="row"><span class="main"><b>' + esc(p.display_name || p.username || 'Unnamed') + (p.user_id === user.id ? ' (you)' : '') + '</b><span>' + (p.username ? '@' + esc(p.username) : '') + '</span></span>' +
    (p.role === 'owner' || !manage || p.user_id === user.id ? '<span class="pill">' + ROLES[p.role][0] + '</span>'
      : roleSelect(p.role, 'data-change="role" data-id="' + p.user_id + '"') + '<button type="button" class="btn danger" data-act="rmPerson" data-id="' + p.user_id + '">Remove</button>') + '</div>').join('');
  const invites = (inv.data || []).map(i => '<div class="row"><span class="main"><b>' + esc(i.email) + '</b><span>Invited. Joins when they create an account.</span></span>' +
    roleSelect(i.role, 'data-change="inviteRole" data-id="' + esc(i.email) + '"') + '<button type="button" class="btn danger" data-act="rmInvite" data-id="' + esc(i.email) + '">Remove</button></div>').join('');
  sheet(head('People') + '<p class="note">' + esc(pb.name) + '</p>' + people + invites +
    (manage ? '<h3>Add a person</h3><form data-form="person" class="field" style="gap:10px">' +
      '<label class="field">Their username or email<input id="personWho" required autocomplete="off" autocapitalize="none"></label>' +
      '<label class="field">Role' + roleSelect('viewer', 'id="personRole"') + '</label>' +
      (msg ? '<p class="' + (msg.ok ? 'note' : 'err') + '">' + esc(msg.text) + '</p>' : '') +
      '<div class="btns"><button class="btn primary" type="submit">Add person</button></div></form>' +
      '<h3>What each role can do</h3>' + ['admin', 'editor', 'viewer'].map(r => '<p class="note"><b>' + ROLES[r][0] + ':</b> ' + ROLES[r][1] + '</p>').join('')
      : '<p class="note">Only the owner and admins can add or remove people.</p>'));
}
function nameSheet(title, value, mode) {
  sheet(head(title) + '<form data-form="pb" data-mode="' + mode + '" class="field" style="gap:10px"><label class="field">Playbook name<input id="pbName" required maxlength="60" autofocus autocomplete="off" value="' + esc(value) + '" placeholder="e.g. Varsity 2026"></label>' +
    '<div class="btns"><button class="btn primary" type="submit">' + (mode === 'rename' ? 'Save' : 'Create playbook') + '</button></div></form>');
}
const confirmSheet = (title, text, act, label, id) => sheet('<h2>' + title + '</h2><p class="note">' + text + '</p><div class="btns"><button type="button" class="btn danger" data-act="' + act + '" data-id="' + (id || '') + '">' + label + '</button><button type="button" class="btn" data-act="close">Cancel</button></div>');
async function addPlayTo(pb) {
  const p = play, row = { id: p.id, playbook_id: pb.id, data: p, rev: Date.now() };
  const { error } = await sb.from('timeout_plays').upsert(row);
  if (error) { toast('Could not add the play. Check your connection and try again.'); return; }
  book = book.filter(x => x.id !== p.id); saveBook();
  if (play === p) { where = { kind: 'cloud', pb }; setEditorChrome(); }
  closeSheet(); toast('Added to ' + pb.name + '.');
}
async function pickPlaybookSheet() {
  sheet(head('Add to playbook') + '<p class="note">Loading your playbooks…</p>');
  let pbs; try { pbs = (await fetchPlaybooks()).filter(canEdit); } catch { sheet(head('Add to playbook') + '<p class="err">Could not load your playbooks. Check your connection and try again.</p>'); return; }
  view.pick = pbs;
  sheet(head('Add to playbook') + (pbs.length ? '<p class="note">Choose where to save “' + esc(play.name) + '”.</p>' + pbs.map(b => '<button type="button" class="row" data-act="pickPb" data-id="' + b.id + '"><span class="main"><b>' + esc(b.name) + '</b><span>' + ROLES[b.role][0] + '</span></span></button>').join('')
    : '<p class="note">You do not have a playbook you can edit yet.</p>') + '<div class="btns"><button type="button" class="btn" data-act="newPbForPlay">New playbook</button></div>');
}

/* ================= actions ================= */
const actions = {
  close: closeSheet, share: shareSheet, settings: settingsSheet, formation: formationSheet,
  setFormation(el) { applyFormation(el.dataset.k); },
  play() { if (anim) { stopAnim(); render(); } else playAnim(); },
  addStep() {
    stopAnim(); st.showEnd = false; undo.push(JSON.stringify(play.steps)); redo = [];
    const prev = play.steps[st.cur], e = endOf(prev);
    play.steps.splice(st.cur + 1, 0, { ball: e.ball, ballPos: e.ballPos ? clone(e.ballPos) : null, note: '', lines: [], marks: clone(prev.marks || []), pos: clone(e.pos) });
    st.cur++; save(); renderSteps(); renderTools(); render();
    toast('Step ' + (st.cur + 1) + ' starts where step ' + st.cur + ' ended. Draw the next action.');
  },
  delStep() { if (play.steps.length < 2) return; stopAnim(); undo.push(JSON.stringify(play.steps)); redo = []; play.steps.splice(st.cur, 1); st.cur = Math.min(st.cur, play.steps.length - 1); save(); renderSteps(); renderTools(); render(); },
  set(el) { settings[el.dataset.k] = el.dataset.v; LS.set('timeout.settings', settings); press(el.parentElement, 'v', el.dataset.v); $('app').dataset.side = settings.side; layout(); },

  // moving between screens
  home() { closeSheet(); goHome(); },
  back() { closeSheet(); if (where.kind === 'shared') history.replaceState(null, '', baseUrl()); if (where.kind === 'cloud') openPb(where.pb); else goHome(); },
  guest() { LS.set('timeout.guest', 1); goHome(); },
  account() {
    closeSheet();
    if (!user) { renderAuth(); return; }
    sheet(head('Account') + '<p class="note">Signed in as ' + esc(user.email) + '.</p><div class="btns"><button type="button" class="btn" data-act="signOut">Sign out</button></div>');
  },
  async signOut() { await flushSaves(); await sb.auth.signOut(); user = null; closeSheet(); renderAuth(); },

  // scratch plays on this device
  scratch() { loadPlay(newPlay('Scratch play')); },
  openDraft(el) { const p = book.find(x => x.id === el.dataset.id); if (p) loadPlay(p); },
  askDelDraft(el) { const p = book.find(x => x.id === el.dataset.id); if (p) confirmSheet('Delete this play?', '“' + esc(p.name) + '” will be removed from this device. This cannot be undone.', 'delDraft', 'Delete play', p.id); },
  delDraft(el) { book = book.filter(x => x.id !== el.dataset.id); saveBook(); closeSheet(); goHome(); },
  saveCopy() { where = { kind: 'draft' }; play.id = uuid(); save(); setEditorChrome(); history.replaceState(null, '', baseUrl()); toast('Saved as a scratch play on this device.'); },
  addToPb() {
    if (!user) { sheet(head('Add to playbook') + '<p class="note">Sign in to save this play to a playbook. It stays in your scratch plays on this device in the meantime.</p><div class="btns"><button type="button" class="btn primary" data-act="account">Sign in</button></div>'); return; }
    save(); pickPlaybookSheet();
  },
  pickPb(el) { const pb = (view.pick || []).find(b => b.id === el.dataset.id); if (pb) addPlayTo(pb); },
  newPbForPlay() { nameSheet('New playbook', '', 'newForPlay'); },

  // playbooks
  openPb(el) { const pb = (view.pbs || []).find(b => b.id === el.dataset.id); if (pb) openPb(pb); },
  newPb() { nameSheet('New playbook', '', 'new'); },
  renamePb() { nameSheet('Rename playbook', view.pb.name, 'rename'); },
  askDelPb() { confirmSheet('Delete this playbook?', '“' + esc(view.pb.name) + '” and every play in it will be deleted for everyone. This cannot be undone.', 'delPb', 'Delete playbook'); },
  async delPb() { const { error } = await sb.from('timeout_playbooks').delete().eq('id', view.pb.id); if (error) { toast('Could not delete the playbook.'); return; } delete kept.plays[view.pb.id]; closeSheet(); goHome(); },
  askLeavePb() { confirmSheet('Leave this playbook?', 'You will lose access to “' + esc(view.pb.name) + '” until someone adds you again.', 'leavePb', 'Leave playbook'); },
  async leavePb() { const { error } = await sb.from('timeout_playbook_members').delete().eq('playbook_id', view.pb.id).eq('user_id', user.id); if (error) { toast('Could not leave the playbook.'); return; } closeSheet(); goHome(); },
  printPb() { if (!view.plays || !view.plays.length) { toast('There are no plays to print yet.'); return; } printPlays(view.plays); },
  newCloudPlay() { loadPlay(newPlay(), { kind: 'cloud', pb: view.pb }); $('playName').select(); },
  openCloud(el) { const p = (view.plays || []).find(x => x.id === el.dataset.id); if (p) loadPlay(clone(p), { kind: 'cloud', pb: view.pb }); },
  async dupCloud(el) {
    const p = (view.plays || []).find(x => x.id === el.dataset.id); if (!p) return;
    const c = clone(p); c.id = uuid(); c.name = (p.name + ' copy').slice(0, 60); c.updatedAt = Date.now();
    const { error } = await sb.from('timeout_plays').insert({ id: c.id, playbook_id: view.pb.id, data: c, rev: c.updatedAt });
    if (error) toast('Could not copy the play.'); else openPb(view.pb);
  },
  askDelCloud(el) { const p = (view.plays || []).find(x => x.id === el.dataset.id); if (p) confirmSheet('Delete this play?', '“' + esc(p.name) + '” will be removed from the playbook for everyone. This cannot be undone.', 'delCloud', 'Delete play', p.id); },
  async delCloud(el) {
    delete pendingSaves[el.dataset.id]; LS.set('timeout.pending', pendingSaves);
    const { error } = await sb.from('timeout_plays').delete().eq('id', el.dataset.id);
    closeSheet(); if (error) toast('Could not delete the play.'); else openPb(view.pb);
  },

  // people
  people() { peopleSheet(); },
  async rmPerson(el) { const { error } = await sb.from('timeout_playbook_members').delete().eq('playbook_id', view.pb.id).eq('user_id', el.dataset.id); peopleSheet(error ? { text: 'Could not remove that person.' } : { ok: true, text: 'Removed.' }); },
  async rmInvite(el) { const { error } = await sb.from('timeout_invites').delete().eq('playbook_id', view.pb.id).eq('email', el.dataset.id); peopleSheet(error ? { text: 'Could not remove that invite.' } : { ok: true, text: 'Invite removed.' }); },

  // sharing a single play
  shPdf() { printPlays([play]); },
  shImage() { composeImage(play).toBlob(b => { if (b) deliverSheet('Image ready', b, fileBase() + '.png', 'image'); else toast('The image could not be created.'); }, 'image/png'); },
  shVideo() { recordVideo(); },
  async shLink() {
    const url = await makeLink();
    sheet(head('Link to this play') + '<div class="field"><input id="linkOut" readonly value="' + esc(url) + '"></div>' +
      '<div class="btns"><button type="button" class="btn primary" data-act="copyLink">Copy link</button>' + (navigator.share ? '<button type="button" class="btn" data-act="sendLink">Send</button>' : '') + '</div>' +
      '<p class="note">Anyone with this link can view the play and save their own copy. Later changes you make are not sent to them.</p>');
  },
  async copyLink() { const inp = $('linkOut'); try { await navigator.clipboard.writeText(inp.value); } catch { inp.select(); document.execCommand('copy'); } toast('Link copied.'); },
  sendLink() { navigator.share({ title: play.name, text: play.name + ' – basketball play', url: $('linkOut').value }).catch(() => {}); },
  sendFile() { if (pending) navigator.share({ files: [pending.file], title: play.name }).catch(() => {}); },
};
document.addEventListener('click', e => {
  if (e.target === $('scrim')) { closeSheet(); return; }
  const el = e.target.closest('[data-act]'); if (el && actions[el.dataset.act]) actions[el.dataset.act](el, e);
});
document.addEventListener('change', async e => {
  const el = e.target.closest('[data-change]'); if (!el) return;
  const q = el.dataset.change === 'role'
    ? sb.from('timeout_playbook_members').update({ role: el.value }).eq('playbook_id', view.pb.id).eq('user_id', el.dataset.id)
    : sb.from('timeout_invites').update({ role: el.value }).eq('playbook_id', view.pb.id).eq('email', el.dataset.id);
  const { error } = await q; peopleSheet(error ? { text: 'Could not change that role.' } : { ok: true, text: 'Role updated.' });
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const kind = e.target.dataset.form;
  if (kind === 'text') {
    const txt = $('markText').value.trim(), { mark, at } = textTarget; closeSheet();
    if (!txt) { if (mark) edit(s => { s.marks = s.marks.filter(x => x !== mark); }); return; }
    edit(s => { if (mark) mark.text = txt; else s.marks.push({ id: uuid().slice(0, 8), kind: 'text', x: at.x, y: at.y, text: txt }); });
  }
  if (kind === 'auth') {
    const mode = (e.submitter && e.submitter.dataset.mode) || 'in', email = $('authEmail').value.trim(), password = $('authPass').value;
    let r;
    try { const c = await cloud(); r = mode === 'up' ? await c.auth.signUp({ email, password, options: { emailRedirectTo: baseUrl() } }) : await c.auth.signInWithPassword({ email, password }); }
    catch { renderAuth({ text: 'Could not reach the sign-in service. Check your connection and try again.' }); return; }
    if (r.error) { renderAuth({ text: r.error.message }); return; }
    if (mode === 'up' && !r.data.session) { renderAuth({ ok: true, text: 'Check your email for a confirmation link, then sign in here.' }); return; }
    user = r.data.user; afterSignIn();
  }
  if (kind === 'pb') {
    const name = $('pbName').value.trim().slice(0, 60), mode = e.target.dataset.mode; if (!name) return;
    if (mode === 'rename') {
      const { error } = await sb.from('timeout_playbooks').update({ name }).eq('id', view.pb.id);
      if (error) { toast('Could not rename the playbook.'); return; }
      view.pb.name = name; closeSheet(); renderPb(view.pb, view.plays); return;
    }
    const { data, error } = await sb.from('timeout_playbooks').insert({ name }).select('id,name').single();
    if (error || !data) { toast('Could not create the playbook. Check your connection and try again.'); return; }
    const pb = { id: data.id, name: data.name, role: 'owner' };
    if (mode === 'newForPlay') addPlayTo(pb); else { closeSheet(); openPb(pb); }
  }
  if (kind === 'person') {
    const who = $('personWho').value.trim(), role = $('personRole').value;
    const { data, error } = await sb.rpc('timeout_add_person', { pb: view.pb.id, who, new_role: role });
    const text = error ? 'Could not add that person. Check your connection and try again.'
      : data === 'added' ? 'Added as ' + ROLES[role][0] + '.'
      : data === 'invited' ? 'No account uses that email yet. They will join as ' + ROLES[role][0] + ' when they create an account with it.'
      : data === 'self' ? 'That person is you or the owner, so they already have access.'
      : 'No profile has that username. Enter their email address to invite them instead.';
    peopleSheet({ ok: !error && (data === 'added' || data === 'invited'), text });
  }
});

$('playName').addEventListener('input', e => { play.name = e.target.value.slice(0, 60) || 'Untitled play'; save(); });
$('stepNote').addEventListener('input', e => { play.steps[st.cur].note = e.target.value; save(); });
$('level').addEventListener('change', e => { play.court.level = e.target.value; settings.level = e.target.value; LS.set('timeout.settings', settings); save(); layout(); });
$('tag').addEventListener('change', e => { play.tag = e.target.value; save(); });
$('defense').addEventListener('change', e => { st.defense = e.target.checked; render(); });
$('segView').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; play.court.view = b.dataset.view; press($('segView'), 'view', play.court.view); save(); layout(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('scrim').hidden) closeSheet();
  if (!$('app').hidden && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); e.shiftKey ? doUndo(redo, undo) : doUndo(undo, redo); }
});
window.addEventListener('hashchange', openFromHash);
window.addEventListener('online', flushSaves);
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSaves(); });

/* ================= start ================= */
$('app').dataset.side = settings.side;
new ResizeObserver(layout).observe($('courtWrap'));
(async function start() {
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
  if (/^#[ps]=/.test(location.hash) && await openFromHash()) { cloud().catch(() => {}); return; }
  if (!cloudOn) { goHome(); return; }
  try { await cloud(); } catch { /* offline with no saved copy of the sync library */ }
  if (user) afterSignIn(); else if (LS.get('timeout.guest', 0)) goHome(); else renderAuth();
})();
