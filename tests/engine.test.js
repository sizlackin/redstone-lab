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
const mod = new Function('window', src + '\n;return { createSim, CONCEPTS, RedstoneLab, makeCell, cellKey, drawPart, GW, GH, PALETTE };')(fakeWindow);
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
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
