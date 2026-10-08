/* ================= Concepts =================
   Every entry in this list shows up in the app's "Concept library" (except ones marked hidden).
   This is the file to edit when you add a new build. Save it on GitHub and the app picks it up
   the next time it opens.

   The grid is 24 squares wide (x = 0 to 23, left to right) and 16 tall (y = 0 to 15, top to bottom).

   cells: one entry per part: [part, x, y, facing, extra]
     part    block, glass, redstone_block, dust, torch, repeater, comparator, observer, piston,
             sticky_piston, lever, stone_button, wood_button, pressure_plate, tripwire_hook,
             tripwire, lamp, dispenser, copper_bulb
     facing  'N', 'E', 'S' or 'W' (up, right, down, left).
             Repeaters, comparators, observers, pistons, dispensers: the way the part points.
             Torches, levers, buttons: 'floor', or the way they point away from the wall they hang on.
             Tripwire hooks: the way they point toward the string (the block they hang on is behind them).
     extra   repeater: delay 1 to 4 · comparator: 'compare' or 'subtract' · lever: 'on' or 'off'
             · dust: 'dot' (a single dot that doesn't connect)

   Optional extras for a concept (see the tripwire clock below for a full example):
     probes     parts drawn on the timeline: [x, y, 'Label'] (up to 4)
     walk       [x, y] of a tripwire square; adds the "Walk into the tripwire" button
     steps      the "How it works" walkthrough: { title, text, badge: [x, y], cells: [[x, y], ...] }
                badge = where the blue step number sits, cells = the squares that light up
     speedCell  [x, y] of the repeater whose delay sets the speed; speeds = [[delay, 'time'], ...]
     tips       extra hints shown at the bottom of the concept card

   Smallest possible concept:
     {
       id: 'my-build',              // unique, no spaces
       title: 'My build',
       short: 'One line for the library list.',
       blurb: 'A sentence or two explaining what it does.',
       cells: [['lever', 2, 2, 'floor', 'off'], ['dust', 3, 2], ['lamp', 4, 2]],
     },
*/
const CONCEPTS = [
  {
    id: 'tripwire-clock',
    title: 'Tripwire-switched clock',
    short: 'Blinks only while someone stands in the tripwire, and stops in the off state when they leave.',
    blurb: 'Nothing happens until someone walks into the string. While they stand in it, the lamp blinks on and off. The moment they leave it stops, and it always stops in the OFF position.',
    tryIt: 'You can also click any piece of string on the grid. Click it again to step out.',
    walk: [12, 6],
    speedCell: [12, 9],
    cells: [
      ['block', 8, 6], ['tripwire_hook', 9, 6, 'E'],
      ['tripwire', 10, 6], ['tripwire', 11, 6], ['tripwire', 12, 6], ['tripwire', 13, 6], ['tripwire', 14, 6], ['tripwire', 15, 6],
      ['tripwire_hook', 16, 6, 'W'], ['block', 17, 6],
      ['dust', 9, 7], ['dust', 9, 8], ['dust', 9, 9], ['dust', 9, 10], ['dust', 10, 10], ['dust', 11, 10],
      ['comparator', 12, 10, 'E', 'subtract'],
      ['repeater', 12, 9, 'S', 4],
      ['dust', 13, 10], ['dust', 13, 9], ['dust', 13, 8], ['dust', 12, 8],
      ['dust', 14, 10], ['dust', 15, 10], ['dust', 16, 10], ['lamp', 17, 10],
    ],
    probes: [[12, 6, 'Tripwire'], [12, 10, 'Comparator (clock)'], [17, 10, 'Lamp']],
    steps: [
      { title: 'Someone walks into the string.', text: 'Both hooks switch on and send a steady signal down the red wire.', badge: [10, 6],
        cells: [[9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6], [15, 6], [16, 6]] },
      { title: 'It hits the comparator’s back at 10.', text: '(Each dust square loses 1.) The comparator is in subtract mode, so it outputs back − side = 10 − 0 = 10.', badge: [9, 9],
        cells: [[9, 7], [9, 8], [9, 9], [9, 10], [10, 10], [11, 10], [12, 10]] },
      { title: 'The output runs around the loop', text: 'into the back of the repeater, which points down into the comparator’s side.', badge: [13, 9],
        cells: [[12, 10], [13, 10], [13, 9], [13, 8], [12, 8], [12, 9]] },
      { title: 'The repeater cancels it.', text: 'After its delay it fires 15 into the side. 10 − 15 is below zero, so the output drops to 0.', badge: [12, 9],
        cells: [[12, 9], [12, 10]] },
      { title: 'The loop resets and repeats.', text: 'Loop goes dark → repeater turns off → side drops to 0 → comparator turns back on. That flip, over and over, is the clock.', badge: [13, 8],
        cells: [[12, 10], [13, 10], [13, 9], [13, 8], [12, 8], [12, 9]] },
      { title: 'Each pulse reaches the lamp.', text: 'Swap the lamp for dispensers, pistons or whatever you want to run.', badge: [16, 10],
        cells: [[14, 10], [15, 10], [16, 10], [17, 10]] },
      { title: 'Step out and it stops OFF.', text: 'Back 0 means output 0, whatever the side does. The string re-checks every 0.5 s, so it stops within half a second.', badge: [12, 10],
        cells: [[12, 10], [12, 6]] },
    ],
    speedNote: 'How long one blink takes depends on the repeater’s delay. Click the repeater to change it.',
    speeds: [['1', '0.4 s'], ['2', '0.6 s'], ['3', '0.8 s'], ['4', '1.0 s']],
    tips: [
      'At delay 1 the lamp looks solid: a lamp stays lit 0.2 s after losing power. The timeline shows the real pulses.',
      'Slower: swap the middle dust on the loop’s right side for a repeater pointing up. Two repeaters on delay 4 = one blink every 1.8 s.',
      'Long wire from the tripwire? The comparator needs at least 4 at its back here, so add a repeater if the wire runs past 12 squares.',
    ],
  },
  {
    id: 'blank',
    title: 'Blank grid',
    short: 'An empty 24 × 16 grid for your own build.',
    blurb: 'An empty grid. Pick parts on the left and build. The panel at the top explains whatever you point at, and “Track on timeline” graphs any part over time.',
    cells: [], probes: [], steps: [],
  },
  {
    id: 'custom',
    hidden: true,
    title: 'Your layout',
    short: '',
    blurb: 'Loaded from a layout code. Point at any part to see what it is doing.',
    cells: [], probes: [], steps: [],
  },
];

// Marks this file as fully loaded (if it is missing, index.html shows which file has a mistake).
if (window.__rlLoaded) window.__rlLoaded.push('concepts.js');
