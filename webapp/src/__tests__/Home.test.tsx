import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Home from "../vistas/Home.tsx";

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
    Button: ({ children, onClick, ...props }: any) => (
        <button onClick={onClick} {...props}>
            {children}
        </button>
    ),
    Card: ({ children }: any) => <div data-testid="card">{children}</div>,
    Divider: ({ children }: any) => <div>{children}</div>,
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
        Text: ({ children }: any) => <span>{children}</span>,
    },
    InputNumber: ({ value, onChange, min }: any) => (
        <div>
            <input
                aria-label="size-input"
                type="number"
                min={min}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
            />
            <button type="button" onClick={() => onChange(null)} aria-label="size-non-number">
                non-number
            </button>
        </div>
    ),
    Select: ({ value, onChange, options }: any) => (
        <select
            aria-label="bot-select"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        >
            {options?.map((o: any) => (
                <option key={o.value} value={o.value}>
                    {o.label}
                </option>
            ))}
        </select>
    ),
}));

vi.mock("@ant-design/icons", () => ({
    LogoutOutlined: () => null,
    PlayCircleOutlined: () => null,
    RobotOutlined: () => null,
    UserOutlined: () => null,
}));

describe("Home", () => {
    beforeEach(() => {
        navigateMock.mockReset();
        confirmMock.mockReset();
    });

    it("renderiza con valores por defecto y navega a /game con query al pulsar Jugar", async () => {
        const user = userEvent.setup();
        render(<Home />);

        const sizeInput = screen.getByLabelText("size-input") as HTMLInputElement;
        const botSelect = screen.getByLabelText("bot-select") as HTMLSelectElement;

        expect(sizeInput.value).toBe("7");
        expect(botSelect.value).toBe("random_bot");

        await user.clear(sizeInput);
        await user.type(sizeInput, "5");
        await user.selectOptions(botSelect, "mcts_bot");

        expect(sizeInput.value).toBe("5");
        expect(botSelect.value).toBe("mcts_bot");

        await user.click(screen.getByRole("button", { name: "Jugar" }));

        expect(navigateMock).toHaveBeenCalledTimes(1);
        expect(String(navigateMock.mock.calls[0][0])).toBe("/game?size=5&bot=mcts_bot");
    });

    it("al pulsar 'Cerrar sesión' abre modal.confirm y al confirmar navega a '/' replace", async () => {
        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));

        expect(confirmMock).toHaveBeenCalledTimes(1);
        const args = confirmMock.mock.calls[0][0];

        expect(args.title).toBe("Cerrar sesión");
        expect(args.okText).toBe("Sí, salir");
        expect(args.cancelText).toBe("Cancelar");

        args.onOk();
        expect(navigateMock).toHaveBeenCalledWith("/", { replace: true });
    });

    it("si InputNumber onChange recibe un valor no numérico, vuelve a size=7", async () => {
        const user = userEvent.setup();
        render(<Home />);

        await user.click(screen.getByLabelText("size-non-number"));

        await user.click(screen.getByRole("button", { name: "Jugar" }));

        expect(String(navigateMock.mock.calls[0][0])).toContain("size=7");
    });
});