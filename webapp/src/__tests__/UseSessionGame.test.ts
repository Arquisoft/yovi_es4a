import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionGame } from "../game/useSessionGame";

describe("useSessionGame", () => {
    const startMock = vi.fn();
    const moveMock = vi.fn();
    const botMoveMock = vi.fn();

    const ongoing = (next = "human") => ({
        game_id: "g1",
        yen: { size: 7, layout: "." },
        status: { state: "ongoing" as const, next },
    });

    const finished = (winner?: string) => ({
        game_id: "g1",
        yen: { size: 7, layout: "." },
        status: winner
            ? { state: "finished" as const, winner }
            : { state: "finished" as const },
    });

    function mount(deps: readonly unknown[] = [7], botMove = botMoveMock) {
        return renderHook(() =>
            useSessionGame({
                deps,
                start: startMock,
                move: moveMock,
                botMove,
            }),
        );
    }

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("inicia partida al montar", async () => {
        startMock.mockResolvedValueOnce(ongoing("human"));

        const { result } = mount();

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(startMock).toHaveBeenCalledTimes(1);
        expect(result.current.gameId).toBe("g1");
        expect(result.current.yen).toEqual({ size: 7, layout: "." });
        expect(result.current.nextTurn).toBe("human");
        expect(result.current.gameOver).toBe(false);
        expect(result.current.moveCount).toBe(0);
    });

    it("marca finished si el start ya devuelve partida terminada", async () => {
        startMock.mockResolvedValueOnce(finished("bot"));

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("bot");
        expect(result.current.nextTurn).toBeNull();
    });

    it("guarda error si start falla", async () => {
        startMock.mockRejectedValueOnce(new Error("boom"));

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("boom");
        expect(result.current.gameId).toBeNull();
    });

    it("reinicia el estado si cambian las deps", async () => {
        startMock
            .mockResolvedValueOnce(finished("human"))
            .mockResolvedValueOnce({
                game_id: "g2",
                yen: { size: 9, layout: "..." },
                status: { state: "ongoing" as const, next: "bot" },
            });

        const { result, rerender } = renderHook(
            ({ deps }) =>
                useSessionGame({
                    deps,
                    start: startMock,
                    move: moveMock,
                    botMove: botMoveMock,
                }),
            { initialProps: { deps: [7] as readonly unknown[] } },
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.winner).toBe("human");

        rerender({ deps: [9] });

        expect(result.current.loading).toBe(true);
        expect(result.current.gameId).toBeNull();
        expect(result.current.yen).toBeNull();
        expect(result.current.winner).toBeNull();
        expect(result.current.moveCount).toBe(0);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gameId).toBe("g2");
        expect(result.current.nextTurn).toBe("bot");
    });

    it("onCellClick actualiza yen, turno y moveCount", async () => {
        startMock.mockResolvedValueOnce(ongoing("human"));
        moveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "x" },
            status: { state: "ongoing", next: "bot" },
        });

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(3);
        });

        expect(moveMock).toHaveBeenCalledWith("g1", 3);
        expect(result.current.yen).toEqual({ size: 7, layout: "x" });
        expect(result.current.nextTurn).toBe("bot");
        expect(result.current.moveCount).toBe(1);
    });

    it("onCellClick ignora clicks si no hay partida o ya acabó", async () => {
        startMock.mockResolvedValueOnce(finished("human"));

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(1);
        });

        expect(moveMock).not.toHaveBeenCalled();
    });

    it("onBotTurn actualiza estado y moveCount", async () => {
        startMock.mockResolvedValueOnce(ongoing("bot"));
        botMoveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "after-bot" },
            status: { state: "ongoing", next: "human" },
        });

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onBotTurn();
        });

        expect(botMoveMock).toHaveBeenCalledWith("g1");
        expect(result.current.yen).toEqual({ size: 7, layout: "after-bot" });
        expect(result.current.nextTurn).toBe("human");
        expect(result.current.moveCount).toBe(1);
    });

    it("expone setError en el estado devuelto", async () => {
        startMock.mockResolvedValueOnce(ongoing("human"));

        const { result } = mount();

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        act(() => {
            result.current.setError("manual");
        });

        expect(result.current.error).toBe("manual");
    });
});