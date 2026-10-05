/**
 * Game shell: level flow, input, undo, persistence and announcements.
 *
 * Progress lives in localStorage, which can throw in a private window or with
 * site data blocked, so every access is guarded and the game runs normally
 * without it. It simply forgets.
 *
 * Showing a solution is recorded separately from solving. It marks the level
 * as seen, never as solved, so the level picker only ever claims what the
 * player actually did.
 */

import {
  COLOR_NAMES, EMPTY, MIRROR_B, MIRROR_F, SPLITTER, applySolution, cellAt, createLevel, cycle,
  isPlaceable, place, remove, simulate,
} from "./engine.js";
import { CHAPTERS, LEVELS } from "./levels.js";
import { PIECE_NAMES, buildBoard, draw, drawIcon, labelCells, measure } from "./render.js";

const STORE_KEY = "beamline.progress.v2";

const $ = (id) => document.getElementById(id);
const els = {
  stage: $("stage"), board: $("board"), canvas: $("beams"),
  number: $("level-number"), name: $("level-name"), hint: $("level-hint"),
  budget: $("budget"), pips: $("budget-pips"), budgetWrap: $("budget-wrap"),
  status: $("status"), picker: $("picker"), legend: $("legend"),
  undo: $("undo"), reset: $("reset"), solve: $("solve"), prev: $("prev"), next: $("next"),
  fullscreen: $("fullscreen"), forget: $("forget"), codes: $("codes"),
  result: $("result"), resultKicker: $("result-kicker"), resultTitle: $("result-title"),
  resultBody: $("result-body"), resultNext: $("result-next"), resultStay: $("result-stay"),
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let index = 0;
let level = null;
let nodes = [];
let geo = null;
let result = null;
let history = [];
let hover = null;
let focusKey = null;
let progress = loadProgress();

/* ---------- persistence ------------------------------------------------ */

function loadProgress() {
  const empty = { solved: [], seen: [], boards: {}, current: null, codes: true };
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    return {
      solved: Array.isArray(data.solved) ? data.solved : [],
      seen: Array.isArray(data.seen) ? data.seen : [],
      boards: data.boards && typeof data.boards === "object" ? data.boards : {},
      current: Number.isInteger(data.current) ? data.current : null,
      codes: data.codes !== false,
    };
  } catch {
    return empty;
  }
}

function saveProgress() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable; progress is lost on reload and that is acceptable */
  }
}

const isSolved = (id) => progress.solved.includes(id);
const isSeen = (id) => progress.seen.includes(id);

/* ---------- level flow -------------------------------------------------- */

function chapterOf(id) {
  return CHAPTERS.find((c) => id >= c.first && id <= c.last);
}

function load(i, { announceIt = true } = {}) {
  index = Math.max(0, Math.min(LEVELS.length - 1, i));
  const def = LEVELS[index];
  level = createLevel(def);
  history = [];
  hover = null;
  hideResult();

  // Restore an in-progress board, ignoring anything that no longer fits the
  // level (the level may have changed since it was saved).
  for (const [k, piece] of progress.boards[def.id] ?? []) {
    const [x, y] = k.split(",").map(Number);
    if (isPlaceable(level, x, y) && [MIRROR_F, MIRROR_B, SPLITTER].includes(piece)) place(level, x, y, piece);
  }

  progress.current = def.id;
  saveProgress();

  const chapter = chapterOf(def.id);
  els.number.textContent = `${chapter.name} · Level ${def.id} of ${LEVELS.length}`;
  els.name.textContent = def.name;
  els.hint.textContent = def.hint ?? "";
  els.prev.disabled = index === 0;
  els.next.disabled = index === LEVELS.length - 1;

  nodes = buildBoard(els.board, level, { activate, clear: clearCell, hover: setHover });
  const firstBuildable = nodes.find((n) => n.tagName === "BUTTON") ?? nodes[0];
  setFocusCell(`${firstBuildable.dataset.x},${firstBuildable.dataset.y}`, false);

  result = simulate(level); // before layout, so no frame pairs this board with the last level's light
  layout();
  update();
  buildPicker();
  if (announceIt) announce(`Level ${def.id}, ${def.name}. ${def.hint ?? ""} ${budgetSentence()}`);

  // The tutorial level is solved as it stands.
  if (result.solved && def.budget === 0 && level.placed.size === 0) markSolved({ focus: false });
}

function layout() {
  geo = measure(nodes, els.canvas);
  render();
}

