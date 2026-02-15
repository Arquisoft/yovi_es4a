export type YEN = {
    size: number;
    turn: number;
    players: string[];
    layout: string;
};

export type NewGameResponse = { yen: YEN };

export type HumanVsBotMoveResponse = {
    yen: YEN;
    human_move: { cell_id: number; coords: { x: number; y: number; z: number } };
    bot_move: { cell_id: number; coords: { x: number; y: number; z: number } } | null;
    status:
        | { state: "ongoing"; next: string }
        | { state: "finished"; winner: string };
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

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
