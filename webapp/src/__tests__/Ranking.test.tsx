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

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");

  return {
    ...actual,
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

describe("Ranking", () => {
  beforeAll(() => {
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
    getRankingMock.mockResolvedValueOnce({
      sortBy: "winRate",
      ranking: [
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
      ],
    });

    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 20);
    });

    expect(await screen.findByText("Faker")).toBeInTheDocument();
    expect(screen.getByText("Novato")).toBeInTheDocument();
    expect(screen.getByText("10V · 0D · 0A")).toBeInTheDocument();
    expect(screen.getByText("1V · 1D · 0A")).toBeInTheDocument();
  });

  it("permite cambiar el criterio de ordenación", async () => {
    getRankingMock
      .mockResolvedValueOnce({
        sortBy: "winRate",
        ranking: [],
      })
      .mockResolvedValueOnce({
        sortBy: "gamesWon",
        ranking: [
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
        ],
      });

    const user = userEvent.setup();
    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 20);
    });

    await user.selectOptions(screen.getByLabelText("sort-ranking"), "gamesWon");

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("gamesWon", 20);
    });

    expect(await screen.findByText("Marcelo")).toBeInTheDocument();
  });

  it("muestra error si la API falla", async () => {
    getRankingMock.mockRejectedValueOnce(new Error("Error 500"));

    render(<Ranking />);

    expect(
      await screen.findByText("No se pudo cargar el ranking"),
    ).toBeInTheDocument();
    expect(screen.getByText("Error 500")).toBeInTheDocument();
  });

  it("tolera respuestas sin ranking array", async () => {
    getRankingMock.mockResolvedValueOnce({
      sortBy: "winRate",
      ranking: null,
    });

    render(<Ranking />);

    await waitFor(() => {
      expect(getRankingMock).toHaveBeenCalledWith("winRate", 20);
    });

    expect(
      screen.getByText("Todavía no hay jugadores con partidas registradas."),
    ).toBeInTheDocument();
  });
});