package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * SmokeSimulation — 1 usuario, recorre todos los endpoints una vez.
 *
 * Objetivo: verificar que el stack arranca y responde correctamente
 * antes de lanzar pruebas de carga más pesadas.
 *
 * Ejecutar:
 *   LOCAL: mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation
 *   AZURE: YOVI_BASE_URL=https://yovies4a.duckdns.org \
 *          mvn gatling:test -Dgatling.simulationClass=yovi.SmokeSimulation
 */
public class SmokeSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json");

    ScenarioBuilder smokeScenario = scenario("Smoke — recorrido completo")
        // Inyectar datos de sesión manualmente
        .exec(session -> session
            .set("username", Config.USERNAME)
            .set("password", Config.PASSWORD)
            .set("userId",   "smoke-001")
        )

        // 1. Meta
        .exec(Requests.getMeta)
        .pause(300)

        // 2. Config
        .exec(Requests.getConfig)
        .pause(300)

        // 3. Auth
        .exec(Requests.login)
        .pause(300)

        // 4. Stats, historial y ranking
        .exec(Requests.getUserStats)
        .pause(300)
        .exec(Requests.getUserHistory)
        .pause(300)
        .exec(Requests.getRanking)
        .pause(300)

        // 5. Bot externo
        .exec(Requests.playExternal)
        .pause(300)

        // 6. Partida HvB completa: crear → leer → hint → mover → bot → borrar
        .exec(Requests.createHvBGame)
        .pause(300)
        .exec(Requests.getHvBGame)
        .pause(300)
        .exec(Requests.getHint)
        .pause(300)
        .exec(Requests.postHvBMove)
        .pause(300)
        .exec(Requests.postBotMove)
        .pause(300)
        .exec(Requests.deleteHvBGame)
        .pause(300)

        // 7. Partida HvH completa: crear → leer → mover → borrar
        .exec(Requests.createHvHGame)
        .pause(300)
        .exec(Requests.getHvHGame)
        .pause(300)
        .exec(Requests.postHvHMove)
        .pause(300)
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
