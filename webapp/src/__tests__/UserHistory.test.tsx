import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserHistory from "../vistas/UserHistory";

const getUserHistoryMock = vi.fn();
const getUserSessionMock = vi.fn();

vi.mock("../api/users", () => ({
    getUserHistory: (...args: any[]) => getUserHistoryMock(...args),
}));

vi.mock("../utils/session", () => ({
    getUserSession: (...args: any[]) => getUserSessionMock(...args),
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

    return {
        Alert: ({ message, description }: any) => (
            <div>
                <div>{message}</div>
                <div>{description}</div>
            </div>
        ),
        Avatar: ({ children }: any) => <div>{children}</div>,
        Card: ({ children }: any) => <div>{children}</div>,
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
}));

describe("UserHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });
    });

    it("carga el historial y muestra stats y partidas", async () => {
        getUserHistoryMock.mockResolvedValueOnce({
            username: "marcelo",
            profilePicture: "avatar.png",
            stats: {
                gamesPlayed: 3,
                gamesWon: 1,
                gamesLost: 1,
                gamesAbandoned: 1,
                totalMoves: 20,
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
                    mode: "HvB",
                    result: "won",
                    boardSize: 7,
                    totalMoves: 10,
                    opponent: "random_bot",
                    startedBy: "human",
                    finishedAt: "2026-03-21T12:00:00.000Z",
                },
                {
                    gameId: "g2",
                    mode: "HvH",
                    result: "abandoned",
                    boardSize: 9,
                    totalMoves: 5,
                    opponent: "Jugador local",
                    startedBy: "player0",
                    finishedAt: "2026-03-21T13:00:00.000Z",
                },
            ],
        });

        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5);
        });

        expect(await screen.findByText("marcelo")).toBeInTheDocument();
        expect(screen.getByText("3 partidas registradas")).toBeInTheDocument();

        expect(screen.getByTestId("user-stats-summary")).toBeInTheDocument();
        expect(screen.getByText("Estadísticas")).toBeInTheDocument();
        expect(screen.getByText("W:1")).toBeInTheDocument();
        expect(screen.getByText("L:1")).toBeInTheDocument();
        expect(screen.getByText("A:1")).toBeInTheDocument();

        expect(screen.getByText("Humano vs Bot · 7x")).toBeInTheDocument();
        expect(screen.getByText("Humano vs Humano · 9x")).toBeInTheDocument();
        expect(screen.getByText("Ganada")).toBeInTheDocument();
        expect(screen.getByText("Abandonada")).toBeInTheDocument();
        expect(screen.getByText("Rival: random_bot")).toBeInTheDocument();
        expect(screen.getByText("Empieza: human")).toBeInTheDocument();
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
        getUserHistoryMock.mockResolvedValueOnce({
            username: "marcelo",
            profilePicture: "avatar.png",
            stats: {
                gamesPlayed: 0,
                gamesWon: 0,
                gamesLost: 0,
                gamesAbandoned: 0,
                totalMoves: 0,
                winRate: 0,
            },
            pagination: {
                page: 1,
                pageSize: 5,
                totalGames: 0,
                totalPages: 1,
            },
            games: [],
        });

        render(<UserHistory />);

        expect(
            await screen.findByText(
                "Todavía no hay partidas registradas para este usuario.",
            ),
        ).toBeInTheDocument();
    });

    it("cambia de página", async () => {
        getUserHistoryMock
            .mockResolvedValueOnce({
                username: "marcelo",
                profilePicture: "",
                stats: {
                    gamesPlayed: 6,
                    gamesWon: 2,
                    gamesLost: 2,
                    gamesAbandoned: 2,
                    totalMoves: 30,
                    winRate: 33,
                },
                pagination: {
                    page: 1,
                    pageSize: 5,
                    totalGames: 6,
                    totalPages: 2,
                },
                games: [
                    {
                        gameId: "g1",
                        mode: "HvB",
                        result: "won",
                        boardSize: 7,
                        totalMoves: 10,
                        opponent: "random_bot",
                        startedBy: "human",
                        finishedAt: "2026-03-21T12:00:00.000Z",
                    },
                ],
            })
            .mockResolvedValueOnce({
                username: "marcelo",
                profilePicture: "",
                stats: {
                    gamesPlayed: 6,
                    gamesWon: 2,
                    gamesLost: 2,
                    gamesAbandoned: 2,
                    totalMoves: 30,
                    winRate: 33,
                },
                pagination: {
                    page: 2,
                    pageSize: 5,
                    totalGames: 6,
                    totalPages: 2,
                },
                games: [
                    {
                        gameId: "g6",
                        mode: "HvH",
                        result: "lost",
                        boardSize: 9,
                        totalMoves: 12,
                        opponent: "Jugador local",
                        startedBy: "player1",
                        finishedAt: "2026-03-21T13:00:00.000Z",
                    },
                ],
            });

        const user = userEvent.setup();
        render(<UserHistory />);

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 1, 5);
        });

        await user.click(screen.getByRole("button", { name: "next-page" }));

        await waitFor(() => {
            expect(getUserHistoryMock).toHaveBeenCalledWith("marcelo", 2, 5);
        });

        expect(await screen.findByText("Humano vs Humano · 9x")).toBeInTheDocument();
    });

    it("si no hay username no llama a la API", () => {
        getUserSessionMock.mockReturnValueOnce(null);

        render(<UserHistory />);

        expect(getUserHistoryMock).not.toHaveBeenCalled();
    });
});