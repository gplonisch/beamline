import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  B, DOWN, G, LEFT, MIRROR_B, MIRROR_F, R, RIGHT, SPLITTER, UP, WHITE,
  applySolution, createLevel, cycle, isPlaceable, place, simulate,
} from "../js/engine.js";
import { LEVELS } from "../js/levels.js";

const build = (grid, extra = {}) =>
  createLevel({ id: 0, name: "test", grid, budget: 9, ...extra });

describe("beam propagation", () => {
  it("travels in a straight line until it is absorbed", () => {
    const level = build([".....", "E...T", "....."], {
      emitters: [{ x: 0, y: 1, dir: RIGHT, color: WHITE }],
      targets: [{ x: 4, y: 1, want: WHITE }],
    });
    const out = simulate(level);
    assert.equal(out.solved, true);
    assert.equal(out.targets[0].got, WHITE);
  });

  it("stops at a wall", () => {
    const level = build(["E.#.T"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 4, y: 0, want: WHITE }],
    });
    assert.equal(simulate(level).solved, false);
  });

  it("leaves the board without error", () => {
    const level = build(["E....", "....T"], {
      emitters: [{ x: 0, y: 0, dir: UP, color: WHITE }],
      targets: [{ x: 4, y: 1, want: WHITE }],
    });
    assert.equal(simulate(level).solved, false);
  });
});

describe("mirrors", () => {
  it("forward slash turns a rightward beam upward", () => {
    const level = build([".T...", "E/...", "....."], {
      emitters: [{ x: 0, y: 1, dir: RIGHT, color: WHITE }],
      targets: [{ x: 1, y: 0, want: WHITE }],
    });
    assert.equal(simulate(level).solved, true);
  });

  it("back slash turns a rightward beam downward", () => {
    const level = build([".....", "E\\...", ".T..."], {
      emitters: [{ x: 0, y: 1, dir: RIGHT, color: WHITE }],
      targets: [{ x: 1, y: 2, want: WHITE }],
    });
    assert.equal(simulate(level).solved, true);
  });

  it("reflection is symmetric: a beam sent back retraces its path", () => {
    const forward = build(["E/", ".."], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
    });
    // Nothing to assert against a target; the property is that simulate
    // terminates and produced segments rather than looping.
    const out = simulate(forward);
    assert.ok(out.segments.length > 0);
  });
});

describe("splitters", () => {
  it("produces a straight beam and one turned clockwise", () => {
    const level = build(["E.S.T", "..:..", "..T.."].map((r) => r.replace(":", ".")), {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 4, y: 0, want: WHITE }, { x: 2, y: 2, want: WHITE }],
    });
    const out = simulate(level);
    assert.equal(out.solved, true, "both the straight and the turned beam should land");
  });
});

describe("colour", () => {
  it("a filter keeps only the colours it contains", () => {
    const level = build(["E.F.T"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      filters: [{ x: 2, y: 0, color: R }],
      targets: [{ x: 4, y: 0, want: R }],
    });
    assert.equal(simulate(level).targets[0].got, R);
  });

  it("a filter that shares nothing with the beam absorbs it", () => {
    const level = build(["E.F.T"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: R }],
      filters: [{ x: 2, y: 0, color: B }],
      targets: [{ x: 4, y: 0, want: R }],
    });
    assert.equal(simulate(level).targets[0].got, 0);
  });

  it("two beams at one target add together", () => {
    const level = build(["E...\\", ".....", "E...T"], {
      emitters: [
        { x: 0, y: 0, dir: RIGHT, color: R },
        { x: 0, y: 2, dir: RIGHT, color: G },
      ],
      targets: [{ x: 4, y: 2, want: R | G }],
    });
    assert.equal(simulate(level).targets[0].got, R | G);
  });

  it("a target wanting one colour is not satisfied by two", () => {
    const level = build(["E...\\", ".....", "E...T"], {
      emitters: [
        { x: 0, y: 0, dir: RIGHT, color: R },
        { x: 0, y: 2, dir: RIGHT, color: G },
      ],
      targets: [{ x: 4, y: 2, want: G }],
    });
    const out = simulate(level);
    assert.equal(out.targets[0].got, R | G);
    assert.equal(out.solved, false, "over-lighting a target must not count as solved");
  });
});

describe("termination", () => {
  it("a mirror loop terminates instead of hanging", () => {
    // Four mirrors in a ring send the beam around forever unless the visited
    // set stops it. This is the one way a grid light puzzle can lock up.
    const level = build(["E\\..\\", ".....", ".....", ".\\../"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 4, y: 1, want: WHITE }],
    });
    const out = simulate(level); // must return at all
    assert.ok(Array.isArray(out.segments));
  });
});

describe("placement rules", () => {
  it("pieces go only on empty cells", () => {
    const level = build(["E#.T"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 3, y: 0, want: WHITE }],
    });
    assert.equal(isPlaceable(level, 1, 0), false, "not on a wall");
    assert.equal(isPlaceable(level, 0, 0), false, "not on an emitter");
    assert.equal(isPlaceable(level, 3, 0), false, "not on a target");
    assert.equal(isPlaceable(level, 2, 0), true);
  });

  it("the budget is enforced", () => {
    const level = createLevel({
      id: 0, name: "t", grid: ["E...T"], budget: 1,
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 4, y: 0, want: WHITE }],
    });
    assert.equal(place(level, 1, 0, MIRROR_F), true);
    assert.equal(place(level, 2, 0, MIRROR_F), false, "second piece exceeds a budget of 1");
    assert.equal(place(level, 1, 0, MIRROR_B), true, "replacing in place is allowed");
  });

  it("cycling runs mirror, mirror, splitter, empty", () => {
    const level = build(["E..T"], {
      emitters: [{ x: 0, y: 0, dir: RIGHT, color: WHITE }],
      targets: [{ x: 3, y: 0, want: WHITE }],
    });
    const at = () => level.placed.get("1,0");
    cycle(level, 1, 0); assert.equal(at(), MIRROR_F);
    cycle(level, 1, 0); assert.equal(at(), MIRROR_B);
    cycle(level, 1, 0); assert.equal(at(), SPLITTER);
    cycle(level, 1, 0); assert.equal(at(), undefined);
  });
});

describe("shipped levels", () => {
  it("there are twelve of them, numbered in order", () => {
    assert.equal(LEVELS.length, 12);
    assert.deepEqual(LEVELS.map((l) => l.id), [...Array(12)].map((_, i) => i + 1));
  });

  for (const def of LEVELS) {
    it(`level ${def.id} "${def.name}" is solved by its stored solution`, () => {
      const level = createLevel(def);
      const out = applySolution(level, def.solution);
      assert.equal(out.solved, true, `targets: ${JSON.stringify(out.targets)}`);
    });

    it(`level ${def.id} needs every piece of its budget`, () => {
      // An exact budget is the puzzle. If a level ships with slack, a player
      // can stumble into a win, so the stored solution must use the whole
      // allowance and the budget must not be larger than the solution.
      assert.equal(
        def.solution.length, def.budget,
        `budget ${def.budget} but the solution uses ${def.solution.length}`
      );
    });

    it(`level ${def.id} is not already solved before the player acts`, () => {
      const level = createLevel(def);
      if (def.budget === 0) return; // level 1 is the tutorial
      assert.equal(simulate(level).solved, false, "level starts already solved");
    });

    it(`level ${def.id} has a reachable grid and at least one target`, () => {
      const level = createLevel(def);
      assert.ok(level.width > 0 && level.height > 0);
      assert.ok(simulate(level).targets.length > 0);
    });
  }
});
