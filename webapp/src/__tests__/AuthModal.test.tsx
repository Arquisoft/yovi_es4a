import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import AuthModal from "../vistas/registroLogin/AuthModal";

const loginFormMock = vi.fn();
const registerFormMock = vi.fn();
const modalOnCancelRef = { current: undefined as undefined | (() => void) };

vi.mock("../vistas/registroLogin/LoginForm", () => ({
  default: (props: any) => {
    loginFormMock(props);
    return <div>LoginForm</div>;
  },
}));

vi.mock("../vistas/registroLogin/RegisterForm", () => ({
  default: (props: any) => {
    registerFormMock(props);
    return <div>RegisterForm</div>;
  },
}));

vi.mock("antd", () => ({
  Modal: ({ open, title, onCancel, children }: any) => {
    modalOnCancelRef.current = onCancel;
    return open ? (
      <div>
        <div>{title}</div>
        <button onClick={onCancel}>Cerrar modal</button>
        {children}
      </div>
    ) : null;
  },
  Tabs: ({ defaultActiveKey, items }: any) => (
    <div>
      <div>defaultActiveKey={defaultActiveKey}</div>
      {items.map((item: any) => (
        <div key={item.key}>
          <div>{item.label}</div>
          <div data-testid={`tab-${item.key}`}>{item.children}</div>
        </div>
      ))}
    </div>
  ),
  Typography: {
    Paragraph: ({ children }: any) => <p>{children}</p>,
  },
}));

describe("AuthModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    modalOnCancelRef.current = undefined;
  });

  it("renderiza el modal con título, texto y tabs", () => {
    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        onLoginSuccess={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Guardar partida en tu cuenta"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Si inicias sesión ahora, la partida terminada se guardará en tu cuenta/i,
      ),
    ).toBeInTheDocument();

    expect(screen.getByText("defaultActiveKey=login")).toBeInTheDocument();
    expect(screen.getByText("Iniciar sesión")).toBeInTheDocument();
    expect(screen.getByText("Registrarse")).toBeInTheDocument();
  });

  it("monta LoginForm con redirectOnSuccess=false y propaga onLoginSuccess", () => {
    const onLoginSuccess = vi.fn();

    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        onLoginSuccess={onLoginSuccess}
      />,
    );

    expect(loginFormMock).toHaveBeenCalled();
    const loginProps = loginFormMock.mock.calls.at(-1)?.[0];

    expect(loginProps.redirectOnSuccess).toBe(false);
    expect(loginProps.onLoginSuccess).toBe(onLoginSuccess);
  });

  it("monta RegisterForm en modo embedded", () => {
    render(
      <AuthModal
        open={true}
        onClose={vi.fn()}
        onLoginSuccess={vi.fn()}
      />,
    );

    expect(registerFormMock).toHaveBeenCalled();
    const registerProps = registerFormMock.mock.calls.at(-1)?.[0];

    expect(registerProps.embedded).toBe(true);
  });

  it("llama a onClose cuando se cancela el modal", async () => {
    const onClose = vi.fn();

    render(
      <AuthModal
        open={true}
        onClose={onClose}
        onLoginSuccess={vi.fn()}
      />,
    );

    expect(modalOnCancelRef.current).toBeTypeOf("function");
    modalOnCancelRef.current?.();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("no renderiza el contenido si open=false", () => {
    render(
      <AuthModal
        open={false}
        onClose={vi.fn()}
        onLoginSuccess={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Guardar partida en tu cuenta"),
    ).not.toBeInTheDocument();

    expect(loginFormMock).not.toHaveBeenCalled();
    expect(registerFormMock).not.toHaveBeenCalled();
  });
});