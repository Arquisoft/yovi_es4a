import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import MultiplayerChatDrawer from "../vistas/MultiplayerChatDrawer";

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
    Drawer: ({
      open,
      title,
      children,
    }: {
      open: boolean;
      title: React.ReactNode;
      children: React.ReactNode;
    }) =>
      open ? (
        <div>
          <div>{title}</div>
          {children}
        </div>
      ) : null,
  };
});

describe("MultiplayerChatDrawer", () => {
  const onClose = vi.fn();
  const onSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza los mensajes del chat", () => {
    render(
      <MultiplayerChatDrawer
        open
        myPlayer="player0"
        messages={[
          {
            text: "hola",
            sender: "player0",
            timestamp: new Date("2026-04-08T10:00:00Z").getTime(),
          },
          {
            text: "qué tal",
            sender: "player1",
            timestamp: new Date("2026-04-08T10:01:00Z").getTime(),
          },
        ]}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />,
    );

    expect(screen.getByText(/Chat de Sala/)).toBeTruthy();
    expect(screen.getByText("hola")).toBeTruthy();
    expect(screen.getByText("qué tal")).toBeTruthy();
  });

  it("envía el mensaje al pulsar Enter", () => {
    render(
      <MultiplayerChatDrawer
        open
        myPlayer="player0"
        messages={[]}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: " mensaje nuevo " } });
    fireEvent.keyDown(input, {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });

    expect(onSendMessage).toHaveBeenCalledWith("mensaje nuevo");
  });

  it("envía el mensaje al pulsar el botón", () => {
    render(
      <MultiplayerChatDrawer
        open
        myPlayer="player0"
        messages={[]}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: "hola chat" } });

    const buttons = screen.getAllByRole("button");
    const sendButton = buttons[0];
    fireEvent.click(sendButton);

    expect(onSendMessage).toHaveBeenCalledWith("hola chat");
  });

  it("no envía mensajes vacíos", () => {
    render(
      <MultiplayerChatDrawer
        open
        myPlayer="player0"
        messages={[]}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe un mensaje...");
    fireEvent.change(input, { target: { value: "   " } });

    const buttons = screen.getAllByRole("button");
    const sendButton = buttons[0];
    fireEvent.click(sendButton);

    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("no renderiza nada si el drawer está cerrado", () => {
    render(
      <MultiplayerChatDrawer
        open={false}
        myPlayer="player0"
        messages={[]}
        onClose={onClose}
        onSendMessage={onSendMessage}
      />,
    );

    expect(screen.queryByText(/Chat de Sala/)).toBeNull();
  });
});