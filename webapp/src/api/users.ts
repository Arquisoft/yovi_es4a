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
    | "whynot_hvh"
    | "3dy_hvh"
    | "hex_hvh";

export type HistoryGame = {
    gameId: string;
    mode: GameMode;
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
    result: "won" | "lost" | "abandoned";
    boardSize: number;
    totalMoves: number;
    opponent?: string;
    startedBy?: string;
};

export type UserHistoryQuery = {
    mode?: "all" | GameMode;
    result?: "all" | "won" | "lost" | "abandoned";
    sortBy?: "newest" | "oldest" | "movesDesc" | "movesAsc";
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

export type SortByOption = "winRate" | "gamesWon" | "gamesPlayed" | "gamesLost" | "totalMoves" | "gamesAbandoned";

export type RankingPodiumEntry = {
    username: string;
    profilePicture: string;
    stats: UserStats;
} | null;

export async function getRanking(sortBy: SortByOption = "winRate", page = 1, pageSize = 20) {
    const response = await fetch(
        `${USERS_API_URL}/ranking?sortBy=${encodeURIComponent(sortBy)}&page=${page}&pageSize=${pageSize}`
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
    query?: UserHistoryQuery
): Promise<UserHistoryResponse> {
    const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
    });

    if (query?.mode && query.mode !== "all")
        params.set("mode", query.mode);

    if (query?.result && query.result !== "all")
        params.set("result", query.result);

    if (query?.sortBy)
        params.set("sortBy", query.sortBy);

    const response = await fetch(
        `${USERS_API_URL}/users/${encodeURIComponent(username)}/history?${params.toString()}`
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