function render(t = 0) {
  if (!geo || !result) return;
  let preview = null;
  if (hover) {
    const current = level.placed.get(`${hover.x},${hover.y}`);
    if (!current && level.placed.size >= level.budget) preview = null;
    else preview = { undefined: MIRROR_F, [MIRROR_F]: MIRROR_B, [MIRROR_B]: SPLITTER, [SPLITTER]: EMPTY }[current];
  }
  draw(els.canvas, geo, level, result, { t, hover, preview, solved: result.solved, codes: progress.codes });
}

function budgetSentence() {
  if (level.budget === 0) return "No pieces needed.";
  return `${level.placed.size} of ${level.budget} pieces placed.`;
}

function update() {
  result = simulate(level);
  labelCells(nodes, level, result);
  render();

  const used = level.placed.size;
  els.budget.textContent = level.budget === 0 ? "No pieces needed" : `${used} of ${level.budget} placed`;
  els.pips.innerHTML = "";
  for (let i = 0; i < level.budget; i++) {
    const pip = document.createElement("span");
    pip.className = "pip" + (i < used ? " is-used" : "");
    els.pips.appendChild(pip);
  }
  els.budgetWrap.classList.toggle("is-full", level.budget > 0 && used >= level.budget);
  els.undo.disabled = history.length === 0;
  els.reset.disabled = used === 0;
  els.stage.classList.toggle("is-solved", result.solved);

  progress.boards[LEVELS[index].id] = [...level.placed];
  saveProgress();
}

/* ---------- moves ------------------------------------------------------- */

/** Run a change; if it changed the board, record it for undo and react. */
function commit(change) {
  const before = [...level.placed];
  const wasSolved = result?.solved;
  if (!change()) return false;
  history.push(before);
  if (history.length > 200) history.shift();
  update();
  if (result.solved && !wasSolved) markSolved({ focus: true });
  else if (!result.solved) {
    hideResult();
    describeProgress();
  }
  return true;
}

function activate(x, y) {
  setFocusCell(`${x},${y}`, false);
  const occupied = level.placed.has(`${x},${y}`);
  if (!occupied && level.placed.size >= level.budget) {
    refuse();
    return;
  }
  commit(() => cycle(level, x, y));
}

function clearCell(x, y) {
  commit(() => remove(level, x, y));
}

function setPiece(x, y, piece) {
  if (!isPlaceable(level, x, y)) return;
  if (level.placed.get(`${x},${y}`) === piece) return;
  if (!level.placed.has(`${x},${y}`) && level.placed.size >= level.budget) {
    refuse();
    return;
  }
  commit(() => place(level, x, y, piece));
}

function undo() {
  const before = history.pop();
  if (!before) return;
  level.placed = new Map(before);
  update();
  if (!result.solved) hideResult();
  announce(`Undone. ${budgetSentence()}`);
}

function clearBoard() {
  if (commit(() => {
    if (level.placed.size === 0) return false;
    level.placed.clear();
    return true;
  })) announce("Board cleared. Undo brings it back.");
}

function showSolution() {
  const def = LEVELS[index];
  const before = [...level.placed];
  applySolution(level, def.solution);
  history.push(before);
  if (!isSeen(def.id)) progress.seen.push(def.id);
  update();
  buildPicker();
  hideResult();
  announce(`Solution shown for ${def.name}. It is marked as seen, not solved. Undo puts your own pieces back.`);
}

function refuse() {
  els.budgetWrap.classList.remove("is-refused");
  void els.budgetWrap.offsetWidth; // restart the animation
  els.budgetWrap.classList.add("is-refused");
  announce(`No pieces left. Remove one first. ${budgetSentence()}`);
}

function describeProgress() {
  const waiting = result.targets.filter((t) => !t.lit);
  const parts = waiting.map((t) => {
    const want = t.want === 0 ? "wants darkness" : `wants ${COLOR_NAMES[t.want]}`;
    return `Sensor at column ${t.x + 1}, row ${t.y + 1} ${want}, receiving ${COLOR_NAMES[t.got]}.`;
  });
  announce(`${budgetSentence()} ${waiting.length} sensor${waiting.length === 1 ? "" : "s"} not satisfied. ${parts.join(" ")}`);
}

/* ---------- winning ----------------------------------------------------- */

