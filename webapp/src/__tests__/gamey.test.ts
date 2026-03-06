import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  getOrCreateClientId,
  getMeta,
  getConfig,
  putConfig,
  createHvbGame,
  getHvbGame,
  hvbHumanMove,
  deleteHvbGame,
  createHvhGame,
  getHvhGame,
  hvhMove,
  deleteHvhGame,
  type GameConfig,
} from "../api/gamey";

function jsonResponse(body: any, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("api/gamey", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        localStorage.setItem("yovi_client_id", "test-client-id");
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("getOrCreateClientId devuelve el existente", () => {
        localStorage.setItem("yovi_client_id", "abc");
        expect(getOrCreateClientId()).toBe("abc");
    });

    it("getOrCreateClientId genera uno nuevo con crypto.randomUUID y lo guarda", () => {
        localStorage.clear();
        vi.stubGlobal("crypto", {
            randomUUID: vi.fn(() => "generated-uuid"),
        });

        const id = getOrCreateClientId();

        expect(id).toBe("generated-uuid");
        expect(localStorage.getItem("yovi_client_id")).toBe("generated-uuid");
    });

    it("getMeta ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                api_version: "v1",
                min_board_size: 2,
                max_board_size: 15,
                bots: ["random_bot", "mcts_bot"],
            }),
        );

        const res = await getMeta();

        expect(res.min_board_size).toBe(2);
        expect(res.max_board_size).toBe(15);
        expect(res.bots).toContain("random_bot");

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/meta");
        expect(init?.method).toBe("GET");
        expect(init?.headers).toMatchObject({
            "Content-Type": "application/json",
            "X-Client-Id": "test-client-id",
        });
    });

    it("getMeta error con message", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({ message: "server down" }, { status: 500 }),
        );

        await expect(getMeta()).rejects.toThrow("server down");
    });

    it("si !ok y el json no tiene message => HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({}), {
                status: 418,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(getMeta()).rejects.toThrow("HTTP 418");
    });

    it("si !ok y res.json() falla => HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
            ok: false,
            status: 503,
            json: vi.fn().mockRejectedValue(new Error("invalid json")),
        } as any);

        await expect(getMeta()).rejects.toThrow("HTTP 503");
    });

    it("getConfig ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                size: 7,
                hvb_starter: "human",
                hvh_starter: "player0",
                bot_id: "random_bot",
            }),
        );

        const cfg = await getConfig();

        expect(cfg).toEqual({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: "random_bot",
        });

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/config");
        expect(init?.method).toBe("GET");
    });

    it("putConfig ok con hvh_starter y bot_id null", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                size: 9,
                hvb_starter: "human",
                hvh_starter: "player1",
                bot_id: null,
            }),
        );

        const cfg: GameConfig = {
            size: 9,
            hvb_starter: "human",
            hvh_starter: "player1",
            bot_id: null,
        };

        const res = await putConfig(cfg);

        expect(res).toEqual(cfg);

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/config");
        expect(init?.method).toBe("PUT");
        expect(init?.headers).toMatchObject({
            "Content-Type": "application/json",
            "X-Client-Id": "test-client-id",
        });
        expect(init?.body).toBe(JSON.stringify(cfg));
    });

    it("createHvbGame ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "hvb-1",
                mode: "hvb",
                yen: { size: 7, layout: "./../..../......." },
                status: { state: "ongoing", next: "human" },
            }),
        );

        const res = await createHvbGame({ size: 7, bot_id: "mcts_bot", hvb_starter: "bot" });

        expect(res.game_id).toBe("hvb-1");
        expect(res.mode).toBe("hvb");
        expect(res.yen.size).toBe(7);

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvb/games");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(
            JSON.stringify({ size: 7, bot_id: "mcts_bot", hvb_starter: "bot" }),
        );
    });

    it("getHvbGame hace GET y encodea el gameId", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "id with spaces/1",
                mode: "hvb",
                yen: { size: 7, layout: "./../..../......." },
                status: { state: "ongoing", next: "human" },
            }),
        );

        const res = await getHvbGame("id with spaces/1");

        expect(res.game_id).toBe("id with spaces/1");
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvb/games/id%20with%20spaces%2F1");
        expect(init?.method).toBe("GET");
    });

    it("hvbHumanMove ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "id with spaces/1",
                yen: { size: 7, layout: "./../..../......." },
                human_move: { cell_id: 3, coords: { x: 1, y: 0, z: 3 } },
                bot_move: null,
                status: { state: "ongoing", next: "human" },
            }),
        );

        const res = await hvbHumanMove("id with spaces/1", 3);

        expect(res.game_id).toBe("id with spaces/1");
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvb/games/id%20with%20spaces%2F1/moves");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify({ cell_id: 3 }));
    });

    it("deleteHvbGame hace DELETE", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({ deleted: true }),
        );

        const res = await deleteHvbGame("id/with/slash");

        expect(res).toEqual({ deleted: true });
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvb/games/id%2Fwith%2Fslash");
        expect(init?.method).toBe("DELETE");
    });

    it("createHvhGame ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "hvh-1",
                mode: "hvh",
                yen: { size: 7, layout: "./../..../......." },
                status: { state: "ongoing", next: "player0" },
            }),
        );

        const res = await createHvhGame();

        expect(res.mode).toBe("hvh");
        expect(res.status.state).toBe("ongoing");

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvh/games");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeUndefined();
    });

    it("getHvhGame hace GET y encodea el gameId", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "id/with/slash",
                mode: "hvh",
                yen: { size: 7, layout: "./../..../......." },
                status: { state: "ongoing", next: "player1" },
            }),
        );

        const res = await getHvhGame("id/with/slash");

        expect(res.game_id).toBe("id/with/slash");
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvh/games/id%2Fwith%2Fslash");
        expect(init?.method).toBe("GET");
    });

    it("hvhMove ok", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({
                game_id: "id/with/slash",
                yen: { size: 7, layout: "./../..../......." },
                applied_move: { cell_id: 0, coords: { x: 6, y: 0, z: 0 } },
                status: { state: "ongoing", next: "player1" },
            }),
        );

        await hvhMove("id/with/slash", 0);

        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvh/games/id%2Fwith%2Fslash/moves");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(JSON.stringify({ cell_id: 0 }));
    });

    it("deleteHvhGame hace DELETE", async () => {
        const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
            jsonResponse({ deleted: true }),
        );

        const res = await deleteHvhGame("abc xyz");

        expect(res).toEqual({ deleted: true });
        const [url, init] = spy.mock.calls[0];
        expect(String(url)).toContain("/api/v1/hvh/games/abc%20xyz");
        expect(init?.method).toBe("DELETE");
    });

    it("hvhMove: si HTTP no ok y body NO es JSON => HTTP <status>", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response("NOT_JSON", {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(hvhMove("any", 0)).rejects.toThrow("HTTP 500");
    });
});