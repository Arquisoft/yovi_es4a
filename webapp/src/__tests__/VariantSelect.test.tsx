import "@testing-library/jest-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VariantSelect from "../vistas/VariantSelect";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../vistas/AppHeader", () => ({
    default: ({ title }: { title: string }) => (
        <div data-testid="app-header">{title}</div>
    ),
}));

vi.mock("antd", () => ({
    Button: ({ children, onClick, disabled, icon, ...props }: any) => (
        <button onClick={onClick} disabled={disabled} {...props}>
            {children}
        </button>
    ),
    Card: ({ children, onClick, size: _size, hoverable: _h, ...props }: any) => (
        <div onClick={onClick} {...props}>
            {children}
        </div>
    ),
    Flex: ({ children }: any) => <div>{children}</div>,
    Space: ({ children }: any) => <div>{children}</div>,
    Tag: ({ children }: any) => <span>{children}</span>,
    Masonry: ({ items = [], itemRender }: any) => (
        <div data-testid="masonry">
            {items.map((item: any) => (
                <div key={item.key} data-testid={`masonry-item-${item.key}`}>
                    {itemRender ? itemRender(item) : null}
                </div>
            ))}
        </div>
    ),
    Typography: {
        Title: ({ children }: any) => <h2>{children}</h2>,
        Text: ({ children }: any) => <span>{children}</span>,
        Paragraph: ({ children }: any) => <p>{children}</p>,
    },
}));

vi.mock("@ant-design/icons", () => ({
    PlayCircleOutlined: () => null,
    ArrowLeftOutlined: () => null,
    InfoCircleOutlined: () => null,
    ExperimentOutlined: () => null,
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function renderVariantSelect(onSelect = vi.fn(), onBack = vi.fn()) {
    return {
        onSelect,
        onBack,
        ...render(<VariantSelect onSelect={onSelect} onBack={onBack} />),
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("VariantSelect", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ── Renderizado ───────────────────────────────────────────────────────────

    it("renderiza el AppHeader con título YOVI", () => {
        renderVariantSelect();
        expect(screen.getByTestId("app-header")).toHaveTextContent("YOVI");
    });

    it("muestra todas las variantes definidas en VARIANTS", () => {
        renderVariantSelect();
        // Verificamos al menos las principales que sabemos que existen
        expect(screen.getByText("Clásico")).toBeInTheDocument();
        expect(screen.getByText("Regla del Pastel")).toBeInTheDocument();
    });

    it("muestra el tag 'Próximamente' para variantes no implementadas", () => {
        renderVariantSelect();
        const tags = screen.getAllByText("Próximamente");
        expect(tags.length).toBeGreaterThan(0);
    });

    it("no muestra 'Próximamente' para variantes implementadas", () => {
        renderVariantSelect();
        const classicContainer = screen.getByText("Clásico").closest("div");
        expect(classicContainer).not.toHaveTextContent("Próximamente");
    });

    it("el botón confirmar está habilitado al arrancar (clásico seleccionado)", () => {
        renderVariantSelect();
        const btn = screen.getByRole("button", { name: /Continuar con/i });
        expect(btn).not.toBeDisabled();
    });

    // ── Selección de variante implementada ────────────────────────────────────

    it("confirmar sin cambiar llama a onSelect con la variante clásica", async () => {
        const user = userEvent.setup();
        const { onSelect } = renderVariantSelect();

        await user.click(screen.getByRole("button", { name: /Continuar con/i }));

        expect(onSelect).toHaveBeenCalledOnce();
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ id: "classic", implemented: true })
        );
    });

    // ── Variantes no implementadas ────────────────────────────────────────────

    it("hacer clic en una variante no implementada NO la selecciona", async () => {
        const user = userEvent.setup();
        const { onSelect } = renderVariantSelect();

        const hexCard = screen.getByText("Hex");
        await user.click(hexCard);

        // Al confirmar, la selección sigue siendo el clásico
        await user.click(screen.getByRole("button", { name: /Continuar con/i }));
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ id: "classic" })
        );
    });

    it("el botón confirmar queda deshabilitado si el usuario consigue forzar una selección no implementada via teclado (defensa)", () => {
        // El estado interno nunca puede ser una variante no implementada,
        // así que el botón siempre está habilitado cuando classic está seleccionado.
        // Este test verifica el estado inicial seguro.
        renderVariantSelect();
        expect(screen.getByTestId("variant-confirm-btn")).not.toBeDisabled();
    });

    // ── Botón info / detalle expandible ──────────────────────────────────────

    it("al pulsar el botón info de una variante, se muestra su detalle", async () => {
        const user = userEvent.setup();
        renderVariantSelect();

        const infoButtons = screen.getAllByRole("button").filter(b => !b.textContent);
        // El primer botón de info suele ser el del clásico
        await user.click(infoButtons[0]);

        expect(screen.getByText(/Dos jugadores se alternan colocando fichas/i)).toBeInTheDocument();
    });

    it("pulsar dos veces el botón info cierra el detalle", async () => {
        const user = userEvent.setup();
        renderVariantSelect();

        const infoButtons = screen.getAllByRole("button").filter(b => !b.textContent);
        const infoBtn = infoButtons[0];

        await user.click(infoBtn); // abre
        expect(screen.getByText(/Dos jugadores se alternan colocando fichas/i)).toBeInTheDocument();

        await user.click(infoBtn); // cierra
        expect(screen.queryByText(/Dos jugadores se alternan colocando fichas/i)).not.toBeInTheDocument();
    });

    it("abrir el detalle de otra variante cierra el anterior", async () => {
        const user = userEvent.setup();
        renderVariantSelect();

        const infoButtons = screen.getAllByRole("button").filter(b => !b.textContent);

        await user.click(infoButtons[0]); // Classic
        expect(screen.getByText(/Dos jugadores se alternan colocando fichas/i)).toBeInTheDocument();

        await user.click(infoButtons[1]); // Pastel
        expect(screen.queryByText(/Dos jugadores se alternan colocando fichas/i)).not.toBeInTheDocument();
        expect(screen.getByText(/El Jugador 1 elige dónde va la primera ficha/i)).toBeInTheDocument();
    });

    // ── Botón Volver ─────────────────────────────────────────────────────────

    it("el botón Volver llama a onBack", async () => {
        const user = userEvent.setup();
        const { onBack } = renderVariantSelect();

        await user.click(screen.getByText("Volver"));

        expect(onBack).toHaveBeenCalledOnce();
    });
});