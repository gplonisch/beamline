/**
 * Rendering.
 *
 * The board is a real DOM grid, one button per buildable cell, and everything
 * optical (lamps, mirrors, sensors, the light itself) is drawn on a canvas
 * layered exactly over it with pointer events off.
 *
 * That split is deliberate. A canvas-only board is invisible to a screen
 * reader and unreachable by keyboard, and the usual fix is a hidden parallel
 * description that drifts out of sync with what is drawn. Here the cells are
 * buttons, so focus, labels and activation come from the platform, and every
 * label is generated from the same state the canvas draws.
 *
 * Geometry comes from the cells, not from arithmetic on the board's size. The
 * canvas is sized to the stage in CSS and to the device's pixel ratio here, and
 * each piece is drawn at the measured centre of its own cell element, so gaps,
 * borders and rounding can never put light in a different place from the cell
 * it belongs to. An earlier version divided an unsized canvas by the grid
 * dimensions and drew every beam into the top-left corner; the browser test in
 * tests/browser.spec.mjs now checks light lands on the target's pixels.
 *
 * Light is drawn with additive blending ("lighter"), so where a red beam and a
 * green beam overlap on screen they really do look yellow. The rule the game
 * scores is the same rule the screen shows.
 */

import {
  COLOR_CODES, COLOR_NAMES, EMITTER, EMPTY, FILTER, MIRROR_B, MIRROR_F, SPLITTER, TARGET, WALL, cellAt,
} from "./engine.js";

/** On-screen light. Primaries chosen so additive mixes land near the named colour. */
export const BEAM_COLORS = {
  1: "#ff4a3d", 2: "#3dff6e", 3: "#ffe04a",
  4: "#4a6dff", 5: "#ff52f0", 6: "#3df2ff", 7: "#ffffff",
};

const DIR_LABEL = ["up", "right", "down", "left"];

export const PIECE_NAMES = {
  [MIRROR_F]: "forward mirror",
  [MIRROR_B]: "back mirror",
  [SPLITTER]: "splitter",
};

const wantText = (want) => (want === 0 ? "wants darkness" : `wants ${COLOR_NAMES[want]}`);

/** A sentence describing one cell, used as its accessible name and tooltip. */
export function describeCell(level, x, y, result) {
  const cell = cellAt(level, x, y);
  const where = `Column ${x + 1}, row ${y + 1}`;

  switch (cell.type) {
    case WALL:
      return `${where}. Wall.`;
    case EMITTER:
      return `${where}. ${cap(COLOR_NAMES[cell.color])} lamp pointing ${DIR_LABEL[cell.dir]}.`;
    case FILTER:
      return `${where}. ${cap(COLOR_NAMES[cell.color])} filter.`;
    case TARGET: {
      const t = result?.targets.find((t) => t.x === x && t.y === y);
      const kind = cell.want === 0 ? "Dark sensor" : "Sensor";
      if (!t) return `${where}. ${kind}, ${wantText(cell.want)}.`;
      if (t.lit) return `${where}. ${kind}, ${wantText(cell.want)}. Satisfied.`;
      return `${where}. ${kind}, ${wantText(cell.want)}, receiving ${COLOR_NAMES[t.got]}.`;
    }
    case MIRROR_F:
    case MIRROR_B:
    case SPLITTER:
      return cell.placed
        ? `${where}. Your ${PIECE_NAMES[cell.type]}.`
        : `${where}. Fixed ${PIECE_NAMES[cell.type]}, cannot be moved.`;
    default:
      return `${where}. Empty.`;
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Build the grid of cell elements once per level. */
export function buildBoard(root, level, handlers) {
  root.innerHTML = "";
  root.style.setProperty("--cols", level.width);
  root.style.setProperty("--rows", level.height);
  root.setAttribute("aria-label", `${level.name}, ${level.width} by ${level.height} board`);

  const nodes = [];
  for (let y = 0; y < level.height; y++) {
    const row = document.createElement("div");
    row.setAttribute("role", "row");
    row.className = "board__row";
    for (let x = 0; x < level.width; x++) {
      const base = level.cells[y][x];
      const buildable = base.type === EMPTY;
      const el = document.createElement(buildable ? "button" : "div");
      el.className = "cell";
      el.dataset.x = x;
      el.dataset.y = y;
      el.setAttribute("role", "gridcell");
      if (buildable) {
        el.type = "button";
        el.tabIndex = -1;
        el.addEventListener("click", () => handlers.activate(x, y));
        el.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          handlers.clear(x, y);
        });
        el.addEventListener("pointerenter", () => handlers.hover(x, y));
        el.addEventListener("pointerleave", () => handlers.hover(null));
        el.addEventListener("focus", () => handlers.hover(x, y));
        el.addEventListener("blur", () => handlers.hover(null));
      } else {
        el.tabIndex = -1;
      }
      row.appendChild(el);
      nodes.push(el);
    }
    root.appendChild(row);
  }
  return nodes;
}

