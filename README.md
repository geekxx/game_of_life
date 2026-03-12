# Conway's Game of Life

A browser-based implementation of [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life) — a zero-player cellular automaton where complex patterns emerge from four simple rules.

## Features

- **Interactive cell painting** — click or drag to toggle cells while paused
- **Touch support** — works on mobile and tablet
- **Adjustable speed** — 2, 10, 30, or 60 generations per second
- **Flexible grid sizes** — 20×20, 50×50, 100×100, 200×200, or custom (5–500)
- **Built-in presets** — Glider, Blinker, R-pentomino, Pulsar, Gosper Glider Gun
- **Generation counter** — tracks elapsed generations
- **Step mode** — advance one generation at a time

## Rules

1. A live cell with fewer than 2 live neighbours dies (underpopulation)
2. A live cell with more than 3 live neighbours dies (overcrowding)
3. A live cell with 2 or 3 live neighbours survives
4. A dead cell with exactly 3 live neighbours becomes alive

The grid has finite boundaries — cells on the edge treat out-of-bounds neighbours as dead.

## Getting Started

No build step required. Open `index.html` directly in a modern browser, or serve it with any static file server:

```bash
npx serve .
# or
python3 -m http.server
```

## Project Structure

```
├── index.html      # App shell and toolbar UI
├── style.css       # Styles
├── main.js         # Entry point — wires UI events to engine/renderer/simulation
├── engine.js       # Pure Game of Life logic (no DOM dependency)
├── renderer.js     # Canvas-based grid renderer
├── simulation.js   # rAF-driven simulation loop with play/pause/step/reset
└── tests/
    ├── engine.test.js
    ├── renderer.test.js
    └── simulation.test.js
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `engine.js` | Immutable grid operations: `createGrid`, `getCell`, `setCell`, `nextGeneration`, `gridFromString`, `gridToString` |
| `renderer.js` | Draws the grid onto a `<canvas>`, handles coordinate mapping from pixels to cells |
| `simulation.js` | State machine (`paused`/`playing`) with a `requestAnimationFrame` loop at a configurable FPS |
| `main.js` | DOM wiring, preset definitions, cell painting via mouse and touch events |

## Text Format

`engine.js` supports a kata-style text format for grids:

```
Generation 1:
4 8
........
....*...
...**...
........
```

- `.` = dead cell, `*` = alive cell
- The `Generation N:` header line is optional
- Use `gridFromString(text)` to parse and `gridToString(grid, generation)` to serialise
