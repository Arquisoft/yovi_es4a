import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import GameHoley from "../vistas/GameHoley";
import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
} from "../api/gamey";
import { hasPlayableCells } from "../game/variants";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

const sessionGamePageMock = vi.fn();
const registerFinishedGameMock = vi.fn();
const registerAbandonedGameMock = vi.fn();

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

vi.mock("../game/variants", () => ({
  hasPlayableCells: vi.fn(),
}));

vi.mock("../game/useLocalVariantGameSave", () => ({
  default: vi.fn(),
}));

vi.mock("../game/SessionGamePage", () => ({
  default: (props: any) => {
    sessionGamePageMock(props);
    return <div>SessionGamePage</div>;
  },
}));

describe("GameHoley", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

    vi.mocked(useLocalVariantGameSave).mockReturnValue({
      registerFinishedGame: registerFinishedGameMock,
      registerAbandonedGame: registerAbandonedGameMock,
    } as any);

    vi.mocked(createHvhGame).mockResolvedValue({
      game_id: "g1",
      yen: { size: 7, layout: "." },
      status: { state: "ongoing", next: "player0" },
    } as any);

    vi.mocked(hvhMove).mockResolvedValue({
      yen: { size: 7, layout: "." },
      status: { state: "ongoing", next: "player1" },
    } as any);

    vi.mocked(hasPlayableCells).mockReturnValue(true);
  });

  it("usa valores por defecto y muestra el aviso de agujeros", () => {
    render(<GameHoley />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "player0"]);
    expect(props.resultConfig.subtitle).toContain("Tamaño: 7");
    expect(screen.getByText(/agujero\(s\) en el tablero/)).toBeInTheDocument();
  });

  it("normaliza parámetros inválidos", () => {
    mockSearchParams = new URLSearchParams("size=-4&hvhstarter=inventado");

    render(<GameHoley />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "player0"]);
  });

  it("start regenera agujeros, guarda config y crea partida", async () => {
    render(<GameHoley />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.start();

    expect(putConfig).toHaveBeenCalledWith({
      size: 7,
      hvb_starter: "human",
      bot_id: null,
      hvh_starter: "player0",
    });
    expect(createHvhGame).toHaveBeenCalledWith({
      size: 7,
      hvh_starter: "player0",
    });
  });

  it("move rechaza una casilla agujero", async () => {
    render(<GameHoley />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const blockedCell = [...props.disabledCells][0];

    await expect(props.move("g1", blockedCell)).rejects.toThrow(
      "Esa casilla es un agujero y no se puede usar.",
    );
    expect(hvhMove).not.toHaveBeenCalled();
  });

  it("convierte la partida en empate si no quedan casillas jugables", async () => {
    vi.mocked(hasPlayableCells).mockReturnValue(false);

    render(<GameHoley />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    const playableCell = Array.from({ length: (7 * 8) / 2 }, (_, index) => index)
      .find((cellId) => !props.disabledCells.has(cellId));

    expect(playableCell).toBeTypeOf("number");

    const result = await props.move("g1", playableCell as number);

    expect(result.status).toEqual({ state: "finished", winner: null });
  });

  it("delegates registerFinishedGame y registerAbandonedGame", async () => {
    render(<GameHoley />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({ gameId: "g7", winner: "player0", totalMoves: 9 });
    await props.onGameAbandoned({ gameId: "g8", totalMoves: 5 });

    expect(registerFinishedGameMock).toHaveBeenCalledWith("g7", "player0", 9);
    expect(registerAbandonedGameMock).toHaveBeenCalledWith("g8", 5);
  });

  it("configura el hook de guardado local con los datos de Holey", () => {
    render(<GameHoley />);

    expect(useLocalVariantGameSave).toHaveBeenCalledWith({
      boardSize: 7,
      mode: "holey_hvh",
      opponent: "Jugador local (Holey)",
      startedBy: "player0",
      deleteGame: deleteHvhGame,
    });
  });
});
