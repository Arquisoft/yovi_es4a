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
 * StressSimulation — escalones 5→10→20→40→60 usuarios, 30 s cada uno.
 *
 * Ejecutar:
 *   Azure (por defecto):
 *     mvn gatling:test -Dgatling.simulationClass=yovi.StressSimulation
 *
 *   Local:
 *     YOVI_BASE_URL=http://localhost mvn gatling:test -Dgatling.simulationClass=yovi.StressSimulation
 */
public class StressSimulation extends Simulation {

    HttpProtocolBuilder httpProtocol = http
        .baseUrl(Config.BASE_URL)
        .acceptHeader("application/json")
        .contentTypeHeader("application/json")
        .followRedirect(true)
        .requestTimeout(Duration.ofSeconds(30));

    private static final List<Map<String, Object>> USERS = List.of(
        Map.of("username", Config.USERNAME,  "password", Config.PASSWORD),
        Map.of("username", Config.USERNAME2, "password", Config.PASSWORD),
        Map.of("username", Config.USERNAME3, "password", Config.PASSWORD)
    );
    private static final Random RND = new Random();

    Iterator<Map<String, Object>> userFeeder = Stream
        .generate((Supplier<Map<String, Object>>) () -> USERS.get(RND.nextInt(USERS.size())))
        .iterator();

    // ── Escenario pesado: HvB con bot ─────────────────────────────────────────

    ScenarioBuilder heavyHvBScenario = scenario("Stress — HvB bot-move")
        .feed(userFeeder)
        .exec(session -> session.set("userId", "stress-" + session.userId()))
        .exec(Requests.login)
        .pause(Duration.ofMillis(200))
        .exec(Requests.createHvBGame)
        .pause(Duration.ofMillis(200))
        .exec(Requests.postHvBMove)
        .pause(Duration.ofMillis(100))
        .exec(Requests.postBotMove)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getHvBGame)
        .exec(Requests.deleteHvBGame);

    // ── Escenario ligero: meta + ranking ──────────────────────────────────────

    ScenarioBuilder lightScenario = scenario("Stress — consultas ligeras")
        .exec(session -> session
            .set("userId",   "light-" + session.userId())
            .set("username", Config.USERNAME)
        )
        .exec(Requests.getMeta)
        .pause(Duration.ofMillis(100))
        .exec(Requests.getRanking)
        .pause(Duration.ofMillis(100))
        .exec(Requests.playExternal);

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
                incrementConcurrentUsers(5)
                    .times(5)
                    .eachLevelLasting(stepDuration)
                    .startingFrom(5)
            ),
            lightScenario.injectClosed(
                nothingFor(Duration.ofSeconds(5)),
                incrementConcurrentUsers(3)
                    .times(5)
                    .eachLevelLasting(stepDuration)
                    .startingFrom(3)
            ),
            botExternalScenario.injectOpen(
                nothingFor(Duration.ofSeconds(10)),
                atOnceUsers(5)
            )
        ).protocols(httpProtocol)
         .assertions(
             global().successfulRequests().percent().gte(90.0),
             global().responseTime().percentile(95.0).lt(5000),
             forAll().responseTime().max().lt(15000)
         );
    }
}