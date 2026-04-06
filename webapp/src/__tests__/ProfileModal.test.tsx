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
  changePassword: vi.fn().mockResolvedValue(undefined),
  changeUserEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/session", () => ({
  getUserSession: () => ({
    username: "mario",
  }),
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

    // Username aparece más de una vez → findAll
    const usernames = await screen.findAllByText("mario");
    expect(usernames.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("mario@mail.com")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("6")).toBeInTheDocument();
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  
    it("abre el modal de cambio de correo al pulsar Cambiar", async () => {
    const user = userEvent.setup();
    renderModal();

    const changeButtons = await screen.findAllByText("Cambiar");
    await user.click(changeButtons[0]); // botón de email

    // Elemento exclusivo del ChangeEmailModal
    expect(
        await screen.findByText("Correo actual"),
    ).toBeInTheDocument();
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