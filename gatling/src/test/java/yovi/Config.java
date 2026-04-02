package yovi;

/**
 * Configuración central de las simulaciones Gatling de YOVI.
 *
 * Sobrescribe valores con variables de entorno:
 *   YOVI_BASE_URL     → URL base del gateway (local o Azure)
 *   YOVI_RAMP_USERS   → usuarios en rampa de carga
 *   YOVI_RAMP_SECS    → segundos de rampa
 *   YOVI_STEADY_SECS  → segundos en carga sostenida
 */
public class Config {

    // ── Entorno ───────────────────────────────────────────────────────────────
    // Cambia a "https://yovies4a.duckdns.org" para Azure
    public static final String BASE_URL =
System.getenv().getOrDefault("YOVI_BASE_URL", "https://localhost");

    // ── Credenciales de prueba ────────────────────────────────────────────────
    // Deben existir en la BD y estar verificados antes de ejecutar las pruebas.
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

    // ── Umbrales de aserción ──────────────────────────────────────────────────
    public static final int    RESPONSE_TIME_P95_MS = 2000;
    public static final int    RESPONSE_TIME_MAX_MS = 5000;
    public static final double SUCCESS_RATE_MIN     = 95.0;
}
