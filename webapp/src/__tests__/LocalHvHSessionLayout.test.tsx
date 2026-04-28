import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import LocalHvHSessionLayout from "../game/LocalHvHSessionLayout";
import useLocalVariantGameSave from "../game/useLocalVariantGameSave";

const sessionGamePageMock = vi.fn();
const authModalMock = vi.fn();

vi.mock("../game/useLocalVariantGameSave", () => ({
  default: vi.fn(() => ({
    authModalOpen: false,
    savingPendingGame: false,
    canOfferGuestSave: true,
    registerFinishedGame: vi.fn(),
    registerAbandonedGame: vi.fn(),
    handleGuestSaveRequested: vi.fn(),
    handleLoginSuccess: vi.fn(),
    closeAuthModal: vi.fn(),
  })),
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

describe("LocalHvHSessionLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza SessionGamePage y AuthModal", () => {
    render(
      <LocalHvHSessionLayout
        boardSize={7}
        mode="classic_hvh"
        opponent="Opponent"
        startedBy="player0"
        deps={[]}
        start={vi.fn()}
        move={vi.fn()}
        resultConfig={{} as any}
        winnerPalette={{} as any}
        turnConfig={{} as any}
      />
    );

    expect(sessionGamePageMock).toHaveBeenCalled();
    expect(authModalMock).toHaveBeenCalled();
  });

  it("llama a registerFinishedGame al terminar la partida", async () => {
    const registerFinishedGame = vi.fn();
    vi.mocked(useLocalVariantGameSave).mockReturnValue({
      registerFinishedGame,
    } as any);

    render(
      <LocalHvHSessionLayout
        boardSize={7}
        mode="classic_hvh"
        opponent="Opponent"
        startedBy="player0"
        deps={[]}
        start={vi.fn()}
        move={vi.fn()}
        resultConfig={{} as any}
        winnerPalette={{} as any}
        turnConfig={{} as any}
      />
    );

    const props = sessionGamePageMock.mock.calls.at(-1)?.[0];
    await props.onGameFinished({ gameId: "g1", winner: "player0", totalMoves: 5 });

    expect(registerFinishedGame).toHaveBeenCalledWith("g1", "player0", 5);
  });
});
