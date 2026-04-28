import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useDeferredGameSave from "../game/useDeferredGameSave";
import { getUserSession } from "../utils/session";
import { recordUserGame } from "../api/users";
import { App } from "antd";

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("../api/users", () => ({
  recordUserGame: vi.fn(),
}));

vi.mock("antd", () => ({
  App: {
    useApp: () => ({
      message: {
        success: vi.fn(),
        error: vi.fn(),
      },
    }),
  },
}));

describe("useDeferredGameSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("debería inicializar con valores por defecto", () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);
    const { result } = renderHook(() => useDeferredGameSave());
    expect(result.current.authModalOpen).toBe(false);
    expect(result.current.pendingFinishedGame).toBe(null);
  });

  it("registerFinishedGame debería guardar directamente si hay sesión", async () => {
    vi.mocked(getUserSession).mockReturnValue({ username: "user1" } as any);
    const { result } = renderHook(() => useDeferredGameSave());
    
    const payload = { gameId: "g1", mode: "classic_hvh", result: "won", boardSize: 7, totalMoves: 5, opponent: "Opp", startedBy: "player0" } as any;
    
    await act(async () => {
      await result.current.registerFinishedGame(payload);
    });

    expect(recordUserGame).toHaveBeenCalledWith("user1", payload);
  });

  it("registerFinishedGame debería poner en pendiente si no hay sesión", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);
    const { result } = renderHook(() => useDeferredGameSave());
    
    const payload = { gameId: "g1" } as any;
    
    await act(async () => {
      await result.current.registerFinishedGame(payload);
    });

    expect(result.current.pendingFinishedGame).toEqual(payload);
    expect(result.current.canOfferGuestSave).toBe(true);
  });

  it("handleLoginSuccess debería guardar la partida pendiente", async () => {
    vi.mocked(getUserSession)
      .mockReturnValueOnce(null as any) // Al inicio
      .mockReturnValue({ username: "user1" } as any); // Después de login

    const { result } = renderHook(() => useDeferredGameSave());
    
    const payload = { gameId: "g1" } as any;
    await act(async () => {
      await result.current.registerFinishedGame(payload);
    });

    await act(async () => {
      await result.current.handleLoginSuccess();
    });

    expect(recordUserGame).toHaveBeenCalledWith("user1", payload);
    expect(result.current.pendingFinishedGame).toBe(null);
  });
});
