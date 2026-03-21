import "@testing-library/jest-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppHeader from "../vistas/AppHeader";

const navigateMock = vi.fn();
const confirmMock = vi.fn();
const clearUserSessionMock = vi.fn();
const getUserSessionMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("../utils/session", () => ({
  clearUserSession: (...args: any[]) => clearUserSessionMock(...args),
  getUserSession: (...args: any[]) => getUserSessionMock(...args),
}));

vi.mock("antd", () => ({
    App: {
        useApp: () => ({
            modal: { confirm: confirmMock },
        }),
    },
    Button: ({ children, onClick, disabled, icon, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {icon}
            {children}
        </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Dropdown: ({ children, menu }: any) => (
        <div>
            <div>{children}</div>
            <div data-testid="dropdown-menu">
                {menu?.items?.map((item: any, index: number) => {
                    if (item.type === "divider") return null;
                    return (
                        <button
                            key={item.key || index}
                            type="button"
                            disabled={!!item.disabled}
                            onClick={() => !item.disabled && menu.onClick?.({ key: item.key })}
                        >
                            {item.label}
                        </button>
                    );
                })}
            </div>
        </div>
    ),
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
        Text: ({ children }: any) => <span>{children}</span>,
    },
}));

vi.mock("@ant-design/icons", () => ({
    HomeOutlined: () => null,
    LogoutOutlined: () => null,
    QuestionCircleOutlined: () => null,
    UserOutlined: () => null,
    TrophyOutlined: () => null,
    HistoryOutlined: () => null,
}));

describe("AppHeader", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renderiza el título y muestra Invitado cuando no hay sesión", () => {
        getUserSessionMock.mockReturnValue(null);

        render(<AppHeader title="Perfil" />);

        expect(screen.getByText("Perfil")).toBeInTheDocument();
        expect(screen.getByText("Invitado")).toBeInTheDocument();
    });

    it("muestra el username cuando hay sesión", () => {
        getUserSessionMock.mockReturnValue({
            username: "marcelo",
            profilePicture: "avatar.png",
        });

        render(<AppHeader title="YOVI" />);

        expect(screen.getByText("marcelo")).toBeInTheDocument();
    });

    it("deshabilita Mi Historial si no hay sesión", () => {
        getUserSessionMock.mockReturnValue(null);

        render(<AppHeader title="YOVI" />);

        expect(
            screen.getByRole("button", { name: "Mi Historial" }),
        ).toBeDisabled();
    });

    it("permite navegar a Mi Historial si hay sesión", async () => {
        getUserSessionMock.mockReturnValue({ username: "marcelo" });

        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Mi Historial" }));

        expect(navigateMock).toHaveBeenCalledWith("/historial");
    });

    it("navega a ranking y home", async () => {
        getUserSessionMock.mockReturnValue({ username: "marcelo" });

        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Ranking Global" }));
        await user.click(screen.getByRole("button", { name: "Volver a Home" }));

        expect(navigateMock).toHaveBeenCalledWith("/ranking");
        expect(navigateMock).toHaveBeenCalledWith("/home");
    });

    it("abre confirm al cerrar sesión", async () => {
        getUserSessionMock.mockReturnValue({ username: "marcelo" });

        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Cerrar Sesión" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];
        expect(args.title).toBe("Cerrar sesión");
        expect(args.content).toBe("¿Seguro que quieres cerrar sesión y salir?");
        expect(args.okText).toBe("Sí, salir");
        expect(args.cancelText).toBe("Cancelar");
    });

    it("al confirmar logout limpia sesión y navega al inicio", async () => {
        getUserSessionMock.mockReturnValue({ username: "marcelo" });

        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Cerrar Sesión" }));

        const args = confirmMock.mock.calls[0][0];
        await args.onOk();

        expect(clearUserSessionMock).toHaveBeenCalled();
        expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });

    it("las opciones no implementadas no navegan", async () => {
        getUserSessionMock.mockReturnValue({ username: "marcelo" });

        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Ver Perfil" }));
        await user.click(screen.getByRole("button", { name: "Ayuda" }));

        expect(navigateMock).not.toHaveBeenCalled();
        expect(confirmMock).not.toHaveBeenCalled();
    });
});