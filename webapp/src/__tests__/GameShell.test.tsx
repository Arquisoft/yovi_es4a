import "@testing-library/jest-dom";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GameShell from "../game/GameShell";

vi.mock("antd", () => {
    const EmptyComp = ({ description, image, imageStyle }: any) => (
        <div>
            <div>{description}</div>
            <div data-testid="empty-image">{String(image)}</div>
            <div data-testid="empty-image-style">{JSON.stringify(imageStyle)}</div>
        </div>
    );
    (EmptyComp as any).PRESENTED_IMAGE_DEFAULT = "default-empty";

    return {
        Alert: ({ message, type, showIcon }: any) => (
            <div role="alert">
                {message} | {type} | {String(showIcon)}
            </div>
        ),
        Button: ({ children, onClick, disabled, danger }: any) => (
            <button onClick={onClick} disabled={disabled} data-danger={String(!!danger)}>
                {children}
            </button>
        ),
        Card: ({ children }: any) => <div data-testid="card">{children}</div>,
        Empty: EmptyComp,
        Flex: ({ children, style }: any) => (
            <div data-testid="flex" data-style={JSON.stringify(style ?? {})}>
                {children}
            </div>
        ),
        Space: ({ children, style }: any) => (
            <div data-testid="space" data-style={JSON.stringify(style ?? {})}>
                {children}
            </div>
        ),
        Typography: {
            Title: ({ children }: any) => <div>{children}</div>,
            Text: ({ children }: any) => <div>{children}</div>,
        },
    };
});

describe("GameShell", () => {
    const baseProps = {
        title: "Mi partida",
        subtitle: "Subtítulo",
        loading: false,
        error: "",
        hasBoard: true,
        emptyText: "No hay partida",
        onAbandon: vi.fn(),
        abandonDisabled: false,
        turnIndicator: <div>TURN INDICATOR</div>,
        board: <div>BOARD CONTENT</div>,
        result: <div>RESULT CONTENT</div>,
    };

    it("renderiza título, subtítulo y botón Abandonar", () => {
        render(<GameShell {...baseProps} />);

        expect(screen.getByText("Mi partida")).toBeInTheDocument();
        expect(screen.getByText("Subtítulo")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Abandonar" })).toBeInTheDocument();
    });

    it("aplica el padding responsivo y minHeight al contenedor principal", () => {
        render(<GameShell {...baseProps} />);

        const flexs = screen.getAllByTestId("flex");
        expect(flexs[0]).toHaveAttribute(
            "data-style",
            JSON.stringify({
                padding: "clamp(10px, 3vw, 20px)",
                minHeight: "100vh",
            }),
        );
    });

    it("mantiene el ancho máximo del contenido principal", () => {
        render(<GameShell {...baseProps} />);

        expect(screen.getByText("Mi partida").parentElement?.parentElement).toBeInTheDocument();
    });

    it("ejecuta onAbandon al pulsar Abandonar", async () => {
        const user = userEvent.setup();
        const onAbandon = vi.fn();

        render(<GameShell {...baseProps} onAbandon={onAbandon} />);

        await user.click(screen.getByRole("button", { name: "Abandonar" }));
        expect(onAbandon).toHaveBeenCalledTimes(1);
    });

    it("deshabilita Abandonar si abandonDisabled es truthy", () => {
        render(<GameShell {...baseProps} abandonDisabled />);

        expect(screen.getByRole("button", { name: "Abandonar" })).toBeDisabled();
    });

    it("muestra Alert si error no está vacío", () => {
        render(<GameShell {...baseProps} error="boom" />);

        expect(screen.getByRole("alert")).toHaveTextContent("boom");
    });

    it("no muestra Alert si error está vacío", () => {
        render(<GameShell {...baseProps} error="" />);

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("si no hay board y loading=true muestra 'Creando partida...'", () => {
        render(
            <GameShell
                {...baseProps}
                hasBoard={false}
                loading={true}
                emptyText="No se pudo crear la partida."
            />,
        );

        expect(screen.getByText("Creando partida...")).toBeInTheDocument();
        expect(screen.getByTestId("empty-image")).toHaveTextContent("default-empty");
        expect(screen.getByTestId("empty-image-style")).toHaveTextContent('{"height":120}');
    });

    it("si no hay board y loading=false muestra emptyText", () => {
        render(
            <GameShell
                {...baseProps}
                hasBoard={false}
                loading={false}
                emptyText="No se pudo crear la partida."
            />,
        );

        expect(screen.getByText("No se pudo crear la partida.")).toBeInTheDocument();
    });

    it("si hasBoard=true renderiza turnIndicator, board y result", () => {
        render(<GameShell {...baseProps} />);

        expect(screen.getByText("TURN INDICATOR")).toBeInTheDocument();
        expect(screen.getByText("BOARD CONTENT")).toBeInTheDocument();
        expect(screen.getByText("RESULT CONTENT")).toBeInTheDocument();
    });

    it("si hasBoard=true y result es null solo renderiza board", () => {
        render(<GameShell {...baseProps} result={null} />);

        expect(screen.getByText("BOARD CONTENT")).toBeInTheDocument();
        expect(screen.queryByText("RESULT CONTENT")).not.toBeInTheDocument();
    });

    it("si hasBoard=true y turnIndicator es null no lo renderiza", () => {
        render(<GameShell {...baseProps} turnIndicator={null} />);

        expect(screen.queryByText("TURN INDICATOR")).not.toBeInTheDocument();
        expect(screen.getByText("BOARD CONTENT")).toBeInTheDocument();
    });

    it("si hasBoard=false no renderiza turnIndicator, board ni result", () => {
        render(
            <GameShell
                {...baseProps}
                hasBoard={false}
                loading={false}
                emptyText="Vacío"
            />,
        );

        expect(screen.queryByText("TURN INDICATOR")).not.toBeInTheDocument();
        expect(screen.queryByText("BOARD CONTENT")).not.toBeInTheDocument();
        expect(screen.queryByText("RESULT CONTENT")).not.toBeInTheDocument();
        expect(screen.getByText("Vacío")).toBeInTheDocument();
    });
});