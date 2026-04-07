import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import GameHvH from "../vistas/game/GameHvH";
import { createHvhGame, deleteHvhGame, hvhMove, putConfig } from "../api/gamey";
import { getUserSession } from "../utils/session";
import useDeferredGameSave from "../game/useDeferredGameSave";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

const deferredGameSaveState = {
  authModalOpen: false,
  savingPendingGame: false,
  canOfferGuestSave: false,
  saveGameForCurrentSession: vi.fn(),
  registerFinishedGame: vi.fn(),
  handleGuestSaveRequested: vi.fn(),
  handleLoginSuccess: vi.fn(),
  closeAuthModal: vi.fn(),
};

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

describe("GameHvH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");
    vi.mocked(getUserSession).mockReturnValue({
      username: "marcelo",
      profilePicture: "avatar.png",
    } as any);

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      authModalOpen: false,
      savingPendingGame: false,
      canOfferGuestSave: false,
      saveGameForCurrentSession: vi.fn(),
      registerFinishedGame: vi.fn(),
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
    } as any);
  });

  it("usa valores por defecto si faltan params", () => {
    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "player0"]);    
    expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Empieza: Player 0");
    expect(props.canOfferGuestSave).toBe(false);
  });

  it("pasa shouldCountMove para contar solo jugadas de player0", () => {
    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    expect(props.shouldCountMove("player0")).toBe(true);
    expect(props.shouldCountMove("player1")).toBe(false);
    expect(props.shouldCountMove(null)).toBe(false);
  });

  it("normaliza starter random", () => {
    mockSearchParams = new URLSearchParams("size=8&hvhstarter=RaNdOm");

    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([8, "random"]);
    expect(props.resultConfig.subtitle).toBe("Tamaño: 8 · Empieza: Aleatorio");
  });

  it("start guarda config y crea la partida", async () => {
    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvhGame).mockResolvedValue({
      game_id: "g2",
      mode: "hvh",
      yen: { size: 9, layout: "." },
      status: { state: "ongoing", next: "player1" },
    } as any);

    mockSearchParams = new URLSearchParams("size=9&hvhstarter=player1");

    render(<GameHvH />);

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
    expect(result.game_id).toBe("g2");
  });

  it("move delega en hvhMove", async () => {
    vi.mocked(hvhMove).mockResolvedValue({} as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.move("g2", 2);

    expect(hvhMove).toHaveBeenCalledWith("g2", 2);
  });

  it("registra partida ganada cuando vence player0", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "player0",
      totalMoves: 11,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g1",
      mode: "classic_hvh",
      result: "won",
      boardSize: 7,
      totalMoves: 11,
      opponent: "Jugador local",
      startedBy: "player0",
    });
  });

  it("registra partida perdida cuando vence player1", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: "player1",
      totalMoves: 6,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g2",
      mode: "classic_hvh",
      result: "lost",
      boardSize: 7,
      totalMoves: 6,
      opponent: "Jugador local",
      startedBy: "player0",
    });
  });

  it("no registra partida terminada si winner es null", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: null,
      totalMoves: 3,
    });

    expect(registerFinishedGame).not.toHaveBeenCalled();
  });

  it("registra abandono y borra la partida", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g3",
      totalMoves: 8,
    });

    expect(saveGameForCurrentSession).toHaveBeenCalledWith({
      gameId: "g3",
      mode: "classic_hvh",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 8,
      opponent: "Jugador local",
      startedBy: "player0",
    });
    expect(deleteHvhGame).toHaveBeenCalledWith("g3");
  });

  it("si no hay sesión en abandono, igualmente borra la partida", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(getUserSession).mockReturnValue(null as any);
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g4",
      totalMoves: 1,
    });

    expect(saveGameForCurrentSession).not.toHaveBeenCalled();
    expect(deleteHvhGame).toHaveBeenCalledWith("g4");
  });

  it("propaga las props del hook al SessionGamePage y al AuthModal", () => {
    const handleGuestSaveRequested = vi.fn();
    const handleLoginSuccess = vi.fn();
    const closeAuthModal = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      authModalOpen: true,
      savingPendingGame: true,
      canOfferGuestSave: true,
      handleGuestSaveRequested,
      handleLoginSuccess,
      closeAuthModal,
    } as any);

    render(<GameHvH />);

    const sessionProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const authProps = authModalMock.mock.calls.at(-1)?.[0];

    expect(sessionProps.canOfferGuestSave).toBe(true);
    expect(sessionProps.guestSaveLoading).toBe(true);
    expect(sessionProps.onGuestSaveRequested).toBe(handleGuestSaveRequested);

    expect(authProps.open).toBe(true);
    expect(authProps.onClose).toBe(closeAuthModal);
    expect(authProps.onLoginSuccess).toBe(handleLoginSuccess);
  });
});