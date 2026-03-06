//! config.rs
//!
//! Config "recordada" por principal.

use axum::{extract::{State}, http::HeaderMap, Json};

use super::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};
use super::auth::resolve_principal;
use super::dto::{GameConfig, HvBStarter};
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

    if matches!(cfg.hvb_starter, HvBStarter::Bot) && cfg.bot_id.is_none() {
        return Err(ApiErrorResponse::bad_request(
            "starter=bot requires bot_id",
            "missing_bot_id",
        ));
    }

    let principal = resolve_principal(&headers);

    state.config_store.set(&principal, cfg.clone());

    Ok(Json(cfg))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::State;
    use axum::http::{HeaderMap, HeaderValue};
    use tokio::time::{sleep, Duration};

    use crate::game_server::dto::{GameConfig, HvBStarter, HvHStarter};
    use crate::game_server::state::GameServerState;

    fn headers_with_client(client_id: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("x-client-id", HeaderValue::from_str(client_id).unwrap());
        headers
    }

    #[tokio::test]
    async fn get_config_returns_default_when_not_stored() {
        let state = GameServerState::new_default();

        let res = get_config(State(state), headers_with_client("cfg-default"))
            .await
            .unwrap();

        assert_eq!(res.0.size, 7);
        assert!(matches!(res.0.hvb_starter, HvBStarter::Human));
        assert_eq!(res.0.bot_id.as_deref(), Some("random_bot"));
        assert!(matches!(res.0.hvh_starter, Some(HvHStarter::Player0)));
    }

    #[tokio::test]
    async fn put_config_rejects_size_below_min() {
        let state = GameServerState::new_default();

        let err = put_config(
            State(state),
            headers_with_client("cfg-min"),
            Json(GameConfig {
                size: MIN_BOARD_SIZE - 1,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_board_size");
    }

    #[tokio::test]
    async fn put_config_rejects_size_above_max() {
        let state = GameServerState::new_default();

        let err = put_config(
            State(state),
            headers_with_client("cfg-max"),
            Json(GameConfig {
                size: MAX_BOARD_SIZE + 1,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_board_size");
    }

    #[tokio::test]
    async fn put_config_rejects_bot_starter_without_bot_id() {
        let state = GameServerState::new_default();

        let err = put_config(
            State(state),
            headers_with_client("cfg-missing-bot"),
            Json(GameConfig {
                size: 7,
                hvb_starter: HvBStarter::Bot,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: None,
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "missing_bot_id");
    }

    #[tokio::test]
    async fn put_config_stores_and_returns_config() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("cfg-store");

        let cfg = GameConfig {
            size: 9,
            hvb_starter: HvBStarter::Bot,
            hvh_starter: Some(HvHStarter::Player1),
            bot_id: Some("random_bot".to_string()),
        };

        let res = put_config(State(state.clone()), headers.clone(), Json(cfg.clone()))
            .await
            .unwrap();

        assert_eq!(res.0.size, 9);
        assert!(matches!(res.0.hvb_starter, HvBStarter::Bot));
        assert!(matches!(res.0.hvh_starter, Some(HvHStarter::Player1)));
        assert_eq!(res.0.bot_id.as_deref(), Some("random_bot"));

        sleep(Duration::from_millis(50)).await;

        let stored = get_config(State(state), headers).await.unwrap();
        assert_eq!(stored.0.size, 9);
        assert!(matches!(stored.0.hvb_starter, HvBStarter::Bot));
        assert!(matches!(stored.0.hvh_starter, Some(HvHStarter::Player1)));
        assert_eq!(stored.0.bot_id.as_deref(), Some("random_bot"));
    }
}