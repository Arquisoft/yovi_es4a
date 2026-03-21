import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterForm from "../vistas/registroLogin/RegisterForm.tsx"; // Ajusta la ruta si es necesario
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import "@testing-library/jest-dom";

vi.mock("../../utils/Validation", () => ({
  evaluatePasswordStrength: vi.fn((password: string) => {
    // Si la contraseña es "123456", simulamos que es débil
    if (password === "123456")
      return { label: "Baja", color: "#ff4d4f", width: "25%" };
    return { label: "Alta", color: "#52c41a", width: "100%" };
  }),
  // ... resto de mocks (validateUsername, etc.)
}));

// Mock de la API de mensajes de Ant Design para evitar warnings y rastrear llamadas
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

describe("RegisterForm Component", () => {
  beforeAll(() => {
    // Mock de matchMedia (Obligatorio para Ant Design)
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
    global.fetch = vi.fn();
  });

  it("debe renderizar todos los campos correctamente", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Nombre de Usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText(/Repetir Contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrarse/i }),
    ).toBeInTheDocument();
  });

  it("debe mostrar error si el nivel de seguridad de la contraseña es demasiado bajo", async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "testuser");
    await user.type(
      screen.getByLabelText(/Correo Electrónico/i),
      "test@test.com",
    );

    // 1. IMPORTANTE: Usa una contraseña que pase tu validación de formato
    // (por ejemplo, que tenga más de 6 caracteres si eso es lo que pide validatePassword)
    // pero que el mock de fuerza considere "Baja".
    const passDebil = "123456";

    await user.type(screen.getByLabelText("Contraseña"), passDebil);
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), passDebil);

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    // 2. Ajustamos el matcher para que sea más flexible por si AntD fragmenta el texto
    expect(
      await screen.findByText((content) =>
        content.includes("La seguridad de la contraseña es demasiado baja"),
      ),
    ).toBeInTheDocument();
  });

  it("debe permitir la selección de un avatar", async () => {
    render(<RegisterForm />);

    const avatar2 = screen.getByRole("button", {
      name: /Seleccionar avatar Avatar 2/i,
    });

    fireEvent.click(avatar2);

    // Verificamos el estilo de borde naranja (activo)
    expect(avatar2).toHaveStyle("border: 3px solid #FF7B00");
  });

  it("debe procesar el registro con éxito y limpiar el formulario", async () => {
    const successMsg = "¡Registro completado!";
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: successMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "newuser");
    await user.type(
      screen.getByLabelText(/Correo Electrónico/i),
      "new@user.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "StrongPass123!");
    await user.type(
      screen.getByLabelText(/Repetir Contraseña/i),
      "StrongPass123!",
    );

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    // Buscamos el mensaje de éxito en el componente Alert
    expect(await screen.findByText(successMsg)).toBeInTheDocument();

    // Verificamos que los campos se hayan limpiado
    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre de Usuario/i)).toHaveValue("");
    });
  });

  it("debe manejar errores del servidor correctamente", async () => {
    const errorMsg = "El correo ya está registrado";
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "existing");
    await user.type(
      screen.getByLabelText(/Correo Electrónico/i),
      "existing@mail.com",
    );
    await user.type(screen.getByLabelText("Contraseña"), "Pass123!");
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), "Pass123!");

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    // Verificamos que el error del backend se muestra en la Alert
    expect(await screen.findByText(errorMsg)).toBeInTheDocument();
  });
});
