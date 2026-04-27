import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GameFortuneCoin from "../vistas/game/GameFortuneCoin";
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

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");
  return {
    ...actual,
    Typography: {
      Text: ({ children }: any) => <span>{children}</span>,
    },
    message: {
      info: vi.fn(),
    },
  };
});

describe("GameFortuneCoin", () => {
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

  it("usa la moneda para decidir turno inicial y siguiente", async () => {
    const randomSpy = vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8);
    const { message } = await import("antd");

    render(<GameFortuneCoin />);
    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];

    const startResult = await props.start();
    expect(putConfig).toHaveBeenCalledWith(expect.objectContaining({
      hvh_starter: "player0",
    }));
    expect(startResult.status).toEqual({ state: "ongoing", next: "player0" });
    expect(message.info).toHaveBeenCalledWith(
      expect.stringContaining("empieza Player 0"),
    );

    const moveResult = await props.move("g1", 5);
    expect(hvhMove).toHaveBeenCalledWith("g1", 5, undefined, 1);
    expect(moveResult.status).toEqual({ state: "ongoing", next: "player1" });
    expect(message.info).toHaveBeenCalledWith(
      expect.stringContaining("siguiente turno para Player 1"),
    );

    randomSpy.mockRestore();
  });
});
