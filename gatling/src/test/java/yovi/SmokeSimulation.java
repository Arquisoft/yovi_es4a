package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import java.time.Duration;

public class SmokeSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json");

    ScenarioBuilder smokeScenario = scenario("Smoke — recorrido completo")
        .exec(session -> session.set("userId", "smoke-001"))

        // 1. Meta + Config
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getConfig)
        .pause(Duration.ofMillis(300))

        // 2. Ranking y Usuarios
        .exec(Requests.getRanking)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getUserProfile)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getUserStats)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getUserHistory)
        .pause(Duration.ofMillis(300))

        // 3. Bot externo
        .exec(Requests.playExternal)
        .pause(Duration.ofMillis(300))

        // 4. Partida HvB completa: crear → leer → hint → mover → bot → borrar
        .exec(Requests.createHvBGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getHvBGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getHint)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postHvBMove)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postBotMove)
        .pause(Duration.ofMillis(300))
        .exec(Requests.deleteHvBGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postGameHistory)
        .pause(Duration.ofMillis(300))

        // 5. Partida HvH completa: configurar → crear → leer → mover → borrar
        // FIX: putConfigForHvH es obligatorio antes de createHvHGame porque
        // el endpoint POST /api/v1/hvh/games lee la config guardada del cliente,
        // no acepta parámetros en el body.
        .exec(Requests.putConfigForHvH)
        .pause(Duration.ofMillis(200))
        .exec(Requests.createHvHGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getHvHGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postHvHMove)
        .pause(Duration.ofMillis(300))
        .exec(Requests.deleteHvHGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postGameHistory);

    {
        setUp(
            smokeScenario.injectOpen(atOnceUsers(1))
        ).protocols(httpProtocol)
         .assertions(
             global().failedRequests().count().is(0L),
             global().responseTime().max().lt(Config.RESPONSE_TIME_MAX_MS)
         );
    }
}