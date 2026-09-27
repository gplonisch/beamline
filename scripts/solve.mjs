/**
 * Authoring tool: find a minimal solution for every level.
 *
 *   node scripts/solve.mjs
 *
 * Exhaustive over placements, so a "no solution" result is proof rather than a
 * failure to find one. It is not run in CI: the search is exponential in the
 * budget and is already slow at five pieces. CI verifies the stored solutions
 * instead, which is instant and catches the thing that actually matters, an
 * engine change that breaks a shipped level.
 */

import { createLevel } from "../js/engine.js";
import { LEVELS } from "../js/levels.js";
import { solve } from "./solver.mjs";

let solved = 0;
for (const def of LEVELS) {
  const level = createLevel(def);
  const started = Date.now();
  const found = solve(level);
  const ms = Date.now() - started;
  if (found) {
    solved++;
    console.log(
      `level ${String(def.id).padStart(2)}  ${def.name.padEnd(18)} ` +
      `minimum ${found.length} piece(s), budget ${def.budget}  (${ms}ms)`
    );
    if (found.length !== def.budget) {
      console.log(`         budget has ${def.budget - found.length} piece(s) of slack`);
    }
  } else {
    console.log(`level ${String(def.id).padStart(2)}  ${def.name.padEnd(18)} NO SOLUTION (${ms}ms)`);
  }
}
console.log(`\n${solved}/${LEVELS.length} solvable within budget`);
process.exit(solved === LEVELS.length ? 0 : 1);
