import type { YEN } from "../api/gamey";

function toIndex(x: number, y: number, boardSize: number): number {
  const r = (boardSize - 1) - x;
  const rowStart = (r * (r + 1)) / 2;
  return rowStart + y;
}

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
    candidates.push([x - 1, y + 1, z], [x - 1, y, z + 1]);
  }
  if (y > 0) {
    candidates.push([x + 1, y - 1, z], [x, y - 1, z + 1]);
  }
  if (z > 0) {
    candidates.push([x + 1, y, z - 1], [x, y + 1, z - 1]);
  }

  const result = new Set<number>();
  for (const [nx, ny] of candidates) {
    if (nx >= 0 && ny >= 0 && nx + ny <= boardSize - 1) {
      result.add(toIndex(nx, ny, boardSize));
    }
  }
  return result;
}

function secureRandomInt(maxExclusive: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % maxExclusive;
}

export function generateHoles(totalCells: number): Set<number> {
  const count = Math.max(1, Math.min(Math.floor(totalCells * 0.12), 15));
  const holes = new Set<number>();
  const allCells = Array.from({ length: totalCells }, (_, i) => i);

  for (let i = allCells.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
  }

  allCells.slice(0, count).forEach((cellId) => holes.add(cellId));
  return holes;
}

export function hasPlayableCells(yen: YEN, blockedCells: Set<number> = new Set()): boolean {
  let cellId = 0;

  for (const row of yen.layout.split("/")) {
    for (const cell of row) {
      if (cell === "." && !blockedCells.has(cellId)) {
        return true;
      }
      cellId += 1;
    }
  }

  return false;
}

export type VariantId =
  | "classic"
  | "pastel"
  | "master"
  | "fortune_coin"
  | "fortune_dice"
  | "tabu"
  | "holey"
  | "why_not"
  | "poly_y"
  | "3dy"
  | "hex";

export interface Variant {
  id: VariantId;
  label: string;
  emoji: string;
  tagLabel: string;
  tagColor: string;
  description: string;
  detail: string;
  implemented: boolean;
}

function createVariant(
  id: VariantId,
  label: string,
  emoji: string,
  tagLabel: string,
  tagColor: string,
  description: string,
  detail: string,
  implemented: boolean,
): Variant {
  return {
    id,
    label,
    emoji,
    tagLabel,
    tagColor,
    description,
    detail,
    implemented,
  };
}

export const VARIANTS: Variant[] = [
  createVariant(
    "classic",
    "Clásico",
    "⬡",
    "Estandar",
    "blue",
    "El juego Y original. Conecta los tres lados del tablero.",
    "Dos jugadores se alternan colocando fichas. Gana quien conecte los tres lados del tablero triangular con una cadena continua de piezas propias.",
    true,
  ),
  createVariant(
    "pastel",
    "Regla del Pastel",
    "🍰",
    "Fairness",
    "orange",
    "Un jugador coloca la primera pieza, el otro elige bando.",
    "El Jugador 1 elige donde va la primera ficha. Entonces el Jugador 2 decide si prefiere quedarse con esa posicion o ceder el turno.",
    true,
  ),
  createVariant(
    "master",
    "Master Y",
    "✌️",
    "2 piezas/turno",
    "purple",
    "Igual que el clasico, pero cada turno se colocan 2 fichas.",
    "Las reglas son identicas al Y estandar salvo que en cada turno el jugador activo coloca exactamente 2 piezas en casillas libres.",
    true,
  ),
  createVariant(
    "fortune_coin",
    "Fortune Y - Moneda",
    "🪙",
    "Azar",
    "gold",
    "Antes de cada turno se lanza una moneda para decidir quien mueve.",
    "Al inicio de cada turno se lanza una moneda. Un mismo jugador puede mover varias veces seguidas y gana quien conecta los tres lados.",
    true,
  ),
  createVariant(
    "fortune_dice",
    "Fortune Y - Dado",
    "🎲",
    "Azar",
    "gold",
    "El dado indica cuantas piezas puede colocar el jugador activo.",
    "En cada turno se lanza un dado de 6 caras y el resultado marca cuantas piezas puede colocar el jugador activo antes de pasar el turno.",
    true,
  ),
  createVariant(
    "tabu",
    "Tabu Y",
    "🚫",
    "Restriccion",
    "red",
    "Prohibido colocar ficha adyacente al ultimo movimiento rival.",
    "Se juega como el Y estandar, pero no se puede colocar una pieza en ninguna casilla adyacente a la ultima ficha colocada por el oponente.",
    true,
  ),
  createVariant(
    "holey",
    "Holey Y",
    "🕳️",
    "Tablero especial",
    "cyan",
    "El tablero tiene agujeros: casillas permanentemente bloqueadas.",
    "Antes de empezar, algunas casillas se marcan como agujeros aleatorios y ningun jugador puede colocar piezas en ellas.",
    true,
  ),
  createVariant(
    "why_not",
    "WhY Not",
    "🔄",
    "Inversion",
    "volcano",
    "Las reglas son las del clasico, pero conectar los tres lados te hace perder.",
    "El primer jugador que forme una conexion de los tres lados con sus propias piezas pierde la partida.",
    true,
  ),
  createVariant(
    "poly_y",
    "Poly-Y",
    "⭐",
    "Multi-esquina",
    "geekblue",
    "Tablero de 5+ lados. Gana quien conquiste mas esquinas.",
    "Se juega en un tablero poligonal con un numero impar de lados. Gana quien consiga poseer mas esquinas al final.",
    false,
  ),
  createVariant(
    "3dy",
    "3D Y",
    "🧊",
    "3 Dimensiones",
    "cyan",
    "Juego Y en 3D. Conecta las caras de un tetraedro.",
    "Se juega en varios niveles superpuestos y los jugadores deben conectar las caras del tetraedro 3D mediante una cadena continua de piezas.",
    false,
  ),
  createVariant(
    "hex",
    "Hex",
    "🔷",
    "Tablero distinto",
    "magenta",
    "Juego relacionado con Y pero en tablero rombico de 11x11.",
    "Cada jugador intenta conectar sus dos lados opuestos del tablero. No hay empates posibles.",
    false,
  ),
];

