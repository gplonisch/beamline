/**
 * Authoring tool and CI check: prove every level is solvable within its budget
 * and that the budget is exactly the minimum.
 *
 *   node scripts/solve.mjs
 *
 * The search is exhaustive (see solver.mjs for why), so "no solution" is proof
 * a level cannot be finished, and "minimum 4" is proof there is no way to do it
 * in 3.
 */

import { createLevel } from "../js/engine.js";
import { LEVELS } from "../js/levels.js";
import { countSolutions, solve } from "./solver.mjs";

let ok = 0;
const total = Date.now();
for (const def of LEVELS) {
  const level = createLevel(def);
  const started = Date.now();
  const found = solve(level);
  const ms = Date.now() - started;
  const tag = `level ${String(def.id).padStart(2)}  ${def.name.padEnd(20)}`;

  if (!found) {
    console.log(`${tag} NO SOLUTION within budget ${def.budget} (${ms}ms)`);
    continue;
  }
  const ways = countSolutions(level, found.length, 50);
  console.log(
    `${tag} minimum ${found.length}, budget ${def.budget}, ` +
    `${ways >= 50 ? "50+" : ways} solution(s) at minimum  (${ms}ms)`
  );
  if (found.length !== def.budget) {
    console.log(`         budget has ${def.budget - found.length} piece(s) of slack`);
    if (process.argv.includes("--print")) console.log("         " + JSON.stringify(found));
    continue;
  }
  if (process.argv.includes("--print")) console.log("         " + JSON.stringify(found));
  ok++;
}
console.log(`\n${ok}/${LEVELS.length} solvable with an exact budget  (${Date.now() - total}ms)`);
process.exit(ok === LEVELS.length ? 0 : 1);
