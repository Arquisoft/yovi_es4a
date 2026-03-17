import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    createHvbGame,
    getHvbGame,
    hvbHumanMove,
    hvbBotMove,
    deleteHvbGame,
    createHvhGame,
    getHvhGame,
    hvhMove,
    deleteHvhGame,
    getMeta,
    getConfig,
    putConfig,
} from "../api/gamey";

function jsonResponse(data: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
    } as Response;
}

function mockFetchOk(data: unknown) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(data));
}

function mockFetchError(data: unknown, status = 500) {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(
        jsonResponse(data, false, status),
    );
}

function expectRequest(
    spy: ReturnType<typeof vi.spyOn>,
    expected: {
        path: string;
        method: string;
        body?: string;
    },
) {
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain(expected.path);
    expect(init?.method).toBe(expected.method);

    if (expected.body !== undefined) {
        expect(init?.body).toBe(expected.body);
    }
}

describe("gamey api client", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("getMeta ok", async () => {
        const spy = mockFetchOk({
            api_version: "v1",
            min_board_size: 2,
            max_board_size: 15,
            bots: ["random_bot", "mcts_bot"],
        });

        const res = await getMeta();

        expect(res.api_version).toBe("v1");
        expect(res.bots).toEqual(["random_bot", "mcts_bot"]);

        expectRequest(spy, {
            path: "/api/v1/meta",
            method: "GET",
        });
    });

    it("getConfig ok", async () => {
        const spy = mockFetchOk({
            size: 7,
            hvb_starter: "human",
            hvh_starter: "player0",
            bot_id: "random_bot",
        });

        const res = await getConfig();

        expect(res.size).toBe(7);
        expect(res.hvb_starter).toBe("human");
        expect(res.bot_id).toBe("random_bot");

        expectRequest(spy, {
            path: "/api/v1/config",
            method: "GET",
        });
    });

    it("putConfig ok", async () => {
        const payload = {
            size: 9,
            hvb_starter: "bot" as const,
            hvh_starter: "player1" as const,
            bot_id: "mcts_bot",
        };

        const spy = mockFetchOk({
            size: 9,
            hvb_starter: "bot",
            hvh_starter: "player1",
            bot_id: "mcts_bot",
        });

        const res = await putConfig(payload);

        expect(res.size).toBe(9);
        expect(res.hvb_starter).toBe("bot");
        expect(res.hvh_starter).toBe("player1");

        expectRequest(spy, {
            path: "/api/v1/config",
            method: "PUT",
            body: JSON.stringify(payload),
        });
    });

    it("createHvbGame ok", async () => {
        const payload = {
            size: 7,
            bot_id: "random_bot",
            hvb_starter: "human" as const,
        };

        const spy = mockFetchOk({
            game_id: "g1",
            mode: "hvb",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "human" },
        });

        const res = await createHvbGame(payload);

        expect(res.game_id).toBe("g1");
        expect(res.mode).toBe("hvb");
        expect(res.status).toEqual({ state: "ongoing", next: "human" });

        expectRequest(spy, {
            path: "/api/v1/hvb/games",
            method: "POST",
        });
    });

    it("getHvbGame ok", async () => {
        const spy = mockFetchOk({
            game_id: "g1",
            mode: "hvb",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "bot" },
        });

        const res = await getHvbGame("g1");

        expect(res.game_id).toBe("g1");
        expect(res.status).toEqual({ state: "ongoing", next: "bot" });

        expectRequest(spy, {
            path: "/api/v1/hvb/games/g1",
            method: "GET",
        });
    });

    it("hvbHumanMove ok", async () => {
        const spy = mockFetchOk({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            human_move: { cell_id: 3, coords: { x: 1, y: 2, z: 3 } },
            status: { state: "ongoing", next: "bot" },
        });

        const res = await hvbHumanMove("g1", 3);

        expect(res.game_id).toBe("g1");
        expect(res.human_move.cell_id).toBe(3);
        expect(res.status).toEqual({ state: "ongoing", next: "bot" });

        expectRequest(spy, {
            path: "/api/v1/hvb/games/g1/moves",
            method: "POST",
            body: JSON.stringify({ cell_id: 3 }),
        });
    });

    it("hvbBotMove ok", async () => {
        const spy = mockFetchOk({
            game_id: "g1",
            yen: { size: 7, layout: "." },
            bot_move: { cell_id: 4, coords: { x: 1, y: 1, z: 2 } },
            status: { state: "ongoing", next: "human" },
        });

        const res = await hvbBotMove("g1");

        expect(res.game_id).toBe("g1");
        expect(res.bot_move.cell_id).toBe(4);
        expect(res.status).toEqual({ state: "ongoing", next: "human" });

        expectRequest(spy, {
            path: "/api/v1/hvb/games/g1/bot-move",
            method: "POST",
        });
    });

    it("deleteHvbGame ok", async () => {
        const spy = mockFetchOk({ deleted: true });

        const res = await deleteHvbGame("g1");

        expect(res.deleted).toBe(true);

        expectRequest(spy, {
            path: "/api/v1/hvb/games/g1",
            method: "DELETE",
        });
    });

    it("createHvhGame ok", async () => {
        const payload = {
            size: 7,
            hvh_starter: "player0" as const,
        };

        const spy = mockFetchOk({
            game_id: "g2",
            mode: "hvh",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player0" },
        });

        const res = await createHvhGame(payload);

        expect(res.game_id).toBe("g2");
        expect(res.mode).toBe("hvh");
        expect(res.status).toEqual({ state: "ongoing", next: "player0" });

        expectRequest(spy, {
            path: "/api/v1/hvh/games",
            method: "POST",
        });
    });

    it("getHvhGame ok", async () => {
        const spy = mockFetchOk({
            game_id: "g2",
            mode: "hvh",
            yen: { size: 7, layout: "." },
            status: { state: "ongoing", next: "player1" },
        });

        const res = await getHvhGame("g2");

        expect(res.game_id).toBe("g2");
        expect(res.status).toEqual({ state: "ongoing", next: "player1" });

        expectRequest(spy, {
            path: "/api/v1/hvh/games/g2",
            method: "GET",
        });
    });

    it("hvhMove ok", async () => {
        const spy = mockFetchOk({
            game_id: "g2",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 2, coords: { x: 1, y: 1, z: 2 } },
            status: { state: "ongoing", next: "player1" },
        });

        const res = await hvhMove("g2", 2);

        expect(res.game_id).toBe("g2");
        expect(res.applied_move.cell_id).toBe(2);

        expectRequest(spy, {
            path: "/api/v1/hvh/games/g2/moves",
            method: "POST",
            body: JSON.stringify({ cell_id: 2 }),
        });
    });

    it("deleteHvhGame ok", async () => {
        const spy = mockFetchOk({ deleted: true });

        const res = await deleteHvhGame("g2");

        expect(res.deleted).toBe(true);

        expectRequest(spy, {
            path: "/api/v1/hvh/games/g2",
            method: "DELETE",
        });
    });

    it("lanza Error si la respuesta no es ok", async () => {
        mockFetchError({ error: "boom" }, 500);

        await expect(getMeta()).rejects.toThrow();
    });
});