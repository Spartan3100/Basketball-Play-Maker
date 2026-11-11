// Court geometry, wood painting and play rendering. No DOM state lives here.
export const M = 3, L = 94, W = 50; // margin, court length, court width (feet)
export const LEVELS = {
  hs:   { label: 'High school', R: 19.75,  c: 19.75, lane: 12,    ra: 0 },
  ncaa: { label: 'College',     R: 22.146, c: 21.65, lane: 12,    ra: 4 },
  nba:  { label: 'NBA',         R: 23.75,  c: 22,    lane: 16,    ra: 4 },
  fiba: { label: 'FIBA',        R: 22.15,  c: 21.65, lane: 16.08, ra: 4.1 },
};
export const WOODS = {
  maple:   { label: 'Light maple', base: [222, 176, 112], ink: '#131a23' },
  oak:     { label: 'Honey oak',   base: [201, 141, 74],  ink: '#131a23' },
  walnut:  { label: 'Dark walnut', base: [112, 70, 42],   ink: '#ffffff' },
  parquet: { label: 'Parquet',     base: [214, 165, 98],  ink: '#131a23' },
};
export const PAINTS = {
  navy: { label: 'Navy', hex: '#1d3a6b' }, red: { label: 'Red', hex: '#a8232b' },
  green: { label: 'Green', hex: '#1f6a45' }, purple: { label: 'Purple', hex: '#4b2a7a' },
  black: { label: 'Black', hex: '#1c1c1e' }, none: { label: 'No paint', hex: null },
};
export const POS = { o1: 'PG', o2: 'SG', o3: 'SF', o4: 'PF', o5: 'C' };
export const HOOPS = [{ x: 25, y: 5.25 }, { x: 25, y: L - 5.25 }];
const FONT = '"Barlow Condensed","Arial Narrow","Helvetica Neue",Arial,sans-serif';

export const P = (x, y) => ({ x, y });
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Fit the court into an available box. Full court lies sideways when the box is wide. */
export function makeGeo(availW, availH, view) {
  const full = view === 'full';
  const horiz = full && availW >= availH;
  const vw = horiz ? L + 2 * M : W + 2 * M;
  const vh = full ? (horiz ? W + 2 * M : L + 2 * M) : 47 + M + 1.5;
  const s = Math.min(availW / vw, availH / vh);
  return { s, horiz, view, w: Math.floor(vw * s), h: Math.floor(vh * s) };
}
export function S(g, x, y) { return g.horiz ? [(y + M) * g.s, (x + M) * g.s] : [(x + M) * g.s, (y + M) * g.s]; }
export function inv(g, px, py) { return g.horiz ? P(py / g.s - M, px / g.s - M) : P(px / g.s - M, py / g.s - M); }

function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tone(b, j) { return 'rgb(' + b.map(v => Math.max(0, Math.min(255, Math.round(v + j)))).join(',') + ')'; }