/** Update cell classes and accessible names. Cheap; runs after every move. */
export function labelCells(nodes, level, result) {
  for (const el of nodes) {
    const x = +el.dataset.x;
    const y = +el.dataset.y;
    const cell = cellAt(level, x, y);
    el.className = "cell";
    if (cell.type === WALL) el.classList.add("cell--wall");
    else if (cell.placed) el.classList.add("cell--placed");
    else if (cell.type !== EMPTY) el.classList.add("cell--fixed");
    const label = describeCell(level, x, y, result);
    el.setAttribute("aria-label", label);
    el.title = label;
  }
}

/* ---------------------------------------------------------------------- */
/* Canvas                                                                  */
/* ---------------------------------------------------------------------- */

/** Measure each cell's centre and size in canvas (CSS pixel) coordinates. */
export function measure(nodes, canvas) {
  const origin = canvas.getBoundingClientRect();
  const map = new Map();
  for (const el of nodes) {
    const r = el.getBoundingClientRect();
    map.set(`${el.dataset.x},${el.dataset.y}`, {
      cx: r.left - origin.left + r.width / 2,
      cy: r.top - origin.top + r.height / 2,
      s: Math.min(r.width, r.height),
    });
  }
  return { width: origin.width, height: origin.height, cells: map };
}

/** Size the backing store to the element and the device pixel ratio. */
function prepare(canvas, geo) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.round(geo.width * dpr);
  const h = Math.round(geo.height * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, geo.width, geo.height);
  return ctx;
}

/**
 * Draw one frame. `t` is seconds, used only for the travelling sparkle on
 * beams and the breathing of satisfied sensors; pass 0 for a still frame.
 */
export function draw(canvas, geo, level, result, { t = 0, hover = null, preview = null, solved = false, codes = false } = {}) {
  if (geo.width === 0) return;
  const ctx = prepare(canvas, geo);
  const at = (x, y) => geo.cells.get(`${x},${y}`);

  drawBeams(ctx, at, result, t);

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const cell = cellAt(level, x, y);
      const g = at(x, y);
      switch (cell.type) {
        case EMITTER: drawLamp(ctx, g, cell); break;
        case FILTER: drawFilter(ctx, g, cell.color); break;
        case TARGET: drawSensor(ctx, g, cell, result.targets.find((q) => q.x === x && q.y === y), t, solved); break;
        case MIRROR_F:
        case MIRROR_B: drawMirror(ctx, g, cell.type, !cell.placed); break;
        case SPLITTER: drawSplitter(ctx, g, !cell.placed); break;
      }
    }
  }

  // Letter codes, so colour is never the only way to read the board.
  if (codes) {
    for (let y = 0; y < level.height; y++) {
      for (let x = 0; x < level.width; x++) {
        const cell = cellAt(level, x, y);
        if (cell.type === EMITTER || cell.type === FILTER) drawCode(ctx, at(x, y), COLOR_CODES[cell.color]);
        if (cell.type === TARGET) drawCode(ctx, at(x, y), cell.want === 0 ? "D" : COLOR_CODES[cell.want]);
      }
    }
  }

  if (hover && preview) {
    ctx.save();
    ctx.globalAlpha = 0.38;
    const g = at(hover.x, hover.y);
    if (preview === SPLITTER) drawSplitter(ctx, g, false);
    else if (preview === EMPTY) drawCross(ctx, g);
    else drawMirror(ctx, g, preview, false);
    ctx.restore();
  }
}

