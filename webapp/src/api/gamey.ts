export type YEN = {
    size: number;
    turn: number;
    players: string[];
    layout: string;
};

/**
 * Al usar una ruta relativa ("/api/game"), el navegador enviará la petición 
 * al mismo dominio y puerto desde el que se sirve la aplicación (el Gateway).
 */
//const API_URL = "/api/game";
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

// ------- API Human vs Bot ---------------------------------------------------------------

export type StarterHvb = "human" | "bot";

export type NewHvbGameResponse = {
    yen: YEN;
    bot_move: { cell_id: number; coords: { x: number; y: number; z: number } } | null;
    status:
        | { state: "ongoing"; next: string }
        | { state: "finished"; winner: string };
};

export async function newHvbGame(
    size: number,
    botId: string,
    starter: StarterHvb
): Promise<NewHvbGameResponse> {
    const res = await fetch(`${API_URL}/v1/game/hvb/new/${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, starter }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

export type NewGameResponse = { yen: YEN };

export type GameConfig = {
    min_board_size: number;
    max_board_size: number;
};

export async function getGameConfig(): Promise<GameConfig> {
    const res = await fetch(`${API_URL}/v1/game/config`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

export type HumanVsBotMoveResponse = {
    yen: YEN;
    human_move: { cell_id: number; coords: { x: number; y: number; z: number } };
    bot_move: { cell_id: number; coords: { x: number; y: number; z: number } } | null;
    status:
        | { state: "ongoing"; next: string }
        | { state: "finished"; winner: string };
};

export async function newGame(size: number): Promise<NewGameResponse> {
    const res = await fetch(`${API_URL}/v1/game/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

export async function humanVsBotMove(botId: string, yen: YEN, cellId: number): Promise<HumanVsBotMoveResponse> {
    const res = await fetch(`${API_URL}/v1/game/hvb/move/${encodeURIComponent(botId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen, cell_id: cellId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

// ------- API Human vs Human -------------------------------------------------------------

export type StarterHvH = "player0" | "player1";

export type NewHvhGameResponse = {
    yen: YEN;
    status:
        | { state: "ongoing"; next: "player0" | "player1" }
        | { state: "finished"; winner: "player0" | "player1" };
};

export async function newHvhGame(size: number, starter: StarterHvH): Promise<NewHvhGameResponse> {
    const res = await fetch(`${API_URL}/v1/game/hvh/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ size, starter }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}

export type HumanVsHumanMoveResponse = {
    yen: YEN;
    move_applied: {
        cell_id: number;
        coords: { x: number; y: number; z: number };
        player: "player0" | "player1";
    };
    status:
        | { state: "ongoing"; next: "player0" | "player1" }
        | { state: "finished"; winner: "player0" | "player1" };
};

export async function humanVsHumanMove(yen: YEN, cellId: number): Promise<HumanVsHumanMoveResponse> {
    const res = await fetch(`${API_URL}/v1/game/hvh/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yen, cell_id: cellId }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? `HTTP ${res.status}`);
    }
    return res.json();
}