/** Paint wood, paint and lines onto a 2d context already scaled to CSS pixels. */
export function paintCourt(c, g, opt, level) {
  const wood = WOODS[opt.wood] || WOODS.oak, b = wood.base, r = rng(11);
  const full = g.view === 'full', yEnd = full ? L : 47, yMax = yEnd + M + 2, lv = LEVELS[level] || LEVELS.hs;
  const rect = (x0, y0, x1, y1) => { const a = S(g, x0, y0), q = S(g, x1, y1); c.fillRect(Math.min(a[0], q[0]), Math.min(a[1], q[1]), Math.abs(q[0] - a[0]), Math.abs(q[1] - a[1])); };
  const seg = (x0, y0, x1, y1) => { const a = S(g, x0, y0), q = S(g, x1, y1); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(q[0], q[1]); c.stroke(); };
  c.fillStyle = tone(b, -48); c.fillRect(0, 0, g.w + 2, g.h + 2);
  c.lineWidth = 1; const gap = .045;
  const board = (x0, y0, x1, y1, dir) => {
    c.fillStyle = tone(b, (r() - .5) * 30); rect(x0 + gap, y0 + gap, x1 - gap, y1 - gap);
    c.strokeStyle = 'rgba(70,35,10,.09)';
    for (let k = 0; k < 2; k++) {
      if (dir === 'y') { const gx = x0 + .15 + r() * (x1 - x0 - .3); seg(gx, y0 + .3, gx, y1 - .3); }
      else { const gy = y0 + .15 + r() * (y1 - y0 - .3); seg(x0 + .3, gy, x1 - .3, gy); }
    }
  };
  if (opt.wood === 'parquet') {
    const T = 5;
    for (let i = 0, x = -M - 1; x < W + M; x += T, i++) for (let j = 0, y = -M - 1; y < yMax; y += T, j++)
      for (let k = 0; k < 5; k++) { if ((i + j) % 2) board(x + k, y, x + k + 1, y + T, 'y'); else board(x, y + k, x + T, y + k + 1, 'x'); }
  } else {
    const pw = 1.3;
    for (let x = -M; x < W + M; x += pw) { let y = -M - r() * 9; while (y < yMax) { const len = 6 + r() * 8; board(x, y, x + pw, y + len, 'y'); y += len; } }
  }
  const paint = (PAINTS[opt.paint] || PAINTS.navy).hex;
  if (paint) {
    c.fillStyle = paint; c.globalAlpha = .92;
    rect(-M, -M, W + M, 0); rect(-M, 0, 0, yEnd + (full ? 0 : M + 2)); rect(W, 0, W + M, yEnd + (full ? 0 : M + 2)); if (full) rect(-M, L, W + M, L + M);
    c.globalAlpha = .85; rect(25 - lv.lane / 2, 0, 25 + lv.lane / 2, 19); if (full) rect(25 - lv.lane / 2, L - 19, 25 + lv.lane / 2, L);
    c.globalAlpha = 1;
  }
  const lw = Math.max(1.5, g.s * .2); c.strokeStyle = '#fff'; c.lineWidth = lw; c.lineJoin = 'round'; c.lineCap = 'butt';
  const poly = (pts, close) => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); if (close) c.closePath(); c.stroke(); };
  poly([S(g, 0, 0), S(g, W, 0), S(g, W, yEnd), S(g, 0, yEnd)], true);
  const end = flip => {
    const Q = (x, y) => S(g, x, flip ? L - y : y);
    const arc = (cx, cy, rad, a0, a1) => { const o = []; for (let i = 0; i <= 48; i++) { const a = a0 + (a1 - a0) * i / 48; o.push(Q(cx + rad * Math.cos(a), cy + rad * Math.sin(a))); } return o; };
    const hl = lv.lane / 2;
    poly([Q(25 - hl, 0), Q(25 - hl, 19), Q(25 + hl, 19), Q(25 + hl, 0)]);
    poly(arc(25, 19, 6, 0, Math.PI));
    c.setLineDash([g.s * 1.1, g.s * 1.1]); poly(arc(25, 19, 6, Math.PI, 2 * Math.PI)); c.setLineDash([]);
    const yc = 5.25 + Math.sqrt(Math.max(0, lv.R * lv.R - lv.c * lv.c));
    const a0 = Math.atan2(yc - 5.25, -lv.c), a1 = Math.atan2(yc - 5.25, lv.c);
    poly([Q(25 - lv.c, 0)].concat(arc(25, 5.25, lv.R, a0, a1), [Q(25 + lv.c, 0)]));
    if (lv.ra) poly([Q(25 + lv.ra, 4)].concat(arc(25, 5.25, lv.ra, 0, Math.PI), [Q(25 - lv.ra, 4)]));
    c.lineWidth = lw * 1.6; poly([Q(22, 4), Q(28, 4)]); c.lineWidth = lw;
    c.strokeStyle = '#e8642a'; const h = Q(25, 5.25); c.beginPath(); c.arc(h[0], h[1], g.s * .85, 0, 7); c.stroke(); c.strokeStyle = '#fff';
  };
  end(false);
  const cc = S(g, 25, 47); c.beginPath(); c.arc(cc[0], cc[1], 6 * g.s, 0, 7); c.stroke();
  if (full) { poly([S(g, 0, 47), S(g, W, 47)]); end(true); }
  const sh = c.createLinearGradient(0, 0, g.w, g.h); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.08)');
  c.fillStyle = sh; c.fillRect(0, 0, g.w + 2, g.h + 2);
}

