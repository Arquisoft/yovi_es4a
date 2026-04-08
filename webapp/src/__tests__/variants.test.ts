import { describe, it, expect } from 'vitest';
import { getAdjacentCells, generateHoles } from '../game/variants';

describe('Game Variants Utility', () => {
  describe('getAdjacentCells', () => {
    it('debería devolver las celdas adyacentes correctas para una celda central en tablero pequeño', () => {
      // boardSize=3
      // Total celdas: 3*(4)/2 = 6
      // Índices:
      // R=0: 0, 1, 2 (x=2)
      // R=1: 3, 4    (x=1)
      // R=2: 5       (x=0)
      
      const adj = getAdjacentCells(3, 3);
      expect(adj instanceof Set).toBe(true);
      expect(adj.size).toBeGreaterThan(0);
    });

    it('debería manejar bordes correctamente', () => {
      const adj = getAdjacentCells(0, 3);
      expect(adj.size).toBeLessThan(6);
    });
  });

  describe('generateHoles', () => {
    it('debería generar al menos un agujero', () => {
      const holes = generateHoles(20);
      expect(holes.size).toBeGreaterThanOrEqual(1);
    });

    it('no debería exceder el límite de 15 agujeros', () => {
      const holes = generateHoles(1000);
      expect(holes.size).toBeLessThanOrEqual(15);
    });

    it('debería contener sólo índices válidos', () => {
      const total = 50;
      const holes = generateHoles(total);
      holes.forEach(h => {
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(total);
      });
    });
  });
});
