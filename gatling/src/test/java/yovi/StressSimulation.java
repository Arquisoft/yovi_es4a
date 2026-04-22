package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

public class StressSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json");

    // ── Escenario pesado: HvB con bot ─────────────────────────────────────────
    // postHvBMove ahora envía {"cell_id": #{randomInt(0,24)}}
    // para evitar colisiones excesivas y que el motor trabaje procesando movimientos reales.

    ScenarioBuilder heavyHvBScenario = scenario("Stress — HvB bot-move")
        .exec(session -> session.set("userId", "stress-" + session.userId()))
        .exec(Requests.createHvBGame)
        .pause(Duration.ofMillis(200))
        .exec(Requests.postHvBMove)
        .pause(Duration.ofMillis(100))
        .exec(Requests.postBotMove)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getHvBGame)
        .exec(Requests.deleteHvBGame);

    // ── Escenario ligero: meta + ranking + bot externo ────────────────────────
    // FIX heredado de Requests.java: getRanking ahora usa ruta relativa
    // /api/users/ranking en lugar de URL absoluta, por lo que la petición
    // llega correctamente a través del nginx de la VM.

    ScenarioBuilder lightScenario = scenario("Stress — consultas ligeras")
        .exec(session -> session.set("userId", "light-" + session.userId()))
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getRanking)
        .pause(Duration.ofMillis(100))
        .exec(Requests.playExternal)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getUserProfile)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getUserStats)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getUserHistory);

    // ── Escenario: bot externo en ráfaga ──────────────────────────────────────

    ScenarioBuilder botExternalScenario = scenario("Stress — /play ráfaga")
        .exec(session -> session.set("userId", "ext-" + session.userId()))
        .repeat(10).on(
            exec(Requests.playExternal)
            .pause(Duration.ofMillis(50))
        );

    // ── Inyección en escalones ────────────────────────────────────────────────
    {
        Duration stepDuration = Duration.ofSeconds(30);

        setUp(
            heavyHvBScenario.injectClosed(
                incrementConcurrentUsers(10)
                    .times(5)
                    .eachLevelLasting(stepDuration)
                    .startingFrom(10)
            ),
            lightScenario.injectClosed(
                constantConcurrentUsers(0).during(Duration.ofSeconds(5)),
                incrementConcurrentUsers(15)
                    .times(5)
                    .eachLevelLasting(stepDuration)
                    .startingFrom(15)
            ),
            botExternalScenario.injectOpen(
                nothingFor(Duration.ofSeconds(10)),
                atOnceUsers(20)
            )
        ).protocols(httpProtocol)
         .assertions(
             global().successfulRequests().percent().gte(90.0),
             global().responseTime().percentile(95.0).lt(5000),
             forAll().responseTime().max().lt(15000)
         );
    }
}