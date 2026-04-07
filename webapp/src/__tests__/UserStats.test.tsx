import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import UserStatsSummary from "../vistas/UserStats";

vi.mock("antd", () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  Row: ({ children }: any) => <div>{children}</div>,
  Col: ({ children }: any) => <div>{children}</div>,
  Statistic: ({ title, value }: any) => <div>{`${title}: ${value}`}</div>,
}));

vi.mock("@ant-design/icons", () => ({
  CheckCircleOutlined: () => <span />,
  CloseCircleOutlined: () => <span />,
  StopOutlined: () => <span />,
  FireOutlined: () => <span />,
}));

describe("UserStatsSummary", () => {
  it("renderiza el título por defecto y los valores", () => {
    render(
      <UserStatsSummary
        stats={{
          gamesPlayed: 10,
          gamesWon: 4,
          gamesLost: 3,
          gamesAbandoned: 3,
          totalMoves: 50,
          currentWinStreak: 2,
          winRate: 40,
        }}
      />
    );

    expect(screen.getByText("Estadísticas")).toBeInTheDocument();
    expect(screen.getByText("Partidas Ganadas: 4")).toBeInTheDocument();
    expect(screen.getByText("Partidas Perdidas: 3")).toBeInTheDocument();
    expect(screen.getByText("Partidas Abandonadas: 3")).toBeInTheDocument();
    expect(screen.getByText("Racha de Partidas Panadas: 2")).toBeInTheDocument();
  });

  it("renderiza un título personalizado", () => {
    render(
      <UserStatsSummary
        title="Tus estadísticas"
        stats={{
          gamesPlayed: 8,
          gamesWon: 5,
          gamesLost: 2,
          gamesAbandoned: 1,
          totalMoves: 40,
          currentWinStreak: 4,
          winRate: 63,
        }}
      />
    );

    expect(screen.getByText("Tus estadísticas")).toBeInTheDocument();
    expect(screen.getByText("Partidas Ganadas: 5")).toBeInTheDocument();
    expect(screen.getByText("Partidas Perdidas: 2")).toBeInTheDocument();
    expect(screen.getByText("Partidas Abandonadas: 1")).toBeInTheDocument();
    expect(screen.getByText("Racha de Partidas Panadas: 4")).toBeInTheDocument();
  });

  it("soporta valores a cero", () => {
    render(
      <UserStatsSummary
        stats={{
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesAbandoned: 0,
          totalMoves: 0,
          currentWinStreak: 0,
          winRate: 0,
        }}
      />
    );

    expect(screen.getByText("Partidas Ganadas: 0")).toBeInTheDocument();
    expect(screen.getByText("Partidas Perdidas: 0")).toBeInTheDocument();
    expect(screen.getByText("Partidas Abandonadas: 0")).toBeInTheDocument();
    expect(screen.getByText("Racha de Partidas Panadas: 0")).toBeInTheDocument();
  });
});