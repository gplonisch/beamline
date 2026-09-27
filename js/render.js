/**
 * Rendering.
 *
 * The board is a real DOM grid, one element per cell, and the beams are drawn
 * on a canvas layered over it with pointer-events disabled.
 *
 * That split is deliberate. A canvas-only board is invisible to a screen
 * reader and unreachable by keyboard, and the usual fix is to bolt on a hidden
 * parallel description that drifts out of sync with what is drawn. Here the
 * cells are buttons, so focus, labels, and keyboard activation come from the
 * platform rather than being reimplemented, and the canvas only ever draws
 * light, which is decoration that the text already describes.
 */

import { COLOR_NAMES, EMITTER, EMPTY, FILTER, MIRROR_B, MIRROR_F, SPLITTER, TARGET, WALL, cellAt } from "./engine.js";

export const BEAM_COLORS = {
  1: "#ff6b6b", 2: "#4ade80", 3: "#fbbf24",
  4: "#60a5fa", 5: "#e879f9", 6: "#22d3ee", 7: "#f8fafc",
};

const GLYPH = {
  [MIRROR_F]: "/", [MIRROR_B]: "\\", [SPLITTER]: "S",
  [WALL]: "", [EMITTER]: "", [TARGET]: "", [FILTER]: "",
};

const DIR_LABEL = ["up", "right", "down", "left"];

/** A sentence describing one cell, used as the accessible name. */
export function describeCell(level, x, y, result) {
  const cell = cellAt(level, x, y);
  const where = `column ${x + 1}, row ${y + 1}`;

  switch (cell.type) {
    case WALL:
      return `${where}. Wall.`;
    case EMITTER:
      return `${where}. ${COLOR_NAMES[cell.color]} emitter pointing ${DIR_LABEL[cell.dir]}.`;
    case FILTER:
      return `${where}. ${COLOR_NAMES[cell.color]} filter.`;
    case TARGET: {
      const t = result?.targets.find((t) => t.x === x && t.y === y);
      const want = `wants ${COLOR_NAMES[cell.want]}`;
      if (!t) return `${where}. Target, ${want}.`;
      return t.lit
        ? `${where}. Target lit, ${want}. Complete.`
        : `${where}. Target, ${want}, currently receiving ${COLOR_NAMES[t.got]}.`;
    }
    case MIRROR_F:
      return `${where}. ${cell.placed ? "Your" : "Fixed"} mirror, forward slash.`;
    case MIRROR_B:
      return `${where}. ${cell.placed ? "Your" : "Fixed"} mirror, back slash.`;
    case SPLITTER:
      return `${where}. ${cell.placed ? "Your" : "Fixed"} splitter.`;
    default:
      return `${where}. Empty. Activate to place a mirror.`;
  }
}

/** Build the grid of cell elements once per level. */
export function buildBoard(root, level, onActivate) {
  root.innerHTML = "";
  root.style.setProperty("--cols", level.width);
  root.style.setProperty("--rows", level.height);

  const nodes = [];
  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const base = level.cells[y][x];
      const interactive = base.type === EMPTY;
      const el = document.createElement(interactive ? "button" : "div");
      el.className = "cell";
      el.dataset.x = x;
      el.dataset.y = y;
      if (interactive) {
        el.type = "button";
        el.addEventListener("click", () => onActivate(x, y));
      } else {
        el.setAttribute("role", "img");
      }
      root.appendChild(el);
      nodes.push(el);
    }
  }
  return nodes;
}

/** Repaint cell classes, labels, and the beam canvas. */
export function paint(nodes, canvas, level, result) {
  for (const el of nodes) {
    const x = +el.dataset.x;
    const y = +el.dataset.y;
    const cell = cellAt(level, x, y);

    el.className = "cell";
    el.textContent = GLYPH[cell.type] ?? "";
    el.style.removeProperty("--cell-color");

    switch (cell.type) {
      case WALL: el.classList.add("cell--wall"); break;
      case EMITTER:
        el.classList.add("cell--emitter", `cell--dir-${DIR_LABEL[cell.dir]}`);
        el.style.setProperty("--cell-color", BEAM_COLORS[cell.color]);
        break;
      case FILTER:
        el.classList.add("cell--filter");
        el.style.setProperty("--cell-color", BEAM_COLORS[cell.color]);
        break;
      case TARGET: {
        const t = result.targets.find((t) => t.x === x && t.y === y);
        el.classList.add("cell--target");
        if (t?.lit) el.classList.add("is-lit");
        el.style.setProperty("--cell-color", BEAM_COLORS[cell.want]);
        break;
      }
      case MIRROR_F:
      case MIRROR_B:
      case SPLITTER:
        el.classList.add("cell--piece");
        if (cell.placed) el.classList.add("is-placed");
        break;
      default:
        el.classList.add("cell--empty");
    }

    const label = describeCell(level, x, y, result);
    el.setAttribute("aria-label", label);
    el.title = label;
  }

  drawBeams(canvas, level, result);
}

function drawBeams(canvas, level, result) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (rect.width === 0) return;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const cw = rect.width / level.width;
  const ch = rect.height / level.height;
  const cx = (x) => (x + 0.5) * cw;
  const cy = (y) => (y + 0.5) * ch;

  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(2, Math.min(cw, ch) * 0.1);

  // Darkest first so brighter mixes draw over them.
  const order = [...result.segments].sort((a, b) => a.color - b.color);
  for (const s of order) {
    ctx.strokeStyle = BEAM_COLORS[s.color] ?? "#f8fafc";
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.moveTo(cx(s.x1), cy(s.y1));
    ctx.lineTo(cx(s.x2), cy(s.y2));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
