import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  beforeEach,
} from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "antd";
import ProfileModal from "../vistas/ProfileModal";

/* ------------------------------------------------------------------ */
/* ✅ Entorno necesario para Ant Design                                */
/* ------------------------------------------------------------------ */
beforeAll(() => {
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

  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

/* ------------------------------------------------------------------ */
/* ✅ Mocks de API                                                     */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/* ✅ Mock de sesión                                                   */
/* ------------------------------------------------------------------ */
vi.mock("../utils/session", () => ({
  getUserSession: () => ({
    username: "mario",
  }),
}));

/* ------------------------------------------------------------------ */
/* ✅ Mocks de modales hijos (SIN efectos en render)                   */
/* ------------------------------------------------------------------ */
vi.mock("../vistas/ChangePasswordModal", () => ({
  default: ({ open, onConfirm }: any) => {
    if (!open) return null;
    return (
      <button onClick={() => onConfirm("old-pass", "new-pass")}>
        __confirm_password__
      </button>
    );
  },
}));

vi.mock("../vistas/ChangeEmailModal", () => ({
  default: ({ open, onConfirm }: any) => {
    if (!open) return null;
    return (
      <button onClick={() => onConfirm("nuevo@mail.com")}>
        __confirm_email__
      </button>
    );
  },
}));

/* ------------------------------------------------------------------ */
/* ✅ Tests                                                           */
/* ------------------------------------------------------------------ */
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

    const changeButtons = await screen.findAllByText("Cambiar");
    await user.click(changeButtons[0]); // botón correo

    await user.click(
      await screen.findByText("__confirm_email__"),
    );

    expect(changeUserEmailMock).toHaveBeenCalledWith(
      "mario",
      "nuevo@mail.com",
    );

    // Se actualiza el correo mostrado
    expect(
      await screen.findByText("nuevo@mail.com"),
    ).toBeInTheDocument();
  });

  it("abre el modal de cambio de contraseña y ejecuta changePassword", async () => {
    const user = userEvent.setup();
    renderModal();

    const changeButtons = await screen.findAllByText("Cambiar");
    await user.click(changeButtons[1]); // botón contraseña

    await user.click(
      await screen.findByText("__confirm_password__"),
    );

    expect(changePasswordMock).toHaveBeenCalledWith(
      "mario",
      "old-pass",
      "new-pass",
    );
  });

  it("ejecuta logout al pulsar Cerrar sesión", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(
      await screen.findByRole("button", {
        name: /Cerrar sesión/i,
      }),
    );

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});