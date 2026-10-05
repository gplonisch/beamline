/**
 * Level generator, used to author the second chapter.
 *
 *   node scripts/generate.mjs path/to/concept.mjs [tries]
 *
 * A concept fixes what a level is about: the board size, the lamps, filters,
 * sensors and any fixed pieces. The generator scatters walls over the rest,
 * asks the solver for the minimum piece count and how many distinct solutions
 * reach it, and keeps the boards that are hard (a high minimum) and tight (one
 * or two solutions). Wide-open boards are skipped with a node limit, because a
 * board that takes the solver long to search is almost always a board with
 * dozens of answers, which is a worse puzzle anyway.
 *
 * Output is the level's grid as ASCII, ready to paste into levels.js and then
 * hand-edit. Every shipped level was edited after generation; the generator
 * proposes, and the solver re-checks whatever the edit produced.
 *
 * Seeded, so the same concept and seed always give the same boards.
 */

import { EMITTER, FILTER, TARGET, WALL, createLevel, simulate } from "../js/engine.js";
import { SearchLimit, countSolutions, solve } from "./solver.mjs";

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lay a concept's fixed contents out as ASCII rows. */
function baseGrid(c) {
  const rows = Array.from({ length: c.height }, () => Array(c.width).fill("."));
  for (const e of c.emitters ?? []) rows[e.y][e.x] = EMITTER;
  for (const t of c.targets ?? []) rows[t.y][t.x] = TARGET;
  for (const f of c.filters ?? []) rows[f.y][f.x] = FILTER;
  for (const p of c.fixed ?? []) rows[p.y][p.x] = p.piece;
  for (const w of c.walls ?? []) rows[w.y][w.x] = WALL;
  return rows;
}

export function generate(concept, { tries = 400, seed = 1 } = {}) {
  const rand = mulberry32(seed);
  const kept = [];
  const seen = new Set();
  const skipped = { solvedAtStart: 0, unsolvable: 0, tooEasy: 0, tooLoose: 0, tooOpen: 0 };

  for (let i = 0; i < tries; i++) {
    const rows = baseGrid(concept);
    for (let y = 0; y < concept.height; y++) {
      for (let x = 0; x < concept.width; x++) {
        if (rows[y][x] === "." && rand() < concept.wallDensity) rows[y][x] = WALL;
      }
    }
    const grid = rows.map((r) => r.join(""));
    const sig = grid.join("/");
    if (seen.has(sig)) continue;
    seen.add(sig);

    const level = createLevel({ ...concept, id: 0, grid, budget: concept.maxPieces });
    if (simulate(level).solved) { skipped.solvedAtStart++; continue; }

    try {
      const found = solve(level, { maxPieces: concept.maxPieces, maxNodes: concept.maxNodes ?? 200000 });
      if (!found) { skipped.unsolvable++; continue; }
      if (found.length < concept.minPieces) { skipped.tooEasy++; continue; }
      const ways = countSolutions(level, found.length, (concept.maxWays ?? 2) + 1, {
        maxNodes: concept.maxNodes ?? 200000,
      });
      if (ways > (concept.maxWays ?? 2)) { skipped.tooLoose++; continue; }
      kept.push({ grid, pieces: found.length, ways, solution: found });
    } catch (err) {
      if (!(err instanceof SearchLimit)) throw err;
      skipped.tooOpen++;
    }
  }

  // Hardest first, then tightest, then fewest walls (cleaner boards).
  const walls = (g) => g.join("").split(WALL).length - 1;
  kept.sort((a, b) => b.pieces - a.pieces || a.ways - b.ways || walls(a.grid) - walls(b.grid));
  kept.skipped = skipped;
  return kept;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = new URL(process.argv[2], `file://${process.cwd()}/`).href;
  const { default: concept } = await import(path);
  const tries = Number(process.argv[3] ?? 400);
  const results = generate(concept, { tries, seed: concept.seed ?? 1 });
  console.log(`${concept.name}: ${results.length} board(s) kept from ${tries} tries`);
  console.log(`skipped: ${JSON.stringify(results.skipped)}\n`);
  for (const r of results.slice(0, concept.show ?? 3)) {
    console.log(`minimum ${r.pieces}, ${r.ways} solution(s)`);
    for (const row of r.grid) console.log("  " + JSON.stringify(row) + ",");
    console.log("  solution: " + JSON.stringify(r.solution) + "\n");
  }
}
