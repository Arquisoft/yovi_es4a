import "@testing-library/jest-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RegisterForm from "../vistas/registroLogin/RegisterForm";
import { message } from "antd";

const registerUserMock = vi.fn();
const evaluatePasswordStrengthMock = vi.fn();
const validateUsernameMock = vi.fn();
const validatePasswordMock = vi.fn();
const validateConfirmPasswordMock = vi.fn();

vi.mock("../api/users", () => ({
  registerUser: (...args: any[]) => registerUserMock(...args),
}));

vi.mock("../utils/Validation", () => ({
  evaluatePasswordStrength: (...args: any[]) =>
    evaluatePasswordStrengthMock(...args),
  validateUsername: (...args: any[]) => validateUsernameMock(...args),
  validatePassword: (...args: any[]) => validatePasswordMock(...args),
  validateConfirmPassword: (...args: any[]) =>
    validateConfirmPasswordMock(...args),
  AVATARS: [
    { id: "avatar1.png", src: "/avatar1.png", label: "Avatar 1" },
    { id: "avatar2.png", src: "/avatar2.png", label: "Avatar 2" },
    { id: "avatar3.png", src: "/avatar3.png", label: "Avatar 3" },
  ],
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

describe("RegisterForm Component", () => {
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

    validateUsernameMock.mockReturnValue(null);
    validatePasswordMock.mockReturnValue(null);
    validateConfirmPasswordMock.mockReturnValue(null);

    evaluatePasswordStrengthMock.mockImplementation((password: string) => {
      if (!password) return { label: "", color: "transparent", width: "0%" };
      if (password === "123456") {
        return { label: "Baja", color: "#ff4d4f", width: "25%" };
      }
      return { label: "Alta", color: "#52c41a", width: "100%" };
    });
  });

  it("debe renderizar todos los campos correctamente", async () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Nombre de Usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText(/Repetir Contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrarse/i }),
    ).toBeInTheDocument();
  }, 10000);

  it("debe mostrar error si el nivel de seguridad de la contraseña es demasiado bajo", async () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "testuser" },
    });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
      target: { value: "test@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir Contraseña/i), {
      target: { value: "123456" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    const expectedMsg =
      "La seguridad de la contraseña es demasiado baja para registrarse.";

    expect(await screen.findByText(expectedMsg)).toBeInTheDocument();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(expectedMsg);
      expect(registerUserMock).not.toHaveBeenCalled();
    });
  }, 10000);

  it("debe permitir la selección de un avatar", async () => {
    render(<RegisterForm />);

    const avatar2 = screen.getByRole("button", {
      name: /Seleccionar avatar Avatar 2/i,
    });

    fireEvent.click(avatar2);

    expect(avatar2).toHaveAttribute("aria-pressed", "true");
    expect(avatar2).toHaveStyle("border: 3px solid #FF7B00");
  }, 10000);

  it("debe procesar el registro con éxito y limpiar el formulario", async () => {
    const successMsg = "¡Registro completado!";
    registerUserMock.mockResolvedValueOnce({ message: successMsg });

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
      target: { value: "new@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir Contraseña/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    await waitFor(() => {
      expect(registerUserMock).toHaveBeenCalledWith({
        username: "newuser",
        email: "new@user.com",
        password: "StrongPass123!",
        profilePicture: "avatar1.png",
      });
    });

    expect(await screen.findByText(successMsg)).toBeInTheDocument();

    await waitFor(() => {
      expect(message.success).toHaveBeenCalledWith(successMsg);
      expect(screen.getByLabelText(/Nombre de Usuario/i)).toHaveValue("");
      expect(screen.getByLabelText(/Correo Electrónico/i)).toHaveValue("");
    });
  }, 10000);

  it("debe usar el mensaje específico en modo embedded", async () => {
    const embeddedMsg =
      "Cuenta creada correctamente. Cuando la verifiques por correo y luego inicies sesión, podrás guardar partidas en tu cuenta.";

    registerUserMock.mockResolvedValueOnce({ message: "Mensaje backend ignorado" });

    render(<RegisterForm embedded />);

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "newuser" },
    });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
      target: { value: "new@user.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir Contraseña/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    expect(await screen.findByText(embeddedMsg)).toBeInTheDocument();

    await waitFor(() => {
      expect(message.success).toHaveBeenCalledWith(embeddedMsg);
    });
  }, 10000);

  it("debe manejar errores del servidor correctamente", async () => {
    const errorMsg = "El correo ya está registrado";
    registerUserMock.mockRejectedValueOnce(new Error(errorMsg));

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "existing" },
    });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
      target: { value: "existing@mail.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "Pass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir Contraseña/i), {
      target: { value: "Pass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    expect(await screen.findByText(errorMsg)).toBeInTheDocument();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(errorMsg);
    });
  }, 10000);

  it("debe bloquear el registro si el username no cumple el formato", async () => {
    const errorMsg = "El nombre de usuario no cumple el formato";
    validateUsernameMock.mockReturnValueOnce(errorMsg);

    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText(/Nombre de Usuario/i), {
      target: { value: "bad user" },
    });
    fireEvent.change(screen.getByLabelText(/Correo Electrónico/i), {
      target: { value: "bad@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "StrongPass123!" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir Contraseña/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Registrarse/i }));

    expect(await screen.findByText(errorMsg)).toBeInTheDocument();

    await waitFor(() => {
      expect(message.error).toHaveBeenCalledWith(errorMsg);
      expect(registerUserMock).not.toHaveBeenCalled();
    });
  }, 10000);
});