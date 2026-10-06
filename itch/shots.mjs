/**
 * Capture real store art from the running game.
 *
 *   node itch/shots.mjs
 *
 * Earlier versions of this folder drew an approximation of the board in Python.
 * That was fine when the renderer was flat rectangles and became dishonest the
 * moment it grew gradients, metallic mirrors and glow: the art no longer looked
 * like the thing being sold. These are screenshots of the actual game, driven
 * through the same interface a player uses.
 *
 * Writes into itch/:
 *   shot-<id>.png    1280x800, the whole interface
 *   board-<id>.png   just the board, used to compose the cover
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "itch");
const PORT = 4188;
const BASE = `http://127.0.0.1:${PORT}`;

// Levels chosen to show a different mechanic in each frame rather than the same
// board four times.
const SHOTS = [
  { id: 9, note: "colour mixing" },
  { id: 13, note: "the darkness sensor" },
  { id: 16, note: "crossing beams" },
  { id: 18, note: "one lamp, three filters" },
];
const COVER_LEVEL = 18;

async function waitForServer(url, attempts = 50) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server never came up at ${url}`);
}

const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: ROOT, stdio: "ignore",
});

try {
  mkdirSync(OUT, { recursive: true });
  await waitForServer(BASE);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });

  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  for (const { id, note } of [...SHOTS, { id: COVER_LEVEL, note: "cover" }]) {
    await page.locator(".chip", { hasText: new RegExp(`^${id}$`) }).click();
    await page.locator("#solve").click();
    // The solved animation settles; capture the finished frame, not a tween.
    await page.waitForTimeout(900);

    const solved = await page.evaluate(() => window.__beamline.state().solved);
    if (!solved) throw new Error(`level ${id} did not report solved after #solve`);

    if (note === "cover") {
      await page.locator("#stage").screenshot({ path: join(OUT, `board-${id}.png`) });
    } else {
      await page.screenshot({ path: join(OUT, `shot-${id}.png`) });
      console.log(`shot-${id}.png      level ${id}, ${note}`);
    }
  }

  if (errors.length) throw new Error(`page errors during capture:\n${errors.join("\n")}`);

  await browser.close();
  console.log(`board-${COVER_LEVEL}.png   board only, for the cover`);
} finally {
  server.kill();
}
