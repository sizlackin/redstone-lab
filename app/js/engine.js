/* Redstone Lab: a top-down redstone sandbox.
   The simulation follows Minecraft: Java Edition 26.3. That drop made no redstone changes, so this is the
   standard 1.21+ Java logic; the optional "Redstone Experiments" toggle is not modeled.
   1 game tick (gt) = 0.05 s. 1 redstone tick = 2 gt = 0.1 s.
   The grid is one layer seen from above: every square is a block space at player height, standing on a
   floor that cannot be powered. */

const GW = 24, GH = 16, CS = 40;
const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
const DN = ['N', 'E', 'S', 'W'];
const DWORD = ['north', 'east', 'south', 'west'];
const DARROW = ['↑', '→', '↓', '←'];
const BIT = [1, 2, 4, 8];
const opp = (d) => (d + 2) & 3;
const cw = (d) => (d + 1) & 3;
const ccw = (d) => (d + 3) & 3;
const PRI_EXTREME = -3, PRI_VHIGH = -2, PRI_HIGH = -1, PRI_NORMAL = 0;
const EV_EXTEND = 0, EV_CONTRACT = 1, EV_DROP = 2;
const FULL_AMMO = 576;
const ATTACH = { torch: true, lever: true, button: true, hook: true };

const TYPES = {
  block: { name: 'Solid Block', conductive: true, push: 'normal' },
  glass: { name: 'Glass', push: 'normal' },
  rblock: { name: 'Block of Redstone', push: 'normal' },
  dust: { name: 'Redstone Dust', push: 'destroy' },
  torch: { name: 'Redstone Torch', push: 'destroy' },
  repeater: { name: 'Redstone Repeater', push: 'destroy' },
  comparator: { name: 'Redstone Comparator', push: 'destroy' },
  observer: { name: 'Observer', push: 'normal' },
  piston: { name: 'Piston', push: 'piston' },
  head: { name: 'Piston Head', push: 'block' },
  moving: { name: 'Moving Block', push: 'block' },
  lever: { name: 'Lever', push: 'destroy' },
  button: { name: 'Button', push: 'destroy' },
  plate: { name: 'Pressure Plate', push: 'destroy' },
  hook: { name: 'Tripwire Hook', push: 'destroy' },
  string: { name: 'Tripwire', push: 'destroy' },
  lamp: { name: 'Redstone Lamp', conductive: true, push: 'normal' },
  dispenser: { name: 'Dispenser', conductive: true, push: 'block' },
  bulb: { name: 'Copper Bulb', push: 'normal' },
};
const TYPE_INDEX = {};
Object.keys(TYPES).forEach((k, n) => { TYPE_INDEX[k] = n; });

function makeCell(t, f, o) {
  o = o || {};
  const F = f == null ? -1 : f;
  const D = F < 0 ? 1 : F;
  switch (t) {
    case 'dust': return { t, p: 0, sh: o.dot ? 0 : 15, dot: !!o.dot };
    case 'torch': return { t, f: F, lit: true, burnt: false, toggles: [] };
    case 'repeater': return { t, f: D, d: Math.min(4, Math.max(1, o.d || 1)), on: false, lock: false };
    case 'comparator': return { t, f: D, sub: !!o.sub, on: false, out: 0 };
    case 'observer': return { t, f: D, on: false };
    case 'piston': return { t, f: D, sticky: !!o.sticky, ext: false, failAt: -1 };
    case 'head': return { t, f: D, sticky: !!o.sticky };
    case 'lever': return { t, f: F, on: !!o.on };
    case 'button': return { t, f: F, on: false, wood: !!o.wood };
    case 'plate': return { t, on: false, standing: false };
    case 'hook': return { t, f: D, on: false, ok: false };
    case 'string': return { t, on: false, ok: false, standing: false };
    case 'lamp': return { t, lit: false };
    case 'dispenser': return { t, f: D, trig: false, items: o.items == null ? FULL_AMMO : o.items, shots: 0 };
    case 'bulb': return { t, lit: !!o.lit, pw: false };
    default: return { t };
  }
}

/* Everything an observer can see: the block's type plus its block-state properties.
   (A comparator's output strength is block-entity data, so observers don't see it change.) */
