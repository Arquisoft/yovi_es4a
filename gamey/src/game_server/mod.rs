//! HTTP Game Server
//!
//! Expone endpoints para jugar desde `webapp` contra humano (HvH) o contra bot (HvB).
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
pub mod sessions;
pub mod state;

use axum::{Router, http, routing::{get, post}};
use http::Method;
use tower_http::cors::{Any, CorsLayer};

use crate::gamey_error::GameYError;
use state::GameServerState;

/// Límites de tablero (ajústalos a lo que queráis permitir en UI).
pub const MIN_BOARD_SIZE: u32 = 2;
pub const MAX_BOARD_SIZE: u32 = 15;

/// Versión de API (simple y explícita).
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
        .with_state(state)
        .layer(cors)
}

pub async fn status() -> &'static str {
    "OK"
}

pub async fn run_game_server(port: u16) -> Result<(), GameYError> {
    let state = GameServerState::new_default();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError { message: e.to_string() })?;

    println!("Game server listening on http://{addr}");

    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError { message: e.to_string() })?;

    Ok(())
}