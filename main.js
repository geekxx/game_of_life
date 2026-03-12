/**
 * Conway's Game of Life — main entry point.
 *
 * Wires together engine, renderer, and simulation controller,
 * then attaches all UI event handlers.
 */

import { createGrid, getCell, setCell } from './engine.js';
import { createRenderer }               from './renderer.js';
import { createSimulation }             from './simulation.js';

// ── Preset patterns ────────────────────────────────────────────────────────
// Each pattern is a list of [row, col] offsets from the top-left corner of
// the pattern's bounding box. They are centred on the grid when loaded.
const PRESETS = {
  glider: {
    label: 'Glider',
    cells: [[0,1],[1,2],[2,0],[2,1],[2,2]],
  },
  blinker: {
    label: 'Blinker',
    cells: [[0,0],[0,1],[0,2]],
  },
  rpentomino: {
    label: 'R-pentomino',
    cells: [[0,1],[0,2],[1,0],[1,1],[2,1]],
  },
  pulsar: {
    label: 'Pulsar',
    cells: [
      [0,2],[0,3],[0,4],[0,8],[0,9],[0,10],
      [2,0],[2,5],[2,7],[2,12],
      [3,0],[3,5],[3,7],[3,12],
      [4,0],[4,5],[4,7],[4,12],
      [5,2],[5,3],[5,4],[5,8],[5,9],[5,10],
      [7,2],[7,3],[7,4],[7,8],[7,9],[7,10],
      [8,0],[8,5],[8,7],[8,12],
      [9,0],[9,5],[9,7],[9,12],
      [10,0],[10,5],[10,7],[10,12],
      [12,2],[12,3],[12,4],[12,8],[12,9],[12,10],
    ],
  },
  gosper: {
    label: 'Gosper Glider Gun',
    cells: [
      [0,24],
      [1,22],[1,24],
      [2,12],[2,13],[2,20],[2,21],[2,34],[2,35],
      [3,11],[3,15],[3,20],[3,21],[3,34],[3,35],
      [4,0],[4,1],[4,10],[4,16],[4,20],[4,21],
      [5,0],[5,1],[5,10],[5,14],[5,16],[5,17],[5,22],[5,24],
      [6,10],[6,16],[6,24],
      [7,11],[7,15],
      [8,12],[8,13],
    ],
  },
};

/**
 * Build a grid with a preset pattern centred on it.
 * Cells that fall outside the grid are silently clipped.
 *
 * @param {string} key   - Key from PRESETS
 * @param {number} rows
 * @param {number} cols
 * @returns {{ rows, cols, cells: Uint8Array } | null}
 */
function buildPresetGrid(key, rows, cols) {
  const preset = PRESETS[key];
  if (!preset) {
    console.warn(`Unknown preset: "${key}"`);
    return null;
  }

  // Bounding box of the pattern.
  const maxDr = Math.max(...preset.cells.map(([r]) => r));
  const maxDc = Math.max(...preset.cells.map(([, c]) => c));

  // Centre offset.
  const originRow = Math.floor((rows - maxDr - 1) / 2);
  const originCol = Math.floor((cols - maxDc - 1) / 2);

  const cells = new Uint8Array(rows * cols);
  for (const [dr, dc] of preset.cells) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r >= 0 && r < rows && c >= 0 && c < cols) {
      cells[r * cols + c] = 1;
    }
  }
  return { rows, cols, cells };
}

// ── DOM references ─────────────────────────────────────────────────────────
const canvas         = document.getElementById('game-canvas');
const genCounter     = document.getElementById('gen-counter');
const btnPlay        = document.getElementById('btn-play');
const btnStep        = document.getElementById('btn-step');
const btnReset       = document.getElementById('btn-reset');
const speedSelect    = document.getElementById('speed-select');
const sizeSelect     = document.getElementById('size-select');
const customInputs   = document.getElementById('custom-size-inputs');
const customRowsEl   = document.getElementById('custom-rows');
const customColsEl   = document.getElementById('custom-cols');
const btnApplySize   = document.getElementById('btn-apply-size');
const presetSelect   = document.getElementById('preset-select');
const canvasWrap     = document.querySelector('.canvas-wrap');

// ── Canvas sizing ──────────────────────────────────────────────────────────
function resizeCanvas() {
  canvas.width  = canvasWrap.clientWidth;
  canvas.height = canvasWrap.clientHeight;
}

resizeCanvas();

window.addEventListener('resize', () => {
  resizeCanvas();
  const g = sim.getGrid();
  if (g) renderer.draw(g);
});

// ── Renderer + Simulation ──────────────────────────────────────────────────
const renderer = createRenderer(canvas);

