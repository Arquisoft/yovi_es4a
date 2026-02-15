pub mod hvb;

use tower_http::cors::{Any, CorsLayer};
use http::Method;

use axum::{http, response::IntoResponse};

use crate::{bot_server::state::AppState, GameYError, MctsBot, RandomBot, YBotRegistry};
use std::sync::Arc;


pub fn create_router(state: AppState) -> axum::Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route("/v1/game/new", axum::routing::post(hvb::new_game))
        .route("/v1/game/hvb/move/{bot_id}", axum::routing::post(hvb::human_vs_bot_move))
        .with_state(state)
        .layer(cors)
}

pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
        // Dos bots con “dificultad” distinta
        .with_bot(Arc::new(MctsBot::new(5_000)))
        .with_bot(Arc::new(MctsBot::new(20_000)));

    AppState::new(bots)
}

pub async fn run_game_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError { message: e.to_string() })?;

    println!("Game server listening on http://{}", addr);

    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError { message: e.to_string() })?;

    Ok(())
}

pub async fn status() -> impl IntoResponse {
    "OK"
}
