import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import GameHvH from "../vistas/GameHvH";
import { createHvhGame, hvhMove, putConfig } from "../api/gamey";

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
    hvhMove: vi.fn(),
    putConfig: vi.fn(),
}));

vi.mock("../game/SessionGamePage", () => ({
    default: (props: any) => {
        sessionGamePageMock(props);
        return <div>SessionGamePage</div>;
    },
}));

describe("GameHvH", () => {
    beforeEach(() => {
        sessionGamePageMock.mockReset();
        vi.mocked(createHvhGame).mockReset();
        vi.mocked(hvhMove).mockReset();
        vi.mocked(putConfig).mockReset();

        mockSearchParams = new URLSearchParams("size=7&hvhstarter=player0");
    });

    it("usa valores por defecto si faltan params", () => {
        render(<GameHvH />);

        const props = sessionGamePageMock.mock.calls[0][0];

        expect(props.deps).toEqual([7, "player0"]);
        expect(props.resultConfig.title).toBe("Juego Y — Human vs Human");
        expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Empieza: player0");
        expect(props.resultConfig.abandonOkText).toBe("Abandonar");
        expect(props.winnerPalette).toEqual({
            highlightedWinner: "player0",
            highlightedBackground: "#28bbf532",
            otherWinnerBackground: "#ff7b0033",
        });
    });

    it("normaliza starter=player1", () => {
        mockSearchParams = new URLSearchParams("size=9&hvhstarter=PLAYER1");

        render(<GameHvH />);

        const props = sessionGamePageMock.mock.calls[0][0];
        expect(props.deps).toEqual([9, "player1"]);
        expect(props.resultConfig.subtitle).toBe("Tamaño: 9 · Empieza: player1");
    });

    it("hace fallback a size=7 y starter=player0", () => {
        mockSearchParams = new URLSearchParams("size=1&hvhstarter=alien");

        render(<GameHvH />);

        const props = sessionGamePageMock.mock.calls[0][0];
        expect(props.deps).toEqual([7, "player0"]);
        expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Empieza: player0");
    });

    it("start guarda config y crea la partida HvH", async () => {
        vi.mocked(putConfig).mockResolvedValue({
            size: 9,
            hvb_starter: "human",
            hvh_starter: "player1",
            bot_id: null,
        } as any);

        vi.mocked(createHvhGame).mockResolvedValue({
            game_id: "g2",
            mode: "hvh",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "player1" },
        });

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

        expect(result).toEqual({
            game_id: "g2",
            mode: "hvh",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "player1" },
        });
    });

    it("move delega en hvhMove", async () => {
        vi.mocked(hvhMove).mockResolvedValue({
            game_id: "g2",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 2, coords: { x: 1, y: 1, z: 2 } },
            status: { state: "ongoing", next: "player1" },
        });

        render(<GameHvH />);

        const props = sessionGamePageMock.mock.calls[0][0];
        await props.move("g2", 2);

        expect(hvhMove).toHaveBeenCalledWith("g2", 2);
    });

    it("genera textos de resultado correctos", () => {
        render(<GameHvH />);

        const props = sessionGamePageMock.mock.calls[0][0];

        expect(props.resultConfig.getResultTitle("player0")).toBe("Partida finalizada");
        expect(props.resultConfig.getResultTitle("player1")).toBe("Partida finalizada");

        expect(props.resultConfig.getResultText("player0")).toBe("Player 0 ha ganado la partida.");
        expect(props.resultConfig.getResultText("player1")).toBe("Player 1 ha ganado la partida.");
    });
});