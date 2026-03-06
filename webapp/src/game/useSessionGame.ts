import { useCallback, useEffect, useMemo, useState } from "react";

export type SessionGameStatus =
    | { state: "ongoing"; next?: string }
    | { state: "finished"; winner?: string };

export type SessionGameStartResponse<YEN> = {
    game_id: string;
    yen: YEN;
    status: SessionGameStatus;
};

export type SessionGameMoveResponse<YEN> = {
    yen: YEN;
    status: SessionGameStatus;
};

type UseSessionGameArgs<YEN> = {
    deps: any[]; // dependencias para reiniciar (size/bot/starter...)
    start: () => Promise<SessionGameStartResponse<YEN>>;
    move: (gameId: string, cellId: number) => Promise<SessionGameMoveResponse<YEN>>;
};

export function useSessionGame<YEN>({ deps, start, move }: UseSessionGameArgs<YEN>) {
    const [yen, setYen] = useState<YEN | null>(null);
    const [gameId, setGameId] = useState<string | null>(null);
    const [winner, setWinner] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [gameOver, setGameOver] = useState(false);

    // Start game (re-run when deps change)
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setError("");
            setLoading(true);
            setYen(null);
            setGameId(null);
            setWinner(null);
            setGameOver(false);

            try {
                const r = await start();
                if (cancelled) return;

                setGameId(r.game_id);
                setYen(r.yen);

                if (r.status.state === "finished") {
                    setGameOver(true);
                    setWinner(r.status.winner ?? null);
                }
            } catch (e: any) {
                if (!cancelled) setError(e?.message ?? String(e));
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        run();
        return () => {
            cancelled = true;
        };
    }, deps);

    const onCellClick = useCallback(
        async (cellId: number) => {
            if (!yen || !gameId || gameOver) return;

            setError("");
            setLoading(true);
            try {
                const r = await move(gameId, cellId);
                setYen(r.yen);

                if (r.status.state === "finished") {
                    setGameOver(true);
                    setWinner(r.status.winner ?? null);
                } else {
                    setGameOver(false);
                    setWinner(null);
                }
            } catch (e: any) {
                setError(e?.message ?? String(e));
            } finally {
                setLoading(false);
            }
        },
        [yen, gameId, gameOver, move],
    );

    const resetState = useMemo(
        () => ({
            yen,
            gameId,
            winner,
            error,
            loading,
            gameOver,
            setError,
        }),
        [yen, gameId, winner, error, loading, gameOver],
    );

    return { ...resetState, onCellClick };
}