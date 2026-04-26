import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";

import GameTabu from "../vistas/game/GameTabu";
import {
  createHvhGame,
  deleteHvhGame,
  hvhMove,
  putConfig,
} from "../api/gamey";
import { hasPlayableCells } from "../game/variants";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();
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

vi.mock("../game/variants", async () => {
  const actual = await vi.importActual<any>("../game/variants");
  return {
    ...actual,
    hasPlayableCells: vi.fn(),
  };
});

vi.mock("../game/useLocalVariantGameSave", () => ({
  default: vi.fn(),
}));

vi.mock("../game/LocalHvHSessionLayout", () => ({
  default: (props: any) => {
    const save = (useLocalVariantGameSave as any)({
      boardSize: props.boardSize,
      mode: props.mode,
      opponent: props.opponent,
      startedBy: props.startedBy,
      deleteGame: deleteHvhGame,
    });

    sessionGamePageMock({
      ...props,
      onGameFinished: async ({ gameId, winner, totalMoves }: any) => {
        await save.registerFinishedGame(gameId, winner, totalMoves);
      },
      onGameAbandoned: async ({ gameId, totalMoves }: any) => {
        await save.registerAbandonedGame(gameId, totalMoves);
      },
      canOfferGuestSave: save.canOfferGuestSave,
      onGuestSaveRequested: save.handleGuestSaveRequested,
      guestSaveLoading: save.savingPendingGame,
    });

    authModalMock({
      open: save.authModalOpen,
      onClose: save.closeAuthModal,
      onLoginSuccess: save.handleLoginSuccess,
    });

    return <div>LocalHvHSessionLayout</div>;
  },
}));

describe("GameTabu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

    vi.mocked(useLocalVariantGameSave).mockReturnValue({
      authModalOpen: false,
      savingPendingGame: false,
      canOfferGuestSave: true,
      registerFinishedGame: registerFinishedGameMock,
      registerAbandonedGame: registerAbandonedGameMock,
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
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

  it("usa valores por defecto y expone el contador de casillas prohibidas", () => {
    render(<GameTabu />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "player0"]);
    expect(props.turnConfig.textPrefix).toContain("casilla(s) prohibida(s)");
  });

  it("normaliza parametros invalidos", () => {
    mockSearchParams = new URLSearchParams("size=1&hvhstarter=otra-cosa");

    render(<GameTabu />);

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.deps).toEqual([7, "player0"]);
  });

  it("start reinicia estado, guarda config y crea partida", async () => {
    render(<GameTabu />);
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

  it("move actualiza celdas tabu mientras la partida sigue", async () => {
    render(<GameTabu />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await act(async () => {
      await props.move("g1", 3);
    });

    expect(hvhMove).toHaveBeenCalledWith("g1", 3);
    await waitFor(() => {
      const updatedProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
      expect(updatedProps.disabledCells.size).toBeGreaterThan(0);
    });
  });

  it("move fuerza empate si no quedan movimientos validos", async () => {
    vi.mocked(hasPlayableCells).mockReturnValue(false);

    render(<GameTabu />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    const result = await props.move("g1", 3);

    expect(result.status).toEqual({ state: "finished", winner: null });
  });

  it("limpia celdas tabu cuando el backend devuelve partida terminada", async () => {
    vi.mocked(hvhMove).mockResolvedValue({
      yen: { size: 7, layout: "." },
      status: { state: "finished", winner: "player0" },
    } as any);

    render(<GameTabu />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await act(async () => {
      await props.move("g1", 3);
    });

    await waitFor(() => {
      const updatedProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
      expect(updatedProps.disabledCells).toEqual(new Set());
    });
  });

  it("delegates registerFinishedGame y registerAbandonedGame", async () => {
    render(<GameTabu />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await props.onGameFinished({ gameId: "g7", winner: "player1", totalMoves: 9 });
    await props.onGameAbandoned({ gameId: "g8", totalMoves: 5 });

    expect(registerFinishedGameMock).toHaveBeenCalledWith("g7", "player1", 9);
    expect(registerAbandonedGameMock).toHaveBeenCalledWith("g8", 5);
  });

  it("configura el hook de guardado local con los datos de Tabu", () => {
    render(<GameTabu />);

    expect(useLocalVariantGameSave).toHaveBeenCalledWith({
      boardSize: 7,
      mode: "tabu_hvh",
      opponent: "Jugador local (Tabu)",
      startedBy: "player0",
      deleteGame: deleteHvhGame,
    });
  });
});
