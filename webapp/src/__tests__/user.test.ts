import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRanking,
  getUserHistory,
  getUserStats,
  loginUser,
  recordUserGame,
  registerUser,
} from "../api/users";

describe("api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("loginUser hace POST correcto y devuelve el JSON", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Login ok",
        username: "marcelo",
        profilePicture: "avatar.png",
      }),
    });

    const result = await loginUser("marcelo", "1234");

    expect(global.fetch).toHaveBeenCalledWith("/api/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "marcelo", password: "1234" }),
    });
    expect(result.username).toBe("marcelo");
  });

  it("registerUser hace POST correcto", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "ok" }),
    });

    await registerUser({
      username: "u",
      email: "u@test.com",
      password: "p",
      profilePicture: "a.png",
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/users/createuser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "u",
        email: "u@test.com",
        password: "p",
        profilePicture: "a.png",
      }),
    });
  });

  it("getRanking hace GET con sort, page y pageSize", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sortBy: "winRate", ranking: [], pagination: { totalItems: 0, page: 1, pageSize: 10, totalPages: 0 } }),
    });

    await getRanking("gamesWon", 2, 10);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/ranking?sortBy=gamesWon&page=2&pageSize=10"
    );
  });

  it("getUserHistory encodea el username y pasa paginación", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo diez",
        profilePicture: "",
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesAbandoned: 0,
          totalMoves: 0,
          currentWinStreak: 0,
          winRate: 0,
        },
        pagination: {
          page: 2,
          pageSize: 7,
          totalGames: 0,
          totalPages: 1,
        },
        games: [],
      }),
    });

    await getUserHistory("marcelo diez", 2, 7);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo%20diez/history?page=2&pageSize=7",
    );
  });

  it("getUserHistory añade mode, result y sortBy cuando no son 'all'", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo",
        profilePicture: "",
        stats: {
          gamesPlayed: 1,
          gamesWon: 1,
          gamesLost: 0,
          gamesAbandoned: 0,
          totalMoves: 10,
          currentWinStreak: 1,
          winRate: 100,
        },
        pagination: {
          page: 1,
          pageSize: 5,
          totalGames: 1,
          totalPages: 1,
        },
        games: [],
      }),
    });

    await getUserHistory("marcelo", 1, 5, {
      mode: "classic_hvb",
      result: "won",
      sortBy: "movesDesc",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo/history?page=1&pageSize=5&mode=classic_hvb&result=won&sortBy=movesDesc",
    );
  });

  it("recordUserGame hace POST correcto", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo",
        stats: {},
        savedGame: {},
      }),
    });

    await recordUserGame("marcelo", {
      gameId: "g1",
      mode: "classic_hvb",
      result: "won",
      boardSize: 7,
      totalMoves: 10,
      opponent: "random_bot",
      startedBy: "human",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo/games",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId: "g1",
          mode: "classic_hvb",
          result: "won",
          boardSize: 7,
          totalMoves: 10,
          opponent: "random_bot",
          startedBy: "human",
        }),
      },
    );
  });

  it("getUserStats hace GET correcto", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo",
        profilePicture: "avatar.png",
        stats: {
          gamesPlayed: 4,
          gamesWon: 2,
          gamesLost: 1,
          gamesAbandoned: 1,
          totalMoves: 18,
          currentWinStreak: 2,
          winRate: 50,
        },
      }),
    });

    const result = await getUserStats("marcelo diez");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo%20diez/stats"
    );
    expect(result.stats.gamesWon).toBe(2);
  });

  it("lanza el error del backend cuando response.ok es false", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Credenciales incorrectas" }),
    });

    await expect(loginUser("a", "b")).rejects.toThrow(
      "Credenciales incorrectas",
    );
  });

  it("si el backend no manda error usa Error <status>", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await expect(getRanking("winRate", 1, 20)).rejects.toThrow("Error 500");
  });
});