export interface HexCoord {
  q: number;
  r: number;
  s: number;
}

/**
 * Generador de tablero de hexagonos en forma de triangulo con tamaño de lado especificado en size.
 * @param size 
 * @returns 
 */
export const generateTriangleGrid = (size: number): HexCoord[] => {
  const hexas: HexCoord[] = [];
  
  for (let row = 0; row < size; row++) {
    for (let column = -row; column <= 0; column++) {
      const s = -column - row;
      hexas.push({ q: column, r: row, s });
    }
  }
  return hexas;
};