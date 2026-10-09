/* ================= The page =================
   The app screen, built with Preact + htm (both are in app/vendor, so there is no build step).
   renderVals() works out everything the page shows, and view(v) at the bottom of this file draws it. */
const { h, Component: PreactComponent, createRef } = window.preact;
const html = window.htm.bind(h);

/* ================= Parts palette ================= */
const PALETTE = [
  { title: 'Power sources', items: [
    { id: 'lever', name: 'Lever', t: 'lever', att: true },
    { id: 'stone_button', name: 'Stone button', t: 'button', att: true },
    { id: 'wood_button', name: 'Wood button', t: 'button', att: true, o: { wood: true } },
    { id: 'plate', name: 'Pressure plate', t: 'plate' },
    { id: 'hook', name: 'Tripwire hook', t: 'hook', att: true, dir: true },
    { id: 'string', name: 'Tripwire', t: 'string' },
    { id: 'torch', name: 'Redstone torch', t: 'torch', att: true },
    { id: 'rblock', name: 'Redstone block', t: 'rblock' },
  ] },
  { title: 'Wiring', items: [
    { id: 'dust', name: 'Redstone dust', t: 'dust' },
    { id: 'repeater', name: 'Repeater', t: 'repeater', dir: true },
    { id: 'comparator', name: 'Comparator', t: 'comparator', dir: true },
    { id: 'observer', name: 'Observer', t: 'observer', dir: true },
  ] },
  { title: 'Blocks', items: [
    { id: 'block', name: 'Solid block', t: 'block' },
    { id: 'glass', name: 'Glass', t: 'glass' },
  ] },
  { title: 'Things to power', items: [
    { id: 'lamp', name: 'Redstone lamp', t: 'lamp' },
    { id: 'piston', name: 'Piston', t: 'piston', dir: true },
    { id: 'sticky', name: 'Sticky piston', t: 'piston', dir: true, o: { sticky: true } },
    { id: 'dispenser', name: 'Dispenser', t: 'dispenser', dir: true },
    { id: 'bulb', name: 'Copper bulb', t: 'bulb' },
  ] },
  { title: 'Items', items: [
    { id: 'chest', name: 'Chest', t: 'chest' },
    { id: 'hopper', name: 'Hopper', t: 'hopper', dir: true },
    { id: 'dropper', name: 'Dropper', t: 'dropper', dir: true },
  ] },
  { title: 'Tools', items: [{ id: 'eraser', name: 'Eraser', t: 'eraser' }] },
];
const BRUSH = {};
PALETTE.forEach((g) => g.items.forEach((it) => { BRUSH[it.id] = it; }));
function iconCell(it) {
  const c = makeCell(it.t, it.t === 'button' ? -1 : it.att || it.dir ? 1 : -1, it.o);
  if (c.t === 'hook') c.ok = true;
  if (c.t === 'dust') c.p = 15;
  if (c.t === 'lamp' || c.t === 'bulb') c.lit = true;
  return c;
}
function facingHint(b, f) {
  const w = DWORD[f] + ' ' + DARROW[f];
  switch (b.t) {
    case 'repeater': case 'comparator': return 'Output points ' + w + '.';
    case 'observer': return 'Watches ' + w + '. The pulse comes out the back.';
    case 'piston': return 'Pushes ' + w + '.';
    case 'dispenser': return 'Shoots ' + w + '.';
    case 'hopper': return 'Pushes items ' + w + '. Takes them from behind.';
    case 'dropper': return 'Drops items ' + w + '.';
    case 'hook': return 'Points ' + w + ' at the string. Needs a block behind it.';
    case 'torch': case 'lever': case 'button': return 'Hangs on a block, facing ' + w + '. No block? It goes on the floor.';
    case 'eraser': return 'Click or drag over parts to remove them.';
    default: return 'This part has no direction.';
  }
}
const SPEEDS = [[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×']];
const ARROW_DIRS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
/* Which way (0-3 = up/right/down/left) a point dx, dy away from a square's centre is, snapped to the
   nearest side. -1 while it's still within `dead` of the centre. */
function dirToward(dx, dy, dead) {
  if (Math.hypot(dx, dy) < dead) return -1;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0);
}
/* "The repeater now points east →." and so on, after a part was turned. */
function facingWords(what, f, t) {
  if (f < 0) return 'The ' + what + ' is now standing on the floor.';
  const w = DWORD[f] + ' ' + DARROW[f];
  switch (t) {
    case 'observer': return 'The observer now watches ' + w + '. Its pulse comes out the ' + DWORD[opp(f)] + ' side.';
    case 'piston': return 'The ' + what + ' now pushes ' + w + '.';
    case 'dispenser': return 'The dispenser now shoots ' + w + '.';
    default: return 'The ' + what + ' now points ' + w + '.';
  }
}
/* "1 golden apple", "5 diamonds". */
function itemWords(id, n) {
  const it = ITEMS[id];
  if (!it) return n + ' ' + id;
  return n + ' ' + (n === 1 ? it.name.replace(/ \(.*\)$/, '').toLowerCase() : it.plural);
}
/* "2 golden apples and 1 diamond" from { golden_apple: 2, diamond: 1 }. */
function pileWords(pile) {
  const parts = Object.keys(pile).filter((id) => pile[id] > 0).map((id) => itemWords(id, pile[id]));
  return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0] || 'nothing';
}
/* True while you're typing in a text box, so letters like R keep working there. */
function typingIn(el) {
  return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.isContentEditable);
}

class RedstoneLab extends PreactComponent {
  constructor(props) {
    super(props);
    this.sim = createSim(GW, GH);
    this.svgRef = createRef();
    this.vcache = new Map();
    this.undoStack = [];
    this.probes = [];
    this.stroke = null;
    this.aim = null;      // set while R is held: which part (or the piece in your hand) is being pointed
    this.pointer = null;  // last mouse position, for pointing with R
    this.mounted = false;
    this.noticeTimer = null;
    this.raf = 0;
    let quick = true;
    try { quick = window.localStorage.getItem('redstone-lab-quick') !== 'off'; } catch (err) { quick = true; }
    /* The layout Reset goes back to: the concept (or layout code) that was loaded last. Clear doesn’t change it.
       (Not called "base": Preact uses this.base for its own bookkeeping.) */
    this.startLayout = { id: 'blank', cells: [], probes: [] };
    this.state = {
      brush: 'dust', facing: 1, hover: -1, kb: -1, sel: -1, kbMode: false,
      playing: true, speed: 1, nums: true, quick,
      step: -1, stepHover: -1, notice: '', toast: '', code: '', concept: 'tripwire-clock',
    };
    const bind = ['gDown', 'gMove', 'gUp', 'gLeave', 'gCtx', 'gKey', 'gDragOver', 'gDrop', 'togglePlay', 'stepBtn',
      'undo', 'restart', 'resetBuild', 'hideQuick', 'hideToast', 'toggleNums', 'toggleWalk', 'onCode', 'copyCode', 'loadCode',
      'clearGrid', 'stepPrev', 'stepNext', 'onWinKeyDown', 'onWinKeyUp', 'onWinPointerMove', 'onWinBlur'];
    for (const k of bind) this[k] = this[k].bind(this);
    this.speedFns = SPEEDS.map((s) => () => this.setState({ speed: s[0] }));
    this.faceFns = [0, 1, 2, 3].map((d) => () => this.setState({ facing: d }));
    this.palette = PALETTE.map((g) => ({ title: g.title, items: g.items.map((it) => this.makePalItem(it)) }));
    this.libFns = {};
    this.stepFns = {};
    this.shopFns = {
      pay1: () => this.payShop('diamond', 1), pay5: () => this.payShop('diamond', 5), payDirt: () => this.payShop('dirt', 1),
      cheaper: () => this.setShopPrice(-1), dearer: () => this.setShopPrice(1),
    };
    this.bg = gridPaths();
    this.applyConcept('tripwire-clock');
  }

  makePalItem(it) {
    return {
      id: it.id,
      name: it.name,
      icon: it.t === 'eraser' ? ERASER_ICON : drawPart(iconCell(it), { nums: false, power: null, axis: 'h' }),
      pick: () => this.setState({ brush: it.id }),
      drag: (e) => {
        try { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; } catch (err) { /* ignore */ }
        this.setState({ brush: it.id });
      },
    };
  }