function drawBeams(ctx, at, result, t) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const s of result.segments) {
    const a = at(s.x1, s.y1);
    const b = at(s.x2, s.y2);
    const col = BEAM_COLORS[s.color];
    if (!col) continue;
    const w = a.s;

    // Wide soft halo, then a bright core.
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.16;
    ctx.lineWidth = w * 0.34;
    line(ctx, a, b);
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = Math.max(2, w * 0.075);
    line(ctx, a, b);

    // A faint travelling sparkle so light reads as moving.
    if (t > 0) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, w * 0.035);
      ctx.setLineDash([w * 0.12, w * 0.88]);
      ctx.lineDashOffset = -t * w * 1.6;
      line(ctx, a, b);
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.cx, a.cy);
  ctx.lineTo(b.cx, b.cy);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawLamp(ctx, g, cell) {
  const { cx, cy, s } = g;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((cell.dir * Math.PI) / 2); // 0 = up

  // Nozzle, pointing up before rotation.
  ctx.fillStyle = "#3a4352";
  roundRect(ctx, -s * 0.12, -s * 0.47, s * 0.24, s * 0.26, s * 0.04);
  ctx.fill();

  // Housing.
  const grad = ctx.createLinearGradient(0, -s * 0.3, 0, s * 0.3);
  grad.addColorStop(0, "#4b5567");
  grad.addColorStop(1, "#262c37");
  ctx.fillStyle = grad;
  roundRect(ctx, -s * 0.3, -s * 0.3, s * 0.6, s * 0.6, s * 0.12);
  ctx.fill();

  // Lens with glow.
  const col = BEAM_COLORS[cell.color];
  ctx.shadowColor = col;
  ctx.shadowBlur = s * 0.35;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFilter(ctx, g, color) {
  const { cx, cy, s } = g;
  const col = BEAM_COLORS[color];
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = col;
  roundRect(ctx, cx - s * 0.36, cy - s * 0.36, s * 0.72, s * 0.72, s * 0.08);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  ctx.stroke();
  // Glass sheen.
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.24, cy + s * 0.08);
  ctx.lineTo(cx - s * 0.08, cy - s * 0.24);
  ctx.stroke();
  ctx.restore();
}

