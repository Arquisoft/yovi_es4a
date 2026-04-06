package yovi;

public class Config {

    // ── Entorno ───────────────────────────────────────────────────────────────
    public static final String BASE_URL =
        System.getenv().getOrDefault("YOVI_BASE_URL", "https://yovies4a.duckdns.org");

    // FIX: ruta relativa — Gatling la concatena sobre BASE_URL automáticamente.
    // Antes era BASE_URL + "/api/users" (URL absoluta), lo que hacía que
    // getRanking ignorase la baseUrl configurada en el protocolo HTTP.
    public static final String USERS_BASE_PATH =
        System.getenv().getOrDefault("YOVI_USERS_PATH", "/api/users");

    // ── Credenciales de prueba ────────────────────────────────────────────────
    public static final String USERNAME  = "gatling_user1";
    public static final String PASSWORD  = "Password1!";
    public static final String USERNAME2 = "gatling_user2";
    public static final String USERNAME3 = "gatling_user3";

    // ── Parámetros de carga ───────────────────────────────────────────────────
    public static final int RAMP_USERS  =
        Integer.parseInt(System.getenv().getOrDefault("YOVI_RAMP_USERS",  "10"));
    public static final int RAMP_SECS   =
        Integer.parseInt(System.getenv().getOrDefault("YOVI_RAMP_SECS",   "20"));
    public static final int STEADY_SECS =
        Integer.parseInt(System.getenv().getOrDefault("YOVI_STEADY_SECS", "30"));

    // ── Umbrales ──────────────────────────────────────────────────────────────
    public static final int    RESPONSE_TIME_P95_MS = 2000;
    public static final int    RESPONSE_TIME_MAX_MS = 5000;
    public static final double SUCCESS_RATE_MIN     = 95.0;
}