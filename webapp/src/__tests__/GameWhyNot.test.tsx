import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

import GameWhyNot from "../vistas/game/GameWhyNot";

const localVariantPageMock = vi.fn();

vi.mock("../game/LocalHvHVariantPage", () => ({
  default: (props: any) => {
    localVariantPageMock(props);
    return <div>LocalHvHVariantPage</div>;
  },
}));

describe("GameWhyNot", () => {
  it("delega en LocalHvHVariantPage con mapWinner invertido", () => {
    render(<GameWhyNot />);

    const props = localVariantPageMock.mock.calls.at(-1)?.[0];
    expect(props.title).toBe("Juego Y - WhY Not");
    expect(props.mode).toBe("why_not_hvh");
    expect(props.opponent).toBe("Jugador local (WhY Not)");
    expect(props.mapWinner("player0")).toBe("player1");
    expect(props.mapWinner("player1")).toBe("player0");
    expect(props.mapWinner(null)).toBeNull();
  });
});
