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
  default: ({
    onComplete,
  }: {
    onComplete?: () => void;
  }) => (
    <div>
      <div>lottie</div>
      <button onClick={onComplete}>finish-lottie</button>
    </div>
  ),
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

  it("muestra 'Esperando rival' cuando no es tu turno", () => {
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
        boardDisabled
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn="player1"
        winner={null}
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.getByText("⌛ Esperando rival...")).toBeTruthy();
  });

  it("muestra badge de bloqueadas en modo tabu_hvh", () => {
    render(
      <MultiplayerSessionGamePage
        title="Tabú Online"
        subtitle="Sala: ROOM1 · Eres: Azul"
        mode="tabu_hvh"
        loading={false}
        error=""
        hasBoard
        emptyText="No se pudo cargar la partida."
        boardSize={11}
        cells={[]}
        disabledCells={new Set<number>([1, 2, 3])}
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

    expect(screen.getByText("3 bloqueadas")).toBeTruthy();
  });

  it("no renderiza indicador de turno si hay ganador", () => {
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
        boardDisabled
        onCellClick={onCellClickMock}
        myPlayer="player0"
        gameOver
        nextTurn="player0"
        winner="player1"
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.queryByText("Chat")).toBeNull();
    expect(screen.queryByText("🟢 ¡TU TURNO!")).toBeNull();
  });

  it("no renderiza indicador de turno si nextTurn es null", () => {
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
        boardDisabled
        onCellClick={onCellClickMock}
        myPlayer="player0"
        nextTurn={null}
        winner={null}
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.queryByText("Chat")).toBeNull();
    expect(screen.queryByText("🟢 ¡TU TURNO!")).toBeNull();
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
        gameOver
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

  it("muestra derrota cuando gana el rival", () => {
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
        boardDisabled
        onCellClick={onCellClickMock}
        myPlayer="player0"
        gameOver
        nextTurn={null}
        winner="player1"
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.getByText("💀 HAS PERDIDO")).toBeTruthy();
  });

  it("deja de renderizar la animación al completarse", () => {
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
        boardDisabled
        onCellClick={onCellClickMock}
        myPlayer="player0"
        gameOver
        nextTurn={null}
        winner="player0"
        hasNewMessages={false}
        onOpenChat={onOpenChatMock}
        onAbandon={onAbandonMock}
        onBack={onBackMock}
      />,
    );

    expect(screen.getByText("lottie")).toBeTruthy();

    fireEvent.click(screen.getByText("finish-lottie"));

    expect(screen.queryByText("lottie")).toBeNull();
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

  it("ejecuta onAbandon cuando se confirma el modal", async () => {
    modalConfirmMock.mockImplementation(({ onOk }) => onOk?.());

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

    await Promise.resolve();

    expect(onAbandonMock).toHaveBeenCalled();
  });
});