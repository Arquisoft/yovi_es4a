import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginForm from "../vistas/registroLogin/LoginForm"; // Ajusta esta ruta según tu estructura
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import "@testing-library/jest-dom";

// 1. Mock de react-router-dom para espiar la función navigate()
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// 2. Mock de los mensajes de Ant Design para evitar errores de renderizado y poder afirmar llamadas
vi.mock("antd", async () => {
  const actual = await vi.importActual("antd");
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

describe("LoginForm Component", () => {
  beforeAll(() => {
    // Mock obligatorio de window.matchMedia para Ant Design
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
    // Limpiamos todos los mocks antes de cada test para evitar contaminación
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear(); // Limpiamos el Storage
  });

  it("debe renderizar correctamente los campos y el botón", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/Nombre de usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Recordarme/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Iniciar Sesión/i }),
    ).toBeInTheDocument();
  });

  it("debe mostrar errores de validación si se intenta enviar vacío", async () => {
    render(<LoginForm />);
    const user = userEvent.setup();

    // Hacemos click en enviar sin rellenar nada
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    // Esperamos a que Ant Design muestre los mensajes requeridos
    expect(
      await screen.findByText(/Por favor, ingresa tu usuario./i),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/Por favor, ingresa tu contraseña./i),
    ).toBeInTheDocument();

    // Asegurarnos de que NO se llamó a la API
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debe iniciar sesión con éxito, guardar en localStorage y redirigir", async () => {
    // 1. Preparamos el mock de la respuesta exitosa
    const mockResponseData = {
      message: "Login exitoso",
      username: "testuser",
      profilePicture: "avatar1.png",
    };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponseData,
    });

    // 2. Espiamos el localStorage
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    render(<LoginForm />);
    const user = userEvent.setup();

    // 3. Rellenamos el formulario
    await user.type(screen.getByLabelText(/Nombre de usuario/i), "testuser");
    await user.type(screen.getByLabelText(/Contraseña/i), "Password123!");

    // 4. Enviamos el formulario
    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    // 5. Afirmaciones
    await waitFor(() => {
      // Verifica que fetch fue llamado con los datos correctos
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/login"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            username: "testuser",
            password: "Password123!",
          }),
        }),
      );

      // Verifica que los datos se guardaron en el localStorage
      expect(setItemSpy).toHaveBeenCalledWith(
        "userSession",
        JSON.stringify({
          username: "testuser",
          profilePicture: "avatar1.png",
        }),
      );

      // Verifica que se ejecutó la redirección a /home
      expect(mockNavigate).toHaveBeenCalledWith("/home");
    });
  });

  it("debe manejar un error del servidor correctamente y mostrar un mensaje", async () => {
    // Importamos dinámicamente el message para comprobar sus llamadas
    const { message } = await import("antd");

    // Preparamos el mock para un error 401/400
    const errorMsg = "Credenciales incorrectas";
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMsg }),
    });

    render(<LoginForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de usuario/i), "wronguser");
    await user.type(screen.getByLabelText(/Contraseña/i), "wrongpass");

    await user.click(screen.getByRole("button", { name: /Iniciar Sesión/i }));

    await waitFor(() => {
      // Verifica que no se navegó a ninguna parte
      expect(mockNavigate).not.toHaveBeenCalled();

      // Verifica que no se guardó nada en localStorage
      expect(localStorage.getItem("userSession")).toBeNull();

      // Verifica que se llamó al pop-up de error de Ant Design con el mensaje del servidor
      expect(message.error).toHaveBeenCalledWith(errorMsg);
    });
  });
});
