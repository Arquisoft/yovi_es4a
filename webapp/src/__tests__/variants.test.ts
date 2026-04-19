import { describe, it, expect } from 'vitest';
import {
  DEFAULT_VARIANT,
  HVH_ONLY_VARIANTS,
  LOCAL_HVH_PLAYER_LABELS,
  LOCAL_HVH_TURN_CONFIG,
  LOCAL_HVH_WINNER_PALETTE,
  STANDALONE_VARIANTS,
  VARIANTS,
  createLocalHvHResultConfig,
  gameRouteForVariant,
  generateHoles,
  getAdjacentCells,
  getHvHStarterLabel,
  hvhRouteForVariant,
  parseBoardSize,
  parseHvHStarter,
} from '../game/variants';

describe('game/variants', () => {
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

  describe('catálogo de variantes', () => {
    it('expone una variante por defecto válida', () => {
      expect(DEFAULT_VARIANT.id).toBe('classic');
      expect(VARIANTS.some((v) => v.id === DEFAULT_VARIANT.id)).toBe(true);
    });

    it('incluye why_not como variante implementada', () => {
      const whyNot = VARIANTS.find((v) => v.id === 'why_not');
      expect(whyNot).toBeDefined();
      expect(whyNot?.implemented).toBe(true);
    });

    it('gameRouteForVariant devuelve la ruta esperada', () => {
      expect(gameRouteForVariant('classic')).toBe('/game-hvb');
      expect(gameRouteForVariant('why_not')).toBe('/game-why-not');
      expect(gameRouteForVariant('hex')).toBe('/game-hex');
    });

    it('hvhRouteForVariant usa la ruta especial de classic y la general del resto', () => {
      expect(hvhRouteForVariant('classic')).toBe('/game-hvh');
      expect(hvhRouteForVariant('why_not')).toBe('/game-why-not');
    });

    it('clasifica las variantes hvh-only y standalone', () => {
      expect(HVH_ONLY_VARIANTS).toContain('why_not');
      expect(STANDALONE_VARIANTS).toContain('hex');
    });
  });

  describe('helpers comunes de HvH', () => {
    it('parseBoardSize usa fallback con null o valores inválidos', () => {
      expect(parseBoardSize(null)).toBe(7);
      expect(parseBoardSize('abc')).toBe(7);
      expect(parseBoardSize('1')).toBe(7);
      expect(parseBoardSize('9')).toBe(9);
      expect(parseBoardSize(null, 11)).toBe(11);
    });

    it('parseHvHStarter normaliza correctamente', () => {
      expect(parseHvHStarter(null)).toBe('player0');
      expect(parseHvHStarter('player1')).toBe('player1');
      expect(parseHvHStarter('RANDOM')).toBe('random');
      expect(parseHvHStarter('otra-cosa')).toBe('player0');
    });

    it('getHvHStarterLabel devuelve el label correcto', () => {
      expect(getHvHStarterLabel('player0')).toBe('Player 0');
      expect(getHvHStarterLabel('player1')).toBe('Player 1');
      expect(getHvHStarterLabel('random')).toBe('Aleatorio');
    });

    it('createLocalHvHResultConfig genera título, subtítulo y textos', () => {
      const config = createLocalHvHResultConfig(
        'Juego Y — WhY Not',
        9,
        'player1',
        'Conectar los tres lados te hace perder',
      );

      expect(config.title).toBe('Juego Y — WhY Not');
      expect(config.subtitle).toBe(
        'Tamaño: 9 · Empieza: Player 1 · Conectar los tres lados te hace perder',
      );
      expect(config.abandonOkText).toBe('Abandonar');
      expect(config.getResultTitle()).toBe('Partida finalizada');
      expect(config.getResultText('player0')).toBe('Player 0 ha ganado la partida.');
      expect(config.getResultText('player1')).toBe('Player 1 ha ganado la partida.');
    });

    it('expone configuración visual común de HvH', () => {
      expect(LOCAL_HVH_PLAYER_LABELS.player0).toBe('Player 0');
      expect(LOCAL_HVH_PLAYER_LABELS.player1).toBe('Player 1');
      expect(LOCAL_HVH_WINNER_PALETTE.highlightedWinner).toBe('player0');
      expect(LOCAL_HVH_TURN_CONFIG.textPrefix).toBe('Turno actual:');
      expect(LOCAL_HVH_TURN_CONFIG.turns.player0.label).toBe('Player 0');
      expect(LOCAL_HVH_TURN_CONFIG.turns.player1.label).toBe('Player 1');
    });
  });

});
