//! config.rs
//!
//! Config "recordada" por principal.

use axum::{extract::{State}, http::HeaderMap, Json};

use super::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};
use super::auth::resolve_principal;
use super::dto::{GameConfig, Starter};
use super::error::ApiErrorResponse;
use super::state::GameServerState;

/// GET /api/v1/config
pub async fn get_config(
    State(state): State<GameServerState>,
    headers: HeaderMap,
) -> Result<Json<GameConfig>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);

    let cfg = state.config_store.get_or_default(&principal).await;
    Ok(Json(cfg))
}

/// PUT /api/v1/config
pub async fn put_config(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Json(cfg): Json<GameConfig>,
) -> Result<Json<GameConfig>, ApiErrorResponse> {
    // Validación básica de size.
    if cfg.size < MIN_BOARD_SIZE || cfg.size > MAX_BOARD_SIZE {
        return Err(ApiErrorResponse::bad_request(
            format!("Board size must be between {MIN_BOARD_SIZE} and {MAX_BOARD_SIZE}"),
            "invalid_board_size",
        ));
    }

    if matches!(cfg.starter, Starter::Bot) && cfg.bot_id.is_none() {
        return Err(ApiErrorResponse::bad_request(
            "starter=bot requires bot_id",
            "missing_bot_id",
        ));
    }

    let principal = resolve_principal(&headers);

    state.config_store.set(&principal, cfg.clone());

    Ok(Json(cfg))
}