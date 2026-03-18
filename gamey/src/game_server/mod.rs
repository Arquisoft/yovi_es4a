//! HTTP Game Server
//!
//! Expone endpoints para jugar desde `webapp` contra humano (HvH) o contra bot (HvB).
//! Además expone la API externa obligatoria para bots:
//! - GET /play?position=...&bot_id=...&api_version=...
//!
//! Diseñado para ser mantenible:
//! - Sesiones por `game_id` en memoria (HashMap)
//! - Identidad opcional (Guest por `X-Client-Id` hoy; User por token mañana)
//! - Config "recordada" por principal (guest/user)

pub mod auth;
pub mod config;
pub mod dto;
pub mod error;
pub mod hvb;
pub mod hvh;
pub mod play;
pub mod sessions;
pub mod state;

use axum::{Router, http, routing::{get, post}};
use http::Method;
use tower_http::cors::{Any, CorsLayer};

use state::GameServerState;

/// Límites de tablero
pub const MIN_BOARD_SIZE: u32 = 2;
pub const MAX_BOARD_SIZE: u32 = 15;

/// Versión de API
pub const API_V1: &str = "v1";

pub fn create_router(state: GameServerState) -> Router {
    // CORS abierto para desarrollo.
    // En despliegue conviene restringir a vuestro dominio.
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers(Any);

    Router::new()
        // Salud
        .route("/status", get(status))
        // API externa de competición / bots
        .route("/play", get(play::play))
        // Info para UI: límites + bots disponibles
        .route("/api/v1/meta", get(dto::get_meta))
        // Config recordada (por client_id / user)
        .route("/api/v1/config", get(config::get_config).put(config::put_config))
        // HvH
        .route("/api/v1/hvh/games", post(hvh::create_game))
        .route("/api/v1/hvh/games/{game_id}", get(hvh::get_game).delete(hvh::delete_game))
        .route("/api/v1/hvh/games/{game_id}/moves", post(hvh::post_move))
        // HvB
        .route("/api/v1/hvb/games", post(hvb::create_game))
        .route("/api/v1/hvb/games/{game_id}", get(hvb::get_game).delete(hvb::delete_game))
        .route("/api/v1/hvb/games/{game_id}/moves", post(hvb::post_human_move))
        .route("/api/v1/hvb/games/{game_id}/bot-move", post(hvb::post_bot_move))
        .route("/api/v1/hvb/games/{game_id}/hint", get(hvb::get_hint))
        .with_state(state)
        .layer(cors)
}

pub async fn status() -> &'static str {
    "OK"
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http::{Request, StatusCode};
    use tower::ServiceExt;

    #[tokio::test]
    async fn status_returns_ok_literal() {
        assert_eq!(status().await, "OK");
    }

    #[tokio::test]
    async fn router_exposes_status_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(Request::builder().uri("/status").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn router_exposes_play_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/play")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn router_exposes_meta_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/meta")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn exported_constants_have_expected_values() {
        assert_eq!(MIN_BOARD_SIZE, 2);
        assert_eq!(MAX_BOARD_SIZE, 15);
        assert_eq!(API_V1, "v1");
    }

    #[tokio::test]
    async fn unknown_route_returns_not_found() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/does-not-exist")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn router_exposes_config_get_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/config")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn router_exposes_hvh_create_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/hvh/games")
                    .method("POST")
                    .header("content-type", "application/json")
                    .header("x-client-id", "router-hvh")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn router_exposes_hvb_create_endpoint() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/v1/hvb/games")
                    .method("POST")
                    .header("content-type", "application/json")
                    .header("x-client-id", "router-hvb")
                    .body(Body::from(r#"{"size":3,"starter":"human","bot_id":"random_bot"}"#))
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }
}