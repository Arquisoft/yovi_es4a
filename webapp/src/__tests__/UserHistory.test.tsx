import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserHistory from "../vistas/UserHistory";

const getUserHistoryMock = vi.fn();
const getUserSessionMock = vi.fn();

vi.mock("../api/users", () => ({
    getUserHistory: (...args: any[]) => getUserHistoryMock(...args),
    getDefaultOpponentLabel: (mode: string) => {
        if (mode === "classic_hvb") return "Bot";
        return "Jugador local";
    },
    getGameModeLongLabel: (mode: string) => {
        const labels: Record<string, string> = {
            classic_hvb: "Clásico — Humano vs Bot",
            classic_hvh: "Clásico — Humano vs Humano",
            why_not_hvh: "WhY Not — Humano vs Humano",
        };
        return labels[mode] ?? mode;
    },
    getGameModeShortLabel: (mode: string) => {
        const labels: Record<string, string> = {
            classic_hvb: "Clásico HvB",
            classic_hvh: "Clásico HvH",
            why_not_hvh: "WhY Not HvH",
        };
        return labels[mode] ?? mode;
    },
    getGameModeTagColor: () => "blue",
    HISTORY_MODE_FILTER_OPTIONS: [
        { value: "all", label: "Todos los modos" },
        { value: "classic_hvb", label: "Clásico HvB" },
        { value: "classic_hvh", label: "Clásico HvH" },
        { value: "why_not_hvh", label: "WhY Not HvH" },
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

    const DescriptionsComponent = ({ children }: any) => <div>{children}</div>;
    DescriptionsComponent.Item = ({ label, children }: any) => (
        <div>
            <span>{label}: </span>
            <span>{children}</span>
        </div>
    );

    return {
        Alert: ({ message, description }: any) => (
            <div>
                <div>{message}</div>
                <div>{description}</div>
            </div>
        ),
        Avatar: ({ src }: any) => <img alt="avatar" src={src} />,
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
        Descriptions: DescriptionsComponent,
        Empty: ({ description }: any) => <div>{description}</div>,
        Flex: ({ children }: any) => <div>{children}</div>,
        List: ListComponent,
        Pagination: ({ current, total, pageSize, onChange }: any) => (
            <div>
                <span>{`page:${current} total:${total} size:${pageSize}`}</span>
                <button aria-label="next-page" onClick={() => onChange(current + 1)}>
                    next
                </button>
            </div>
        ),
        Select: ({ value, onChange, options }: any) => (
            <select value={value} onChange={(e) => onChange(e.target.value)}>
                {options?.map((o: any) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
                ))}
            </select>
        ),
        Space: ({ children }: any) => <div>{children}</div>,
        Spin: () => <div>Cargando...</div>,
        Tag: ({ children }: any) => <span>{children}</span>,
        Typography: {
            Title: ({ children }: any) => <h2>{children}</h2>,
            Text: ({ children }: any) => <span>{children}</span>,
        },
    };
});

vi.mock("@ant-design/icons", () => ({
    CheckCircleOutlined: () => null,
    CloseCircleOutlined: () => null,
    StopOutlined: () => null,
    UserOutlined: () => null,
}));

function buildHistoryResponse(overrides: any = {}) {
    return {
        username: "marcelo",
        profilePicture: "avatar.png",
        stats: {
            gamesPlayed: 3,
            gamesWon: 1,
            gamesLost: 1,
            gamesAbandoned: 1,
            totalMoves: 23,
            winRate: 33,
            currentWinStreak: 0,
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
                boardSize: 7,
                totalMoves: 5,
                opponent: "Jugador local",
                startedBy: "player0",
                finishedAt: "2026-03-21T13:00:00.000Z",
            },
            {
                gameId: "g3",
                mode: "why_not_hvh",
                result: "lost",
                boardSize: 9,
                totalMoves: 8,
                opponent: "Jugador local (WhY Not)",
                startedBy: "player1",
                finishedAt: "2026-03-21T14:00:00.000Z",
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
        expect(screen.getByText("A:1")).toBeInTheDocument();

        expect(screen.getAllByText("Clásico HvB").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Clásico HvH").length).toBeGreaterThan(0);
        expect(screen.getAllByText("WhY Not HvH").length).toBeGreaterThan(0);

        expect(screen.getAllByText("Clásico — Humano vs Bot").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Clásico — Humano vs Humano").length).toBeGreaterThan(0);
        expect(screen.getAllByText("WhY Not — Humano vs Humano").length).toBeGreaterThan(0);

        expect(screen.getByText("Ganada")).toBeInTheDocument();
        expect(screen.getByText("Abandonada")).toBeInTheDocument();
        expect(screen.getByText("Perdida")).toBeInTheDocument();
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
                    gamesAbandoned: 0,
                    totalMoves: 0,
                    winRate: 0,
                    currentWinStreak: 0,
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

    it("no hace nada si no hay sesión", () => {
        getUserSessionMock.mockReturnValue(null);

        render(<UserHistory />);

        expect(getUserHistoryMock).not.toHaveBeenCalled();
    });
});