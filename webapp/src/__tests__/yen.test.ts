import { describe, it, expect } from "vitest";
import { parseYenToCells, totalCells } from "../game/yen";

describe("parseYenToCells", () => {
    it("convierte un YEN válido en celdas con cellId, coords y touches correctos", () => {
        const yen = {
            size: 3,
            turn: "B",
            players: ["B", "R"],
            layout: "./../B.R",
        } as any;

        const cells = parseYenToCells(yen);

        expect(cells).toHaveLength(6);
        expect(cells).toHaveLength(totalCells(3));

        expect(cells.map((c) => c.cellId)).toEqual([0, 1, 2, 3, 4, 5]);

        expect(cells[0].value).toBe(".");
        expect(cells[3].value).toBe("B");
        expect(cells[4].value).toBe(".");
        expect(cells[5].value).toBe("R");

        expect(cells[0].coords).toEqual({ x: 2, y: 0, z: 0 });

        expect(cells[3].coords).toEqual({ x: 0, y: 0, z: 2 });

        expect(cells[0].touches).toEqual({ a: false, b: true, c: true });

        expect(cells[3].touches).toEqual({ a: true, b: true, c: false });

        expect(cells[4].touches).toEqual({ a: true, b: false, c: false });
    });

    it("lanza error si el número de filas no coincide con size", () => {
        const yen = {
            size: 3,
            turn: "B",
            players: ["B", "R"],
            layout: "./..",
        } as any;

        expect(() => parseYenToCells(yen)).toThrowError(
            "Invalid YEN layout: expected 3 rows, got 2"
        );
    });

    it("lanza error si una fila no tiene la longitud esperada", () => {
        const yen = {
            size: 3,
            turn: "B",
            players: ["B", "R"],
            layout: "./.../B.R",
        } as any;

        expect(() => parseYenToCells(yen)).toThrowError(
            "Invalid YEN row 1: expected length 2, got 3"
        );
    });
});

describe("totalCells", () => {
    it("calcula correctamente el número total de celdas (triangular)", () => {
        expect(totalCells(1)).toBe(1);
        expect(totalCells(2)).toBe(3);
        expect(totalCells(3)).toBe(6);
        expect(totalCells(7)).toBe((7 * 8) / 2);
    });
});
