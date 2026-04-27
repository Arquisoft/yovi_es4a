import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRanking,
  getUserHistory,
  getUserStats,
  loginUser,
  recordUserGame,
  registerUser,
  changePassword,
  changeAvatar,
  changeUsername,
  getUserProfile,
  getGameModeLongLabel,
  getGameModeShortLabel,
  getGameModeTagColor,
  getHistoryOpponentLabel,
  getHistoryStartedByLabel,
  normalizeGameMode,
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
        username: "marcelo.diez",
        profilePicture: "",
        stats: {
          gamesPlayed: 0,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 0,
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

    await getUserHistory("marcelo.diez", 2, 7);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo.diez/history?page=2&pageSize=7",
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
          gamesDrawn: 0,
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

  it("getUserHistory normaliza modos legacy y campos opcionales del historial", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo",
        profilePicture: "",
        stats: {
          gamesPlayed: 1,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 1,
          gamesAbandoned: 0,
          totalMoves: 12,
          currentWinStreak: 0,
          winRate: 0,
        },
        pagination: {
          page: 1,
          pageSize: 5,
          totalGames: 1,
          totalPages: 1,
        },
        games: [{
          gameId: "g-legacy",
          mode: "whynot_hvh",
          result: "draw",
          boardSize: 7,
          totalMoves: 12,
          opponent: "  ",
          startedBy: " random ",
          finishedAt: new Date("2026-03-21T12:00:00.000Z"),
        }],
      }),
    });

    const result = await getUserHistory("marcelo", 1, 5);

    expect(result.games[0]).toEqual({
      gameId: "g-legacy",
      mode: "why_not_hvh",
      result: "draw",
      boardSize: 7,
      totalMoves: 12,
      opponent: "",
      startedBy: "random",
      finishedAt: "2026-03-21T12:00:00.000Z",
    });
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
        username: "marcelo.diez",
        profilePicture: "avatar.png",
        stats: {
          gamesPlayed: 4,
          gamesWon: 2,
          gamesLost: 1,
          gamesDrawn: 1,
          gamesAbandoned: 1,
          totalMoves: 18,
          currentWinStreak: 2,
          winRate: 50,
        },
      }),
    });

    const result = await getUserStats("marcelo.diez");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo.diez/stats"
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

  it("normaliza el alias legacy whynot_hvh en las utilidades de modo", () => {
    expect(normalizeGameMode("whynot_hvh")).toBe("why_not_hvh");
    expect(getGameModeShortLabel("whynot_hvh")).toBe("WhY Not HvH");
    expect(getGameModeLongLabel("whynot_hvh")).toBe("WhY Not - Humano vs Humano");
    expect(getGameModeTagColor("whynot_hvh")).toBe("#5cf6b6");
  });

  it("usa etiquetas por defecto para rival y jugador inicial", () => {
    expect(
      getHistoryOpponentLabel({ mode: "classic_hvb", opponent: "   " }),
    ).toBe("Bot");
    expect(getHistoryStartedByLabel({ startedBy: "  player0  " })).toBe("player0");
    expect(getHistoryStartedByLabel({ startedBy: "   " })).toBeNull();
  });

  it("getUserHistory valida username, añade filtros y normaliza juegos", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "Marcelo",
        stats: {
          gamesPlayed: 1,
          gamesWon: 1,
          gamesLost: 0,
          gamesDrawn: 0,
          gamesAbandoned: 0,
          totalMoves: 8,
          currentWinStreak: 1,
          winRate: 100,
        },
        pagination: { page: 3, pageSize: 2, totalGames: 1, totalPages: 1 },
        games: [
          {
            gameId: "g1",
            mode: "whynot_hvh",
            result: "won",
            boardSize: 7,
            totalMoves: 8,
            opponent: "  Rival  ",
            startedBy: "  player1  ",
            finishedAt: new Date("2026-04-22T10:00:00.000Z"),
          },
        ],
      }),
    });

    const res = await getUserHistory("  Marcelo  ", 3, 2, {
      mode: "classic_hvh",
      result: "won",
      sortBy: "movesAsc",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/Marcelo/history?page=3&pageSize=2&mode=classic_hvh&result=won&sortBy=movesAsc",
    );
    expect(res.games[0].mode).toBe("why_not_hvh");
    expect(res.games[0].opponent).toBe("Rival");
    expect(res.games[0].startedBy).toBe("player1");
    expect(res.games[0].finishedAt).toBe("2026-04-22T10:00:00.000Z");
  });

  it("recordUserGame normaliza el juego devuelto y codifica el username", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "User.Name",
        stats: {
          gamesPlayed: 1,
          gamesWon: 0,
          gamesLost: 0,
          gamesDrawn: 1,
          gamesAbandoned: 0,
          totalMoves: 9,
          currentWinStreak: 0,
          winRate: 0,
        },
        savedGame: {
          gameId: "g draw",
          mode: "whynot_hvh",
          result: "draw",
          boardSize: 7,
          totalMoves: 9,
          opponent: "  Invitado  ",
          startedBy: "  random  ",
          finishedAt: "2026-04-23T09:00:00.000Z",
        },
      }),
    });

    const res = await recordUserGame(" User.Name ", {
      gameId: "g draw",
      mode: "classic_hvh",
      result: "draw",
      boardSize: 7,
      totalMoves: 9,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/User.Name/games",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(res.savedGame.mode).toBe("why_not_hvh");
    expect(res.savedGame.opponent).toBe("Invitado");
    expect(res.savedGame.startedBy).toBe("random");
  });

  it("usa el username validado también en stats, profile, password, username y avatar", async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ username: "marcelo", stats: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ username: "marcelo", email: "m@test.com" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: "ok" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: "ok", username: "nuevo" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ message: "ok", profilePicture: "elvis.png" }) });

    await getUserStats("  marcelo ");
    await getUserProfile("  marcelo ");
    await changePassword("  marcelo ", "old", "newpass");
    await changeUsername("  marcelo ", "nuevo");
    await changeAvatar("  marcelo ", "elvis.png");

    expect((global.fetch as any).mock.calls[0]?.[0]).toBe("/api/users/users/marcelo/stats");
    expect((global.fetch as any).mock.calls[1]?.[0]).toBe("/api/users/users/marcelo/profile");
    expect((global.fetch as any).mock.calls[2]?.[0]).toBe("/api/users/users/marcelo/password");
    expect((global.fetch as any).mock.calls[3]?.[0]).toBe("/api/users/users/marcelo/username");
    expect((global.fetch as any).mock.calls[4]?.[0]).toBe("/api/users/users/marcelo/avatar");
  });

  it("valida el username antes de llamar a fetch", async () => {
    await expect(getUserHistory("   ", 1, 5)).rejects.toThrow(
      "El nombre de usuario es obligatorio.",
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("changePassword hace PUT correcto y devuelve el mensaje", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "Contraseña actualizada" }),
    });

    const result = await changePassword(
      "marcelo",
      "oldPass123",
      "NewPass123!"
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo/password",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: "oldPass123",
          newPassword: "NewPass123!",
        }),
      }
    );

    expect(result.message).toBe("Contraseña actualizada");
  });

  it("changePassword lanza error cuando el backend falla", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Contraseña actual incorrecta" }),
    });

    await expect(
      changePassword("marcelo", "wrong", "NewPass123!")
    ).rejects.toThrow("Contraseña actual incorrecta");
  });

  it("getUserProfile hace GET correcto y devuelve username y email", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "marcelo.diez",
        email: "marcelo@test.com",
        profilePicture: "avatar.png",
      }),
    });

    const result = await getUserProfile("marcelo.diez");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo.diez/profile"
    );

    expect(result.username).toBe("marcelo.diez");
    expect(result.email).toBe("marcelo@test.com");
    expect(result.profilePicture).toBe("avatar.png");
  });

  it("getUserProfile lanza el error del backend cuando response.ok es false", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        error: "Usuario no encontrado",
      }),
    });

    await expect(getUserProfile("inexistente")).rejects.toThrow(
      "Usuario no encontrado"
    );
  });
 
  it("changeUsername hace PATCH correcto y devuelve el nuevo username", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Nombre de usuario actualizado correctamente.",
        username: "nuevo_marcelo",
      }),
    });
 
    const result = await changeUsername("marcelo", "nuevo_marcelo");
 
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo/username",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newUsername: "nuevo_marcelo" }),
      }
    );
 
    expect(result.username).toBe("nuevo_marcelo");
    expect(result.message).toBe("Nombre de usuario actualizado correctamente.");
  });
 
  it("changeUsername usa un username válido con punto", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Nombre de usuario actualizado correctamente.",
        username: "nuevo",
      }),
    });
 
    await changeUsername("marcelo.diez", "nuevo");
 
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo.diez/username",
      expect.any(Object)
    );
  });
 
  it("changeUsername lanza error cuando el nombre ya está en uso", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Ese nombre de usuario ya está en uso." }),
    });
 
    await expect(
      changeUsername("marcelo", "ocupado")
    ).rejects.toThrow("Ese nombre de usuario ya está en uso.");
  });
 
  it("changeUsername lanza error cuando el usuario no existe", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Usuario no encontrado" }),
    });
 
    await expect(
      changeUsername("noexiste", "nuevo")
    ).rejects.toThrow("Usuario no encontrado");
  });
 
  it("changeUsername usa Error <status> si el backend no envía error", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
 
    await expect(
      changeUsername("marcelo", "nuevo")
    ).rejects.toThrow("Error 500");
  });
 
  it("changeAvatar hace PATCH correcto y devuelve el nuevo profilePicture", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Avatar actualizado correctamente.",
        profilePicture: "disco.png",
      }),
    });
 
    const result = await changeAvatar("marcelo", "disco.png");
 
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo/avatar",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePicture: "disco.png" }),
      }
    );
 
    expect(result.profilePicture).toBe("disco.png");
    expect(result.message).toBe("Avatar actualizado correctamente.");
  });
 
  it("changeAvatar usa un username válido con punto", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        message: "Avatar actualizado correctamente.",
        profilePicture: "elvis.png",
      }),
    });
 
    await changeAvatar("marcelo.diez", "elvis.png");
 
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/users/marcelo.diez/avatar",
      expect.any(Object)
    );
  });
 
  it("changeAvatar lanza error cuando el avatar no es válido", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Avatar no válido." }),
    });
 
    await expect(
      changeAvatar("marcelo", "avatar_inexistente.png")
    ).rejects.toThrow("Avatar no válido.");
  });
 
  it("changeAvatar lanza error cuando el usuario no existe", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Usuario no encontrado" }),
    });
 
    await expect(
      changeAvatar("noexiste", "disco.png")
    ).rejects.toThrow("Usuario no encontrado");
  });
 
  it("changeAvatar usa Error <status> si el backend no envía error", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
 
    await expect(
      changeAvatar("marcelo", "rubia.png")
    ).rejects.toThrow("Error 500");
  });
});
