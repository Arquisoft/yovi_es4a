import Bienvenida from "../vistas/Bienvenida.tsx";
import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../assets/yovi-logo.svg", () => ({ default: "yovi-logo-mock.svg" }));

const navigateMock = vi.fn();
const clearUserSessionMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

vi.mock("../utils/session", () => ({
    clearUserSession: (...args: any[]) => clearUserSessionMock(...args),
}));

vi.mock("antd", () => ({
    Button: ({ children, disabled, onClick, ...props }: any) => (
        <button disabled={disabled} onClick={onClick} {...props}>
            {children}
        </button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
    },
    // Nuevos mocks para los componentes de layout y pestañas
    Grid: {
        useBreakpoint: () => ({ md: true }), 
    },
    Card: ({ children }: any) => <div>{children}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Tabs: ({ items }: any) => (
        <div>
            {items.map((item: any) => (
                <div key={item.key}>
                    <button role="tab">{item.label}</button>
                    <div>{item.children}</div>
                </div>
            ))}
        </div>
    )
}));

// Mockeamos los subcomponentes de las pestañas para no arrastrar toda su lógica a este test
vi.mock("../vistas/registroLogin/LoginForm", () => ({ default: () => <div>Login Mock</div> }));
vi.mock("../vistas/registroLogin/RegisterForm", () => ({ default: () => <div>Register Mock</div> }));

describe("Bienvenida", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        clearUserSessionMock.mockReset();
    });

    it("renderiza logo, título, enlace y las pestañas", () => {
        render(<Bienvenida />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://github.com/Arquisoft/yovi_es4a");

        expect(screen.getByAltText("Yovi logo")).toBeInTheDocument();
        expect(screen.getByText("Bienvenido a YOVI")).toBeInTheDocument();

        // Verificamos que las pestañas se renderizan correctamente
        expect(screen.getByRole("tab", { name: "Iniciar Sesión" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "Registrarse" })).toBeInTheDocument();
        
        expect(screen.getByRole("button", { name: "Continuar sin cuenta" })).toBeEnabled();
    });

    it("limpia la sesión al montar el componente", () => {
        render(<Bienvenida />);
        expect(clearUserSessionMock).toHaveBeenCalledTimes(1);
    });

    it("navega a /home al pulsar 'Continuar sin cuenta' y vuelve a limpiar la sesión", async () => {
        const user = userEvent.setup();
        render(<Bienvenida />);

        await user.click(screen.getByRole("button", { name: "Continuar sin cuenta" }));

        expect(clearUserSessionMock).toHaveBeenCalledTimes(2);
        expect(navigateMock).toHaveBeenCalledWith("/home", { replace: true });
    });
});