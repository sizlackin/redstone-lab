/* ================= Drawing (SVG paths, 40×40 per square, drawn facing east then rotated) ================= */
const r2 = (n) => Math.round(n * 100) / 100;
function R(x, y, w, h) { return 'M' + r2(x) + ' ' + r2(y) + 'h' + r2(w) + 'v' + r2(h) + 'h' + r2(-w) + 'z'; }
function CIRC(cx, cy, r) {
  return 'M' + r2(cx - r) + ' ' + r2(cy) + 'a' + r + ' ' + r + ' 0 1 0 ' + r2(2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + r2(-2 * r) + ' 0z';
}
function RR(x, y, w, h, r) {
  return 'M' + r2(x + r) + ' ' + r2(y) + 'h' + r2(w - 2 * r) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + r + 'v' + r2(h - 2 * r) +
    'a' + r + ' ' + r + ' 0 0 1 ' + -r + ' ' + r + 'h' + r2(-(w - 2 * r)) + 'a' + r + ' ' + r + ' 0 0 1 ' + -r + ' ' + -r +
    'v' + r2(-(h - 2 * r)) + 'a' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + -r + 'z';
}
const ROT = (f) => (f === 1 || f < 0 ? undefined : 'rotate(' + (f - 1) * 90 + ' 20 20)');
function rotPt(x, y, f) {
  const k = (f + 3) & 3;
  let px = x, py = y;
  for (let n = 0; n < k; n++) { const nx = 40 - py, ny = px; px = nx; py = ny; }
  return [px, py];
}
function prim(d, fill, o) {
  const p = { d, fill: fill || 'none' };
  if (o) for (const k in o) if (o[k] !== undefined) p[k] = o[k];
  return p;
}
const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], C: ['011', '100', '100', '100', '011'], S: ['011', '100', '010', '001', '110'],
};
function pxText(str, x, y, s) {
  let d = '', cx = x;
  for (const ch of String(str)) {
    const g = FONT[ch];
    if (g) for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r][k] === '1') d += R(cx + k * s, y + r * s, s, s);
    cx += 4 * s;
  }
  return d || 'M0 0';
}
function numBadge(v, cx, cy) {
  const str = String(v), s = 1.6, w = str.length * 4 * s - s, h = 5 * s, x = cx - w / 2, y = cy - h / 2;
  return [prim(RR(x - 2.2, y - 2.2, w + 4.4, h + 4.4, 2), '#0a0b0e', { op: 0.86 }), prim(pxText(str, x, y, s), '#ffffff', { sr: 'crispEdges' })];
}

/* ---- Pixel sprites: every part is a 16 × 16 texel picture, like a block texture.
   Original art in a vanilla-like style with Redstone Tweaks-style indicators:
   arrows always point the way the signal (or push) goes, and numbers or letters show hidden states. ---- */
