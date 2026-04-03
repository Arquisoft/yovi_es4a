package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import java.time.Duration;

/**
 * SmokeSimulation — 1 usuario, recorre todos los endpoints una vez.
 *
 * Ejecutar:
 *   Azure (por defecto):
 *     mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation
 *
 *   Local (docker compose up):
 *     YOVI_BASE_URL=http://localhost mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation
 */
public class SmokeSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
    .baseUrl(Config.BASE_URL)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json");
    
    ScenarioBuilder smokeScenario = scenario("Smoke — recorrido completo")
        .exec(session -> session
            .set("username", Config.USERNAME)
            .set("password", Config.PASSWORD)
            .set("userId",   "smoke-001")
        )

        // 1. Meta
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(300))

        // 2. Config
        .exec(Requests.getConfig)
        .pause(Duration.ofMillis(300))

        // 3. Auth
        .exec(Requests.login)
        .pause(Duration.ofMillis(300))

        // 4. Stats, historial y ranking
        .exec(Requests.getUserStats)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getUserHistory)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getRanking)
        .pause(Duration.ofMillis(300))

        // 5. Bot externo
        .exec(Requests.playExternal)
        .pause(Duration.ofMillis(300))

        // 6. Partida HvB completa: crear → leer → hint → mover → bot → borrar
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

        // 7. Partida HvH completa: crear → leer → mover → borrar
        .exec(Requests.createHvHGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.getHvHGame)
        .pause(Duration.ofMillis(300))
        .exec(Requests.postHvHMove)
        .pause(Duration.ofMillis(300))
        .exec(Requests.deleteHvHGame);

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