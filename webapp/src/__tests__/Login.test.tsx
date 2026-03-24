import "@testing-library/jest-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../vistas/registroLogin/LoginForm";

const mockNavigate = vi.fn();
const loginUserMock = vi.fn();
const saveUserSessionMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../api/users", () => ({
  loginUser: (...args: any[]) => loginUserMock(...args),
}));

vi.mock("../utils/session", () => ({
  saveUserSession: (...args: any[]) => saveUserSessionMock(...args),
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<any>("antd");
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe("LoginForm", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
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
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza campos y botón", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Nombre de usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Recordarme/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Iniciar Sesión/i }),
    ).toBeInTheDocument();
  });

  it("muestra errores de validación si se envía vacío", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    expect(
      await screen.findByText(/Por favor, ingresa tu usuario./i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Por favor, ingresa tu contraseña./i),
    ).toBeInTheDocument();

    expect(loginUserMock).not.toHaveBeenCalled();
  });

  it("inicia sesión, guarda la sesión y navega a home", async () => {
    const { message } = await import("antd");
    loginUserMock.mockResolvedValueOnce({
      message: "Login exitoso",
      username: "marcelo",
      profilePicture: "avatar-1.png",
    });

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/Nombre de usuario/i), "marcelo");
    await user.type(screen.getByLabelText(/Contraseña/i), "Password123!");
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(loginUserMock).toHaveBeenCalledWith("marcelo", "Password123!");
      expect(saveUserSessionMock).toHaveBeenCalledWith({
        username: "marcelo",
        profilePicture: "avatar-1.png",
      });
      expect(message.success).toHaveBeenCalledWith("Login exitoso");
      expect(mockNavigate).toHaveBeenCalledWith("/home");
    });
  });

  it("muestra error si el login falla", async () => {
    const { message } = await import("antd");
    loginUserMock.mockRejectedValueOnce(new Error("Credenciales incorrectas"));

    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/Nombre de usuario/i), "wrong");
    await user.type(screen.getByLabelText(/Contraseña/i), "wrongpass");
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      expect(loginUserMock).toHaveBeenCalledWith("wrong", "wrongpass");
      expect(saveUserSessionMock).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(message.error).toHaveBeenCalledWith("Credenciales incorrectas");
    });
  });
});