  componentDidMount() {
    this.mounted = true;
    /* The Linux app adds ?updated=1 to the page address when it has just downloaded a newer version from GitHub. */
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('updated')) this.showToast('Updated to the newest version from GitHub.' + (q.get('msg') ? ' Latest change: “' + q.get('msg') + '”' : ''));
    } catch (err) { /* ignore */ }
    let last = performance.now(), acc = 0;
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(200, Math.max(0, t - last));
      last = t;
      if (!this.state.playing) { acc = 0; return; }
      acc += dt * this.state.speed;
      let n = 0;
      while (acc >= 50 && n < 24) { acc -= 50; this.tickOnce(); n++; }
      if (n >= 24) acc = 0;
      if (n) this.refresh();
    };
    this.raf = requestAnimationFrame(loop);
    window.addEventListener('keydown', this.onWinKeyDown);
    window.addEventListener('keyup', this.onWinKeyUp);
    window.addEventListener('pointermove', this.onWinPointerMove);
    window.addEventListener('blur', this.onWinBlur);
  }
  componentWillUnmount() {
    this.mounted = false;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.noticeTimer);
    window.removeEventListener('keydown', this.onWinKeyDown);
    window.removeEventListener('keyup', this.onWinKeyUp);
    window.removeEventListener('pointermove', this.onWinPointerMove);
    window.removeEventListener('blur', this.onWinBlur);
  }

  put(patch) { if (this.mounted) this.setState(patch); else Object.assign(this.state, patch); }
  tickOnce() {
    this.sim.step();
    for (const p of this.probes) {
      p.hist.push(probeValue(this.sim, p.i));
      if (p.hist.length > 120) p.hist.shift();
    }
  }
  refresh() {
    const n = this.sim.S.notices;
    if (n.length) { const msg = n[n.length - 1]; n.length = 0; this.flash(msg); }
    else if (this.mounted) this.forceUpdate();
  }
  flash(msg) {
    clearTimeout(this.noticeTimer);
    this.put({ notice: msg });
    this.noticeTimer = setTimeout(() => this.put({ notice: '' }), 6000);
  }
  /* A pop-up at the bottom of the window that stays until you press OK (used for app updates). */
  showToast(text) { this.put({ toast: String(text || '') }); }
  hideToast() { this.setState({ toast: '' }); }

  concept() { return CONCEPTS.find((c) => c.id === this.state.concept) || CONCEPTS[0]; }
  applyConcept(id) {
    const cp = CONCEPTS.find((c) => c.id === id) || CONCEPTS[0];
    this.startLayout = { id: cp.id, cells: cp.cells, probes: cp.probes || [] };
    this.loadStartLayout();
    this.put({ concept: cp.id });
  }
  startTitle() {
    if (this.startLayout.id === 'custom') return 'the layout you loaded';
    const cp = CONCEPTS.find((c) => c.id === this.startLayout.id);
    return cp ? '“' + cp.title + '”' : 'the starting layout';
  }
  /* Loads the layout the current concept (or loaded code) started with: the target of Reset. */
  loadStartLayout() {
    this.sim.load({ cells: this.startLayout.cells });
    this.sim.S.notices.length = 0;
    this.probes = (this.startLayout.probes || []).map((p) => ({ i: p[1] * GW + p[0], label: p[2], hist: [] }));
    this.put({ step: -1, stepHover: -1, sel: -1 });
  }
  loadConcept(id) { this.snapshot(true); this.applyConcept(id); }
  resetBuild() {
    this.snapshot(true);
    this.loadStartLayout();
    this.put({ concept: this.startLayout.id });
    this.flash(this.startLayout.id === 'blank' ? 'Reset: the grid is empty again. Undo brings your build back.' : 'Reset: everything is back the way it started. Undo brings your changes back.');
  }
  hideQuick() {
    this.setState({ quick: false });
    try { window.localStorage.setItem('redstone-lab-quick', 'off'); } catch (err) { /* ignore */ }
  }

  /* Saves the build for Undo. Big moves (Clear, Reset, loading a concept or code) also save which concept card
     was showing, what Reset goes back to, and the tracked parts, so Undo brings all of that back too. */
  snapshot(full) {
    const e = { data: JSON.stringify(this.sim.serialize()) };
    if (full) {
      e.concept = this.state.concept;
      e.startLayout = this.startLayout;
      e.probes = this.probes.map((p) => ({ i: p.i, label: p.label }));
    }
    this.undoStack.push(e);
    if (this.undoStack.length > 80) this.undoStack.shift();
  }
  undo() {
    const e = this.undoStack.pop();
    if (!e) { this.flash('Nothing to undo.'); return; }
    this.sim.load(JSON.parse(e.data));
    this.sim.S.notices.length = 0;
    if (e.concept) {
      this.startLayout = e.startLayout;
      this.probes = e.probes.map((p) => ({ i: p.i, label: p.label, hist: [] }));
      this.put({ concept: e.concept, step: -1, stepHover: -1, sel: -1 });
    } else for (const p of this.probes) p.hist = [];
    this.flash('Undone. The power started over from 0 s.');
  }
  restart() {
    this.sim.load(this.sim.serialize());
    this.sim.S.notices.length = 0;
    for (const p of this.probes) p.hist = [];
    this.flash('Time is back at 0 s. Your build is the same; everything switched off and powered up again.');
  }

  brush(id) { return BRUSH[id || this.state.brush] || BRUSH.dust; }
  placeAt(i, id) {
    const b = this.brush(id);
    if (b.t === 'eraser') return false;
    return this.sim.place(i, b.t, b.dir || b.att ? this.state.facing : -1, b.o);
  }
  cellAt(e) {
    const el = this.svgRef.current;
    if (!el) return -1;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return -1;
    const x = Math.floor(((e.clientX - r.left) / r.width) * GW), y = Math.floor(((e.clientY - r.top) / r.height) * GH);
    return x >= 0 && y >= 0 && x < GW && y < GH ? y * GW + x : -1;
  }
  act(i, erase, shift, stroke) {
    const sim = this.sim, c = sim.at(i), b = this.brush();
    this.stroke = null;
    if (erase || b.t === 'eraser') {
      if (c) { this.snapshot(); sim.erase(i); }
      if (stroke) this.stroke = { mode: 'erase', last: i, saved: !!c };
    } else if (shift) {
      if (c) { this.snapshot(); if (!sim.rotate(i)) this.undoStack.pop(); }
    } else if (c) {
      const coin = this.shopCell('pay');
      if (i === coin) this.payShop('diamond', 1);
      else if (INV_SIZE[c.t]) sim.S.notices.push('To put items in or take them out, use the buttons in the panel on the right.');
      else sim.use(i);
      if (!this.state.playing && (c.t === 'string' || c.t === 'plate' || c.t === 'button')) {
        sim.S.notices.push('The simulation is paused. Press Play or step forward to see it react.');
      }
    } else if (sim.S.ground.has(i)) {
      const got = sim.pickUp(i);
      sim.S.notices.push('You picked up ' + pileWords(got) + '.');
    } else {
      this.snapshot();
      if (!this.placeAt(i)) this.undoStack.pop();
      if (stroke) this.stroke = { mode: 'place', last: i };
    }
    this.refresh();
  }
  gDown(e) {
    if (this.aim) { e.preventDefault(); return; }
    if (e.button === 1) return;
    const i = this.cellAt(e);
    if (i < 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    try { el.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    this.act(i, e.button === 2, e.shiftKey, true);
    this.setState({ hover: i, sel: i, kb: i, kbMode: false });
  }
  gMove(e) {
    const i = this.cellAt(e), s = this.stroke;
    if (s && i >= 0 && i !== s.last) {
      for (const j of lineCells(s.last, i)) {
        if (s.mode === 'place') { if (!this.sim.at(j)) this.placeAt(j); }
        else if (this.sim.at(j)) {
          if (!s.saved) { this.snapshot(); s.saved = true; }
          this.sim.erase(j);
        }
      }
      s.last = i;
      this.refresh();
    }
    if (i !== this.state.hover) this.setState({ hover: i });
  }
  gUp(e) {
    this.stroke = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  }
  gLeave() { if (!this.stroke && this.state.hover !== -1) this.setState({ hover: -1 }); }
  gCtx(e) { e.preventDefault(); }
  gKey(e) {
    if (this.aim) return; // R is held: the arrow keys point the part instead (see onWinKeyDown)
    const k = e.key, st = this.state;
    let cur = st.kb >= 0 ? st.kb : st.sel >= 0 ? st.sel : (GH >> 1) * GW + (GW >> 1);
    const mv = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 }[k];
    if (mv != null) {
      e.preventDefault();
      if (st.kbMode) { const n = this.sim.nb(cur, mv); if (n >= 0) cur = n; }
      this.setState({ kb: cur, sel: cur, kbMode: true });
      return;
    }
    if (k === 'Enter' || k === ' ') { e.preventDefault(); this.act(cur, false, e.shiftKey, false); this.setState({ kb: cur, sel: cur, kbMode: true }); return; }
    if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.act(cur, true, false, false); this.setState({ kb: cur, sel: cur, kbMode: true }); }
  }
  gDragOver(e) {
    e.preventDefault();
    try { e.dataTransfer.dropEffect = 'copy'; } catch (err) { /* ignore */ }
    const i = this.cellAt(e);
    if (i !== this.state.hover) this.setState({ hover: i });
  }
  gDrop(e) {
    e.preventDefault();
    let id = '';
    try { id = e.dataTransfer.getData('text/plain'); } catch (err) { /* ignore */ }
    if (!BRUSH[id]) id = this.state.brush;
    const i = this.cellAt(e);
    if (i >= 0 && BRUSH[id].t !== 'eraser' && !this.sim.at(i)) {
      this.snapshot();
      if (!this.placeAt(i, id)) this.undoStack.pop();
      this.refresh();
    }
    this.setState({ brush: id, hover: i, sel: i });
  }

  togglePlay() { this.setState({ playing: !this.state.playing }); }
  stepBtn(e) {
    const n = e && e.shiftKey ? 1 : 2;
    for (let k = 0; k < n; k++) this.tickOnce();
    this.put({ playing: false });
    this.refresh();
  }
  toggleNums() { this.setState({ nums: !this.state.nums }); }

  walkCell() {
    const cp = this.concept();
    if (!cp.walk) return -1;
    const i = cp.walk[1] * GW + cp.walk[0], c = this.sim.at(i);
    return c && c.t === 'string' ? i : -1;
  }
  toggleWalk() {
    const i = this.walkCell();
    if (i < 0) { this.flash('That piece of tripwire is gone. Put string back there, or reload the concept.'); return; }
    this.sim.use(i);
    if (!this.state.playing) this.sim.S.notices.push('The simulation is paused. Press Play or step forward to see it react.');
    this.put({ sel: i });
    this.refresh();
  }

  useCell(i) { this.sim.use(i); this.refresh(); }
  turnCell(i, back) { this.snapshot(); if (!this.sim.rotate(i, back)) this.undoStack.pop(); this.refresh(); }
  deleteCell(i) { this.snapshot(); this.sim.erase(i); this.refresh(); }

  /* ---- Items: putting them in, taking them out, and the shop panel ---- */
  giveTo(i, id, n) {
    this.snapshot();
    const k = this.sim.giveItems(i, id, n);
    if (!k) { this.undoStack.pop(); this.flash('There’s no room for ' + itemWords(id, n) + ' in there.'); }
    else this.flash('Put ' + itemWords(id, k) + ' into the ' + shortName(this.sim.at(i)).toLowerCase() + '.');
    this.refresh();
  }
  takeAllFrom(i) {
    this.snapshot();
    const got = this.sim.takeAll(i);
    this.flash(Object.keys(got).length ? 'Took out ' + pileWords(got) + '.' : 'It was already empty.');
    this.refresh();
  }
  invView(slots) {
    return slots.map((st) => (st ? { icon: itemIcon(st.id, 0, 0, 40), n: st.n, name: ITEMS[st.id].name } : null));
  }
  /* A square named in the concept's shop settings ('pay', 'price', 'payout', 'bank' or 'stock'), or -1. */
  shopCell(key) {
    const sh = this.concept().shop;
    return sh && sh[key] ? sh[key][1] * GW + sh[key][0] : -1;
  }
  shopCount(key, id) {
    const c = this.sim.at(this.shopCell(key));
    return c && c.slots ? c.slots.reduce((a, st) => a + (st && st.id === id ? st.n : 0), 0) : 0;
  }
  /* The price is the number of tokens in the counter dropper plus the hopper it drops them into. */
  shopPrice() {
    const t = this.shopCell('price'), c = this.sim.at(t);
    if (!c || !c.slots) return 0;
    const q = this.sim.at(this.sim.nb(t, c.f));
    const tok = (x) => (x && x.slots ? x.slots.reduce((a, st) => a + (st && st.id === 'token' ? st.n : 0), 0) : 0);
    return tok(c) + tok(q);
  }
  /* Diamonds in the bank chest, plus any on their way in (in a hopper pointing into it). */
  shopBank() {
    const b = this.shopCell('bank');
    if (b < 0) return 0;
    let n = this.shopCount('bank', 'diamond');
    for (let d = 0; d < 4; d++) {
      const j = this.sim.nb(b, d), c = this.sim.at(j);
      if (c && c.t === 'hopper' && this.sim.nb(j, c.f) === b) n += c.slots.reduce((a, st) => a + (st && st.id === 'diamond' ? st.n : 0), 0);
    }
    return n;
  }
  /* Golden apples still in the machine: the stock chest, the hopper under it and the payout dropper. */
  shopStock() {
    return this.sim.S.cells.reduce((a, c) => a + (c && c.slots ? c.slots.reduce((b, st) => b + (st && st.id === 'golden_apple' ? st.n : 0), 0) : 0), 0);
  }
  payShop(id, n) {
    const coin = this.shopCell('pay');
    if (coin < 0 || !this.sim.at(coin)) { this.flash('The coin slot is gone. Press Reset to rebuild the shop.'); return; }
    const k = this.sim.giveItems(coin, id, n);
    if (!k) this.flash('The coin slot is full.');
    else if (id === 'diamond') this.flash('Paid ' + itemWords('diamond', k) + ' into the coin slot.');
    else this.flash('Put ' + itemWords(id, k) + ' into the coin slot. Watch: the filter won’t take it.');
    if (!this.state.playing) this.sim.S.notices.push('The simulation is paused. Press Play or step forward to see it react.');
    this.refresh();
  }
  setShopPrice(delta) {
    const t = this.shopCell('price'), c = this.sim.at(t);
    if (!c || !c.slots) { this.flash('The counter dropper is gone. Press Reset to rebuild the shop.'); return; }
    const price = this.shopPrice(), inT = this.shopCount('price', 'token');
    if (inT !== price) { this.flash('The counter is in the middle of a sale (some tokens are out of the counter dropper). Finish paying, or press Reset, then change the price.'); return; }
    if (price + delta < 2) { this.flash('This counter needs a price of at least 2. (For a price of 1, skip the counter: run the pulse line straight to the payout dropper.)'); return; }
    if (price + delta > 20) { this.flash('Let’s keep the price at 20 diamonds or less.'); return; }
    if (delta > 0) this.sim.giveItems(t, 'token', delta); else this.sim.takeItems(t, 'token', -delta);
    this.flash('The price is now ' + itemWords('diamond', price + delta) + ' (' + (price + delta) + ' tokens in the counter dropper).');
    this.refresh();
  }

  /* ================= Turning parts with R =================
     Tap R: the part under the mouse (or the selected part) turns to its next direction. Shift+R turns it back.
     Hold R and move the mouse: the part turns to face the mouse, snapping to up, right, down or left.
     Let go of R to keep it, or press Esc to put it back. The arrow keys work too while R is held.
     With no part to turn, R does the same to the piece in your hand. */
  redraw() { if (this.mounted) this.forceUpdate(); }
  aimTarget() {
    const st = this.state, b = this.brush();
    const turnable = (i) => { const c = i >= 0 ? this.sim.at(i) : null; return !!c && !!TURNABLE[c.t]; };
    const under = st.kbMode ? st.kb : st.hover;
    const aimsBrush = !!(b.dir || b.att);
    // 1. a part you're pointing at  2. the piece in your hand, over the empty square you're pointing at
    // 3. the selected part  4. the piece in your hand (tapping R turns it)
    if (turnable(under)) return { kind: 'part', i: under };
    if (aimsBrush && under >= 0 && !this.sim.at(under)) return { kind: 'brush', i: under };
    if (turnable(st.sel)) return { kind: 'part', i: st.sel };
    if (aimsBrush) return { kind: 'brush', i: -1 };
    return null;
  }
  aimStart(back) {
    const t = this.aimTarget();
    if (!t) {
      this.flash('Point at a part that can turn (a repeater, observer, piston and so on), then press R.');
      return false;
    }
    const f = t.kind === 'part' ? this.sim.at(t.i).f : this.state.facing;
    // It only follows the mouse once the mouse moves, so a quick tap of R always turns one step.
    this.aim = { kind: t.kind, i: t.i, back: !!back, orig: f, cur: f, aimed: false, saved: false };
    this.stroke = null;
    if (t.kind === 'part') this.put({ sel: t.i });
    this.redraw();
    return true;
  }
  /* The way from the aimed square to the mouse, or -1 while the mouse is still on that square. */
  aimDirAtPointer() {
    const a = this.aim, el = this.svgRef.current, p = this.pointer;
    if (!a || a.i < 0 || !el || !p) return -1;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return -1;
    const w = r.width / GW, h = r.height / GH;
    const cx = r.left + ((a.i % GW) + 0.5) * w, cy = r.top + (((a.i / GW) | 0) + 0.5) * h;
    return dirToward(p.x - cx, p.y - cy, 0.45 * w);
  }
  aimFollowPointer() {
    const d = this.aimDirAtPointer();
    if (d >= 0) this.aimToward(d);
  }
  /* Point the aimed part (or the piece in your hand) toward d. */
  aimToward(d) {
    const a = this.aim;
    if (!a) return;
    a.aimed = true;
    if (a.kind === 'brush') {
      if (a.cur !== d) { a.cur = d; this.put({ facing: d }); }
      return;
    }
    const c = this.sim.at(a.i);
    if (!c || !TURNABLE[c.t]) { this.aim = null; this.redraw(); return; }
    if (c.f === d || this.sim.facingOptions(a.i).indexOf(d) < 0) return;
    if (!a.saved) { this.snapshot(); a.saved = true; }
    if (this.sim.setFacing(a.i, d)) a.cur = d;
    this.refresh();
  }
  aimEnd(keep) {
    const a = this.aim;
    if (!a) return;
    this.aim = null;
    const pc = a.kind === 'part' ? this.sim.at(a.i) : null;
    const what = pc ? shortName(pc).toLowerCase() : this.brush().name.toLowerCase();
    const type = pc ? pc.t : this.brush().t;
    if (!keep) {
      if (a.kind === 'part' && a.saved) {
        this.sim.setFacing(a.i, a.orig);
        this.undoStack.pop();
      } else if (a.kind === 'brush') this.put({ facing: a.orig });
      this.flash('Put back the way it was.');
    } else if (!a.aimed) {
      // A quick tap: turn one step.
      if (a.kind === 'part') {
        this.turnCell(a.i, a.back);
        const c = this.sim.at(a.i);
        if (c && c.f !== a.orig) this.flash(facingWords(what, c.f, c.t));
      } else {
        const f = a.back ? ccw(this.state.facing) : cw(this.state.facing);
        this.put({ facing: f });
      }
    } else if (a.kind === 'part' && a.saved && a.cur !== a.orig) {
      this.flash(facingWords(what, a.cur, type) + ' Undo puts it back.');
    } else if (a.kind === 'brush' && a.cur !== a.orig) {
      this.flash('The ' + what + ' in your hand now faces ' + DWORD[a.cur] + ' ' + DARROW[a.cur] + '.');
    }
    this.refresh();
  }
  onWinKeyDown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target)) return;
    const k = e.key;
    if (this.aim) {
      const d = ARROW_DIRS[k];
      if (d != null) { e.preventDefault(); this.aimToward(d); this.redraw(); return; }
      if (k === 'Escape') { e.preventDefault(); this.aimEnd(false); return; }
    }
    if (k !== 'r' && k !== 'R') return;
    e.preventDefault();
    if (e.repeat || this.aim) return;
    this.aimStart(e.shiftKey);
  }
  onWinKeyUp(e) {
    if (this.aim && (e.key === 'r' || e.key === 'R')) this.aimEnd(true);
  }
  onWinPointerMove(e) {
    this.pointer = { x: e.clientX, y: e.clientY };
    if (!this.aim || this.aim.i < 0) return;
    this.aimFollowPointer();
    this.redraw();
  }
  onWinBlur() { if (this.aim) this.aimEnd(true); }
  setDelay(i, d) { if (this.sim.setDelay(i, d)) this.refresh(); }
  isProbed(i) { return this.probes.some((p) => p.i === i); }
  toggleProbe(i) {
    const k = this.probes.findIndex((p) => p.i === i);
    if (k >= 0) this.probes.splice(k, 1);
    else {
      if (this.probes.length >= 4) this.probes.shift();
      const c = this.sim.at(i);
      this.probes.push({ i, label: (c ? shortName(c) : 'Square') + ' at ' + (i % GW) + ',' + ((i / GW) | 0), hist: [] });
    }
    this.forceUpdate();
  }
  removeProbe(k) { this.probes.splice(k, 1); this.forceUpdate(); }

  onCode(e) { this.setState({ code: e.target.value }); }
  copyCode() {
    const code = JSON.stringify(this.sim.serialize());
    this.setState({ code });
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => this.flash('Layout code copied.'), () => this.flash('The code is in the box. Select it and copy.'));
        ok = true;
      }
    } catch (err) { ok = false; }
    if (!ok) this.flash('The code is in the box. Select it and copy.');
  }
  loadCode() {
    let data = null;
    try { data = JSON.parse(this.state.code); } catch (err) { data = null; }
    if (!data || !Array.isArray(data.cells)) {
      this.flash('That code couldn’t be read. It should look like {"v":1,"cells":[...]}.');
      return;
    }
    this.snapshot(true);
    const probes = Array.isArray(data.probes)
      ? data.probes.filter((p) => Array.isArray(p) && p[0] >= 0 && p[0] < GW && p[1] >= 0 && p[1] < GH).slice(0, 4).map((p) => [p[0] | 0, p[1] | 0, String(p[2] || 'Probe')])
      : [];
    this.startLayout = { id: 'custom', cells: data.cells, probes };
    const bad = this.sim.load({ cells: data.cells });
    this.sim.S.notices.length = 0;
    this.probes = probes.map((p) => ({ i: p[1] * GW + p[0], label: p[2], hist: [] }));
    this.put({ concept: 'custom', step: -1, stepHover: -1, sel: -1 });
    this.flash('Layout loaded' + (bad ? ' (' + bad + ' unknown or off-grid pieces skipped).' : '.'));
  }
  /* Empties the grid and swaps the concept card for the blank one, since its steps would talk about parts
     that are gone. Reset still knows the concept, so it can bring it back. */
  clearGrid() {
    this.snapshot(true);
    this.sim.load({ cells: [] });
    this.sim.S.notices.length = 0;
    this.probes = [];
    this.put({ concept: 'blank', step: -1, stepHover: -1, sel: -1 });
    this.flash(this.startLayout.id === 'blank' ? 'Grid cleared. Undo brings back what you had.' : 'Grid cleared. Reset brings ' + this.startTitle() + ' back; Undo brings back what you had.');
  }

  stepPrev() { if (this.state.step > 0) this.setState({ step: this.state.step - 1, stepHover: -1 }); }
  stepNext() {
    const n = (this.concept().steps || []).length, s = this.state.step;
    this.setState({ step: s >= n - 1 ? -1 : s + 1, stepHover: -1 });
  }
  stepFn(k) {
    if (!this.stepFns[k]) {
      this.stepFns[k] = {
        pick: () => this.setState({ step: this.state.step === k ? -1 : k }),
        enter: () => this.setState({ stepHover: k }),
        leave: () => this.setState({ stepHover: -1 }),
      };
    }
    return this.stepFns[k];
  }
  libFn(id) {
    if (!this.libFns[id]) this.libFns[id] = () => this.loadConcept(id);
    return this.libFns[id];
  }

  visual(i, c) {
    const sim = this.sim, nums = this.state.nums;
    const ctx = { nums, power: null, axis: 'h', fx: null };
    let extra = '';
    switch (c.t) {
      case 'block': { const s = sim.blockPower(i, false), w = sim.blockPower(i, true); ctx.power = { strong: s, weak: w }; extra = s + '/' + w; break; }
      case 'string': ctx.axis = stringAxis(sim, i); extra = ctx.axis + (c.standing ? 'F' : ''); break;
      case 'plate': extra = c.standing ? 'F' : ''; break;
      case 'dispenser': ctx.fx = sim.S.fx.get(i) || null; extra = ctx.fx ? ctx.fx.kind : ''; break;
      case 'comparator': extra = String(c.out); break;
      case 'torch': extra = c.burnt ? 'B' : ''; break;
      case 'moving': extra = (c.carry ? cellKey(c.carry) : '-') + c.dir; break;
      case 'chest': case 'hopper': case 'dropper': {
        const sm = invSummary(c.slots);
        if (c.t === 'dropper') ctx.fx = sim.S.fx.get(i) || null;
        extra = (sm.top || '-') + sm.total + (ctx.fx ? ctx.fx.kind + (ctx.fx.item || '') : '');
        break;
      }
      default: break;
    }
    const key = cellKey(c) + '|' + extra + '|' + (nums ? 1 : 0);
    let v = this.vcache.get(key);
    if (!v) {
      if (this.vcache.size > 4000) this.vcache.clear();
      v = drawPart(c, ctx);
      this.vcache.set(key, v);
    }
    return v;
  }
  brushIcon(b) {
    const f = b.dir || b.att ? this.state.facing : -1, key = 'brush|' + b.id + '|' + f;
    let v = this.vcache.get(key);
    if (!v) {
      if (b.t === 'eraser') v = ERASER_ICON;
      else {
        const c = makeCell(b.t, f, b.o);
        if (c.t === 'hook') c.ok = true;
        if (c.t === 'dust') c.p = 15;
        if (c.t === 'lamp' || c.t === 'bulb') c.lit = true;
        v = drawPart(c, { nums: false, power: null, axis: 'h' });
      }
      this.vcache.set(key, v);
    }
    return v;
  }
  ghost(i, b) {
    let f = b.dir || b.att ? this.state.facing : -1;
    if (b.att) {
      const opts = this.sim.wallOptions(i);
      if (opts.indexOf(f) < 0) {
        const alt = [f, cw(f), ccw(f), opp(f)].find((d) => opts.indexOf(d) >= 0);
        f = alt == null ? -1 : alt;
      }
      if (b.t === 'hook' && f < 0) return BLOCKED_MARK;
    }
    const c = makeCell(b.t, f, b.o);
    if (c.t === 'hook') c.ok = true;
    return drawPart(c, { nums: false, power: null, axis: 'h' }).map((p) => Object.assign({}, p, { op: (p.op == null ? 1 : p.op) * 0.45 }));
  }

  describe(i) {
    const sim = this.sim, c = sim.at(i), x = i % GW, y = (i / GW) | 0;
    const out = { name: '', where: 'Square ' + x + ', ' + y + ' (x, y)', chips: [], lines: [], actions: [], icon: [] };
    const chip = (t, k) => out.chips.push({ t, cls: 'chip chip-' + (k || 'info') });
    const line = (t) => out.lines.push(t);
    const act = (label, fn, on) => out.actions.push({ label, run: fn, on: !!on, cls: on ? 'act act-on' : 'act' });
    if (!c) {
      const pile = sim.S.ground.get(i);
      if (pile) {
        out.name = 'Items on the ground';
        out.icon = groundSprite(pile);
        line(pileWords(pile).replace(/^./, (m) => m.toUpperCase()) + ', dropped here. Click the square to pick them up.');
        act('Pick up', () => { const got = sim.pickUp(i); this.flash('You picked up ' + pileWords(got) + '.'); this.refresh(); });
        return out;
      }
      out.name = 'Empty square';
      line('Pick a part on the left, then click here to place it. You can also drag a part straight onto the grid.');
      return out;
    }
    out.icon = this.visual(i, c);
    out.name = TYPES[c.t].name;
    const use = () => this.useCell(i);
    let turn = false;
    switch (c.t) {
      case 'block': {
        const s = sim.blockPower(i, false), w = sim.blockPower(i, true);
        if (s > 0) {
          chip('Strongly powered · ' + s, 'on');
          line('Something is pushing power into this block: a repeater, comparator or observer pointing at it, or a lever, button or hook stuck to it. A strongly powered block powers everything touching it, including redstone dust.');
        } else if (w > 0) {
          chip('Weakly powered · ' + w, 'warm');
          line('Only redstone dust is pointing into it. A weakly powered block still switches on repeaters, comparators, torches, lamps and pistons touching it, but it can NOT power other dust.');
        } else {
          chip('No power', 'off');
          line('Solid blocks pass power along when something powers them. Stick a torch to one side and you have an inverter (NOT gate).');
        }
        break;
      }
      case 'glass':
        line('Glass never carries power, so wires on either side of it stay separate. A torch stuck to glass can never be switched off.');
        break;
      case 'rblock':
        chip('Always on · 15', 'on');
        line('Gives a constant 15 to dust and parts touching it, but it does not power the solid blocks next to it. Pistons can move it, which makes it a movable power source.');
        break;
      case 'dust': {
        const linked = !!sim.linksOf(i);
        chip(c.p > 0 ? 'Power ' + c.p + ' of 15' : 'No power', c.p > 0 ? 'on' : 'off');
        line('Power drops by 1 for every square of dust, so a signal dies after 15 squares. A repeater boosts it back to 15.');
        if (c.sh === 0) line('Dot shape: it only powers the floor under it. Click it to turn it back into a cross.');
        else if (!linked) line('It isn’t connected to anything, so it spreads power in all four directions. Click it to make it a dot.');
        else line('It only pushes power into the squares it points at. Dust running past a lamp will not light it.');
        if (!linked) act(c.sh === 0 ? 'Make it a cross' : 'Make it a dot', use);
        break;
      }
      case 'torch':
        chip(c.lit ? 'ON · 15' : 'OFF', c.lit ? 'on' : 'off');
        if (c.burnt && !c.lit) chip('Burned out', 'warm');
        if (c.f < 0) {
          line('Standing on the floor. The floor can’t be powered in this grid, so it stays on. Stick it to the side of a block to make it switchable (Shift+click turns it).');
        } else {
          line('Stuck to the block on its ' + DWORD[opp(c.f)] + ' side.');
          line(c.lit ? 'That block has no power, so the torch is ON and powers everything around it except that block.' : 'That block is powered, so the torch is OFF. Power in, no power out: that is an inverter (NOT gate).');
          line('Torches take 0.1 s (1 redstone tick) to flip.');
        }
        if (c.burnt && !c.lit) line('It flipped 8 times within 3 seconds and burned out. It stays off, then tries to relight after 8 seconds.');
        turn = true;
        break;
      case 'repeater': {
        const inp = sim.repInput(i, c);
        chip(c.on ? 'ON · 15' : 'OFF', c.on ? 'on' : 'off');
        chip('Delay ' + c.d + ' · ' + (c.d / 10).toFixed(1) + ' s');
        if (c.lock) chip('Locked', 'warm');
        line('Signal goes in on the ' + DWORD[opp(c.f)] + ' side (the grey socket) and comes out on the ' + DWORD[c.f] + ' side, where the big arrow is. Input right now: ' + (inp > 0 ? 'on (' + inp + ')' : 'off') + '.');
        line('It waits ' + c.d + ' redstone tick' + (c.d > 1 ? 's' : '') + ' (' + (c.d / 10).toFixed(1) + ' s), then sends a full 15 out of its front. It also stretches short pulses so they last at least as long as its delay.');
        if (c.lock) line('Locked: a powered repeater or comparator points into its side, so it is frozen until that turns off.');
        for (let d = 1; d <= 4; d++) act('Delay ' + d, () => this.setDelay(i, d), c.d === d);
        turn = true;
        break;
      }
      case 'comparator': {
        const rear = sim.cmpRear(i, c), side = sim.cmpSide(i, c);
        chip(c.sub ? 'Subtract mode' : 'Compare mode');
        chip(c.on ? 'Output ' + c.out : 'OFF', c.on ? 'on' : 'off');
        const res = c.sub ? 'back − side = ' + Math.max(0, rear - side) : side > rear ? 'a side is stronger, so 0' : 'the back passes through: ' + rear;
        line('Back ' + rear + ' · side ' + side + ' → ' + res + '.');
        line('The back (two torches) faces ' + DWORD[opp(c.f)] + '; the output comes out of the arrow on the ' + DWORD[c.f] + ' side. Sides are ' + DWORD[cw(c.f)] + ' and ' + DWORD[ccw(c.f)] + '.');
        line(c.sub ? 'S = subtract mode (front torch lit): output = back minus the stronger side.' : 'C = compare mode (front torch dark): it passes the back signal through, unless a side is stronger. Then it outputs 0.');
        const back = sim.at(sim.nb(i, opp(c.f)));
        if (back && sim.analog(back) >= 0) line('It is reading how full the ' + TYPES[back.t].name.toLowerCase() + ' behind it is, not a power level.');
        line('Changes take 0.1 s. Click it to switch mode.');
        act(c.sub ? 'Switch to compare' : 'Switch to subtract', use);
        turn = true;
        break;
      }
      case 'observer': {
        const fc = sim.at(sim.nb(i, c.f));
        chip(c.on ? 'Pulse!' : 'Watching', c.on ? 'on' : 'off');
        line('Its face (the two eyes) watches the square to the ' + DWORD[c.f] + (fc ? ' (' + TYPES[fc.t].name.toLowerCase() + ')' : ' (empty)') + '. Whenever that square changes in any way, it sends a 0.1 s pulse out of its back, 0.1 s later. The arrow points at that output (the red dot, ' + DWORD[opp(c.f)] + ' side).');
        turn = true;
        break;
      }
      case 'piston':
        out.name = c.sticky ? 'Sticky Piston' : 'Piston';
        chip(c.ext ? 'Extended' : 'Retracted', c.ext ? 'on' : 'off');
        line('Pushes up to 12 blocks to the ' + DWORD[c.f] + ': the wooden side is its face and the arrow points the way it pushes. It switches on from power on any side except its face, including a powered block next to it.');
        if (c.sticky) line('Sticky: it pulls the block back when it retracts. Give it only a 0.1 s pulse and it leaves the block behind instead.');
        line('Moving takes 0.1 s. It can’t push dispensers or extended pistons, and dust, torches, repeaters and similar parts break when pushed.');
        turn = true;
        break;
      case 'head':
        line('Part of the piston behind it. Deleting it removes the whole piston.');
        break;
      case 'moving':
        line('A piston is moving this block. It lands after 0.1 s (2 game ticks).');
        break;
      case 'lever':
        chip(c.on ? 'ON · 15' : 'OFF', c.on ? 'on' : 'off');
        line('Click to flip it. While ON it powers the dust and parts touching it' + (c.f >= 0 ? ', and strongly powers the block it is stuck to.' : '.'));
        act(c.on ? 'Switch off' : 'Switch on', use, c.on);
        turn = true;
        break;
      case 'button':
        out.name = c.wood ? 'Wood Button' : 'Stone Button';
        chip(c.on ? 'Pressed' : 'Up', c.on ? 'on' : 'off');
        line('Click to press. It stays on for ' + (c.wood ? '1.5 s (15 redstone ticks)' : '1 s (10 redstone ticks)') + ', then pops back out.' + (c.f >= 0 ? ' It also strongly powers the block it is stuck to.' : ''));
        act('Press', use);
        turn = true;
        break;
      case 'plate':
        chip(c.standing ? 'Someone on it' : 'Nobody on it', c.standing ? 'warm' : 'off');
        chip(c.on ? 'ON · 15' : 'OFF', c.on ? 'on' : 'off');
        line('Click to stand on it, and again to step off. It switches on right away, and notices you left within 1 s (it re-checks every 20 game ticks).');
        act(c.standing ? 'Step off' : 'Stand on it', use, c.standing);
        break;
      case 'hook':
        chip(c.ok ? 'Connected' : 'Not connected', c.ok ? 'info' : 'warm');
        chip(c.on ? 'ON · 15' : 'OFF', c.on ? 'on' : 'off');
        if (c.ok) line('Linked to the hook across the string. When someone walks into the string, both hooks turn on. They power the dust and parts touching them, plus the block they are stuck to.');
        else line('It needs a second hook facing it, with 1–40 squares of tripwire in a straight line between them. Until then it hangs folded and does nothing.');
        turn = true;
        break;
      case 'string':
        out.name = 'Tripwire (string)';
        chip(c.standing ? 'Someone in it' : 'Nobody in it', c.standing ? 'warm' : 'off');
        chip(c.on ? 'Triggered' : 'Idle', c.on ? 'on' : 'off');
        if (!c.ok) chip('No hooks', 'warm');
        line('Click to stand in it, and again to leave. The hooks switch on the moment someone enters. After they leave, the string notices within 0.5 s (it re-checks every 10 game ticks).');
        act(c.standing ? 'Step out' : 'Stand in it', use, c.standing);
        break;
      case 'lamp':
        chip(c.lit ? 'Lit' : 'Dark', c.lit ? 'on' : 'off');
        line('Lights up the instant it gets power. When the power stops it stays lit for 0.2 s more (2 redstone ticks), so a very fast clock can make it look always on.');
        break;
      case 'dispenser':
        chip(c.trig ? 'Powered' : 'Idle', c.trig ? 'on' : 'off');
        chip(c.items + ' arrows');
        chip(c.shots + ' shots');
        line('Shoots to the ' + DWORD[c.f] + ', where the arrow on top points. It fires one arrow 0.2 s after it switches on, then waits for the power to go off and on again. That is why rapid fire needs a clock.');
        line('A comparator behind it reads how full it is.');
        act('Refill arrows', use);
        turn = true;
        break;
      case 'bulb':
        chip(c.lit ? 'Lit' : 'Dark', c.lit ? 'on' : 'off');
        if (c.pw) chip('Powered', 'warm');
        line('Each NEW pulse of power flips it: off to on, or on to off. Keeping the power on does nothing extra.');
        line('A comparator reading it gives 15 while it is lit. Together they make a toggle (T flip-flop).');
        break;
      case 'chest': case 'hopper': case 'dropper': {
        const sm = invSummary(c.slots), sig = invSignal(c.slots);
        out.inv = this.invView(c.slots);
        out.invCols = c.slots.length === 27 ? 9 : c.slots.length === 9 ? 3 : 5;
        if (i === this.shopCell('pay')) line('This is the shop’s coin slot. Click it to pay one diamond.');
        chip(sm.total ? sm.total + (sm.total === 1 ? ' item' : ' items') : 'Empty', sm.total ? 'info' : 'off');
        chip('Comparator reads ' + sig, sig ? 'on' : 'off');
        if (c.t === 'hopper') {
          chip(c.locked ? 'Locked (powered)' : 'Moving items', c.locked ? 'warm' : 'off');
          line('Every 0.4 s it pushes one item into the container its arrow points at, then takes one from the container behind it. In the game, that’s the container above it.');
          line('Power locks it: it keeps its items, but other hoppers can still fill it or take from it.');
          turn = true;
        } else if (c.t === 'dropper') {
          chip(c.trig ? 'Powered' : 'Idle', c.trig ? 'on' : 'off');
          if (c.out) chip(c.out + ' dropped');
          line('Each new pulse of power makes it drop one item from a random slot, 0.2 s later: into a container in front of it, or out onto the ground.');
          turn = true;
        } else {
          line('Holds 27 stacks. Hoppers can fill it and empty it, and a comparator behind it reads how full it is.');
        }
        act('+1 diamond', () => this.giveTo(i, 'diamond', 1));
        act('+5 diamonds', () => this.giveTo(i, 'diamond', 5));
        act('+1 dirt', () => this.giveTo(i, 'dirt', 1));
        if (sm.total) act('Take everything', () => this.takeAllFrom(i));
        break;
      }
      default: break;
    }
    if (turn) {
      line('To turn it, hold R and move your mouse where it should face. Tapping R or Shift+click turns it one step.');
      act('Turn', () => this.turnCell(i));
    }
    if (c.t !== 'head' && c.t !== 'moving') act(this.isProbed(i) ? 'Stop tracking' : 'Track on timeline', () => this.toggleProbe(i), this.isProbed(i));
    act('Delete', () => this.deleteCell(i));
    return out;
  }

  renderVals() {
    const st = this.state, sim = this.sim, S = sim.S, cp = this.concept(), b = this.brush();

    const cells = [];
    for (let i = 0; i < S.N; i++) { const c = S.cells[i]; if (c) cells.push({ tr: cellTr(i), p: this.visual(i, c) }); }
    for (const [gi, pile] of S.ground) if (!S.cells[gi]) cells.push({ tr: cellTr(gi), p: groundSprite(pile) });
    const under = [], over = [];
    const stepIdx = st.stepHover >= 0 ? st.stepHover : st.step;
    const step = cp.steps && cp.steps[stepIdx];
    if (step) {
      for (const pt of step.cells) {
        const j = pt[1] * GW + pt[0];
        under.push({ tr: cellTr(j), p: HL_UNDER });
        over.push({ tr: cellTr(j), p: HL_OVER });
      }
    }
    /* The blue step number only shows while that "How it works" step is open, next to the parts it lights up. */
    if (step && step.badge) over.push({ tr: cellTr(step.badge[1] * GW + step.badge[0]), p: stepBadge(stepIdx + 1) });
    this.probes.forEach((p, k) => over.push({ tr: cellTr(p.i), p: probeBadge(k + 1) }));
    if (st.sel >= 0 && !st.kbMode) over.push({ tr: cellTr(st.sel), p: SEL_MARK });
    const hv = st.kbMode ? st.kb : st.hover;
    const aim = this.aim;
    if (aim && aim.i >= 0) {
      if (aim.kind === 'brush') {
        const g = this.ghost(aim.i, b);
        if (g) over.push({ tr: cellTr(aim.i), p: g });
        over.push({ tr: cellTr(aim.i), p: aimMark([0, 1, 2, 3], st.facing) });
      } else {
        const ac = sim.at(aim.i);
        if (ac) over.push({ tr: cellTr(aim.i), p: aimMark(sim.facingOptions(aim.i), ac.f) });
      }
    } else if (hv >= 0) {
      const hc = sim.at(hv);
      if (!hc && b.t !== 'eraser') { const g = this.ghost(hv, b); if (g) over.push({ tr: cellTr(hv), p: g }); }
      else if (hc && b.t === 'eraser') over.push({ tr: cellTr(hv), p: ERASE_MARK });
      over.push({ tr: cellTr(hv), p: st.kbMode ? KB_MARK : HOVER_MARK });
    }

    const palette = this.palette.map((g) => ({
      title: g.title,
      items: g.items.map((it) => Object.assign({}, it, { sel: it.id === st.brush, cls: it.id === st.brush ? 'pal-on' : '' })),
    }));
    const dirBrush = !!(b.dir || b.att);
    const face = (d) => ({ fn: this.faceFns[d], on: dirBrush && st.facing === d, cls: dirBrush && st.facing === d ? 'face-on' : (dirBrush ? '' : 'is-off') });

    const target = aim && aim.kind === 'part' ? aim.i : st.kbMode ? st.kb : st.hover >= 0 ? st.hover : st.sel;
    const insp = target >= 0 ? this.describe(target) : {
      name: 'Nothing selected', where: 'Point at a square on the grid', chips: [], icon: [], actions: [],
      lines: ['Everything you point at is explained here: what it is, how much power it has, and why.'],
    };

    let curD = 0;
    if (cp.speedCell) { const rc = sim.at(cp.speedCell[1] * GW + cp.speedCell[0]); if (rc && rc.t === 'repeater') curD = rc.d; }
    const wi = this.walkCell(), standing = wi >= 0 && sim.at(wi).standing;
    const cpt = {
      title: cp.title,
      blurb: cp.id === 'blank' && this.startLayout.id !== 'blank'
        ? 'You cleared the grid. Press Reset (next to Clear) to bring ' + this.startTitle() + ' back, or build something of your own: pick parts on the left and point at anything to have it explained.'
        : cp.blurb,
      tryIt: cp.tryIt || '',
      hasWalk: !!cp.walk,
      hasShop: !!cp.shop,
      hasSteps: !!(cp.steps && cp.steps.length),
      steps: (cp.steps || []).map((s, k) => {
        const h = this.stepFn(k), on = k === st.step;
        return { n: String(k + 1), title: s.title, text: s.text, pick: h.pick, enter: h.enter, leave: h.leave, on, cls: on ? 'step-on' : '' };
      }),
      hasSpeeds: !!(cp.speeds && cp.speeds.length),
      speedNote: cp.speedNote || '',
      speeds: (cp.speeds || []).map((r) => ({ d: r[0], text: r[1], active: curD === Number(r[0]), cls: curD === Number(r[0]) ? 'spd-on' : '' })),
      hasTips: !!(cp.tips && cp.tips.length),
      tips: cp.tips || [],
    };

    const nSteps = (cp.steps || []).length;
    const shown = nSteps && stepIdx >= 0 && stepIdx < nSteps ? cp.steps[stepIdx] : null;

    const probeRows = this.probes.map((p, k) => {
      const w = wave(p.hist), v = p.hist.length ? p.hist[p.hist.length - 1] : 0;
      return { n: String(k + 1), label: p.label, line: w.line, area: w.area, now: v > 0 ? 'ON · ' + v : 'off', cls: v > 0 ? 'tl-on' : 'tl-off', remove: () => this.removeProbe(k) };
    });

    return {
      playing: st.playing, paused: !st.playing,
      playText: st.playing ? 'Pause' : 'Play',
      playLabel: st.playing ? 'Pause the simulation' : 'Play the simulation',
      togglePlay: this.togglePlay, stepBtn: this.stepBtn,
      speeds: SPEEDS.map((s, k) => ({ label: s[1], pick: this.speedFns[k], on: st.speed === s[0], cls: st.speed === s[0] ? 'seg-on' : '' })),
      undo: this.undo, undoCls: this.undoStack.length ? '' : 'is-off', restart: this.restart,
      resetBuild: this.resetBuild,
      resetTitle: this.startLayout.id === 'blank' ? 'Empty the grid again' : 'Put ' + this.startTitle() + ' back exactly the way it started',
      timeText: (S.now / 20).toFixed(1) + ' s',
      tickText: 'game tick ' + S.now,
      quickOn: st.quick, hideQuick: this.hideQuick,
      quick1: cp.walk ? 'Press “Walk into the tripwire” on the right to watch the clock run.'
        : cp.shop ? 'Press “Pay 1 diamond” on the right and follow the diamond through the shop.'
        : 'Pick a concept from the library under the grid, or start building.',

      palette,
      brushName: b.name,
      brushIcon: this.brushIcon(b),
      facingHint: facingHint(b, st.facing),
      faceLetter: dirBrush ? DN[st.facing] : '·',
      faceOff: !dirBrush,
      fN: face(0), fE: face(1), fS: face(2), fW: face(3),

      gDown: this.gDown, gMove: this.gMove, gUp: this.gUp, gLeave: this.gLeave, gCtx: this.gCtx, gKey: this.gKey,
      gDragOver: this.gDragOver, gDrop: this.gDrop, svgRef: this.svgRef,
      bgD: this.bg.bg, minorD: this.bg.minor, majorD: this.bg.major,
      under, cells, over,

      toggleNums: this.toggleNums, nums: st.nums, numsCls: st.nums ? 'tog-on' : '',
      notice: aim && aim.i >= 0
        ? 'Point your mouse where the ' + (aim.kind === 'part' && sim.at(aim.i) ? shortName(sim.at(aim.i)).toLowerCase() : b.name.toLowerCase()) + ' should face, then let go of R. Esc puts it back.'
        : st.notice,
      toast: st.toast, hideToast: this.hideToast,

      noProbes: this.probes.length === 0,
      probeRows,
      secMarks: SEC_MARKS,

      insp,
      cpt,
      toggleWalk: this.toggleWalk,
      walkLabel: standing ? 'Step out of the tripwire' : 'Walk into the tripwire',
      shop: cp.shop ? {
        price: this.shopPrice(),
        sold: (() => { const c = sim.at(this.shopCell('payout')); return c && c.t === 'dropper' ? c.out : 0; })(),
        bank: this.shopBank(),
        stock: this.shopStock(),
        pay1: this.shopFns.pay1, pay5: this.shopFns.pay5, payDirt: this.shopFns.payDirt,
        cheaper: this.shopFns.cheaper, dearer: this.shopFns.dearer,
        icon: itemIcon('diamond', 0, 0, 40),
      } : null,
      walkCls: standing ? 'walk-on' : '',
      stepTag: shown ? 'Step ' + (stepIdx + 1) + ' of ' + nSteps : 'Start here',
      stepTitle: shown ? shown.title : 'Walk through it one step at a time',
      stepText: shown ? shown.text : 'Press Start or pick a number. The parts each step talks about light up in blue on the grid, with a blue tag showing the step’s number.',
      stepPrev: this.stepPrev, stepNext: this.stepNext,
      prevCls: st.step > 0 ? 'act' : 'act is-off',
      nextLabel: st.step < 0 ? 'Start ›' : st.step >= nSteps - 1 ? 'Done' : 'Next ›',

      library: CONCEPTS.filter((c) => !c.hidden).map((c) => ({ title: c.title, desc: c.short, load: this.libFn(c.id), cls: c.id === st.concept ? 'lib-on' : '' })),
      code: st.code, onCode: this.onCode, copyCode: this.copyCode, loadCode: this.loadCode, clearGrid: this.clearGrid,
    };
  }

  render() { return view(this.renderVals()); }
}

