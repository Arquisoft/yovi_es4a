import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import HelpModal from "../vistas/HelpModal";

const { matchMediaMock } = vi.hoisted(() => {
  const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: matchMediaMock,
  });

  // jsdom no implementa ResizeObserver, pero antd Tabs lo necesita
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  return { matchMediaMock };
});

describe("HelpModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = matchMediaMock;
    Object.defineProperty(window, "getComputedStyle", {
      value: () => ({ getPropertyValue: () => "" }),
    });
  });

  function renderHelpModal() {
    return render(
      <App>
        <HelpModal />
      </App>
    );
  }

  it("renderiza sin errores y muestra la pestaña activa por defecto", () => {
    renderHelpModal();
    expect(screen.getByText("Reglas del Juego Y")).toBeInTheDocument();
  });

  it("muestra el contenido de la pestaña 'Reglas del Juego Y' por defecto", () => {
    renderHelpModal();
    expect(screen.getByText("Objetivo")).toBeInTheDocument();
    expect(screen.getByText("Condición de victoria")).toBeInTheDocument();
  });

  it("muestra el contenido de 'Modos de Juego' al pulsar la pestaña", async () => {
    const user = userEvent.setup();
    renderHelpModal();

    await user.click(screen.getByRole("tab", { name: "Modos de Juego" }));

    expect(screen.getByText("Clásico - Human vs Bot (HvB)")).toBeInTheDocument();
    expect(screen.getByText("Clásico - Human vs Human (HvH)")).toBeInTheDocument();
  });

  it("muestra el contenido de 'Cómo usar la app' al pulsar la pestaña", async () => {
    const user = userEvent.setup();
    renderHelpModal();

    await user.click(screen.getByRole("tab", { name: "Cómo usar la app" }));

    expect(screen.getByText("Crear partida")).toBeInTheDocument();
    expect(screen.getByText("Durante la partida")).toBeInTheDocument();
  });

  it("muestra el contenido de 'FAQ' al pulsar la pestaña", async () => {
    const user = userEvent.setup();
    renderHelpModal();

    await user.click(screen.getByRole("tab", { name: "FAQ" }));

    expect(screen.getByText("¿Puedo deshacer un movimiento?")).toBeInTheDocument();
    expect(screen.getByText("¿Cómo sé quién ha ganado?")).toBeInTheDocument();
  });
});