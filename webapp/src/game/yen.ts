import type { YEN } from "../api/gamey";

export type CellValue = "." | "B" | "R" | string;

export type Coords = { x: number; y: number; z: number };

export type Cell = {
  cellId: number;
  row: number;
  col: number;
  value: CellValue;
  coords: Coords;
  touches: { a: boolean; b: boolean; c: boolean };
};

/**
 * Convierte YEN.layout a una lista de celdas.
 * layout está formado por filas separadas por "/" donde:
 * row 0 tiene 1 celda, row 1 tiene 2, ..., row (size-1) tiene size.
 *
 * cellId sigue orden row-major:
 * row_start = r*(r+1)/2
 * cellId = row_start + col
 */
export function parseYenToCells(yen: YEN): Cell[] {
  const size = yen.size;
  const rows = yen.layout.split("/");

  // Validación mínima defensiva (por si llega algo raro)
  if (rows.length !== size) {
    throw new Error(`Invalid YEN layout: expected ${size} rows, got ${rows.length}`);
  }

  let cellId = 0;
  const cells: Cell[] = [];

  for (let r = 0; r < size; r++) {
    const expectedLen = r + 1;
    const rowStr = rows[r];

    if (rowStr.length !== expectedLen) {
      throw new Error(`Invalid YEN row ${r}: expected length ${expectedLen}, got ${rowStr.length}`);
    }

    for (let c = 0; c < expectedLen; c++) {
      const value = rowStr[c] as CellValue;

      // Coordenadas baricéntricas consistentes con coord.rs:
      // r = row, c = col
      // x = size - 1 - r
      // y = c
      // z = (size - 1) - x - y
      const x = size - 1 - r;
      const y = c;
      const z = (size - 1) - x - y;

      const touchesA = x === 0;
      const touchesB = y === 0;
      const touchesC = z === 0;

      cells.push({
        cellId,
        row: r,
        col: c,
        value,
        coords: { x, y, z },
        touches: { a: touchesA, b: touchesB, c: touchesC },
      });

      cellId++;
    }
  }

  return cells;
}

/**
 * Devuelve cuántas celdas tiene un tablero size.
 */
export function totalCells(size: number): number {
  return (size * (size + 1)) / 2;
}