/* ================= What the page looks like =================
   view(v) turns the values from renderVals() into the page. Plain HTML written with htm:
   ${...} drops in a value, and .map() repeats a piece once per item. */
const PIX = "'Pixelify Sans', ui-monospace, monospace";
const BTN = 'display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid #343a45; background: #1d2128; color: #ece9e4; font-size: 14px; cursor: pointer; white-space: nowrap';
const H2_SMALL = `margin: 0; font-family: ${PIX}; font-size: 13px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; color: #9aa0aa`;
const LABEL_SMALL = `font-family: ${PIX}; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: #9aa0aa`;
const CARD = 'display: flex; flex-direction: column; padding: 14px 16px; border-radius: 12px; background: #181b21; border: 1px solid #2a2f38';

/* Pixel pictures: a list of paths, each with its own colour. */
function paths(list) {
  return (list || []).map((p) => html`<path d=${p.d} fill=${p.fill} stroke=${p.stroke} stroke-width=${p.sw} opacity=${p.op} transform=${p.tr} stroke-dasharray=${p.da} shape-rendering=${p.sr} stroke-linecap="round" stroke-linejoin="round"></path>`);
}
function layer(list) {
  return list.map((cd) => html`<g transform=${cd.tr}>${paths(cd.p)}</g>`);
}
const cls = (...names) => names.filter(Boolean).join(' ');