function cellKey(c) {
  if (!c) return '';
  switch (c.t) {
    case 'dust': return 'dust' + c.p + '.' + c.sh;
    case 'torch': return 'torch' + c.f + (c.lit ? 'L' : 'u');
    case 'repeater': return 'rep' + c.f + c.d + (c.on ? 'P' : 'u') + (c.lock ? 'K' : 'u');
    case 'comparator': return 'cmp' + c.f + (c.sub ? 'S' : 'C') + (c.on ? 'P' : 'u');
    case 'observer': return 'obs' + c.f + (c.on ? 'P' : 'u');
    case 'piston': return 'pis' + c.f + (c.sticky ? 'S' : 'n') + (c.ext ? 'X' : 'r');
    case 'head': return 'head' + c.f + (c.sticky ? 'S' : 'n');
    case 'moving': return 'mov' + c.id;
    case 'lever': return 'lever' + c.f + (c.on ? 'P' : 'u');
    case 'button': return 'button' + c.f + (c.on ? 'P' : 'u') + (c.wood ? 'w' : 's');
    case 'plate': return 'plate' + (c.on ? 'P' : 'u');
    case 'hook': return 'hook' + c.f + (c.on ? 'P' : 'u') + (c.ok ? 'A' : 'u');
    case 'string': return 'str' + (c.on ? 'P' : 'u') + (c.ok ? 'A' : 'u');
    case 'lamp': return 'lamp' + (c.lit ? 'L' : 'u');
    case 'dispenser': return 'disp' + c.f + (c.trig ? 'T' : 'u');
    case 'bulb': return 'bulb' + (c.lit ? 'L' : 'u') + (c.pw ? 'P' : 'u');
    default: return c.t;
  }
}

const NAMES = {
  block: ['block'], stone: ['block'], solid_block: ['block'], glass: ['glass'],
  redstone_block: ['rblock'], rblock: ['rblock'], block_of_redstone: ['rblock'],
  dust: ['dust'], redstone: ['dust'], redstone_dust: ['dust'], redstone_wire: ['dust'],
  torch: ['torch'], redstone_torch: ['torch'], repeater: ['repeater'], comparator: ['comparator'],
  observer: ['observer'], piston: ['piston'], sticky_piston: ['piston', { sticky: true }],
  lever: ['lever'], button: ['button'], stone_button: ['button'], wood_button: ['button', { wood: true }],
  wooden_button: ['button', { wood: true }], pressure_plate: ['plate'], stone_pressure_plate: ['plate'], plate: ['plate'],
  tripwire_hook: ['hook'], hook: ['hook'], tripwire: ['string'], string: ['string'],
  lamp: ['lamp'], redstone_lamp: ['lamp'], dispenser: ['dispenser'], copper_bulb: ['bulb'], bulb: ['bulb'],
};
function parseFacing(s, dflt) {
  if (s == null || s === '') return dflt;
  const v = String(s).toLowerCase();
  if (v === 'floor' || v === 'up' || v === 'down' || v === 'ground') return -1;
  const k = ['n', 'e', 's', 'w'].indexOf(v[0]);
  return k >= 0 ? k : dflt;
}

