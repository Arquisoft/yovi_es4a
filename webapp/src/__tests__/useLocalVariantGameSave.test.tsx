import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useLocalVariantGameSave from "../game/useLocalVariantGameSave";
import { getUserSession } from "../utils/session";
import useDeferredGameSave from "../game/useDeferredGameSave";

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("../game/useDeferredGameSave", () => ({
  default: vi.fn(),
}));

describe("useLocalVariantGameSave", () => {
  const deleteGame = vi.fn();
  const registerDeferredFinishedGame = vi.fn();
  const handleGuestSaveRequested = vi.fn();
  const handleLoginSuccess = vi.fn();
  const closeAuthModal = vi.fn();
  const saveGameForCurrentSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      authModalOpen: true,
      savingPendingGame: false,
      canOfferGuestSave: true,
      registerFinishedGame: registerDeferredFinishedGame,
      handleGuestSaveRequested,
      handleLoginSuccess,
      closeAuthModal,
      saveGameForCurrentSession,
    } as any);
  });

  it("convierte winner a resultado y delega el guardado diferido", async () => {
    const { result } = renderHook(() =>
      useLocalVariantGameSave({
        boardSize: 9,
        mode: "master_hvh",
        opponent: "Jugador local",
        startedBy: "player1",
        deleteGame,
      }),
    );

    await result.current.registerFinishedGame("g1", "player0", 12);
    await result.current.registerFinishedGame("g2", "player1", 8);
    await result.current.registerFinishedGame("g3", null, 5);

    expect(registerDeferredFinishedGame).toHaveBeenNthCalledWith(1, {
      gameId: "g1",
      mode: "master_hvh",
      result: "won",
      boardSize: 9,
      totalMoves: 12,
      opponent: "Jugador local",
      startedBy: "player1",
    });
    expect(registerDeferredFinishedGame).toHaveBeenNthCalledWith(2, expect.objectContaining({
      gameId: "g2",
      result: "lost",
    }));
    expect(registerDeferredFinishedGame).toHaveBeenNthCalledWith(3, expect.objectContaining({
      gameId: "g3",
      result: "draw",
    }));
  });

  it("guarda abandono en sesión y luego borra la partida", async () => {
    vi.mocked(getUserSession).mockReturnValue({ username: "marcelo" } as any);

    const { result } = renderHook(() =>
      useLocalVariantGameSave({
        boardSize: 7,
        mode: "fortune_coin_hvh",
        opponent: "Jugador local",
        startedBy: "random",
        deleteGame,
      }),
    );

    await result.current.registerAbandonedGame("g4", 6);

    expect(saveGameForCurrentSession).toHaveBeenCalledWith({
      gameId: "g4",
      mode: "fortune_coin_hvh",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 6,
      opponent: "Jugador local",
      startedBy: "random",
    });
    expect(deleteGame).toHaveBeenCalledWith("g4");
  });

  it("si no hay sesión, no intenta guardar pero sí borra la partida", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);

    const { result } = renderHook(() =>
      useLocalVariantGameSave({
        boardSize: 7,
        mode: "classic_hvh",
        opponent: "Jugador local",
        startedBy: "player0",
        deleteGame,
      }),
    );

    await result.current.registerAbandonedGame("g5", 2);

    expect(saveGameForCurrentSession).not.toHaveBeenCalled();
    expect(deleteGame).toHaveBeenCalledWith("g5");
  });

  it("expone sin cambios los handlers del hook interno", () => {
    const { result } = renderHook(() =>
      useLocalVariantGameSave({
        boardSize: 7,
        mode: "classic_hvh",
        opponent: "Jugador local",
        startedBy: "player0",
        deleteGame,
      }),
    );

    const payload = { gameId: "g6", winner: "player0", totalMoves: 3 } as any;
    result.current.handleGuestSaveRequested(payload);

    expect(result.current.authModalOpen).toBe(true);
    expect(result.current.canOfferGuestSave).toBe(true);
    expect(handleGuestSaveRequested).toHaveBeenCalledWith(payload);
    expect(result.current.handleLoginSuccess).toBe(handleLoginSuccess);
    expect(result.current.closeAuthModal).toBe(closeAuthModal);
  });
});
