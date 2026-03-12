/**
 * Unit tests for simulation.js — Game of Life simulation controller.
 *
 * Runnable in Node.js:
 *   node tests/simulation.test.js
 *
 * Uses only Node's built-in `assert` module — no dependencies.
 * Mocks requestAnimationFrame / cancelAnimationFrame on globalThis.
 */

import assert from 'node:assert/strict';

// ── rAF mock (must be set up before simulation.js calls rAF at runtime) ─────
let rafCallbacks = [];
let rafIdCounter = 0;

globalThis.requestAnimationFrame = (cb) => {
  rafIdCounter++;
  rafCallbacks.push({ id: rafIdCounter, cb });
  return rafIdCounter;
};

globalThis.cancelAnimationFrame = (id) => {
  rafCallbacks = rafCallbacks.filter(r => r.id !== id);
};

function resetRAF() {
  rafCallbacks = [];
  rafIdCounter = 0;
}

/** Flush all pending rAF callbacks with the given timestamp. */
function flushRAF(timestamp = 1000) {
  const pending = rafCallbacks.splice(0);
  pending.forEach(r => r.cb(timestamp));
}

import { createSimulation } from '../simulation.js';
import { createGrid, getCell } from '../engine.js';

// ── Minimal test runner ────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(label, fn) {
  resetRAF();
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

function createMockRenderer() {
  const calls = [];
  return {
    draw(grid) { calls.push(grid); },
    get drawCalls() { return calls; },
  };
}

function snap(grid) {
  return Array.from(grid.cells);
}

function makeGrid() {
  return createGrid(5, 5, [
    [0,0,0,0,0],
    [0,0,0,0,0],
    [0,1,1,1,0],
    [0,0,0,0,0],
    [0,0,0,0,0],
  ]);
}

// ── getState ────────────────────────────────────────────────────────────────
describe('getState', () => {
  test('initial state is paused', () => {
    const sim = createSimulation(createMockRenderer());
    assert.equal(sim.getState(), 'paused');
  });

  test('state is playing after start()', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.start();
    assert.equal(sim.getState(), 'playing');
    sim.pause(); // cleanup
  });

  test('state is paused after pause()', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.start();
    sim.pause();
    assert.equal(sim.getState(), 'paused');
  });
});

// ── start ─────────────────────────────────────────────────────────────────
describe('start', () => {
  test('start() is a no-op with no grid set', () => {
    const renderer = createMockRenderer();
    const sim = createSimulation(renderer);
    sim.start();
    assert.equal(sim.getState(), 'paused');
    assert.equal(renderer.drawCalls.length, 0);
  });

  test('start() is a no-op if already playing', () => {
    let updateCount = 0;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate() { updateCount++; },
    });
    sim.setGrid(makeGrid());
    updateCount = 0;
    sim.start();
    const countAfterFirstStart = updateCount;
    sim.start(); // second call — should be a no-op
    assert.equal(updateCount, countAfterFirstStart);
    sim.pause();
  });
});

// ── pause ─────────────────────────────────────────────────────────────────
describe('pause', () => {
  test('pause() is a no-op if already paused', () => {
    let updateCount = 0;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate() { updateCount++; },
    });
    sim.setGrid(makeGrid());
    updateCount = 0;
    sim.pause(); // already paused
    assert.equal(updateCount, 0);
  });

  test('pause() cancels the animation frame', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.start();
    assert.ok(rafCallbacks.length > 0, 'rAF should be scheduled');
    sim.pause();
    assert.equal(sim.getState(), 'paused');
  });
});