/* ================= The simulation ================= */
function createSim(W, H) {
  const N = W * H;
  const S = {
    W, H, N, cells: new Array(N).fill(null), now: 0, seq: 0,
    sched: new Map(), running: new Set(), events: [], eventKeys: new Set(),
    handling: false, moverId: 0, changed: false, notices: [], fx: new Map(),
  };
  const nb = (i, d) => {
    if (i < 0) return -1;
    const x = (i % W) + DX[d], y = ((i / W) | 0) + DY[d];
    return x >= 0 && y >= 0 && x < W && y < H ? y * W + x : -1;
  };
  const at = (i) => (i < 0 ? null : S.cells[i]);
  const skey = (i, t) => i * 32 + TYPE_INDEX[t];
  const note = (m) => { if (S.notices.indexOf(m) < 0) S.notices.push(m); };

  /* ---- scheduled block ticks (one pending tick per block, like Java) ---- */
  function schedule(i, delay, pri, type) {
    const t = type || (S.cells[i] && S.cells[i].t);
    if (!t) return;
    const k = skey(i, t);
    if (S.sched.has(k)) return;
    S.sched.set(k, { k, i, t, time: S.now + delay, pri, seq: ++S.seq });
  }
  const hasSched = (i) => !!S.cells[i] && S.sched.has(skey(i, S.cells[i].t));
  const tickingNow = (i) => !!S.cells[i] && S.running.has(skey(i, S.cells[i].t));
  function pendingAt(i) {
    const c = S.cells[i];
    if (!c) return -1;
    const e = S.sched.get(skey(i, c.t));
    return e ? e.time : -1;
  }

  /* ---- state changes (observers notice any block-state change in front of them) ---- */
  function notifyObservers(i) {
    for (let d = 0; d < 4; d++) {
      const j = nb(i, d), o = at(j);
      if (o && o.t === 'observer' && o.f === opp(d) && !o.on && !hasSched(j)) schedule(j, 2, PRI_NORMAL);
    }
  }
  function mut(i, fn) {
    const c = S.cells[i], k = cellKey(c);
    fn(c);
    if (cellKey(c) !== k) { notifyObservers(i); S.changed = true; }
  }
  function setCell(i, c) {
    const k = cellKey(S.cells[i]);
    S.cells[i] = c;
    if (cellKey(c) !== k) { notifyObservers(i); S.changed = true; }
  }

  /* ---- power ----
     emitTo: signal a component gives a neighbor (Java getSignal). `tw` = direction from the part to the neighbor.
     directTo: power a part pushes INTO a neighboring block (Java getDirectSignal). Dust only counts as weak power. */
  const isCond = (c) => !!c && !!TYPES[c.t].conductive;
  function emitTo(c, tw) {
    switch (c.t) {
      case 'dust': return (c.sh & BIT[tw]) ? c.p : 0;
      case 'torch': return c.lit && !(c.f >= 0 && tw === opp(c.f)) ? 15 : 0;
      case 'repeater': return c.on && tw === c.f ? 15 : 0;
      case 'comparator': return c.on && tw === c.f ? c.out : 0;
      case 'observer': return c.on && tw === opp(c.f) ? 15 : 0;
      case 'lever': case 'button': case 'plate': case 'hook': return c.on ? 15 : 0;
      case 'rblock': return 15;
      default: return 0;
    }
  }
  function directTo(c, tw, dust) {
    switch (c.t) {
      case 'dust': return dust && (c.sh & BIT[tw]) ? c.p : 0;
      case 'repeater': return c.on && tw === c.f ? 15 : 0;
      case 'comparator': return c.on && tw === c.f ? c.out : 0;
      case 'observer': return c.on && tw === opp(c.f) ? 15 : 0;
      case 'lever': case 'button': case 'hook': return c.on && c.f >= 0 && tw === opp(c.f) ? 15 : 0;
      default: return 0;
    }
  }
  /* Power inside a solid block. dust=false: strong power only (what dust next to the block can pick up). */
  function blockPower(i, dust) {
    let m = 0;
    for (let d = 0; d < 4; d++) {
      const n = at(nb(i, d));
      if (n) { const v = directTo(n, opp(d), dust); if (v > m) m = v; }
    }
    return m;
  }
  function signalFrom(r, d) {
    const j = nb(r, d), n = at(j);
    if (!n) return 0;
    return isCond(n) ? blockPower(j, true) : emitTo(n, opp(d));
  }
  function hasSignal(r) {
    for (let d = 0; d < 4; d++) if (signalFrom(r, d) > 0) return true;
    return false;
  }

  /* ---- redstone dust ---- */
  function dustLinks(n, d) {
    if (!n) return false;
    switch (n.t) {
      case 'dust': case 'torch': case 'comparator': case 'lever': case 'button': case 'plate': case 'hook': case 'rblock': return true;
      case 'repeater': return n.f === d || n.f === opp(d);
      case 'observer': return n.f === d;
      default: return false;
    }
  }
  function linksOf(i) {
    let k = 0;
    for (let d = 0; d < 4; d++) if (dustLinks(at(nb(i, d)), d)) k |= BIT[d];
    return k;
  }
  function updateDust() {
    const list = [];
    for (let i = 0; i < N; i++) { const c = S.cells[i]; if (c && c.t === 'dust') list.push(i); }
    if (!list.length) return;
    const pw = new Map(), shp = new Map();
    for (const i of list) {
      const c = S.cells[i];
      const k = linksOf(i);
      let sh;
      if (!k) sh = c.dot ? 0 : 15;
      else {
        c.dot = false;
        sh = k;
        if (!(k & 5)) sh |= 10;
        if (!(k & 10)) sh |= 5;
      }
      shp.set(i, sh);
      let m = 0;
      for (let d = 0; d < 4; d++) {
        const j = nb(i, d), n = at(j);
        if (!n || n.t === 'dust') continue;
        const v = isCond(n) ? blockPower(j, false) : emitTo(n, opp(d));
        if (v > m) m = v;
      }
      pw.set(i, m);
    }
    const buckets = [];
    for (let v = 0; v < 16; v++) buckets.push([]);
    for (const i of list) { const v = pw.get(i); if (v > 1) buckets[v].push(i); }
    for (let v = 15; v >= 2; v--) {
      const b = buckets[v];
      for (let q = 0; q < b.length; q++) {
        const i = b[q];
        if (pw.get(i) !== v) continue;
        for (let d = 0; d < 4; d++) {
          const j = nb(i, d), n = at(j);
          if (n && n.t === 'dust' && pw.get(j) < v - 1) { pw.set(j, v - 1); buckets[v - 1].push(j); }
        }
      }
    }
    for (const i of list) {
      const c = S.cells[i], sh = shp.get(i), p = pw.get(i);
      if (c.sh !== sh || c.p !== p) mut(i, (x) => { x.sh = sh; x.p = p; });
    }
  }

  /* ---- tripwire: two hooks facing each other with 1-40 string between them ---- */
  function updateHooks() {
    const linked = new Set();
    for (let i = 0; i < N; i++) {
      const c = S.cells[i];
      if (!c || c.t !== 'hook') continue;
      let ok = false, any = false, j = i;
      const line = [];
      for (let s = 1; s < 42; s++) {
        j = nb(j, c.f);
        if (j < 0) break;
        const n = S.cells[j];
        if (n && n.t === 'hook') { ok = n.f === opp(c.f) && s > 1; break; }
        if (!n || n.t !== 'string') break;
        line.push(j);
        if (n.on) any = true;
      }
      if (ok) for (const s of line) linked.add(s);
      const on = ok && any;
      if (c.ok !== ok || c.on !== on) mut(i, (x) => { x.ok = ok; x.on = on; });
    }
    for (let i = 0; i < N; i++) {
      const c = S.cells[i];
      if (c && c.t === 'string') {
        const ok = linked.has(i);
        if (c.ok !== ok) mut(i, (x) => { x.ok = ok; });
      }
    }
  }

  /* ---- parts stuck to the side of a block ---- */
  function sturdy(n, face) {
    if (!n) return false;
    switch (n.t) {
      case 'block': case 'glass': case 'rblock': case 'observer': case 'lamp': case 'dispenser': case 'bulb': return true;
      case 'piston': return !n.ext || n.f !== face;
      default: return false;
    }
  }
  function supported(i, c) { return c.f < 0 || sturdy(at(nb(i, opp(c.f))), c.f); }
  function wallOptions(i) {
    const out = [];
    for (let d = 0; d < 4; d++) if (sturdy(at(nb(i, opp(d))), d)) out.push(d);
    return out;
  }
  function popOffs() {
    for (let i = 0; i < N; i++) {
      const c = S.cells[i];
      if (c && ATTACH[c.t] && !supported(i, c)) {
        setCell(i, null);
        note(TYPES[c.t].name + ' popped off: the block it was stuck to is gone.');
      }
    }
  }

  /* ---- torches ---- */
  function torchPowered(i, c) { return c.f >= 0 && signalFrom(i, opp(c.f)) > 0; }
  function torchTick(i, c) {
    const p = torchPowered(i, c);
    c.toggles = c.toggles.filter((t) => S.now - t <= 60);
    if (c.lit) {
      if (p) {
        mut(i, (x) => { x.lit = false; });
        c.toggles.push(S.now);
        if (c.toggles.length >= 8) {
          c.burnt = true;
          schedule(i, 160, PRI_NORMAL);
          note('A redstone torch burned out: it flipped 8 times in 3 seconds.');
        }
      }
    } else if (!p && c.toggles.length < 8) {
      mut(i, (x) => { x.lit = true; x.burnt = false; });
    } else if (c.toggles.length < 8) {
      c.burnt = false;
    }
  }

  /* ---- repeaters ---- */
  function repInput(i, c) {
    const b = opp(c.f), n = at(nb(i, b));
    let s = signalFrom(i, b);
    if (n && n.t === 'dust' && n.p > s) s = n.p;
    return s;
  }
  function repLocked(i, c) {
    for (const d of [cw(c.f), ccw(c.f)]) {
      const n = at(nb(i, d));
      if (n && (n.t === 'repeater' || n.t === 'comparator') && directTo(n, opp(d), false) > 0) return true;
    }
    return false;
  }
  function prioritized(i, c) {
    const n = at(nb(i, c.f));
    return !!n && (n.t === 'repeater' || n.t === 'comparator') && opp(n.f) !== c.f;
  }
  function repCheck(i, c) {
    const lk = repLocked(i, c);
    if (lk !== c.lock) mut(i, (x) => { x.lock = lk; });
    if (lk) return;
    const want = repInput(i, c) > 0;
    if (c.on !== want && !tickingNow(i)) {
      schedule(i, 2 * c.d, prioritized(i, c) ? PRI_EXTREME : c.on ? PRI_VHIGH : PRI_HIGH);
    }
  }
  function repTick(i, c) {
    if (repLocked(i, c)) return;
    const want = repInput(i, c) > 0;
    if (c.on && !want) mut(i, (x) => { x.on = false; });
    else if (!c.on) {
      mut(i, (x) => { x.on = true; });
      if (!want) schedule(i, 2 * c.d, PRI_VHIGH);
    }
  }

  /* ---- comparators ---- */
  function analog(n) {
    if (!n) return -1;
    if (n.t === 'dispenser') return n.items > 0 ? Math.floor((n.items / FULL_AMMO) * 14) + 1 : 0;
    if (n.t === 'bulb') return n.lit ? 15 : 0;
    return -1;
  }
  function cmpRear(i, c) {
    const b = opp(c.f), j = nb(i, b), n = at(j);
    let s = signalFrom(i, b);
    if (n && n.t === 'dust' && n.p > s) s = n.p;
    const a = analog(n);
    if (a >= 0) return a;
    if (s < 15 && isCond(n)) {
      const a2 = analog(at(nb(j, b)));
      if (a2 >= 0) return a2;
    }
    return s;
  }
  function cmpSide(i, c) {
    let m = 0;
    for (const d of [cw(c.f), ccw(c.f)]) {
      const n = at(nb(i, d));
      if (!n) continue;
      let v = 0;
      if (n.t === 'rblock') v = 15;
      else if (n.t === 'dust') v = n.p;
      else if (n.t === 'repeater' || n.t === 'comparator' || n.t === 'observer') v = directTo(n, opp(d), false);
      if (v > m) m = v;
    }
    return m;
  }
  function cmpOut(i, c) {
    const inp = cmpRear(i, c);
    if (inp === 0) return 0;
    const side = cmpSide(i, c);
    if (side > inp) return 0;
    return c.sub ? inp - side : inp;
  }
  function cmpOn(i, c) {
    const inp = cmpRear(i, c);
    if (inp === 0) return false;
    const side = cmpSide(i, c);
    return inp > side || (inp === side && !c.sub);
  }
  function cmpCheck(i, c) {
    if (tickingNow(i)) return;
    if (cmpOut(i, c) !== c.out || c.on !== cmpOn(i, c)) schedule(i, 2, prioritized(i, c) ? PRI_HIGH : PRI_NORMAL);
  }
  function cmpRefresh(i, c) {
    const out = cmpOut(i, c), old = c.out;
    if (old !== out) { c.out = out; S.changed = true; }
    if (old !== out || !c.sub) {
      const want = cmpOn(i, c);
      if (c.on !== want) mut(i, (x) => { x.on = want; });
    }
  }

  /* ---- pistons ---- */
  function pistonPowered(i, c) {
    for (let d = 0; d < 4; d++) if (d !== c.f && signalFrom(i, d) > 0) return true;
    return false;
  }
  function queueEvent(i, type) {
    const k = i * 4 + type;
    if (S.eventKeys.has(k)) return;
    S.eventKeys.add(k);
    S.events.push({ i, type, k });
  }
  function pistonCheck(i, c) {
    const want = pistonPowered(i, c);
    if (want && !c.ext) {
      if (c.failAt !== S.now) queueEvent(i, EV_EXTEND);
    } else if (!want && c.ext) {
      const m = at(nb(nb(i, c.f), c.f));
      let type = EV_CONTRACT;
      if (m && m.t === 'moving' && m.dir === c.f && m.ext && (m.progO < 0.5 || m.last === S.now || S.handling)) type = EV_DROP;
      queueEvent(i, type);
    }
  }
  function pushClass(c) {
    if (!c) return 'air';
    if (c.t === 'piston') return c.ext ? 'block' : 'normal';
    return TYPES[c.t].push;
  }
  function resolvePush(start, dir, piston, extending) {
    if (start < 0) return null;
    const push = [], destroy = [];
    const k0 = pushClass(S.cells[start]);
    if (k0 === 'air') return { push, destroy };
    if (k0 === 'block') return null;
    if (k0 === 'destroy') {
      if (!extending) return null;
      destroy.push(start);
      return { push, destroy };
    }
    push.push(start);
    let j = start;
    for (;;) {
      j = nb(j, dir);
      if (j < 0 || j === piston) return null;
      const k = pushClass(S.cells[j]);
      if (k === 'air') return { push, destroy };
      if (k === 'block') return null;
      if (k === 'destroy') { destroy.push(j); return { push, destroy }; }
      if (push.length >= 12) return null;
      push.push(j);
    }
  }
  function mover(carry, dir, ext, src) {
    return { t: 'moving', id: ++S.moverId, carry, dir, ext, src, prog: 0, progO: 0, last: -1 };
  }
  function moveBlocks(i, f, extending, sticky) {
    const h = nb(i, f);
    if (h < 0) return false;
    if (!extending) { const hc = S.cells[h]; if (hc && hc.t === 'head') S.cells[h] = null; }
    const dir = extending ? f : opp(f);
    const res = resolvePush(extending ? h : nb(h, f), dir, i, extending);
    if (!res) return false;
    for (const j of res.destroy) {
      const d = S.cells[j];
      setCell(j, null);
      note('A piston broke the ' + TYPES[d.t].name.toLowerCase() + ' in its way.');
    }
    const carried = res.push.map((j) => S.cells[j]);
    const dest = res.push.map((j) => nb(j, dir));
    const ds = new Set(dest);
    for (const j of res.push) if (!ds.has(j)) setCell(j, null);
    for (let k = res.push.length - 1; k >= 0; k--) setCell(dest[k], mover(carried[k], dir, extending, false));
    if (extending) setCell(h, mover({ t: 'head', f, sticky }, f, true, true));
    return true;
  }
  function removeHead(h) {
    const c = at(h);
    if (c && (c.t === 'head' || c.t === 'moving')) setCell(h, null);
  }
  function pistonEvent(i, type) {
    const c = S.cells[i];
    if (!c || c.t !== 'piston') return;
    const f = c.f, want = pistonPowered(i, c);
    if (want && type !== EV_EXTEND) { if (!c.ext) mut(i, (x) => { x.ext = true; }); return; }
    if (!want && type === EV_EXTEND) return;
    if (type === EV_EXTEND) {
      if (!moveBlocks(i, f, true, c.sticky)) { c.failAt = S.now; return; }
      mut(i, (x) => { x.ext = true; });
      return;
    }
    const h = nb(i, f), hm = at(h);
    if (hm && hm.t === 'moving') finalTick(h);
    setCell(i, mover({ t: 'piston', f, sticky: c.sticky, ext: false, failAt: -1 }, f, false, true));
    if (c.sticky) {
      const p2 = nb(h, f), pm = at(p2);
      let dropped = false;
      if (pm && pm.t === 'moving' && pm.dir === f && pm.ext) { finalTick(p2); dropped = true; }
      if (!dropped) {
        const ps = at(p2);
        if (type !== EV_CONTRACT || pushClass(ps) !== 'normal') removeHead(h);
        else moveBlocks(i, f, false, true);
      }
    } else removeHead(h);
  }
  function land(i, m, viaFinal) {
    const c = viaFinal && m.src ? null : m.carry;
    if (c && c.t === 'observer') {
      if (c.on) { c.on = false; setCell(i, c); } else { schedule(i, 2, PRI_NORMAL, 'observer'); setCell(i, c); }
      return;
    }
    setCell(i, c);
  }
  function finalTick(i) {
    const m = S.cells[i];
    if (!m || m.t !== 'moving' || m.progO >= 1) return;
    m.prog = 1;
    m.progO = 1;
    land(i, m, true);
  }
  function tickMovers() {
    const list = [];
    for (let i = 0; i < N; i++) { const c = S.cells[i]; if (c && c.t === 'moving') list.push(i); }
    if (!list.length) return;
    list.sort((a, b) => S.cells[a].id - S.cells[b].id);
    for (const i of list) {
      const m = S.cells[i];
      if (!m || m.t !== 'moving') continue;
      m.last = S.now;
      m.progO = m.prog;
      if (m.progO >= 1) { land(i, m, false); settle(); } else m.prog = Math.min(1, m.prog + 0.5);
    }
  }
  function runEvents() {
    let guard = 0;
    while (S.events.length && guard++ < 4000) {
      const ev = S.events.shift();
      S.eventKeys.delete(ev.k);
      pistonEvent(ev.i, ev.type);
      settle();
    }
  }

  /* ---- instant updates: dust, hooks, lamps, bulbs, and scheduling everything else ---- */
  function settle() {
    for (let it = 0; it < 60; it++) {
      S.changed = false;
      popOffs();
      updateHooks();
      updateDust();
      for (let i = 0; i < N; i++) {
        const c = S.cells[i];
        if (!c) continue;
        switch (c.t) {
          case 'lamp': {
            const p = hasSignal(i);
            if (c.lit && !p) schedule(i, 4, PRI_NORMAL);
            else if (!c.lit && p) mut(i, (x) => { x.lit = true; });
            break;
          }
          case 'torch':
            if (c.lit === torchPowered(i, c) && !tickingNow(i)) schedule(i, 2, PRI_NORMAL);
            break;
          case 'repeater': repCheck(i, c); break;
          case 'comparator': cmpCheck(i, c); break;
          case 'piston': pistonCheck(i, c); break;
          case 'dispenser': {
            const p = hasSignal(i);
            if (p && !c.trig) { schedule(i, 4, PRI_NORMAL); mut(i, (x) => { x.trig = true; }); }
            else if (!p && c.trig) mut(i, (x) => { x.trig = false; });
            break;
          }
          case 'bulb': {
            const p = hasSignal(i);
            if (p !== c.pw) mut(i, (x) => { if (!x.pw) x.lit = !x.lit; x.pw = p; });
            break;
          }
          default: break;
        }
      }
      if (!S.changed) return;
    }
  }

  function runTick(i, c) {
    switch (c.t) {
      case 'repeater': repTick(i, c); break;
      case 'comparator': cmpRefresh(i, c); break;
      case 'torch': torchTick(i, c); break;
      case 'observer':
        if (c.on) mut(i, (x) => { x.on = false; });
        else { mut(i, (x) => { x.on = true; }); schedule(i, 2, PRI_NORMAL); }
        break;
      case 'lamp': if (c.lit && !hasSignal(i)) mut(i, (x) => { x.lit = false; }); break;
      case 'dispenser':
        if (c.items > 0) { c.items--; c.shots++; S.fx.set(i, { until: S.now + 6, kind: 'shot' }); S.changed = true; }
        else S.fx.set(i, { until: S.now + 6, kind: 'empty' });
        break;
      case 'button': if (c.on) mut(i, (x) => { x.on = false; }); break;
      case 'plate': case 'string':
        if (c.on) {
          if (c.standing) schedule(i, c.t === 'string' ? 10 : 20, PRI_NORMAL);
          else mut(i, (x) => { x.on = false; });
        }
        break;
      default: break;
    }
  }
  function runScheduled() {
    const due = [];
    for (const e of S.sched.values()) if (e.time <= S.now) due.push(e);
    if (!due.length) return;
    due.sort((a, b) => a.time - b.time || a.pri - b.pri || a.seq - b.seq);
    for (const e of due) { S.sched.delete(e.k); S.running.add(e.k); }
    S.handling = true;
    for (const e of due) {
      S.running.delete(e.k);
      const c = S.cells[e.i];
      if (c && c.t === e.t) { runTick(e.i, c); settle(); }
    }
    S.handling = false;
  }
  function entities() {
    for (let i = 0; i < N; i++) {
      const c = S.cells[i];
      if (c && (c.t === 'string' || c.t === 'plate') && c.standing && !c.on) {
        mut(i, (x) => { x.on = true; });
        schedule(i, c.t === 'string' ? 10 : 20, PRI_NORMAL);
        settle();
      }
    }
  }
  /* One game tick, in Java's order: scheduled ticks → block events (pistons) → entities → block entities (moving blocks). */
  function step() {
    S.now++;
    runScheduled();
    runEvents();
    entities();
    tickMovers();
    for (const [i, e] of S.fx) if (e.until <= S.now) S.fx.delete(i);
  }

  /* ---- editing (what a player does) ---- */
  function place(i, t, f, o) {
    if (i < 0 || S.cells[i]) return false;
    let ff = f == null ? -1 : f;
    if (ATTACH[t]) {
      const opts = wallOptions(i);
      if (ff < 0 || opts.indexOf(ff) < 0) {
        const pref = ff < 0 ? [] : [ff, cw(ff), ccw(ff), opp(ff)];
        const alt = pref.find((d) => opts.indexOf(d) >= 0);
        ff = alt == null ? -1 : alt;
      }
      if (t === 'hook' && ff < 0) {
        note('Tripwire hooks have to be stuck to the side of a block. Place a block first, then the hook next to it.');
        return false;
      }
    }
    const c = makeCell(t, ff, o);
    setCell(i, c);
    if (t === 'dispenser') c.trig = hasSignal(i);
    if (t === 'repeater' && repInput(i, c) > 0) schedule(i, 1, PRI_NORMAL);
    settle();
    return true;
  }
  function erase(i) {
    const c = at(i);
    if (!c) return false;
    if (c.t === 'piston' && c.ext) removeHead(nb(i, c.f));
    if (c.t === 'head') { const b = nb(i, opp(c.f)), bc = at(b); if (bc && bc.t === 'piston') setCell(b, null); }
    setCell(i, null);
    settle();
    return true;
  }
  function use(i) {
    const c = at(i);
    if (!c) return false;
    switch (c.t) {
      case 'lever': mut(i, (x) => { x.on = !x.on; }); break;
      case 'button':
        if (!c.on) { mut(i, (x) => { x.on = true; }); schedule(i, c.wood ? 30 : 20, PRI_NORMAL); }
        break;
      case 'plate': case 'string': c.standing = !c.standing; break;
      case 'repeater': mut(i, (x) => { x.d = (x.d % 4) + 1; }); break;
      case 'comparator': mut(i, (x) => { x.sub = !x.sub; }); cmpRefresh(i, c); break;
      case 'dust':
        if (!linksOf(i)) mut(i, (x) => { x.dot = !x.dot; x.sh = x.dot ? 0 : 15; });
        else return false;
        break;
      case 'dispenser': c.items = FULL_AMMO; S.changed = true; break;
      default: return false;
    }
    settle();
    return true;
  }
  function setDelay(i, d) {
    const c = at(i);
    if (!c || c.t !== 'repeater' || c.d === d) return false;
    mut(i, (x) => { x.d = d; });
    settle();
    return true;
  }
  function rotate(i) {
    const c = at(i);
    if (!c) return false;
    switch (c.t) {
      case 'repeater': setCell(i, makeCell('repeater', cw(c.f), { d: c.d })); break;
      case 'comparator': setCell(i, makeCell('comparator', cw(c.f), { sub: c.sub })); break;
      case 'observer': setCell(i, makeCell('observer', cw(c.f))); break;
      case 'dispenser': setCell(i, makeCell('dispenser', cw(c.f), { items: c.items })); break;
      case 'piston':
        if (c.ext) { note('Let the piston retract before turning it.'); return false; }
        setCell(i, makeCell('piston', cw(c.f), { sticky: c.sticky }));
        break;
      case 'torch': case 'lever': case 'button': case 'hook': {
        const opts = wallOptions(i);
        if (c.t !== 'hook') opts.push(-1);
        const order = [-1, 0, 1, 2, 3];
        const k = order.indexOf(c.f);
        let nf = c.f;
        for (let s = 1; s <= 5; s++) {
          const cand = order[(k + s) % 5];
          if (opts.indexOf(cand) >= 0) { nf = cand; break; }
        }
        if (nf === c.f) {
          note(c.t === 'hook' ? 'There is no other block this hook could be stuck to.' : 'There is no other way to place it here.');
          return false;
        }
        setCell(i, makeCell(c.t, nf, { wood: c.wood, on: c.t === 'lever' ? c.on : false }));
        break;
      }
      default: return false;
    }
    settle();
    return true;
  }

  /* ---- saving and loading layouts ---- */
  function fname(f) { return f < 0 ? 'floor' : DN[f]; }
  function serialize() {
    const out = [];
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      let c = S.cells[i];
      if (!c) continue;
      if (c.t === 'moving') c = c.src ? (c.carry && c.carry.t === 'piston' ? c.carry : null) : c.carry;
      if (!c) continue;
      switch (c.t) {
        case 'head': break;
        case 'dust': out.push(c.dot ? ['dust', x, y, 'dot'] : ['dust', x, y]); break;
        case 'torch': out.push(['torch', x, y, fname(c.f)]); break;
        case 'repeater': out.push(['repeater', x, y, DN[c.f], c.d]); break;
        case 'comparator': out.push(['comparator', x, y, DN[c.f], c.sub ? 'subtract' : 'compare']); break;
        case 'observer': out.push(['observer', x, y, DN[c.f]]); break;
        case 'piston': out.push([c.sticky ? 'sticky_piston' : 'piston', x, y, DN[c.f]]); break;
        case 'lever': out.push(['lever', x, y, fname(c.f), c.on ? 'on' : 'off']); break;
        case 'button': out.push([c.wood ? 'wood_button' : 'stone_button', x, y, fname(c.f)]); break;
        case 'plate': out.push(['pressure_plate', x, y]); break;
        case 'hook': out.push(['tripwire_hook', x, y, DN[c.f]]); break;
        case 'string': out.push(['tripwire', x, y]); break;
        case 'dispenser': out.push(['dispenser', x, y, DN[c.f]]); break;
        case 'bulb': out.push(['copper_bulb', x, y]); break;
        case 'rblock': out.push(['redstone_block', x, y]); break;
        case 'lamp': out.push(['lamp', x, y]); break;
        default: out.push([c.t, x, y]); break;
      }
    }
    return { v: 1, w: W, h: H, cells: out };
  }
  function load(data) {
    S.cells.fill(null);
    S.sched.clear();
    S.running.clear();
    S.events.length = 0;
    S.eventKeys.clear();
    S.fx.clear();
    S.notices.length = 0;
    S.now = 0;
    let bad = 0;
    const list = data && Array.isArray(data.cells) ? data.cells : [];
    for (const r of list) {
      if (!Array.isArray(r)) { bad++; continue; }
      const spec = NAMES[String(r[0]).toLowerCase()];
      const x = Number(r[1]), y = Number(r[2]);
      if (!spec || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= W || y >= H) { bad++; continue; }
      const t = spec[0], o = Object.assign({}, spec[1] || {});
      let f = -1;
      if (t === 'repeater' || t === 'comparator' || t === 'observer' || t === 'piston' || t === 'hook' || t === 'dispenser') f = parseFacing(r[3], 1);
      else if (t === 'torch' || t === 'lever' || t === 'button') f = parseFacing(r[3], -1);
      if (t === 'repeater') o.d = Math.min(4, Math.max(1, Number(r[4]) || 1));
      if (t === 'comparator') o.sub = String(r[4] || '').toLowerCase().indexOf('sub') === 0;
      if (t === 'lever') o.on = String(r[4] || '').toLowerCase() === 'on';
      if (t === 'dust') o.dot = String(r[3] || '').toLowerCase() === 'dot';
      S.cells[y * W + x] = makeCell(t, f, o);
    }
    settle();
    return bad;
  }

  return {
    S, W, H, N, nb, at, step, settle, place, erase, use, rotate, setDelay, load, serialize,
    blockPower, signalFrom, hasSignal, repInput, repLocked, cmpRear, cmpSide, cmpOut, pistonPowered,
    torchPowered, sturdy, supported, wallOptions, pendingAt, analog, linksOf,
  };
}

// Marks this file as fully loaded (if it is missing, index.html shows which file has a mistake).
if (window.__rlLoaded) window.__rlLoaded.push('engine.js');
