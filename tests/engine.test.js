/**
 * Unit tests for engine.js — Conway's Game of Life core logic.
 *
 * Runnable in Node.js:
 *   node tests/engine.test.js
 *
 * Uses only Node's built-in `assert` module — no dependencies.
 * Exits with code 0 on all-pass, non-zero on any failure.
 */

import assert from 'node:assert/strict';
import {
  createGrid,
  getCell,
  setCell,
  nextGeneration,
  gridFromString,
  gridToString,
} from '../engine.js';

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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build a grid from a 2D boolean array. */
function gridFrom2D(arr) {
  const rows = arr.length;
  const cols = arr[0].length;
  return createGrid(rows, cols, arr);
}

/** Snapshot the cells of a grid as a flat array of 0/1 for easy comparison. */
function snap(grid) {
  return Array.from(grid.cells);
}

// ── createGrid ─────────────────────────────────────────────────────────────
describe('createGrid', () => {
  test('creates an all-dead grid by default', () => {
    const g = createGrid(3, 4);
    assert.equal(g.rows, 3);
    assert.equal(g.cols, 4);
    assert.equal(g.cells.length, 12);
    assert.ok(g.cells.every(v => v === 0));
  });

  test('initialises from a 2D boolean array', () => {
    const g = createGrid(2, 2, [[true, false], [false, true]]);
    assert.equal(getCell(g, 0, 0), true);
    assert.equal(getCell(g, 0, 1), false);
    assert.equal(getCell(g, 1, 0), false);
    assert.equal(getCell(g, 1, 1), true);
  });

  test('throws on non-positive rows', () => {
    assert.throws(() => createGrid(0, 5),  /rows/i);
    assert.throws(() => createGrid(-1, 5), /rows/i);
  });

  test('throws on non-positive cols', () => {
    assert.throws(() => createGrid(5, 0),  /cols/i);
    assert.throws(() => createGrid(5, -1), /cols/i);
  });

  test('throws on non-integer dimensions', () => {
    assert.throws(() => createGrid(1.5, 5), /rows/i);
    assert.throws(() => createGrid(5, 1.5), /cols/i);
  });

  test('handles partial/sparse initialState (jagged array)', () => {
    // Row 0 has only 1 element, row 1 is undefined (skipped), row 2 has a true at index 2
    const g = createGrid(3, 3, [[true], undefined, [false, false, true]]);
    assert.equal(getCell(g, 0, 0), true);
    assert.equal(getCell(g, 0, 1), false);
    assert.equal(getCell(g, 0, 2), false);
    assert.equal(getCell(g, 1, 0), false);
    assert.equal(getCell(g, 1, 1), false);
    assert.equal(getCell(g, 1, 2), false);
    assert.equal(getCell(g, 2, 0), false);
    assert.equal(getCell(g, 2, 1), false);
    assert.equal(getCell(g, 2, 2), true);
  });
});

// ── getCell ────────────────────────────────────────────────────────────────
describe('getCell', () => {
  test('returns false for out-of-bounds without throwing', () => {
    const g = createGrid(3, 3);
    assert.equal(getCell(g, -1,  0), false);
    assert.equal(getCell(g,  3,  0), false);
    assert.equal(getCell(g,  0, -1), false);
    assert.equal(getCell(g,  0,  3), false);
  });

  test('returns correct value for in-bounds cell', () => {
    const g = createGrid(2, 2, [[true, false],[false, true]]);
    assert.equal(getCell(g, 0, 0), true);
    assert.equal(getCell(g, 0, 1), false);
  });
});

