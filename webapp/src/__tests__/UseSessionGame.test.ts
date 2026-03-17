import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSessionGame } from "../game/useSessionGame";

describe("useSessionGame", () => {
    const startMock = vi.fn();
    const moveMock = vi.fn();
    const botMoveMock = vi.fn();

    const ongoingStart = (next: string = "human", overrides: Record<string, unknown> = {}) => ({
        game_id: "g1",
        yen: { size: 7, layout: "." },
        status: { state: "ongoing" as const, next },
        ...overrides,
    });

    const finishedStart = (winner?: string, overrides: Record<string, unknown> = {}) => ({
        game_id: "g1",
        yen: { size: 7, layout: "." },
        status: winner
            ? { state: "finished" as const, winner }
            : { state: "finished" as const },
        ...overrides,
    });

    function renderSessionGame(options?: {
        deps?: readonly unknown[];
        start?: typeof startMock;
        move?: typeof moveMock;
        botMove?: typeof botMoveMock | undefined;
    }) {
        return renderHook(() =>
            useSessionGame<any>({
                deps: options?.deps ?? [7],
                start: options?.start ?? startMock,
                move: options?.move ?? moveMock,
                botMove: options?.botMove === undefined ? botMoveMock : options.botMove,
            }),
        );
    }

    async function setupStarted(
        startResponse = ongoingStart("human"),
        options?: {
            deps?: readonly unknown[];
            botMove?: typeof botMoveMock | undefined;
        },
    ) {
        startMock.mockResolvedValueOnce(startResponse);

        const hook = renderSessionGame({
            deps: options?.deps,
            botMove: options?.botMove,
        });

        await waitFor(() => {
            expect(hook.result.current.loading).toBe(false);
        });

        return hook;
    }

    beforeEach(() => {
        startMock.mockReset();
        moveMock.mockReset();
        botMoveMock.mockReset();
    });

    it("inicia partida al montar y rellena yen/gameId/nextTurn", async () => {
        const { result } = renderSessionGame();

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe("");

        startMock.mockResolvedValueOnce(ongoingStart("human"));

        // Volvemos a montar con la respuesta preparada
        const mounted = renderSessionGame();

        await waitFor(() => {
            expect(mounted.result.current.loading).toBe(false);
        });

        expect(startMock).toHaveBeenCalledTimes(2);
        expect(mounted.result.current.gameId).toBe("g1");
        expect(mounted.result.current.yen).toEqual({ size: 7, layout: "." });
        expect(mounted.result.current.gameOver).toBe(false);
        expect(mounted.result.current.winner).toBeNull();
        expect(mounted.result.current.nextTurn).toBe("human");
    });

    it("si start falla con Error usa e.message", async () => {
        startMock.mockRejectedValueOnce(new Error("boom"));

        const { result } = renderSessionGame();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("boom");
        expect(result.current.yen).toBeNull();
        expect(result.current.gameId).toBeNull();
        expect(result.current.nextTurn).toBeNull();
    });

    it("si start falla con string usa String(e)", async () => {
        startMock.mockRejectedValueOnce("START_FAIL");

        const { result } = renderSessionGame();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("START_FAIL");
    });

    it("resetea estado cuando cambian las deps y vuelve a iniciar", async () => {
        startMock
            .mockResolvedValueOnce(finishedStart("human"))
            .mockResolvedValueOnce({
                game_id: "g2",
                yen: { size: 9, layout: ".." },
                status: { state: "ongoing" as const, next: "bot" },
            });

        const { result, rerender } = renderHook(
            ({ deps }) =>
                useSessionGame<any>({
                    deps,
                    start: startMock,
                    move: moveMock,
                    botMove: botMoveMock,
                }),
            {
                initialProps: { deps: [7] },
            },
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("human");
        expect(result.current.gameId).toBe("g1");
        expect(result.current.nextTurn).toBeNull();

        rerender({ deps: [9] });

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe("");
        expect(result.current.yen).toBeNull();
        expect(result.current.gameId).toBeNull();
        expect(result.current.winner).toBeNull();
        expect(result.current.gameOver).toBe(false);
        expect(result.current.nextTurn).toBeNull();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(startMock).toHaveBeenCalledTimes(2);
        expect(result.current.gameId).toBe("g2");
        expect(result.current.yen).toEqual({ size: 9, layout: ".." });
        expect(result.current.nextTurn).toBe("bot");
    });


    it("onCellClick limpia error, pone loading y actualiza yen y nextTurn en ongoing", async () => {
        let resolveMove!: (value: any) => void;
        moveMock.mockReturnValueOnce(
            new Promise((res) => {
                resolveMove = res;
            }),
        );

        const { result } = await setupStarted(ongoingStart("human"));

        act(() => {
            result.current.setError("OLD_ERROR");
        });

        act(() => {
            result.current.onCellClick(3);
        });

        expect(result.current.error).toBe("");
        expect(result.current.loading).toBe(true);
        expect(moveMock).toHaveBeenCalledWith("g1", 3);

        await act(async () => {
            resolveMove({
                yen: { size: 7, layout: "x" },
                status: { state: "ongoing", next: "bot" },
            });
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.yen).toEqual({ size: 7, layout: "x" });
        expect(result.current.gameOver).toBe(false);
        expect(result.current.winner).toBeNull();
        expect(result.current.nextTurn).toBe("bot");
    });

    it("onCellClick marca finished con winner", async () => {
        moveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "y" },
            status: { state: "finished", winner: "bot" },
        });

        const { result } = await setupStarted(ongoingStart("human"));

        await act(async () => {
            await result.current.onCellClick(1);
        });

        expect(result.current.yen).toEqual({ size: 7, layout: "y" });
        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("bot");
        expect(result.current.nextTurn).toBeNull();
    });

    it("onCellClick marca finished con winner null si falta winner", async () => {
        moveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "z" },
            status: { state: "finished" },
        });

        const { result } = await setupStarted(ongoingStart("human"));

        await act(async () => {
            await result.current.onCellClick(2);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBeNull();
        expect(result.current.nextTurn).toBeNull();
    });

    it.each([
        ["Error.message", new Error("BAD_MOVE"), "BAD_MOVE"],
        ["String(e)", "MOVE_FAIL", "MOVE_FAIL"],
    ])("onCellClick captura errores con %s", async (_, thrown, expectedMessage) => {
        moveMock.mockRejectedValueOnce(thrown);

        const { result } = await setupStarted(ongoingStart("human"));

        await act(async () => {
            await result.current.onCellClick(5);
        });

        expect(result.current.error).toBe(expectedMessage);
        expect(result.current.loading).toBe(false);
        expect(result.current.nextTurn).toBe("human");
    });

    it("onBotTurn actualiza yen y nextTurn en ongoing", async () => {
        botMoveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "after-bot" },
            status: { state: "ongoing", next: "human" },
        });

        const { result } = await setupStarted(ongoingStart("bot"));

        await act(async () => {
            await result.current.onBotTurn();
        });

        expect(botMoveMock).toHaveBeenCalledWith("g1");
        expect(result.current.yen).toEqual({ size: 7, layout: "after-bot" });
        expect(result.current.nextTurn).toBe("human");
        expect(result.current.gameOver).toBe(false);
    });

    it("onBotTurn marca finished con winner", async () => {
        botMoveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "bot-win" },
            status: { state: "finished", winner: "bot" },
        });

        const { result } = await setupStarted(ongoingStart("bot"));

        await act(async () => {
            await result.current.onBotTurn();
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("bot");
        expect(result.current.nextTurn).toBeNull();
    });

    it("onBotTurn captura errores", async () => {
        botMoveMock.mockRejectedValueOnce(new Error("BOT_FAIL"));

        const { result } = await setupStarted(ongoingStart("bot"));

        await act(async () => {
            await result.current.onBotTurn();
        });

        expect(result.current.error).toBe("BOT_FAIL");
        expect(result.current.loading).toBe(false);
        expect(result.current.nextTurn).toBe("bot");
    });

    it("si se desmonta antes de que start resuelva no intenta actualizar estado", async () => {
        let resolveStart!: (value: any) => void;
        startMock.mockReturnValueOnce(
            new Promise((res) => {
                resolveStart = res;
            }),
        );

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const { unmount } = renderSessionGame();

        unmount();

        await act(async () => {
            resolveStart({
                game_id: "late",
                yen: { size: 7, layout: "." },
                status: { state: "ongoing", next: "human" },
            });
        });

        expect(consoleErrorSpy).not.toHaveBeenCalled();
        consoleErrorSpy.mockRestore();
    });
});