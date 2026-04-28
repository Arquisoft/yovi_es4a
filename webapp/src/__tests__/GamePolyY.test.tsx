import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import GamePolyY from "../vistas/game/GamePolyY";
import { createHvhGame, hvhMove, putConfig } from "../api/gamey";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

const sessionGamePageMock = vi.fn();
let mockSearchParams = new URLSearchParams("size=5&hvhstarter=player1");

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

vi.mock("../game/useLocalVariantGameSave", () => ({
  default: vi.fn(() => ({
    registerFinishedGame: vi.fn(),
    registerAbandonedGame: vi.fn(),
  })),
}));

vi.mock("../game/SessionGamePage", () => ({
  default: (props: any) => {
    sessionGamePageMock(props);
    return <div>SessionGamePage</div>;
  },
}));

describe("GamePolyY", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=5&hvhstarter=player1");
  });

  it("renderiza SessionGamePage con config de Poly-Y", () => {
    render(<GamePolyY />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(props.resultConfig.title).toContain("Poly-Y");
    expect(props.deps).toEqual([5, "player1"]);
  });

  it("start resetea esquinas y llama a apis", async () => {
    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvhGame).mockResolvedValue({ game_id: "gp" } as any);

    render(<GamePolyY />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    await props.start();

    expect(putConfig).toHaveBeenCalledWith(expect.objectContaining({ size: 5, hvh_starter: "player1" }));
  });

  it("move actualiza esquinas basándose en el YEN", async () => {
    vi.mocked(hvhMove).mockResolvedValue({
      yen: {
        size: 3,
        layout: "B/RR/...", // B en (0,0) es player0
      }
    } as any);

    render(<GamePolyY />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    
    await act(async () => {
      await props.move("gp", 0);
    });

    // Verificamos que el prefijo de turno se haya actualizado en el re-render del mock
    const updatedProps = sessionGamePageMock.mock.calls.at(-1)?.[0];
    expect(updatedProps.turnConfig.textPrefix).toContain("P0:1 P1:0");
  });

  it("onGameFinished llama a registerFinishedGame", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useLocalVariantGameSave).mockReturnValue({
      registerFinishedGame,
      registerAbandonedGame: vi.fn(),
    } as any);

    render(<GamePolyY />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    await props.onGameFinished({ gameId: "gp", winner: "player0", totalMoves: 5 });

    expect(registerFinishedGame).toHaveBeenCalledWith("gp", "player0", 5);
  });
});