// ── setCell ────────────────────────────────────────────────────────────────
describe('setCell', () => {
  test('returns a new grid (immutable)', () => {
    const g1 = createGrid(3, 3);
    const g2 = setCell(g1, 1, 1, true);
    assert.notEqual(g1, g2);
    assert.equal(getCell(g1, 1, 1), false); // original unchanged
    assert.equal(getCell(g2, 1, 1), true);
  });

  test('throws on out-of-bounds', () => {
    const g = createGrid(3, 3);
    assert.throws(() => setCell(g, -1, 0, true));
    assert.throws(() => setCell(g,  3, 0, true));
    assert.throws(() => setCell(g,  0,-1, true));
    assert.throws(() => setCell(g,  0, 3, true));
  });

  test('idempotent: setting alive cell to alive preserves value', () => {
    const g = createGrid(3, 3, [[false,true,false],[false,false,false],[false,false,false]]);
    const g2 = setCell(g, 0, 1, true);
    assert.notEqual(g, g2);            // still returns a new grid
    assert.equal(getCell(g2, 0, 1), true);
    assert.deepEqual(snap(g), snap(g2));
  });

  test('idempotent: setting dead cell to dead preserves value', () => {
    const g = createGrid(3, 3);
    const g2 = setCell(g, 1, 1, false);
    assert.notEqual(g, g2);
    assert.equal(getCell(g2, 1, 1), false);
    assert.deepEqual(snap(g), snap(g2));
  });
});

// ── Rule 1 — underpopulation ───────────────────────────────────────────────
describe('Rule 1 — underpopulation (< 2 live neighbours → dies)', () => {
  test('live interior cell with 0 neighbours dies', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    assert.equal(getCell(nextGeneration(g), 2, 2), false);
  });

  test('live interior cell with 1 neighbour dies', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,1,1,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    // Both cells have 1 neighbour each — both die.
    const n = nextGeneration(g);
    assert.equal(getCell(n, 2, 2), false);
    assert.equal(getCell(n, 2, 3), false);
  });
});

// ── Rule 2 — overcrowding ──────────────────────────────────────────────────
describe('Rule 2 — overcrowding (> 3 live neighbours → dies)', () => {
  test('live interior cell with 4 neighbours dies', () => {
    // Centre cell is surrounded by 4 live cells (cardinal directions).
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
    ]);
    assert.equal(getCell(nextGeneration(g), 2, 2), false);
  });

  test('live interior cell with 8 neighbours dies', () => {
    const g = createGrid(3, 3, [
      [1,1,1],
      [1,1,1],
      [1,1,1],
    ]);
    // Centre (1,1) has 8 neighbours → dies.
    assert.equal(getCell(nextGeneration(g), 1, 1), false);
  });
});

// ── Rule 3 — survival ──────────────────────────────────────────────────────
describe('Rule 3 — survival (2 or 3 live neighbours → lives on)', () => {
  test('live interior cell with exactly 2 neighbours survives', () => {
    // L-shape: (1,1), (1,2), (2,1) — cell (1,1) has 2 neighbours.
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,1,1,0,0],
      [0,1,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    assert.equal(getCell(nextGeneration(g), 1, 1), true);
  });

  test('live interior cell with exactly 3 neighbours survives', () => {
    // (2,2) has neighbours at (1,1), (1,2), (1,3).
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    assert.equal(getCell(nextGeneration(g), 2, 2), true);
  });
});

// ── Rule 4 — birth ─────────────────────────────────────────────────────────
describe('Rule 4 — birth (exactly 3 live neighbours → becomes alive)', () => {
  test('dead interior cell with exactly 3 neighbours becomes alive', () => {
    // Three live cells in a row; the cells above and below the middle come alive.
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
    ]);
    const n = nextGeneration(g);
    assert.equal(getCell(n, 2, 1), true);
    assert.equal(getCell(n, 2, 3), true);
  });

  test('dead cell with 2 neighbours does NOT become alive', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    // (2,1) and (2,3) have only 2 neighbours each.
    const n = nextGeneration(g);
    assert.equal(getCell(n, 2, 1), false);
    assert.equal(getCell(n, 2, 3), false);
  });

  test('dead cell with 4 neighbours does NOT become alive', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,1,0,1,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
    ]);
    // Centre (2,2) has 4 neighbours — no birth.
    assert.equal(getCell(nextGeneration(g), 2, 2), false);
  });
});

