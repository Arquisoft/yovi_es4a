import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ChangeAvatarModal from "../vistas/ChangeAvatarModal";

describe("ChangeAvatarModal", () => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal(currentAvatar = "seniora.png") {
    return render(
      <App>
        <ChangeAvatarModal
          open={true}
          currentAvatar={currentAvatar}
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </App>
    );
  }

  it("renderiza el modal con los 4 avatares", () => {
    renderModal();

    expect(
      screen.getAllByText("Cambiar avatar").length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Selecciona tu nuevo avatar:")).toBeInTheDocument();

    // Los 4 avatares aparecen como imágenes (alt = label)
    expect(screen.getByAltText("Avatar 1")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar 2")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar 3")).toBeInTheDocument();
    expect(screen.getByAltText("Avatar 4")).toBeInTheDocument();
  });

  it("renderiza los botones de Aceptar y Cancelar", () => {
    renderModal();

    expect(
      screen.getByRole("button", { name: /Aceptar/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Cancelar/i })
    ).toBeInTheDocument();
  });

  it("llama a onClose sin llamar a onConfirm si se acepta sin cambiar avatar", async () => {
    const user = userEvent.setup();
    renderModal("seniora.png");

    // No cambiamos nada, el avatar seleccionado es el actual
    await user.click(screen.getByRole("button", { name: /Aceptar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("llama a onConfirm con el nuevo avatar al seleccionar uno diferente", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal("seniora.png");

    // Clic en Avatar 2 (disco.png)
    await user.click(screen.getByAltText("Avatar 2"));
    await user.click(screen.getByRole("button", { name: /Aceptar/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("disco.png");
    });
  });

  it("cierra el modal tras confirmar correctamente", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal("seniora.png");

    await user.click(screen.getByAltText("Avatar 3"));
    await user.click(screen.getByRole("button", { name: /Aceptar/i }));

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("muestra error del backend si onConfirm falla", async () => {
    onConfirm.mockRejectedValueOnce(new Error("Avatar no válido."));
    const user = userEvent.setup();
    renderModal("seniora.png");

    await user.click(screen.getByAltText("Avatar 4"));
    await user.click(screen.getByRole("button", { name: /Aceptar/i }));

    expect(await screen.findByText("Avatar no válido.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("llama a onClose al pulsar Cancelar", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: /Cancelar/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("permite seleccionar distintos avatares antes de confirmar", async () => {
    onConfirm.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderModal("seniora.png");

    // Seleccionamos Avatar 2, luego Avatar 4, confirmamos con el último
    await user.click(screen.getByAltText("Avatar 2"));
    await user.click(screen.getByAltText("Avatar 4"));
    await user.click(screen.getByRole("button", { name: /Aceptar/i }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith("elvis.png");
    });
  });
});