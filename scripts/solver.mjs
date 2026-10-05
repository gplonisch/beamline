/**
 * Level solvers, used at authoring time and in CI.
 *
 * `solve` walks the light instead of the board. It simulates the current
 * position, finds the first cell a beam enters that has not been decided yet,
 * and branches on what goes there: nothing, either mirror, or a splitter. Once
 * a cell is decided it is never reconsidered, so every distinct solution is
 * reached exactly once and nothing needs to be remembered between branches.
 *
 * Why this is exhaustive. Take any solution and follow the branch that agrees
 * with it at every decided cell. When there is no undecided cell left on any
 * beam, every cell light touches matches the solution, and the cells it does
 * not touch cannot affect a beam. The beams are therefore identical, so that
 * branch is solved too. A "no solution" result is proof, not a timeout, and
 * because the piece count is capped, "minimum 5" is proof there is no way to
 * finish in 4.
 *
 * One prune keeps it fast. Colour that reaches a target along a path made only
 * of decided cells is permanent, so a target already holding colour it does
 * not want ends the branch. That cuts only branches with no solution in them.
 *
 * The search only ever looks at cells light can reach, which is a few dozen
 * on these boards, instead of every empty cell. That is what lifts the old
 * five-piece ceiling.
 *
 * `solveBruteForce` is the original search over every placement on the board.
 * It is exponential in the budget and only practical up to about five pieces,
 * and it is kept so the tests can check the two agree.
 */

import { EMPTY, MIRROR_B, MIRROR_F, SPLITTER, isPlaceable, place, simulate } from "../js/engine.js";

const PIECES = [MIRROR_F, MIRROR_B, SPLITTER];

export function placeableCells(level) {
  const out = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      if (isPlaceable(level, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/** First placeable cell a beam enters that has not been decided yet. */
function nextUndecided(level, result, decided) {
  for (const s of result.segments) {
    const k = `${s.x2},${s.y2}`;
    if (!decided.has(k) && isPlaceable(level, s.x2, s.y2)) return k;
  }
  return null;
}

/**
 * Walk the decision tree, calling `visit(level)` at every solved leaf with at
 * most `cap` pieces. `visit` returns true to stop the search.
 */
function walk(level, cap, decided, visit, work) {
  if (++work.nodes > work.limit) throw new SearchLimit();
  const result = simulate(level, {
    undecided: (x, y) => !decided.has(`${x},${y}`) && isPlaceable(level, x, y),
  });
  // Prune: a target already holding colour it does not want, by a path no
  // open cell can change, can never be satisfied below this point.
  if (result.targets.some((t) => (t.settled & ~t.want) !== 0)) return false;

  const k = level.placed.size < cap ? nextUndecided(level, result, decided) : null;
  if (k === null) return result.solved ? visit(level) : false;

  decided.add(k);
  try {
    if (walk(level, cap, decided, visit, work)) return true; // leave it empty
    for (const piece of PIECES) {
      level.placed.set(k, piece);
      const stop = walk(level, cap, decided, visit, work);
      level.placed.delete(k);
      if (stop) return true;
    }
    return false;
  } finally {
    decided.delete(k);
  }
}

/**
 * Thrown when a search passes `maxNodes`. Only the level generator sets a
 * limit, to skip boards too open to be good puzzles. The CI check never does,
 * so its answers stay exhaustive.
 */
export class SearchLimit extends Error {}

const snapshot = (level) =>
  [...level.placed].map(([k, piece]) => {
    const [x, y] = k.split(",").map(Number);
    return { x, y, piece };
  });

function withEmptyBoard(level, fn) {
  const saved = new Map(level.placed);
  level.placed.clear();
  try {
    return fn();
  } finally {
    level.placed.clear();
    for (const [k, v] of saved) level.placed.set(k, v);
  }
}

/**
 * A smallest solution using at most `maxPieces`, or null if none exists.
 * Returns a list of {x, y, piece}. Leaves the level as it found it.
 */
export function solve(level, { maxPieces = level.budget, maxNodes = Infinity } = {}) {
  const work = { nodes: 0, limit: maxNodes };
  return withEmptyBoard(level, () => {
    for (let cap = 0; cap <= maxPieces; cap++) {
      let found = null;
      walk(level, cap, new Set(), (lv) => {
        found = snapshot(lv);
        return true;
      }, work);
      if (found) return found;
    }
    return null;
  });
}

/** How many distinct solutions use exactly `pieces` pieces, up to `limit`. */
export function countSolutions(level, pieces, limit = Infinity, { maxNodes = Infinity } = {}) {
  const work = { nodes: 0, limit: maxNodes };
  return withEmptyBoard(level, () => {
    let n = 0;
    walk(level, pieces, new Set(), (lv) => {
      if (lv.placed.size === pieces) n++;
      return n >= limit;
    }, work);
    return n;
  });
}

/** The original search over every placement. Slow; kept as a cross-check. */
export function solveBruteForce(level, { maxPieces = level.budget } = {}) {
  const cells = placeableCells(level);
  try {
    for (let k = 0; k <= maxPieces; k++) {
      const found = chooseCells(cells, k, 0, [], level);
      if (found) return found;
    }
    return null;
  } finally {
    level.placed.clear();
  }
}

function chooseCells(cells, k, start, combo, level) {
  if (combo.length === k) return assignPieces(combo, 0, [], level);
  for (let i = start; i <= cells.length - (k - combo.length); i++) {
    combo.push(cells[i]);
    const found = chooseCells(cells, k, i + 1, combo, level);
    combo.pop();
    if (found) return found;
  }
  return null;
}

function assignPieces(combo, index, assignment, level) {
  if (index === combo.length) {
    level.placed.clear();
    for (let i = 0; i < combo.length; i++) {
      place(level, combo[i].x, combo[i].y, assignment[i]);
    }
    if (simulate(level).solved) {
      return combo.map((c, i) => ({ x: c.x, y: c.y, piece: assignment[i] }));
    }
    return null;
  }
  for (const piece of PIECES) {
    assignment.push(piece);
    const found = assignPieces(combo, index + 1, assignment, level);
    assignment.pop();
    if (found) return found;
  }
  return null;
}
