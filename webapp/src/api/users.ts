export type GameMode =
  | "classic_hvb"
  | "classic_hvh"
  | "tabu_hvh"
  | "holey_hvh"
  | "fortune_dice_hvh"
  | "poly_hvh"
  | "pastel_hvh"
  | "master_hvh"
  | "fortune_coin_hvh"
  | "why_not_hvh"
  | "3dy_hvh"
  | "hex_hvh";

type PersistedGameMode = GameMode | "whynot_hvh";
export type GameResult = "won" | "lost" | "abandoned" | "draw";

type GameModeMeta = {
  shortLabel: string;
  longLabel: string;
  tagColor: string;
  defaultOpponent: string;
};

const GAME_MODE_META: Record<GameMode, GameModeMeta> = {
  classic_hvb: {
    shortLabel: "Clasico HvB",
    longLabel: "Clasico - Humano vs Bot",
    tagColor: "#28BBF5",
    defaultOpponent: "Bot",
  },
  classic_hvh: {
    shortLabel: "Clasico HvH",
    longLabel: "Clasico - Humano vs Humano",
    tagColor: "#FF7B00",
    defaultOpponent: "Jugador local",
  },
  tabu_hvh: {
    shortLabel: "Tabu HvH",
    longLabel: "Tabu - Humano vs Humano",
    tagColor: "#FF4D6D",
    defaultOpponent: "Jugador local",
  },
  holey_hvh: {
    shortLabel: "Holey HvH",
    longLabel: "Holey - Humano vs Humano",
    tagColor: "#A855F7",
    defaultOpponent: "Jugador local",
  },
  fortune_dice_hvh: {
    shortLabel: "Fortune Dado HvH",
    longLabel: "Fortune Dado - Humano vs Humano",
    tagColor: "#FACC15",
    defaultOpponent: "Jugador local",
  },
  poly_hvh: {
    shortLabel: "Poly HvH",
    longLabel: "Poly - Humano vs Humano",
    tagColor: "#22C55E",
    defaultOpponent: "Jugador local",
  },
  pastel_hvh: {
    shortLabel: "Pastel HvH",
    longLabel: "Pastel - Humano vs Humano",
    tagColor: "#FA8C16",
    defaultOpponent: "Jugador local",
  },
  master_hvh: {
    shortLabel: "Master HvH",
    longLabel: "Master Y - Humano vs Humano",
    tagColor: "#722ED1",
    defaultOpponent: "Jugador local",
  },
  fortune_coin_hvh: {
    shortLabel: "Fortune Moneda HvH",
    longLabel: "Fortune Moneda - Humano vs Humano",
    tagColor: "#D4B106",
    defaultOpponent: "Jugador local",
  },
  why_not_hvh: {
    shortLabel: "WhY Not HvH",
    longLabel: "WhY Not - Humano vs Humano",
    tagColor: "#13C2C2",
    defaultOpponent: "Jugador local",
  },
  "3dy_hvh": {
    shortLabel: "3D Y HvH",
    longLabel: "3D Y - Humano vs Humano",
    tagColor: "#36CFC9",
    defaultOpponent: "Jugador local",
  },
  hex_hvh: {
    shortLabel: "Hex HvH",
    longLabel: "Hex - Humano vs Humano",
    tagColor: "#EB2F96",
    defaultOpponent: "Jugador local",
  },
};

export function normalizeGameMode(mode: PersistedGameMode): GameMode {
  return mode === "whynot_hvh" ? "why_not_hvh" : mode;
}

export function getGameModeShortLabel(mode: PersistedGameMode): string {
  return GAME_MODE_META[normalizeGameMode(mode)].shortLabel;
}

export function getGameModeLongLabel(mode: PersistedGameMode): string {
  return GAME_MODE_META[normalizeGameMode(mode)].longLabel;
}

export function getGameModeTagColor(mode: PersistedGameMode): string {
  return GAME_MODE_META[normalizeGameMode(mode)].tagColor;
}

export function getDefaultOpponentLabel(mode: PersistedGameMode): string {
  return GAME_MODE_META[normalizeGameMode(mode)].defaultOpponent;
}

