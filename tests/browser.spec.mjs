/**
 * Browser tests: the things the engine tests cannot see.
 *
 * The first version of Beamline passed 64 engine tests while drawing every
 * beam into the top-left corner of the board, because the canvas was never
 * sized and nothing checked a pixel. These tests read the canvas itself.
 */

import { expect, test } from "@playwright/test";

/** Brightness of the canvas at the centre of cell (x, y). */
async function brightnessAt(page, x, y) {
  return page.evaluate(([x, y]) => {
    const canvas = document.getElementById("beams");
    const geo = window.__beamline.geometry();
    const c = geo.cells.get(`${x},${y}`);
    const scale = canvas.width / geo.width;
    const px = canvas.getContext("2d").getImageData(Math.round(c.cx * scale), Math.round(c.cy * scale), 1, 1).data;
    return px[0] + px[1] + px[2];
  }, [x, y]);
}

const cell = (page, x, y) => page.locator(`.cell[data-x="${x}"][data-y="${y}"]`);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("loads with no errors and no requests to other servers", async ({ page }) => {
  const errors = [];
  const foreign = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => {
    if (!r.url().startsWith("http://127.0.0.1:4173")) foreign.push(r.url());
  });
  await page.reload();
  await expect(page.locator("#level-name")).toHaveText("Straight through");
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test("the canvas covers the board exactly", async ({ page }) => {
  const sizes = await page.evaluate(() => {
    const s = document.getElementById("stage").getBoundingClientRect();
    const c = document.getElementById("beams").getBoundingClientRect();
    return { s: [s.width, s.height], c: [c.width, c.height] };
  });
  expect(sizes.c[0]).toBeCloseTo(sizes.s[0], 0);
  expect(sizes.c[1]).toBeCloseTo(sizes.s[1], 0);
});

test("light is drawn along its path and nowhere else", async ({ page }) => {
  // Level 1: a lamp at (0,1) shining right at a sensor at (6,1).
  for (const x of [1, 3, 5]) expect(await brightnessAt(page, x, 1)).toBeGreaterThan(300);
  for (const x of [1, 3, 5]) expect(await brightnessAt(page, x, 0)).toBeLessThan(150);
  for (const x of [1, 3, 5]) expect(await brightnessAt(page, x, 2)).toBeLessThan(150);
});

test("placing mirrors redirects the drawn light", async ({ page }) => {
  await page.locator(".chip", { hasText: /^2$/ }).click();
  await expect(page.locator("#level-name")).toHaveText("First turn");
  expect(await brightnessAt(page, 1, 1)).toBeLessThan(150);

  await cell(page, 1, 0).click();
  await cell(page, 1, 0).click(); // second click turns it to "\"
  expect(await brightnessAt(page, 1, 1)).toBeGreaterThan(200);
  expect(await brightnessAt(page, 3, 0)).toBeLessThan(150);
});

test("solving a level shows the result and records it", async ({ page }) => {
  await page.locator(".chip", { hasText: /^2$/ }).click();
  for (const [x, y] of [[1, 0], [1, 2]]) {
    await cell(page, x, y).click();
    await cell(page, x, y).click();
  }
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#result-title")).toHaveText("First turn");
  await expect(page.locator("#result-next")).toBeFocused();
  await expect(page.locator(".chip", { hasText: /^2$/ })).toHaveAttribute("aria-label", /solved/);

  await page.reload();
  await page.locator(".chip", { hasText: /^3$/ }).click();
  await expect(page.locator(".chip", { hasText: /^2$/ })).toHaveClass(/is-done/);
});

test("showing the solution marks the level seen, not solved", async ({ page }) => {
  await page.locator(".chip", { hasText: /^3$/ }).click();
  await page.locator("#solve").click();
  expect(await page.evaluate(() => window.__beamline.state().solved)).toBe(true);
  await expect(page.locator("#result")).toBeHidden();
  await page.locator(".chip", { hasText: /^4$/ }).click();
  const chip = page.locator(".chip", { hasText: /^3$/ });
  await expect(chip).toHaveClass(/is-seen/);
  await expect(chip).not.toHaveClass(/is-done/);
});

test("undo reverses moves, including clearing the board", async ({ page }) => {
  await page.locator(".chip", { hasText: /^3$/ }).click();
  await cell(page, 1, 0).click();
  await cell(page, 2, 1).click();
  await page.locator("#reset").click();
  expect((await page.evaluate(() => window.__beamline.state())).placed).toEqual([]);
  await page.locator("#undo").click();
  expect((await page.evaluate(() => window.__beamline.state())).placed.length).toBe(2);
  await page.keyboard.press("z");
  expect((await page.evaluate(() => window.__beamline.state())).placed.length).toBe(1);
});

test("the budget cannot be exceeded", async ({ page }) => {
  await page.locator(".chip", { hasText: /^4$/ }).click(); // budget 1
  await cell(page, 1, 1).click();
  await cell(page, 2, 1).click();
  expect((await page.evaluate(() => window.__beamline.state())).placed).toEqual([["1,1", "/"]]);
  await expect(page.locator("#status")).toContainText("No pieces left");
});

test("the board is playable from the keyboard", async ({ page }) => {
  await page.locator(".chip", { hasText: /^2$/ }).click();
  await cell(page, 1, 1).focus();
  await page.keyboard.press("ArrowUp");
  await expect(cell(page, 1, 0)).toBeFocused();
  await page.keyboard.press("2");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("2");
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#status")).toContainText("solved");
});

test("every cell has an accessible name", async ({ page }) => {
  await page.locator(".chip", { hasText: /^14$/ }).click();
  const unnamed = await page.locator(".cell:not([aria-label])").count();
  expect(unnamed).toBe(0);
  await expect(cell(page, 3, 5)).toHaveAttribute("aria-label", /Dark sensor, wants darkness/);
  await expect(cell(page, 3, 1)).toHaveAttribute("aria-label", /Fixed splitter/);
});

test("works with reduced motion and on a phone", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 375, height: 740 });
  await page.reload();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  for (const x of [1, 3, 5]) expect(await brightnessAt(page, x, 1)).toBeGreaterThan(300);
});

for (const scheme of ["light", "dark"]) {
  test(`no automated WCAG 2.1 AA violations (${scheme} theme)`, async ({ page }) => {
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    await page.emulateMedia({ colorScheme: scheme });
    await page.reload();
    await page.locator(".chip", { hasText: /^2$/ }).click();
    for (const [x, y] of [[1, 0], [1, 2]]) {
      await cell(page, x, y).click();
      await cell(page, x, y).click();
    }
    await expect(page.locator("#result")).toBeVisible();
    await page.locator(".keys summary").click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    expect(summary).toEqual([]);
  });
}
