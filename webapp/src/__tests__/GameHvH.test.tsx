import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import GameHvH from "../vistas/game/GameHvH";
import { createHvhGame, deleteHvhGame, hvhMove, putConfig } from "../api/gamey";
import { recordUserGame } from "../api/users";
import { getUserSession } from "../utils/session";

const sessionGamePageMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

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

describe("GameHvH", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");
    vi.mocked(getUserSession).mockReturnValue({
      username: "marcelo",
      profilePicture: "avatar.png",
    } as any);
  });

  it("usa valores por defecto si faltan params", () => {
    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls[0][0];

    expect(props.deps).toEqual([7, "player0"]);    
    expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Empieza: Player 0");
  });

  it("normaliza starter random", () => {
    mockSearchParams = new URLSearchParams("size=8&hvhstarter=RaNdOm");

    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls[0][0];
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

    const props = sessionGamePageMock.mock.calls[0][0];
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
    const props = sessionGamePageMock.mock.calls[0][0];

    await props.move("g2", 2);

    expect(hvhMove).toHaveBeenCalledWith("g2", 2);
  });

  it("registra partida ganada cuando vence player0", async () => {
    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "player0",
      totalMoves: 11,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g1",
      mode: "HvH",
      result: "won",
      boardSize: 7,
      totalMoves: 11,
      opponent: "Jugador local",
      startedBy: "player0",
    });
  });

  it("registra partida perdida cuando vence player1", async () => {
    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameFinished({
      gameId: "g2",
      winner: "player1",
      totalMoves: 6,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g2",
      mode: "HvH",
      result: "lost",
      boardSize: 7,
      totalMoves: 6,
      opponent: "Jugador local",
      startedBy: "player0",
    });
  });

  it("no registra partida terminada si no hay sesión o winner", async () => {
    vi.mocked(getUserSession).mockReturnValueOnce(null as any);

    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameFinished({
      gameId: "g1",
      winner: "player0",
      totalMoves: 3,
    });
    await props.onGameFinished({
      gameId: "g2",
      winner: null,
      totalMoves: 3,
    });

    expect(recordUserGame).not.toHaveBeenCalled();
  });

  it("evita registrar dos veces la misma partida", async () => {
    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameFinished({
      gameId: "same-id",
      winner: "player0",
      totalMoves: 5,
    });
    await props.onGameFinished({
      gameId: "same-id",
      winner: "player0",
      totalMoves: 5,
    });

    expect(recordUserGame).toHaveBeenCalledTimes(1);
  });

  it("registra abandono y borra la partida", async () => {
    render(<GameHvH />);

    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameAbandoned({
      gameId: "g3",
      totalMoves: 8,
    });

    expect(recordUserGame).toHaveBeenCalledWith("marcelo", {
      gameId: "g3",
      mode: "HvH",
      result: "abandoned",
      boardSize: 7,
      totalMoves: 8,
      opponent: "Jugador local",
      startedBy: "player0",
    });
    expect(deleteHvhGame).toHaveBeenCalledWith("g3");
  });

  it("si no hay sesión en abandono, igualmente borra la partida", async () => {
    vi.mocked(getUserSession).mockReturnValueOnce(null as any);

    render(<GameHvH />);
    const props = sessionGamePageMock.mock.calls[0][0];

    await props.onGameAbandoned({
      gameId: "g4",
      totalMoves: 1,
    });

    expect(recordUserGame).not.toHaveBeenCalled();
    expect(deleteHvhGame).toHaveBeenCalledWith("g4");
  });
});