/* ---------- path helpers ---------- */
export function plen(pts) { let n = 0; for (let i = 1; i < pts.length; i++) n += dist(pts[i - 1], pts[i]); return n; }
export function along(pts, t) {
  const tot = plen(pts); if (!tot) return pts[0]; let want = tot * t;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[i - 1], pts[i]);
    if (want <= d || i === pts.length - 1) { const k = d ? Math.min(1, want / d) : 0; return P(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k); }
    want -= d;
  }
  return pts[pts.length - 1];
}
export function lineDist(l, p) {
  let m = 1e9;
  for (let i = 1; i < l.pts.length; i++) {
    const a = l.pts[i - 1], b = l.pts[i], dx = b.x - a.x, dy = b.y - a.y, q = dx * dx + dy * dy;
    const t = q ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / q)) : 0;
    m = Math.min(m, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return m;
}
function rdp(p, eps) {
  if (p.length < 3) return p; let mx = 0, ix = 0; const a = p[0], b = p[p.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < p.length - 1; i++) { const d = Math.abs(dy * (p[i][0] - a[0]) - dx * (p[i][1] - a[1])) / len; if (d > mx) { mx = d; ix = i; } }
  if (mx <= eps) return [a, b]; return rdp(p.slice(0, ix + 1), eps).slice(0, -1).concat(rdp(p.slice(ix), eps));
}
function resample(p, step) {
  const o = [p[0]]; let carry = 0;
  for (let i = 1; i < p.length; i++) { const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], d = Math.hypot(dx, dy); if (!d) continue; let t = step - carry; while (t <= d) { o.push([p[i - 1][0] + dx * t / d, p[i - 1][1] + dy * t / d]); t += step; } carry = (carry + d) % step; }
  o.push(p[p.length - 1]); return o;
}
function back(p, d) {
  let acc = 0;
  for (let i = p.length - 1; i > 0; i--) { const s = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (s && acc + s >= d) { const k = (d - acc) / s; return [p[i][0] + (p[i - 1][0] - p[i][0]) * k, p[i][1] + (p[i - 1][1] - p[i][1]) * k]; } acc += s; }
  return p[0];
}

