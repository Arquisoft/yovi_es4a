import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ChangeUsernameModal from "../vistas/ChangeUsernameModal";

describe("ChangeUsernameModal", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal() {
    return render(
      <App>
        <ChangeUsernameModal
          open={true}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </App>
    );
  }

  it("renderiza el modal con sus elementos principales", () => {
    renderModal();

    expect(
      screen.getAllByText("Cambiar nombre de usuario").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Nuevo nombre de usuario")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cambiar nombre/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancelar/i })
    ).toBeInTheDocument();
  });

  it("el botón de confirmar está deshabilitado si el campo está vacío", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: /Cambiar nombre/i })
    ).toBeDisabled();
  });

  it("el botón de confirmar está deshabilitado si el username es inválido (menos de 3 caracteres)", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "ab"
    );

    expect(
      screen.getByRole("button", { name: /Cambiar nombre/i })
    ).toBeDisabled();
  });

  it("el botón de confirmar está deshabilitado si el username tiene caracteres inválidos", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "usuario con espacios"
    );

    expect(
      screen.getByRole("button", { name: /Cambiar nombre/i })
    ).toBeDisabled();
  });

  it("el botón de confirmar se habilita con un username válido", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "nuevo_usuario"
    );

    expect(
      screen.getByRole("button", { name: /Cambiar nombre/i })
    ).toBeEnabled();
  });

  it("llama a onConfirm con el nuevo username cuando el formulario es válido", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "nuevo_usuario"
    );
    await user.click(screen.getByRole("button", { name: /Cambiar nombre/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("nuevo_usuario");
    });
  });

  it("cierra el modal tras confirmar correctamente", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "nuevo_usuario"
    );
    await user.click(screen.getByRole("button", { name: /Cambiar nombre/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("muestra error del backend si onConfirm falla", async () => {
    onConfirm.mockRejectedValueOnce(new Error("Ese nombre de usuario ya está en uso."));
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce el nuevo nombre de usuario"),
      "ocupado"
    );
    await user.click(screen.getByRole("button", { name: /Cambiar nombre/i }));

    expect(
      await screen.findByText("Ese nombre de usuario ya está en uso.")
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("llama a onClose al pulsar Cancelar", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("permite confirmar pulsando Enter con un username válido", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal();

    const input = screen.getByPlaceholderText(
      "Introduce el nuevo nombre de usuario"
    );
    await user.type(input, "nuevo_usuario{Enter}");

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("nuevo_usuario");
    });
  });
});