package yovi;

import io.gatling.javaapi.core.ChainBuilder;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * Cadenas de peticiones reutilizables.
 * No requieren autenticación — la app funciona como invitado.
 */
public class Requests {

    // ── Meta / Config ─────────────────────────────────────────────────────────

    public static final ChainBuilder getMeta = exec(
        http("GET /api/v1/meta")
            .get("/api/v1/meta")
            .check(status().is(200))
            .check(jsonPath("$.min_board_size").saveAs("minSize"))
            .check(jsonPath("$.max_board_size").saveAs("maxSize"))
    );

    public static final ChainBuilder getConfig = exec(
        http("GET /api/v1/config")
            .get("/api/v1/config")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().is(200))
    );

    // ── HvB ───────────────────────────────────────────────────────────────────

    public static final ChainBuilder createHvBGame = exec(
        http("POST /api/v1/hvb/games")
            .post("/api/v1/hvb/games")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            // "starter" es el campo correcto según CreateHvbGameRequest en Rust
            .body(StringBody("{\"size\":5,\"starter\":\"human\",\"bot_id\":\"random_bot\"}"))
            .check(status().is(200))
            .check(jsonPath("$.game_id").saveAs("hvbGameId"))
    );

    public static final ChainBuilder getHvBGame = exec(
        http("GET /api/v1/hvb/games/{id}")
            .get("/api/v1/hvb/games/#{hvbGameId}")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().is(200))
            .check(jsonPath("$.game_id").exists())
    );

    // FIX: el backend (CellMoveRequest en Rust) espera {"cell_id": N}.
    // Antes se enviaban coordenadas {"x":0,"y":0,"z":0} que el deserializador
    // rechazaba con 422 Unprocessable Entity en todos los movimientos.
    public static final ChainBuilder postHvBMove = exec(
        http("POST /api/v1/hvb/games/{id}/moves")
            .post("/api/v1/hvb/games/#{hvbGameId}/moves")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{\"cell_id\":#{randomInt(0,24)}}"))
            .check(status().in(200, 400, 409, 422))
    );

    public static final ChainBuilder postBotMove = exec(
        http("POST /api/v1/hvb/games/{id}/bot-move")
            .post("/api/v1/hvb/games/#{hvbGameId}/bot-move")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            // FIX: eliminado body vacío "{}" — el endpoint no requiere body
            .check(status().in(200, 409))
    );

    public static final ChainBuilder getHint = exec(
        http("GET /api/v1/hvb/games/{id}/hint")
            .get("/api/v1/hvb/games/#{hvbGameId}/hint")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().in(200, 409))
    );

    public static final ChainBuilder deleteHvBGame = exec(
        http("DELETE /api/v1/hvb/games/{id}")
            .delete("/api/v1/hvb/games/#{hvbGameId}")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().in(200, 204, 404))
    );

    // ── HvH ───────────────────────────────────────────────────────────────────

    // FIX: el endpoint POST /api/v1/hvh/games NO acepta body — lee la config
    // guardada previamente para ese cliente (X-Client-Id).
    // Hay que llamar a PUT /api/v1/config antes de crear cada partida HvH.
    // Este chain debe ejecutarse justo antes de createHvHGame en los escenarios.
    public static final ChainBuilder putConfigForHvH = exec(
        http("PUT /api/v1/config (HvH setup)")
            .put("/api/v1/config")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody(
                "{\"size\":5," +
                "\"hvb_starter\":\"human\"," +
                "\"hvh_starter\":\"player0\"," +
                "\"bot_id\":\"random_bot\"}"
            ))
            .check(status().is(200))
    );

    public static final ChainBuilder createHvHGame = exec(
        http("POST /api/v1/hvh/games")
            .post("/api/v1/hvh/games")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            // FIX: sin body — el servidor usa la config guardada por putConfigForHvH
            .check(status().is(200))
            .check(jsonPath("$.game_id").saveAs("hvhGameId"))
    );

    public static final ChainBuilder getHvHGame = exec(
        http("GET /api/v1/hvh/games/{id}")
            .get("/api/v1/hvh/games/#{hvhGameId}")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().is(200))
    );

    // FIX: el backend (CellMoveRequest en Rust) espera {"cell_id": N}.
    // Mismo problema que postHvBMove — coordenadas xyz no son el formato correcto.
    public static final ChainBuilder postHvHMove = exec(
        http("POST /api/v1/hvh/games/{id}/moves")
            .post("/api/v1/hvh/games/#{hvhGameId}/moves")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{\"cell_id\":#{randomInt(0,24)}}"))
            .check(status().in(200, 400, 409, 422))
    );

    public static final ChainBuilder deleteHvHGame = exec(
        http("DELETE /api/v1/hvh/games/{id}")
            .delete("/api/v1/hvh/games/#{hvhGameId}")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().in(200, 204, 404))
    );

    // ── Bot externo ───────────────────────────────────────────────────────────

    public static final ChainBuilder playExternal = exec(
        http("GET /play (bot externo)")
            .get("/play")
            .queryParam("position", "{\"size\":5,\"turn\":0,\"players\":[\"B\",\"R\"],\"layout\":\"./../.../..../.....\"}") 
            .queryParam("bot_id", "random_bot")
            .queryParam("api_version", "v1")
            .check(status().is(200))
            .check(jsonPath("$.coords").exists())
    );

    // ── Ranking (público) ─────────────────────────────────────────────────────

    // FIX: usar ruta relativa con USERS_BASE_PATH en lugar de URL absoluta.
    // Antes: Config.USERS_BASE_URL + "/ranking" era una URL completa (https://...)
    // que Gatling usaba tal cual, ignorando la baseUrl del protocolo HTTP y
    // generando peticiones fuera del contexto del test.
    public static final ChainBuilder getRanking = exec(
        http("GET /api/users/ranking")
            .get(Config.USERS_BASE_PATH + "/ranking")
            .queryParam("sortBy", "winRate")
            .queryParam("limit", "20")
            .check(status().is(200))
            .check(jsonPath("$.ranking").exists())
    );

    // ── Usuarios y Estadísticas ───────────────────────────────────────────────

    public static final ChainBuilder getUserProfile = exec(
        http("GET /api/users/{username}/profile")
            .get(Config.USERS_BASE_PATH + "/gatling-#{userId}/profile")
            .check(status().in(200, 404))
    );

    public static final ChainBuilder getUserStats = exec(
        http("GET /api/users/{username}/stats")
            .get(Config.USERS_BASE_PATH + "/gatling-#{userId}/stats")
            .check(status().in(200, 404))
    );

    public static final ChainBuilder getUserHistory = exec(
        http("GET /api/users/{username}/history")
            .get(Config.USERS_BASE_PATH + "/gatling-#{userId}/history")
            .queryParam("page", "1")
            .queryParam("pageSize", "5")
            .check(status().in(200, 404))
    );

    public static final ChainBuilder postGameHistory = exec(
        http("POST /api/users/{username}/games")
            .post(Config.USERS_BASE_PATH + "/gatling-#{userId}/games")
            .header("Content-Type", "application/json")
            .body(StringBody(
                "{\"gameId\":\"#{randomUuid()}\",\"mode\":\"classic_hvb\",\"result\":\"won\",\"opponent\":\"bot\",\"startedBy\":\"human\",\"boardSize\":5,\"totalMoves\":10}"
            ))
            .check(status().in(201, 400, 404, 409))
    );
}