function markSolved({ focus }) {
  const def = LEVELS[index];
  const first = !isSolved(def.id);
  if (first) progress.solved.push(def.id);
  saveProgress();
  buildPicker();

  const all = LEVELS.every((l) => isSolved(l.id));
  if (all && first) {
    showResult({
      kicker: "Bench complete",
      title: "Every level solved",
      body: `All ${LEVELS.length} levels, each in the fewest pieces the solver says is possible. Thank you for playing.`,
      next: "Play from level 1",
      onNext: () => load(0),
      focus,
    });
    announce(`${def.name} solved. That was the last one: every level is solved.`);
    return;
  }

  const pieces = level.placed.size;
  const nextUnsolved = LEVELS.findIndex((l, i) => i > index && !isSolved(l.id));
  const target = nextUnsolved === -1 ? LEVELS.findIndex((l) => !isSolved(l.id)) : nextUnsolved;
  const isEndOfChapter = chapterOf(def.id).last === def.id && index < LEVELS.length - 1;

  showResult({
    kicker: isEndOfChapter ? `End of ${chapterOf(def.id).name}` : "Level solved",
    title: def.name,
    body: def.budget === 0
      ? "Solved without placing anything. Every other level needs pieces."
      : `${pieces} piece${pieces === 1 ? "" : "s"}, the fewest possible.`,
    next: target === -1 || target === index ? "Next level" : `Level ${LEVELS[target].id}`,
    onNext: () => load(target === -1 ? Math.min(index + 1, LEVELS.length - 1) : target),
    focus,
  });
  announce(`${def.name} solved with ${pieces} piece${pieces === 1 ? "" : "s"}.`);
}

let onResultNext = null;

function showResult({ kicker, title, body, next, onNext, focus }) {
  els.resultKicker.textContent = kicker;
  els.resultTitle.textContent = title;
  els.resultBody.textContent = body;
  els.resultNext.textContent = next;
  onResultNext = onNext;
  els.result.hidden = false;
  els.result.classList.remove("is-in");
  void els.result.offsetWidth;
  els.result.classList.add("is-in");
  if (focus) els.resultNext.focus({ preventScroll: true });
}

function hideResult() {
  els.result.hidden = true;
}

els.resultNext.addEventListener("click", () => onResultNext?.());
els.resultStay.addEventListener("click", () => {
  hideResult();
  focusCurrentCell();
});

/* ---------- level picker and legend ------------------------------------- */

function buildPicker() {
  els.picker.innerHTML = "";
  for (const chapter of CHAPTERS) {
    const group = document.createElement("div");
    group.className = "picker__group";
    const h = document.createElement("h3");
    h.className = "picker__chapter";
    h.textContent = chapter.name;
    const row = document.createElement("div");
    row.className = "picker";
    for (const def of LEVELS.filter((l) => l.id >= chapter.first && l.id <= chapter.last)) {
      const i = LEVELS.indexOf(def);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = def.id;
      const solved = isSolved(def.id);
      const seen = !solved && isSeen(def.id);
      if (solved) b.classList.add("is-done");
      if (seen) b.classList.add("is-seen");
      if (i === index) {
        b.classList.add("is-current");
        b.setAttribute("aria-current", "true");
      }
      b.setAttribute("aria-label", `Level ${def.id}, ${def.name}${solved ? ", solved" : seen ? ", solution seen" : ""}`);
      b.addEventListener("click", () => load(i));
      row.appendChild(b);
    }
    group.append(h, row);
    els.picker.appendChild(group);
  }
}

function buildLegend() {
  const items = [
    ["lamp", 1, "Lamp. Shines one colour in the direction of its nozzle."],
    ["sensor", 3, "Sensor. Satisfied by exactly the colour of its ring, no more and no less."],
    ["dark", 0, "Dark sensor. Satisfied only while no light reaches it."],
    ["filter", 6, "Filter. Keeps the colours it is made of and absorbs the rest."],
    [MIRROR_F, 7, "Mirror. Turns light ninety degrees. Click again to turn it the other way."],
    [SPLITTER, 7, "Splitter. Passes light straight on and sends a copy clockwise."],
    ["fixed", 7, "Gold pieces are bolted down and cannot be moved."],
  ];
  els.legend.innerHTML = "";
  for (const [kind, color, text] of items) {
    const li = document.createElement("li");
    const c = document.createElement("canvas");
    c.className = "legend__icon";
    c.setAttribute("aria-hidden", "true");
    drawIcon(c, kind, color);
    const span = document.createElement("span");
    span.textContent = text;
    li.append(c, span);
    els.legend.appendChild(li);
  }
}

/* ---------- keyboard ---------------------------------------------------- */

function cellNode(k) {
  const [x, y] = k.split(",");
  return nodes.find((n) => n.dataset.x === x && n.dataset.y === y);
}

function setFocusCell(k, move = true) {
  if (focusKey) {
    const old = cellNode(focusKey);
    if (old) old.tabIndex = -1;
  }
  focusKey = k;
  const el = cellNode(k);
  if (!el) return;
  el.tabIndex = 0;
  if (move) el.focus();
}

function focusCurrentCell() {
  if (focusKey) cellNode(focusKey)?.focus();
}

function setHover(x, y) {
  hover = x === null || x === undefined ? null : { x, y };
  render();
}

