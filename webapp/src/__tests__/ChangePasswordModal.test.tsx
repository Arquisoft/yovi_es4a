import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";

// ---------- Tests ChangeEmailModal ----------
import ChangeEmailModal from "../vistas/ChangeEmailModal";

describe("ChangeEmailModal", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderEmailModal() {
    return render(
      <App>
        <ChangeEmailModal
          open={true}
          currentEmail="old@mail.com"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </App>
    );
  }

  it("renderiza el modal con sus campos principales", () => {
    renderEmailModal();

    expect(screen.getAllByText("Cambiar correo").length).toBeGreaterThan(0);
    expect(screen.getByText("Correo actual")).toBeInTheDocument();
    expect(screen.getByText("old@mail.com")).toBeInTheDocument();
    expect(screen.getByText("Nuevo correo")).toBeInTheDocument();
    expect(screen.getByText("Confirmar correo")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /Cambiar correo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeInTheDocument();
  });

  it("deshabilita el botón si el correo es inválido", async () => {
    const user = userEvent.setup();
    renderEmailModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");
    await user.type(inputs[0], "correo-invalido");
    await user.type(inputs[1], "correo-invalido");

    const submitButton = screen.getByRole("button", { name: /Cambiar correo/i });
    expect(submitButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("llama a onConfirm con un email válido", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderEmailModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");
    await user.type(inputs[0], "new@mail.com");
    await user.type(inputs[1], "new@mail.com");

    await user.click(screen.getByRole("button", { name: /Cambiar correo/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("new@mail.com");
    });
  });

  it("muestra un mensaje de error si el backend falla", async () => {
    onConfirm.mockRejectedValueOnce(new Error("Email ya existe"));
    const user = userEvent.setup();
    renderEmailModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");
    await user.type(inputs[0], "new@mail.com");
    await user.type(inputs[1], "new@mail.com");

    await user.click(screen.getByRole("button", { name: /Cambiar correo/i }));
    expect(await screen.findByText("Email ya existe")).toBeInTheDocument();
  });
});

// ---------- Tests ChangePasswordModal ----------
import ChangePasswordModal from "../vistas/ChangePasswordModal";

vi.mock("../utils/Validation", () => ({
  validatePassword: vi.fn((pw) => (pw === "inválida" ? "Contraseña inválida" : "")),
  validateConfirmPassword: vi.fn((pw, cpw) => (pw !== cpw ? "No coinciden" : "")),
  evaluatePasswordStrength: vi.fn((pw) =>
    pw === "débil"
      ? { label: "Baja", color: "red", width: "33%" }
      : { label: "Alta", color: "green", width: "100%" }
  ),
}));

describe("ChangePasswordModal - Validación de formulario", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderPasswordModal() {
    return render(
      <App>
        <ChangePasswordModal open={true} onClose={onClose} onConfirm={onConfirm} />
      </App>
    );
  }

  it("deshabilita el botón si la contraseña actual está vacía", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "Nueva123!");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "Nueva123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si la nueva contraseña está vacía", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "Nueva123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si confirmar contraseña está vacía", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "Nueva123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si la nueva contraseña es inválida", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "inválida");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "inválida");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si las contraseñas no coinciden", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "Nueva123!");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "Otra123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si la nueva contraseña es débil", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "débil");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "débil");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("deshabilita el botón si la nueva contraseña es igual a la actual", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "Old123!");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "Old123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeDisabled();
  });

  it("habilita el botón si todos los campos son válidos", async () => {
    const user = userEvent.setup();
    renderPasswordModal();

    await user.type(screen.getByPlaceholderText("Introduce tu contraseña actual"), "Old123!");
    await user.type(screen.getByPlaceholderText("Introduce la nueva contraseña"), "Nueva123!");
    await user.type(screen.getByPlaceholderText("Repite la nueva contraseña"), "Nueva123!");

    const button = screen.getByRole("button", { name: /Cambiar contraseña/i });
    expect(button).toBeEnabled();
  });
});