const sim = createSimulation(renderer, {
  fps: 10,
  onUpdate(gen, state) {
    // Update generation counter.
    genCounter.textContent = gen;

    // Update play/pause button.
    if (state === 'playing') {
      btnPlay.textContent = '\u23F8 Pause';
      btnPlay.classList.add('btn-primary');
      btnStep.disabled = true;
      canvas.classList.add('playing');
    } else {
      btnPlay.textContent = '\u25B6 Play';
      btnPlay.classList.remove('btn-primary');
      btnStep.disabled = false;
      canvas.classList.remove('playing');
    }
  },
});

// ── Grid initialisation ────────────────────────────────────────────────────
let gridRows = 50;
let gridCols = 50;

function initGrid(rows, cols, presetKey = null) {
  gridRows = rows;
  gridCols = cols;

  const grid = presetKey
    ? (buildPresetGrid(presetKey, rows, cols) ?? createGrid(rows, cols))
    : createGrid(rows, cols);

  sim.setGrid(grid);
}

initGrid(50, 50);

// ── Playback controls ──────────────────────────────────────────────────────
btnPlay.addEventListener('click', () => {
  if (sim.getState() === 'playing') {
    sim.pause();
  } else {
    sim.start();
  }
});

btnStep.addEventListener('click', () => sim.step());

btnReset.addEventListener('click', () => sim.reset());

speedSelect.addEventListener('change', () => {
  sim.setSpeed(Number(speedSelect.value));
});

// ── Grid size selector ─────────────────────────────────────────────────────
sizeSelect.addEventListener('change', () => {
  if (sizeSelect.value === 'custom') {
    customInputs.classList.remove('hidden');
    return;
  }
  customInputs.classList.add('hidden');
  const [r, c] = sizeSelect.value.split('x').map(Number);
  initGrid(r, c);
});

btnApplySize.addEventListener('click', () => {
  const r = Math.min(500, Math.max(5, parseInt(customRowsEl.value, 10) || 50));
  const c = Math.min(500, Math.max(5, parseInt(customColsEl.value, 10) || 50));
  customRowsEl.value = r;
  customColsEl.value = c;
  initGrid(r, c);
});

// ── Preset selector ────────────────────────────────────────────────────────
presetSelect.addEventListener('change', () => {
  const key = presetSelect.value;
  if (!key) return;

  initGrid(gridRows, gridCols, key);

  // Reset the select back to the placeholder so it can be triggered again.
  presetSelect.value = '';
});

// ── Cell painting (click + drag) ───────────────────────────────────────────
let isPainting  = false;
let paintAlive  = true; // determined by the first cell the user touches

canvas.addEventListener('mousedown', (e) => {
  if (sim.getState() === 'playing') return;

  const grid = sim.getGrid();
  if (!grid) return;

  const pos = renderer.canvasToGrid(e.offsetX, e.offsetY, grid);
  if (!pos) return;

  isPainting = true;
  paintAlive = !getCell(grid, pos.row, pos.col); // toggle based on first cell

  const newGrid = setCell(grid, pos.row, pos.col, paintAlive);
  sim.updateCurrentGrid(newGrid);
});

canvas.addEventListener('mousemove', (e) => {
  if (!isPainting || sim.getState() === 'playing') return;

  const grid = sim.getGrid();
  if (!grid) return;

  const pos = renderer.canvasToGrid(e.offsetX, e.offsetY, grid);
  if (!pos) return;

  const newGrid = setCell(grid, pos.row, pos.col, paintAlive);
  sim.updateCurrentGrid(newGrid);
});

canvas.addEventListener('mouseup',    () => { isPainting = false; });
canvas.addEventListener('mouseleave', () => { isPainting = false; });

// Touch support for mobile.
function canvasTouchPos(e) {
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const touch = e.touches[0] || e.changedTouches[0];
  return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
}

canvas.addEventListener('touchstart', (e) => {
  if (sim.getState() === 'playing') return;
  const grid = sim.getGrid();
  if (!grid) return;
  const { x, y } = canvasTouchPos(e);
  const pos = renderer.canvasToGrid(x, y, grid);
  if (!pos) return;
  isPainting = true;
  paintAlive = !getCell(grid, pos.row, pos.col);
  sim.updateCurrentGrid(setCell(grid, pos.row, pos.col, paintAlive));
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  if (!isPainting || sim.getState() === 'playing') return;
  const grid = sim.getGrid();
  if (!grid) return;
  const { x, y } = canvasTouchPos(e);
  const pos = renderer.canvasToGrid(x, y, grid);
  if (!pos) return;
  sim.updateCurrentGrid(setCell(grid, pos.row, pos.col, paintAlive));
}, { passive: false });

canvas.addEventListener('touchend',   () => { isPainting = false; });
canvas.addEventListener('touchcancel',() => { isPainting = false; });