// ── step ──────────────────────────────────────────────────────────────────
describe('step', () => {
  test('step() is a no-op with no grid set', () => {
    const renderer = createMockRenderer();
    const sim = createSimulation(renderer);
    sim.step();
    assert.equal(renderer.drawCalls.length, 0);
  });

  test('step() is a no-op while playing', () => {
    let lastGen = -1;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate(gen) { lastGen = gen; },
    });
    sim.setGrid(makeGrid());
    sim.start();
    const genAfterStart = lastGen;
    sim.step(); // should be no-op
    assert.equal(lastGen, genAfterStart);
    sim.pause();
  });

  test('step() advances exactly one generation when paused', () => {
    let lastGen = -1;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate(gen) { lastGen = gen; },
    });
    sim.setGrid(makeGrid());
    assert.equal(lastGen, 0);
    sim.step();
    assert.equal(lastGen, 1);
    sim.step();
    assert.equal(lastGen, 2);
  });

  test('step() updates the grid correctly', () => {
    const sim = createSimulation(createMockRenderer());
    // Blinker: horizontal → vertical after one step
    sim.setGrid(makeGrid());
    sim.step();
    const g = sim.getGrid();
    // Vertical blinker
    assert.equal(getCell(g, 1, 2), true);
    assert.equal(getCell(g, 2, 2), true);
    assert.equal(getCell(g, 3, 2), true);
    assert.equal(getCell(g, 2, 1), false);
    assert.equal(getCell(g, 2, 3), false);
  });
});

// ── reset ─────────────────────────────────────────────────────────────────
describe('reset', () => {
  test('reset() restores the initial grid after stepping', () => {
    const sim = createSimulation(createMockRenderer());
    const initial = makeGrid();
    sim.setGrid(initial);
    const originalSnap = snap(sim.getGrid());
    sim.step(); // 1 step changes the blinker orientation
    // Grid has changed after stepping
    assert.notDeepEqual(snap(sim.getGrid()), originalSnap);
    sim.reset();
    assert.deepEqual(snap(sim.getGrid()), originalSnap);
  });

  test('reset() resets generation counter to 0', () => {
    let lastGen = -1;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate(gen) { lastGen = gen; },
    });
    sim.setGrid(makeGrid());
    sim.step();
    sim.step();
    assert.equal(lastGen, 2);
    sim.reset();
    assert.equal(lastGen, 0);
  });

  test('reset() pauses a playing simulation', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.start();
    assert.equal(sim.getState(), 'playing');
    sim.reset();
    assert.equal(sim.getState(), 'paused');
  });

  test('reset() with override grid uses the new grid', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.step();
    const newGrid = createGrid(3, 3, [[1,0,0],[0,1,0],[0,0,1]]);
    sim.reset(newGrid);
    const g = sim.getGrid();
    assert.equal(g.rows, 3);
    assert.equal(g.cols, 3);
    assert.deepEqual(snap(g), snap(newGrid));
  });
});

// ── setGrid ───────────────────────────────────────────────────────────────
describe('setGrid', () => {
  test('setGrid() replaces the grid and resets generation', () => {
    let lastGen = -1;
    const sim = createSimulation(createMockRenderer(), {
      onUpdate(gen) { lastGen = gen; },
    });
    sim.setGrid(makeGrid());
    sim.step();
    sim.step();
    assert.equal(lastGen, 2);

    const newGrid = createGrid(3, 3);
    sim.setGrid(newGrid);
    assert.equal(lastGen, 0);
    assert.equal(sim.getGrid().rows, 3);
    assert.equal(sim.getGrid().cols, 3);
  });

  test('setGrid() pauses a playing simulation', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());
    sim.start();
    assert.equal(sim.getState(), 'playing');
    sim.setGrid(createGrid(3, 3));
    assert.equal(sim.getState(), 'paused');
  });

  test('setGrid() deep-copies the grid (no aliasing)', () => {
    const sim = createSimulation(createMockRenderer());
    const original = makeGrid();
    sim.setGrid(original);
    // Mutate the original's cells — should not affect the simulation's copy.
    original.cells[0] = 99;
    assert.notEqual(sim.getGrid().cells[0], 99);
  });
});

