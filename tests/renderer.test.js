/**
 * Unit tests for renderer.js — Canvas-based grid renderer.
 *
 * Runnable in Node.js:
 *   node tests/renderer.test.js
 *
 * Uses only Node's built-in `assert` module — no dependencies.
 * Mocks HTMLCanvasElement and CanvasRenderingContext2D.
 */

import assert from 'node:assert/strict';
import { createRenderer } from '../renderer.js';
import { createGrid } from '../engine.js';

// ── Minimal test runner ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(label, fn) {
  try {
    fn();
    console.log(`  ✓  ${label}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${label}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function describe(label, fn) {
  console.log(`\n${label}`);
  fn();
}

// ── Mock canvas factory ─────────────────────────────────────────────────────

function createMockCanvas(width = 100, height = 100) {
  const calls = [];
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect(x, y, w, h) {
      calls.push({ method: 'fillRect', args: [x, y, w, h], fillStyle: this.fillStyle });
    },
    beginPath() { calls.push({ method: 'beginPath' }); },
    moveTo(x, y) { calls.push({ method: 'moveTo', args: [x, y] }); },
    lineTo(x, y) { calls.push({ method: 'lineTo', args: [x, y] }); },
    stroke() { calls.push({ method: 'stroke' }); },
  };
  const canvas = {
    width,
    height,
    getContext(type) { return type === '2d' ? ctx : null; },
  };
  return { canvas, ctx, calls };
}

// ── canvasToGrid ──────────────────────────────────────────────────────────
describe('canvasToGrid', () => {
  test('maps pixel coordinates to correct grid cells', () => {
    // 100x100 canvas, 10x10 grid → cellSize = 10, offset = 0
    const { canvas } = createMockCanvas(100, 100);
    const renderer = createRenderer(canvas);
    const grid = createGrid(10, 10);

    assert.deepEqual(renderer.canvasToGrid(5, 5, grid), { row: 0, col: 0 });
    assert.deepEqual(renderer.canvasToGrid(15, 5, grid), { row: 0, col: 1 });
    assert.deepEqual(renderer.canvasToGrid(95, 95, grid), { row: 9, col: 9 });
    assert.deepEqual(renderer.canvasToGrid(0, 0, grid), { row: 0, col: 0 });
    assert.deepEqual(renderer.canvasToGrid(99, 99, grid), { row: 9, col: 9 });
  });

  test('returns null for coordinates outside the grid area', () => {
    // 100x100 canvas, 3x3 grid → cellSize = floor(min(100/3, 100/3)) = 33
    // gridW = 99, offsetX = floor((100-99)/2) = 0
    const { canvas } = createMockCanvas(100, 100);
    const renderer = createRenderer(canvas);
    const grid = createGrid(3, 3);

    // x=99 → col = floor(99/33) = 3 → out of bounds
    assert.equal(renderer.canvasToGrid(99, 50, grid), null);
    // Beyond canvas
    assert.equal(renderer.canvasToGrid(100, 50, grid), null);
    // Negative coordinates
    assert.equal(renderer.canvasToGrid(-1, 50, grid), null);
    assert.equal(renderer.canvasToGrid(50, -1, grid), null);
  });

  test('accounts for centering offset', () => {
    // 200x100 canvas, 10x10 grid → cellSize = min(floor(200/10), floor(100/10)) = 10
    // gridW = 100, offsetX = floor((200-100)/2) = 50
    const { canvas } = createMockCanvas(200, 100);
    const renderer = createRenderer(canvas);
    const grid = createGrid(10, 10);

    // Before the grid offset → null
    assert.equal(renderer.canvasToGrid(49, 50, grid), null);
    // First cell starts at x=50
    assert.deepEqual(renderer.canvasToGrid(50, 0, grid), { row: 0, col: 0 });
    // Last cell ends at x=150
    assert.deepEqual(renderer.canvasToGrid(149, 99, grid), { row: 9, col: 9 });
    // Just past the grid
    assert.equal(renderer.canvasToGrid(150, 50, grid), null);
  });
});

// ── setCellSize ───────────────────────────────────────────────────────────
describe('setCellSize', () => {
  test('overrides automatic cell size calculation', () => {
    // 100x100 canvas, 10x10 grid → auto cellSize = 10
    // Override to 5 → gridW = 50, offsetX = 25
    const { canvas } = createMockCanvas(100, 100);
    const renderer = createRenderer(canvas);
    const grid = createGrid(10, 10);

    renderer.setCellSize(5);
    // At x=25, y=25 → first cell (0,0)
    assert.deepEqual(renderer.canvasToGrid(25, 25, grid), { row: 0, col: 0 });
    // At x=24, y=25 → before grid → null
    assert.equal(renderer.canvasToGrid(24, 25, grid), null);
  });

  test('reverts to auto-sizing when set to null', () => {
    const { canvas } = createMockCanvas(100, 100);
    const renderer = createRenderer(canvas);
    const grid = createGrid(10, 10);

    renderer.setCellSize(5);
    // With override, x=5 is inside grid (offset=25, so actually not)
    // Let's verify offset changed
    assert.equal(renderer.canvasToGrid(24, 0, grid), null);

    renderer.setCellSize(null);
    // Back to auto: cellSize=10, offset=0, so x=5 is cell (0,0)
    assert.deepEqual(renderer.canvasToGrid(5, 5, grid), { row: 0, col: 0 });
  });
});

// ── draw ──────────────────────────────────────────────────────────────────
describe('draw', () => {
  test('calls fillRect for background and each cell', () => {
    // Use small canvas so cellSize < 4 → no grid lines drawn.
    // 6x6 canvas, 2x2 grid → cellSize = 3
    const { canvas, calls } = createMockCanvas(6, 6);
    const renderer = createRenderer(canvas);
    const grid = createGrid(2, 2, [[true, false],[false, true]]);

    renderer.draw(grid);

    const fillRects = calls.filter(c => c.method === 'fillRect');
    // 1 background clear + 4 cells = 5 fillRect calls
    assert.equal(fillRects.length, 5);

    // First call is the background clear (full canvas).
    assert.deepEqual(fillRects[0].args, [0, 0, 6, 6]);
  });

  test('uses alive colour for alive cells and dead colour for dead cells', () => {
    const { canvas, calls } = createMockCanvas(6, 6);
    const renderer = createRenderer(canvas, {
      aliveColor: '#00ff00',
      deadColor: '#000000',
    });
    const grid = createGrid(2, 2, [[true, false],[false, false]]);

    renderer.draw(grid);

    const fillRects = calls.filter(c => c.method === 'fillRect');
    // fillRects[0] = background, [1] = cell(0,0) alive, [2] = cell(0,1) dead, etc.
    assert.equal(fillRects[1].fillStyle, '#00ff00'); // alive
    assert.equal(fillRects[2].fillStyle, '#000000'); // dead
  });

  test('draws grid lines when cell size >= 4', () => {
    // 40x40 canvas, 10x10 grid → cellSize = 4 → grid lines drawn.
    const { canvas, calls } = createMockCanvas(40, 40);
    const renderer = createRenderer(canvas);
    const grid = createGrid(10, 10);

    renderer.draw(grid);

    const strokes = calls.filter(c => c.method === 'stroke');
    assert.ok(strokes.length > 0, 'expected grid line stroke calls');
  });

  test('omits grid lines when cell size < 4', () => {
    // 6x6 canvas, 2x2 grid → cellSize = 3 → no grid lines.
    const { canvas, calls } = createMockCanvas(6, 6);
    const renderer = createRenderer(canvas);
    const grid = createGrid(2, 2);

    renderer.draw(grid);

    const strokes = calls.filter(c => c.method === 'stroke');
    assert.equal(strokes.length, 0, 'expected no grid line stroke calls');
  });
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
