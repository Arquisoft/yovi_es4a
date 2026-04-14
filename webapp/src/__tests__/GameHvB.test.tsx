import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import GameHvB from "../vistas/game/GameHvB";
import {
    createHvbGame,
    deleteHvbGame,
    hvbBotMove,
    hvbHint,
    hvbHumanMove,
    putConfig,
} from "../api/gamey";
import { getUserSession } from "../utils/session";
import useDeferredGameSave from "../game/useDeferredGameSave";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

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
  createHvbGame: vi.fn(),
  deleteHvbGame: vi.fn(),
  hvbHumanMove: vi.fn(),
  hvbBotMove: vi.fn(),
  hvbHint: vi.fn(),
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

describe("GameHvB", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&bot=random_bot");
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
    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "random_bot", "human"]);
    expect(props.resultConfig.subtitle).toBe(
      "Tamaño: 7 · Bot: random_bot · Empieza: Humano",
    );
    expect(props.canOfferGuestSave).toBe(false);
  });

  it("pasa shouldCountMove para contar solo jugadas humanas", () => {
    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    expect(props.shouldCountMove("human")).toBe(true);
    expect(props.shouldCountMove("bot")).toBe(false);
    expect(props.shouldCountMove(null)).toBe(false);
  });

  it("normaliza starter=bot y respeta bot/size de la query", () => {
    mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=BoT");

    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([9, "mcts_bot", "bot"]);
    expect(props.resultConfig.subtitle).toBe(
      "Tamaño: 9 · Bot: mcts_bot · Empieza: mcts_bot",
    );
  });

  it("normaliza starter=random", () => {
    mockSearchParams = new URLSearchParams("size=8&bot=random_bot&hvbstarter=RaNdOm");

    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([8, "random_bot", "random"]);
    expect(props.resultConfig.subtitle).toBe(
      "Tamaño: 8 · Bot: random_bot · Empieza: Aleatorio",
    );
  });

  it("start guarda config y crea la partida", async () => {
    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvbGame).mockResolvedValue({
      game_id: "g1",
      mode: "hvb",
      yen: { size: 9, layout: "." },
      status: { state: "ongoing", next: "bot" },
    } as any);

    mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=bot");
    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const result = await props.start();

    expect(putConfig).toHaveBeenCalledWith({
      size: 9,
      hvb_starter: "bot",
      bot_id: "mcts_bot",
      hvh_starter: "player0",
    });
    expect(createHvbGame).toHaveBeenCalledWith({
      size: 9,
      bot_id: "mcts_bot",
      hvb_starter: "bot",
    });
    expect(result.game_id).toBe("g1");
  });

  it("move, botMove y onHint delegan en la API", async () => {
    vi.mocked(hvbHumanMove).mockResolvedValue({} as any);
    vi.mocked(hvbBotMove).mockResolvedValue({} as any);
    vi.mocked(hvbHint).mockResolvedValue({ hint_cell_id: 42 } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.move("g1", 3);
    await props.botMove("g1");
    const hint = await props.onHint("g1");

    expect(hvbHumanMove).toHaveBeenCalledWith("g1", 3);
    expect(hvbBotMove).toHaveBeenCalledWith("g1");
    expect(hvbHint).toHaveBeenCalledWith("g1");
    expect(hint).toBe(42);
  });

  it("al terminar delega en registerFinishedGame con classic_hvb", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "human",
      totalMoves: 12,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g1",
      mode: "classic_hvb",
      result: "won",
      boardSize: 7,
      totalMoves: 12,
      opponent: "random_bot",
      startedBy: "human",
    });
  });

  it("registra partida perdida si gana el bot", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: "bot",
      totalMoves: 8,
    });

    expect(registerFinishedGame).toHaveBeenCalledWith({
      gameId: "g2",
      mode: "classic_hvb",
      result: "lost",
      boardSize: 7,
      totalMoves: 8,
      opponent: "random_bot",
      startedBy: "human",
    });
  });

  it("no registra partida terminada si winner es null", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      registerFinishedGame,
    } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: null,
      totalMoves: 3,
    });

    expect(registerFinishedGame).not.toHaveBeenCalled();
  });

  it("en abandono guarda la partida y luego la borra si hay sesión", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g3",
      totalMoves: 9,
    });

    expect(saveGameForCurrentSession).toHaveBeenCalledWith({
      gameId: "g3",
      mode: "classic_hvb",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 9,
      opponent: "random_bot",
      startedBy: "human",
    });
    expect(deleteHvbGame).toHaveBeenCalledWith("g3");
  });

  it("si no hay sesión en abandono, igualmente borra la partida", async () => {
    const saveGameForCurrentSession = vi.fn();
    vi.mocked(getUserSession).mockReturnValue(null as any);
    vi.mocked(useDeferredGameSave).mockReturnValue({
      ...deferredGameSaveState,
      saveGameForCurrentSession,
    } as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g4",
      totalMoves: 2,
    });

    expect(saveGameForCurrentSession).not.toHaveBeenCalled();
    expect(deleteHvbGame).toHaveBeenCalledWith("g4");
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

    render(<GameHvB />);

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