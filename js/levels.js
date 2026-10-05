/**
 * Levels, as declarative data.
 *
 * Each level is ASCII plus a list of the cells that carry data. `budget` and
 * `solution` come from scripts/solve.mjs, which proves the budget is the
 * minimum; CI re-checks both on every push, so a level can never ship
 * unsolvable, with slack, or broken by an engine change.
 *
 *   .  empty, the player may build here      #  wall
 *   E  lamp         T  sensor          F  filter
 *   /  \  fixed mirror (not removable)       S  fixed splitter
 *
 * A sensor with `want: 0` is a dark sensor: it is satisfied only while no
 * light reaches it.
 *
 * Chapter two was drafted with scripts/generate.mjs and edited by hand.
 */

import { B, G, R, RIGHT, WHITE } from "./engine.js";

export const CHAPTERS = [
  { name: "The bench", first: 1, last: 12 },
  { name: "The darkroom", first: 13, last: 20 },
];

export const LEVELS = [
  /* ---------------- Chapter one: the bench ---------------- */
  {
    id: 1,
    name: "Straight through",
    hint: "Light leaves the lamp and travels until something stops it. This one needs nothing from you.",
    grid: [
      ".......",
      "E.....T",
      ".......",
    ],
    emitters: [{ x: 0, y: 1, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 1, want: WHITE }],
    budget: 0,
    solution: [],
  },
  {
    id: 2,
    name: "First turn",
    hint: "A mirror sends light around a corner. Click a cell to place one, and click again to turn it.",
    grid: [
      "E.....#",
      ".......",
      "......T",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: G | B }],
    targets: [{ x: 6, y: 2, want: G | B }],
    budget: 2,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":2,"piece":"\\"}],
  },
  {
    id: 3,
    name: "Around the block",
    hint: "Three mirrors, and a wall in the way.",
    grid: [
      "E..#...",
      "...#...",
      "...#..T",
      ".......",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 2, want: WHITE }],
    budget: 3,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":3,"piece":"\\"},{"x":6,"y":3,"piece":"/"}],
  },
  {
    id: 4,
    name: "Fixed mirror",
    hint: "The gold mirror is bolted down. Work with it.",
    grid: [
      "E....\\..",
      "........",
      "........",
      "..T.....",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: R | G }],
    targets: [{ x: 2, y: 3, want: R | G }],
    budget: 1,
    solution: [{"x":2,"y":0,"piece":"\\"}],
  },
  {
    id: 5,
    name: "The long way",
    hint: "The direct route is walled off at both ends.",
    grid: [
      "E..#....",
      "...#....",
      "...#.##.",
      ".....#T.",
      "........",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: R | B }],
    targets: [{ x: 6, y: 3, want: R | B }],
    budget: 3,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":4,"piece":"\\"},{"x":6,"y":4,"piece":"/"}],
  },
  {
    id: 6,
    name: "Two ways at once",
    hint: "A splitter passes light straight on and sends a copy clockwise. Click a mirror twice more to get one.",
    grid: [
      "E......",
      ".......",
      "......T",
      ".......",
      "T......",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 2, want: WHITE }, { x: 0, y: 4, want: WHITE }],
    budget: 3,
    solution: [{"x":1,"y":0,"piece":"S"},{"x":6,"y":0,"piece":"\\"},{"x":1,"y":4,"piece":"/"}],
  },
  {
    id: 7,
    name: "Red only",
    hint: "A filter keeps the colours it is made of and absorbs the rest.",
    grid: [
      "E..#...",
      "...F..T",
      ".......",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    filters: [{ x: 3, y: 1, color: R }],
    targets: [{ x: 6, y: 1, want: R }],
    budget: 2,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":1,"piece":"\\"}],
  },
  {
    id: 8,
    name: "Two lamps",
    hint: "Two lamps, two sensors, and a wall between them.",
    grid: [
      "E.....",
      "..##..",
      "..##..",
      "E....T",
      ".....T",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 3, dir: RIGHT, color: B },
    ],
    targets: [{ x: 5, y: 3, want: B }, { x: 5, y: 4, want: R }],
    budget: 2,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":4,"piece":"\\"}],
  },
  {
    id: 9,
    name: "Mixing yellow",
    hint: "Red and green arriving at the same sensor make yellow.",
    grid: [
      "E......",
      ".......",
      "......T",
      ".......",
      "E......",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 4, dir: RIGHT, color: G },
    ],
    targets: [{ x: 6, y: 2, want: R | G }],
    budget: 2,
    solution: [{"x":6,"y":0,"piece":"\\"},{"x":6,"y":4,"piece":"/"}],
  },
  {
    id: 10,
    name: "White again",
    hint: "Three colours, one sensor, and it wants all of them.",
    grid: [
      "E.........",
      "..........",
      "E........T",
      "..........",
      "E.........",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 2, dir: RIGHT, color: G },
      { x: 0, y: 4, dir: RIGHT, color: B },
    ],
    targets: [{ x: 9, y: 2, want: WHITE }],
    budget: 2,
    solution: [{"x":9,"y":0,"piece":"\\"},{"x":9,"y":4,"piece":"/"}],
  },
  {
    id: 11,
    name: "Split and filter",
    hint: "One white lamp has to feed a red sensor and a blue one.",
    grid: [
      "E........",
      "....F...T",
      ".........",
      "....F...T",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    filters: [
      { x: 4, y: 1, color: R },
      { x: 4, y: 3, color: B },
    ],
    targets: [{ x: 8, y: 1, want: R }, { x: 8, y: 3, want: B }],
    budget: 4,
    solution: [{"x":1,"y":0,"piece":"S"},{"x":2,"y":0,"piece":"\\"},{"x":1,"y":1,"piece":"\\"},{"x":2,"y":3,"piece":"\\"}],
  },
  {
    id: 12,
    name: "Keep them apart",
    hint: "Two colours, two sensors, and neither may pick up the other.",
    grid: [
      "E..#...",
      ".......",
      "...#..T",
      "E......",
      "......T",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 3, dir: RIGHT, color: B },
    ],
    targets: [{ x: 6, y: 2, want: R }, { x: 6, y: 4, want: B }],
    budget: 4,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":1,"piece":"\\"},{"x":6,"y":1,"piece":"\\"},{"x":6,"y":3,"piece":"\\"}],
  },

  /* ---------------- Chapter two: the darkroom ---------------- */
  {
    id: 13,
    name: "Darkroom",
    hint: "A dashed sensor wants darkness. It is satisfied only while no light reaches it.",
    grid: [
      "E.....T",
      ".......",
      "...#...",
      "......T",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 0, want: 0 }, { x: 6, y: 3, want: WHITE }],
    budget: 2,
    solution: [{"x":5,"y":0,"piece":"\\"},{"x":5,"y":3,"piece":"\\"}],
  },
  {
    id: 14,
    name: "Stray light",
    hint: "The bolted splitter throws a copy straight down at the dark sensor.",
    grid: [
      "..#.....",
      "E..S#..T",
      "........",
      ".......#",
      "..#..#.T",
      "...T..##",
    ],
    emitters: [{ x: 0, y: 1, dir: RIGHT, color: WHITE }],
    targets: [{ x: 7, y: 1, want: WHITE }, { x: 3, y: 5, want: 0 }, { x: 7, y: 4, want: WHITE }],
    budget: 4,
    solution: [{"x":3,"y":2,"piece":"\\"},{"x":6,"y":2,"piece":"S"},{"x":6,"y":4,"piece":"\\"},{"x":7,"y":2,"piece":"/"}],
  },
  {
    id: 15,
    name: "Recombine",
    hint: "There is no yellow filter. Make yellow out of its parts.",
    grid: [
      "E......#",
      "##.##.##",
      "##F##F##",
      "##.##.##",
      "##.....#",
      "#####.T#",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    filters: [{ x: 2, y: 2, color: G }, { x: 5, y: 2, color: R }],
    targets: [{ x: 6, y: 5, want: R | G }],
    budget: 5,
    solution: [{"x":2,"y":0,"piece":"S"},{"x":2,"y":4,"piece":"\\"},{"x":6,"y":4,"piece":"\\"},{"x":5,"y":0,"piece":"\\"},{"x":5,"y":5,"piece":"\\"}],
  },
  {
    id: 16,
    name: "Crossing",
    hint: "Each lamp points at the wrong sensor. Light passes straight through light.",
    grid: [
      "E......T",
      "........",
      "...##...",
      "..###..#",
      "#.#.....",
      "E...##.T",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 5, dir: RIGHT, color: B },
    ],
    targets: [{ x: 7, y: 0, want: B }, { x: 7, y: 5, want: R }],
    budget: 5,
    solution: [{"x":1,"y":5,"piece":"/"},{"x":1,"y":1,"piece":"/"},{"x":7,"y":1,"piece":"/"},{"x":6,"y":0,"piece":"\\"},{"x":6,"y":5,"piece":"\\"}],
  },
  {
    id: 17,
    name: "Lights out",
    hint: "Two sensors to feed, one to keep dark, and only one lamp.",
    grid: [
      "#.#.T...",
      "........",
      "E.#....T",
      "....#...",
      "....T...",
    ],
    emitters: [{ x: 0, y: 2, dir: RIGHT, color: WHITE }],
    targets: [{ x: 7, y: 2, want: 0 }, { x: 4, y: 0, want: WHITE }, { x: 4, y: 4, want: WHITE }],
    budget: 5,
    solution: [{"x":1,"y":2,"piece":"/"},{"x":1,"y":1,"piece":"/"},{"x":3,"y":1,"piece":"S"},{"x":3,"y":4,"piece":"\\"},{"x":4,"y":1,"piece":"/"}],
  },
  {
    id: 18,
    name: "Prism",
    hint: "One white lamp, three sensors, three filters.",
    grid: [
      "E..#.....",
      ".#.#.....",
      "...#.F..T",
      "...#.F..T",
      "...#.F..T",
      ".........",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    filters: [{ x: 5, y: 2, color: R }, { x: 5, y: 3, color: G }, { x: 5, y: 4, color: B }],
    targets: [{ x: 8, y: 2, want: R }, { x: 8, y: 3, want: G }, { x: 8, y: 4, want: B }],
    budget: 6,
    solution: [{"x":2,"y":0,"piece":"\\"},{"x":2,"y":5,"piece":"\\"},{"x":4,"y":5,"piece":"/"},{"x":4,"y":4,"piece":"S"},{"x":4,"y":3,"piece":"S"},{"x":4,"y":2,"piece":"/"}],
  },
  {
    id: 19,
    name: "Shared green",
    hint: "Both sensors need green, and there is only one green lamp.",
    grid: [
      "E........",
      "#######.T",
      "E........",
      "#######.T",
      "E........",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 2, dir: RIGHT, color: G },
      { x: 0, y: 4, dir: RIGHT, color: B },
    ],
    targets: [{ x: 8, y: 1, want: R | G }, { x: 8, y: 3, want: G | B }],
    budget: 5,
    solution: [{"x":8,"y":4,"piece":"/"},{"x":7,"y":2,"piece":"S"},{"x":7,"y":3,"piece":"\\"},{"x":8,"y":2,"piece":"/"},{"x":8,"y":0,"piece":"\\"}],
  },
  {
    id: 20,
    name: "Spectrum",
    hint: "The same bench, but the easy corner is now a dark sensor. There is exactly one way through.",
    grid: [
      "E.......T",
      "#######.T",
      "E........",
      "#######.T",
      "E........",
    ],
    emitters: [
      { x: 0, y: 0, dir: RIGHT, color: R },
      { x: 0, y: 2, dir: RIGHT, color: G },
      { x: 0, y: 4, dir: RIGHT, color: B },
    ],
    targets: [{ x: 8, y: 0, want: 0 }, { x: 8, y: 1, want: R | G }, { x: 8, y: 3, want: G | B }],
    budget: 6,
    solution: [{"x":8,"y":4,"piece":"/"},{"x":7,"y":2,"piece":"S"},{"x":7,"y":3,"piece":"\\"},{"x":8,"y":2,"piece":"/"},{"x":7,"y":0,"piece":"\\"},{"x":7,"y":1,"piece":"\\"}],
  },
];
