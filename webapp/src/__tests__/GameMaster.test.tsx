import "@testing-library/jest-dom";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GameMaster from "../vistas/GameMaster";
import { createHvhGame, deleteHvhGame, hvhMove, putConfig } from "../api/gamey";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

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

vi.mock("../game/useLocalVariantGameSave", () => ({
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

describe("GameMaster", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");

    vi.mocked(useLocalVariantGameSave).mockReturnValue({
      authModalOpen: false,
      savingPendingGame: false,
      canOfferGuestSave: true,
      registerFinishedGame: vi.fn(),
      registerAbandonedGame: vi.fn(),
      handleGuestSaveRequested: vi.fn(),
      handleLoginSuccess: vi.fn(),
      closeAuthModal: vi.fn(),
    } as any);

    vi.mocked(putConfig).mockResolvedValue({} as any);
    vi.mocked(createHvhGame).mockResolvedValue({
      game_id: "g1",
      yen: { size: 7, layout: "." },
      status: { state: "ongoing", next: "player0" },
    } as any);
    vi.mocked(hvhMove).mockResolvedValue({
      yen: { size: 7, layout: "next" },
      status: { state: "ongoing", next: "player1" },
    } as any);
    vi.mocked(deleteHvhGame).mockResolvedValue({ deleted: true } as any);
  });

  it("mantiene el turno en la primera pieza y lo cambia en la segunda", async () => {
    render(<GameMaster />);
    let props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    await act(async () => {
      await props.start();
    });

    expect(putConfig).toHaveBeenCalledWith(expect.objectContaining({
      size: 7,
      hvh_starter: "player0",
    }));

    let firstMove: any;
    await act(async () => {
      firstMove = await props.move("g1", 1);
    });

    expect(hvhMove).toHaveBeenCalledWith("g1", 1, undefined, 0);
    expect(firstMove.status).toEqual({ state: "ongoing", next: "player0" });

    props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    let secondMove: any;
    await act(async () => {
      secondMove = await props.move("g1", 2);
    });

    expect(hvhMove).toHaveBeenLastCalledWith("g1", 2, undefined, undefined);
    expect(secondMove.status).toEqual({ state: "ongoing", next: "player1" });
  });
});