const TX = 2.5;
const SLAB = '#a9a9a9';
const RED = '#ff3b1f', RED_HI = '#ffc2a6', RED_OFF = '#5e1710', RED_DIM = '#7c1d14';
function grid16() { const g = []; for (let y = 0; y < 16; y++) g.push(new Array(16).fill('')); return g; }
function gFill(g, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < 16 && j < 16) g[j][i] = c;
}
function gPix(g, pts, c) { for (let k = 0; k + 1 < pts.length; k += 2) gFill(g, pts[k], pts[k + 1], 1, 1, c); }
function gFrame(g, x, y, w, h, c) { gFill(g, x, y, w, 1, c); gFill(g, x, y + h - 1, w, 1, c); gFill(g, x, y, 1, h, c); gFill(g, x + w - 1, y, 1, h, c); }
function hsh(x, y, s) {
  let h = Math.imul(x + 31, 374761393) ^ Math.imul(y + 17, 668265263) ^ Math.imul(s + 7, 1103515245);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function gNoise(g, x, y, w, h, shades, s) {
  let tot = 0;
  for (const sh of shades) tot += sh[1];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    let r = hsh(i, j, s) * tot;
    for (const sh of shades) { if (r < sh[1]) { gFill(g, i, j, 1, 1, sh[0]); break; } r -= sh[1]; }
  }
}
function gCobble(g, x0, y0, w, h, s) {
  const tones = ['#8b8b8b', '#7a7a7a', '#979797', '#717171', '#848484', '#9e9e9e', '#808080'];
  const seeds = tones.map((t, k) => [x0 + hsh(k, 1, s) * w, y0 + hsh(k, 2, s) * h, t]);
  for (let j = y0; j < y0 + h; j++) for (let i = x0; i < x0 + w; i++) {
    let b1 = 1e9, b2 = 1e9, col = tones[0];
    for (const sd of seeds) {
      const d = (i + 0.5 - sd[0]) * (i + 0.5 - sd[0]) + (j + 0.5 - sd[1]) * (j + 0.5 - sd[1]);
      if (d < b1) { b2 = b1; b1 = d; col = sd[2]; } else if (d < b2) b2 = d;
    }
    gFill(g, i, j, 1, 1, Math.sqrt(b2) - Math.sqrt(b1) < 0.85 ? '#545454' : col);
  }
}
function gPlanks(g, x, y, w, h) {
  gFill(g, x, y, w, h, '#a17c48');
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
    const r = hsh(i, j, 77);
    if (r < 0.16) gFill(g, i, j, 1, 1, '#8a683b'); else if (r > 0.9) gFill(g, i, j, 1, 1, '#b8925a');
  }
  for (let j = y + 3; j < y + h; j += 4) gFill(g, x, j, w, 1, '#6e5230');
}
/* Turns a 16×16 colour grid into one SVG path per colour (rows merged into runs). */
function gPrims(g, o) {
  o = o || {};
  const runs = new Map();
  for (let y = 0; y < 16; y++) {
    let x = 0;
    while (x < 16) {
      const c = g[y][x];
      if (!c) { x++; continue; }
      let e = x + 1;
      while (e < 16 && g[y][e] === c) e++;
      runs.set(c, (runs.get(c) || '') + 'M' + r2(x * TX) + ' ' + r2(y * TX) + 'h' + r2((e - x) * TX) + 'v' + TX + 'h' + r2(-(e - x) * TX) + 'z');
      x = e;
    }
  }
  const out = [];
  if (o.base) out.push(prim(R(o.base[0] * TX, o.base[1] * TX, o.base[2] * TX, o.base[3] * TX), o.baseColor, { tr: o.tr, op: o.op, sr: 'crispEdges' }));
  for (const [c, d] of runs) if (!(o.base && c === o.baseColor)) out.push(prim(d, c, { tr: o.tr, op: o.op, sr: 'crispEdges' }));
  return out;
}
/* Upright pixel text placed at a point of a sprite that is drawn facing east and then turned to face f. */
function glyphAt(str, cx, cy, f, color) {
  const s = String(str), p = f >= 0 ? rotPt(cx, cy, f) : [cx, cy];
  const w = (s.length * 4 - 1) * TX, h = 5 * TX;
  const x = Math.round((p[0] - w / 2) / TX) * TX, y = Math.round((p[1] - h / 2) / TX) * TX;
  return [prim(pxText(s, x, y, TX), color, { sr: 'crispEdges' })];
}
/* Dust colour follows the game's own power ramp: dark red at 0, orange-red at 15. */
function dustRGB(p) {
  const f = p / 15;
  const r = f * 0.6 + (f > 0 ? 0.4 : 0.36), g = Math.min(1, Math.max(0, f * f * 0.7 - 0.5)), b = Math.min(1, Math.max(0, f * f * 0.6 - 0.7));
  return [r * 255, g * 255, b * 255];
}
const rgb = (r, g, b) => 'rgb(' + Math.round(Math.min(255, r)) + ',' + Math.round(Math.min(255, g)) + ',' + Math.round(Math.min(255, b)) + ')';
function dustPath(sh, w) {
  if (sh === 0) return CIRC(20, 20, w * 0.75);
  const a = 20 - w / 2;
  let d = R(a, a, w, w);
  if (sh & 1) d += R(a, 0, w, a + 0.5);
  if (sh & 2) d += R(20 + w / 2 - 0.5, a, 20 - w / 2 + 0.5, w);
  if (sh & 4) d += R(a, 20 + w / 2 - 0.5, w, 20 - w / 2 + 0.5);
  if (sh & 8) d += R(0, a, a + 0.5, w);
  return d;
}
function spDust(c, nums) {
  const k = dustRGB(c.p), col = rgb(k[0], k[1], k[2]), dk = rgb(k[0] * 0.66, k[1] * 0.66, k[2] * 0.66), hi = rgb(k[0] * 1.1 + 28, k[1] * 1.15 + 22, k[2] + 12);
  const g = grid16(), sh = c.sh, out = [];
  if (sh === 0) {
    gFill(g, 6, 5, 4, 6, col); gFill(g, 5, 6, 6, 4, col);
    gPix(g, [6, 6, 9, 9, 6, 9], dk); gPix(g, [8, 6], hi);
  } else {
    gFill(g, 6, 6, 4, 4, col);
    gPix(g, [7, 5, 8, 5, 10, 7, 10, 8, 7, 10, 8, 10, 5, 7, 5, 8], col);
    if (sh & 1) { gFill(g, 7, 0, 2, 6, col); gPix(g, [6, 1, 9, 3, 6, 4], dk); }
    if (sh & 2) { gFill(g, 10, 7, 6, 2, col); gPix(g, [11, 6, 13, 9, 15, 6], dk); }
    if (sh & 4) { gFill(g, 7, 10, 2, 6, col); gPix(g, [9, 11, 6, 13, 9, 14], dk); }
    if (sh & 8) { gFill(g, 0, 7, 6, 2, col); gPix(g, [1, 9, 3, 6, 4, 9], dk); }
    gPix(g, [7, 8, 8, 9], dk); gPix(g, [8, 7], hi);
  }
  if (c.p > 0) out.push(prim(dustPath(sh, 15), col, { op: 0.18 }));
  out.push(...gPrims(g));
  if (nums && c.p > 0) out.push(...numBadge(c.p, 9, 9));
  return out;
}
function stoneTop(g, s) {
  gNoise(g, 0, 0, 16, 16, [['#7f7f7f', 56], ['#8b8b8b', 20], ['#747474', 17], ['#6a6a6a', 7]], s);
  gFill(g, 0, 0, 16, 1, '#989898'); gFill(g, 0, 0, 1, 16, '#929292'); gFill(g, 0, 15, 16, 1, '#5d5d5d'); gFill(g, 15, 0, 1, 16, '#646464');
}
function spBlock(pw) {
  const g = grid16();
  stoneTop(g, 3);
  if (pw && pw.strong > 0) { gFrame(g, 2, 2, 12, 12, RED); gFill(g, 6, 6, 4, 4, RED); gPix(g, [7, 7], RED_HI); }
  else if (pw && pw.weak > 0) for (let k = 2; k < 14; k += 2) gPix(g, [k, 2, k + 1, 13, 2, k + 1, 13, k], '#d0301b');
  return gPrims(g, { base: [0, 0, 16, 16], baseColor: '#7f7f7f' });
}
function spGlass() {
  const g = grid16();
  gFrame(g, 0, 0, 16, 16, '#d3edf3');
  gPix(g, [1, 1, 2, 1, 1, 2], '#ffffff');
  gPix(g, [3, 8, 4, 7, 5, 6, 6, 5, 7, 4, 8, 3, 4, 9, 5, 8], '#e6f5f8');
  gPix(g, [10, 13, 11, 12, 12, 11, 13, 10], '#e6f5f8');
  return [prim(R(TX, TX, 14 * TX, 14 * TX), '#a6dbe9', { op: 0.15 }), ...gPrims(g)];
}
function spRBlock() {
  const g = grid16();
  gNoise(g, 0, 0, 16, 16, [['#a3200f', 58], ['#bd2a17', 20], ['#7c160b', 16], ['#e5452b', 6]], 41);
  gFill(g, 0, 0, 16, 1, '#cf3a22'); gFill(g, 0, 0, 1, 16, '#c63520'); gFill(g, 0, 15, 16, 1, '#5e1006'); gFill(g, 15, 0, 1, 16, '#6a1208');
  return gPrims(g, { base: [0, 0, 16, 16], baseColor: '#a3200f' });
}
function spTorch(c) {
  const lit = c.lit, burnt = !!c.burnt && !lit;
  const head = lit ? RED : burnt ? '#6f6f6f' : '#661812', hi = lit ? RED_HI : burnt ? '#8f8f8f' : '#842619', rim = lit ? '#d92a14' : burnt ? '#5f5f5f' : '#4d120d';
  const g = grid16(), out = [];
  if (c.f < 0) {
    if (lit) out.push(prim(CIRC(20, 12.5, 12), '#ff5a36', { op: 0.22 }));
    gFill(g, 7, 7, 2, 8, '#6b4d2a'); gFill(g, 7, 7, 1, 8, '#8c6a3c');
    gFill(g, 6, 3, 4, 4, head); gPix(g, [6, 3, 9, 3, 6, 6, 9, 6], rim); gPix(g, [7, 4], hi);
    if (burnt) gPix(g, [5, 1, 8, 0, 10, 1], '#9a9a9a');
    out.push(...gPrims(g));
  } else {
    const tr = ROT(c.f);
    if (lit) out.push(prim(CIRC(27.5, 20, 12), '#ff5a36', { op: 0.22, tr }));
    gFill(g, 0, 5, 2, 6, '#4f4f4f'); gFill(g, 0, 5, 1, 6, '#6a6a6a');
    gFill(g, 2, 7, 7, 2, '#6b4d2a'); gFill(g, 2, 7, 7, 1, '#8c6a3c');
    gFill(g, 9, 6, 4, 4, head); gPix(g, [9, 6, 12, 6, 9, 9, 12, 9], rim); gPix(g, [10, 7], hi);
    if (burnt) gPix(g, [10, 3, 12, 2, 13, 4], '#9a9a9a');
    out.push(...gPrims(g, { tr }));
  }
  return out;
}
function slabTop(g) {
  gNoise(g, 0, 0, 16, 16, [[SLAB, 70], ['#b3b3b3', 18], ['#a0a0a0', 12]], 5);
  gFrame(g, 0, 0, 16, 16, '#858585');
  gFill(g, 1, 1, 14, 1, '#c3c3c3');
}
function gTorchTop(g, x, y, lit) {
  gFill(g, x, y, 4, 4, '#3d2b19');
  gFill(g, x + 1, y + 1, 2, 2, lit ? RED : RED_OFF);
  if (lit) gPix(g, [x + 1, y + 1], RED_HI);
}
function gArrowHead(g, x, c) {
  gFill(g, x, 4, 1, 8, c); gFill(g, x + 1, 5, 1, 6, c); gFill(g, x + 2, 6, 1, 4, c); gFill(g, x + 3, 7, 1, 2, c);
}
function gSocket(g) { gFill(g, 0, 6, 2, 4, '#5b5b5b'); gFill(g, 0, 7, 1, 2, '#3a3a3a'); }
/* Repeater, drawn facing east: input socket on the west edge, signal channel, big arrow on the output side,
   the fixed torch next to the arrow and the delay torch further back. The delay number is printed upright. */
