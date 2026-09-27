/**
 * Brute-force solver, used at authoring time and in CI.
 *
 * Searches placements of up to `budget` pieces across the placeable cells. The
 * search space is C(cells, k) * 3^k, which is large but tractable at the budgets
 * these levels use, and it is exhaustive: if it finds nothing, the level is
 * genuinely unsolvable rather than merely hard.
 */

import { MIRROR_B, MIRROR_F, SPLITTER, isPlaceable, place, simulate } from "../js/engine.js";

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

export function solve(level, { maxPieces = level.budget } = {}) {
  const cells = placeableCells(level);

  for (let k = 0; k <= maxPieces; k++) {
    const combo = [];
    const found = chooseCells(cells, k, 0, combo, level);
    if (found) return found;
  }
  return null;
}

function chooseCells(cells, k, start, combo, level) {
  if (combo.length === k) return assignPieces(combo, 0, [], level);
  // Prune: not enough cells left to fill the combination.
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
