/**
 * Beamline simulation.
 *
 * Pure logic. No DOM, no canvas, no globals. The whole game state is a plain
 * object, `simulate` is a pure function of it, and every rule in the game is
 * expressed here. That separation is what makes the engine testable without a
 * browser, and it is why CI can prove that every shipped level is solvable.
 *
 * Coordinates are (x, y) with y increasing downward. Directions are indices
 * into DIRS, ordered so that turning clockwise is `(dir + 1) % 4`.
 */

export const DIRS = [
  { dx: 0, dy: -1, name: "up" },
  { dx: 1, dy: 0, name: "right" },
  { dx: 0, dy: 1, name: "down" },
  { dx: -1, dy: 0, name: "left" },
];

export const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

/** Colours are an additive bitmask, the way light actually mixes. */
export const R = 1, G = 2, B = 4;
export const WHITE = R | G | B;

export const COLOR_NAMES = {
  0: "none", 1: "red", 2: "green", 3: "yellow",
  4: "blue", 5: "magenta", 6: "cyan", 7: "white",
};

/** One-letter codes, so colour is never the only way to read the board. */
export const COLOR_CODES = {
  0: "-", 1: "R", 2: "G", 3: "Y", 4: "B", 5: "M", 6: "C", 7: "W",
};

export const EMPTY = ".";
export const WALL = "#";
export const MIRROR_F = "/";   // reflects right->up
export const MIRROR_B = "\\";  // reflects right->down
export const SPLITTER = "S";   // passes straight and emits one clockwise turn
export const EMITTER = "E";
export const TARGET = "T";
export const FILTER = "F";

/** Reflection tables, indexed by incoming direction. */
const REFLECT_F = { [UP]: RIGHT, [RIGHT]: UP, [DOWN]: LEFT, [LEFT]: DOWN };
const REFLECT_B = { [UP]: LEFT, [LEFT]: UP, [DOWN]: RIGHT, [RIGHT]: DOWN };

/**
 * Build a level from its declarative form.
 *
 * `grid` is an array of strings, one per row. Cells carrying data (emitters,
 * targets, filters) are listed separately rather than encoded into the
 * character, so a level stays readable as ASCII.
 */
export function createLevel(def) {
  const height = def.grid.length;
  const width = def.grid[0].length;
  if (def.grid.some((row) => row.length !== width)) {
    throw new Error(`level ${def.id}: rows are not all ${width} wide`);
  }

  const cells = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push({ type: def.grid[y][x], x, y });
    }
    cells.push(row);
  }

  for (const e of def.emitters ?? []) {
    cells[e.y][e.x] = { type: EMITTER, x: e.x, y: e.y, dir: e.dir, color: e.color };
  }
  for (const t of def.targets ?? []) {
    cells[t.y][t.x] = { type: TARGET, x: t.x, y: t.y, want: t.want };
  }
  for (const f of def.filters ?? []) {
    cells[f.y][f.x] = { type: FILTER, x: f.x, y: f.y, color: f.color };
  }

  return {
    id: def.id,
    name: def.name,
    hint: def.hint ?? null,
    width,
    height,
    cells,
    budget: def.budget,
    placed: new Map(), // "x,y" -> MIRROR_F | MIRROR_B | SPLITTER
  };
}

const key = (x, y) => `${x},${y}`;

/** What occupies a cell, taking player-placed pieces into account. */
export function cellAt(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return null;
  const placed = level.placed.get(key(x, y));
  if (placed) return { type: placed, x, y, placed: true };
  return level.cells[y][x];
}

/** Can the player put a piece here? Only on cells that start empty. */
export function isPlaceable(level, x, y) {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return false;
  return level.cells[y][x].type === EMPTY;
}

export function place(level, x, y, piece) {
  if (!isPlaceable(level, x, y)) return false;
  const existing = level.placed.get(key(x, y));
  if (!existing && level.placed.size >= level.budget) return false;
  level.placed.set(key(x, y), piece);
  return true;
}

export function remove(level, x, y) {
  return level.placed.delete(key(x, y));
}

