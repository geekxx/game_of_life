/**
 * Simulation controller for Conway's Game of Life.
 *
 * Uses requestAnimationFrame with an elapsed-time accumulator to drive
 * generation steps at a configurable frame rate without drift.
 *
 * State machine: 'paused' | 'playing'
 */

import { nextGeneration } from './engine.js';

/**
 * Creates a simulation controller.
 *
 * @param {object} renderer  - Renderer returned by createRenderer()
 * @param {object} [options]
 * @param {number} [options.fps=10]           - Initial frames (generations) per second
 * @param {Function} [options.onUpdate]       - Called after each state change: (generation, state) => void
 * @returns {{ start, pause, step, reset, setGrid, updateCurrentGrid, getGrid, getState, setSpeed }}
 */
export function createSimulation(renderer, options = {}) {
  let fps = typeof options.fps === 'number' && options.fps > 0 ? options.fps : 10;
  const onUpdate = typeof options.onUpdate === 'function' ? options.onUpdate : null;

  /** @type {{ rows: number, cols: number, cells: Uint8Array } | null} */
  let currentGrid = null;

  /** @type {{ rows: number, cols: number, cells: Uint8Array } | null} */
  let initialGrid = null;

  let generation = 0;
  let state = 'paused'; // 'paused' | 'playing'

  let rafId = null;
  let lastStepTime = 0;

  // ── rAF loop ──────────────────────────────────────────────────────────────

  function loop(timestamp) {
    if (state !== 'playing') return;

    rafId = requestAnimationFrame(loop);

    const interval = 1000 / fps;
    if (timestamp - lastStepTime < interval) return;

    // Advance by however many full intervals have elapsed (handles tab-focus lag).
    // Cap at 100 to avoid a massive frame-time spike after a long background tab.
    const steps = Math.min(100, Math.max(1, Math.floor((timestamp - lastStepTime) / interval)));
    lastStepTime = timestamp;

    for (let i = 0; i < steps; i++) {
      currentGrid = nextGeneration(currentGrid);
      generation++;
    }

    renderer.draw(currentGrid);
    if (onUpdate) onUpdate(generation, state);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Start the simulation. No-op if already playing or no grid is set.
   */
  function start() {
    if (state === 'playing' || currentGrid === null) return;
    state = 'playing';
    rafId = requestAnimationFrame((ts) => {
      lastStepTime = ts;
      loop(ts);
    });
    if (onUpdate) onUpdate(generation, state);
  }

  /**
   * Pause the simulation. No-op if already paused.
   */
  function pause() {
    if (state === 'paused') return;
    state = 'paused';
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (onUpdate) onUpdate(generation, state);
  }

  /**
   * Advance exactly one generation. No-op while playing or if no grid is set.
   */
  function step() {
    if (state === 'playing' || currentGrid === null) return;
    currentGrid = nextGeneration(currentGrid);
    generation++;
    renderer.draw(currentGrid);
    if (onUpdate) onUpdate(generation, state);
  }

  /**
   * Reset to the initial grid state and pause.
   * If an override grid is supplied it becomes the new initial + current grid.
   *
   * @param {{ rows: number, cols: number, cells: Uint8Array } | null} [grid]
   */
  function reset(grid = null) {
    pause();

    if (grid !== null) {
      initialGrid = { rows: grid.rows, cols: grid.cols, cells: new Uint8Array(grid.cells) };
    }

    if (initialGrid !== null) {
      currentGrid = { rows: initialGrid.rows, cols: initialGrid.cols, cells: new Uint8Array(initialGrid.cells) };
      generation = 0;
      renderer.draw(currentGrid);
    }

    if (onUpdate) onUpdate(generation, state);
  }

  /**
   * Replace both the initial grid and the current grid.
   * Pauses the simulation and resets the generation counter.
   * Use this for preset/size changes.
   *
   * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
   */
  function setGrid(grid) {
    pause();
    initialGrid = { rows: grid.rows, cols: grid.cols, cells: new Uint8Array(grid.cells) };
    currentGrid = { rows: grid.rows, cols: grid.cols, cells: new Uint8Array(grid.cells) };
    generation = 0;
    renderer.draw(currentGrid);
    if (onUpdate) onUpdate(generation, state);
  }

  /**
   * Update only the current grid (e.g. during cell painting).
   * Does NOT change initialGrid so Reset still goes back to the pre-paint state.
   *
   * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
   */
  function updateCurrentGrid(grid) {
    currentGrid = grid;
    renderer.draw(currentGrid);
  }

  /**
   * Change the simulation speed.
   * @param {number} newFps
   */
  function setSpeed(newFps) {
    if (typeof newFps === 'number' && newFps > 0) {
      fps = newFps;
    }
  }

  /** @returns {{ rows: number, cols: number, cells: Uint8Array } | null} */
  function getGrid() {
    return currentGrid;
  }

  /** @returns {'paused'|'playing'} */
  function getState() {
    return state;
  }

  return { start, pause, step, reset, setGrid, updateCurrentGrid, getGrid, getState, setSpeed };
}
