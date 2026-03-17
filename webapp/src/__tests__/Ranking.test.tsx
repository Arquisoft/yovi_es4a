import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "antd";
import Ranking from "../vistas/Ranking"; 
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
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

// Mock global del fetch
global.fetch = vi.fn();

describe("Ranking Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renderiza el ranking haciendo la petición a la URL correcta", async () => {
    const mockRankingData = {
      sortBy: "winRate",
      ranking: [
        { 
          username: "Faker", 
          winRate: 100, 
          gamesWon: 10, 
          gamesPlayed: 10, 
          gamesLost: 0, 
          totalMoves: 150, 
          profilePicture: "faker.png" 
        },
        { 
          username: "Novato", 
          winRate: 50, 
          gamesWon: 1, 
          gamesPlayed: 2, 
          gamesLost: 1, 
          totalMoves: 25, 
          profilePicture: "novato.png" 
        }
      ]
    };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockRankingData,
    });

    render(
      <MemoryRouter>
        <App>
          <Ranking />
        </App>
      </MemoryRouter>
    );

    expect(global.fetch).toHaveBeenCalledWith("/api/users/ranking?sortBy=winRate&limit=20");

    await waitFor(() => {
      expect(screen.getByText("Faker")).toBeInTheDocument();
      expect(screen.getByText("Novato")).toBeInTheDocument();
      expect(screen.getByText("10V · 0D")).toBeInTheDocument();
      expect(screen.getByText("1V · 1D")).toBeInTheDocument();
    });
  });

  it("muestra un mensaje de error si la API falla", async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 500
    });

    render(
      <MemoryRouter>
        <App>
          <Ranking />
        </App>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No se pudo cargar el ranking")).toBeInTheDocument();
      expect(screen.getByText("Error 500")).toBeInTheDocument();
    });
  });
});