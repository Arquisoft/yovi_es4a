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
    game_id?: string;
    yen: YEN;
    status: SessionGameStatus;
};

type UseSessionGameArgs<YEN> = {
    deps: readonly unknown[];
    start: () => Promise<SessionGameStartResponse<YEN>>;
    move: (gameId: string, cellId: number) => Promise<SessionGameMoveResponse<YEN>>;
    botMove?: (gameId: string) => Promise<SessionGameMoveResponse<YEN>>;
};

export function useSessionGame<YEN>({
    deps,
    start,
    move,
    botMove
}: UseSessionGameArgs<YEN>) {
    const [yen, setYen] = useState<YEN | null>(null);
    const [gameId, setGameId] = useState<string | null>(null);
    const [winner, setWinner] = useState<string | null>(null);
    const [nextTurn, setNextTurn] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [moveCount, setMoveCount] = useState(0);

    // Start game (re-run when deps change)
    useEffect(() => {
        let cancelled = false;

        async function run() {
            setError("");
            setLoading(true);
            setYen(null);
            setGameId(null);
            setWinner(null);
            setNextTurn(null);
            setGameOver(false);
            setMoveCount(0);

            try {
                const r = await start();
                if (cancelled) return;

                setGameId(r.game_id);
                setYen(r.yen);

                if (r.status.state === "finished") {
                    setGameOver(true);
                    setWinner(r.status.winner ?? null);
                    setNextTurn(null);
                } else {
                    setGameOver(false);
                    setWinner(null);
                    setNextTurn(r.status.next ?? null);
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
                setMoveCount((prev) => prev + 1);

                if (r.status.state === "finished") {
                    setGameOver(true);
                    setWinner(r.status.winner ?? null);
                    setNextTurn(null);
                } else {
                    setGameOver(false);
                    setWinner(null);
                    setNextTurn(r.status.next ?? null);
                }
            } catch (e: any) {
                setError(e?.message ?? String(e));
            } finally {
                setLoading(false);
            }
        },
        [yen, gameId, gameOver, move],
    );

    const onBotTurn = useCallback(async () => {
        if (!botMove || !gameId || gameOver) return;

        setError("");
        setLoading(true);

        try {
            const r = await botMove(gameId);
            setYen(r.yen);
            setMoveCount((prev) => prev + 1);

            if (r.status.state === "finished") {
                setGameOver(true);
                setWinner(r.status.winner ?? null);
                setNextTurn(null);
            } else {
                setGameOver(false);
                setWinner(null);
                setNextTurn(r.status.next ?? null);
            }
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }, [botMove, gameId, gameOver]);

    const resetState = useMemo(
        () => ({
            yen,
            gameId,
            winner,
            nextTurn,
            error,
            loading,
            gameOver,
            moveCount,
            setError,
        }),
        [yen, gameId, winner, nextTurn, error, loading, gameOver, moveCount],
    );

    return { ...resetState, onCellClick, onBotTurn };
}