// ── updateCurrentGrid ─────────────────────────────────────────────────────
describe('updateCurrentGrid', () => {
  test('updateCurrentGrid() changes the current grid without resetting initial', () => {
    const sim = createSimulation(createMockRenderer());
    const initial = makeGrid();
    sim.setGrid(initial);
    const originalSnap = snap(sim.getGrid());

    const modified = createGrid(5, 5);
    sim.updateCurrentGrid(modified);
    assert.deepEqual(snap(sim.getGrid()), snap(modified));

    // Reset should go back to the initial grid, not the updated one.
    sim.reset();
    assert.deepEqual(snap(sim.getGrid()), originalSnap);
  });
});

// ── setSpeed ──────────────────────────────────────────────────────────────
describe('setSpeed', () => {
  test('setSpeed() does not throw for valid fps', () => {
    const sim = createSimulation(createMockRenderer());
    assert.doesNotThrow(() => sim.setSpeed(30));
    assert.doesNotThrow(() => sim.setSpeed(1));
    assert.doesNotThrow(() => sim.setSpeed(60));
  });

  test('setSpeed() ignores invalid values', () => {
    const sim = createSimulation(createMockRenderer());
    // These should not throw or break anything.
    assert.doesNotThrow(() => sim.setSpeed(-1));
    assert.doesNotThrow(() => sim.setSpeed(0));
    assert.doesNotThrow(() => sim.setSpeed('fast'));
    assert.doesNotThrow(() => sim.setSpeed(null));
  });
});

// ── State transitions ─────────────────────────────────────────────────────
describe('State transitions', () => {
  test('paused → playing → paused → playing → paused', () => {
    const sim = createSimulation(createMockRenderer());
    sim.setGrid(makeGrid());

    assert.equal(sim.getState(), 'paused');
    sim.start();
    assert.equal(sim.getState(), 'playing');
    sim.pause();
    assert.equal(sim.getState(), 'paused');
    sim.start();
    assert.equal(sim.getState(), 'playing');
    sim.pause();
    assert.equal(sim.getState(), 'paused');
  });
});

// ── rAF loop integration ────────────────────────────────────────────────────
describe('rAF loop integration', () => {
  test('flushing rAF advances generations while playing', () => {
    let lastGen = -1;
    const renderer = createMockRenderer();
    const sim = createSimulation(renderer, {
      fps: 10,
      onUpdate(gen) { lastGen = gen; },
    });
    sim.setGrid(makeGrid());
    sim.start();
    assert.equal(lastGen, 0);

    // First flush initialises lastStepTime.
    flushRAF(0);
    // Second flush at t=200ms — 2 intervals at 10fps (100ms each).
    flushRAF(200);
    assert.ok(lastGen >= 1, `expected generation >= 1, got ${lastGen}`);
    sim.pause();
  });
});

// ── onUpdate callback ───────────────────────────────────────────────────────
describe('onUpdate callback', () => {
  test('onUpdate receives correct state values', () => {
    const updates = [];
    const sim = createSimulation(createMockRenderer(), {
      onUpdate(gen, state) { updates.push({ gen, state }); },
    });
    sim.setGrid(makeGrid());
    assert.deepEqual(updates[updates.length - 1], { gen: 0, state: 'paused' });

    sim.step();
    assert.deepEqual(updates[updates.length - 1], { gen: 1, state: 'paused' });

    sim.start();
    assert.deepEqual(updates[updates.length - 1], { gen: 1, state: 'playing' });

    sim.pause();
    assert.deepEqual(updates[updates.length - 1], { gen: 1, state: 'paused' });
  });
});

// ── getGrid ───────────────────────────────────────────────────────────────
describe('getGrid', () => {
  test('getGrid() returns null before any grid is set', () => {
    const sim = createSimulation(createMockRenderer());
    assert.equal(sim.getGrid(), null);
  });

  test('getGrid() returns the current grid after setGrid()', () => {
    const sim = createSimulation(createMockRenderer());
    const g = makeGrid();
    sim.setGrid(g);
    assert.notEqual(sim.getGrid(), null);
    assert.equal(sim.getGrid().rows, 5);
    assert.equal(sim.getGrid().cols, 5);
  });
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
