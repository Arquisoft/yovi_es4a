import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Bienvenida from "../vistas/Bienvenida.tsx";

vi.mock("../assets/yovi-logo.svg", () => ({ default: "yovi-logo-mock.svg" }));

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual<any>("react-router-dom");
    return {
        ...actual,
        useNavigate: () => navigateMock,
    };
});

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
}));

describe("Bienvenida", () => {
    beforeEach(() => {
        navigateMock.mockReset();
    });

    it("renderiza logo, título y botones (2 disabled + 1 navegable)", () => {
        render(<Bienvenida />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://github.com/Arquisoft/yovi_es4a");

        expect(screen.getByAltText("Yovi logo")).toBeInTheDocument();

        expect(screen.getByText("Bienvenido a YOVI")).toBeInTheDocument();

        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Registrarse" })).toBeDisabled();

        expect(screen.getByRole("button", { name: "Continuar sin cuenta" })).toBeEnabled();
    });

    it("navega a /home al pulsar 'Continuar sin cuenta'", async () => {
        const user = userEvent.setup();
        render(<Bienvenida />);

        await user.click(screen.getByRole("button", { name: "Continuar sin cuenta" }));
        expect(navigateMock).toHaveBeenCalledWith("/home");
    });
});
