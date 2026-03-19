import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterForm from "../vistas/registroLogin/RegisterForm.tsx";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import "@testing-library/jest-dom";

// Mock de react-router-dom para evitar errores de hooks (useRef, useContext) en el entorno de test
vi.mock("react-router-dom", () => ({
  // Sustituimos Link por un componente simple que no use hooks
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock de las utilidades de validación y constantes
vi.mock("../utils/Validation", () => ({
  evaluatePasswordStrength: vi.fn((password: string) => {
    if (password === "weak")
      return { label: "Baja", color: "#ff4d4f", width: "25%" };
    return { label: "Alta", color: "#52c41a", width: "100%" };
  }),
  AVATARS: [
    { id: "av1", src: "av1.png", label: "Avatar 1" },
    { id: "av2", src: "av2.png", label: "Avatar 2" },
  ],
}));

describe("RegisterForm Component", () => {
  beforeAll(() => {
    // IMPORTANTE: Mock de window.matchMedia requerido por Ant Design en entornos JSDOM
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // obsoleto pero usado por algunas librerías
        removeListener: vi.fn(), // obsoleto
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Limpiamos el mock global de fetch
    global.fetch = vi.fn();
  });

  it("debe renderizar todos los campos correctamente con sus labels e IDs", () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText(/Nombre de Usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument();
    // Ant Design genera automáticamente el ID combinando formName y itemName: register_form_password
    expect(
      screen.getByLabelText("Contraseña", {
        selector: "input#register_form_password",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Repetir Contraseña/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Registrarse/i }),
    ).toBeInTheDocument();
  });

  // Añadimos un timeout de 10000ms a los tests que usqan userEvent.type con muchos caracteres
  // ya que Ant Design renderiza validaciones en cada pulsación y JSDOM es lento.
  it("debe mostrar un mensaje de error si las contraseñas no coinciden al enviar", async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();

    // Usamos textos más cortos para no sobrecargar el entorno de testing
    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "user");
    await user.type(screen.getByLabelText(/Correo Electrónico/i), "a@a.com");
    await user.type(
      screen.getByLabelText("Contraseña", {
        selector: "input#register_form_password",
      }),
      "Pass123!",
    );
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), "Fail123!");

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    // Usamos findByText en lugar de waitFor + getByText.
    // Es más rápido, directo y evita saturar la CPU provocando "Timeouts"
    expect(
      await screen.findByText(/Las contraseñas no coinciden/i),
    ).toBeInTheDocument();
  }, 10000); // <-- Timeout ampliado

  it("debe mostrar error si el nivel de seguridad de la contraseña es demasiado bajo", async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();

    // Completamos todos los campos requeridos para evitar bloqueos
    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "user");
    await user.type(screen.getByLabelText(/Correo Electrónico/i), "a@a.com");

    // El mock de Validation devolverá 'Baja' para este input
    await user.type(
      screen.getByLabelText("Contraseña", {
        selector: "input#register_form_password",
      }),
      "weak",
    );
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), "weak"); // Ahora sí coinciden y el onChange lo actualiza

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    expect(
      await screen.findByText(
        /La seguridad de la contraseña es demasiado baja para registrarse./i,
      ),
    ).toBeInTheDocument();
  }, 10000); // <-- Timeout ampliado

  it("debe permitir la selección de un avatar diferente", async () => {
    render(<RegisterForm />);

    // Obtenemos específicamente los botones de los avatares por su aria-label
    // Esto evita seleccionar los botones de "mostrar/ocultar contraseña" de Ant Design
    const avatar1 = screen.getByRole("button", {
      name: "Seleccionar avatar Avatar 1",
    });
    const avatar2 = screen.getByRole("button", {
      name: "Seleccionar avatar Avatar 2",
    });

    // comprobación de selección de avatar
    fireEvent.click(avatar2);

    expect(avatar2).toHaveStyle("border: 3px solid #FF7B00");
    expect(avatar1).toHaveStyle("border: 3px solid transparent");
  });

  it("debe procesar el registro con éxito cuando los datos son válidos", async () => {
    const successMsg = "¡Cuenta creada con éxito!";
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: successMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "user");
    await user.type(screen.getByLabelText(/Correo Electrónico/i), "a@a.com");
    await user.type(
      screen.getByLabelText("Contraseña", {
        selector: "input#register_form_password",
      }),
      "Segura123!",
    );
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), "Segura123!");

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    // Verificamos el mensaje de éxito del JSON
    expect(await screen.findByText(successMsg)).toBeInTheDocument();

    // Verificamos limpieza de campos con un waitFor, ya que resetFields de AntD puede tardar un milisegundo extra
    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre de Usuario/i)).toHaveValue("");
    });
  }, 10000); // <-- Timeout ampliado

  it("debe manejar errores devueltos por el microservicio", async () => {
    const errorMsg = "El nombre de usuario ya existe";
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), "user");
    await user.type(screen.getByLabelText(/Correo Electrónico/i), "a@a.com");
    await user.type(
      screen.getByLabelText("Contraseña", {
        selector: "input#register_form_password",
      }),
      "Pass123!",
    );
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), "Pass123!");

    await user.click(screen.getByRole("button", { name: /Registrarse/i }));

    expect(await screen.findByText(errorMsg)).toBeInTheDocument();
  }, 10000); // <-- Timeout ampliado
});
