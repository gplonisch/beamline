/**
 * Game shell: level state, input, persistence, and the status announcements.
 *
 * Progress lives in localStorage, which can throw in a private window or with
 * site data blocked, so every access is guarded and the game runs fine when
 * storage is unavailable. It simply forgets.
 */

import { COLOR_NAMES, applySolution, createLevel, cycle, simulate } from "./engine.js";
import { LEVELS } from "./levels.js";
import { buildBoard, paint } from "./render.js";

const STORE_KEY = "beamline.progress.v1";

const els = {
  board: document.getElementById("board"),
  canvas: document.getElementById("beams"),
  name: document.getElementById("level-name"),
  number: document.getElementById("level-number"),
  hint: document.getElementById("level-hint"),
  budget: document.getElementById("budget"),
  status: document.getElementById("status"),
  reset: document.getElementById("reset"),
  solve: document.getElementById("solve"),
  prev: document.getElementById("prev"),
  next: document.getElementById("next"),
  picker: document.getElementById("picker"),
};

let level = null;
let nodes = [];
let index = 0;
let solvedIds = loadProgress();

/* ---------- persistence ------------------------------------------------ */
function loadProgress() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveProgress() {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify([...solvedIds]));
  } catch {
    /* storage unavailable; progress is lost on reload and that is acceptable */
  }
}

/* ---------- level flow -------------------------------------------------- */
function load(i) {
  index = Math.max(0, Math.min(LEVELS.length - 1, i));
  const def = LEVELS[index];
  level = createLevel(def);

  els.number.textContent = `${def.id} of ${LEVELS.length}`;
  els.name.textContent = def.name;
  els.hint.textContent = def.hint ?? "";
  nodes = buildBoard(els.board, level, onCellActivate);

  els.prev.disabled = index === 0;
  els.next.disabled = index === LEVELS.length - 1;

  refresh();
  announce(`Level ${def.id}, ${def.name}. ${def.hint ?? ""}`);
  buildPicker();
}

function refresh() {
  const result = simulate(level);
  paint(nodes, els.canvas, level, result);

  const used = level.placed.size;
  els.budget.textContent = level.budget === 0
    ? "No pieces needed"
    : `${used} of ${level.budget} placed`;
  els.budget.classList.toggle("is-full", used >= level.budget && level.budget > 0);

  document.body.classList.toggle("is-solved", result.solved);

  if (result.solved && !solvedIds.has(level.id)) {
    solvedIds.add(level.id);
    saveProgress();
    buildPicker();
  }
  return result;
}

function onCellActivate(x, y) {
  const before = level.placed.size;
  const changed = cycle(level, x, y);
  const result = refresh();

  if (!changed && before >= level.budget) {
    announce(`No pieces left. Remove one first. ${before} of ${level.budget} placed.`);
    return;
  }

  if (result.solved) {
    announce(`Solved. ${LEVELS[index].name} complete with ${result.piecesUsed} pieces.`);
  } else {
    const unlit = result.targets.filter((t) => !t.lit);
    announce(
      unlit.length === 0
        ? "All targets lit."
        : `${unlit.length} target${unlit.length === 1 ? "" : "s"} still unlit. ` +
          unlit.map((t) => `Column ${t.x + 1} row ${t.y + 1} wants ${COLOR_NAMES[t.want]}, has ${COLOR_NAMES[t.got]}.`).join(" ")
    );
  }
}

function announce(message) {
  els.status.textContent = message;
}

function buildPicker() {
  els.picker.innerHTML = "";
  LEVELS.forEach((def, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = def.id;
    if (solvedIds.has(def.id)) b.classList.add("is-done");
    if (i === index) b.classList.add("is-current");
    b.setAttribute(
      "aria-label",
      `Level ${def.id}, ${def.name}${solvedIds.has(def.id) ? ", solved" : ""}`
    );
    if (i === index) b.setAttribute("aria-current", "true");
    b.addEventListener("click", () => load(i));
    els.picker.appendChild(b);
  });
}

/* ---------- controls ---------------------------------------------------- */
els.reset.addEventListener("click", () => {
  level.placed.clear();
  refresh();
  announce("Board cleared.");
});

els.solve.addEventListener("click", () => {
  applySolution(level, LEVELS[index].solution);
  refresh();
  announce(`Solution shown for ${LEVELS[index].name}.`);
});

els.prev.addEventListener("click", () => load(index - 1));
els.next.addEventListener("click", () => load(index + 1));

// Arrow keys move between cells so the board is navigable as a grid rather
// than as a long tab sequence.
els.board.addEventListener("keydown", (e) => {
  const step = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
  if (!step) return;
  const active = document.activeElement;
  if (!active?.dataset?.x) return;
  e.preventDefault();

  let x = +active.dataset.x;
  let y = +active.dataset.y;
  for (let i = 0; i < Math.max(level.width, level.height); i++) {
    x += step[0];
    y += step[1];
    if (x < 0 || y < 0 || x >= level.width || y >= level.height) return;
    const next = nodes.find((n) => +n.dataset.x === x && +n.dataset.y === y);
    if (next && next.tagName === "BUTTON") {
      next.focus();
      return;
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  if (e.key === "r" || e.key === "R") els.reset.click();
  if (e.key === "n" || e.key === "N") if (!els.next.disabled) els.next.click();
  if (e.key === "p" || e.key === "P") if (!els.prev.disabled) els.prev.click();
});

window.addEventListener("resize", () => {
  if (level) paint(nodes, els.canvas, level, simulate(level));
});

// Start at the first unsolved level so returning players resume where they were.
const firstUnsolved = LEVELS.findIndex((l) => !solvedIds.has(l.id));
load(firstUnsolved === -1 ? 0 : firstUnsolved);