/** Cycle a cell through mirror, other mirror, splitter, empty. */
export function cycle(level, x, y) {
  if (!isPlaceable(level, x, y)) return false;
  const order = [MIRROR_F, MIRROR_B, SPLITTER];
  const current = level.placed.get(key(x, y));
  if (!current) return place(level, x, y, MIRROR_F);
  const next = order[order.indexOf(current) + 1];
  if (!next) {
    remove(level, x, y);
    return true;
  }
  level.placed.set(key(x, y), next);
  return true;
}

/**
 * Trace every beam and report what reaches each target.
 *
 * Termination is guaranteed by the visited set: a beam is identified by
 * (x, y, direction, colour), of which there are at most width * height * 4 * 8
 * states, so a loop revisits a state and stops. Without that a mirror ring
 * would spin forever, which is the one way a grid light puzzle can hang.
 *
 * `undecided` is for the solver and the game never passes it. It names cells
 * whose contents are still open in a search. A beam that has crossed one is
 * provisional, and colour that reaches a target without crossing one is
 * reported as `settled`: no later choice can take it away, so a target whose
 * settled colour already includes something it does not want is a dead end.
 */
export function simulate(level, { undecided = null } = {}) {
  const { width, height } = level;
  const segments = [];
  // Flat arrays rather than string-keyed sets: the solver calls this hundreds
  // of thousands of times, and it is the whole cost of a search.
  const visited = new Uint8Array(width * height * 4 * 8);
  const arriving = new Uint8Array(width * height); // colour reaching each cell
  const settled = new Uint8Array(width * height);  // colour no open cell can change

  const queue = [];
  for (const row of level.cells) {
    for (const cell of row) {
      if (cell.type === EMITTER) {
        queue.push({ x: cell.x, y: cell.y, dir: cell.dir, color: cell.color, open: false });
      }
    }
  }

  while (queue.length) {
    const beam = queue.pop();
    if (beam.color === 0) continue;

    const state = ((beam.y * width + beam.x) * 4 + beam.dir) * 8 + beam.color;
    if (visited[state]) continue;
    visited[state] = 1;

    const { dx, dy } = DIRS[beam.dir];
    const nx = beam.x + dx;
    const ny = beam.y + dy;
    const next = cellAt(level, nx, ny);
    if (!next) continue; // off the board

    segments.push({ x1: beam.x, y1: beam.y, x2: nx, y2: ny, color: beam.color });
    const open = beam.open || (undecided !== null && undecided(nx, ny));

    switch (next.type) {
      case WALL:
        break;

      case TARGET: {
        const i = ny * width + nx;
        arriving[i] |= beam.color;
        if (!open) settled[i] |= beam.color;
        break; // targets absorb
      }

      case MIRROR_F:
        queue.push({ x: nx, y: ny, dir: REFLECT_F[beam.dir], color: beam.color, open });
        break;

      case MIRROR_B:
        queue.push({ x: nx, y: ny, dir: REFLECT_B[beam.dir], color: beam.color, open });
        break;

      case SPLITTER:
        queue.push({ x: nx, y: ny, dir: beam.dir, color: beam.color, open });
        queue.push({ x: nx, y: ny, dir: (beam.dir + 1) % 4, color: beam.color, open });
        break;

      case FILTER:
        queue.push({ x: nx, y: ny, dir: beam.dir, color: beam.color & next.color, open });
        break;

      case EMITTER:
        break; // an emitter blocks light rather than re-emitting it

      default:
        queue.push({ x: nx, y: ny, dir: beam.dir, color: beam.color, open });
    }
  }

  const targets = [];
  for (const row of level.cells) {
    for (const cell of row) {
      if (cell.type !== TARGET) continue;
      const got = arriving[cell.y * width + cell.x];
      const fixed = settled[cell.y * width + cell.x];
      targets.push({ x: cell.x, y: cell.y, want: cell.want, got, settled: fixed, lit: got === cell.want });
    }
  }

  return {
    segments,
    targets,
    solved: targets.length > 0 && targets.every((t) => t.lit),
    piecesUsed: level.placed.size,
  };
}

/** Apply a solution (a list of {x, y, piece}) to a fresh level. */
export function applySolution(level, solution) {
  level.placed.clear();
  for (const step of solution) {
    if (!place(level, step.x, step.y, step.piece)) {
      throw new Error(
        `level ${level.id}: solution cannot place ${step.piece} at ${step.x},${step.y}`
      );
    }
  }
  return simulate(level);
}
