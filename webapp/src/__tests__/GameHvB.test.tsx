import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import GameHvB from "../vistas/game/GameHvB";
import {
    createHvbGame,
    deleteHvbGame,
    hvbBotMove,
    hvbHint,
    hvbHumanMove,
    putConfig,
} from "../api/gamey";
import { recordUserGame } from "../api/users";
import { getUserSession } from "../utils/session";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams],
  };
});

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          success: vi.fn(),
          error: vi.fn(),
        },
      }),
    },
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

vi.mock("../api/users", () => ({
  recordUserGame: vi.fn(),
}));

vi.mock("../utils/session", () => ({
  getUserSession: vi.fn(),
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

  it("normaliza starter=bot y respeta bot/size de la query", () => {
    mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=BoT");

    render(<GameHvB />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([9, "mcts_bot", "bot"]);
    expect(props.resultConfig.subtitle).toBe(
      "Tamaño: 9 · Bot: mcts_bot · Empieza: mcts_bot",
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

  it("registra partida ganada al terminar", async () => {
    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "human",
      totalMoves: 12,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g1",
      mode: "HvB",
      result: "won",
      boardSize: 7,
      totalMoves: 12,
      opponent: "random_bot",
      startedBy: "human",
    });
  });

  it("registra partida perdida si gana el bot", async () => {
    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: "bot",
      totalMoves: 8,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g2",
      mode: "HvB",
      result: "lost",
      boardSize: 7,
      totalMoves: 8,
      opponent: "random_bot",
      startedBy: "human",
    });
  });

  it("si no hay sesión no guarda al terminar, pero habilita guardar más tarde", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);

    render(<GameHvB />);
    let props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "human",
      totalMoves: 3,
    });

    expect(recordUserGame).not.toHaveBeenCalled();

    await waitFor(() => {
      const latestProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
      expect(latestProps.canOfferGuestSave).toBe(true);
      expect(typeof latestProps.onGuestSaveRequested).toBe("function");
    });
  });

  it("abre el AuthModal al pedir guardar una partida pendiente", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);

    render(<GameHvB />);
    let props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "human",
      totalMoves: 3,
    });

    await waitFor(() => {
      const latestProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
      expect(latestProps.canOfferGuestSave).toBe(true);
    });

    props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    props.onGuestSaveRequested({
      gameId: "g1",
      winner: "human",
      totalMoves: 3,
    });

    await waitFor(() => {
      const latestAuthProps = authModalMock.mock.calls.at(-1)?.[0];
      expect(latestAuthProps.open).toBe(true);
      expect(typeof latestAuthProps.onLoginSuccess).toBe("function");
    });
  });

  it("tras iniciar sesión desde el modal, guarda la partida pendiente", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);

    render(<GameHvB />);
    let props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g9",
      winner: "human",
      totalMoves: 10,
    });

    await waitFor(() => {
      const latestProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
      expect(latestProps.canOfferGuestSave).toBe(true);
    });

    props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    props.onGuestSaveRequested({
      gameId: "g9",
      winner: "human",
      totalMoves: 10,
    });

    await waitFor(() => {
      const latestAuthProps = authModalMock.mock.calls.at(-1)?.[0];
      expect(latestAuthProps.open).toBe(true);
    });

    vi.mocked(getUserSession).mockReturnValue({
      username: "marcelo",
      profilePicture: "avatar.png",
    } as any);

    const authProps = authModalMock.mock.calls.at(-1)?.[0];
    await authProps.onLoginSuccess();

    await waitFor(() => {
      expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
        gameId: "g9",
        mode: "HvB",
        result: "won",
        boardSize: 7,
        totalMoves: 10,
        opponent: "random_bot",
        startedBy: "human",
      });
    });
  });

  it("no registra partida terminada si winner es null", async () => {
    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "g2",
      winner: null,
      totalMoves: 3,
    });

    expect(recordUserGame).not.toHaveBeenCalled();
  });

  it("evita registrar dos veces la misma partida terminada", async () => {
    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({
      gameId: "same-id",
      winner: "human",
      totalMoves: 5,
    });
    await props.onGameFinished({
      gameId: "same-id",
      winner: "human",
      totalMoves: 5,
    });

    expect(recordUserGame).toHaveBeenCalledTimes(1);
  });

  it("registra abandono y borra la partida", async () => {
    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g3",
      totalMoves: 9,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g3",
      mode: "HvB",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 9,
      opponent: "random_bot",
      startedBy: "human",
    });
    expect(deleteHvbGame).toHaveBeenCalledWith("g3");
  });

  it("si no hay sesión en abandono, igualmente borra la partida", async () => {
    vi.mocked(getUserSession).mockReturnValue(null as any);

    render(<GameHvB />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameAbandoned({
      gameId: "g4",
      totalMoves: 2,
    });

    expect(recordUserGame).not.toHaveBeenCalled();
    expect(deleteHvbGame).toHaveBeenCalledWith("g4");
  });
});