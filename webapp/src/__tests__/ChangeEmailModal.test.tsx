import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ChangeEmailModal from "../vistas/ChangeEmailModal";

describe("ChangeEmailModal", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal() {
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
    renderModal();

    // título (hay dos "Cambiar correo", comprobamos que existe alguno)
    expect(
      screen.getAllByText("Cambiar correo").length,
    ).toBeGreaterThan(0);

    expect(screen.getByText("Correo actual")).toBeInTheDocument();
    expect(screen.getByText("old@mail.com")).toBeInTheDocument();
    expect(screen.getByText("Nuevo correo")).toBeInTheDocument();
    expect(screen.getByText("Confirmar correo")).toBeInTheDocument();

    // botones (por rol, nunca por texto suelto)
    expect(
      screen.getByRole("button", { name: /Cambiar correo/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancelar/i }),
    ).toBeInTheDocument();
  });

  it("deshabilita el botón si el correo es inválido", async () => {
    const user = userEvent.setup();
    renderModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");

    await user.type(inputs[0], "correo-invalido");
    await user.type(inputs[1], "correo-invalido");

    const submitButton = screen.getByRole("button", {
      name: /Cambiar correo/i,
    });

    expect(submitButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("llama a onConfirm con un email válido", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");

    await user.type(inputs[0], "new@mail.com");
    await user.type(inputs[1], "new@mail.com");

    await user.click(
      screen.getByRole("button", { name: /Cambiar correo/i }),
    );

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("new@mail.com");
    });
  });

  it("muestra un mensaje de error si el backend falla", async () => {
    onConfirm.mockRejectedValueOnce(new Error("Email ya existe"));
    const user = userEvent.setup();
    renderModal();

    const inputs = screen.getAllByPlaceholderText("nuevo@correo.com");

    await user.type(inputs[0], "new@mail.com");
    await user.type(inputs[1], "new@mail.com");

    await user.click(
      screen.getByRole("button", { name: /Cambiar correo/i }),
    );

    expect(
      await screen.findByText("Email ya existe"),
    ).toBeInTheDocument();
  });
});