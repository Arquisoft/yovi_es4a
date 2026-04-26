import "@testing-library/jest-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import DifficultySelect from "../vistas/Dificultyselect";

vi.mock("../vistas/AppHeader", () => ({
  default: ({ title }: { title: string }) => <div data-testid="app-header">{title}</div>,
}));

vi.mock("antd", () => ({
  Button: ({ children, onClick, disabled, icon: _icon, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Card: ({ children, onClick, hoverable: _hoverable, ...props }: any) => (
    <div onClick={onClick} {...props}>
      {children}
    </div>
  ),
  Flex: ({ children }: any) => <div>{children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Typography: {
    Title: ({ children }: any) => <h2>{children}</h2>,
    Text: ({ children }: any) => <span>{children}</span>,
  },
}));

vi.mock("@ant-design/icons", () => ({
  ArrowLeftOutlined: () => null,
  FireOutlined: () => null,
  PlayCircleOutlined: () => null,
  RobotOutlined: () => null,
  ThunderboltOutlined: () => null,
}));

function renderDifficultySelect(props?: Partial<ComponentProps<typeof DifficultySelect>>) {
  const defaultProps = {
    bots: ["mcts_completo_dificil", "random_bot", "mcts_medio"],
    selectedBot: "random_bot",
    onSelect: vi.fn(),
    onConfirm: vi.fn(),
    onBackHome: vi.fn(),
  };

  const mergedProps = { ...defaultProps, ...props };

  return {
    ...mergedProps,
    ...render(<DifficultySelect {...mergedProps} />),
  };
}

describe("DifficultySelect", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza el encabezado, titulo y dificultades disponibles en orden", () => {
    renderDifficultySelect();

    expect(screen.getByTestId("app-header")).toHaveTextContent("YOVI");
    expect(screen.getByText("Selecciona la dificultad")).toBeInTheDocument();

    const labels = ["Fácil", "Medio", "Demencial"];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());

    const easy = screen.getByText("Fácil");
    const medium = screen.getByText("Medio");
    const demencial = screen.getByText("Demencial");

    expect(easy.compareDocumentPosition(medium)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(medium.compareDocumentPosition(demencial)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("llama a onSelect al pulsar una dificultad", async () => {
    const user = userEvent.setup();
    const { onSelect } = renderDifficultySelect();

    await user.click(screen.getByText("Medio"));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith("mcts_medio");
  });

  it("llama a onConfirm al pulsar Empezar partida si hay bot seleccionado", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDifficultySelect();

    await user.click(screen.getByRole("button", { name: "Empezar partida" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("deshabilita Empezar partida si no hay bot seleccionado", () => {
    renderDifficultySelect({ selectedBot: "" });

    expect(screen.getByRole("button", { name: "Empezar partida" })).toBeDisabled();
  });

  it("llama a onBackHome al pulsar Volver", async () => {
    const user = userEvent.setup();
    const { onBackHome } = renderDifficultySelect();

    await user.click(screen.getByRole("button", { name: "Volver" }));

    expect(onBackHome).toHaveBeenCalledOnce();
  });
});