function drawLine(ctx, g, ln, opt) {
  let sp = ln.pts.map(p => S(g, p.x, p.y)); if (sp.length < 2) return;
  const ink = (WOODS[opt.wood] || WOODS.oak).ink, mk = opt.feel === 'marker';
  ctx.save(); ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = mk ? Math.max(3.2, g.s * .42) : Math.max(2, g.s * .26); if (mk) ctx.globalAlpha = .86;
  if (!mk) sp = rdp(sp, 3);
  const e = sp[sp.length - 1], pb = back(sp, 12), ang = Math.atan2(e[1] - pb[1], e[0] - pb[0]);
  ctx.beginPath();
  if (ln.type === 'dribble') {
    const rs = resample(sp, 2.5), tot = (rs.length - 1) * 2.5, amp = Math.max(3, g.s * .5), wl = Math.max(12, g.s * 1.9);
    rs.forEach((p, i) => {
      const q = rs[Math.min(rs.length - 1, i + 1)], o = rs[Math.max(0, i - 1)], a = Math.atan2(q[1] - o[1], q[0] - o[0]), dd = i * 2.5;
      const taper = Math.min(1, dd / 8, (tot - dd) / 16), off = Math.sin(dd / wl * Math.PI * 2) * amp * Math.max(0, taper);
      const x = p[0] - Math.sin(a) * off, y = p[1] + Math.cos(a) * off; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
  } else {
    if (ln.type === 'pass') ctx.setLineDash([Math.max(7, g.s * .9), Math.max(6, g.s * .8)]);
    if (ln.type === 'shot') ctx.setLineDash([1, Math.max(6, g.s * .75)]);
    ctx.moveTo(sp[0][0], sp[0][1]);
    if (mk || sp.length < 3) sp.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    else { for (let i = 1; i < sp.length - 1; i++) { const mx = (sp[i][0] + sp[i + 1][0]) / 2, my = (sp[i][1] + sp[i + 1][1]) / 2; ctx.quadraticCurveTo(sp[i][0], sp[i][1], mx, my); } ctx.lineTo(e[0], e[1]); }
  }
  ctx.stroke(); ctx.setLineDash([]);
  if (ln.type === 'screen') { const h = Math.max(10, g.s * 1.5); ctx.beginPath(); ctx.moveTo(e[0] - Math.sin(ang) * h, e[1] + Math.cos(ang) * h); ctx.lineTo(e[0] + Math.sin(ang) * h, e[1] - Math.cos(ang) * h); ctx.stroke(); }
  else {
    const a = Math.max(10, g.s * 1.25); ctx.beginPath(); ctx.moveTo(e[0] + Math.cos(ang) * a * .35, e[1] + Math.sin(ang) * a * .35);
    ctx.lineTo(e[0] - Math.cos(ang - .45) * a, e[1] - Math.sin(ang - .45) * a); ctx.lineTo(e[0] - Math.cos(ang + .45) * a, e[1] - Math.sin(ang + .45) * a); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

/* ---------- where everything is at time t (0..1) within a step ---------- */
export function stateAt(step, t) {
  const pos = {}; for (const k in step.pos) pos[k] = step.pos[k];
  step.lines.forEach(l => { if (l.from && (l.type === 'cut' || l.type === 'dribble' || l.type === 'screen') && pos[l.from]) pos[l.from] = along(l.pts, t); });
  let ball = step.ball ? pos[step.ball] || null : step.ballPos || null;
  if (step.ball && ball) {
    const fly = step.lines.find(l => (l.type === 'pass' || l.type === 'shot') && l.from === step.ball);
    if (fly) { const b = (fly.to && pos[fly.to]) || fly.pts[fly.pts.length - 1]; ball = P(ball.x + (b.x - ball.x) * t, ball.y + (b.y - ball.y) * t); }
  }
  return { pos, ball, held: !!step.ball };
}
export function endOf(step) {
  const s = stateAt(step, 1); let ball = step.ball, ballPos = step.ballPos || null;
  const fly = step.ball && step.lines.find(l => (l.type === 'pass' || l.type === 'shot') && l.from === step.ball);
  if (fly) {
    const e = fly.pts[fly.pts.length - 1];
    if (fly.type === 'shot') { ball = null; ballPos = P(e.x, e.y); }
    else if (fly.to) ball = fly.to;
    else { let best = 5; for (const k in s.pos) if (k[0] === 'o' && dist(s.pos[k], e) < best) { best = dist(s.pos[k], e); ball = k; } }
  }
  return { pos: s.pos, ball, ballPos };
}

function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/** Draw one step of a play on top of an already painted court. */
export function drawScene(ctx, g, play, i, t, opt, extra = {}) {
  const step = play.steps[i]; if (!step) return;
  const ink = (WOODS[opt.wood] || WOODS.oak).ink, paint = (PAINTS[opt.paint] || PAINTS.navy).hex || '#27313d';
  const r = Math.max(11, Math.min(19, g.s * 1.6));
  step.lines.forEach(l => drawLine(ctx, g, l, opt)); if (extra.draft) drawLine(ctx, g, extra.draft, opt);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  (step.marks || []).forEach(m => {
    const p = S(g, m.x, m.y);
    if (m.kind === 'cone') {
      ctx.beginPath(); ctx.moveTo(p[0], p[1] - r * .85); ctx.lineTo(p[0] + r * .7, p[1] + r * .65); ctx.lineTo(p[0] - r * .7, p[1] + r * .65); ctx.closePath();
      ctx.fillStyle = '#f08a1c'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#5a2c00'; ctx.stroke();
    } else if (m.kind === 'coach') {
      roundRect(ctx, p[0] - r * .85, p[1] - r * .85, r * 1.7, r * 1.7, 4); ctx.fillStyle = '#f4d23c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1a1f27'; ctx.stroke();
      ctx.fillStyle = '#1a1f27'; ctx.font = '700 ' + Math.round(r * 1.15) + 'px ' + FONT; ctx.fillText('C', p[0], p[1] + 1);
    } else {
      ctx.font = '600 ' + Math.round(Math.max(12, r * .95)) + 'px ' + FONT; const tw = ctx.measureText(m.text || '').width, th = Math.max(12, r * .95) + 8;
      roundRect(ctx, p[0] - tw / 2 - 7, p[1] - th / 2, tw + 14, th, 5); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
      ctx.fillStyle = '#131a23'; ctx.fillText(m.text || '', p[0], p[1] + 1);
    }
  });
  const s = stateAt(step, t);
  for (const id in s.pos) {
    const off = id[0] === 'o'; if (!off && extra.defense === false) continue;
    const p = S(g, s.pos[id].x, s.pos[id].y), n = id.slice(1);
    if (opt.markers === 'chalk') {
      ctx.fillStyle = ink; ctx.strokeStyle = ink;
      if (off) {
        ctx.font = '700 ' + Math.round(r * 1.7) + 'px ' + FONT; ctx.fillText(n, p[0], p[1] + 1);
        if (id === step.ball && t === 0) { ctx.lineWidth = Math.max(2, g.s * .22); ctx.beginPath(); ctx.arc(p[0], p[1], r * 1.05, 0, 7); ctx.stroke(); }
      } else { ctx.font = '700 ' + Math.round(r * 1.55) + 'px ' + FONT; ctx.fillText('X', p[0] - r * .15, p[1] + 1); ctx.font = '700 ' + Math.round(r * .8) + 'px ' + FONT; ctx.fillText(n, p[0] + r * .7, p[1] + r * .5); }
    } else {
      ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7);
      if (off) { ctx.fillStyle = paint; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#fff'; }
      else { ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1a1f27'; ctx.stroke(); ctx.fillStyle = '#1a1f27'; }
      const lab = off ? (opt.markers === 'pos' ? POS[id] : n) : 'X' + n;
      ctx.font = '700 ' + Math.round(r * (lab.length > 1 ? .95 : 1.25)) + 'px ' + FONT; ctx.fillText(lab, p[0], p[1] + 1);
    }
  }
  if (s.ball) {
    const p = S(g, s.ball.x, s.ball.y), br = r * .5, k = s.held ? r * .85 : 0, x = p[0] + k, y = p[1] + k;
    ctx.beginPath(); ctx.arc(x, y, br, 0, 7); ctx.fillStyle = '#e8642a'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#3a1705'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - br, y); ctx.lineTo(x + br, y); ctx.moveTo(x, y - br); ctx.lineTo(x, y + br); ctx.lineWidth = 1; ctx.stroke();
  }
  if (extra.caption) {
    ctx.font = '600 ' + Math.round(Math.max(13, Math.min(18, g.w / 32))) + 'px ' + FONT;
    let txt = extra.caption; const maxW = g.w - 40; while (ctx.measureText(txt).width > maxW && txt.length > 4) txt = txt.slice(0, -2); if (txt !== extra.caption) txt += '…';
    const tw = ctx.measureText(txt).width, bh = 30, bx = (g.w - tw) / 2 - 12, by = g.h - bh - 10;
    roundRect(ctx, bx, by, tw + 24, bh, 8); ctx.fillStyle = 'rgba(12,16,22,.82)'; ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(txt, g.w / 2, by + bh / 2 + 1);
  }
}
