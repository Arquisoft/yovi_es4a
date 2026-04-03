package yovi;

import io.gatling.javaapi.core.ChainBuilder;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

public class Requests {

    // ── Auth ──────────────────────────────────────────────────────────────────

    public static final ChainBuilder login = exec(
        http("Login")
            .post("/api/users/login")
            .header("Content-Type", "application/json")
            .body(StringBody("{\"username\":\"#{username}\",\"password\":\"#{password}\"}"))
            .check(status().is(200))
            .check(jsonPath("$.username").saveAs("loggedUser"))
    );

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

    public static final ChainBuilder postHvBMove = exec(
        http("POST /api/v1/hvb/games/{id}/moves")
            .post("/api/v1/hvb/games/#{hvbGameId}/moves")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{\"x\":0,\"y\":0,\"z\":0}"))
            .check(status().in(200, 409, 422))
    );

    public static final ChainBuilder postBotMove = exec(
        http("POST /api/v1/hvb/games/{id}/bot-move")
            .post("/api/v1/hvb/games/#{hvbGameId}/bot-move")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{}"))
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

    public static final ChainBuilder createHvHGame = exec(
        http("POST /api/v1/hvh/games")
            .post("/api/v1/hvh/games")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{\"size\":5,\"starter\":\"player0\"}"))
            .check(status().is(200))
            .check(jsonPath("$.game_id").saveAs("hvhGameId"))
    );

    public static final ChainBuilder getHvHGame = exec(
        http("GET /api/v1/hvh/games/{id}")
            .get("/api/v1/hvh/games/#{hvhGameId}")
            .header("X-Client-Id", "gatling-#{userId}")
            .check(status().is(200))
    );

    public static final ChainBuilder postHvHMove = exec(
        http("POST /api/v1/hvh/games/{id}/moves")
            .post("/api/v1/hvh/games/#{hvhGameId}/moves")
            .header("Content-Type", "application/json")
            .header("X-Client-Id", "gatling-#{userId}")
            .body(StringBody("{\"x\":0,\"y\":0,\"z\":0}"))
            .check(status().in(200, 409, 422))
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
        .get("/play?position=%7B%22size%22%3A5%2C%22layout%22%3A%220000000000000000000000000%22%2C%22turn%22%3A0%7D&bot_id=random&api_version=v1")
        .check(status().is(200))
        .check(jsonPath("$.coords").exists())
);
    // ── Users service ─────────────────────────────────────────────────────────

    public static final ChainBuilder getUserStats = exec(
        http("GET /users/{username}/stats")
            .get("/api/users/users/#{username}/stats")
            .check(status().in(200, 404))
    );

    public static final ChainBuilder getUserHistory = exec(
        http("GET /users/{username}/history")
            .get("/api/users/users/#{username}/history")
            .queryParam("page", "1")
            .queryParam("pageSize", "5")
            .check(status().in(200, 404))
    );

    public static final ChainBuilder getRanking = exec(
        http("GET /ranking")
            .get("/api/users/ranking")
            .queryParam("sortBy", "winRate")
            .queryParam("limit", "20")
            .check(status().is(200))
            .check(jsonPath("$.ranking").exists())
    );
}