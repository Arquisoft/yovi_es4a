import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppHeader from "../vistas/AppHeader.tsx";
const navigateMock = vi.fn();
const confirmMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

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
                {/* Ignoramos los 'dividers' para que no rendericen botones vacíos */}
                {menu?.items?.map((item: any, index: number) => {
                    if (item.type === "divider") return null;
                    return (
                        <button
                            key={item.key || index}
                            type="button"
                            onClick={() => menu.onClick?.({ key: item.key })}
                        >
                            {item.label}
                        </button>
                    )
                })}
            </div>
        </div>
    ),
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
    },
}));

vi.mock("@ant-design/icons", () => ({
    BarChartOutlined: () => null,
    HomeOutlined: () => null,
    LogoutOutlined: () => null,
    QuestionCircleOutlined: () => null,
    UserOutlined: () => null,
    TrophyOutlined: () => null, 
}));

describe("AppHeader", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
    });

    it("renderiza el título recibido por props", () => {
        render(<AppHeader title="Perfil" />);
        expect(screen.getByText("Perfil")).toBeInTheDocument();
    });

    it("renderiza todas las opciones del dropdown incluyendo el Ranking", () => {
        render(<AppHeader title="YOVI" />);

        expect(screen.getByRole("button", { name: "Ver Perfil" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ver Estadísticas" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ranking Global" })).toBeInTheDocument(); 
        expect(screen.getByRole("button", { name: "Volver a Home" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Ayuda" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cerrar Sesión" })).toBeInTheDocument();
    });

    it("al pulsar 'Ranking Global' navega a '/ranking'", async () => {
        const user = userEvent.setup();
        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Ranking Global" }));

        // Comprobamos que el botón del ranking llama a navigate correctamente
        expect(navigateMock).toHaveBeenCalledWith("/ranking");
    });

    it("al pulsar 'Cerrar Sesión' del menú abre modal.confirm", async () => {
        const user = userEvent.setup();

        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Cerrar Sesión" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);

        const args = confirmMock.mock.calls[0][0];
        expect(args.title).toBe("Cerrar sesión");
        expect(args.okText).toBe("Sí, salir");
        expect(args.cancelText).toBe("Cancelar");
    });

    it("al confirmar el logout navega a '/' con replace", async () => {
        const user = userEvent.setup();

        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Cerrar Sesión" }));

        const args = confirmMock.mock.calls[0][0];
        args.onOk();

        expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });

    it("al pulsar las opciones no implementadas no navega ni rompe el componente", async () => {
        const user = userEvent.setup();

        render(<AppHeader title="YOVI" />);

        await user.click(screen.getByRole("button", { name: "Ver Perfil" }));
        await user.click(screen.getByRole("button", { name: "Ver Estadísticas" }));
        await user.click(screen.getByRole("button", { name: "Volver a Home" }));
        await user.click(screen.getByRole("button", { name: "Ayuda" }));

        expect(navigateMock).not.toHaveBeenCalled();
        expect(confirmMock).not.toHaveBeenCalled();
    });
});