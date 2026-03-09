import "@testing-library/jest-dom";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Board from "../game/Board.tsx";
import type { Cell } from "../game/yen";

vi.mock("antd", () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

function makeCells(): Cell[] {
    return [
        {
            cellId: 0,
            row: 0,
            col: 0,
            value: ".",
            coords: { x: 1, y: 0, z: 0 },
            touches: { a: false, b: true, c: true },
        },
        {
            cellId: 1,
            row: 1,
            col: 0,
            value: "B",
            coords: { x: 0, y: 0, z: 1 },
            touches: { a: true, b: true, c: false },
        },
        {
            cellId: 2,
            row: 1,
            col: 1,
            value: "R",
            coords: { x: 0, y: 1, z: 0 },
            touches: { a: true, b: false, c: true },
        },
    ];
}

describe("Board", () => {
    it("renderiza un botón por celda", () => {
        render(<Board size={2} cells={makeCells()} onCellClick={() => {}} />);

        expect(screen.getByLabelText("cell-0")).toBeInTheDocument();
        expect(screen.getByLabelText("cell-1")).toBeInTheDocument();
        expect(screen.getByLabelText("cell-2")).toBeInTheDocument();
    });

    it("permite click en celdas vacías si disabled=false", async () => {
        const user = userEvent.setup();
        const onCellClick = vi.fn();

        render(<Board size={2} cells={makeCells()} onCellClick={onCellClick} disabled={false} />);

        const cell0 = screen.getByLabelText("cell-0");
        expect(cell0).toBeEnabled();

        await user.click(cell0);
        expect(onCellClick).toHaveBeenCalledTimes(1);
        expect(onCellClick).toHaveBeenCalledWith(0);
    });

    it("deshabilita celdas ocupadas", async () => {
        const user = userEvent.setup();
        const onCellClick = vi.fn();

        render(<Board size={2} cells={makeCells()} onCellClick={onCellClick} disabled={false} />);

        const occupied1 = screen.getByLabelText("cell-1");
        const occupied2 = screen.getByLabelText("cell-2");

        expect(occupied1).toBeDisabled();
        expect(occupied2).toBeDisabled();

        await user.click(occupied1);
        await user.click(occupied2);

        expect(onCellClick).not.toHaveBeenCalled();
    });

    it("si disabled=true, incluso las vacías quedan deshabilitadas", async () => {
        const user = userEvent.setup();
        const onCellClick = vi.fn();

        render(<Board size={2} cells={makeCells()} onCellClick={onCellClick} disabled />);

        const empty0 = screen.getByLabelText("cell-0");
        expect(empty0).toBeDisabled();

        await user.click(empty0);
        expect(onCellClick).not.toHaveBeenCalled();
    });
});