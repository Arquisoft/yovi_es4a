import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import GameWhyNot from "../vistas/GameWhyNot";
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

describe("GameWhyNot", () => {
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

  it("usa valores por defecto y muestra el subtítulo de Why Not", () => {
    render(<GameWhyNot />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    expect(props.deps).toEqual([7, "player0"]);
    expect(props.resultConfig.title).toBe("Juego Y — WhY Not");
    expect(props.resultConfig.subtitle).toContain("Conectar los tres lados te hace perder");
  });

  it("invierte correctamente el ganador con mapWinner", () => {
    render(<GameWhyNot />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    expect(props.mapWinner("player0")).toBe("player1");
    expect(props.mapWinner("player1")).toBe("player0");
    expect(props.mapWinner(null)).toBe(null);
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

    render(<GameWhyNot />);

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

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.move("g2", 2);

    expect(hvhMove).toHaveBeenCalledWith("g2", 2);
  });

  it("registra partida perdida si quien gana lógicamente es player1", async () => {
    const registerFinishedGame = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    const logicalWinner = props.mapWinner("player0");

    await props.onGameFinished({
      gameId: "g1",
      winner: logicalWinner,
      totalMoves: 11,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g1",
      mode: "why_not_hvh",
      result: "lost",
      boardSize: 7,
      totalMoves: 11,
      opponent: "Jugador local (WhY Not)",
      startedBy: "player0",
    });
  });

  it("registra partida ganada si quien gana lógicamente es player0", async () => {
    const registerFinishedGame = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    const logicalWinner = props.mapWinner("player1");

    await props.onGameFinished({
      gameId: "g2",
      winner: logicalWinner,
      totalMoves: 6,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g2",
      mode: "why_not_hvh",
      result: "won",
      boardSize: 7,
      totalMoves: 6,
      opponent: "Jugador local (WhY Not)",
      startedBy: "player0",
    });
  });

  it("ignora onGameFinished si winner es null", async () => {
    const registerFinishedGame = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g-null",
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

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g3",
      totalMoves: 8,
    });

    expect(saveGameForCurrentSession).toHaveBeenCalledWith({
      gameId: "g3",
      mode: "why_not_hvh",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 8,
      opponent: "Jugador local (WhY Not)",
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

    render(<GameWhyNot />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g4",
      totalMoves: 5,
    });

    expect(saveGameForCurrentSession).not.toHaveBeenCalled();
    expect(deleteHvhGame).toHaveBeenCalledWith("g4");
  });

  it("renderiza AuthModal con las props del hook", () => {
    const handleLoginSuccess = vi.fn();
    const closeAuthModal = vi.fn();

    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      authModalOpen: true,
      handleLoginSuccess,
      closeAuthModal,
    } as any);

    render(<GameWhyNot />);

    expect(authModalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        onClose: closeAuthModal,
        onLoginSuccess: handleLoginSuccess,
      }),
    );
  });
});