function spRepeater(c) {
  const tr = ROT(c.f), on = c.on, g = grid16();
  slabTop(g);
  gSocket(g);
  gFill(g, 2, 7, 10, 2, on ? '#d42a14' : '#6a1a12');
  gArrowHead(g, 12, on ? RED : RED_DIM);
  if (c.lock) { gFill(g, 5, 2, 2, 12, '#2c2c2c'); gPix(g, [5, 4, 6, 8, 5, 11], '#4a4a4a'); }
  else gTorchTop(g, 5 - c.d, 6, on);
  gTorchTop(g, 8, 6, on);
  return [...gPrims(g, { tr, base: [0, 0, 16, 16], baseColor: SLAB }), ...glyphAt(c.d, 8.75, 31.25, c.f, on ? '#a3120a' : '#3d3d3d')];
}
/* Comparator, drawn facing east: two back torches (input side), front mode torch, arrow on the output side,
   and a C (compare) or S (subtract) letter. */
function spComparator(c) {
  const tr = ROT(c.f), on = c.on, g = grid16(), ln = on ? '#d42a14' : '#6a1a12';
  slabTop(g);
  gSocket(g);
  gFill(g, 2, 5, 2, 6, ln); gFill(g, 4, 7, 4, 2, ln);
  gTorchTop(g, 1, 1, on); gTorchTop(g, 1, 11, on); gTorchTop(g, 8, 6, c.sub);
  gArrowHead(g, 12, on ? RED : RED_DIM);
  return [...gPrims(g, { tr, base: [0, 0, 16, 16], baseColor: SLAB }), ...glyphAt(c.sub ? 'S' : 'C', 18.75, 31.25, c.f, '#3d3d3d')];
}
/* Observer, drawn facing east: the face (two eyes) watches east; the arrow points to the output port on the west. */
function spObserver(c) {
  const tr = ROT(c.f), on = c.on, g = grid16(), ac = on ? RED : '#a3a3a3';
  gNoise(g, 0, 0, 16, 16, [['#5c5c5c', 60], ['#646464', 24], ['#535353', 16]], 31);
  gFrame(g, 0, 0, 16, 16, '#3a3a3a');
  gFill(g, 1, 3, 10, 1, '#4a4a4a'); gFill(g, 1, 12, 10, 1, '#4a4a4a');
  gFill(g, 12, 1, 3, 14, '#2b2b2b');
  gFill(g, 13, 3, 1, 3, '#c7c7c7'); gFill(g, 13, 10, 1, 3, '#c7c7c7');
  gFill(g, 6, 7, 5, 2, ac); gFill(g, 5, 5, 1, 6, ac); gFill(g, 4, 6, 1, 4, ac); gFill(g, 3, 7, 1, 2, ac);
  gFill(g, 0, 6, 2, 4, '#242424'); gFill(g, 0, 7, 2, 2, on ? RED : RED_OFF);
  return gPrims(g, { tr, base: [0, 0, 16, 16], baseColor: '#5c5c5c' });
}
function gSlime(g) { gFill(g, 14, 1, 2, 14, '#76bf55'); gPix(g, [15, 2, 15, 6, 14, 10, 15, 13], '#a9e38c'); gPix(g, [14, 4, 14, 12], '#5a9a3f'); }
/* Piston, drawn facing east: cobblestone body with a push arrow, wooden head on the east side (green = sticky). */
function spPiston(c) {
  const tr = ROT(c.f), g = grid16();
  gCobble(g, 0, 0, 12, 16, 4);
  if (!c.ext) {
    gPlanks(g, 12, 0, 4, 16);
    gFill(g, 12, 0, 1, 16, '#5c4326');
    if (c.sticky) gSlime(g);
    gPix(g, [4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 6, 9, 5, 10, 4, 11, 5, 4, 6, 5, 7, 6, 8, 7, 8, 8, 7, 9, 6, 10, 5, 11], '#3b3b3b');
  } else {
    gFill(g, 12, 0, 4, 16, '#353535');
    gFill(g, 5, 6, 11, 4, '#a8844f'); gFill(g, 5, 6, 11, 1, '#c29c62'); gFill(g, 5, 9, 11, 1, '#7a5a33');
    gFill(g, 0, 7, 1, 2, RED);
  }
  return gPrims(g, { tr });
}
function spHead(c) {
  const tr = ROT(c.f), g = grid16();
  gFill(g, 0, 6, 12, 4, '#a8844f'); gFill(g, 0, 6, 12, 1, '#c29c62'); gFill(g, 0, 9, 12, 1, '#7a5a33');
  gPlanks(g, 12, 0, 4, 16);
  gFill(g, 12, 0, 1, 16, '#5c4326');
  if (c.sticky) gSlime(g);
  return gPrims(g, { tr });
}
function spLever(c) {
  const g = grid16(), on = c.on, knob = on ? RED : '#4d3b28';
  const stick = (pts) => { for (let k = 0; k + 1 < pts.length; k += 2) gFill(g, pts[k], pts[k + 1], 2, 1, '#8c6a3c'); };
  if (c.f < 0) {
    gCobble(g, 4, 5, 8, 7, 21); gFrame(g, 4, 5, 8, 7, '#4a4a4a');
    stick(on ? [8, 7, 9, 6, 10, 5, 11, 4] : [6, 8, 5, 9, 4, 10, 3, 11]);
    gFill(g, on ? 12 : 1, on ? 1 : 12, 3, 3, knob);
    return gPrims(g);
  }
  gCobble(g, 0, 3, 4, 10, 21); gFrame(g, 0, 3, 4, 10, '#4a4a4a');
  stick(on ? [4, 7, 5, 6, 6, 5, 7, 4, 8, 3] : [4, 8, 5, 9, 6, 10, 7, 11, 8, 12]);
  gFill(g, 10, on ? 1 : 12, 3, 3, knob);
  return gPrims(g, { tr: ROT(c.f) });
}
function spButton(c) {
  const g = grid16(), on = c.on;
  const face = c.wood ? '#a17c48' : '#9b9b9b', hi = c.wood ? '#bd965c' : '#bcbcbc', lo = c.wood ? '#6e5230' : '#666666';
  if (c.f < 0) {
    if (on) gFrame(g, 3, 4, 10, 8, RED);
    gFill(g, 4, 5, 8, 6, face); gFill(g, 4, 5, 8, 1, on ? lo : hi); gFill(g, 4, 10, 8, 1, on ? hi : lo);
    return gPrims(g);
  }
  const dep = on ? 2 : 3;
  gFill(g, 0, 4, dep, 8, face); gFill(g, 0, 4, dep, 1, hi); gFill(g, 0, 11, dep, 1, lo);
  if (on) gFill(g, dep, 4, 1, 8, RED);
  return gPrims(g, { tr: ROT(c.f) });
}
function gFeet(g) {
  gFill(g, 4, 3, 3, 5, '#efe6d2'); gPix(g, [5, 2], '#efe6d2'); gFill(g, 4, 8, 3, 1, '#7a6a52');
  gFill(g, 9, 7, 3, 5, '#efe6d2'); gPix(g, [10, 6], '#efe6d2'); gFill(g, 9, 12, 3, 1, '#7a6a52');
}
function spPlate(c) {
  const g = grid16();
  gNoise(g, 1, 1, 14, 14, [['#8a8a8a', 65], ['#959595', 20], ['#7d7d7d', 15]], 71);
  if (!c.on) { gFill(g, 1, 1, 14, 1, '#ababab'); gFill(g, 1, 1, 1, 14, '#a3a3a3'); gFill(g, 1, 14, 14, 1, '#626262'); gFill(g, 14, 1, 1, 14, '#6a6a6a'); }
  else { gFill(g, 1, 1, 14, 1, '#5e5e5e'); gFill(g, 1, 1, 1, 14, '#636363'); gFill(g, 1, 14, 14, 1, '#a0a0a0'); gFill(g, 14, 1, 1, 14, '#9a9a9a'); gPix(g, [2, 2, 13, 2, 2, 13, 13, 13], RED); }
  if (c.standing) gFeet(g);
  return gPrims(g, { base: [1, 1, 14, 14], baseColor: '#8a8a8a' });
}
function spHook(c) {
  const g = grid16();
  gPlanks(g, 0, 2, 3, 12); gFrame(g, 0, 2, 3, 12, '#5c4326');
  if (c.ok) {
    gFill(g, 3, 7, 6, 2, '#cdcdcd'); gFill(g, 3, 8, 6, 1, '#8f8f8f');
    gFrame(g, 9, 5, 5, 6, c.on ? RED : '#d6d6d6');
    gPix(g, [9, 5, 13, 5, 9, 10, 13, 10], '');
  } else {
    gPix(g, [3, 8, 4, 9, 5, 10, 6, 11, 7, 12], '#8f8f8f'); gPix(g, [4, 8, 5, 9, 6, 10, 7, 11], '#bdbdbd');
    gFrame(g, 7, 12, 4, 4, '#8f8f8f');
  }
  gFill(g, 1, 7, 1, 2, c.on ? RED : RED_OFF);
  return gPrims(g, { tr: ROT(c.f) });
}
/* Tripwire: dim when its hooks aren't connected, red while triggered (like the Redstone Tweaks pack). */
function spString(c, axis) {
  const g = grid16(), out = [];
  const a = c.on ? '#ff6a52' : c.ok ? '#ececec' : '#8d8d8d', b = c.on ? '#c9341f' : c.ok ? '#b2b2b2' : '#6a6a6a';
  for (let i = 0; i < 16; i++) g[7][i] = (i >> 1) % 2 ? b : a;
  if (c.on) out.push(prim(axis === 'v' ? R(15, 0, 10, 40) : R(0, 15, 40, 10), '#ff5a36', { op: 0.22 }));
  if (c.standing) gFeet(g);
  out.push(...gPrims(g, { tr: axis === 'v' ? 'rotate(90 20 20)' : undefined }));
  return out;
}
function spLamp(c) {
  const g = grid16(), out = [], lit = c.lit, body = lit ? '#9c6a2a' : '#4e3923';
  if (lit) out.push(prim(CIRC(20, 20, 27), '#ffcf5a', { op: 0.14 }));
  gFill(g, 0, 0, 16, 16, body);
  gNoise(g, 2, 2, 12, 12, lit ? [['#ffd47a', 60], ['#ffe7b0', 25], ['#f2b65a', 15]] : [['#6d4f31', 60], ['#7b5a39', 20], ['#5a4128', 20]], 51);
  gFill(g, 2, 7, 12, 2, lit ? '#d48f30' : '#3b2a19'); gFill(g, 7, 2, 2, 12, lit ? '#d48f30' : '#3b2a19');
  gFrame(g, 0, 0, 16, 16, lit ? '#7a4f1d' : '#3a2a19');
  out.push(...gPrims(g, { base: [0, 0, 16, 16], baseColor: body }));
  return out;
}
/* Dispenser, drawn facing east: arrow on top points where it shoots, mouth on the east edge. */
function spDispenser(c, fx) {
  const tr = ROT(c.f), g = grid16(), out = [], ac = c.trig ? RED : '#d2d2d2';
  gCobble(g, 0, 0, 16, 16, 12);
  gFrame(g, 0, 0, 16, 16, '#4a4a4a');
  gFill(g, 13, 4, 3, 8, '#3a3a3a'); gFill(g, 14, 5, 2, 6, '#141414');
  gFill(g, 2, 6, 7, 4, '#2e2e2e'); gFill(g, 9, 4, 1, 8, '#2e2e2e'); gFill(g, 10, 5, 1, 6, '#2e2e2e'); gFill(g, 11, 6, 1, 4, '#2e2e2e');
  gFill(g, 3, 7, 6, 2, ac); gFill(g, 9, 5, 1, 6, ac); gFill(g, 10, 6, 1, 4, ac); gFill(g, 11, 7, 1, 2, ac);
  out.push(...gPrims(g, { tr }));
  if (fx && fx.kind === 'shot') out.push(prim('M38 20H64M57 14.5L64 20L57 25.5', 'none', { stroke: '#f2efe9', sw: 2.4, tr, op: 0.9 }));
  return out;
}
function spBulb(c) {
  const g = grid16(), out = [], lit = c.lit;
  if (lit) out.push(prim(CIRC(20, 20, 24), '#ffe9a8', { op: 0.16 }));
  gNoise(g, 0, 0, 16, 16, [['#c06b44', 60], ['#d4825a', 22], ['#a55a37', 18]], 61);
  gFrame(g, 0, 0, 16, 16, '#8a4a2c');
  gFrame(g, 3, 3, 10, 10, '#7a3e27');
  gFill(g, 4, 4, 8, 8, lit ? '#ffe9a8' : '#4a2d1d');
  if (lit) { gFill(g, 5, 5, 6, 6, '#fff6d6'); gPix(g, [6, 6, 7, 6], '#ffffff'); } else gPix(g, [5, 5, 6, 5, 5, 6], '#6a4330');
  gFill(g, 4, 7, 8, 2, lit ? '#ffd27a' : '#3a2316'); gFill(g, 7, 4, 2, 8, lit ? '#ffd27a' : '#3a2316');
  gFill(g, 13, 1, 2, 2, c.pw ? RED : RED_OFF);
  out.push(...gPrims(g, { base: [0, 0, 16, 16], baseColor: '#c06b44' }));
  return out;
}
function drawMoving(m, ctx) {
  const out = (m.carry ? drawPart(m.carry, ctx) : []).map((p) => Object.assign({}, p, { op: (p.op == null ? 1 : p.op) * 0.5 }));
  out.push(prim('M9 20H29M23 13.5L29.5 20L23 26.5', 'none', { stroke: '#f4f1ea', sw: 2.6, tr: ROT(m.dir) }));
  return out;
}
function drawPart(c, ctx) {
  ctx = ctx || {};
  switch (c.t) {
    case 'block': return spBlock(ctx.power);
    case 'glass': return spGlass();
    case 'rblock': return spRBlock();
    case 'dust': return spDust(c, ctx.nums);
    case 'torch': return spTorch(c);
    case 'repeater': return spRepeater(c);
    case 'comparator': return spComparator(c);
    case 'observer': return spObserver(c);
    case 'piston': return spPiston(c);
    case 'head': return spHead(c);
    case 'moving': return drawMoving(c, ctx);
    case 'lever': return spLever(c);
    case 'button': return spButton(c);
    case 'plate': return spPlate(c);
    case 'hook': return spHook(c);
    case 'string': return spString(c, ctx.axis);
    case 'lamp': return spLamp(c);
    case 'dispenser': return spDispenser(c, ctx.fx);
    case 'bulb': return spBulb(c);
    default: return [];
  }
}
const ERASER_ICON = (() => {
  const g = grid16();
  gFill(g, 2, 5, 12, 6, '#f0a3a8'); gFill(g, 2, 5, 4, 6, '#f2f2f2'); gFrame(g, 1, 4, 14, 8, '#5a2a2e');
  gFill(g, 6, 6, 7, 1, '#f8c3c6'); gFill(g, 2, 13, 13, 1, '#7d838c');
  return gPrims(g);
})();
const HOVER_MARK = [prim(R(1.5, 1.5, 37, 37), 'none', { stroke: '#ffffff', sw: 2, op: 0.9 })];
const KB_MARK = [prim(R(1.5, 1.5, 37, 37), 'none', { stroke: '#5cc8ff', sw: 3, da: '6 4' })];
const SEL_MARK = [prim('M1.5 10V1.5H10M30 1.5H38.5V10M38.5 30V38.5H30M10 38.5H1.5V30', 'none', { stroke: '#5cc8ff', sw: 2.6 })];
const HL_UNDER = [prim(R(0, 0, 40, 40), '#5cc8ff', { op: 0.17 })];
const HL_OVER = [prim(R(2, 2, 36, 36), 'none', { stroke: '#5cc8ff', sw: 2.6, da: '5 3' })];
const ERASE_MARK = [prim('M9 9L31 31M31 9L9 31', 'none', { stroke: '#ff6b6b', sw: 3.5 })];
const BLOCKED_MARK = [prim(CIRC(20, 20, 11), 'none', { stroke: '#ffb84d', sw: 3 }), prim('M12.5 27.5L27.5 12.5', 'none', { stroke: '#ffb84d', sw: 3 })];
/* "Hold R and point": a ring on the part being turned, plus an arrow on each side it could face.
   The way it faces now is bright blue; sides it can't face (no block to hang on) get no arrow. */