export const HISTORY_MODE_FILTER_OPTIONS: Array<{
  value: "all" | GameMode;
  label: string;
}> = [
  { value: "all", label: "Todos los modos" },
  { value: "classic_hvb", label: getGameModeShortLabel("classic_hvb") },
  { value: "classic_hvh", label: getGameModeShortLabel("classic_hvh") },
  { value: "tabu_hvh", label: getGameModeShortLabel("tabu_hvh") },
  { value: "holey_hvh", label: getGameModeShortLabel("holey_hvh") },
  { value: "master_hvh", label: getGameModeShortLabel("master_hvh") },
  { value: "fortune_coin_hvh", label: getGameModeShortLabel("fortune_coin_hvh") },
  { value: "fortune_dice_hvh", label: getGameModeShortLabel("fortune_dice_hvh") },
  { value: "why_not_hvh", label: getGameModeShortLabel("why_not_hvh") },
  { value: "poly_hvh", label: getGameModeShortLabel("poly_hvh") },
  { value: "pastel_hvh", label: getGameModeShortLabel("pastel_hvh") },
  { value: "3dy_hvh", label: getGameModeShortLabel("3dy_hvh") },
  { value: "hex_hvh", label: getGameModeShortLabel("hex_hvh") },
];

export type HistoryGame = {
  gameId: string;
  mode: GameMode;
  result: GameResult;
  boardSize: number;
  totalMoves: number;
  opponent?: string;
  startedBy?: string;
  finishedAt: string;
};

export type UserStats = {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  gamesAbandoned: number;
  totalMoves: number;
  currentWinStreak: number;
  winRate: number;
};

export type UserHistoryResponse = {
  username: string;
  profilePicture?: string;
  stats: UserStats;
  pagination: {
    page: number;
    pageSize: number;
    totalGames: number;
    totalPages: number;
  };
  games: HistoryGame[];
};

export type RecordUserGameRequest = {
  gameId: string;
  mode: GameMode;
  result: GameResult;
  boardSize: number;
  totalMoves: number;
  opponent?: string;
  startedBy?: string;
};

export type UserHistoryQuery = {
  mode?: "all" | GameMode;
  result?: "all" | GameResult;
  sortBy?: "newest" | "oldest" | "movesDesc" | "movesAsc";
};

const USERS_API_URL = "/api/users";

function validateUsername(username: string): string {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    throw new Error("El nombre de usuario es obligatorio.");
  }
  if (normalizedUsername.length < 3) {
    throw new Error("El nombre de usuario debe tener al menos 3 caracteres.");
  }
  if (normalizedUsername.length > 20) {
    throw new Error("El nombre de usuario no puede exceder los 20 caracteres.");
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
    throw new Error("El usuario solo puede contener letras, numeros y los caracteres _ . -");
  }
  if (/^[._-]/.test(normalizedUsername) || /[._-]$/.test(normalizedUsername)) {
    throw new Error("El nombre de usuario no puede empezar ni terminar con puntos o guiones.");
  }

  return normalizedUsername;
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || `Error ${response.status}`);
  }
  return data as T;
}

type RawHistoryGame = Omit<HistoryGame, "mode" | "finishedAt"> & {
  mode: PersistedGameMode;
  finishedAt: string | Date;
};

function normalizeHistoryGame(game: RawHistoryGame): HistoryGame {
  return {
    gameId: game.gameId,
    mode: normalizeGameMode(game.mode),
    result: game.result,
    boardSize: game.boardSize,
    totalMoves: game.totalMoves,
    opponent: typeof game.opponent === "string" ? game.opponent.trim() : "",
    startedBy: typeof game.startedBy === "string" ? game.startedBy.trim() : "",
    finishedAt:
      game.finishedAt instanceof Date
        ? game.finishedAt.toISOString()
        : String(game.finishedAt),
  };
}

export function getHistoryOpponentLabel(game: Pick<HistoryGame, "mode" | "opponent">): string {
  const opponent = game.opponent?.trim();
  return opponent || getDefaultOpponentLabel(game.mode);
}

