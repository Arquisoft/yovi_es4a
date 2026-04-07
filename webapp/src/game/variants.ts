/** Calcula el índice lineal a partir de coordenadas baricéntricas. */
function toIndex(x: number, y: number, boardSize: number): number {
  const r = (boardSize - 1) - x;
  const rowStart = (r * (r + 1)) / 2;
  return rowStart + y;
}

/** Dado un cellId, devuelve el conjunto de cellIds adyacentes (válidos). */
export function getAdjacentCells(cellId: number, boardSize: number): Set<number> {
  const iF = cellId;
  const r = Math.floor((Math.sqrt(8 * iF + 1) - 1) / 2);
  const rowStart = (r * (r + 1)) / 2;
  const c = cellId - rowStart;

  const x = boardSize - 1 - r;
  const y = c;
  const z = (boardSize - 1) - x - y;

  const candidates: [number, number, number][] = [];

  if (x > 0) {
    candidates.push([x - 1, y + 1, z]);
    candidates.push([x - 1, y, z + 1]);
  }
  if (y > 0) {
    candidates.push([x + 1, y - 1, z]);
    candidates.push([x, y - 1, z + 1]);
  }
  if (z > 0) {
    candidates.push([x + 1, y, z - 1]);
    candidates.push([x, y + 1, z - 1]);
  }

  const result = new Set<number>();
  for (const [nx, ny] of candidates) {
    if (nx >= 0 && ny >= 0 && nx + ny <= boardSize - 1) {
      result.add(toIndex(nx, ny, boardSize));
    }
  }
  return result;
}

/** Genera agujeros aleatorios para el modo Holey. */
export function generateHoles(totalCells: number): Set<number> {
  const count = Math.max(1, Math.min(Math.floor(totalCells * 0.12), 15));
  const holes = new Set<number>();
  const allCells = Array.from({ length: totalCells }, (_, i) => i);

  for (let i = allCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }
  allCells.slice(0, count).forEach((c) => holes.add(c));
  return holes;
}
