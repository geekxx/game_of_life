/**
 * Canvas-based grid renderer for Conway's Game of Life.
 *
 * Grid type: { rows: number, cols: number, cells: Uint8Array }
 * cells is row-major: index = row * cols + col
 * A cell value of 1 is alive, 0 is dead.
 */

const DEFAULT_ALIVE_COLOR = '#00e676';
const DEFAULT_DEAD_COLOR = '#1a1a2e';
const DEFAULT_GRID_COLOR = '#2a2a4e';
const DEFAULT_BG_COLOR = '#0d0d1a';

/**
 * Creates a renderer bound to the given canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {string} [options.aliveColor]
 * @param {string} [options.deadColor]
 * @param {string} [options.gridColor]
 * @returns {{ draw(grid: object): void, setCellSize(px: number): void, canvasToGrid(x: number, y: number, grid: object): {row: number, col: number}|null }}
 */
export function createRenderer(canvas, options = {}) {
  const ctx = canvas.getContext('2d');

  const aliveColor = options.aliveColor ?? DEFAULT_ALIVE_COLOR;
  const deadColor = options.deadColor ?? DEFAULT_DEAD_COLOR;
  const gridColor = options.gridColor ?? DEFAULT_GRID_COLOR;

  // Manual cell-size override; null means auto-compute from canvas dimensions.
  let manualCellSize = null;

  /**
   * Compute the cell size and grid offset for the current canvas dimensions
   * and the given grid. Returns { cellSize, offsetX, offsetY }.
   *
   * @param {{ rows: number, cols: number }} grid
   * @returns {{ cellSize: number, offsetX: number, offsetY: number }}
   */
  function _layout(grid) {
    const { rows, cols } = grid;
    const cellSize = manualCellSize !== null
      ? Math.max(1, Math.floor(manualCellSize))
      : Math.max(1, Math.min(
          Math.floor(canvas.width / cols),
          Math.floor(canvas.height / rows)
        ));

    const gridPixelW = cellSize * cols;
    const gridPixelH = cellSize * rows;
    const offsetX = Math.floor((canvas.width - gridPixelW) / 2);
    const offsetY = Math.floor((canvas.height - gridPixelH) / 2);

    return { cellSize, offsetX, offsetY };
  }

  /**
   * Render the full grid onto the canvas.
   *
   * @param {{ rows: number, cols: number, cells: Uint8Array }} grid
   */
  function draw(grid) {
    const { rows, cols, cells } = grid;
    const { cellSize, offsetX, offsetY } = _layout(grid);

    const gridPixelW = cellSize * cols;
    const gridPixelH = cellSize * rows;

    // Clear entire canvas with background colour (outside-grid area).
    ctx.fillStyle = DEFAULT_BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw cells.
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const alive = cells[row * cols + col] === 1;
        ctx.fillStyle = alive ? aliveColor : deadColor;
        ctx.fillRect(
          offsetX + col * cellSize,
          offsetY + row * cellSize,
          cellSize,
          cellSize
        );
      }
    }

    // Draw grid lines only when cells are large enough to benefit from them.
    if (cellSize >= 4) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();

      // Vertical lines.
      for (let col = 0; col <= cols; col++) {
        const x = offsetX + col * cellSize;
        ctx.moveTo(x + 0.5, offsetY);
        ctx.lineTo(x + 0.5, offsetY + gridPixelH);
      }

      // Horizontal lines.
      for (let row = 0; row <= rows; row++) {
        const y = offsetY + row * cellSize;
        ctx.moveTo(offsetX, y + 0.5);
        ctx.lineTo(offsetX + gridPixelW, y + 0.5);
      }

      ctx.stroke();
    }
  }

  /**
   * Override the automatic cell-size calculation with a fixed pixel size.
   * Pass null (or call without argument) to revert to auto-sizing.
   *
   * @param {number|null} px
   */
  function setCellSize(px) {
    manualCellSize = px != null ? px : null;
  }

  /**
   * Convert canvas pixel coordinates (e.g. from a mouse event) to grid cell
   * coordinates, accounting for the centering offset.
   *
   * Returns { row, col } if the point falls within the grid, or null otherwise.
   *
   * @param {number} x  - canvas-relative X coordinate
   * @param {number} y  - canvas-relative Y coordinate
   * @param {{ rows: number, cols: number }} grid
   * @returns {{ row: number, col: number }|null}
   */
  function canvasToGrid(x, y, grid) {
    const { rows, cols } = grid;
    const { cellSize, offsetX, offsetY } = _layout(grid);

    const col = Math.floor((x - offsetX) / cellSize);
    const row = Math.floor((y - offsetY) / cellSize);

    if (row < 0 || row >= rows || col < 0 || col >= cols) {
      return null;
    }

    return { row, col };
  }

  return { draw, setCellSize, canvasToGrid };
}
