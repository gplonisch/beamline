/**
 * Levels, as declarative data.
 *
 * Each level is ASCII plus a list of the cells that carry data. `solution` is
 * filled in by scripts/solve.mjs and verified on every CI run, so a level can
 * never ship unsolvable and a change to the engine that breaks an old level
 * fails the build rather than stranding a player.
 *
 *   .  empty, the player may build here      #  wall
 *   E  emitter      T  target      F  filter
 *   /  \  fixed mirror (not removable)       S  fixed splitter
 */

import { B, DOWN, G, LEFT, R, RIGHT, UP, WHITE } from "./engine.js";

export const LEVELS = [
  {
    id: 1,
    name: "Straight through",
    hint: "Light leaves the emitter and travels until something stops it.",
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
    hint: "A mirror sends light around a corner. Click a cell to cycle it.",
    grid: [
      "E.....#",
      ".......",
      "......T",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 2, want: WHITE }],
    budget: 2,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":2,"piece":"\\"}],
  },
  {
    id: 3,
    name: "Around the block",
    hint: "Two mirrors, one obstacle.",
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
    name: "Two ways at once",
    hint: "A splitter passes light straight on and sends a copy clockwise.",
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
    id: 5,
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
    id: 6,
    name: "Two lamps",
    hint: "Two emitters, two targets, and a wall between them.",
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
    id: 7,
    name: "Mixing yellow",
    hint: "Red and green arriving at the same target make yellow.",
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
    id: 8,
    name: "Split and filter",
    hint: "One white lamp has to feed a red target and a blue one.",
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
    id: 9,
    name: "The long way",
    hint: "The direct route is walled off at both ends.",
    grid: [
      "E..#....",
      "...#....",
      "...#.##.",
      ".....#T.",
      "........",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 6, y: 3, want: WHITE }],
    budget: 3,
    solution: [{"x":1,"y":0,"piece":"\\"},{"x":1,"y":4,"piece":"\\"},{"x":6,"y":4,"piece":"/"}],
  },
  {
    id: 10,
    name: "Fixed mirror",
    hint: "The mirror already on the board cannot be moved. Work with it.",
    grid: [
      "E....\\..",
      "........",
      "........",
      "..T.....",
    ],
    emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    targets: [{ x: 2, y: 3, want: WHITE }],
    budget: 1,
    solution: [{"x":2,"y":0,"piece":"\\"}],
  },
  {
    id: 11,
    name: "Keep them apart",
    hint: "Two colours, two targets, and neither may pick up the other.",
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
  {
    id: 12,
    name: "White again",
    hint: "Three colours, one target, and it wants all of them.",
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
];
