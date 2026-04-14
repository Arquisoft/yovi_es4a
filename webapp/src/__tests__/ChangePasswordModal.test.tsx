import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ChangePasswordModal from "../vistas/ChangePasswordModal";

describe("ChangePasswordModal", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal() {
    return render(
      <App>
        <ChangePasswordModal
          open={true}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </App>
    );
  }

  it("renderiza todos los campos principales", () => {
    renderModal();

    expect(
      screen.getAllByText("Cambiar contraseña").length,
    ).toBeGreaterThan(0);

    expect(
      screen.getByPlaceholderText("Introduce tu contraseña actual"),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Introduce la nueva contraseña"),
    ).toBeInTheDocument();

    expect(
      screen.getByPlaceholderText("Repite la nueva contraseña"),
    ).toBeInTheDocument();
  });

  it("deshabilita el botón si las contraseñas no coinciden", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce tu contraseña actual"),
      "OldPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Introduce la nueva contraseña"),
      "NewPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Repite la nueva contraseña"),
      "OtraPass123!",
    );

    const submitButton = screen.getByRole("button", {
      name: /Cambiar contraseña/i,
    });

    expect(submitButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("llama a onConfirm si el formulario es válido", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce tu contraseña actual"),
      "OldPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Introduce la nueva contraseña"),
      "StrongPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Repite la nueva contraseña"),
      "StrongPass123!",
    );

    await user.click(
      screen.getByRole("button", { name: /Cambiar contraseña/i }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(
        "OldPass123!",
        "StrongPass123!",
      );
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("muestra error si el backend falla", async () => {
    onConfirm.mockRejectedValueOnce(
      new Error("Contraseña actual incorrecta"),
    );
    const user = userEvent.setup();
    renderModal();

    await user.type(
      screen.getByPlaceholderText("Introduce tu contraseña actual"),
      "BadPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Introduce la nueva contraseña"),
      "StrongPass123!",
    );
    await user.type(
      screen.getByPlaceholderText("Repite la nueva contraseña"),
      "StrongPass123!",
    );

    await user.click(
      screen.getByRole("button", { name: /Cambiar contraseña/i }),
    );

    expect(
      await screen.findByText("Contraseña actual incorrecta"),
    ).toBeInTheDocument();
  });
});