export const DEFAULT_VARIANT = VARIANTS[0];

const GAME_ROUTES: Record<VariantId, string> = {
  classic: "/game-hvb",
  pastel: "/game-pastel",
  master: "/game-master",
  fortune_coin: "/game-fortune-coin",
  fortune_dice: "/game-fortune-dice",
  tabu: "/game-tabu",
  holey: "/game-holey",
  why_not: "/game-why-not",
  poly_y: "/game-poly-y",
  "3dy": "/game-3dy",
  hex: "/game-hex",
};

export function gameRouteForVariant(variantId: VariantId): string {
  return GAME_ROUTES[variantId] ?? GAME_ROUTES.classic;
}

export function hvhRouteForVariant(variantId: VariantId): string {
  return variantId === "classic" ? "/game-hvh" : gameRouteForVariant(variantId);
}

export const HVH_ONLY_VARIANTS: VariantId[] = [
  "master",
  "fortune_coin",
  "fortune_dice",
  "poly_y",
  "holey",
  "tabu",
  "why_not",
  "pastel",
  "3dy",
];

export const STANDALONE_VARIANTS: VariantId[] = ["hex"];

export const MULTIPLAYER_VARIANTS: VariantId[] = [
  "classic",
  "pastel",
  "tabu",
  "holey",
  "master",
  "fortune_coin",
  "fortune_dice",
  "why_not",
];

export type StarterHvH = "player0" | "player1" | "random";

export function parseBoardSize(raw: string | null, fallback = 7): number {
  const parsed = Number(raw ?? String(fallback));
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : fallback;
}

export function parseHvHStarter(raw: string | null): StarterHvH {
  const value = (raw ?? "player0").toLowerCase();
  if (value === "player1") return "player1";
  if (value === "random") return "random";
  return "player0";
}

const HVH_STARTER_LABELS: Record<StarterHvH, string> = {
  player0: "Player 0",
  player1: "Player 1",
  random: "Aleatorio",
};

export function getHvHStarterLabel(hvhStarter: StarterHvH): string {
  return HVH_STARTER_LABELS[hvhStarter];
}

export const LOCAL_HVH_PLAYER_LABELS = {
  player0: HVH_STARTER_LABELS.player0,
  player1: HVH_STARTER_LABELS.player1,
} as const;

export const LOCAL_HVH_WINNER_PALETTE = {
  highlightedWinner: "player0",
  highlightedBackground: "#28bbf532",
  otherWinnerBackground: "#ff7b0033",
} as const;

export const LOCAL_HVH_TURN_CONFIG = {
  textPrefix: "Turno actual:",
  turns: {
    player0: {
      label: LOCAL_HVH_PLAYER_LABELS.player0,
      color: "#28BBF5",
    },
    player1: {
      label: LOCAL_HVH_PLAYER_LABELS.player1,
      color: "#FF7B00",
    },
  },
} as const;

export function createLocalHvHResultConfig(
  title: string,
  size: number,
  hvhStarter: StarterHvH,
  subtitleSuffix?: string,
) {
  const subtitleParts = [
    `Tamaño: ${size}`,
    `Empieza: ${getHvHStarterLabel(hvhStarter)}`,
  ];

  if (subtitleSuffix) {
    subtitleParts.push(subtitleSuffix);
  }

  return {
    title,
    subtitle: subtitleParts.join(" · "),
    abandonOkText: "Abandonar",
    getResultTitle: () => "Partida finalizada",
    getResultText: (winner: string | null) => {
      if (winner === null) {
        return "La partida termino en empate.";
      }

      return winner === "player0"
        ? `${LOCAL_HVH_PLAYER_LABELS.player0} ha ganado la partida.`
        : `${LOCAL_HVH_PLAYER_LABELS.player1} ha ganado la partida.`;
    },
  };
}