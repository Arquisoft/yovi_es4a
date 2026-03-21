export type HistoryGame = {
    gameId: string;
    mode: "HvB" | "HvH";
    result: "won" | "lost" | "abandoned";
    boardSize: number;
    totalMoves: number;
    opponent: string;
    startedBy: string;
    finishedAt: string;
};

export type UserStats = {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    gamesAbandoned: number;
    totalMoves: number;
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
    mode: "HvB" | "HvH";
    result: "won" | "lost" | "abandoned";
    boardSize: number;
    totalMoves: number;
    opponent?: string;
    startedBy?: string;
};

const USERS_API_URL = "/api/users";

async function parseJson<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok)
        throw new Error(data?.error || `Error ${response.status}`);
    return data as T;
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

export async function getRanking(sortBy: "winRate" | "gamesWon" | "gamesPlayed", limit = 20) {
    const response = await fetch(
        `${USERS_API_URL}/ranking?sortBy=${encodeURIComponent(sortBy)}&limit=${limit}`
    );

    return parseJson<{
        sortBy: string;
        ranking: Array<{
            username: string;
            profilePicture: string;
            gamesPlayed: number;
            gamesWon: number;
            gamesLost: number;
            gamesAbandoned: number;
            totalMoves: number;
            winRate: number;
        }>;
    }>(response);
}

export async function getUserHistory(
    username: string,
    page = 1,
    pageSize = 5
): Promise<UserHistoryResponse> {
    const response = await fetch(
        `${USERS_API_URL}/users/${encodeURIComponent(username)}/history?page=${page}&pageSize=${pageSize}`
    );

    return parseJson<UserHistoryResponse>(response);
}

export async function recordUserGame(username: string, body: RecordUserGameRequest) {
    const response = await fetch(
        `${USERS_API_URL}/users/${encodeURIComponent(username)}/games`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    );

    return parseJson<{
        username: string;
        stats: UserStats;
        savedGame: HistoryGame;
    }>(response);
}

export async function getUserStats(username: string) {
  const response = await fetch(
    `${USERS_API_URL}/users/${encodeURIComponent(username)}/stats`
  );

  return parseJson<{
    username: string;
    profilePicture?: string;
    stats: UserStats;
  }>(response);
}