// The board is one tab stop. Arrow keys move inside it, which is the grid
// pattern screen readers expect, instead of tabbing through every cell.
els.board.addEventListener("keydown", (e) => {
  const el = e.target.closest(".cell");
  if (!el) return;
  const x = +el.dataset.x;
  const y = +el.dataset.y;

  const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (step) {
    e.preventDefault();
    const nx = Math.max(0, Math.min(level.width - 1, x + step[0]));
    const ny = Math.max(0, Math.min(level.height - 1, y + step[1]));
    setFocusCell(`${nx},${ny}`);
    return;
  }
  if (e.key === "Home" || e.key === "End") {
    e.preventDefault();
    setFocusCell(`${e.key === "Home" ? 0 : level.width - 1},${y}`);
    return;
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    clearCell(x, y);
    return;
  }
  const piece = { 1: MIRROR_F, 2: MIRROR_B, 3: SPLITTER }[e.key];
  if (piece && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    setPiece(x, y, piece);
    return;
  }
  if (e.key === "0") {
    e.preventDefault();
    clearCell(x, y);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  if ((e.key === "z" || e.key === "Z") && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  switch (e.key) {
    case "z": case "Z": undo(); break;
    case "r": case "R": clearBoard(); break;
    case "n": case "N": if (!els.next.disabled) load(index + 1); break;
    case "p": case "P": if (!els.prev.disabled) load(index - 1); break;
    case "Escape":
      if (!els.result.hidden) {
        hideResult();
        focusCurrentCell();
      }
      break;
  }
});

/* ---------- controls ---------------------------------------------------- */

els.undo.addEventListener("click", undo);
els.reset.addEventListener("click", clearBoard);
els.solve.addEventListener("click", showSolution);
els.prev.addEventListener("click", () => load(index - 1));
els.next.addEventListener("click", () => load(index + 1));

els.forget.addEventListener("click", () => {
  if (!window.confirm("Forget every solved level and saved board in this browser?")) return;
  progress = { solved: [], seen: [], boards: {}, current: null, codes: true };
  syncCodes();
  try {
    window.localStorage.removeItem(STORE_KEY);
    window.localStorage.removeItem("beamline.progress.v1");
  } catch { /* nothing stored, nothing to forget */ }
  load(0);
  announce("Progress forgotten. Back to level 1.");
});

// Fullscreen matters most in an embedded frame on a games portal, where the
// available height is small. The control stays hidden when the API is absent
// rather than appearing and failing.
if (document.documentElement.requestFullscreen && els.fullscreen) {
  els.fullscreen.hidden = false;
  els.fullscreen.addEventListener("click", async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      els.fullscreen.hidden = true; // blocked by permissions policy in this frame
    }
  });
  document.addEventListener("fullscreenchange", () => {
    els.fullscreen.textContent = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen";
  });
}

// Letter codes on lamps, filters and sensors, for anyone who cannot rely on
// telling the colours apart. On by default; the choice is remembered.
function syncCodes() {
  els.codes.setAttribute("aria-pressed", String(progress.codes));
  els.codes.textContent = progress.codes ? "Colour codes on" : "Colour codes off";
}
els.codes.addEventListener("click", () => {
  progress.codes = !progress.codes;
  saveProgress();
  syncCodes();
  render();
});
syncCodes();

function announce(message) {
  els.status.textContent = message;
}

/* ---------- drawing loop ------------------------------------------------ */

// The light shimmers and solved sensors breathe, but only for people who have
// not asked for reduced motion, and never while the tab is hidden.
let frame = 0;
function tick(now) {
  render(now / 1000);
  frame = requestAnimationFrame(tick);
}
function startLoop() {
  cancelAnimationFrame(frame);
  if (!reducedMotion.matches && !document.hidden) frame = requestAnimationFrame(tick);
  else render();
}
reducedMotion.addEventListener?.("change", startLoop);
document.addEventListener("visibilitychange", startLoop);

new ResizeObserver(() => layout()).observe(els.stage);
document.fonts?.ready.then(() => layout());

/* ---------- start ------------------------------------------------------- */

buildLegend();
const saved = LEVELS.findIndex((l) => l.id === progress.current);
const firstUnsolved = LEVELS.findIndex((l) => !isSolved(l.id));
load(saved !== -1 ? saved : firstUnsolved === -1 ? 0 : firstUnsolved, { announceIt: false });
startLoop();

// Exposed for the browser tests, which check that light lands on the pixels
// of the cells it is meant to reach. Nothing in the game reads it.
window.__beamline = {
  geometry: () => geo,
  state: () => ({ id: LEVELS[index].id, placed: [...level.placed], solved: result.solved }),
  cellAt: (x, y) => cellAt(level, x, y),
};
