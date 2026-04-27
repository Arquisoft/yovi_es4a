import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import LocalHvHVariantPage from "../game/LocalHvHVariantPage";
import { createHvhGame, deleteHvhGame, hvhMove, putConfig } from "../api/gamey";
import useDeferredGameSave from "../game/useDeferredGameSave";
import { getUserSession } from "../utils/session";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=9&hvhstarter=player1");

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
  };
});

vi.mock("../api/gamey", () => ({
  createHvhGame: vi.fn(),
  deleteHvhGame: vi.fn(),
  hvhMove: vi.fn(),
  putConfig: vi.fn(),
}));

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
}));

vi.mock("../game/useDeferredGameSave", () => ({
  default: vi.fn(),
}));

vi.mock("../game/SessionGamePage", () => ({
  default: (props: any) => {
    sessionGamePageMock(props);
    return <div>SessionGamePage</div>;
  },
}));

vi.mock("../vistas/registroLogin/AuthModal", () => ({
  default: (props: any) => {
    authModalMock(props);
    return <div>AuthModal</div>;
  },
}));

describe("LocalHvHVariantPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=9&hvhstarter=player1");
    vi.mocked(getUserSession).mockReturnValue({ username: "marcelo" } as any);
    vi.mocked(useDeferredGameSave).mockReturnValue({
      authModalOpen: true,
      savingPendingGame: true,
      canOfferGuestSave: true,
      saveGameForCurrentSession: vi.fn(),
      registerFinishedGame: vi.fn(),
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
    } as any);
  });

  it("configura SessionGamePage y AuthModal con las props del hook", () => {
    render(
      <LocalHvHVariantPage
        title="Juego Y - Local"
        mode="classic_hvh"
        opponent="Jugador local"
        subtitleSuffix="Extra"
      />,
    );

    const sessionProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const authProps = authModalMock.mock.calls.at(-1)?.[0];

    expect(sessionProps.deps).toEqual([9, "player1"]);
    expect(sessionProps.resultConfig.title).toBe("Juego Y - Local");
    expect(sessionProps.resultConfig.subtitle).toBe("Tamaño: 9 · Empieza: Player 1 · Extra");
    expect(sessionProps.canOfferGuestSave).toBe(true);
    expect(sessionProps.guestSaveLoading).toBe(true);
    expect(authProps.open).toBe(true);
  });

  it("start guarda config y crea una partida HvH", async () => {
    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvhGame).mockResolvedValue({
      game_id: "g-local",
      yen: { size: 9, layout: "." },
      status: { state: "ongoing", next: "player1" },
    } as any);

    render(
      <LocalHvHVariantPage
        title="Juego Y - Local"
        mode="classic_hvh"
        opponent="Jugador local"
      />,
    );

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const result = await props.start();

    expect(putConfig).toHaveBeenCalledWith({
      size: 9,
      hvb_starter: "human",
      bot_id: null,
      hvh_starter: "player1",
    });
    expect(createHvhGame).toHaveBeenCalledWith({
      size: 9,
      hvh_starter: "player1",
    });
    expect(result.game_id).toBe("g-local");
  });

  it("move delega en hvhMove", async () => {
    vi.mocked(hvhMove).mockResolvedValue({} as any);

    render(
      <LocalHvHVariantPage
        title="Juego Y - Local"
        mode="classic_hvh"
        opponent="Jugador local"
      />,
    );

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    await props.move("g1", 4);

    expect(hvhMove).toHaveBeenCalledWith("g1", 4);
  });

  it("registra el resultado final traduciendo winner a won/lost/draw", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      authModalOpen: false,
      savingPendingGame: false,
      canOfferGuestSave: false,
      saveGameForCurrentSession: vi.fn(),
      registerFinishedGame,
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
    } as any);

    render(
      <LocalHvHVariantPage
        title="Juego Y - Local"
        mode="why_not_hvh"
        opponent="Jugador local"
      />,
    );

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({ gameId: "g1", winner: "player0", totalMoves: 10 });
    await props.onGameFinished({ gameId: "g2", winner: "player1", totalMoves: 11 });
    await props.onGameFinished({ gameId: "g3", winner: null, totalMoves: 12 });

    expect(registerFinishedGame).toHaveBeenNthCalledWith(1, expect.objectContaining({
      gameId: "g1",
      result: "won",
    }));
    expect(registerFinishedGame).toHaveBeenNthCalledWith(2, expect.objectContaining({
      gameId: "g2",
      result: "lost",
    }));
    expect(registerFinishedGame).toHaveBeenNthCalledWith(3, expect.objectContaining({
      gameId: "g3",
      result: "draw",
    }));
  });

  it("en abandono guarda si hay sesión y siempre borra la partida", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      authModalOpen: false,
      savingPendingGame: false,
      canOfferGuestSave: false,
      saveGameForCurrentSession,
      registerFinishedGame: vi.fn(),
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
    } as any);

    render(
      <LocalHvHVariantPage
        title="Juego Y - Local"
        mode="classic_hvh"
        opponent="Jugador local"
      />,
    );

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    await props.onGameAbandoned({ gameId: "g4", totalMoves: 7 });

    expect(saveGameForCurrentSession).toHaveBeenCalledWith(expect.objectContaining({
      gameId: "g4",
      result: "abandoned",
      boardSize: 9,
      startedBy: "player1",
    }));
    expect(deleteHvhGame).toHaveBeenCalledWith("g4");
  });
});
