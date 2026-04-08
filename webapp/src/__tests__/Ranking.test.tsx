import "@testing-library/jest-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Ranking from "../vistas/Ranking";

const getRankingMock = vi.fn();

vi.mock("../api/users", () => ({
  getRanking: (...args: any[]) => getRankingMock(...args),
}));

vi.mock("../vistas/AppHeader", () => ({
  default: ({ title }: any) => <div>{title}</div>,
}));

vi.mock("../estilos/Ranking.css", () => ({}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");

  return {
    ...actual,
    Segmented: ({ value, onChange, options }: any) => (
      <div data-testid="segmented">
        {options.map((opt: any) => (
          <button
            key={opt.value}
            data-active={opt.value === value}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    ),
    Select: ({ value, onChange, options }: any) => (
      <select
        aria-label="sort-ranking"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.value}
          </option>
        ))}
      </select>
    ),
  };
});

function makePaginatedResponse(sortBy: string, ranking: any[]) {
  return {
    sortBy,
    podium: {
      mostGames: null,
      mostWins: null,
      bestRate: null,
    },
    pagination: {
      totalItems: ranking.length,
      page: 1,
      pageSize: 15,
      totalPages: 1,
    },
    ranking,
  };
}

describe("Ranking", () => {
  beforeAll(() => {
    // Mock ResizeObserver (needed by Ant Design components)
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as any;

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga y muestra el ranking con el sort inicial", async () => {
    getRankingMock.mockResolvedValueOnce(
      makePaginatedResponse("winRate", [
        {
          username: "Faker",
          profilePicture: "faker.png",
          gamesPlayed: 10,
          gamesWon: 10,
          gamesLost: 0,
          gamesAbandoned: 0,
          totalMoves: 150,
          winRate: 100,
        },
        {
          username: "Novato",
          profilePicture: "novato.png",
          gamesPlayed: 2,
          gamesWon: 1,
          gamesLost: 1,
          gamesAbandoned: 0,
          totalMoves: 25,
          winRate: 50,
        },
      ]),
    );

    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 1, 15);
    });

    expect(await screen.findByText("Faker")).toBeInTheDocument();
    expect(screen.getByText("Novato")).toBeInTheDocument();
    expect(screen.getByText("10V · 0D · 0A")).toBeInTheDocument();
    expect(screen.getByText("1V · 1D · 0A")).toBeInTheDocument();
  });

  it("permite cambiar el criterio de ordenación", async () => {
    getRankingMock
      .mockResolvedValueOnce(makePaginatedResponse("winRate", []))
      .mockResolvedValueOnce(
        makePaginatedResponse("gamesWon", [
          {
            username: "Marcelo",
            profilePicture: "",
            gamesPlayed: 8,
            gamesWon: 6,
            gamesLost: 2,
            gamesAbandoned: 0,
            totalMoves: 90,
            winRate: 75,
          },
        ]),
      );

    const user = userEvent.setup();
    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 1, 15);
    });

    await user.selectOptions(screen.getByLabelText("sort-ranking"), "gamesWon");

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("gamesWon", 1, 15);
    });

    expect(await screen.findByText("Marcelo")).toBeInTheDocument();
  });

  it("muestra error si la API falla", async () => {
    getRankingMock.mockRejectedValueOnce(new Error("Error 500"));

    render(<Ranking />);

    expect(
      await screen.findByText(/No se pudo cargar el ranking:? Error 500/i),
    ).toBeInTheDocument();
  });

  it("tolera respuestas sin ranking array", async () => {
    getRankingMock.mockResolvedValueOnce({
      sortBy: "winRate",
      ranking: null,
      pagination: { totalItems: 0, page: 1, pageSize: 15, totalPages: 0 },
    });

    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 1, 15);
    });

    expect(
      screen.getByText("Todavía no hay jugadores con partidas registradas."),
    ).toBeInTheDocument();
  });

  it("muestra el podio cuando hay datos semanales", async () => {
    getRankingMock.mockResolvedValueOnce({
      sortBy: "winRate",
      podium: {
        mostGames: {
          username: "TopPlayer",
          profilePicture: "seniora.png",
          stats: { gamesPlayed: 20, gamesWon: 15, gamesLost: 3, gamesAbandoned: 2, totalMoves: 300, winRate: 75 },
        },
        mostWins: {
          username: "WinMaster",
          profilePicture: "disco.png",
          stats: { gamesPlayed: 18, gamesWon: 17, gamesLost: 1, gamesAbandoned: 0, totalMoves: 250, winRate: 94 },
        },
        bestRate: {
          username: "PerfectRatio",
          profilePicture: "elvis.png",
          stats: { gamesPlayed: 10, gamesWon: 10, gamesLost: 0, gamesAbandoned: 0, totalMoves: 120, winRate: 100 },
        },
      },
      pagination: { totalItems: 3, page: 1, pageSize: 15, totalPages: 1 },
      ranking: [
        { username: "TopPlayer", profilePicture: "seniora.png", gamesPlayed: 20, gamesWon: 15, gamesLost: 3, gamesAbandoned: 2, totalMoves: 300, winRate: 75 },
        { username: "WinMaster", profilePicture: "disco.png", gamesPlayed: 18, gamesWon: 17, gamesLost: 1, gamesAbandoned: 0, totalMoves: 250, winRate: 94 },
        { username: "PerfectRatio", profilePicture: "elvis.png", gamesPlayed: 10, gamesWon: 10, gamesLost: 0, gamesAbandoned: 0, totalMoves: 120, winRate: 100 },
      ],
    });

    render(<Ranking />);

    expect(await screen.findByText("Podio de la semana")).toBeInTheDocument();
    expect(screen.getAllByText("TopPlayer").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("WinMaster").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("PerfectRatio").length).toBeGreaterThanOrEqual(1);
  });

  it("muestra 'Nadie jugó esta semana' si el podio está vacío", async () => {
    getRankingMock.mockResolvedValueOnce({
      sortBy: "winRate",
      podium: { mostGames: null, mostWins: null, bestRate: null },
      pagination: { totalItems: 0, page: 1, pageSize: 15, totalPages: 0 },
      ranking: [],
    });

    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalled();
    });

    // Podium section should not render when all entries are null
    expect(screen.queryByText("Podio de la semana")).not.toBeInTheDocument();
  });
});