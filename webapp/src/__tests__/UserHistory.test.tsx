import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserHistory from "../vistas/UserHistory";

const getUserHistoryMock = vi.fn();
const getUserSessionMock = vi.fn();

vi.mock("../api/users", () => ({
    getUserHistory: (...args: any[]) => getUserHistoryMock(...args),
    getHistoryOpponentLabel: (game: any) => game.opponent || "Jugador local",
    getHistoryStartedByLabel: (game: any) => {
        if (!game.startedBy) return null;
        if (game.startedBy === "human") return "Humano";
        if (game.startedBy === "player0") return "Player 0";
        if (game.startedBy === "player1") return "Player 1";
        if (game.startedBy === "random") return "Aleatorio";
        return game.startedBy;
    },
    getGameModeShortLabel: (mode: string) => ({
        classic_hvb: "Clasico HvB",
        classic_hvh: "Clasico HvH",
        tabu_hvh: "Tabu HvH",
    }[mode] ?? mode),
    getGameModeLongLabel: (mode: string) => ({
        classic_hvb: "Clasico - Humano vs Bot",
        classic_hvh: "Clasico - Humano vs Humano",
        tabu_hvh: "Tabu - Humano vs Humano",
    }[mode] ?? mode),
    getGameModeTagColor: () => "blue",
    HISTORY_MODE_FILTER_OPTIONS: [
        { value: "all", label: "Todos los modos" },
        { value: "classic_hvb", label: "ClÃ¡sico HvB" },
        { value: "classic_hvh", label: "ClÃ¡sico HvH" },
        { value: "tabu_hvh", label: "TabÃº HvH" },
    ],
}));

vi.mock("../utils/session", () => ({
    getUserSession: (...args: any[]) => getUserSessionMock(...args),
}));

vi.mock("../utils/avatar", () => ({
    resolveAvatarSrc: (value: string) => value,
}));

vi.mock("../vistas/AppHeader", () => ({
    default: ({ title }: any) => <div>{title}</div>,
}));

vi.mock("../vistas/UserStats", () => ({
    default: ({ title, stats }: any) => (
        <div data-testid="user-stats-summary">
            <div>{title}</div>
            <div>{`W:${stats.gamesWon}`}</div>
            <div>{`L:${stats.gamesLost}`}</div>
            <div>{`D:${stats.gamesDrawn}`}</div>
            <div>{`A:${stats.gamesAbandoned}`}</div>
        </div>
    ),
}));

