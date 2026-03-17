import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "antd"; // Necesario para el contexto de AppHeader
import Ranking from "../vistas/Ranking"; // Ajusta esta ruta a tu estructura de carpetas

// Hacemos un mock global de la función fetch
global.fetch = vi.fn();

describe("Ranking Component", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("renderiza el ranking haciendo la petición a la URL correcta", async () => {
    // 1. Preparamos los datos falsos que devolverá el "backend"
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

    // 2. Simulamos la respuesta exitosa del fetch
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => mockRankingData,
    });

    // 3. Renderizamos el componente. 
    // - MemoryRouter es necesario porque AppHeader usa 'useNavigate'
    // - App es necesario porque AppHeader usa 'App.useApp()' para el modal de logout
    render(
      <MemoryRouter>
        <App>
          <Ranking />
        </App>
      </MemoryRouter>
    );

    // 4. Comprobamos que el fetch se hizo con los parámetros por defecto
    expect(global.fetch).toHaveBeenCalledWith("/api/users/ranking?sortBy=winRate&limit=20");

    // 5. Esperamos a que la tabla de Ant Design se rellene con los datos
    await waitFor(() => {
      // Verificamos que los nombres de los jugadores aparecen en la tabla
      expect(screen.getByText("Faker")).toBeInTheDocument();
      expect(screen.getByText("Novato")).toBeInTheDocument();
      
      // Verificamos que el texto de las medallas/victorias se renderiza
      expect(screen.getByText("10V · 0D")).toBeInTheDocument();
      expect(screen.getByText("1V · 1D")).toBeInTheDocument();
    });
  });

  it("muestra un mensaje de error si la API falla", async () => {
    // Simulamos un error del servidor (ej. un 500)
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

    // Esperamos a que el componente de Alerta de Ant Design se muestre
    await waitFor(() => {
      expect(screen.getByText("No se pudo cargar el ranking")).toBeInTheDocument();
      expect(screen.getByText("Error 500")).toBeInTheDocument();
    });
  });
});