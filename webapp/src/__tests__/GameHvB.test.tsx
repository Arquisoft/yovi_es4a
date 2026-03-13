import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

import GameHvB from "../vistas/GameHvB";
import { createHvbGame, hvbBotMove, hvbHumanMove, putConfig } from "../api/gamey";

const sessionGamePageMock = vi.fn();

let mockSearchParams = new URLSearchParams("size=7&bot=random_bot");

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useSearchParams: () => [mockSearchParams],
    };
});

vi.mock("../api/gamey", () => ({
    createHvbGame: vi.fn(),
    hvbHumanMove: vi.fn(),
    hvbBotMove: vi.fn(),
    putConfig: vi.fn(),
}));

vi.mock("../game/SessionGamePage", () => ({
    default: (props: any) => {
        sessionGamePageMock(props);
        return <div>SessionGamePage</div>;
    },
}));

describe("GameHvB", () => {
    beforeEach(() => {
        sessionGamePageMock.mockReset();
        vi.mocked(createHvbGame).mockReset();
        vi.mocked(hvbHumanMove).mockReset();
        vi.mocked(hvbBotMove).mockReset();
        vi.mocked(putConfig).mockReset();

        mockSearchParams = new URLSearchParams("size=7&bot=random_bot");
    });

    it("usa valores por defecto si faltan params", () => {
        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];

        expect(props.deps).toEqual([7, "random_bot", "human"]);
        expect(props.resultConfig.title).toBe("Juego Y — Human vs Bot");
        expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Bot: random_bot · Empieza: Humano");
        expect(props.resultConfig.abandonOkText).toBe("Sí, abandonar");
        expect(props.winnerPalette).toEqual({
            highlightedWinner: "human",
            highlightedBackground: "#28bbf532",
            otherWinnerBackground: "#ff7b0033",
        });

        expect(props.turnConfig).toEqual({
            textPrefix: "Turno actual:",
            turns: {
                human: {
                    label: "Humano",
                    color: "#28BBF5",
                },
                bot: {
                    label: "random_bot",
                    color: "#FF7B00",
                },
            },
        });

        expect(typeof props.botMove).toBe("function");
    });

    it("normaliza starter=bot y respeta bot/size de la query", () => {
        mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=BoT");

        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];
        expect(props.deps).toEqual([9, "mcts_bot", "bot"]);
        expect(props.resultConfig.subtitle).toBe("Tamaño: 9 · Bot: mcts_bot · Empieza: mcts_bot");
        expect(props.turnConfig.turns.bot.label).toBe("mcts_bot");
    });

    it("hace fallback a size=7 y starter=human si la query es inválida", () => {
        mockSearchParams = new URLSearchParams("size=1&bot=smart_bot&hvbstarter=alien");

        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];
        expect(props.deps).toEqual([7, "smart_bot", "human"]);
        expect(props.resultConfig.subtitle).toBe("Tamaño: 7 · Bot: smart_bot · Empieza: Humano");
    });

    it("start guarda config y crea la partida HvB", async () => {
        vi.mocked(putConfig).mockResolvedValue({
            size: 9,
            hvb_starter: "bot",
            hvh_starter: "player0",
            bot_id: "mcts_bot",
        } as any);

        vi.mocked(createHvbGame).mockResolvedValue({
            game_id: "g1",
            mode: "hvb",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "bot" },
        });

        mockSearchParams = new URLSearchParams("size=9&bot=mcts_bot&hvbstarter=bot");

        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];
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

        expect(result).toEqual({
            game_id: "g1",
            mode: "hvb",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "bot" },
        });
    });

    it("move delega en hvbHumanMove", async () => {
        vi.mocked(hvbHumanMove).mockResolvedValue({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 3, coords: { x: 1, y: 2, z: 3 } },
            status: { state: "ongoing", next: "bot" },
        });

        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];
        await props.move("g1", 3);

        expect(hvbHumanMove).toHaveBeenCalledWith("g1", 3);
    });

    it("botMove delega en hvbBotMove", async () => {
        vi.mocked(hvbBotMove).mockResolvedValue({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            bot_move: { cell_id: 4, coords: { x: 1, y: 1, z: 2 } },
            status: { state: "ongoing", next: "human" },
        });

        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];
        await props.botMove("g1");

        expect(hvbBotMove).toHaveBeenCalledWith("g1");
    });

    it("genera textos de resultado correctos", () => {
        render(<GameHvB />);

        const props = sessionGamePageMock.mock.calls[0][0];

        expect(props.resultConfig.getResultTitle("human")).toBe("¡Felicidades!");
        expect(props.resultConfig.getResultTitle("bot")).toBe("Game Over");

        expect(props.resultConfig.getResultText("human")).toBe("Has ganado la partida.");
        expect(props.resultConfig.getResultText("bot")).toBe("Ha ganado random_bot. ¡Inténtalo de nuevo!");
    });
});