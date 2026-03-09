// gamey.ts
// API client para hablar con el game_server (gamey) desde webapp.

export type YEN = {
  size: number;
  layout: string;
  turn?: number;
  players?: string[];
};

/**
 * Al usar una ruta relativa ("/api/game"), el navegador enviará la petición 
 * al mismo dominio y puerto desde el que se sirve la aplicación (el Gateway).
 */
const API_URL = "/api/game";
// const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

/**
 * Devuelve un client_id estable. La idea es guardarlo en localStorage.
 * - Si ya existe: lo devuelve
 * - Si no: lo crea (UUID simple) y lo guarda
 */
export function getOrCreateClientId(): string {
  const key = "yovi_client_id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const newId =
    crypto.randomUUID?.() ??
    `client_${randomHex(16)}_${Date.now()}`;

  localStorage.setItem(key, newId);
  return newId;
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Client-Id": getOrCreateClientId(),
  };
  return { ...base, ...(extra as any) };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function http<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(await parseError(res));
  }
  return res.json() as Promise<T>;
}

// --------------------------------------------------------------------------------------
// META
// --------------------------------------------------------------------------------------

export type MetaResponse = {
  api_version: string;
  min_board_size: number;
  max_board_size: number;
  bots: string[];
};

export async function getMeta(): Promise<MetaResponse> {
  return http<MetaResponse>("/api/v1/meta", {
    method: "GET",
    headers: buildHeaders(),
  });
}

// --------------------------------------------------------------------------------------
// CONFIG (recordada por client_id / user en el futuro)
// --------------------------------------------------------------------------------------

export type HvBStarter = "human" | "bot";

export type HvHStarter = "player0" | "player1";

export type GameConfig = {
  size: number;
  hvb_starter: HvBStarter;
  hvh_starter?: HvHStarter | null;
  bot_id: string | null;
};

export async function getConfig(): Promise<GameConfig> {
  return http<GameConfig>("/api/v1/config", {
    method: "GET",
    headers: buildHeaders(),
  });
}

export async function putConfig(cfg: GameConfig): Promise<GameConfig> {
  return http<GameConfig>("/api/v1/config", {
    method: "PUT",
    headers: buildHeaders(),
    body: JSON.stringify(cfg),
  });
}

// --------------------------------------------------------------------------------------
// RESPUESTAS COMUNES
// --------------------------------------------------------------------------------------

export type GameMode = "hvh" | "hvb";

export type NextTurn = "human" | "bot" | "player0" | "player1";
export type Winner = "human" | "bot" | "player0" | "player1";

export type GameStatus =
  | { state: "ongoing"; next: NextTurn }
  | { state: "finished"; winner: Winner };

export type GameStateResponse = {
  game_id: string;
  mode: GameMode;
  yen: YEN;
  status: GameStatus;
};

export type CellMoveRequest = {
  cell_id: number;
};

export type MoveCoords = { x: number; y: number; z: number };
export type AppliedMove = { cell_id: number; coords: MoveCoords };

export type HvbMoveResponse = {
  game_id: string;
  yen: YEN;
  human_move: AppliedMove;
  bot_move: AppliedMove | null;
  status: GameStatus;
};

export type HvhMoveResponse = {
  game_id: string;
  yen: YEN;
  applied_move: AppliedMove;
  status: GameStatus;
};

// --------------------------------------------------------------------------------------
// HvB
// --------------------------------------------------------------------------------------

export type CreateHvbGameRequest = {
  size?: number;
  hvb_starter?: HvBStarter;
  bot_id?: string;
};

export async function createHvbGame(req: CreateHvbGameRequest): Promise<GameStateResponse> {
  return http<GameStateResponse>("/api/v1/hvb/games", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(req),
  });
}

export async function getHvbGame(gameId: string): Promise<GameStateResponse> {
  return http<GameStateResponse>(`/api/v1/hvb/games/${encodeURIComponent(gameId)}`, {
    method: "GET",
    headers: buildHeaders(),
  });
}

export async function hvbHumanMove(gameId: string, cellId: number): Promise<HvbMoveResponse> {
  return http<HvbMoveResponse>(`/api/v1/hvb/games/${encodeURIComponent(gameId)}/moves`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ cell_id: cellId } satisfies CellMoveRequest),
  });
}

export async function deleteHvbGame(gameId: string): Promise<{ deleted: boolean }> {
  return http<{ deleted: boolean }>(`/api/v1/hvb/games/${encodeURIComponent(gameId)}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
}

// --------------------------------------------------------------------------------------
// HvH
// --------------------------------------------------------------------------------------

export type CreateHvhGameRequest = {
  size?: number;
  hvh_starter?: HvHStarter;
};

export async function createHvhGame(req: CreateHvhGameRequest): Promise<GameStateResponse> {
  return http<GameStateResponse>("/api/v1/hvh/games", {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify(req),
  });
}

export async function getHvhGame(gameId: string): Promise<GameStateResponse> {
  return http<GameStateResponse>(`/api/v1/hvh/games/${encodeURIComponent(gameId)}`, {
    method: "GET",
    headers: buildHeaders(),
  });
}

export async function hvhMove(gameId: string, cellId: number): Promise<HvhMoveResponse> {
  return http<HvhMoveResponse>(`/api/v1/hvh/games/${encodeURIComponent(gameId)}/moves`, {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ cell_id: cellId } satisfies CellMoveRequest),
  });
}

export async function deleteHvhGame(gameId: string): Promise<{ deleted: boolean }> {
  return http<{ deleted: boolean }>(`/api/v1/hvh/games/${encodeURIComponent(gameId)}`, {
    method: "DELETE",
    headers: buildHeaders(),
  });
}