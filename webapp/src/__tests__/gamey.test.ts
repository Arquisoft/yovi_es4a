import { describe, it, expect, vi, beforeEach } from "vitest";
import { newGame, newHvbGame, getGameConfig, humanVsBotMove } from "../api/gamey.ts";

function jsonResponse(body: any, init?: ResponseInit) {
    return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
}

describe("api/gamey", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("newGame ok", async () => {
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(
                jsonResponse({
                    yen: { size: 5, turn: 0, players: ["B", "R"], layout: "./../..../....." },
                })
            );

        const res = await newGame(5);

        expect(spy).toHaveBeenCalledTimes(1);
        const [url, init] = spy.mock.calls[0];

        expect(String(url)).toContain("/v1/game/new");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({ "Content-Type": "application/json" });
        expect(init?.body).toBe(JSON.stringify({ size: 5 }));

        expect(res.yen.size).toBe(5);
    });

    it("newGame error con message", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "server down" }, { status: 500 }));
        await expect(newGame(5)).rejects.toThrow("server down");
    });

    it("newGame: si HTTP no ok y el json es {} (sin message), lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({}), {
                status: 418,
                headers: { "Content-Type": "application/json" },
            })
        );

        await expect(newGame(5)).rejects.toThrow("HTTP 418");
    });

    it("newGame: si !ok y res.json() falla, usa el catch(() => ({})) y lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
            json: vi.fn().mockRejectedValue(new Error("invalid json")),
        } as any);

        await expect(newGame(5)).rejects.toThrow("HTTP 503");
    });

    it("newHvbGame ok (encode botId + body incluye starter)", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                yen: { size: 7, turn: 0, players: ["B", "R"], layout: "./../..../......." },
                bot_move: null,
                status: { state: "ongoing", next: "B" },
            })
        );

        const res = await newHvbGame(7, "mcts bot/1", "bot");

        expect(res.yen.size).toBe(7);

        expect(spy).toHaveBeenCalledTimes(1);
        const [url, init] = spy.mock.calls[0];

        expect(String(url)).toContain("/v1/game/hvb/new/mcts%20bot%2F1");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({ "Content-Type": "application/json" });
        expect(init?.body).toBe(JSON.stringify({ size: 7, starter: "bot" }));
    });

    it("newHvbGame error con message", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "bad bot" }, { status: 400 }));
        await expect(newHvbGame(7, "random_bot", "human")).rejects.toThrow("bad bot");
    });

    it("newHvbGame: si HTTP no ok y body NO es JSON, lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("NOT_JSON", { status: 500, headers: { "Content-Type": "application/json" } })
        );

        await expect(newHvbGame(7, "random_bot", "human")).rejects.toThrow("HTTP 500");
    });

    it("newHvbGame: si !ok y res.json() falla, lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 502,
            json: vi.fn().mockRejectedValue(new Error("invalid json")),
        } as any);

        await expect(newHvbGame(7, "random_bot", "human")).rejects.toThrow("HTTP 502");
    });

    it("getGameConfig ok", async () => {
        const spy = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(jsonResponse({ min_board_size: 2, max_board_size: 15 }));

        const cfg = await getGameConfig();

        expect(cfg.min_board_size).toBe(2);
        expect(cfg.max_board_size).toBe(15);

        expect(spy).toHaveBeenCalledTimes(1);
        expect(String(spy.mock.calls[0][0])).toContain("/v1/game/config");
    });

    it("getGameConfig error con message", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ message: "no config" }, { status: 500 }));
        await expect(getGameConfig()).rejects.toThrow("no config");
    });

    it("getGameConfig: si HTTP no ok y el json es {} (sin message), lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({}), { status: 401, headers: { "Content-Type": "application/json" } })
        );

        await expect(getGameConfig()).rejects.toThrow("HTTP 401");
    });

    it("getGameConfig: si !ok y res.json() falla, lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
            json: vi.fn().mockRejectedValue(new Error("invalid json")),
        } as any);

        await expect(getGameConfig()).rejects.toThrow("HTTP 503");
    });

    it("humanVsBotMove ok (encode botId)", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                yen: { size: 5, turn: 1, players: ["B", "R"], layout: "./../..../..B.." },
                human_move: { cell_id: 3, coords: { x: 1, y: 0, z: 3 } },
                bot_move: null,
                status: { state: "ongoing", next: "R" },
            })
        );

        const yen = { size: 5, turn: 0, players: ["B", "R"], layout: "./../..../....." } as any;
        await humanVsBotMove("mcts bot/1", yen, 3);

        const [url, init] = spy.mock.calls[0];

        expect(String(url)).toContain("/v1/game/hvb/move/mcts%20bot%2F1");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual({ "Content-Type": "application/json" });
        expect(init?.body).toBe(JSON.stringify({ yen, cell_id: 3 }));
    });

    it("humanVsBotMove: si HTTP no ok y el body NO es JSON, cae al catch y lanza HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("NOT_JSON", {
                status: 500,
                headers: { "Content-Type": "application/json" },
            })
        );

        const yen = { size: 5, turn: 0, players: ["B", "R"], layout: "./../..../....." } as any;

        await expect(humanVsBotMove("random_bot", yen, 0)).rejects.toThrow("HTTP 500");
    });
});