# Beamline

A twelve-level puzzle about routing coloured light. Place mirrors and splitters
so every target receives exactly the colour it asks for, using no more pieces
than you are given.

[![CI](https://github.com/gplonisch/beamline/actions/workflows/ci.yml/badge.svg)](https://github.com/gplonisch/beamline/actions/workflows/ci.yml)
![Dependencies](https://img.shields.io/badge/dependencies-0-green)
![License](https://img.shields.io/badge/license-MIT-green)

**[Play it](https://gplonisch.github.io/beamline/)**

No build step, no framework, no account, no analytics. Open the folder in a
static server and it runs.

## The rules

Light leaves a lamp in a fixed direction and travels until something changes
it. Mirrors turn it ninety degrees, splitters pass it on and send a copy
clockwise, and filters keep only the colours they are made of.

Colour is an additive bitmask, the way light actually mixes: red and green
arriving at the same target make yellow, and all three make white. A target
wanting green is **not** satisfied by receiving red and green. Over-lighting is
as wrong as under-lighting, which is what makes filters interesting.

Every budget is exactly the size of the optimal solution, so there is no
stumbling into a win.

## How it is built

**The engine is pure.** `js/engine.js` has no DOM, no canvas, and no globals.
The whole game state is a plain object and `simulate()` is a pure function of
it. That is why the 64 tests run in Node with no browser and no test framework
beyond `node --test`, and why CI can prove things about the levels rather than
just checking that the page loads.

**Termination is designed in, not hoped for.** Four mirrors in a ring send a
beam around forever. Beams are identified by `(x, y, direction, colour)`, of
which there are at most `width × height × 4 × 8`, so a loop revisits a state and
stops. There is a test that builds the ring and asserts the simulation returns.

**The board is DOM, the light is canvas.** Each cell is a real `<button>` or
`<div>`, and the beams are drawn on a canvas layered over it with pointer events
off. A canvas-only board is invisible to a screen reader and unreachable by
keyboard, and the usual patch is a hidden parallel description that drifts out
of sync with what is drawn. Here focus, labels, and activation come from the
platform, the canvas only ever draws decoration, and the accessible name of a
cell is generated from the same state the renderer uses.

## What CI proves

- **64 engine tests.** Reflection tables, splitter geometry, colour arithmetic,
  filter absorption, budget enforcement, piece cycling, loop termination.
- **Every shipped level is solved by its stored solution.** An engine change
  that breaks an old level fails the build instead of stranding a player.
- **Every budget is exact.** A level whose solution uses fewer pieces than its
  budget fails the build, because slack lets a player win by accident.
- **No level starts already solved.** Caught two real ones: an early filter
  level and a three-lamp level both completed themselves on load, because the
  emitters already pointed at their targets. Both were redesigned.
- **Exhaustive solvability.** `scripts/solve.mjs` searches every placement of
  up to `budget` pieces. It is exhaustive, so a failure is proof a level cannot
  be finished, not evidence that the search gave up. It is the authoring tool,
  and it is also how the budgets were set.

```
level  1  Straight through   minimum 0 piece(s), budget 0
level  2  First turn         minimum 2 piece(s), budget 2
level  3  Around the block   minimum 3 piece(s), budget 3
...
12/12 solvable within budget
```

The solver is exponential in the budget and already takes about twelve seconds
at five pieces, which turned out to be a useful design constraint: every level
here has an optimal solution of four pieces or fewer, and the ones that did not
were worse puzzles anyway.

## Accessibility

- Fully keyboard playable. Arrow keys move around the grid rather than tabbing
  through every cell, Enter cycles a piece, R clears, N and P change level.
- Every cell has a generated accessible name that says what it holds, and for a
  target, what colour it wants and what it is currently receiving.
- A polite live region announces what changed after each move, including which
  targets are still unlit and why.
- Target state is a filled ring plus the word "Complete" in the label. Level
  progress is a border weight change plus text. Nothing depends on colour alone,
  which matters in a game about colour.
- Honours `prefers-reduced-motion`, and the page chrome follows the light or
  dark system preference. The board stays dark in both, because coloured light
  only reads against a dark ground.
- Passes the 35-check linter from
  [static-studio](https://github.com/gplonisch/static-studio), the sibling repo
  that enforces contrast, alt text, heading order and label association.

## Privacy

There are no cookies, no analytics, and no network requests after the page
loads. Progress is a list of completed level numbers in `localStorage`, stored
in your browser and never sent anywhere. Every storage access is wrapped, so the
game runs normally in a private window or with site data blocked; it just
forgets.

## Running it

```bash
git clone https://github.com/gplonisch/beamline
cd beamline
python3 -m http.server 8000     # any static server; ES modules need http, not file://

node --test tests/*.test.mjs    # 64 tests
node scripts/solve.mjs          # exhaustive solvability
```

## Adding a level

Add an entry to `js/levels.js`, run `node scripts/solve.mjs` to find the minimum
piece count, set `budget` to that number, and paste the solution in. The tests
will then hold you to it.

```js
{
  id: 13,
  name: "Your level",
  hint: "One sentence, shown in the panel.",
  grid: [
    "E..#...",
    "...F..T",
  ],
  emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
  filters:  [{ x: 3, y: 1, color: R }],
  targets:  [{ x: 6, y: 1, want: R }],
  budget: 2,
  solution: [ /* from scripts/solve.mjs */ ],
}
```

## Limitations

- The solver cannot practically verify budgets above about five pieces, which
  caps how elaborate a level can be. A SAT encoding or beam-path search would
  lift that, and would be the right next step before adding a second chapter.
- There is no undo. Clearing the board is cheap enough at these sizes that it
  has not been missed, but it would be the first thing to add.
- The engine has been tested but the interface has not been tested with a real
  screen reader, only built against the specification. That is a gap, and the
  next thing I would fix.

## License

MIT.