function viewHeader(v) {
  return html`
  <header style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 24px; padding: 14px 20px; border-bottom: 1px solid #262a33; background: #15181d">
    <div style="display: flex; align-items: center; gap: 12px">
      <svg width="36" height="36" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M14 0h12v14h14v12H26v14H14V26H0V14h14z" fill="#ff4a36" opacity="0.22"></path>
        <path d="M17 3h6v14h14v6H23v14h-6V23H3v-6h14z" fill="#ff4a36"></path>
      </svg>
      <div style="display: flex; flex-direction: column; gap: 1px">
        <h1 style=${`margin: 0; font-family: ${PIX}; font-size: 26px; font-weight: 700; letter-spacing: 0.5px; line-height: 1.1; color: #ffffff`}>Redstone Lab</h1>
        <div style="font-size: 13px; color: #a8adb7">Minecraft Java Edition 26.3 rules · top-down view · 1 square = 1 block</div>
      </div>
    </div>
    <div role="group" aria-label="Time controls" style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 12px; background: #1b1f26; border: 1px solid #2c313b">
      <span style=${`padding: 0 4px; ${LABEL_SMALL}`}>Time</span>
      <button onClick=${v.restart} class="hv" title="Go back to 0 seconds and power your build up again from scratch. Your build stays exactly the same." style=${BTN}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14" fill="none" stroke="currentColor" stroke-width="2.5"></path><path d="M19 5l-10 7 10 7z" fill="currentColor"></path></svg>
        <span>Restart time</span>
      </button>
      <button onClick=${v.togglePlay} class="hv-play" aria-label=${v.playLabel} style="display: inline-flex; align-items: center; gap: 7px; height: 36px; min-width: 92px; justify-content: center; padding: 0 14px; border-radius: 8px; border: 1px solid #3f7fa3; background: #17324a; color: #e6f6ff; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap">
        ${v.playing
          ? html`<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"></path></svg>`
          : html`<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor"></path></svg>`}
        <span>${v.playText}</span>
      </button>
      <button onClick=${v.stepBtn} class="hv" title="Pause and move time forward 0.1 s (one redstone tick). Shift+click moves just 0.05 s (one game tick)." style=${BTN}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l10 7-10 7z" fill="currentColor"></path><path d="M18 5v14" fill="none" stroke="currentColor" stroke-width="2.5"></path></svg>
        <span>Step 0.1 s</span>
      </button>
      <div role="group" aria-label="Speed" style="display: inline-flex; align-items: center; gap: 6px">
        <span style="font-size: 13px; color: #a8adb7">Speed</span>
        <div style="display: inline-flex; height: 36px; border: 1px solid #343a45; border-radius: 8px; overflow: hidden">
          ${v.speeds.map((s) => html`
            <button onClick=${s.pick} class=${cls('hv', s.cls)} aria-pressed=${s.on} aria-label=${'Speed ' + s.label} style="min-width: 40px; padding: 0 9px; border: 0; border-right: 1px solid #343a45; background: #1d2128; color: #d5d8de; font-size: 13.5px; cursor: pointer">${s.label}</button>`)}
        </div>
      </div>
      <div aria-label="Time passed" style="display: flex; flex-direction: column; align-items: flex-end; min-width: 84px; padding: 0 4px; line-height: 1.15">
        <span style=${`font-family: ${PIX}; font-size: 17px; color: #ffffff`}>${v.timeText}</span>
        <span style="font-size: 11.5px; color: #8d939d">${v.tickText}</span>
      </div>
    </div>
  </header>`;
}

function viewQuickStart(v) {
  if (!v.quickOn) return null;
  const item = (n, text) => html`<span style="display: flex; align-items: baseline; gap: 6px; font-size: 14px; color: #cfe3f0"><span style="font-weight: 700; color: #ffffff">${n}.</span><span>${text}</span></span>`;
  return html`
  <div role="note" aria-label="Quick start" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; margin: 14px 20px 0; padding: 10px 12px 10px 16px; border-radius: 12px; background: #13202b; border: 1px solid #2b4a60">
    <span style="font-weight: 700; font-size: 15px; color: #dff4ff">New here?</span>
    ${item(1, v.quick1)}
    ${item(2, 'Pick a part on the left, then click a square to place it.')}
    ${item(3, 'Click a part to use it. Made a mess? Press Reset.')}
    <button onClick=${v.hideQuick} class="act" style="margin-left: auto">Got it</button>
  </div>`;
}

function viewParts(v) {
  return html`
  <aside class="rl-col" aria-label="Parts" style="flex: 0 1 214px; min-width: 190px; display: flex; flex-direction: column; gap: 14px">
    <div style="display: flex; flex-direction: column; gap: 2px">
      <h2 style="margin: 0; font-size: 17px; line-height: 1.2; color: #ffffff">Parts</h2>
      <span style="font-size: 13px; color: #a8adb7">Click one to pick it up, then click the grid. You can also drag it on.</span>
    </div>
    ${v.palette.map((g) => html`
      <div style="display: flex; flex-direction: column; gap: 6px">
        <div style=${LABEL_SMALL}>${g.title}</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px">
          ${g.items.map((it) => html`
            <button draggable="true" onDragStart=${it.drag} onClick=${it.pick} class=${cls('hv-pal', it.cls)} aria-pressed=${it.sel} title=${it.name + ' — click to hold it, or drag it onto the grid'} style="display: flex; flex-direction: column; align-items: center; gap: 3px; min-height: 66px; padding: 7px 4px 6px; border-radius: 8px; border: 1px solid #2c313b; background: #191c22; color: #e3e0da; font-size: 12.5px; line-height: 1.15; text-align: center; cursor: grab">
              <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden="true" style="display: block; overflow: hidden">${paths(it.icon)}</svg>
              <span>${it.name}</span>
            </button>`)}
        </div>
      </div>`)}
  </aside>`;
}

function viewToolbar(v) {
  const face = (f, label, title, arrow) => html`
    <button onClick=${f.fn} class=${f.cls} aria-pressed=${f.on} aria-label=${label} title=${title} disabled=${v.faceOff} style="width: 34px; height: 34px; border-radius: 7px; border: 1px solid #343a45; background: #1d2128; color: #ece9e4; font-size: 16px; cursor: pointer">${arrow}</button>`;
  return html`
  <div role="toolbar" aria-label="Build tools" style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; padding: 10px 12px; border-radius: 12px; background: #181b21; border: 1px solid #2a2f38">
    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; min-width: 0">
      <svg width="44" height="44" viewBox="0 0 40 40" aria-hidden="true" style="flex: 0 0 44px; background: #1f232b; border-radius: 8px; border: 1px solid #343a45; overflow: hidden">${paths(v.brushIcon)}</svg>
      <div style="flex: 0 0 230px; width: 230px; display: flex; flex-direction: column; min-width: 0">
        <span style="font-size: 12px; color: #9aa0aa">In your hand</span>
        <span style="font-weight: 700; font-size: 15px; color: #ffffff">${v.brushName}</span>
        <span style="display: block; min-height: 2.9em; font-size: 12.5px; color: #a8adb7">${v.facingHint}</span>
      </div>
      <div role="group" aria-label="Which way it faces" style="display: flex; align-items: center; gap: 4px">
        <span style="font-size: 13px; color: #a8adb7; padding-right: 2px">Faces</span>
        ${face(v.fN, 'Face north', 'North (up)', '↑')}
        ${face(v.fE, 'Face east', 'East (right)', '→')}
        ${face(v.fS, 'Face south', 'South (down)', '↓')}
        ${face(v.fW, 'Face west', 'West (left)', '←')}
      </div>
    </div>
    <div role="group" aria-label="Undo, reset or clear the build" style="display: flex; flex-wrap: wrap; gap: 6px">
      <button onClick=${v.undo} class=${cls('hv', v.undoCls)} title="Take back your last change" style=${BTN}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <span>Undo</span>
      </button>
      <button onClick=${v.resetBuild} class="hv-reset" title=${v.resetTitle} style="display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 13px; border-radius: 8px; border: 1px solid #9a6a24; background: #3a2a12; color: #ffe2b0; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap">
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <span>Reset</span>
      </button>
      <button onClick=${v.clearGrid} class="hv" title="Remove every part from the grid (Undo or Reset brings it back)" style=${BTN}>
        <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>
        <span>Clear</span>
      </button>
    </div>
  </div>`;
}

function viewGrid(v) {
  return html`
  <div style="border: 1px solid #2a2f38; border-radius: 12px; background: #0d0f12; padding: 8px; overflow-x: auto">
    <button onPointerDown=${v.gDown} onPointerMove=${v.gMove} onPointerUp=${v.gUp} onPointerCancel=${v.gUp} onPointerLeave=${v.gLeave} onContextMenu=${v.gCtx} onKeyDown=${v.gKey} onDragOver=${v.gDragOver} onDrop=${v.gDrop} onDragLeave=${v.gLeave} aria-label="Redstone grid, 24 by 16 squares. Arrow keys move the cursor, Enter places or uses, Shift+Enter turns a part, Delete removes. R turns the part under the cursor, or the piece in your hand; hold R and press an arrow key to point it that way." style="display: block; width: 100%; min-width: 620px; padding: 0; margin: 0; border: 0; border-radius: 6px; background: transparent; cursor: crosshair; touch-action: none; user-select: none">
      <svg ref=${v.svgRef} viewBox="0 0 960 640" aria-hidden="true" style="display: block; width: 100%; height: auto">
        <path d=${v.bgD} fill="#1f232b"></path>
        <path d=${v.minorD} fill="none" stroke="#3a404c" stroke-width="1.4"></path>
        <path d=${v.majorD} fill="none" stroke="#59616f" stroke-width="2.2"></path>
        ${layer(v.under)}
        ${layer(v.cells)}
        ${layer(v.over)}
      </svg>
    </button>
  </div>`;
}

function viewGridHelp(v) {
  const key = (k) => html`<span class="kbd">${k}</span>`;
  const badge = (text, style) => html`<span style=${`display: inline-flex; align-items: center; justify-content: center; height: 18px; font-family: ${PIX}; font-size: 12px; ${style}`}>${text}</span>`;
  const meaning = (b, text) => html`<span style="display: inline-flex; align-items: center; gap: 7px">${b}${text}</span>`;
  return html`
  <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px">
    <div aria-label="How to use the grid" style="flex: 1 1 420px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; font-size: 13px; color: #a8adb7">
      <span>${key('Click')} empty square = place</span>
      <span>${key('Click')} a part = use it</span>
      <span>${key('Right-click')} = remove</span>
      <span>${key('Drag')} = draw a line</span>
      <span>${key('R')} or ${key('Shift')} + ${key('Click')} = turn a part</span>
      <span>Hold ${key('R')} + move mouse = point it</span>
      <span>Arrows show where the signal goes</span>
    </div>
    <div style="display: flex; gap: 6px">
      <button onClick=${v.toggleNums} class=${v.numsCls} aria-pressed=${v.nums} title="Show or hide the power level printed on each piece of dust" style="height: 32px; padding: 0 11px; border-radius: 7px; border: 1px solid #343a45; background: #1d2128; color: #c9cdd4; font-size: 13px; cursor: pointer">Power numbers</button>
    </div>
  </div>
  <div aria-label="What the little numbers on the grid mean" style="display: flex; align-items: flex-start; gap: 6px 16px; padding: 8px 12px; border-radius: 10px; background: #15181d; border: 1px solid #262b33; font-size: 13px; color: #a8adb7">
    <span style="font-weight: 700; color: #d6d9df; white-space: nowrap; line-height: 20px">Numbers on the grid:</span>
    <div style="flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 6px 18px">
      ${meaning(badge('15', 'min-width: 22px; padding: 0 4px; box-sizing: border-box; border-radius: 4px; background: #0a0b0e; color: #ffffff'), 'power in that dust (15 = full)')}
      ${meaning(badge('4', 'width: 18px; border-radius: 4px; background: #a9a9a9; color: #a3120a; font-weight: 700'), 'a repeater’s wait (4 = 0.4 s)')}
      ${meaning(badge('1', 'width: 18px; border-radius: 4px; background: #ffd08a; color: #2a1d08'), 'a part graphed on the timeline')}
      ${meaning(badge('3', 'width: 18px; border-radius: 50%; background: #5cc8ff; color: #0b1820'), 'the “How it works” step you’re on')}
      ${meaning(badge('18', 'min-width: 22px; padding: 0 3px; box-sizing: border-box; border-radius: 4px; background: #3a3f48; color: #ffffff; text-shadow: 1px 1px 0 #111'), 'items inside a chest, hopper or dropper')}
    </div>
  </div>
  <div role="status" aria-live="polite" style="min-height: 21px; font-size: 14px; color: #ffd08a">${v.notice}</div>`;
}

function viewTimeline(v) {
  return html`
  <section aria-label="Timeline" style=${`${CARD}; gap: 10px`}>
    <div style="display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px">
      <h2 style=${H2_SMALL}>Timeline · last 6 seconds</h2>
      <div style="font-size: 12.5px; color: #8d939d">Lines = 1 s apart · 1 redstone tick = 0.1 s = 2 game ticks · newest on the right</div>
    </div>
    ${v.noProbes ? html`<p style="margin: 0; font-size: 13.5px; color: #a8adb7">Nothing is tracked yet. Click a part on the grid, then press “Track on timeline”.</p>` : null}
    ${v.probeRows.map((pr) => html`
      <div style="display: flex; align-items: center; gap: 10px">
        <span style=${`flex: 0 0 20px; height: 20px; border-radius: 4px; background: #ffd08a; color: #2a1d08; font-family: ${PIX}; font-size: 12px; display: flex; align-items: center; justify-content: center`}>${pr.n}</span>
        <div style="flex: 0 0 150px; min-width: 0; display: flex; flex-direction: column">
          <span style="font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${pr.label}</span>
          <span class=${pr.cls} style="font-size: 12.5px">${pr.now}</span>
        </div>
        <svg viewBox="0 0 360 32" preserveAspectRatio="none" aria-hidden="true" style="flex: 1 1 auto; min-width: 0; height: 36px; display: block; background: #0f1114; border-radius: 6px">
          <path d=${v.secMarks} fill="none" stroke="#2c313b" stroke-width="1" vector-effect="non-scaling-stroke"></path>
          <path d=${pr.area} fill="#ff4a36" opacity="0.2"></path>
          <path d=${pr.line} fill="none" stroke="#ff5a44" stroke-width="2" vector-effect="non-scaling-stroke"></path>
        </svg>
        <button onClick=${pr.remove} class="hv" aria-label=${'Stop tracking ' + pr.label} title="Stop tracking" style="flex: 0 0 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 7px; border: 1px solid #343a45; background: #1d2128; color: #a8adb7; cursor: pointer">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"></path></svg>
        </button>
      </div>`)}
  </section>`;
}

function viewLibrary(v) {
  return html`
  <section aria-label="Concept library and layout code" style="display: flex; flex-wrap: wrap; gap: 16px 28px; padding: 14px 16px; border-radius: 12px; background: #181b21; border: 1px solid #2a2f38">
    <div style="flex: 1 1 260px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
      <h2 style=${H2_SMALL}>Concept library</h2>
      ${v.library.map((L) => html`
        <button onClick=${L.load} class=${cls('hv-lib', L.cls)} style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; box-sizing: border-box; text-align: left; padding: 9px 11px; border-radius: 9px; border: 1px solid #2a2f38; background: #1c2027; color: inherit; cursor: pointer">
          <span style="font-weight: 700; font-size: 14.5px">${L.title}</span>
          <span style="font-size: 13px; color: #a8adb7">${L.desc}</span>
        </button>`)}
      <p style="margin: 0; font-size: 13px; color: #a8adb7">Want a new concept? Ask Claude to add it to your GitHub. It shows up here the next time you open the app.</p>
    </div>
    <div style="flex: 1 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 8px">
      <label for="rl-code" style=${`font-family: ${PIX}; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; color: #9aa0aa`}>Layout code</label>
      <div style="font-size: 13px; color: #a8adb7">Copy it to save or share a build, or paste one and press Load. You can paste it into a chat with Claude too.</div>
      <textarea id="rl-code" value=${v.code} onInput=${v.onCode} rows="3" spellcheck=${false} placeholder='{"v":1,"cells":[["dust",3,4], …]}' style="width: 100%; box-sizing: border-box; resize: vertical; font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace; font-size: 12px; line-height: 1.4; padding: 8px 10px; border-radius: 8px; border: 1px solid #343a45; background: #0f1114; color: #dfe2e7"></textarea>
      <div style="display: flex; flex-wrap: wrap; gap: 6px">
        <button onClick=${v.copyCode} class="act">Copy current layout</button>
        <button onClick=${v.loadCode} class="act">Load code</button>
      </div>
      <details style="font-size: 13px; color: #a8adb7">
        <summary style="cursor: pointer; color: #c3c7ce">What this simulator simplifies</summary>
        <div style="display: flex; flex-direction: column; gap: 6px; padding-top: 8px">
          <p style="margin: 0">One layer, seen from above: dust can’t climb blocks, torches can’t sit on top of blocks, and there’s no quasi-connectivity (pistons powered from the space above them).</p>
          <p style="margin: 0">When two separate wires change in the very same game tick, the exact order Java updates them in can differ here. That only matters for race-condition builds.</p>
          <p style="margin: 0">Erasing tripwire works like cutting it with shears. In the game, breaking string by hand triggers the hooks for 0.5 s.</p>
          <p style="margin: 0">Hoppers: in the game a hopper takes items from the container above it. Seen from above, here it takes them from the container behind its arrow instead.</p>
          <p style="margin: 0">Not in the parts list yet: slime and honey blocks, rails, note blocks, targets, daylight sensors, crafters. Ask for any of them.</p>
        </div>
      </details>
    </div>
  </section>`;
}

function viewInspector(v) {
  const insp = v.insp;
  return html`
  <section aria-label="Inspector" style=${`${CARD}; gap: 10px; min-height: 200px`}>
    <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px">
      <h2 style="margin: 0; font-size: 17px; line-height: 1.2; color: #ffffff">What’s this?</h2>
      <span style="font-size: 12.5px; color: #8d939d">Point at any square</span>
    </div>
    <div style="display: flex; align-items: center; gap: 12px">
      <svg width="46" height="46" viewBox="0 0 40 40" aria-hidden="true" style="flex: 0 0 46px; background: #1f232b; border-radius: 8px; border: 1px solid #343a45; overflow: hidden">${paths(insp.icon)}</svg>
      <div style="min-width: 0; display: flex; flex-direction: column">
        <div style="font-weight: 700; font-size: 17px; color: #ffffff">${insp.name}</div>
        <div style="font-size: 13px; color: #a8adb7">${insp.where}</div>
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 6px">
      ${insp.chips.map((ch) => html`<span class=${ch.cls}>${ch.t}</span>`)}
    </div>
    ${insp.inv ? html`
      <div role="list" aria-label="What's inside" style=${`display: grid; grid-template-columns: repeat(${insp.invCols}, 30px); gap: 3px`}>
        ${insp.inv.map((st) => html`
          <div role="listitem" title=${st ? st.n + ' × ' + st.name : 'Empty slot'} style="position: relative; width: 30px; height: 30px; box-sizing: border-box; border-radius: 4px; background: #2a2f38; border: 1px solid #3b414d">
            ${st ? html`<svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true" style="position: absolute; left: 1px; top: 1px">${paths(st.icon)}</svg>
              <span style="position: absolute; right: 2px; bottom: 0; font-size: 11px; font-weight: 700; color: #ffffff; text-shadow: 1px 1px 0 #1a1a1a">${st.n > 1 ? st.n : ''}</span>` : null}
          </div>`)}
      </div>` : null}
    <div style="display: flex; flex-direction: column; gap: 6px; font-size: 14px; color: #d6d9df">
      ${insp.lines.map((ln) => html`<p style="margin: 0">${ln}</p>`)}
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 6px">
      ${insp.actions.map((a) => html`<button onClick=${a.run} class=${a.cls} aria-pressed=${a.on}>${a.label}</button>`)}
    </div>
  </section>`;
}

/* The shop's controls: pay, change the price, and what's been sold so far. */
function viewShop(sh) {
  const SHOPBTN = 'display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 12px; border-radius: 8px; border: 1px solid #2d7a62; background: #133227; color: #c9f5e4; font-size: 14px; font-weight: 700; cursor: pointer';
  const SMALL = 'width: 30px; height: 30px; border-radius: 7px; border: 1px solid #2d7a62; background: #133227; color: #c9f5e4; font-size: 17px; line-height: 1; cursor: pointer';
  const stat = (n, label) => html`<span><b style="color: #ffffff">${n}</b> ${label}</span>`;
  return html`
  <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; border-radius: 10px; background: #0f2019; border: 1px solid #245a49">
    <div style="display: flex; flex-wrap: wrap; gap: 6px">
      <button onClick=${sh.pay1} class="hv-shop" style=${SHOPBTN}>
        <svg width="18" height="18" viewBox="0 0 40 40" aria-hidden="true">${paths(sh.icon)}</svg>
        <span>Pay 1 diamond</span>
      </button>
      <button onClick=${sh.pay5} class="hv-shop" style=${SHOPBTN}>Pay 5</button>
      <button onClick=${sh.payDirt} class="hv-shop" style=${SHOPBTN.replace('font-weight: 700', 'font-weight: 400')}>Try paying with dirt</button>
    </div>
    <div style="display: flex; align-items: center; gap: 8px; font-size: 14px; color: #c9f5e4">
      <span>Price:</span>
      <button onClick=${sh.cheaper} class="hv-shop" aria-label="Lower the price" title="Lower the price" style=${SMALL}>−</button>
      <span style="min-width: 86px; text-align: center; font-weight: 700; color: #ffffff">${sh.price} diamonds</span>
      <button onClick=${sh.dearer} class="hv-shop" aria-label="Raise the price" title="Raise the price" style=${SMALL}>+</button>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; color: #9fd8c3">
      ${stat(sh.sold, sh.sold === 1 ? 'golden apple sold' : 'golden apples sold')}
      ${stat(sh.bank, sh.bank === 1 ? 'diamond in the bank' : 'diamonds in the bank')}
      ${stat(sh.stock, 'golden apples in stock')}
    </div>
    <span style="font-size: 13px; color: #9fd8c3">You can also click the coin slot to pay, and click the golden apples on the ground to pick them up.</span>
  </div>`;
}

function viewConcept(v) {
  const cpt = v.cpt;
  return html`
  <section aria-label="Concept" style=${`${CARD}; gap: 12px`}>
    <div style=${LABEL_SMALL}>Concept</div>
    <h2 style="margin: 0; font-size: 21px; line-height: 1.2; color: #ffffff">${cpt.title}</h2>
    <p style="margin: 0; color: #d6d9df">${cpt.blurb}</p>
    ${cpt.hasWalk ? html`
      <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px; border-radius: 10px; background: #211b12; border: 1px solid #5a4422">
        <button onClick=${v.toggleWalk} class=${v.walkCls} style="align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 8px; border: 1px solid #9a6a24; background: #3a2a12; color: #ffe2b0; font-size: 14.5px; font-weight: 700; cursor: pointer">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3.5a2.5 3.5 0 1 1 0 7 2.5 3.5 0 0 1 0-7zM16 10a2.5 3.5 0 1 1 0 7 2.5 3.5 0 0 1 0-7zM6.5 12.5h3v3h-3zM14.5 19h3v2.5h-3z" fill="currentColor"></path></svg>
          <span>${v.walkLabel}</span>
        </button>
        <span style="font-size: 13px; color: #e8d6b5">${cpt.tryIt}</span>
      </div>` : null}
    ${cpt.hasShop ? viewShop(v.shop) : null}
    ${cpt.hasSteps ? html`
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div style="font-size: 13px; color: #a8adb7">How it works, one step at a time. Each step lights up its parts on the grid.</div>
        <div role="group" aria-label="Steps" style="display: flex; flex-wrap: wrap; gap: 6px">
          ${cpt.steps.map((s) => html`
            <button onClick=${s.pick} onMouseEnter=${s.enter} onMouseLeave=${s.leave} onFocus=${s.enter} onBlur=${s.leave} class=${cls('hv-step', s.cls)} aria-pressed=${s.on} aria-label=${'Step ' + s.n + ': ' + s.title} title=${s.title} style=${`width: 36px; height: 36px; border-radius: 50%; border: 1px solid #35546a; background: #18222b; color: #cfe9f8; font-family: ${PIX}; font-size: 15px; cursor: pointer`}>${s.n}</button>`)}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; min-height: 132px; box-sizing: border-box; padding: 12px; border-radius: 10px; background: #1c2027; border: 1px solid #2a2f38">
          <div style="font-size: 12.5px; color: #8fd3fb">${v.stepTag}</div>
          <div style="font-weight: 700; font-size: 15.5px; line-height: 1.3; color: #ffffff">${v.stepTitle}</div>
          <div style="font-size: 14px; color: #d6d9df">${v.stepText}</div>
          <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: auto; padding-top: 4px">
            <button onClick=${v.stepPrev} class=${v.prevCls}>‹ Back</button>
            <button onClick=${v.stepNext} class="act">${v.nextLabel}</button>
          </div>
        </div>
      </div>` : null}
    ${cpt.hasSpeeds ? html`
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div style="font-size: 13px; color: #a8adb7">${cpt.speedNote}</div>
        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px">
          ${cpt.speeds.map((r) => html`
            <div class=${r.cls} style="display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 6px 4px; border-radius: 8px; border: 1px solid #2a2f38; background: #1c2027; font-size: 12.5px; color: #a8adb7">
              <span>Delay ${r.d}</span>
              <span style="font-size: 15px; font-weight: 700; color: #ece9e4">${r.text}</span>
              ${r.active ? html`<span style="font-size: 11.5px; color: #8fd3fb">current</span>` : null}
            </div>`)}
        </div>
      </div>` : null}
    ${cpt.hasTips ? html`
      <div style="display: flex; flex-direction: column; gap: 7px">
        ${cpt.tips.map((t) => html`<div style="display: flex; gap: 8px; font-size: 13.5px; color: #c9cdd4"><span aria-hidden="true" style="color: #ff4a36">▪</span><span>${t}</span></div>`)}
      </div>` : null}
  </section>`;
}

function view(v) {
  return html`
  <div style="min-height: 100vh; box-sizing: border-box; background: #121418; color: #ece9e4; font-family: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif; font-size: 15px; line-height: 1.45">
    ${viewHeader(v)}
    ${viewQuickStart(v)}
    <div style="display: flex; flex-wrap: wrap; align-items: flex-start; gap: 18px; padding: 18px 20px 28px">
      ${viewParts(v)}
      <main style="flex: 999 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 10px">
        ${viewToolbar(v)}
        ${viewGrid(v)}
        ${viewGridHelp(v)}
        ${viewTimeline(v)}
        ${viewLibrary(v)}
      </main>
      <aside class="rl-col" aria-label="Details" style="flex: 1 1 330px; max-width: 420px; min-width: 0; display: flex; flex-direction: column; gap: 14px">
        ${viewInspector(v)}
        ${viewConcept(v)}
      </aside>
    </div>
    ${viewToast(v)}
  </div>`;
}

function viewToast(v) {
  if (!v.toast) return null;
  return html`
  <div role="status" aria-live="polite" style="position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); z-index: 20; display: flex; align-items: center; gap: 14px; width: max-content; max-width: calc(100vw - 32px); box-sizing: border-box; padding: 10px 10px 10px 16px; border-radius: 12px; background: #13202b; border: 1px solid #2b6a8f; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5); color: #dff4ff; font-size: 14px">
    <span>${v.toast}</span>
    <button onClick=${v.hideToast} class="act" style="flex: 0 0 auto">OK</button>
  </div>`;
}

// Marks this file as fully loaded (if it is missing, index.html shows which file has a mistake).
if (window.__rlLoaded) window.__rlLoaded.push('ui.js');