function drawSensor(ctx, g, cell, state, t, solved) {
  const { cx, cy, s } = g;
  const dark = cell.want === 0;
  const lit = state?.lit;
  const got = state?.got ?? 0;
  const ring = dark ? "#8c96a8" : BEAM_COLORS[cell.want];

  ctx.save();
  // Housing.
  ctx.fillStyle = "#0a0d12";
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // Ring in the wanted colour; a dark sensor has a dashed grey ring.
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(2, s * 0.07);
  if (dark) ctx.setLineDash([s * 0.08, s * 0.06]);
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (dark) {
    // A closed eyelid: the sensor is satisfied only while nothing reaches it.
    ctx.strokeStyle = got ? BEAM_COLORS[got] : "#8c96a8";
    ctx.lineWidth = Math.max(1.5, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.15, cy);
    ctx.lineTo(cx + s * 0.15, cy);
    ctx.stroke();
  }

  if (lit && !dark) {
    const pulse = t > 0 ? 0.5 + 0.5 * Math.sin(t * 3) : 1;
    ctx.shadowColor = ring;
    ctx.shadowBlur = s * (solved ? 0.5 + 0.25 * pulse : 0.4);
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (got && !dark) {
    // Show what is arriving, so a wrong colour is visible, not just "unlit".
    ctx.fillStyle = BEAM_COLORS[got];
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMirror(ctx, g, kind, fixed) {
  const { cx, cy, s } = g;
  const d = s * 0.34;
  // "/" runs bottom-left to top-right; "\" top-left to bottom-right.
  const [x1, y1, x2, y2] = kind === MIRROR_F
    ? [cx - d, cy + d, cx + d, cy - d]
    : [cx - d, cy - d, cx + d, cy + d];

  ctx.save();
  ctx.lineCap = "round";
  // Mount.
  ctx.strokeStyle = fixed ? "#8a6a3a" : "#2b3442";
  ctx.lineWidth = s * 0.17;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  // Silvered face.
  const grad = ctx.createLinearGradient(x1, y1, x2, y2);
  if (fixed) {
    grad.addColorStop(0, "#f3d9a4"); grad.addColorStop(0.5, "#fff4dc"); grad.addColorStop(1, "#c9a463");
  } else {
    grad.addColorStop(0, "#c7d3e3"); grad.addColorStop(0.5, "#ffffff"); grad.addColorStop(1, "#9fb0c6");
  }
  ctx.strokeStyle = grad;
  ctx.lineWidth = s * 0.08;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  if (fixed) drawBolts(ctx, [[x1, y1], [x2, y2]], s);
  ctx.restore();
}

function drawSplitter(ctx, g, fixed) {
  const { cx, cy, s } = g;
  const h = s * 0.27;
  ctx.save();
  ctx.fillStyle = fixed ? "rgba(230, 196, 130, 0.22)" : "rgba(170, 205, 255, 0.2)";
  ctx.strokeStyle = fixed ? "#e2c38a" : "#cfe0f7";
  ctx.lineWidth = Math.max(1.5, s * 0.045);
  roundRect(ctx, cx - h, cy - h, h * 2, h * 2, s * 0.04);
  ctx.fill();
  ctx.stroke();
  // The half-silvered diagonal.
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - h, cy - h);
  ctx.lineTo(cx + h, cy + h);
  ctx.stroke();
  // A small clockwise arrow: the copy always turns clockwise.
  ctx.globalAlpha = 1;
  ctx.lineWidth = Math.max(1.2, s * 0.03);
  const r = s * 0.1;
  const ax = cx + h * 0.42;
  const ay = cy - h * 0.42;
  ctx.beginPath();
  ctx.arc(ax, ay, r, Math.PI * 1.1, Math.PI * 0.35);
  ctx.stroke();
  const ex = ax + r * Math.cos(Math.PI * 0.35);
  const ey = ay + r * Math.sin(Math.PI * 0.35);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - s * 0.06, ey - s * 0.01);
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex + s * 0.005, ey - s * 0.06);
  ctx.stroke();
  if (fixed) drawBolts(ctx, [[cx - h, cy + h], [cx + h, cy - h]], s);
  ctx.restore();
}

function drawCode(ctx, g, letter) {
  const { cx, cy, s } = g;
  const size = Math.max(9, s * 0.22);
  const bx = cx - s * 0.5 + size * 0.15;
  const by = cy - s * 0.5 + size * 0.15;
  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 12, .85)";
  roundRect(ctx, bx, by, size * 1.05, size * 1.05, size * 0.22);
  ctx.fill();
  ctx.fillStyle = "#f3f1ec";
  ctx.font = `600 ${Math.round(size * 0.78)}px Fraunces, Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, bx + size * 0.525, by + size * 0.57);
  ctx.restore();
}

function drawBolts(ctx, points, s) {
  ctx.fillStyle = "#5c4724";
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, s * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCross(ctx, g) {
  const { cx, cy, s } = g;
  const d = s * 0.14;
  ctx.save();
  ctx.strokeStyle = "#cfd8e6";
  ctx.lineWidth = Math.max(1.5, s * 0.04);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d);
  ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d);
  ctx.stroke();
  ctx.restore();
}

/** Small standalone icons for the legend, drawn with the same code as the board. */
export function drawIcon(canvas, kind, color = 7) {
  const size = 40;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = { cx: size / 2, cy: size / 2, s: size };
  switch (kind) {
    case "lamp": drawLamp(ctx, g, { dir: 1, color }); break;
    case "sensor": drawSensor(ctx, g, { want: color }, { lit: true, got: color }, 0, false); break;
    case "dark": drawSensor(ctx, g, { want: 0 }, { lit: true, got: 0 }, 0, false); break;
    case "filter": drawFilter(ctx, g, color); break;
    case MIRROR_F:
    case MIRROR_B: drawMirror(ctx, g, kind, false); break;
    case SPLITTER: drawSplitter(ctx, g, false); break;
    case "fixed": drawMirror(ctx, g, MIRROR_B, true); break;
  }
}