vi.mock("antd", () => {
    const ListComponent = ({ dataSource, renderItem }: any) => (
        <div data-testid="history-list">
            {dataSource.map((item: any, i: number) => (
                <div key={item.gameId ?? i}>{renderItem(item)}</div>
            ))}
        </div>
    );

    ListComponent.Item = ({ children }: any) => (
        <div data-testid="history-list-item">{children}</div>
    );

    const Descriptions = ({ children }: any) => (
        <div data-testid="descriptions">{children}</div>
    );

    Descriptions.Item = ({ label, children }: any) => (
        <div>{`${label}: ${children}`}</div>
    );

    return {
        Alert: ({ message, description }: any) => (
            <div>
                <div>{message}</div>
                <div>{description}</div>
            </div>
        ),
        Avatar: ({ children }: any) => <div>{children}</div>,
        Card: ({ children }: any) => <div>{children}</div>,
        Collapse: ({ items }: any) => (
            <div>
                {items.map((item: any) => (
                    <div key={item.key}>
                        <div>{item.label}</div>
                        <div>{item.children}</div>
                    </div>
                ))}
            </div>
        ),
        Descriptions,
        Empty: ({ description }: any) => <div>{description}</div>,
        Flex: ({ children }: any) => <div>{children}</div>,
        List: ListComponent,
        Pagination: ({ current, total, pageSize, onChange }: any) => (
            <div>
                <div>{`pagination:${current}/${total}/${pageSize}`}</div>
                <button type="button" onClick={() => onChange(current + 1)}>
                    next-page
                </button>
            </div>
        ),
        Select: ({ value, onChange, options }: any) => (
            <select
                role="combobox"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((option: any) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        ),
        Space: ({ children }: any) => <div>{children}</div>,
        Spin: () => <div>Cargando...</div>,
        Tag: ({ children }: any) => <span>{children}</span>,
        Typography: {
            Title: ({ children }: any) => <div>{children}</div>,
            Text: ({ children }: any) => <div>{children}</div>,
        },
    };
});

vi.mock("@ant-design/icons", () => ({
    CheckCircleOutlined: () => null,
    CloseCircleOutlined: () => null,
    StopOutlined: () => null,
    UserOutlined: () => null,
    MinusCircleOutlined: () => null,
}));

function buildHistoryResponse(overrides: any = {}) {
    return {
        username: "marcelo",
        profilePicture: "avatar.png",
        stats: {
            gamesPlayed: 3,
            gamesWon: 1,
            gamesLost: 1,
            gamesDrawn: 1,
            gamesAbandoned: 1,
            totalMoves: 20,
            currentWinStreak: 0,
            winRate: 33,
        },
        pagination: {
            page: 1,
            pageSize: 5,
            totalGames: 3,
            totalPages: 1,
        },
        games: [
            {
                gameId: "g1",
                mode: "classic_hvb",
                result: "won",
                boardSize: 7,
                totalMoves: 10,
                opponent: "random_bot",
                startedBy: "human",
                finishedAt: "2026-03-21T12:00:00.000Z",
            },
            {
                gameId: "g2",
                mode: "classic_hvh",
                result: "abandoned",
                boardSize: 9,
                totalMoves: 5,
                opponent: "Jugador local",
                startedBy: "player0",
                finishedAt: "2026-03-21T13:00:00.000Z",
            },
        ],
        ...overrides,
    };
}

describe("UserHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });
    });

    it("carga el historial y muestra stats y partidas", async () => {
        getUserHistoryMock.mockResolvedValueOnce(buildHistoryResponse());

        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        expect(await screen.findByText("marcelo")).toBeInTheDocument();
        expect(screen.getByText("3 partidas registradas")).toBeInTheDocument();

        expect(screen.getByTestId("user-stats-summary")).toBeInTheDocument();
        expect(screen.getByText("Estadísticas")).toBeInTheDocument();
        expect(screen.getByText("W:1")).toBeInTheDocument();
        expect(screen.getByText("L:1")).toBeInTheDocument();
        expect(screen.getByText("D:1")).toBeInTheDocument();
        expect(screen.getByText("A:1")).toBeInTheDocument();

        expect(screen.getAllByText("Clasico HvB").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Clasico HvH").length).toBeGreaterThan(0);
        expect(screen.getByText("Clasico - Humano vs Bot")).toBeInTheDocument();
        expect(screen.getByText("Clasico - Humano vs Humano")).toBeInTheDocument();
        expect(screen.getByText("Ganada")).toBeInTheDocument();
        expect(screen.getByText("Abandonada")).toBeInTheDocument();
        expect(screen.getByText("Rival: random_bot")).toBeInTheDocument();
        expect(screen.getByText("Empieza: Humano")).toBeInTheDocument();
        expect(screen.getByText("Tamaño: 7")).toBeInTheDocument();
        expect(screen.getByText("Movimientos: 10")).toBeInTheDocument();
    });

    it("muestra partidas empatadas y usa rival por defecto cuando falta opponent", async () => {
        getUserHistoryMock.mockResolvedValueOnce(
            buildHistoryResponse({
                games: [
                    {
                        gameId: "g3",
                        mode: "tabu_hvh",
                        result: "draw",
                        boardSize: 7,
                        totalMoves: 14,
                        opponent: "",
                        startedBy: "",
                        finishedAt: "2026-03-21T14:00:00.000Z",
                    },
                ],
            }),
        );

        render(<UserHistory />);

        expect(await screen.findByText("Empatada")).toBeInTheDocument();
        expect(screen.getAllByText("Tabu HvH").length).toBeGreaterThan(0);
        expect(screen.getByText("Tabu - Humano vs Humano")).toBeInTheDocument();
        expect(screen.getByText("Rival: Jugador local")).toBeInTheDocument();
        expect(screen.queryByText(/Empieza:/)).toBeNull();
    });

    it("muestra spinner mientras carga", () => {
        getUserHistoryMock.mockReturnValue(new Promise(() => {}));

        render(<UserHistory />);

        expect(screen.getByText("Cargando...")).toBeInTheDocument();
    });

    it("muestra error si falla la API", async () => {
        getUserHistoryMock.mockRejectedValueOnce(new Error("Error 500"));

        render(<UserHistory />);

        expect(
            await screen.findByText("No se pudo cargar el historial"),
        ).toBeInTheDocument();
        expect(screen.getByText("Error 500")).toBeInTheDocument();
    });

    it("muestra Empty si no hay partidas", async () => {
        getUserHistoryMock.mockResolvedValueOnce(
            buildHistoryResponse({
                stats: {
                    gamesPlayed: 0,
                    gamesWon: 0,
                    gamesLost: 0,
                    gamesDrawn: 0,
                    gamesAbandoned: 0,
                    totalMoves: 0,
                    currentWinStreak: 0,
                    winRate: 0,
                },
                pagination: {
                    page: 1,
                    pageSize: 5,
                    totalGames: 0,
                    totalPages: 1,
                },
                games: [],
            })
        );

        render(<UserHistory />);

        expect(
            await screen.findByText(
                "No hay partidas que coincidan con los filtros seleccionados.",
            ),
        ).toBeInTheDocument();
    });

    it("cambia de página", async () => {
        getUserHistoryMock
            .mockResolvedValueOnce(
                buildHistoryResponse({
                    pagination: {
                        page: 1,
                        pageSize: 5,
                        totalGames: 6,
                        totalPages: 2,
                    },
                    games: [{
                        gameId: "g1",
                        mode: "classic_hvb",
                        result: "won",
                        boardSize: 7,
                        totalMoves: 10,
                        opponent: "random_bot",
                        startedBy: "human",
                        finishedAt: "2026-03-21T12:00:00.000Z",
                    },],
                })
            )
            .mockResolvedValueOnce(
                buildHistoryResponse({
                    pagination: {
                        page: 2,
                        pageSize: 5,
                        totalGames: 6,
                        totalPages: 2,
                    },
                    games: [{
                        gameId: "g6",
                        mode: "classic_hvh",
                        result: "lost",
                        boardSize: 9,
                        totalMoves: 12,
                        opponent: "Jugador local",
                        startedBy: "player1",
                        finishedAt: "2026-03-21T13:00:00.000Z",
                    },],
                })
            );

        const user = userEvent.setup();
        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        await user.click(screen.getByRole("button", { name: "next-page" }));

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 2, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        expect(await screen.findByText("Perdida")).toBeInTheDocument();
    });

    it("aplica filtros y ordenación", async () => {
        getUserHistoryMock.mockResolvedValue(buildHistoryResponse());

        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        fireEvent.change(screen.getAllByRole("combobox")[0], {
            target: { value: "classic_hvb" },
        });

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenLastCalledWith("marcelo", 1, 5, {
                mode: "classic_hvb",
                result: "all",
                sortBy: "newest",
            });
        });

        fireEvent.change(screen.getAllByRole("combobox")[1], {
            target: { value: "won" },
        });

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenLastCalledWith("marcelo", 1, 5, {
                mode: "classic_hvb",
                result: "won",
                sortBy: "newest",
            });
        });

        fireEvent.change(screen.getAllByRole("combobox")[2], {
            target: { value: "movesDesc" },
        });

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenLastCalledWith("marcelo", 1, 5, {
                mode: "classic_hvb",
                result: "won",
                sortBy: "movesDesc",
            });
        });
    });

    it("permite filtrar por empatadas", async () => {
        getUserHistoryMock.mockResolvedValue(buildHistoryResponse());

        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalled();
        });

        fireEvent.change(screen.getAllByRole("combobox")[1], {
            target: { value: "draw" },
        });

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenLastCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "draw",
                sortBy: "newest",
            });
        });
    });

    it("si no hay username no llama a la API", () => {
        getUserSessionMock.mockReturnValueOnce(null);

        render(<UserHistory />);

        expect(getUserHistoryMock).not.toHaveBeenCalled();
    });

    it("si cambias un filtro tras estar en otra página, vuelve a pedir page 1", async () => {
        getUserHistoryMock
            .mockResolvedValueOnce(
                buildHistoryResponse({
                    pagination: { page: 1, pageSize: 5, totalGames: 6, totalPages: 2 },
                }),
            )
            .mockResolvedValueOnce(
                buildHistoryResponse({
                    pagination: { page: 2, pageSize: 5, totalGames: 6, totalPages: 2 },
                }),
            )
            .mockResolvedValue(buildHistoryResponse());

        const user = userEvent.setup();
        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        await user.click(screen.getByRole("button", { name: "next-page" }));

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 2, 5, {
                mode: "all",
                result: "all",
                sortBy: "newest",
            });
        });

        fireEvent.change(screen.getAllByRole("combobox")[2], {
            target: { value: "movesAsc" },
        });

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenLastCalledWith("marcelo", 1, 5, {
                mode: "all",
                result: "all",
                sortBy: "movesAsc",
            });
        });
    });
});
