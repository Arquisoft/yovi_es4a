package yovi;

import io.gatling.javaapi.core.*;
import io.gatling.javaapi.http.*;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Iterator;
import java.util.function.Supplier;
import java.util.stream.Stream;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

/**
 * LoadSimulation — prueba de carga con múltiples usuarios concurrentes.
 *
 * Modela tres perfiles de usuario típicos de YOVI:
 *   - Visitante:    consulta meta, ranking y stats (sin login)
 *   - Jugador HvB:  hace login y juega partidas contra el bot
 *   - Jugador HvH:  hace login y crea/juega partidas contra humano
 *
 * Parámetros configurables (variables de entorno):
 *   YOVI_BASE_URL    (default: http://localhost:80)
 *   YOVI_RAMP_USERS  (default: 10)
 *   YOVI_RAMP_SECS   (default: 20)
 *   YOVI_STEADY_SECS (default: 30)
 *
 * Ejecutar:
 *   LOCAL: mvn gatling:test -Dgatling.simulationClass=yovi.LoadSimulation
 *   AZURE: YOVI_BASE_URL=https://yovies4a.duckdns.org \
 *          YOVI_RAMP_USERS=30 YOVI_RAMP_SECS=30 YOVI_STEADY_SECS=60 \
 *          mvn gatling:test -Dgatling.simulationClass=yovi.LoadSimulation
 */
public class LoadSimulation extends Simulation {

    // ── Protocolo HTTP ────────────────────────────────────────────────────────

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .shareConnections();

    // ── Feeder de usuarios de prueba ──────────────────────────────────────────

    private static final List<Map<String, Object>> USERS = List.of(
        Map.of("username", Config.USERNAME,  "password", Config.PASSWORD),
        Map.of("username", Config.USERNAME2, "password", Config.PASSWORD),
        Map.of("username", Config.USERNAME3, "password", Config.PASSWORD)
    );

    private static final Random RND = new Random();

    Iterator<Map<String, Object>> userFeeder = Stream
        .generate((Supplier<Map<String, Object>>) () -> USERS.get(RND.nextInt(USERS.size())))
        .iterator();

    // ── Escenario: Visitante (sin login) ──────────────────────────────────────

    ScenarioBuilder visitorScenario = scenario("Visitante — consultas públicas")
        .exec(session -> session
            .set("userId",   "visitor-" + session.userId())
            .set("username", Config.USERNAME)
        )
        .exec(Requests.getMeta)
        .pause(1, 2)
        .exec(Requests.getRanking)
        .pause(1, 3)
        .repeat(3).on(
            exec(Requests.getUserStats)
            .pause(Duration.ofMillis(500), Duration.ofSeconds(1))
            .exec(Requests.getUserHistory)
            .pause(1, 2)
        );

    // ── Escenario: Jugador HvB ────────────────────────────────────────────────

    ScenarioBuilder hvbPlayerScenario = scenario("Jugador HvB")
        .feed(userFeeder)
        .exec(session -> session.set("userId", "hvb-" + session.userId()))

        // Login + consultas previas
        .exec(Requests.login)
        .pause(Duration.ofMillis(500))
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(500))
        .exec(Requests.getUserStats)
        .pause(1)

        // Dos partidas por sesión
        .repeat(2).on(
            exec(Requests.createHvBGame)
            .pause(Duration.ofMillis(500))
            .exec(Requests.getHvBGame)
            .pause(Duration.ofMillis(500))
            .exec(Requests.getHint)
            .pause(1)
            // 3 turnos humano → bot
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
        )

        // Historial al terminar
        .exec(Requests.getUserHistory);

    // ── Escenario: Jugador HvH ────────────────────────────────────────────────

    ScenarioBuilder hvhPlayerScenario = scenario("Jugador HvH")
        .feed(userFeeder)
        .exec(session -> session.set("userId", "hvh-" + session.userId()))

        .exec(Requests.login)
        .pause(Duration.ofMillis(500))
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(500))

        .repeat(2).on(
            exec(Requests.createHvHGame)
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
                rampUsers(rampUsers / 2, Duration.ofSeconds(rampSecs)),
                constantUsersPerSec((double)(rampUsers / 2) / steadySecs)
                    .during(Duration.ofSeconds(steadySecs))
            ),
            // ~30% jugadores HvB
            hvbPlayerScenario.injectOpen(
                nothingFor(Duration.ofSeconds(5)),
                rampUsers(Math.max(1, (int)(rampUsers * 0.3)), Duration.ofSeconds(rampSecs))
            ),
            // ~15% jugadores HvH
            hvhPlayerScenario.injectOpen(
                nothingFor(Duration.ofSeconds(8)),
                rampUsers(Math.max(1, (int)(rampUsers * 0.15)), Duration.ofSeconds(rampSecs))
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
