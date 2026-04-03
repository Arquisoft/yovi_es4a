import "@testing-library/jest-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import ProtectedRoute from "../utils/ProtectedRoute";

const getUserSessionMock = vi.fn();

vi.mock("../utils/session", () => ({
  getUserSession: (...args: any[]) => getUserSessionMock(...args),
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza children si hay sesión", () => {
    getUserSessionMock.mockReturnValue({ username: "marcelo" });

    render(
      <MemoryRouter initialEntries={["/historial"]}>
        <Routes>
          <Route
            path="/historial"
            element={
              <ProtectedRoute>
                <div>Contenido protegido</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Inicio</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  });

  it("redirige al inicio si no hay sesión", () => {
    getUserSessionMock.mockReturnValue(null);

    render(
      <MemoryRouter initialEntries={["/historial"]}>
        <Routes>
          <Route
            path="/historial"
            element={
              <ProtectedRoute>
                <div>Contenido protegido</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Inicio</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Inicio")).toBeInTheDocument();
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  });
});