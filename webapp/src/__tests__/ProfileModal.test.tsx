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
const changeUserEmailMock = vi.fn().mockResolvedValue(undefined);

vi.mock("../api/users", () => ({
  getUserProfile: vi.fn().mockResolvedValue({
    username: "mario",
    email: "mario@mail.com",
  }),
  getUserStats: vi.fn().mockResolvedValue({
    stats: {
      gamesPlayed: 10,
      gamesWon: 6,
      winRate: 60,
    },
  }),
  changePassword: (...args: any[]) => changePasswordMock(...args),
  changeUserEmail: (...args: any[]) => changeUserEmailMock(...args),
}));

vi.mock("../utils/session", () => ({
  getUserSession: () => ({ username: "mario" }),
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

vi.mock("../vistas/ChangeEmailModal", () => ({
  default: ({ open, onConfirm, onClose }: any) => {
    if (!open) return null;
    return (
      <>
        <button
          onClick={async () => {
            try {
              await onConfirm("nuevo@mail.com");
            } catch {}
          }}
        >
          __confirm_email__
        </button>
        <button onClick={onClose}>__close_email__</button>
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

  it("abre el modal de cambio de correo y ejecuta changeUserEmail", async () => {
    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__confirm_email__"));

    expect(changeUserEmailMock).toHaveBeenCalledWith(
      "mario",
      "nuevo@mail.com",
    );
    expect(await screen.findByText("nuevo@mail.com")).toBeInTheDocument();
  });

  it("cierra el modal de cambio de correo", async () => {
    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__close_email__"));

    expect(
      screen.queryByText("__confirm_email__"),
    ).not.toBeInTheDocument();
  });

  it("abre el modal de cambio de contraseña y ejecuta changePassword", async () => {
    const user = userEvent.setup();
    renderModal();

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

    expect(
      screen.queryByText("__confirm_password__"),
    ).not.toBeInTheDocument();
  });

  it("ejecuta la rama de error al fallar changePassword", async () => {
    changePasswordMock.mockRejectedValueOnce(
      new Error("Password incorrecto"),
    );

    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[1]);

    await user.click(await screen.findByText("__confirm_password__"));

    expect(changePasswordMock).toHaveBeenCalled();
  });

  it("ejecuta la rama de error al fallar changeUserEmail", async () => {
    changeUserEmailMock.mockRejectedValueOnce(
      new Error("Email inválido"),
    );

    const user = userEvent.setup();
    renderModal();

    const buttons = await screen.findAllByText("Cambiar");
    await user.click(buttons[0]);

    await user.click(await screen.findByText("__confirm_email__"));

    expect(changeUserEmailMock).toHaveBeenCalled();
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