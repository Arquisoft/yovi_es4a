import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSessionGame } from "../game/useSessionGame";

describe("useSessionGame", () => {
    const startMock = vi.fn();
    const moveMock = vi.fn();

    beforeEach(() => {
        startMock.mockReset();
        moveMock.mockReset();
    });

    it("inicia partida al montar y rellena yen/gameId", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        const { result } = renderHook(() =>
            useSessionGame({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe("");

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(startMock).toHaveBeenCalledTimes(1);
        expect(result.current.gameId).toBe("g1");
        expect(result.current.yen).toEqual({ size: 7, layout: "." });
        expect(result.current.gameOver).toBe(false);
        expect(result.current.winner).toBeNull();
    });

    it("si start devuelve finished marca gameOver y winner", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g2",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "human" },
        });

        const { result } = renderHook(() =>
            useSessionGame({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("human");
    });

    it("si start devuelve finished sin winner usa null", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g3",
            yen: { size: 7, layout: "." },
            status: { state: "finished" },
        });

        const { result } = renderHook(() =>
            useSessionGame({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBeNull();
    });

    it("si start falla con Error usa e.message", async () => {
        startMock.mockRejectedValueOnce(new Error("boom"));

        const { result } = renderHook(() =>
            useSessionGame({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("boom");
        expect(result.current.yen).toBeNull();
        expect(result.current.gameId).toBeNull();
    });

    it("si start falla con string usa String(e)", async () => {
        startMock.mockRejectedValueOnce("START_FAIL");

        const { result } = renderHook(() =>
            useSessionGame({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.error).toBe("START_FAIL");
    });

    it("resetea estado cuando cambian las deps y vuelve a iniciar", async () => {
        startMock
            .mockResolvedValueOnce({
                game_id: "g1",
                yen: { size: 7, layout: "." },
                status: { state: "finished", winner: "human" },
            })
            .mockResolvedValueOnce({
                game_id: "g2",
                yen: { size: 9, layout: ".." },
                status: { state: "ongoing", next: "bot" },
            });

        const { result, rerender } = renderHook(
            ({ deps }) =>
                useSessionGame({
                    deps,
                    start: startMock,
                    move: moveMock,
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

        rerender({ deps: [9] });

        expect(result.current.loading).toBe(true);
        expect(result.current.error).toBe("");
        expect(result.current.yen).toBeNull();
        expect(result.current.gameId).toBeNull();
        expect(result.current.winner).toBeNull();
        expect(result.current.gameOver).toBe(false);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(startMock).toHaveBeenCalledTimes(2);
        expect(result.current.gameId).toBe("g2");
        expect(result.current.yen).toEqual({ size: 9, layout: ".." });
    });

    it("onCellClick no hace nada si no hay yen", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: null,
            status: { state: "ongoing", next: "human" },
        });

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(0);
        });

        expect(moveMock).not.toHaveBeenCalled();
    });

    it("onCellClick no hace nada si no hay gameId", async () => {
        startMock.mockResolvedValueOnce({
            game_id: null,
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(0);
        });

        expect(moveMock).not.toHaveBeenCalled();
    });

    it("onCellClick no hace nada si gameOver=true", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "finished", winner: "human" },
        });

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(0);
        });

        expect(moveMock).not.toHaveBeenCalled();
    });

    it("onCellClick limpia error, pone loading y actualiza yen en ongoing", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        let resolveMove!: (value: any) => void;
        moveMock.mockReturnValueOnce(
            new Promise((res) => {
                resolveMove = res;
            }),
        );

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

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
    });

    it("onCellClick marca finished con winner", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        moveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "y" },
            status: { state: "finished", winner: "bot" },
        });

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(1);
        });

        expect(result.current.yen).toEqual({ size: 7, layout: "y" });
        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBe("bot");
    });

    it("onCellClick marca finished con winner null si falta winner", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        moveMock.mockResolvedValueOnce({
            yen: { size: 7, layout: "z" },
            status: { state: "finished" },
        });

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(2);
        });

        expect(result.current.gameOver).toBe(true);
        expect(result.current.winner).toBeNull();
    });

    it("onCellClick captura errores con Error.message", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        moveMock.mockRejectedValueOnce(new Error("BAD_MOVE"));

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(5);
        });

        expect(result.current.error).toBe("BAD_MOVE");
        expect(result.current.loading).toBe(false);
    });

    it("onCellClick captura errores con String(e)", async () => {
        startMock.mockResolvedValueOnce({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        moveMock.mockRejectedValueOnce("MOVE_FAIL");

        const { result } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            await result.current.onCellClick(5);
        });

        expect(result.current.error).toBe("MOVE_FAIL");
    });

    it("si se desmonta antes de que start resuelva no intenta actualizar estado", async () => {
        let resolveStart!: (value: any) => void;
        startMock.mockReturnValueOnce(
            new Promise((res) => {
                resolveStart = res;
            }),
        );

        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const { unmount } = renderHook(() =>
            useSessionGame<any>({
                deps: [7],
                start: startMock,
                move: moveMock,
            }),
        );

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