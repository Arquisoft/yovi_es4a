import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAdjacentCells, generateHoles, hasPlayableCells } from '../game/variants';

describe('Game Variants Utility', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getAdjacentCells', () => {
    it('debería devolver las celdas adyacentes correctas para una celda central en tablero pequeño', () => {
      const adj = getAdjacentCells(1, 3);
      expect(adj).toEqual(new Set([0, 2, 3, 4]));
    });

    it('debería manejar bordes correctamente', () => {
      const adj = getAdjacentCells(0, 3);
      expect(adj).toEqual(new Set([1, 2]));
    });
  });

  describe('generateHoles', () => {
    it('genera exactamente un agujero con tableros pequeños', () => {
      const holes = generateHoles(3);
      expect(holes.size).toBe(1);
    });

    it('debería generar al menos un agujero', () => {
      const holes = generateHoles(20);
      expect(holes.size).toBeGreaterThanOrEqual(1);
    });

    it('respeta el porcentaje cuando está entre el mínimo y el máximo', () => {
      const holes = generateHoles(20);
      expect(holes.size).toBe(2);
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

  describe('hasPlayableCells', () => {
    it('devuelve true si hay al menos una celda libre no bloqueada', () => {
      expect(hasPlayableCells({ size: 3, layout: "B./R/." } as any)).toBe(true);
    });

    it('devuelve false si todas las celdas libres están bloqueadas', () => {
      expect(
        hasPlayableCells(
          { size: 3, layout: "B./R/." } as any,
          new Set([1, 3]),
        ),
      ).toBe(false);
    });

    it('devuelve false si no hay celdas vacías', () => {
      expect(hasPlayableCells({ size: 3, layout: "BB/R/B" } as any)).toBe(false);
    });
  });
});
