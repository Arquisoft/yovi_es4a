import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import MultiplayerSessionGamePage from "../game/MultiplayerSessionGamePage";

const modalConfirmMock = vi.fn();
const onAbandonMock = vi.fn();
const onBackMock = vi.fn();
const onOpenChatMock = vi.fn();
const onCellClickMock = vi.fn();

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
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

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    configurable: true,
    value: ResizeObserverMock,
  });

  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");
  return {
    ...actual,
    App: {
      useApp: () => ({
        modal: {
          confirm: modalConfirmMock,
        },
      }),
    },
  };
});

vi.mock("../game/GameShell", () => ({
  default: ({
    title,
    subtitle,
    turnIndicator,
    board,
    result,
    onAbandon,
  }: {
    title: string;
    subtitle: string;
    turnIndicator?: ReactNode;
    board: ReactNode;
    result?: ReactNode;
    onAbandon: () => void;
  }) => (
    <div>
      <div>{title}</div>
      <div>{subtitle}</div>
      <button onClick={onAbandon}>abandonar-shell</button>
      <div>{turnIndicator}</div>
      <div>{board}</div>
      <div>{result}</div>
    </div>
  ),
}));

vi.mock("../game/Board", () => ({
  default: ({
    size,
    onCellClick,
  }: {
    size: number;
    onCellClick: (cellId: number) => void;
  }) => (
    <div>
      <div>{`board-size:${size}`}</div>
      <button onClick={() => onCellClick(9)}>board-click</button>
    </div>
  ),
}));

vi.mock("lottie-react", () => ({
  default: () => <div>lottie</div>,
}));

describe("MultiplayerSessionGamePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza título, subtítulo y tablero", () => {
    render(
      <MultiplayerSessionGamePage
        title="Clásico Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="classic_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>()}
        boardDisabled={false}
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn="player0"
        winner={null}
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.getByText("Clásico Online")).toBeTruthy();
    expect(screen.getByText("Sala: ROOM1 · Eres: Azul")).toBeTruthy();
    expect(screen.getByText("board-size:11")).toBeTruthy();
  });

  it("abre el chat desde el indicador de turno", () => {
    render(
      <MultiplayerSessionGamePage
        title="Clásico Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="classic_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>()}
        boardDisabled={false}
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn="player0"
        winner={null}
        hasNewMessages={true}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    fireEvent.click(screen.getByText("Chat"));
    expect(onOpenChatMock).toHaveBeenCalled();
  });

  it("delegates board clicks", () => {
    render(
      <MultiplayerSessionGamePage
        title="Clásico Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="classic_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>()}
        boardDisabled={false}
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn="player0"
        winner={null}
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    fireEvent.click(screen.getByText("board-click"));
    expect(onCellClickMock).toHaveBeenCalledWith(9);
  });

  it("muestra el resultado final y permite volver", () => {
    render(
      <MultiplayerSessionGamePage
        title="Clásico Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="classic_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>()}
        boardDisabled={true}
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn={null}
        winner="player0"
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.getByText("👑 ¡HAS GANADO!")).toBeTruthy();

    fireEvent.click(screen.getByText("Volver al Lobby"));
    expect(onBackMock).toHaveBeenCalled();
  });

  it("abre el confirm de abandono", () => {
    render(
      <MultiplayerSessionGamePage
        title="Clásico Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="classic_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>()}
        boardDisabled={false}
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn="player0"
        winner={null}
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    fireEvent.click(screen.getByText("abandonar-shell"));

    expect(modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Abandonar",
        content: "¿Seguro que quieres abandonar la partida?",
      }),
    );
  });
});