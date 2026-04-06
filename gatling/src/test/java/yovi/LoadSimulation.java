package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import java.time.Duration;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

public class LoadSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .shareConnections();

    // ── Escenario: Visitante — solo consultas públicas ─────────────────────────

    ScenarioBuilder visitorScenario = scenario("Visitante — consultas públicas")
        .exec(session -> session.set("userId", "visitor-" + session.userId()))
        .exec(Requests.getMeta)
        .pause(1, 2)
        .exec(Requests.getRanking)
        .pause(1, 3)
        .repeat(3).on(
            exec(Requests.playExternal)
            .pause(Duration.ofMillis(500), Duration.ofSeconds(1))
        );

    // ── Escenario: Jugador HvB ────────────────────────────────────────────────

    ScenarioBuilder hvbPlayerScenario = scenario("Jugador HvB")
        .exec(session -> session.set("userId", "hvb-" + session.userId()))
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(500))
        .repeat(2).on(
            exec(Requests.createHvBGame)
            .pause(Duration.ofMillis(500))
            .exec(Requests.getHvBGame)
            .pause(Duration.ofMillis(500))
            .exec(Requests.getHint)
            .pause(1)
            .repeat(3).on(
                exec(Requests.postHvBMove)
                .pause(Duration.ofMillis(500), Duration.ofSeconds(1))
                .exec(Requests.postBotMove)
                .pause(Duration.ofMillis(500), Duration.ofSeconds(1))
                .exec(Requests.getHvBGame)
                .pause(Duration.ofMillis(300))
            )
            .exec(Requests.deleteHvBGame)
            .pause(1, 3)
        );

    // ── Escenario: Jugador HvH ────────────────────────────────────────────────

    ScenarioBuilder hvhPlayerScenario = scenario("Jugador HvH")
        .exec(session -> session.set("userId", "hvh-" + session.userId()))
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(500))
        .repeat(2).on(
            // FIX: PUT /api/v1/config obligatorio antes de crear partida HvH.
            // El endpoint POST /api/v1/hvh/games no acepta body y lee la config
            // almacenada para el X-Client-Id del usuario virtual.
            exec(Requests.putConfigForHvH)
            .pause(Duration.ofMillis(200))
            .exec(Requests.createHvHGame)
            .pause(Duration.ofMillis(500))
            .exec(Requests.getHvHGame)
            .pause(Duration.ofMillis(500))
            .repeat(3).on(
                exec(Requests.postHvHMove)
                .pause(Duration.ofMillis(800), Duration.ofMillis(1500))
                .exec(Requests.getHvHGame)
                .pause(Duration.ofMillis(300))
            )
            .exec(Requests.deleteHvHGame)
            .pause(1, 2)
        );

    // ── Escenario: Bot externo ────────────────────────────────────────────────

    ScenarioBuilder botExternalScenario = scenario("Bot externo /play")
        .exec(session -> session.set("userId", "bot-" + session.userId()))
        .repeat(5).on(
            exec(Requests.playExternal)
            .pause(Duration.ofMillis(500))
        );

    // ── Inyección de carga ────────────────────────────────────────────────────

    {
        int rampUsers  = Config.RAMP_USERS;
        int rampSecs   = Config.RAMP_SECS;
        int steadySecs = Config.STEADY_SECS;

        setUp(
            // ~50% visitantes
            visitorScenario.injectOpen(
                rampUsers(rampUsers / 2).during(Duration.ofSeconds(rampSecs)),
                constantUsersPerSec((double)(rampUsers / 2) / steadySecs)
                    .during(Duration.ofSeconds(steadySecs))
            ),
            // ~30% jugadores HvB
            hvbPlayerScenario.injectOpen(
                nothingFor(Duration.ofSeconds(5)),
                rampUsers(Math.max(1, (int)(rampUsers * 0.3))).during(Duration.ofSeconds(rampSecs))
            ),
            // ~15% jugadores HvH
            hvhPlayerScenario.injectOpen(
                nothingFor(Duration.ofSeconds(8)),
                rampUsers(Math.max(1, (int)(rampUsers * 0.15))).during(Duration.ofSeconds(rampSecs))
            ),
            // ~5% bots externos
            botExternalScenario.injectOpen(
                nothingFor(Duration.ofSeconds(3)),
                atOnceUsers(Math.max(1, (int)(rampUsers * 0.05)))
            )
        ).protocols(httpProtocol)
         .assertions(
             global().responseTime().percentile(95.0).lt(Config.RESPONSE_TIME_P95_MS),
             global().responseTime().max().lt(Config.RESPONSE_TIME_MAX_MS),
             global().successfulRequests().percent().gte(Config.SUCCESS_RATE_MIN)
         );
    }
}