const AIM_ARROWS = ['M20 -14L29 -3H11Z', 'M54 20L43 29V11Z', 'M20 54L29 43H11Z', 'M-14 20L-3 29V11Z'];
function aimMark(dirs, cur) {
  const out = [prim(R(1.2, 1.2, 37.6, 37.6), 'none', { stroke: '#5cc8ff', sw: 2.4 })];
  for (let d = 0; d < 4; d++) {
    if (dirs.indexOf(d) < 0) continue;
    out.push(prim(AIM_ARROWS[d], d === cur ? '#5cc8ff' : '#ffffff', { op: d === cur ? 1 : 0.4, stroke: '#0b1820', sw: 1.2 }));
  }
  return out;
}
function stepBadge(n) {
  const s = String(n), px = 2, w = s.length * 4 * px - px, cx = 31.5, cy = 8.5;
  return [prim(CIRC(cx, cy, 8.2), '#5cc8ff', { stroke: '#0b1820', sw: 1.4 }), prim(pxText(s, cx - w / 2, cy - 2.5 * px, px), '#0b1820', { sr: 'crispEdges' })];
}
function probeBadge(n) {
  const px = 1.5;
  return [prim(RR(1.5, 27, 11, 11.5, 2), '#ffd08a', { stroke: '#2a1d08', sw: 1 }), prim(pxText(String(n), 7 - 1.5 * px, 32.75 - 2.5 * px, px), '#2a1d08')];
}
function gridPaths() {
  let minor = '', major = '';
  for (let x = 0; x <= GW; x++) { const s = 'M' + x * CS + ' 0V' + GH * CS; if (x % 4 === 0) major += s; else minor += s; }
  for (let y = 0; y <= GH; y++) { const s = 'M0 ' + y * CS + 'H' + GW * CS; if (y % 4 === 0) major += s; else minor += s; }
  return { bg: R(0, 0, GW * CS, GH * CS), minor, major };
}
const cellTr = (i) => 'translate(' + (i % GW) * CS + ' ' + ((i / GW) | 0) * CS + ')';
function stringAxis(sim, i) {
  const line = (j) => { const n = sim.at(j); return !!n && (n.t === 'string' || n.t === 'hook'); };
  if (line(sim.nb(i, 1)) || line(sim.nb(i, 3))) return 'h';
  if (line(sim.nb(i, 0)) || line(sim.nb(i, 2))) return 'v';
  return 'h';
}
function lineCells(a, b) {
  let x = a % GW, y = (a / GW) | 0;
  const x1 = b % GW, y1 = (b / GW) | 0, out = [];
  for (let guard = 0; (x !== x1 || y !== y1) && guard < 100; guard++) {
    const dx = x1 - x, dy = y1 - y;
    if (Math.abs(dx) >= Math.abs(dy)) x += Math.sign(dx); else y += Math.sign(dy);
    out.push(y * GW + x);
  }
  return out;
}
function probeValue(sim, i) {
  const c = sim.at(i);
  if (!c) return 0;
  switch (c.t) {
    case 'dust': return c.p;
    case 'comparator': return c.on ? c.out : 0;
    case 'torch': case 'lamp': case 'bulb': return c.lit ? 15 : 0;
    case 'piston': return c.ext ? 15 : 0;
    case 'dispenser': return c.trig ? 15 : 0;
    case 'block': return sim.blockPower(i, true);
    case 'repeater': case 'observer': case 'lever': case 'button': case 'plate': case 'hook': case 'string': return c.on ? 15 : 0;
    default: return 0;
  }
}
function wave(hist) {
  const n = hist.length;
  if (!n) return { line: 'M0 27H360', area: 'M0 27H360V27Z' };
  const x0 = (120 - n) * 3;
  const yOf = (v) => r2(v > 0 ? 27 - (8 + (14 * v) / 15) : 27);
  let line = 'M' + x0 + ' ' + yOf(hist[0]) + 'H' + (x0 + 3);
  for (let k = 1; k < n; k++) line += 'V' + yOf(hist[k]) + 'H' + (x0 + 3 * (k + 1));
  return { line, area: line + 'V27H' + x0 + 'Z' };
}
const SEC_MARKS = (() => { let d = ''; for (let s = 0; s <= 6; s++) d += 'M' + s * 60 + ' 0V32'; return d; })();
function shortName(c) {
  const m = { dust: 'Dust', torch: 'Torch', repeater: 'Repeater', comparator: 'Comparator', observer: 'Observer', lever: 'Lever', button: 'Button', plate: 'Plate', hook: 'Hook', string: 'Tripwire', lamp: 'Lamp', dispenser: 'Dispenser', bulb: 'Bulb', block: 'Block', rblock: 'Redstone block', glass: 'Glass' };
  if (c.t === 'piston') return c.sticky ? 'Sticky piston' : 'Piston';
  return m[c.t] || TYPES[c.t].name;
}

// Marks this file as fully loaded (if it is missing, index.html shows which file has a mistake).
if (window.__rlLoaded) window.__rlLoaded.push('drawing.js');