// ── Edge cells ─────────────────────────────────────────────────────────────
describe('Edge cells — boundary neighbours are treated as dead', () => {
  test('top-left corner cell (0,0) with no in-bound live neighbours dies', () => {
    const g = createGrid(5, 5);
    const g2 = setCell(g, 0, 0, true);
    assert.equal(getCell(nextGeneration(g2), 0, 0), false);
  });

  test('top-right corner cell (0, cols-1) with 1 in-bound live neighbour dies', () => {
    const g = createGrid(5, 5);
    let g2 = setCell(g, 0, 4, true);
    g2 = setCell(g2, 0, 3, true);
    // (0,4) has 1 neighbour → underpopulation.
    assert.equal(getCell(nextGeneration(g2), 0, 4), false);
  });

  test('bottom-left corner cell survives with 2 in-bound live neighbours', () => {
    const rows = 5, cols = 5;
    const g = createGrid(rows, cols);
    let g2 = setCell(g, rows - 1, 0, true);
    g2 = setCell(g2, rows - 2, 0, true);
    g2 = setCell(g2, rows - 1, 1, true);
    // Bottom-left has 2 neighbours → survives.
    assert.equal(getCell(nextGeneration(g2), rows - 1, 0), true);
  });

  test('bottom-right corner cell survives with 2 in-bound live neighbours', () => {
    const rows = 5, cols = 5;
    const g = createGrid(rows, cols);
    let g2 = setCell(g, rows - 1, cols - 1, true);
    g2 = setCell(g2, rows - 2, cols - 1, true);
    g2 = setCell(g2, rows - 1, cols - 2, true);
    assert.equal(getCell(nextGeneration(g2), rows - 1, cols - 1), true);
  });

  test('top edge cell (0, mid) with 3 in-bound neighbours survives', () => {
    const g = createGrid(5, 5, [
      [0,1,1,1,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    // (0,2) has neighbours (0,1), (0,3), (1,2) = 3 → survives.
    assert.equal(getCell(nextGeneration(g), 0, 2), true);
  });

  test('left edge cell (mid, 0) with 3 in-bound neighbours survives', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [1,0,0,0,0],
      [1,1,0,0,0],
      [1,0,0,0,0],
      [0,0,0,0,0],
    ]);
    // (2,0) has neighbours (1,0), (3,0), (2,1) = 3 → survives.
    assert.equal(getCell(nextGeneration(g), 2, 0), true);
  });

  test('right edge cell (mid, cols-1) with 3 in-bound neighbours survives', () => {
    const cols = 5;
    const g = createGrid(5, cols, [
      [0,0,0,0,0],
      [0,0,0,0,1],
      [0,0,0,1,1],
      [0,0,0,0,1],
      [0,0,0,0,0],
    ]);
    assert.equal(getCell(nextGeneration(g), 2, cols - 1), true);
  });

  test('bottom edge cell (rows-1, mid) with 3 in-bound neighbours survives', () => {
    const rows = 5;
    const g = createGrid(rows, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,1,1,1,0],
    ]);
    assert.equal(getCell(nextGeneration(g), rows - 1, 2), true);
  });

  test('birth at top edge', () => {
    // Three live cells directly on row 0 → cell in row 1 is born.
    const g = createGrid(5, 5, [
      [0,1,1,1,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    // (1,2) has 3 neighbours on row 0 → birth.
    assert.equal(getCell(nextGeneration(g), 1, 2), true);
  });

  test('death at bottom edge', () => {
    const rows = 5;
    const g = createGrid(rows, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,0,1,0,0],
    ]);
    // (rows-1, 2) has 0 neighbours → dies.
    assert.equal(getCell(nextGeneration(g), rows - 1, 2), false);
  });
});

