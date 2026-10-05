# Beamline

A twenty-level puzzle about routing coloured light. Place mirrors and splitters
so every sensor receives exactly the colour it asks for, using no more pieces
than you are given.

[![CI](https://github.com/gplonisch/beamline/actions/workflows/ci.yml/badge.svg)](https://github.com/gplonisch/beamline/actions/workflows/ci.yml)
![Runtime dependencies](https://img.shields.io/badge/runtime%20dependencies-0-green)
![License](https://img.shields.io/badge/license-MIT-green)

**[Play it](https://gplonisch.github.io/beamline/)**

No build step, no framework, no account and no analytics. Open the folder in any
static server and it runs.

## What I found

The first version passed 64 engine tests and drew every beam in the wrong
place. The canvas that draws the light was never given a size, so the browser
left it at its default 300 by 150 pixels and every beam was squeezed into the
top-left corner of the board. The engine was right the whole time, which is
exactly why the engine tests could not see it. A test suite that only checks
the model will pass while the thing a player looks at is broken.

The fix was small. The lesson changed how the project is tested, and there is
now a browser suite that reads pixels off the canvas and checks that light is
drawn on the cells the engine says it reaches and nowhere else. I put the bug
back on purpose to confirm those tests fail without the fix.

The second finding came from the solver. The original solver tried every piece
on every empty cell, which took about twelve seconds for a five-piece level and
capped how hard a level could be. Searching only the cells that light actually
reaches finds the same answers in well under a second, and the argument for why
it is still exhaustive is short (below). That speed-up is what made the second
chapter possible, with levels that need six pieces and have exactly one
solution.

## The rules

Light leaves a lamp in a fixed direction and travels until something changes
it. Mirrors turn it ninety degrees, splitters pass it on and send a copy
clockwise, and filters keep only the colours they are made of. Gold pieces are
bolted down and cannot be moved.

Colour is an additive bitmask, the way light actually mixes, so red and green
arriving at the same sensor make yellow and all three make white. A sensor
wanting green is not satisfied by red and green together, and over-lighting is
as wrong as under-lighting. A dark sensor, introduced in chapter two, is
satisfied only while no light reaches it.

Every budget is exactly the size of the optimal solution, so there is no
stumbling into a win.

## How it is built

The engine is pure. `js/engine.js` has no DOM, no canvas and no globals. The
game state is a plain object and `simulate()` is a pure function of it, which
is why the engine, level and solver tests run in Node with nothing beyond
`node --test`.

Termination is designed in. Four mirrors in a ring send a beam around forever.
Beams are identified by (x, y, direction, colour), of which there are at most
width × height × 4 × 8, so a loop revisits a state and stops. There is a test
that builds the ring and asserts the simulation returns.

The board is DOM and the light is canvas. Each buildable cell is a real
`<button>` inside an ARIA grid, and the optics are drawn on a canvas layered
over it with pointer events off. A canvas-only board is invisible to a screen
reader and unreachable by keyboard, so focus, labels and activation come from
the platform here, and every cell's accessible name is generated from the same
state the canvas draws.

Geometry comes from the cells. The renderer measures where each cell element
actually is and draws there, instead of dividing the board size by the grid
size, so borders, gaps and rounding cannot put light in a different place from
the cell it belongs to.

Light is drawn with additive blending, so where a red beam and a green beam
overlap on screen they really do look yellow. The rule the game scores is the
same rule the screen shows.

## The solver

`scripts/solver.mjs` walks the light instead of the board. It simulates the
current position, finds the first cell a beam enters that has not been decided
yet, and branches on what goes there: nothing, either mirror, or a splitter. A
cell is never reconsidered once decided, so every distinct solution is reached
exactly once and nothing has to be remembered between branches.

Why that loses nothing: take any solution and follow the branch that agrees
with it at every decided cell. When no undecided cell is left on any beam, every
cell the light touches matches the solution, and the cells it does not touch
cannot affect a beam, so that branch is solved too. A "no solution" result is
therefore a proof, and because the piece count is capped, "minimum 5" proves
there is no way to finish in 4. The old brute-force solver is kept, and a test
checks the two agree on every level small enough to brute-force.

One prune keeps it fast. Colour that reaches a sensor along a path made only of
decided cells is permanent, so a sensor already holding a colour it does not
want ends that branch.

```
level  1  Straight through     minimum 0, budget 0, 1 solution(s) at minimum
level 14  Stray light          minimum 4, budget 4, 1 solution(s) at minimum
level 18  Prism                minimum 6, budget 6, 4 solution(s) at minimum
level 20  Spectrum             minimum 6, budget 6, 1 solution(s) at minimum
...
20/20 solvable with an exact budget
```

## The level generator

Chapter two was drafted with `scripts/generate.mjs`. A concept fixes what a
level is about (the lamps, filters, sensors and any bolted pieces), and the
generator scatters walls over the rest, asks the solver for the minimum and how
many distinct solutions reach it, and keeps boards that are hard and tight. It
is seeded, so the same concept always gives the same boards. It works well for
puzzles about routing and badly for puzzles that need light split and merged
again, where the open boards it produces have dozens of answers. Those levels
(Recombine, Prism and the last two) were designed by hand and checked with the
solver.

## What CI proves

- Engine, level and solver tests: reflection tables, splitter geometry, colour
  arithmetic, filters, dark sensors, budget enforcement, loop termination, and
  agreement between the fast and brute-force solvers.
- Every shipped level is solved by its stored solution, needs its whole budget,
  and does not start already solved.
- Exhaustive solvability: `node scripts/solve.mjs` proves every level can be
  finished and that its budget is the true minimum.
- Browser tests in Chromium: light is drawn on the right pixels, mirrors
  redirect it on screen, solving records progress, showing the solution does
  not, undo and the budget work, the board is playable from the keyboard, the
  page loads with no errors and no requests to any other server, and there is
  no horizontal scroll on a phone.
- An automated WCAG 2.1 AA check with axe-core in both the light and dark
  themes.

The deploy job only runs if all of that passes, and it publishes only the files
the game serves.

## Accessibility

- Fully keyboard playable. The board is one tab stop and the arrow keys move
  inside it. Enter cycles a piece, 1, 2 and 3 place one directly, Delete removes
  one, Z undoes, R clears, and N and P change level.
- Every cell has a generated accessible name that says what it holds, and for a
  sensor, what it wants and what it is currently receiving. A polite live region
  says what changed after each move.
- Colour codes. Lamps, filters and sensors carry a letter (R, G, B, Y, C, M, W,
  and D for dark), on by default, so a colour puzzle never depends on telling
  colours apart. Solved and seen levels differ by border weight and style, not
  colour alone.
- Honours `prefers-reduced-motion`: the shimmer on the light and the breathing
  of satisfied sensors stop, and nothing else moves.
- Text meets WCAG AA contrast in both themes, checked by hand from the palette
  and by axe-core in CI.

## Privacy

There are no cookies, no analytics, and no requests to anyone else's servers.
The typeface is self-hosted. Progress (which levels are solved, which solutions
were shown, and any boards in progress) is kept in `localStorage` in your
browser and never sent anywhere. Every storage access is wrapped, so the game
runs normally in a private window or with site data blocked; it just forgets.
There is a button at the bottom of the page to forget it on purpose.

## Running it

```bash
git clone https://github.com/gplonisch/beamline
cd beamline
python3 -m http.server 8000      # any static server; ES modules need http, not file://

node --test tests/*.test.mjs     # engine, levels and solver
node scripts/solve.mjs           # exhaustive solvability, about a minute

npm ci && npx playwright install chromium
npx playwright test              # browser tests
```

## Adding a level

Add an entry to `js/levels.js`, run `node scripts/solve.mjs --print` to find
the minimum piece count and a solution, set `budget` to that number and paste
the solution in. The tests then hold you to it.

```js
{
  id: 21,
  name: "Your level",
  hint: "One sentence, shown in the panel.",
  grid: [
    "E..#...",
    "...F..T",
  ],
  emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
  filters:  [{ x: 3, y: 1, color: R }],
  targets:  [{ x: 6, y: 1, want: R }],   // want: 0 makes a dark sensor
  budget: 2,
  solution: [ /* from scripts/solve.mjs --print */ ],
}
```

## Limitations

- The solver is fast on boards where walls constrain the light and slow on open
  ones. The final level takes about half a minute to prove, almost all of it
  spent ruling out alternatives on its long open rows, and a ten-piece level I
  tried did not finish in three minutes. A SAT encoding would be the next step
  before a third chapter.
- Uniqueness is reported, not required. Several levels have two to six minimal
  solutions, and the early ones have more. That is a design choice for a gentle
  first chapter, but it means some levels are easier than their budget suggests.
- The interface has been checked with axe-core and built against the ARIA grid
  pattern, but it has not been tested with a real screen reader user. That is
  the gap I would close first.
- There is no sound.

## License

Code is MIT. The Libre Caslon Text and Libre Caslon Display typefaces in
`fonts/` are under the SIL Open Font License, included alongside them.
