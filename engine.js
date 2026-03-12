/**
 * Conway's Game of Life - Pure engine module.
 * No DOM coupling. Runnable in Node.js as an ES module.
 *
 * Grid shape: { rows: number, cols: number, cells: Uint8Array }
 * Cells are stored in row-major order: index = row * cols + col
 * Values: 0 = dead, 1 = alive
 */

/**
 * Creates a new Grid.
 *
 * @param {number} rows - Positive integer
 * @param {number} cols - Positive integer
 * @param {boolean[][] | null} initialState - Optional 2D boolean array [row][col]
 * @returns {{ rows: number, cols: number, cells: Uint8Array }}
 */
export function createGrid(rows, cols, initialState = null) {
  if (!Number.isInteger(rows) || rows < 1) {
    throw new RangeError(`rows must be a positive integer, got: ${rows}`);
  }
  if (!Number.isInteger(cols) || cols < 1) {
    throw new RangeError(`cols must be a positive integer, got: ${cols}`);
  }

  const cells = new Uint8Array(rows * cols); // zero-initialized (all dead)

  if (initialState !== null) {
    for (let r = 0; r < rows; r++) {
      if (initialState[r] == null) continue;
      for (let c = 0; c < cols; c++) {
        if (initialState[r][c]) {
          cells[r * cols + c] = 1;
        }
      }
    }
  }

  return { rows, cols, cells };
}

/**
 * Returns the alive state of a cell.
 * Returns false for any out-of-bounds coordinate (no throw).
 *
 * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
 * @param {number} row
 * @param {number} col
 * @returns {boolean}
 */
export function getCell(grid, row, col) {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    return false;
  }
  return grid.cells[row * grid.cols + col] === 1;
}

/**
 * Returns a NEW grid with the specified cell set to alive/dead.
 * Throws RangeError for out-of-bounds coordinates.
 *
 * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
 * @param {number} row
 * @param {number} col
 * @param {boolean} alive
 * @returns {{ rows: number, cols: number, cells: Uint8Array }}
 */
export function setCell(grid, row, col, alive) {
  if (row < 0 || row >= grid.rows || col < 0 || col >= grid.cols) {
    throw new RangeError(
      `Cell (${row}, ${col}) is out of bounds for grid ${grid.rows}x${grid.cols}`
    );
  }
  const newCells = grid.cells.slice();
  newCells[row * grid.cols + col] = alive ? 1 : 0;
  return { rows: grid.rows, cols: grid.cols, cells: newCells };
}

/**
 * Counts the number of live neighbours for a cell.
 * Neighbours that fall outside the grid boundaries are treated as dead.
 *
 * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
 * @param {number} row
 * @param {number} col
 * @returns {number}
 */
function countLiveNeighbours(grid, row, col) {
  let count = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      if (getCell(grid, row + dr, col + dc)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Applies Conway's four rules and returns a new Grid.
 * The input grid is never mutated.
 *
 * Rules:
 *  1. Live cell with < 2 live neighbours dies (underpopulation)
 *  2. Live cell with > 3 live neighbours dies (overcrowding)
 *  3. Live cell with 2 or 3 live neighbours survives
 *  4. Dead cell with exactly 3 live neighbours becomes alive
 *
 * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
 * @returns {{ rows: number, cols: number, cells: Uint8Array }}
 */
export function nextGeneration(grid) {
  const { rows, cols } = grid;
  const newCells = new Uint8Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const alive = getCell(grid, r, c);
      const neighbours = countLiveNeighbours(grid, r, c);

      let nextAlive;
      if (alive) {
        // Rules 1, 2, 3
        nextAlive = neighbours === 2 || neighbours === 3;
      } else {
        // Rule 4
        nextAlive = neighbours === 3;
      }

      newCells[r * cols + c] = nextAlive ? 1 : 0;
    }
  }

  return { rows, cols, cells: newCells };
}

/**
 * Parses a kata text format string into a Grid.
 *
 * Accepted format:
 *   [Generation N:\n]
 *   <rows> <cols>\n
 *   <row0>\n
 *   <row1>\n
 *   ...
 *
 * '.' = dead cell, '*' = alive cell
 *
 * The "Generation N:" line is optional.
 * Throws on malformed input.
 *
 * @param {string} text
 * @returns {{ rows: number, cols: number, cells: Uint8Array }}
 */
export function gridFromString(text) {
  if (typeof text !== 'string') {
    throw new TypeError('gridFromString: text must be a string');
  }

  const lines = text.split('\n').map(l => l.trimEnd());

  // Remove trailing blank lines
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (lines.length === 0) {
    throw new Error('gridFromString: input is empty');
  }

  let lineIndex = 0;

  // Optional "Generation N:" header
  if (/^Generation\s+\d+\s*:/i.test(lines[lineIndex])) {
    lineIndex++;
  }

  if (lineIndex >= lines.length) {
    throw new Error('gridFromString: missing dimensions line');
  }

  // Dimensions line: "<rows> <cols>"
  const dimMatch = lines[lineIndex].trim().match(/^(\d+)\s+(\d+)$/);
  if (!dimMatch) {
    throw new Error(
      `gridFromString: malformed dimensions line: "${lines[lineIndex]}"`
    );
  }
  const rows = parseInt(dimMatch[1], 10);
  const cols = parseInt(dimMatch[2], 10);
  lineIndex++;

  if (rows < 1 || cols < 1) {
    throw new RangeError('gridFromString: rows and cols must be positive');
  }

  const remainingLines = lines.slice(lineIndex);

  if (remainingLines.length !== rows) {
    throw new Error(
      `gridFromString: expected ${rows} data rows, got ${remainingLines.length}`
    );
  }

  const cells = new Uint8Array(rows * cols);

  for (let r = 0; r < rows; r++) {
    const line = remainingLines[r];
    if (line.length !== cols) {
      throw new Error(
        `gridFromString: row ${r} has length ${line.length}, expected ${cols}`
      );
    }
    for (let c = 0; c < cols; c++) {
      const ch = line[c];
      if (ch === '*') {
        cells[r * cols + c] = 1;
      } else if (ch === '.') {
        cells[r * cols + c] = 0;
      } else {
        throw new Error(
          `gridFromString: unexpected character '${ch}' at row ${r}, col ${c}`
        );
      }
    }
  }

  return { rows, cols, cells };
}

/**
 * Serialises a Grid to kata text format.
 * If generation is not null, a "Generation N:" header line is prepended.
 *
 * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
 * @param {number | null} generation
 * @returns {string}
 */
export function gridToString(grid, generation = null) {
  const { rows, cols } = grid;
  const parts = [];

  if (generation !== null) {
    parts.push(`Generation ${generation}:`);
  }

  parts.push(`${rows} ${cols}`);

  for (let r = 0; r < rows; r++) {
    let row = '';
    for (let c = 0; c < cols; c++) {
      row += grid.cells[r * cols + c] === 1 ? '*' : '.';
    }
    parts.push(row);
  }

  return parts.join('\n');
}