// ── Degenerate grids ───────────────────────────────────────────────────────
describe('Degenerate grids', () => {
  test('1×1 dead grid stays dead', () => {
    const g = createGrid(1, 1);
    assert.equal(getCell(nextGeneration(g), 0, 0), false);
  });

  test('1×1 live grid dies (0 neighbours)', () => {
    const g = setCell(createGrid(1, 1), 0, 0, true);
    assert.equal(getCell(nextGeneration(g), 0, 0), false);
  });

  test('all-dead grid stays all-dead', () => {
    const g = createGrid(10, 10);
    const n = nextGeneration(g);
    assert.ok(n.cells.every(v => v === 0));
  });

  test('all-alive 3×3 grid evolves correctly', () => {
    const g = createGrid(3, 3, [
      [1,1,1],
      [1,1,1],
      [1,1,1],
    ]);
    const n = nextGeneration(g);
    // Corner cells (2 neighbours) survive; edge cells (3 or 5 neighbours) vary;
    // centre cell (8 neighbours) dies.
    assert.equal(getCell(n, 0, 0), true);  // 3 neighbours → lives (born if dead, stays if alive)
    // Corners: alive with 3 neighbours → survive.
    assert.equal(getCell(n, 0, 2), true);
    assert.equal(getCell(n, 2, 0), true);
    assert.equal(getCell(n, 2, 2), true);
    // Centre: 8 neighbours → dies.
    assert.equal(getCell(n, 1, 1), false);
  });
});

// ── Known patterns ─────────────────────────────────────────────────────────
describe('Known patterns', () => {
  test('Blinker oscillates correctly', () => {
    // Horizontal blinker → vertical → horizontal.
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,1,1,1,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    const g2 = nextGeneration(g);
    // Should become vertical.
    assert.equal(getCell(g2, 1, 2), true);
    assert.equal(getCell(g2, 2, 2), true);
    assert.equal(getCell(g2, 3, 2), true);
    assert.equal(getCell(g2, 2, 1), false);
    assert.equal(getCell(g2, 2, 3), false);

    // One more step → back to horizontal.
    const g3 = nextGeneration(g2);
    assert.equal(getCell(g3, 2, 1), true);
    assert.equal(getCell(g3, 2, 2), true);
    assert.equal(getCell(g3, 2, 3), true);
    assert.equal(getCell(g3, 1, 2), false);
    assert.equal(getCell(g3, 3, 2), false);
  });

  test('Toad oscillates with period 2', () => {
    const g = createGrid(6, 6, [
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,1,1,1,0],
      [0,1,1,1,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
    ]);
    const g1 = nextGeneration(g);
    // After 1 step, should differ from original.
    assert.notDeepEqual(snap(g1), snap(g));
    // After 2 steps, should return to original.
    const g2 = nextGeneration(g1);
    assert.deepEqual(snap(g2), snap(g));
  });

  test('nextGeneration does not mutate the input grid', () => {
    const g = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,0,0,0],
    ]);
    const original = Array.from(g.cells);
    nextGeneration(g);
    assert.deepEqual(Array.from(g.cells), original);
  });
});

// ── Kata sample ────────────────────────────────────────────────────────────
describe('Kata sample — Generation 1 → Generation 2', () => {
  const INPUT = `Generation 1:
4 8
........
....*...
...**...
........`;

  const EXPECTED_CELLS = `........
...**...
...**...
........`;

  test('gridFromString parses the kata input correctly', () => {
    const g = gridFromString(INPUT);
    assert.equal(g.rows, 4);
    assert.equal(g.cols, 8);
    assert.equal(getCell(g, 1, 4), true);  // the lone cell in row 1
    assert.equal(getCell(g, 2, 3), true);  // left of the pair in row 2
    assert.equal(getCell(g, 2, 4), true);  // right of the pair in row 2
    assert.equal(getCell(g, 0, 0), false);
  });

  test('Generation 1 → Generation 2 matches expected output', () => {
    const g1 = gridFromString(INPUT);
    const g2 = nextGeneration(g1);

    assert.equal(g2.rows, 4);
    assert.equal(g2.cols, 8);

    // Verify full expected cell layout row by row.
    const expectedRows = EXPECTED_CELLS.split('\n');
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        const expected = expectedRows[r][c] === '*';
        const actual   = getCell(g2, r, c);
        assert.equal(
          actual, expected,
          `Cell (${r},${c}): expected ${expected}, got ${actual}`
        );
      }
    }
  });

  test('gridToString serialises Generation 2 correctly', () => {
    const g1 = gridFromString(INPUT);
    const g2 = nextGeneration(g1);
    const output = gridToString(g2, 2);
    const lines = output.split('\n');
    assert.equal(lines[0], 'Generation 2:');
    assert.equal(lines[1], '4 8');
    assert.equal(lines[2], '........');
    assert.equal(lines[3], '...**...');
    assert.equal(lines[4], '...**...');
    assert.equal(lines[5], '........');
  });

  test('gridFromString works without the Generation header', () => {
    const noHeader = `4 8
........
....*...
...**...
........`;
    const g = gridFromString(noHeader);
    assert.equal(g.rows, 4);
    assert.equal(g.cols, 8);
    assert.equal(getCell(g, 1, 4), true);
  });

  test('gridFromString throws on malformed input', () => {
    assert.throws(() => gridFromString(''),                        /empty/i);
    assert.throws(() => gridFromString('4 8\n...\n'),              /expected 4 data rows/i);
    assert.throws(() => gridFromString('4 8\n...\n...\n...\n...\n'), /row 0 has length/i);
    assert.throws(() => gridFromString('abc\n....'),               /malformed dimensions/i);
  });
});

