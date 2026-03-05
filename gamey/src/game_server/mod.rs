pub mod hvb;

use tower_http::cors::{Any, CorsLayer};
use http::Method;

use axum::{http, response::IntoResponse};

use crate::{bot_server::state::AppState, GameYError, MctsBot, RandomBot, YBotRegistry};
use std::sync::Arc;

use serde::Serialize;

pub const MIN_BOARD_SIZE: u32 = 2;
pub const MAX_BOARD_SIZE: u32 = 15;

#[derive(Serialize)]
pub struct GameConfigResponse {
    pub min_board_size: u32,
    pub max_board_size: u32,
}

pub fn create_router(state: AppState) -> axum::Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route("/v1/game/config", axum::routing::get(get_config))
        .route("/v1/game/new", axum::routing::post(hvb::new_game))
        .route("/v1/game/hvb/new/{bot_id}", axum::routing::post(hvb::new_hvb_game))
        .route("/v1/game/hvb/move/{bot_id}", axum::routing::post(hvb::human_vs_bot_move))
        .with_state(state)
        .layer(cors)
}

pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new()
        .with_bot(Arc::new(RandomBot))
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

pub async fn get_config() -> impl IntoResponse {
    axum::Json(GameConfigResponse {
        min_board_size: MIN_BOARD_SIZE,
        max_board_size: MAX_BOARD_SIZE,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    use axum::body::Body;
    use http::Request;
    use http_body_util::BodyExt;
    use tower::ServiceExt; // for `oneshot`

    #[test]
    fn create_default_state_registers_expected_bots() {
        let state = create_default_state();
        let names = state.bots().names();

        assert!(names.contains(&"random_bot".to_string()));
        assert!(names.contains(&"mcts_bot".to_string()));
        assert_eq!(names.len(), 2);
    }

    #[tokio::test]
    async fn router_status_endpoint_returns_ok() {
        let app = create_router(create_default_state());

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/status")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), http::StatusCode::OK);

        let body = response.into_body().collect().await.unwrap().to_bytes();
        let text = String::from_utf8(body.to_vec()).unwrap();
        assert_eq!(text, "OK");
    }

    #[tokio::test]
    async fn router_get_config_returns_expected_min_max() {
        use axum::body::Body;
        use http::Request;
        use http_body_util::BodyExt;
        use tower::ServiceExt;

        let app = create_router(create_default_state());

        let response = app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/game/config")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), http::StatusCode::OK);

        let body = response.into_body().collect().await.unwrap().to_bytes();

        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(
            json.get("min_board_size").and_then(|v| v.as_u64()).unwrap(),
            MIN_BOARD_SIZE as u64
        );
        assert_eq!(
            json.get("max_board_size").and_then(|v| v.as_u64()).unwrap(),
            MAX_BOARD_SIZE as u64
        );
    }
}