export function getHistoryStartedByLabel(
  game: Pick<HistoryGame, "startedBy" | "opponent">,
): string | null {
  const startedBy = game.startedBy?.trim();

  if (!startedBy) return null;
  if (startedBy === "player0") return "Player 0";
  if (startedBy === "player1") return "Player 1";
  if (startedBy === "human") return "Humano";
  if (startedBy === "bot") return game.opponent?.trim() || "Bot";
  if (startedBy === "random") return "Aleatorio";

  return startedBy;
}

export async function loginUser(username: string, password: string) {
  const response = await fetch(`${USERS_API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  return parseJson<{
    message: string;
    username: string;
    profilePicture?: string;
  }>(response);
}

export async function registerUser(body: {
  username: string;
  email: string;
  password: string;
  profilePicture?: string;
}) {
  const response = await fetch(`${USERS_API_URL}/createuser`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return parseJson<{ message: string }>(response);
}

export type SortByOption =
  | "winRate"
  | "gamesWon"
  | "gamesPlayed"
  | "gamesLost"
  | "gamesDrawn"
  | "totalMoves"
  | "gamesAbandoned";

export type RankingPodiumEntry = {
  username: string;
  profilePicture: string;
  stats: UserStats;
} | null;

export async function getRanking(
  sortBy: SortByOption = "winRate",
  page = 1,
  pageSize = 20,
) {
  const response = await fetch(
    `${USERS_API_URL}/ranking?sortBy=${encodeURIComponent(sortBy)}&page=${page}&pageSize=${pageSize}`,
  );

  return parseJson<{
    sortBy: string;
    period: string;
    podium?: {
      mostGames: RankingPodiumEntry;
      mostWins: RankingPodiumEntry;
      bestRate: RankingPodiumEntry;
    };
    pagination: {
      totalItems: number;
      page: number;
      pageSize: number;
      totalPages: number;
    };
    ranking: Array<{
      username: string;
      profilePicture: string;
      gamesPlayed: number;
      gamesWon: number;
      gamesLost: number;
      gamesDrawn: number;
      gamesAbandoned: number;
      totalMoves: number;
      winRate: number;
    }>;
  }>(response);
}

export async function getUserHistory(
  username: string,
  page = 1,
  pageSize = 5,
  query?: UserHistoryQuery,
): Promise<UserHistoryResponse> {
  const validUsername = validateUsername(username);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });

  if (query?.mode && query.mode !== "all") {
    params.set("mode", query.mode);
  }
  if (query?.result && query.result !== "all") {
    params.set("result", query.result);
  }
  if (query?.sortBy) {
    params.set("sortBy", query.sortBy);
  }

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/history?${params.toString()}`,
  );

  const data = await parseJson<Omit<UserHistoryResponse, "games"> & {
    games: RawHistoryGame[];
  }>(response);

  return {
    ...data,
    games: data.games.map(normalizeHistoryGame),
  };
}

export async function recordUserGame(username: string, body: RecordUserGameRequest) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/games`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const data = await parseJson<{
    username: string;
    stats: UserStats;
    savedGame: RawHistoryGame;
  }>(response);

  return {
    ...data,
    savedGame: normalizeHistoryGame(data.savedGame),
  };
}

export async function getUserStats(username: string) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/stats`,
  );

  return parseJson<{
    username: string;
    profilePicture?: string;
    stats: UserStats;
  }>(response);
}

export async function getUserProfile(username: string) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/profile`,
  );

  return parseJson<{
    username: string;
    email: string;
    profilePicture?: string;
  }>(response);
}

export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string,
) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/password`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPassword, newPassword }),
    },
  );

  return parseJson<{ message: string }>(response);
}

export async function changeUsername(username: string, newUsername: string) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/username`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newUsername }),
    },
  );

  return parseJson<{ message: string; username: string }>(response);
}

export async function changeAvatar(username: string, profilePicture: string) {
  const validUsername = validateUsername(username);

  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(validUsername)}/avatar`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profilePicture }),
    },
  );

  return parseJson<{ message: string; profilePicture: string }>(response);
}