// ── setCell — dead path ─────────────────────────────────────────────────────
describe('setCell — setting a cell to dead', () => {
  test('sets a live cell back to dead', () => {
    const g = createGrid(3, 3, [[false, true, false],[false,false,false],[false,false,false]]);
    assert.equal(getCell(g, 0, 1), true);
    const g2 = setCell(g, 0, 1, false);
    assert.equal(getCell(g2, 0, 1), false);
    // Original unchanged.
    assert.equal(getCell(g, 0, 1), true);
  });
});

// ── 1xN and Nx1 grids ──────────────────────────────────────────────────────
describe('1xN and Nx1 grids', () => {
  test('1x5 grid — all cells are edge cells, lone cell dies', () => {
    const g = setCell(createGrid(1, 5), 0, 2, true);
    const n = nextGeneration(g);
    assert.ok(n.cells.every(v => v === 0));
  });

  test('5x1 grid — all cells are edge cells, lone cell dies', () => {
    const g = setCell(createGrid(5, 1), 2, 0, true);
    const n = nextGeneration(g);
    assert.ok(n.cells.every(v => v === 0));
  });

  test('1x5 grid — three in a row cannot sustain (no vertical room)', () => {
    let g = createGrid(1, 5);
    g = setCell(g, 0, 1, true);
    g = setCell(g, 0, 2, true);
    g = setCell(g, 0, 3, true);
    const n = nextGeneration(g);
    // Middle cell has 2 neighbours → survives; outer cells have 1 → die.
    assert.equal(getCell(n, 0, 1), false);
    assert.equal(getCell(n, 0, 2), true);
    assert.equal(getCell(n, 0, 3), false);
    // Second generation: lone survivor dies.
    const n2 = nextGeneration(n);
    assert.ok(n2.cells.every(v => v === 0));
  });
});

// ── Still life — Block ──────────────────────────────────────────────────────
describe('Known patterns — still lifes', () => {
  test('Block (2x2 square) is stable across generations', () => {
    const g = createGrid(4, 4, [
      [0,0,0,0],
      [0,1,1,0],
      [0,1,1,0],
      [0,0,0,0],
    ]);
    const g2 = nextGeneration(g);
    assert.deepEqual(snap(g2), snap(g));
    const g3 = nextGeneration(g2);
    assert.deepEqual(snap(g3), snap(g));
  });
});

