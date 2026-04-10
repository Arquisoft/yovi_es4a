import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ProfileModal from "../vistas/ProfileModal";

beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const changePasswordMock = vi.fn().mockResolvedValue(undefined);
const changeUsernameMock = vi.fn().mockResolvedValue(undefined);
const changeAvatarMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../api/users", () => ({
  getUserProfile: vi.fn().mockResolvedValue({
    username: "mario",
    email: "mario@mail.com",
    profilePicture: "seniora.png",
  }),
  getUserStats: vi.fn().mockResolvedValue({
    stats: {
      gamesPlayed: 10,
      gamesWon: 6,
      winRate: 60,
    },
  }),
  changePassword: (...args: any[]) => changePasswordMock(...args),
  changeUsername: (...args: any[]) => changeUsernameMock(...args),
  changeAvatar: (...args: any[]) => changeAvatarMock(...args),
}));

vi.mock("../utils/session", () => ({
  getUserSession: () => ({ username: "mario", profilePicture: "seniora.png" }),
  saveUserSession: vi.fn(),
}));

vi.mock("../vistas/ChangePasswordModal", () => ({
  default: ({ open, onConfirm, onClose }: any) => {
    if (!open) return null;
    return (
      <>
        <button
          onClick={async () => {
            try {
              await onConfirm("old-pass", "new-pass");
            } catch {}
          }}
        >
          __confirm_password__
        </button>
        <button onClick={onClose}>__close_password__</button>
      </>
    );
  },
}));

vi.mock("../vistas/ChangeUsernameModal", () => ({
  default: ({ open, onConfirm, onClose }: any) => {
    if (!open) return null;
    return (
      <>
        <button
          onClick={async () => {
            try {
              await onConfirm("nuevo_usuario");
            } catch {}
          }}
        >
          __confirm_username__
        </button>
        <button onClick={onClose}>__close_username__</button>
      </>
    );
  },
}));

vi.mock("../vistas/ChangeAvatarModal", () => ({
  default: ({ open, onConfirm, onClose }: any) => {
    if (!open) return null;
    return (
      <>
        <button
          onClick={async () => {
            try {
              await onConfirm("disco.png");
            } catch {}
          }}
        >
          __confirm_avatar__
        </button>
        <button onClick={onClose}>__close_avatar__</button>
      </>
    );
  },
}));

describe("ProfileModal", () => {
  const onClose = vi.fn();
  const onLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderModal() {
    return render(
      <App>
        <ProfileModal open={true} onClose={onClose} onLogout={onLogout} />
      </App>,
    );
  }

  it("carga y muestra los datos del usuario", async () => {
    renderModal();

    const usernames = await screen.findAllByText("mario");
    expect(usernames.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("mario@mail.com")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("muestra el correo en modo solo lectura (sin botón Cambiar junto a él)", async () => {
    renderModal();

    expect(await screen.findByText("mario@mail.com")).toBeInTheDocument();
    // Solo deben existir dos botones "Cambiar": username y contraseña
    const cambiarButtons = await screen.findAllByText("Cambiar");
    expect(cambiarButtons).toHaveLength(2);
  });

  it("abre el modal de cambio de nombre de usuario y ejecuta changeUsername", async () => {
    const user = userEvent.setup();
    renderModal();

    // El primer "Cambiar" corresponde al nombre de usuario
    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__confirm_username__"));

    expect(changeUsernameMock).toHaveBeenCalledWith("mario", "nuevo_usuario");
  });

  it("cierra el modal de cambio de nombre de usuario", async () => {
    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__close_username__"));

    expect(screen.queryByText("__confirm_username__")).not.toBeInTheDocument();
  });

  it("abre el modal de cambio de contraseña y ejecuta changePassword", async () => {
    const user = userEvent.setup();
    renderModal();

    // El segundo "Cambiar" corresponde a la contraseña
    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[1]);

    await user.click(await screen.findByText("__confirm_password__"));

    expect(changePasswordMock).toHaveBeenCalledWith(
      "mario",
      "old-pass",
      "new-pass",
    );
  });

  it("cierra el modal de cambio de contraseña", async () => {
    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[1]);

    await user.click(await screen.findByText("__close_password__"));

    expect(screen.queryByText("__confirm_password__")).not.toBeInTheDocument();
  });

  it("ejecuta la rama de error al fallar changePassword", async () => {
    changePasswordMock.mockRejectedValueOnce(new Error("Password incorrecto"));

    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[1]);

    await user.click(await screen.findByText("__confirm_password__"));

    expect(changePasswordMock).toHaveBeenCalled();
  });

  it("ejecuta la rama de error al fallar changeUsername", async () => {
    changeUsernameMock.mockRejectedValueOnce(new Error("Usuario ya en uso"));

    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__confirm_username__"));

    expect(changeUsernameMock).toHaveBeenCalled();
  });

  it("ejecuta logout al pulsar Cerrar sesión", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      await screen.findByRole("button", { name: /Cerrar sesión/i }),
    );

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});