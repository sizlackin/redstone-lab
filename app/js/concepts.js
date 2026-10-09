/* ================= Concepts =================
   Every entry in this list shows up in the app's "Concept library" (except ones marked hidden).
   This is the file to edit when you add a new build. Save it on GitHub and the app picks it up
   the next time it opens.

   The grid is 24 squares wide (x = 0 to 23, left to right) and 16 tall (y = 0 to 15, top to bottom).

   cells: one entry per part: [part, x, y, facing, extra]
     part    block, glass, redstone_block, dust, torch, repeater, comparator, observer, piston,
             sticky_piston, lever, stone_button, wood_button, pressure_plate, tripwire_hook,
             tripwire, lamp, dispenser, copper_bulb, chest, hopper, dropper
     facing  'N', 'E', 'S' or 'W' (up, right, down, left).
             Repeaters, comparators, observers, pistons, dispensers: the way the part points.
             Torches, levers, buttons: 'floor', or the way they point away from the wall they hang on.
             Tripwire hooks: the way they point toward the string (the block they hang on is behind them).
     extra   repeater: delay 1 to 4 · comparator: 'compare' or 'subtract' · lever: 'on' or 'off'
             · dust: 'dot' (a single dot that doesn't connect)
             · chest, hopper, dropper: what's inside, one entry per slot, e.g. [['diamond', 18], ['filler', 1]]
               Items: diamond, dirt, golden_apple, token (renamed paper), filler (renamed stick).
               Chests have no facing: use '' (e.g. ['chest', 4, 2, '', [['diamond', 5]]]).
               Hoppers push into the container their arrow points at and take from the one behind them.

   Optional extras for a concept (see the tripwire clock below for a full example):
     probes     parts drawn on the timeline: [x, y, 'Label'] (up to 4)
     walk       [x, y] of a tripwire square; adds the "Walk into the tripwire" button
     steps      the "How it works" walkthrough: { title, text, badge: [x, y], cells: [[x, y], ...] }
                badge = where the blue step number sits, cells = the squares that light up
     speedCell  [x, y] of the repeater whose delay sets the speed; speeds = [[delay, 'time'], ...]
     tips       extra hints shown at the bottom of the concept card
     shop       adds Pay buttons, a price control and sales numbers to the card:
                { pay: coin slot [x, y], price: counter dropper [x, y], payout: dropper [x, y],
                  bank: chest [x, y], stock: chest [x, y] } (see the diamond shop below)

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
    id: 'diamond-shop',
    title: 'Diamond shop',
    short: 'Customers pay diamonds into a hopper and get a golden apple. Only diamonds count, and you set the price.',
    blurb: 'A vending machine. Customers drop diamonds into the coin slot. Once they’ve paid the price, the payout dropper hands out one golden apple from the hidden stock chest, and the diamonds go into your bank chest. Paying with anything else does nothing.',
    // The shop panel on the concept card: coin slot, counter dropper (price), payout dropper, bank and stock chests.
    shop: { pay: [6, 5], price: [13, 9], payout: [16, 8], bank: [7, 3], stock: [16, 6] },
    cells: [
      // Payment: coin slot -> diamond filter -> gate -> bank
      ['hopper', 6, 5, 'N'],                    // coin slot (points at nothing, so it never pushes)
      ['hopper', 7, 5, 'E', [['diamond', 18], ['filler', 1], ['filler', 1], ['filler', 1], ['filler', 1]]], // filter
      ['hopper', 7, 4, 'N'],                    // gate: takes from the filter, puts into the bank
      ['chest', 7, 3, ''],                      // bank
      ['comparator', 7, 6, 'S'],                // reads the filter: 1 normally, 2 with a new diamond
      ['dust', 7, 7], ['dust', 7, 8],           // a signal of 2 reaches the block, 1 doesn't
      ['block', 7, 9],
      ['torch', 6, 9, 'W'],                     // keeps the gate locked until a diamond arrives
      ['dust', 5, 9], ['dust', 5, 8], ['dust', 5, 7], ['dust', 5, 6], ['dust', 5, 5], ['dust', 5, 4], ['dust', 6, 4],
      ['repeater', 8, 9, 'E', 1],               // one clean pulse per diamond
      ['dust', 9, 9], ['dust', 10, 9], ['dust', 11, 9], ['dust', 12, 9],
      // Each diamond also locks the filter for about half a second, so the counter keeps up
      ['repeater', 9, 8, 'N', 1], ['repeater', 10, 8, 'N', 2], ['repeater', 11, 8, 'N', 3],
      ['dust', 9, 7], ['dust', 10, 7], ['dust', 11, 7], ['dust', 9, 6], ['dust', 10, 6], ['dust', 11, 6],
      // Counter: one token per diamond of the price. Empty counter dropper = paid in full.
      ['dropper', 13, 9, 'S', [['token', 3]]],
      ['hopper', 13, 10, 'N'],                  // collects the tokens, sends them back when unlocked
      ['comparator', 14, 9, 'E'], ['block', 15, 9], ['torch', 16, 9, 'E'],   // lit when the counter is empty
      ['comparator', 14, 10, 'E'], ['block', 15, 10], ['torch', 16, 10, 'E'], // lit when the token hopper is empty
      ['dust', 17, 9], ['dust', 17, 10], ['dust', 18, 9],
      ['copper_bulb', 19, 9],                   // on while the counter resets
      ['comparator', 19, 10, 'S'], ['dust', 19, 11], ['dust', 19, 12],
      ['dust', 18, 12], ['dust', 17, 12], ['dust', 16, 12], ['dust', 15, 12], ['dust', 14, 12],
      ['block', 13, 12], ['torch', 13, 11, 'N'], // keeps the token hopper locked except during a reset
      ['comparator', 19, 8, 'N'], ['dust', 19, 7], ['dust', 19, 6], ['dust', 19, 5],
      ['dust', 18, 5], ['dust', 17, 5], ['dust', 16, 5], ['dust', 15, 5], ['dust', 14, 5], ['dust', 13, 5],
      ['dust', 12, 5], ['dust', 11, 5], ['dust', 10, 5], ['dust', 9, 5], ['dust', 8, 5], // locks the filter during a reset
      // Payout: stock chest -> hopper -> payout dropper, which drops out of its east side
      ['chest', 16, 6, '', [['golden_apple', 64], ['golden_apple', 64]]],
      ['hopper', 16, 7, 'S'],
      ['dropper', 16, 8, 'E', [['golden_apple', 8]]],
    ],
    probes: [[8, 9, 'Diamond pulses'], [16, 9, 'Paid in full'], [19, 9, 'Counter reset']],
    steps: [
      { title: 'Pay into the coin slot.', text: 'This hopper is the only part customers can reach. Diamonds wait here until the filter takes them. Anything that isn’t a diamond just stays in the slot.', badge: [6, 5],
        cells: [[6, 5]] },
      { title: 'The filter only takes diamonds.', text: 'It holds 18 diamonds plus a renamed stick in each of its other 4 slots, so every slot is taken and only another diamond fits. It pulls them one at a time from the coin slot behind it.', badge: [7, 5],
        cells: [[6, 5], [7, 5]] },
      { title: 'A new diamond tips the comparator.', text: 'With 18 diamonds the comparator reads 1, which dies out before the block. A 19th diamond makes it read 2: just enough to power the block. That switches the torch off and unlocks the gate hopper, which takes the extra diamond to the bank. Then everything locks again.', badge: [7, 7],
        cells: [[7, 5], [7, 6], [7, 7], [7, 8], [7, 9], [6, 9], [5, 9], [5, 8], [5, 7], [5, 6], [5, 5], [5, 4], [6, 4], [7, 4], [7, 3]] },
      { title: 'Each diamond sends one pulse.', text: 'The powered block also feeds a repeater, so every diamond becomes one clean pulse to the counter. The same pulse locks the filter for half a second, so the counter keeps up even when someone pays a whole stack at once.', badge: [8, 9],
        cells: [[7, 9], [8, 9], [9, 9], [10, 9], [11, 9], [12, 9], [9, 8], [10, 8], [11, 8], [9, 7], [10, 7], [11, 7], [9, 6], [10, 6], [11, 6], [8, 5], [9, 5], [10, 5], [11, 5], [7, 5]] },
      { title: 'The counter counts up to the price.', text: 'The counter dropper holds one token (renamed paper) for each diamond of the price. Each pulse makes it drop one token into the hopper below it. When the dropper is empty, the customer has paid in full.', badge: [13, 9],
        cells: [[12, 9], [13, 9], [13, 10], [14, 9], [15, 9], [16, 9]] },
      { title: 'Paid! The payout dropper fires.', text: 'With the counter empty, its comparator switches off, so this torch lights and powers the payout dropper. It drops one golden apple out in front of the shop. A hopper keeps it topped up from the stock chest.', badge: [16, 8],
        cells: [[14, 9], [15, 9], [16, 9], [16, 8], [16, 7], [16, 6], [17, 8]] },
      { title: 'The counter resets.', text: 'That torch also switches the copper bulb on. While the bulb is on, the token hopper unlocks and sends the tokens back up, and the filter stays locked so no payment gets lost. When the token hopper is empty, its torch lights and switches the bulb off: ready for the next customer.', badge: [19, 9],
        cells: [[16, 9], [17, 9], [18, 9], [19, 9], [14, 10], [15, 10], [16, 10], [17, 10], [19, 10], [19, 11], [19, 12], [18, 12], [17, 12], [16, 12], [15, 12], [14, 12], [13, 12], [13, 11], [13, 10], [13, 9],
          [19, 8], [19, 7], [19, 6], [19, 5], [18, 5], [17, 5], [16, 5], [15, 5], [14, 5], [13, 5], [12, 5], [11, 5], [10, 5], [9, 5], [8, 5], [7, 5]] },
    ],
    tips: [
      'The − and + buttons change the price by taking tokens out of the counter dropper or putting more in. A price of 1 doesn’t need a counter at all: run the pulse line straight to the payout dropper.',
      'Paying more than the price is fine. The extra diamonds count toward the next golden apple.',
      'In the game, hoppers take items from the block above them, so the filter goes under the coin slot and the gate under the filter. Seen from above like here, a hopper takes items from the container behind its arrow.',
      'Rename the tokens and filler sticks in an anvil. Then they can never stack with anything a customer puts in.',
      'Anyone who can break blocks can get into the machine. On a server, protect it with a land claim.',
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