// ── Glider ──────────────────────────────────────────────────────────────────
describe('Known patterns — Glider', () => {
  test('Glider translates down-right after 4 generations', () => {
    const g = createGrid(6, 6, [
      [0,1,0,0,0,0],
      [0,0,1,0,0,0],
      [1,1,1,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
    ]);
    let current = g;
    for (let i = 0; i < 4; i++) {
      current = nextGeneration(current);
    }
    // After 4 generations the glider shifts (1,1) from its original position.
    const expected = createGrid(6, 6, [
      [0,0,0,0,0,0],
      [0,0,1,0,0,0],
      [0,0,0,1,0,0],
      [0,1,1,1,0,0],
      [0,0,0,0,0,0],
      [0,0,0,0,0,0],
    ]);
    assert.deepEqual(snap(current), snap(expected));
  });
});

// ── Multi-generation stability ──────────────────────────────────────────────
describe('Multi-generation stability', () => {
  test('Blinker returns to initial state after 10 full periods (20 generations)', () => {
    const initial = createGrid(5, 5, [
      [0,0,0,0,0],
      [0,0,0,0,0],
      [0,1,1,1,0],
      [0,0,0,0,0],
      [0,0,0,0,0],
    ]);
    let g = initial;
    for (let i = 0; i < 20; i++) {
      g = nextGeneration(g);
    }
    assert.deepEqual(snap(g), snap(initial));
  });
});

// ── gridToString without generation header ─────────────────────────────────
describe('gridToString — additional paths', () => {
  test('serialises without generation header when generation is omitted', () => {
    const g = createGrid(2, 3, [
      [1,0,1],
      [0,1,0],
    ]);
    const output = gridToString(g);
    assert.equal(output, '2 3\n*.*\n.*.');
  });

  test('serialises with generation=0 (falsy but valid)', () => {
    const g = createGrid(2, 2, [[1,0],[0,1]]);
    const output = gridToString(g, 0);
    const lines = output.split('\n');
    assert.equal(lines[0], 'Generation 0:');
    assert.equal(lines[1], '2 2');
    assert.equal(lines[2], '*.');
    assert.equal(lines[3], '.*');
  });
});

// ── gridFromString — additional error paths ────────────────────────────────
describe('gridFromString — additional error paths', () => {
  test('throws on non-string input', () => {
    assert.throws(() => gridFromString(42),        /must be a string/i);
    assert.throws(() => gridFromString(null),       /must be a string/i);
    assert.throws(() => gridFromString(undefined),  /must be a string/i);
  });

  test('throws on invalid cell character', () => {
    assert.throws(() => gridFromString('2 2\n.X\n..'), /unexpected character/i);
  });

  test('throws when only Generation header is present with no dimensions', () => {
    assert.throws(() => gridFromString('Generation 1:'), /missing dimensions/i);
  });

  test('throws on zero dimensions', () => {
    assert.throws(() => gridFromString('0 5\n'), /positive/i);
  });
});

// ── gridFromString / gridToString round-trip ────────────────────────────────
describe('gridFromString / gridToString round-trip', () => {
  test('parse(serialize(grid)) reproduces the original grid', () => {
    const g = createGrid(3, 4, [
      [true,  false, true,  false],
      [false, true,  false, true],
      [true,  true,  false, false],
    ]);
    const text = gridToString(g, 5);
    const parsed = gridFromString(text);
    assert.equal(parsed.rows, g.rows);
    assert.equal(parsed.cols, g.cols);
    assert.deepEqual(snap(parsed), snap(g));
  });

  test('round-trip without generation header', () => {
    const g = createGrid(2, 3, [[true, false, true],[false, true, false]]);
    const text = gridToString(g);
    const parsed = gridFromString(text);
    assert.deepEqual(snap(parsed), snap(g));
  });
});

// ── gridFromString — Windows line endings ───────────────────────────────────
describe('gridFromString — Windows line endings (\\r\\n)', () => {
  test('parses correctly with \\r\\n line endings', () => {
    const input = 'Generation 1:\r\n4 8\r\n........\r\n....*...\r\n...**...\r\n........';
    const g = gridFromString(input);
    assert.equal(g.rows, 4);
    assert.equal(g.cols, 8);
    assert.equal(getCell(g, 1, 4), true);
    assert.equal(getCell(g, 2, 3), true);
    assert.equal(getCell(g, 2, 4), true);
    assert.equal(getCell(g, 0, 0), false);
  });

  test('round-trip with \\r\\n matches \\n version', () => {
    const lf   = 'Generation 1:\n4 8\n........\n....*...\n...**...\n........';
    const crlf = lf.replace(/\n/g, '\r\n');
    const gLf   = gridFromString(lf);
    const gCrlf = gridFromString(crlf);
    assert.deepEqual(snap(gLf), snap(gCrlf));
  });
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
