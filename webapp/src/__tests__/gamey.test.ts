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
    playBot,
    getOrCreateClientId,
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

    it("putConfig acepta random en ambos starters", async () => {
        const payload = {
            size: 11,
            hvb_starter: "random" as const,
            hvh_starter: "random" as const,
            bot_id: "random_bot",
        };

        const spy = mockFetchOk(payload);

        const res = await putConfig(payload);

        expect(res.hvb_starter).toBe("random");
        expect(res.hvh_starter).toBe("random");

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
            starter: "human" as const,
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
            body: JSON.stringify(payload),
        });
    });

    it("createHvbGame acepta starter=random", async () => {
        const payload = {
            size: 8,
            bot_id: "mcts_bot",
            starter: "random" as const,
        };

        const spy = mockFetchOk({
            game_id: "g1r",
            mode: "hvb",
            yen: { size: 8, layout: "." },
            status: { state: "ongoing", next: "bot" },
        });

        const res = await createHvbGame(payload);

        expect(res.game_id).toBe("g1r");
        expect(res.mode).toBe("hvb");

        expectRequest(spy, {
            path: "/api/v1/hvb/games",
            method: "POST",
            body: JSON.stringify(payload),
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
            body: JSON.stringify(payload),
        });
    });

    it("createHvhGame acepta hvh_starter=random", async () => {
        const payload = {
            size: 9,
            hvh_starter: "random" as const,
        };

        const spy = mockFetchOk({
            game_id: "g2r",
            mode: "hvh",
            yen: { size: 9, layout: "." },
            status: { state: "ongoing", next: "player1" },
        });

        const res = await createHvhGame(payload);

        expect(res.game_id).toBe("g2r");
        expect(res.mode).toBe("hvh");

        expectRequest(spy, {
            path: "/api/v1/hvh/games",
            method: "POST",
            body: JSON.stringify(payload),
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
        expect(res.status).toEqual({ state: "ongoing", next: "player1" });

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

    it("getOrCreateClientId reutiliza el valor previo de localStorage", () => {
        localStorage.setItem("yovi_client_id", "existing-client");

        expect(getOrCreateClientId()).toBe("existing-client");
    });

    it("getHvhGame y deleteHvhGame aceptan overrideClientId en headers", async () => {
        const fetchSpy = mockFetchOk({ game_id: "g2", mode: "hvh", yen: { size: 7, layout: "." }, status: { state: "ongoing", next: "player0" } });

        await getHvhGame("g2", "override-1");
        await deleteHvhGame("g2", "override-2");

        expect((fetchSpy.mock.calls[0]?.[1] as any)?.headers["X-Client-Id"]).toBe("override-1");
        expect((fetchSpy.mock.calls[1]?.[1] as any)?.headers["X-Client-Id"]).toBe("override-2");
    });

    it("hvhMove envía next_player y overrideClientId cuando se proporcionan", async () => {
        const fetchSpy = mockFetchOk({
            game_id: "g2",
            yen: { size: 7, layout: "." },
            applied_move: { cell_id: 2, coords: { x: 1, y: 1, z: 2 } },
            status: { state: "ongoing", next: "player1" },
        });

        await hvhMove("g2", 2, "override-3", 1);

        expect((fetchSpy.mock.calls[0]?.[1] as any)?.headers["X-Client-Id"]).toBe("override-3");
        expect((fetchSpy.mock.calls[0]?.[1] as any)?.body).toBe(
            JSON.stringify({ cell_id: 2, next_player: 1 }),
        );
    });

    it("playBot devuelve un movimiento con coords", async () => {
        const spy = mockFetchOk({
            coords: { x: 1, y: 1, z: 0 },
        });

        const res = await playBot({
            size: 3,
            turn: 0,
            players: ["B", "R"],
            layout: "./../...",
        }, "random_bot");

        expect("coords" in res).toBe(true);
        if ("coords" in res) {
            expect(res.coords).toEqual({ x: 1, y: 1, z: 0 });
        }

        expectRequest(spy, {
            path: "/play?",
            method: "GET",
        });
    });

    it("playBot acepta acciones especiales", async () => {
        mockFetchOk({
            action: "swap",
        });

        const res = await playBot({
            size: 3,
            turn: 0,
            players: ["B", "R"],
            layout: "./B./...",
        });

        expect("action" in res).toBe(true);
        if ("action" in res) {
            expect(res.action).toBe("swap");
        }
    });

    it("playBot puede omitir botId y apiVersion", async () => {
        const fetchSpy = mockFetchOk({ action: "resign" });

        await playBot({
            size: 3,
            turn: 0,
            players: ["B", "R"],
            layout: "./B./...",
        }, null, "");

        expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/play?position=");
        expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain("bot_id=");
        expect(String(fetchSpy.mock.calls[0]?.[0])).not.toContain("api_version=");
    });

    it("lanza el mensaje del backend si fetch falla con json", async () => {
        mockFetchError({ message: "boom" }, 400);

        await expect(getMeta()).rejects.toThrow("boom");
    });

    it("lanza HTTP status si fetch falla sin message", async () => {
        mockFetchError({ code: "x" }, 503);

        await expect(getConfig()).rejects.toThrow("HTTP 503");
    });
});
