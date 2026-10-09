// Checks the redstone engine (and the app's buttons) against known Minecraft: Java Edition behaviour.
// Run it with:  node tests/engine.test.js
// It loads the same files the app uses, so run it after changing anything in app/js/.
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'app', 'js');
const src = ['engine.js', 'drawing.js', 'concepts.js', 'ui.js']
  .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n');

// Just enough of Preact and the browser for the app code to run without a screen.
class StubComponent {
  constructor(p) { this.props = p || {}; this.state = {}; }
  setState(s) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); }
  forceUpdate() {}
}
const fakeWindow = {
  preact: { h: () => null, Component: StubComponent, createRef: () => ({ current: null }) },
  htm: { bind: () => () => null },
  localStorage: { getItem: () => null, setItem: () => {} },
  location: { search: '' },
};
const mod = new Function('window', src + '\n;return { createSim, CONCEPTS, RedstoneLab, makeCell, cellKey, drawPart, GW, GH, PALETTE, dirToward, aimMark, invSignal };')(fakeWindow);
const { createSim, CONCEPTS, GW } = mod;
const Component = mod.RedstoneLab;

let fails = 0, passes = 0;
function ok(cond, msg) { if (cond) { passes++; } else { fails++; console.log('FAIL:', msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + ' — expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); }
const I = (x, y) => y * 24 + x;
function mk(cells) { const s = createSim(24, 16); s.load({ cells }); return s; }
function run(s, n, fn) { const out = []; for (let k = 0; k < n; k++) { s.step(); if (fn) out.push(fn(s)); } return out; }

// 1. Dust decays 1 per block from a lever
{
  const cells = [['lever', 0, 0, 'floor', 'on']];
  for (let x = 1; x <= 17; x++) cells.push(['dust', x, 0]);
  const s = mk(cells);
  const p = []; for (let x = 1; x <= 17; x++) p.push(s.at(I(x, 0)).p);
  eq(p, [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0], 'dust decay');
}
// 2. Repeater delay 2 => output after 4 game ticks
{
  const s = mk([['lever', 0, 0, 'floor', 'off'], ['dust', 1, 0], ['repeater', 2, 0, 'E', 2], ['dust', 3, 0]]);
  s.use(I(0, 0));
  const hist = run(s, 6, (s) => s.at(I(3, 0)).p);
  eq(hist, [0, 0, 0, 15, 15, 15], 'repeater delay 2 → on at tick 4');
}
// 3. Torch inverter through a weakly powered block (dust pointing in)
{
  const s = mk([['lever', 0, 0, 'floor', 'off'], ['dust', 1, 0], ['block', 2, 0], ['torch', 3, 0, 'E'], ['dust', 4, 0]]);
  eq(s.at(I(4, 0)).p, 15, 'torch on initially powers dust');
  s.use(I(0, 0));
  eq(s.blockPower(I(2, 0), true) > 0 && s.blockPower(I(2, 0), false) === 0, true, 'block weakly powered by dust');
  const hist = run(s, 3, (s) => s.at(I(3, 0)).lit);
  eq(hist, [true, false, false], 'torch turns off 2 gt after its block is powered');
  eq(s.at(I(4, 0)).p, 0, 'dust after torch goes dark');
}
// 4. Weak vs strong power: dust → block does NOT power dust beyond; repeater → block DOES
{
  const s = mk([['lever', 0, 0, 'floor', 'on'], ['dust', 1, 0], ['block', 2, 0], ['dust', 3, 0],
    ['lever', 0, 2, 'floor', 'on'], ['repeater', 1, 2, 'E', 1], ['block', 2, 2], ['dust', 3, 2]]);
  run(s, 4);
  eq(s.at(I(3, 0)).p, 0, 'weakly powered block does not power dust');
  eq(s.at(I(3, 2)).p, 15, 'strongly powered block powers dust');
}
// 5. Double observer clock placed by hand: 6 gt period, 2 on / 4 off (Minecraft Wiki: Clock circuits)
{
  const s = mk([['observer', 5, 5, 'E']]);
  s.place(I(6, 5), 'observer', 3);
  const hist = run(s, 40, (s) => (s.at(I(5, 5)).on ? 1 : 0));
  const rises = []; for (let k = 1; k < hist.length; k++) if (hist[k] && !hist[k - 1]) rises.push(k);
  const periods = rises.slice(1).map((r, k) => r - rises[k]);
  ok(periods.length > 3 && periods.every((p) => p === 6), 'double observer clock period 6: ' + JSON.stringify(periods));
  const onLen = []; let run1 = 0; for (const v of hist) { if (v) run1++; else if (run1) { onLen.push(run1); run1 = 0; } }
  ok(onLen.every((l) => l === 2), 'observer pulse 2 gt: ' + JSON.stringify(onLen));
}
// 6. Comparator compare/subtract with side input
{
  // rear: lever right behind (15). side: lever → 3 dust → side dust (power 12)
  const s = mk([['lever', 4, 5, 'floor', 'on'], ['comparator', 5, 5, 'E', 'compare'], ['dust', 6, 5],
    ['lever', 5, 1, 'floor', 'on'], ['dust', 5, 2], ['dust', 5, 3], ['dust', 5, 4]]);
  run(s, 4);
  eq(s.at(I(5, 4)).p, 13, 'side dust power');
  eq(s.at(I(5, 5)).out, 15, 'compare mode passes 15 (side 13 < 15)');
  s.use(I(5, 5)); // subtract
  eq(s.at(I(5, 5)).out, 2, 'subtract mode 15-13=2 immediately on use');
  eq(s.at(I(6, 5)).p, 2, 'output dust = 2');
}
// 7. Tripwire clock concept: quiet until stepped in, 20 gt period at delay 4, stops OFF
{
  const cp = CONCEPTS.find((c) => c.id === 'tripwire-clock');
  const s = mk(cp.cells);
  eq(s.at(I(9, 6)).ok && s.at(I(16, 6)).ok, true, 'hooks connected');
  const quiet = run(s, 40, (s) => s.at(I(12, 10)).on || s.at(I(17, 10)).lit);
  ok(quiet.every((v) => !v), 'clock quiet before tripwire');
  s.use(I(12, 6)); // stand in tripwire
  const hist = run(s, 200, (s) => ({ c: s.at(I(12, 10)).on ? s.at(I(12, 10)).out : 0, lamp: s.at(I(17, 10)).lit, hook: s.at(I(9, 6)).on }));
  eq(hist[0].hook, true, 'hook on in the first tick after stepping in');
  eq(s.at(I(11, 10)).p, 10, 'comparator back input is 10');
  const c = hist.map((h) => (h.c > 0 ? 1 : 0));
  const rises = []; for (let k = 1; k < c.length; k++) if (c[k] && !c[k - 1]) rises.push(k);
  const periods = rises.slice(1).map((r, k) => r - rises[k]);
  ok(periods.length > 5 && periods.every((p) => p === 20), 'delay 4 → period 20 gt: ' + JSON.stringify(periods));
  const outs = [...new Set(hist.map((h) => h.c).filter((v) => v > 0))];
  eq(outs, [10], 'comparator output is a clean 10 / 0');
  const lampOffRuns = []; let r0 = 0; for (const h of hist.slice(30)) { if (!h.lamp) r0++; else if (r0) { lampOffRuns.push(r0); r0 = 0; } }
  ok(lampOffRuns.length > 3 && lampOffRuns.every((l) => l === 6), 'lamp dark 6 gt per cycle at delay 4: ' + JSON.stringify(lampOffRuns));
  // step out
  s.use(I(12, 6));
  const after = run(s, 60, (s) => ({ on: s.at(I(12, 10)).on, lamp: s.at(I(17, 10)).lit, hook: s.at(I(9, 6)).on }));
  const hookOff = after.findIndex((h) => !h.hook);
  ok(hookOff >= 0 && hookOff <= 10, 'hook switches off within 10 gt after leaving: ' + hookOff);
  ok(after.slice(30).every((h) => !h.on && !h.lamp), 'clock stops in the OFF state');
  // delay 1
  s.setDelay(I(12, 9), 1);
  s.use(I(12, 6));
  const h1 = run(s, 120, (s) => ({ c: s.at(I(12, 10)).on ? 1 : 0, lamp: s.at(I(17, 10)).lit }));
  const r1 = []; for (let k = 1; k < h1.length; k++) if (h1[k].c && !h1[k - 1].c) r1.push(k);
  const p1 = r1.slice(1).map((r, k) => r - r1[k]);
  ok(p1.length > 5 && p1.every((p) => p === 8), 'delay 1 → period 8 gt: ' + JSON.stringify(p1));
  ok(h1.slice(20).every((h) => h.lamp), 'lamp looks solid at delay 1');
}
// 8. Piston push and sticky pull with a lever (long pulse)
{
  const s = mk([['lever', 3, 5, 'floor', 'off'], ['sticky_piston', 4, 5, 'E'], ['block', 5, 5]]);
  s.use(I(3, 5));
  const h = run(s, 4, (s) => [s.at(I(5, 5)) && s.at(I(5, 5)).t, s.at(I(6, 5)) && s.at(I(6, 5)).t]);
  eq(h[0], ['moving', 'moving'], 'piston starts moving at once (block event)');
  eq(h[2], ['head', 'block'], 'block arrives 2 gt later, head in place');
  s.use(I(3, 5));
  run(s, 4);
  eq([s.at(I(4, 5)).t, s.at(I(4, 5)).ext, s.at(I(5, 5)) && s.at(I(5, 5)).t, s.at(I(6, 5))], ['piston', false, 'block', null], 'sticky piston pulls the block back');
}
// 9. Sticky piston given a 2 gt observer pulse spits its block
{
  const s = mk([['sticky_piston', 5, 5, 'E'], ['block', 6, 5], ['observer', 4, 5, 'W']]);
  s.place(I(3, 5), 'block', -1); // observer sees the change
  run(s, 12);
  eq([s.at(I(5, 5)).t, s.at(I(5, 5)).ext, s.at(I(6, 5)), s.at(I(7, 5)) && s.at(I(7, 5)).t], ['piston', false, null, 'block'], 'sticky piston drops block on a 2 gt pulse');
}
// 10. Push limit 12 and dust breaking
{
  const cells = [['lever', 0, 3, 'floor', 'off'], ['piston', 1, 3, 'E']];
  for (let x = 2; x <= 14; x++) cells.push(['block', x, 3]); // 13 blocks
  const s = mk(cells);
  s.use(I(0, 3)); run(s, 4);
  eq(s.at(I(1, 3)).ext, false, 'cannot push 13 blocks');
  const s2 = mk([['lever', 0, 3, 'floor', 'off'], ['piston', 1, 3, 'E'], ['block', 2, 3], ['dust', 3, 3]]);
  s2.use(I(0, 3)); run(s2, 4);
  eq([s2.at(I(1, 3)).ext, s2.at(I(3, 3)) && s2.at(I(3, 3)).t], [true, 'block'], 'piston breaks dust and pushes block into its place');
}
// 11. Torch burnout in a fast torch loop
{
  // (a loop whose dust touches the strongly powered block would latch on — same as in-game)
  const s = mk([['block', 5, 5], ['torch', 6, 5, 'E'], ['dust', 7, 5], ['dust', 7, 4], ['dust', 7, 3], ['dust', 6, 3], ['dust', 5, 3],
    ['dust', 4, 3], ['dust', 3, 3], ['dust', 3, 4], ['dust', 3, 5], ['repeater', 4, 5, 'E', 1]]);
  const h = run(s, 120, (s) => ({ lit: s.at(I(6, 5)).lit, burnt: s.at(I(6, 5)).burnt }));
  const firstBurn = h.findIndex((x) => x.burnt);
  ok(firstBurn > 0 && firstBurn < 80, 'torch burns out in a fast loop at tick ' + firstBurn);
  ok(h.slice(firstBurn, firstBurn + 30).every((x) => !x.lit), 'burnt torch stays off');
  const later = run(s, 200, (s) => s.at(I(6, 5)).lit);
  ok(later.some((v) => v), 'torch relights later');
}
// 12. Dispenser fires once per rising edge
{
  const s = mk([['lever', 3, 5, 'floor', 'off'], ['dispenser', 4, 5, 'E']]);
  s.use(I(3, 5)); run(s, 10);
  eq(s.at(I(4, 5)).shots, 1, 'one shot when powered');
  run(s, 20);
  eq(s.at(I(4, 5)).shots, 1, 'no more shots while held on');
  s.use(I(3, 5)); run(s, 2); s.use(I(3, 5)); run(s, 6);
  eq(s.at(I(4, 5)).shots, 2, 'second shot after off/on');
}
// 13. Copper bulb toggles on rising edges
{
  const s = mk([['lever', 3, 5, 'floor', 'off'], ['copper_bulb', 4, 5]]);
  const seq = [];
  for (let k = 0; k < 4; k++) { s.use(I(3, 5)); run(s, 2); seq.push(s.at(I(4, 5)).lit); }
  eq(seq, [true, true, false, false], 'bulb flips only on rising edges');
}
// 14. Repeater lock
{
  const s = mk([['lever', 0, 5, 'floor', 'off'], ['dust', 1, 5], ['repeater', 2, 5, 'E', 1], ['dust', 3, 5],
    ['lever', 2, 7, 'floor', 'on'], ['repeater', 2, 6, 'N', 1]]);
  run(s, 4);
  eq(s.at(I(2, 5)).lock, true, 'repeater locked by side repeater');
  s.use(I(0, 5)); run(s, 6);
  eq(s.at(I(2, 5)).on, false, 'locked repeater ignores input');
  s.use(I(2, 7)); run(s, 6);
  eq([s.at(I(2, 5)).lock, s.at(I(2, 5)).on], [false, true], 'unlocked repeater follows input again');
}
// 15. Comparator reads dispenser fullness; repeater stretches a 2 gt pulse to its delay
{
  const s = mk([['dispenser', 4, 5, 'E'], ['comparator', 5, 5, 'E', 'compare'], ['dust', 6, 5]]);
  run(s, 3);
  eq(s.at(I(5, 5)).out, 15, 'full dispenser reads 15');
  const s2 = mk([['observer', 4, 5, 'W'], ['repeater', 5, 5, 'E', 4], ['dust', 6, 5]]);
  s2.place(I(3, 5), 'block', -1);
  const h = run(s2, 20, (s) => (s.at(I(6, 5)).p > 0 ? 1 : 0));
  eq(h.reduce((a, b) => a + b, 0), 8, 'repeater (delay 4) stretches a 2 gt pulse to 8 gt');
}
// 16. Hook needs a block; torch pops off when its block is removed
{
  const s = mk([]);
  eq(s.place(I(5, 5), 'hook', 1), false, 'hook refused without a block behind');
  const s2 = mk([['block', 5, 5], ['torch', 6, 5, 'E']]);
  s2.erase(I(5, 5));
  eq(s2.at(I(6, 5)), null, 'torch pops off');
}
// 17. Serialize / load round trip
{
  const cp = CONCEPTS.find((c) => c.id === 'tripwire-clock');
  const s = mk(cp.cells);
  const a = JSON.stringify(s.serialize());
  const s2 = createSim(24, 16); s2.load(JSON.parse(a));
  eq(JSON.stringify(s2.serialize()), a, 'round trip');
  eq(s.serialize().cells.length, cp.cells.length, 'all concept cells serialized');
}
// 18. UI logic smoke test: render, interact, describe every part
{
  const comp = new Component({});
  comp.componentDidMount = () => {};
  comp.mounted = true;
  let v = comp.renderVals();
  ok(Array.isArray(v.cells) && v.cells.length === CONCEPTS[0].cells.length, 'renders concept cells');
  comp.toggleWalk();
  for (let k = 0; k < 60; k++) comp.tickOnce();
  v = comp.renderVals();
  ok(v.probeRows.length === 3 && v.probeRows[1].line.length > 10, 'timeline rows');
  for (const g of mod.PALETTE) for (const it of g.items) {
    comp.state.brush = it.id;
    const empty = I(2 + (Math.random() * 3 | 0), 13);
    comp.act(I(1, 13), false, false, false);
    comp.act(empty, false, false, false);
    comp.act(I(1, 13), false, true, false);
    comp.state.hover = I(20, 14); v = comp.renderVals();
    comp.state.hover = I(1, 13); v = comp.renderVals();
  }
  for (let i = 0; i < 24 * 16; i++) { const d = comp.describe(i); if (!d.name) ok(false, 'describe name ' + i); }
  comp.state.step = 2; comp.state.kbMode = true; comp.state.kb = I(12, 10); v = comp.renderVals();
  comp.gKey({ key: 'ArrowRight', preventDefault() {}, shiftKey: false });
  comp.gKey({ key: 'Enter', preventDefault() {}, shiftKey: false });
  comp.gKey({ key: 'r', preventDefault() {}, shiftKey: false });
  comp.copyCode = comp.copyCode; comp.state.code = JSON.stringify(comp.sim.serialize());
  comp.loadCode(); v = comp.renderVals();
  ok(v.cpt.title === 'Your layout', 'custom layout card after code load');
  comp.undo(); comp.clearGrid(); comp.undo(); comp.restart();
  v = comp.renderVals();
  ok(typeof v.timeText === 'string', 'renderVals after undo/restart');
  comp.loadConcept('tripwire-clock'); v = comp.renderVals();
  ok(v.cpt.steps.length === 7 && v.cpt.speeds.some((r) => r.cls === 'spd-on'), 'concept steps + current speed row');
  // Reset / Clear / Step controls
  comp.sim.erase(I(12, 10)); comp.sim.setDelay(I(12, 9), 1);
  comp.resetBuild();
  ok(comp.sim.at(I(12, 10)).t === 'comparator' && comp.sim.at(I(12, 9)).d === 4 && comp.probes.length === 3, 'Reset restores the concept exactly');
  // Blue step tags: none while no step is open, exactly one (the open step) while one is
  const blueTags = (vals) => vals.over.filter((o) => o.p.some((q) => q.fill === '#5cc8ff' && /a/.test(q.d || ''))).length;
  comp.state.step = -1; comp.state.stepHover = -1; comp.state.kbMode = false; comp.state.hover = -1; comp.state.sel = -1;
  v = comp.renderVals();
  ok(blueTags(v) === 0, 'No blue step numbers on the grid when no step is open');
  comp.state.step = 2; v = comp.renderVals();
  ok(blueTags(v) === 1, 'Exactly one blue step number while a step is open');
  comp.state.step = -1;
  comp.clearGrid(); v = comp.renderVals();
  ok(comp.sim.serialize().cells.length === 0 && comp.state.concept === 'blank' && v.over.length === 0 && v.probeRows.length === 0, 'Clear empties the grid, the step numbers and the timeline');
  ok(/Reset/.test(v.cpt.blurb) && /Tripwire|clock/i.test(v.cpt.blurb) && v.cpt.steps.length === 0 && /Put “/.test(v.resetTitle), 'After Clear the card says Reset brings the concept back');
  comp.undo(); v = comp.renderVals();
  ok(comp.sim.serialize().cells.length === CONCEPTS[0].cells.length && comp.state.concept === 'tripwire-clock' && comp.probes.length === 3, 'Undo after Clear brings back the build, card and timeline');
  comp.clearGrid();
  comp.resetBuild();
  ok(comp.sim.serialize().cells.length === CONCEPTS[0].cells.length && comp.state.concept === 'tripwire-clock' && comp.probes.length === 3, 'Reset after Clear brings the concept back');
  comp.undo();
  ok(comp.sim.serialize().cells.length === 0 && comp.state.concept === 'blank', 'Undo after Reset returns to the cleared grid');
  comp.loadConcept('blank'); comp.undo();
  ok(comp.startLayout.id === 'tripwire-clock' && comp.state.concept === 'blank', 'Undo restores what Reset goes back to');
  comp.resetBuild();
  const t0 = comp.sim.S.now; comp.stepBtn({ shiftKey: false }); const t1 = comp.sim.S.now; comp.stepBtn({ shiftKey: true });
  ok(t1 - t0 === 2 && comp.sim.S.now - t1 === 1 && comp.state.playing === false, 'Step = 0.1 s, Shift+Step = 1 game tick, and it pauses');
  comp.state.code = JSON.stringify({ v: 1, cells: [['lever', 1, 1, 'floor', 'on'], ['dust', 2, 1]], probes: [[2, 1, 'Wire']] });
  comp.loadCode(); comp.sim.erase(I(2, 1)); comp.resetBuild();
  ok(comp.sim.at(I(2, 1)) && comp.sim.at(I(2, 1)).t === 'dust' && comp.probes.length === 1, 'Reset returns to a loaded layout code');
  v = comp.renderVals();
  ok(Array.isArray(v.brushIcon) && v.brushIcon.length > 0 && typeof v.timeText === 'string' && /tick/.test(v.tickText), 'toolbar values render');
}
// 19. Every concept in concepts.js loads cleanly (catches typos when editing it)
{
  const ids = new Set();
  for (const cp of CONCEPTS) {
    ok(cp.id && !ids.has(cp.id), 'concept id is missing or used twice: ' + cp.id);
    ids.add(cp.id);
    ok(typeof cp.title === 'string' && cp.title.length > 0, 'concept "' + cp.id + '" needs a title');
    const s = createSim(24, 16);
    const bad = s.load({ cells: cp.cells || [] });
    ok(bad === 0, 'concept "' + cp.id + '" has ' + bad + ' part(s) with an unknown name or a square off the grid');
    const onGrid = (pt) => Array.isArray(pt) && pt[0] >= 0 && pt[0] < 24 && pt[1] >= 0 && pt[1] < 16;
    for (const pr of cp.probes || []) ok(onGrid(pr), 'concept "' + cp.id + '": timeline part off the grid ' + JSON.stringify(pr));
    for (const st of cp.steps || []) {
      ok(typeof st.title === 'string' && typeof st.text === 'string', 'concept "' + cp.id + '": every step needs a title and text');
      for (const pt of (st.cells || []).concat(st.badge ? [st.badge] : [])) ok(onGrid(pt), 'concept "' + cp.id + '": step square off the grid ' + JSON.stringify(pt));
    }
  }
}
// 20. Turning parts: setFacing / facingOptions / rotate both ways
{
  // Lever west of the repeater, and a second lever feeding in from the north
  const s = mk([['lever', 0, 2, 'floor', 'on'], ['dust', 1, 2], ['repeater', 2, 2, 'E', 3], ['dust', 3, 2],
    ['lever', 2, 0, 'floor', 'on'], ['dust', 2, 1], ['dust', 2, 3]]);
  run(s, 10);
  const R2 = I(2, 2);
  eq(s.facingOptions(R2), [0, 1, 2, 3], 'repeater can face all four ways');
  ok(s.at(I(3, 2)).p === 15 && s.at(I(2, 3)).p === 0, 'facing east it powers the dust east of it only');
  ok(s.setFacing(R2, 2) && s.at(R2).f === 2 && s.at(R2).d === 3, 'setFacing turns it and keeps its delay');
  run(s, 10);
  ok(s.at(I(3, 2)).p === 0 && s.at(I(2, 3)).p === 15, 'turned south, it takes power from the north and powers the dust below instead');
  ok(!s.setFacing(R2, 2), 'setFacing to the way it already faces does nothing');
  ok(s.rotate(R2, true) && s.at(R2).f === 1, 'rotate backwards goes counter-clockwise (south to east)');
  ok(s.rotate(R2) && s.at(R2).f === 2, 'rotate forwards goes clockwise (east to south)');

  const t = mk([['block', 5, 5], ['torch', 6, 5, 'E']]);
  const T = I(6, 5);
  eq(t.facingOptions(T), [-1, 1], 'a wall torch can face away from its block, or stand on the floor');
  ok(!t.setFacing(T, 0) && t.at(T).f === 1, 'a torch can not point north with no block south of it');
  ok(t.setFacing(T, -1) && t.at(T).f === -1, 'a torch can be stood on the floor');
  ok(t.setFacing(T, 1) && t.at(T).f === 1, '...and hung back on its block');

  const h = mk([['block', 5, 5], ['tripwire_hook', 6, 5, 'E']]);
  eq(h.facingOptions(I(6, 5)), [1], 'a hook can only face away from the one block it hangs on');
  ok(!h.rotate(I(6, 5)) && h.S.notices.length > 0, 'turning that hook explains why it can not');

  const p = mk([['lever', 0, 0, 'floor', 'on'], ['piston', 1, 0, 'E']]);
  run(p, 6);
  ok(p.at(I(1, 0)).ext && p.facingOptions(I(1, 0)).length === 0 && !p.setFacing(I(1, 0), 2), 'an extended piston can not be turned');
  ok(p.S.notices.some((n) => /retract/.test(n)), 'and it says to let the piston retract first');
}
// 21. Hold R and point: the app's aiming logic
{
  const { dirToward, aimMark } = mod;
  eq([dirToward(10, 0, 5), dirToward(0, -10, 5), dirToward(-10, 3, 5), dirToward(2, 10, 5), dirToward(-3, 2, 5)], [1, 0, 3, 2, -1], 'mouse direction snaps to the nearest side, with a dead zone on the square');
  ok(aimMark([1, 3], 1).length === 3, 'aim arrows only on the sides it can face');

  const comp = new Component({});
  comp.componentDidMount = () => {};
  comp.mounted = true;
  comp.state.code = JSON.stringify({ v: 1, cells: [['repeater', 5, 5, 'E', 2], ['dust', 8, 5], ['block', 10, 10], ['torch', 11, 10, 'E']] });
  comp.loadCode();
  const R5 = I(5, 5), D8 = I(8, 5), T11 = I(11, 10);
  const facing = () => comp.sim.at(R5).f;
  const undos = () => comp.undoStack.length;
  const key = (k, extra) => Object.assign({ key: k, repeat: false, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'BUTTON' }, preventDefault() {} }, extra || {});

  // Hold R over the repeater and point down
  comp.state.hover = R5; comp.state.sel = -1; comp.state.kbMode = false;
  let u0 = undos();
  comp.onWinKeyDown(key('r'));
  ok(comp.aim && comp.aim.kind === 'part' && comp.aim.i === R5, 'R over a repeater starts pointing it');
  comp.aimToward(2);
  ok(facing() === 2, 'pointing down turns it to face south straight away');
  comp.aimToward(3);
  ok(facing() === 3, 'then west');
  let v = comp.renderVals();
  ok(/let go of R/.test(v.notice) && v.insp.name === 'Redstone Repeater', 'while R is held, the status line explains it and the inspector shows the repeater');
  comp.onWinKeyUp(key('r'));
  ok(!comp.aim && facing() === 3 && undos() === u0 + 1, 'letting go keeps it, as one Undo step');
  comp.undo();
  ok(facing() === 1, 'Undo puts it back');

  // A quick tap turns one step; Shift+tap turns back
  comp.state.hover = R5;
  comp.onWinKeyDown(key('r')); comp.onWinKeyUp(key('r'));
  ok(facing() === 2, 'tapping R turns it one step clockwise');
  comp.onWinKeyDown(key('R', { shiftKey: true })); comp.onWinKeyUp(key('R'));
  ok(facing() === 1, 'Shift+R turns it back');

  // Esc puts it back with no Undo step left behind
  u0 = undos();
  comp.onWinKeyDown(key('r')); comp.aimToward(0);
  ok(facing() === 0, 'pointing up turns it north');
  comp.onWinKeyDown(key('Escape'));
  ok(!comp.aim && facing() === 1 && undos() === u0, 'Esc puts it back and leaves no Undo step');

  // Arrow keys point it while R is held; held-key repeats are ignored
  comp.onWinKeyDown(key('r'));
  comp.onWinKeyDown(key('r', { repeat: true }));
  comp.onWinKeyDown(key('ArrowDown'));
  comp.onWinKeyUp(key('r'));
  ok(facing() === 2, 'arrow keys point it while R is held');

  // The selected part is used when the mouse is not over a part that can turn
  comp.state.hover = D8; comp.state.sel = R5;
  comp.onWinKeyDown(key('r'));
  ok(comp.aim && comp.aim.i === R5, 'with the mouse over dust, R points the selected repeater');
  comp.aimToward(1); comp.onWinKeyUp(key('r'));
  ok(facing() === 1, 'and it turns');

  // Holding a part with a direction over an empty square, R points the piece in your hand instead
  comp.state.brush = 'repeater'; comp.state.hover = I(3, 3); comp.state.sel = R5;
  comp.onWinKeyDown(key('r'));
  ok(comp.aim && comp.aim.kind === 'brush' && comp.aim.i === I(3, 3), 'with a repeater in hand over an empty square, R points the one in your hand');
  comp.onWinKeyDown(key('Escape'));
  comp.state.brush = 'dust';

  // Wall torch: only sides with a block behind
  comp.state.hover = T11; comp.state.sel = -1;
  comp.onWinKeyDown(key('r')); comp.aimToward(0);
  ok(comp.sim.at(T11).f === 1, 'a torch will not point a way that has no block behind it');
  comp.onWinKeyUp(key('r'));

  // No part to turn: R turns the piece in your hand (tap) or points it (hold over an empty square)
  comp.state.brush = 'observer'; comp.state.facing = 1;
  comp.state.hover = -1; comp.state.sel = -1;
  comp.onWinKeyDown(key('r')); comp.onWinKeyUp(key('r'));
  ok(comp.state.facing === 2, 'tapping R with nothing to turn turns the piece in your hand');
  comp.state.hover = I(2, 2);
  comp.onWinKeyDown(key('r'));
  ok(comp.aim && comp.aim.kind === 'brush' && comp.aim.i === I(2, 2), 'over an empty square, R points the piece in your hand');
  comp.aimToward(3);
  v = comp.renderVals();
  ok(comp.state.facing === 3 && v.over.length >= 2, 'it turns, and its ghost and arrows are drawn on that square');
  comp.onWinKeyUp(key('r'));
  ok(/in your hand now faces west/.test(comp.state.notice), 'and says which way it faces now');

  // Never steals R from text boxes or Ctrl+R
  comp.onWinKeyDown(key('r', { target: { tagName: 'TEXTAREA' } }));
  comp.onWinKeyDown(key('r', { ctrlKey: true }));
  ok(!comp.aim && comp.state.facing === 3, 'R typed in the layout code box, or Ctrl+R, is left alone');

  // Clicking the grid while R is held does nothing
  comp.state.hover = R5;
  comp.onWinKeyDown(key('r'));
  let prevented = false;
  comp.gDown({ button: 0, preventDefault() { prevented = true; }, clientX: 0, clientY: 0 });
  ok(prevented && comp.sim.at(R5).d === 2, 'a click while R is held is ignored (the repeater delay did not change)');
  comp.onWinBlur();
  ok(!comp.aim, 'switching windows while R is held finishes the turn');
}
// 22. Items: hoppers, droppers, chests and comparators reading them (Java rules)
{
  const { invSignal } = mod;
  const slots = (arr, size) => { const s = new Array(size).fill(null); arr.forEach((it, k) => { if (it) s[k] = { id: it[0], n: it[1] }; }); return s; };
  eq([invSignal(slots([], 5)), invSignal(slots([['diamond', 1]], 5)), invSignal(slots([['diamond', 22]], 5)), invSignal(slots([['diamond', 23]], 5))], [0, 1, 1, 2],
    'comparator reads a hopper: 0 empty, 1 from the first item, 2 from 23 items');
  eq([invSignal(slots([['diamond', 18], ['filler', 1], ['filler', 1], ['filler', 1], ['filler', 1]], 5)), invSignal(slots([['diamond', 19], ['filler', 1], ['filler', 1], ['filler', 1], ['filler', 1]], 5))], [1, 2],
    'the diamond filter reads 1 with 18 diamonds and 2 with 19');
  eq(invSignal(slots(new Array(27).fill(['diamond', 64]), 27)), 15, 'a full chest reads 15');
  eq(invSignal(slots([['token', 41]], 9)), 1, 'a dropper with 41 tokens still reads just 1');

  const cnt = (s, x, y, id) => s.at(I(x, y)).slots.reduce((a, st) => a + (st && (!id || st.id === id) ? st.n : 0), 0);
  // Chest -> hopper -> chest: one item every 8 game ticks (2.5 a second)
  let s = mk([['chest', 0, 0, '', [['diamond', 64]]], ['hopper', 1, 0, 'E'], ['chest', 2, 0, '']]);
  const times = [];
  for (let t = 1, prev = 0; t <= 41; t++) { s.step(); const n = cnt(s, 2, 0); if (n !== prev) { times.push(s.S.now); prev = n; } }
  eq(times, [9, 17, 25, 33, 41], 'a hopper moves one item every 8 game ticks');

  // A powered hopper is locked
  s = mk([['chest', 0, 0, '', [['diamond', 10]]], ['hopper', 1, 0, 'E'], ['chest', 2, 0, ''], ['lever', 1, 1, 'floor', 'on']]);
  run(s, 40);
  ok(cnt(s, 2, 0) === 0 && s.at(I(1, 0)).locked, 'a powered hopper holds still');
  s.use(I(1, 1)); run(s, 40);
  ok(cnt(s, 2, 0) > 0 && !s.at(I(1, 0)).locked, 'unpowered, it moves items again');

  // The filter only takes diamonds; dirt stays in the coin slot
  s = mk([['hopper', 0, 0, 'N', [['dirt', 5], ['diamond', 3]]], ['hopper', 1, 0, 'E', [['diamond', 18], ['filler', 1], ['filler', 1], ['filler', 1], ['filler', 1]]], ['comparator', 1, 1, 'S']]);
  ok(s.at(I(1, 1)).out === 1, 'filter comparator reads 1 at rest');
  run(s, 60);
  ok(cnt(s, 0, 0, 'dirt') === 5 && cnt(s, 0, 0, 'diamond') === 0 && cnt(s, 1, 0, 'diamond') === 21 && s.at(I(1, 1)).out === 2, 'the filter took the 3 diamonds and left the dirt');

  // Dropper: one item per new pulse, 4 game ticks later; into a chest in front, or onto the ground
  s = mk([['stone_button', 0, 1, 'floor'], ['dropper', 1, 1, 'E', [['golden_apple', 3]]], ['dropper', 1, 3, 'E', [['golden_apple', 3]]], ['chest', 2, 3, ''], ['stone_button', 0, 3, 'floor']]);
  s.use(I(0, 1));
  const outs = run(s, 8, (x) => x.at(I(1, 1)).out);
  eq(outs, [0, 0, 0, 1, 1, 1, 1, 1], 'a dropper fires once, 4 game ticks after the button');
  eq(s.S.ground.get(I(2, 1)), { golden_apple: 1 }, 'with nothing in front, the item lands on the ground');
  s.use(I(0, 3)); run(s, 8);
  ok(cnt(s, 2, 3) === 1 && cnt(s, 1, 3) === 2, 'with a chest in front, the item goes into the chest');
  eq(s.pickUp(I(2, 1)), { golden_apple: 1 }, 'picking up the ground pile');
  ok(!s.S.ground.has(I(2, 1)), 'and then it is gone');

  // Contents survive save and load
  const a = JSON.stringify(s.serialize());
  const s2 = createSim(24, 16); s2.load(JSON.parse(a));
  eq(JSON.stringify(s2.serialize()), a, 'containers round-trip through layout codes');
}
// 23. The diamond shop concept
{
  const shop = CONCEPTS.find((c) => c.id === 'diamond-shop');
  ok(!!shop, 'the diamond shop is in the library');
  const COIN = I(6, 5), T = I(13, 9), PAY = I(16, 8), GROUND = I(17, 8);
  const cnt = (s, i, id) => s.at(i).slots.reduce((a, st) => a + (st && (!id || st.id === id) ? st.n : 0), 0);
  const total = (s, id) => s.S.cells.reduce((a, c) => a + (c && c.slots ? c.slots.reduce((b, st) => b + (st && st.id === id ? st.n : 0), 0) : 0), 0);
  function shopRun(price, plan, ticks) {
    const s = createSim(24, 16);
    s.load({ cells: shop.cells });
    if (price > 3) s.giveItems(T, 'token', price - 3); else if (price < 3) s.takeItems(T, 'token', 3 - price);
    let paid = 0, badTokens = false;
    for (let t = 1; t <= ticks; t++) {
      if (plan[t]) for (const [id, n] of plan[t]) { const k = s.giveItems(COIN, id, n); if (id === 'diamond') paid += k; }
      s.step();
      if (total(s, 'token') !== price) badTokens = true;
    }
    return { s, paid, sold: s.at(PAY).out, badTokens };
  }
  let r = shopRun(3, {}, 200);
  ok(r.sold === 0 && cnt(r.s, T, 'token') === 3, 'at rest nothing is sold and the counter holds 3 tokens');
  r = shopRun(3, { 1: [['diamond', 2]] }, 300);
  ok(r.sold === 0, 'paying 2 of 3 diamonds sells nothing yet');
  r = shopRun(3, { 1: [['diamond', 3]] }, 300);
  ok(r.sold === 1 && (r.s.S.ground.get(GROUND) || {}).golden_apple === 1, 'paying 3 sells one golden apple, dropped in front of the shop');
  ok(cnt(r.s, I(7, 3), 'diamond') + cnt(r.s, I(7, 4), 'diamond') === 3 && cnt(r.s, I(7, 5), 'diamond') === 18, 'the 3 diamonds went to the bank (or the gate on its way there); the filter is back to 18');
  ok(cnt(r.s, T, 'token') === 3 && !r.badTokens, 'the counter reset with all 3 tokens');
  r = shopRun(3, { 1: [['diamond', 1]], 60: [['diamond', 1]], 200: [['diamond', 1]] }, 500);
  ok(r.sold === 1, 'paying 3 diamonds one at a time also sells one');
  r = shopRun(3, { 1: [['dirt', 5]] }, 300);
  ok(r.sold === 0 && cnt(r.s, COIN, 'dirt') === 5, 'paying with dirt sells nothing; the dirt stays in the coin slot');
  r = shopRun(3, { 1: [['dirt', 5], ['diamond', 3]] }, 400);
  ok(r.sold === 1 && cnt(r.s, COIN, 'dirt') === 5, 'dirt mixed with diamonds: the diamonds still count');
  r = shopRun(3, { 1: [['diamond', 7]] }, 800);
  ok(r.sold === 2 && cnt(r.s, T, 'token') === 2, 'paying 7 at price 3 sells 2, and 1 diamond counts toward the next');
  r = shopRun(5, { 1: [['diamond', 10]] }, 900);
  ok(r.sold === 2 && !r.badTokens, 'price 5: paying 10 sells 2');
  r = shopRun(2, { 1: [['diamond', 4]] }, 500);
  ok(r.sold === 2, 'price 2: paying 4 sells 2');
  r = shopRun(3, { 1: [['diamond', 64]] }, 3000);
  ok(r.sold === 21 && !r.badTokens && cnt(r.s, COIN, 'diamond') === 0, 'a whole stack of 64 at price 3 sells 21 and nothing gets stuck');
  ok(total(r.s, 'golden_apple') + ((r.s.S.ground.get(GROUND) || {}).golden_apple || 0) === 136, 'every golden apple is either in stock or on the ground');
  // Random payments at random prices: sales always match, tokens and diamonds are never lost
  let seed = 7, bad = 0;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let trial = 0; trial < 12; trial++) {
    const price = 2 + rnd(7), plan = {};
    for (let k = 0; k < 5; k++) plan[1 + rnd(1200)] = [['diamond', 1 + rnd(9)]];
    const q = shopRun(price, plan, 3500);
    const inMachine = total(q.s, 'diamond') - 18;
    if (q.badTokens || q.sold !== Math.floor(q.paid / price) || inMachine !== q.paid) bad++;
  }
  ok(bad === 0, 'random payments at random prices: sales always match and nothing is lost (' + bad + ' bad)');
}
// 24. The shop panel in the app
{
  const comp = new Component({});
  comp.componentDidMount = () => {};
  comp.mounted = true;
  comp.loadConcept('diamond-shop');
  let v = comp.renderVals();
  ok(v.shop && v.shop.price === 3 && v.shop.sold === 0 && v.shop.stock === 136, 'the shop panel shows price 3, nothing sold, 136 golden apples in stock');
  comp.setShopPrice(-1);
  ok(comp.renderVals().shop.price === 2, 'the − button lowers the price to 2');
  comp.setShopPrice(-1);
  ok(comp.renderVals().shop.price === 2 && /at least 2/.test(comp.state.notice), 'it will not go below 2, and says why');
  comp.setShopPrice(1);
  ok(comp.renderVals().shop.price === 3, 'the + button raises it again');
  comp.state.hover = -1; comp.state.sel = -1;
  comp.act(I(6, 5), false, false, false);
  ok(/Paid 1 diamond/.test(comp.state.notice), 'clicking the coin slot pays one diamond');
  comp.payShop('diamond', 2);
  for (let k = 0; k < 300; k++) comp.tickOnce();
  v = comp.renderVals();
  ok(v.shop.sold === 1 && v.shop.bank === 3 && v.shop.stock === 135, 'after paying 3: one sold, 3 diamonds in the bank, 135 left');
  ok(v.cells.some((cd) => cd.tr === 'translate(680 320)'), 'the golden apple is drawn on the ground in front of the shop');
  const d = comp.describe(I(17, 8));
  ok(d.name === 'Items on the ground' && /1 golden apple/.test(d.lines[0]), 'the inspector explains the item on the ground');
  comp.act(I(17, 8), false, false, false);
  ok(!comp.sim.S.ground.size && comp.sim.at(I(17, 8)) === null, 'clicking it picks it up instead of placing a part');
  const f = comp.describe(I(7, 5));
  ok(f.inv && f.inv.length === 5 && f.inv[0].n === 18 && f.inv[1].n === 1 && f.invCols === 5, 'the filter hopper shows its 5 slots: 18 diamonds and the filler sticks');
  comp.payShop('diamond', 1);
  for (let k = 0; k < 60; k++) comp.tickOnce();
  comp.setShopPrice(1);
  ok(/middle of a sale/.test(comp.state.notice) && comp.renderVals().shop.price === 3, 'the price can not change in the middle of a sale');
  comp.payShop('dirt', 1);
  ok(/won’t take it/.test(comp.state.notice), 'paying with dirt explains what will happen');
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
