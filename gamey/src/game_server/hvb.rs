//! hvb.rs
//!
//! Endpoints HvB (Humano vs Bot) usando sesiones.

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use uuid::Uuid;

use crate::{GameY, Movement, PlayerId};

use super::auth::resolve_principal;
use super::dto::{
    AppliedMove, CellMoveRequest, GameMode, GameStateResponse, GameStatus, HvBStarter, Winner,
};
use super::error::ApiErrorResponse;
use super::sessions::{GameSession};
use super::state::GameServerState;

#[derive(Debug, serde::Deserialize)]
pub struct CreateHvbGameRequest {
    pub size: Option<u32>,
    pub starter: Option<HvBStarter>,
    pub bot_id: Option<String>,
}

fn parse_uuid(id: &str) -> Result<String, ApiErrorResponse> {
    Uuid::parse_str(id)
        .map(|u| u.to_string())
        .map_err(|_| ApiErrorResponse::bad_request("Invalid game_id", "invalid_game_id"))
}

/// POST /api/v1/hvb/games
pub async fn create_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Json(req): Json<CreateHvbGameRequest>,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);

    let mut cfg = state.config_store.get_or_default(&principal).await;

    if let Some(size) = req.size { cfg.size = size; }
    if let Some(starter) = req.starter { cfg.hvb_starter = starter; }
    if let Some(bot_id) = req.bot_id { cfg.bot_id = Some(bot_id); }

    let bot_id = cfg.bot_id.clone().ok_or_else(|| {
        ApiErrorResponse::bad_request("HvB requires bot_id", "missing_bot_id")
    })?;

    let bot = state.bots.find(&bot_id).ok_or_else(|| {
        ApiErrorResponse::not_found(format!("Unknown bot_id: {bot_id}"), "unknown_bot_id")
    })?;

    let mut game = GameY::new(cfg.size);

    // Si empieza el bot, aplica una jugada inicial.
    if matches!(cfg.hvb_starter, HvBStarter::Bot) {
        let bot_coords = bot.choose_move(&game).ok_or_else(|| {
            ApiErrorResponse::conflict("Bot could not choose a move", "bot_no_move")
        })?;

        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: bot_coords,
        })
        .map_err(|e| ApiErrorResponse::conflict(format!("Bot move rejected: {e}"), "bot_move_rejected"))?;
    }

    state.config_store.set(&principal, cfg.clone());

    let game_id = Uuid::new_v4().to_string();
    let session = GameSession {
        owner_key: principal.key(),
        mode: GameMode::Hvb,
        config: cfg.clone(),
        game,
        bot_id: Some(bot_id),
        hvh_next_player: None,
        hvh_winner: None,
    };

    state.sessions.insert(game_id.clone(), session.clone()).await;

    Ok(Json(GameStateResponse {
        game_id,
        mode: GameMode::Hvb,
        yen: crate::YEN::from(&session.game),
        status: GameStatus::Ongoing { next: super::dto::NextTurn::Human },
    }))
}

/// GET /api/v1/hvb/games/{game_id}
pub async fn get_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let session = state.sessions.assert_owner(&principal, &game_id).await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))?;

    Ok(Json(GameStateResponse {
        game_id,
        mode: GameMode::Hvb,
        yen: crate::YEN::from(&session.game),
        status: GameStatus::Ongoing { next: super::dto::NextTurn::Human },
    }))
}

/// DELETE /api/v1/hvb/games/{game_id}
pub async fn delete_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let _ = state.sessions.assert_owner(&principal, &game_id).await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))?;

    state.sessions.remove(&game_id).await;
    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// POST /api/v1/hvb/games/{game_id}/moves
pub async fn post_human_move(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
    Json(req): Json<CellMoveRequest>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let mut session = state.sessions.assert_owner(&principal, &game_id).await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))?;

    let size = session.game.board_size();
    let total_cells = (size * (size + 1)) / 2;
    if req.cell_id >= total_cells {
        return Err(ApiErrorResponse::bad_request("cell_id out of range", "cell_id_out_of_range"));
    }

    let bot_id = session.bot_id.clone().ok_or_else(|| {
        ApiErrorResponse::internal("Session missing bot_id", "session_invalid")
    })?;

    let bot = state.bots.find(&bot_id).ok_or_else(|| {
        ApiErrorResponse::not_found(format!("Unknown bot_id: {bot_id}"), "unknown_bot_id")
    })?;

    // 1) Jugada humana
    let human_coords = crate::Coordinates::from_index(req.cell_id, size);
    session.game.add_move(Movement::Placement {
        player: PlayerId::new(0),
        coords: human_coords,
    })
    .map_err(|e| ApiErrorResponse::conflict(format!("Human move rejected: {e}"), "move_rejected"))?;

    let human_applied = AppliedMove::new(req.cell_id, size);

    // ¿Terminó la partida tras la jugada humana?
    if session.game.check_game_over() {
        state.sessions.update(&game_id, session.clone()).await
            .map_err(|_| ApiErrorResponse::internal("Failed to update session", "session_update_failed"))?;

        return Ok(Json(serde_json::json!({
            "game_id": game_id,
            "yen": crate::YEN::from(&session.game),
            "human_move": { "cell_id": human_applied.cell_id, "coords": human_applied.coords },
            "bot_move": null,
            "status": GameStatus::Finished { winner: Winner::Human },
        })));
    }

    // 2) Jugada bot
    let bot_coords = bot.choose_move(&session.game).ok_or_else(|| {
        ApiErrorResponse::conflict("Bot could not choose a move", "bot_no_move")
    })?;

    let bot_cell_id = bot_coords.to_index(size);

    session.game.add_move(Movement::Placement {
        player: PlayerId::new(1),
        coords: bot_coords,
    })
    .map_err(|e| ApiErrorResponse::conflict(format!("Bot move rejected: {e}"), "bot_move_rejected"))?;

    let bot_applied = AppliedMove::new(bot_cell_id, size);

    state.sessions.update(&game_id, session.clone()).await
        .map_err(|_| ApiErrorResponse::internal("Failed to update session", "session_update_failed"))?;

    let status = if session.game.check_game_over() {
        GameStatus::Finished { winner: Winner::Bot }
    } else {
        GameStatus::Ongoing { next: super::dto::NextTurn::Human }
    };

    Ok(Json(serde_json::json!({
        "game_id": game_id,
        "yen": crate::YEN::from(&session.game),
        "human_move": { "cell_id": human_applied.cell_id, "coords": human_applied.coords },
        "bot_move": { "cell_id": bot_applied.cell_id, "coords": bot_applied.coords },
        "status": status,
    })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        extract::{Path, State},
        http::{HeaderMap, HeaderValue},
        Json,
    };
    use tokio::time::{sleep, Duration};

    use crate::game_server::auth::Principal;
    use crate::game_server::dto::{CellMoveRequest, GameConfig, GameMode, HvBStarter, HvHStarter, NextTurn};
    use crate::game_server::state::GameServerState;

    fn headers_with_client(client_id: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert("x-client-id", HeaderValue::from_str(client_id).unwrap());
        headers
    }

    async fn store_hvb_config(
        state: &GameServerState,
        principal: &Principal,
        size: u32,
        starter: HvBStarter,
        bot_id: Option<&str>,
    ) {
        state.config_store.set(
            principal,
            GameConfig {
                size,
                hvb_starter: starter,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: bot_id.map(|s| s.to_string()),
            },
        );
        sleep(Duration::from_millis(50)).await;
    }

    #[tokio::test]
    async fn create_game_rejects_missing_bot_id() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-missing-bot");
        let principal = Principal::Guest {
            client_id: "hvb-missing-bot".to_string(),
        };

        store_hvb_config(&state, &principal, 3, HvBStarter::Human, None).await;

        let err = create_game(
            State(state),
            headers,
            Json(CreateHvbGameRequest {
                size: None,
                starter: None,
                bot_id: None,
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "missing_bot_id");
    }

    #[tokio::test]
    async fn create_game_rejects_unknown_bot_id() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-unknown-bot");

        let err = create_game(
            State(state),
            headers,
            Json(CreateHvbGameRequest {
                size: Some(3),
                starter: Some(HvBStarter::Human),
                bot_id: Some("does_not_exist".to_string()),
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "unknown_bot_id");
    }

    #[tokio::test]
    async fn create_game_happy_path_human_starts() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-create-human");

        let res = create_game(
            State(state),
            headers,
            Json(CreateHvbGameRequest {
                size: Some(3),
                starter: Some(HvBStarter::Human),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap();

        assert!(matches!(res.0.mode, GameMode::Hvb));
        match res.0.status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Human)),
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn create_game_happy_path_bot_starts() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-create-bot");

        let res = create_game(
            State(state),
            headers,
            Json(CreateHvbGameRequest {
                size: Some(3),
                starter: Some(HvBStarter::Bot),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap();

        assert!(matches!(res.0.mode, GameMode::Hvb));
        match res.0.status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Human)),
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn get_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-invalid");

        let err = get_game(State(state), headers, Path("not-a-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn create_get_and_delete_game_happy_path() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-full");

        let created = create_game(
            State(state.clone()),
            headers.clone(),
            Json(CreateHvbGameRequest {
                size: Some(3),
                starter: Some(HvBStarter::Human),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap();

        let game_id = created.0.game_id.clone();

        let fetched = get_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();
        assert_eq!(fetched.0.game_id, game_id);

        let deleted = delete_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();
        assert_eq!(deleted.0["deleted"], true);

        let err = get_game(State(state), headers, Path(game_id)).await.unwrap_err();
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_human_move_rejects_out_of_range_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-out-of-range");
        let principal = Principal::Guest {
            client_id: "hvb-out-of-range".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvb,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: Some("random_bot".to_string()),
            hvh_next_player: None,
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 99 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "cell_id_out_of_range");
    }

    #[tokio::test]
    async fn post_human_move_rejects_missing_bot_id_in_session() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-session-invalid");
        let principal = Principal::Guest {
            client_id: "hvb-session-invalid".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvb,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: None,
            },
            game: GameY::new(2),
            bot_id: None,
            hvh_next_player: None,
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[tokio::test]
    async fn post_human_move_rejects_unknown_bot_id_in_session() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-session-unknown-bot");
        let principal = Principal::Guest {
            client_id: "hvb-session-unknown-bot".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvb,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("fake_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: Some("fake_bot".to_string()),
            hvh_next_player: None,
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "unknown_bot_id");
    }

    #[tokio::test]
    async fn post_human_move_happy_path() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-post-ok");
        let principal = Principal::Guest {
            client_id: "hvb-post-ok".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvb,
            config: GameConfig {
                size: 3,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(3),
            bot_id: Some("random_bot".to_string()),
            hvh_next_player: None,
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let res = post_human_move(
            State(state.clone()),
            headers,
            Path(game_id.clone()),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap();

        assert_eq!(res.0["game_id"], game_id);
    }

    #[tokio::test]
    async fn get_game_returns_not_found_for_existing_game_of_another_owner() {
        let state = GameServerState::new_default();

        let owner_headers = headers_with_client("owner-hvb");
        let other_headers = headers_with_client("other-hvb");

        let created = create_game(
            State(state.clone()),
            owner_headers,
            Json(CreateHvbGameRequest {
                size: Some(3),
                starter: Some(HvBStarter::Human),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap();

        let err = get_game(State(state), other_headers, Path(created.0.game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn delete_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-delete-invalid");

        let err = delete_game(State(state), headers, Path("bad-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn delete_game_returns_not_found_for_missing_game() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-delete-missing");

        let err = delete_game(
            State(state),
            headers,
            Path(uuid::Uuid::new_v4().to_string()),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_human_move_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-post-invalid");

        let err = post_human_move(
            State(state),
            headers,
            Path("not-a-uuid".to_string()),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn post_human_move_rejects_missing_game() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-post-missing");

        let err = post_human_move(
            State(state),
            headers,
            Path(uuid::Uuid::new_v4().to_string()),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_human_move_rejects_occupied_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-occupied");
        let principal = Principal::Guest {
            client_id: "hvb-occupied".to_string(),
        };

        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(0, 2),
        }).unwrap();

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvb,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game,
            bot_id: Some("random_bot".to_string()),
            hvh_next_player: None,
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::CONFLICT);
        assert_eq!(err.1.code, "move_rejected");
    }

    #[tokio::test]
    async fn create_game_persists_request_overrides_in_config_store() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-config-store");
        let principal = Principal::Guest {
            client_id: "hvb-config-store".to_string(),
        };

        let _ = create_game(
            State(state.clone()),
            headers,
            Json(CreateHvbGameRequest {
                size: Some(5),
                starter: Some(HvBStarter::Bot),
                bot_id: Some("random_bot".to_string()),
            }),
        )
        .await
        .unwrap();

        sleep(Duration::from_millis(50)).await;

        let stored = state.config_store.get_or_default(&principal).await;
        assert_eq!(stored.size, 5);
        assert!(matches!(stored.hvb_starter, HvBStarter::Bot));
        assert_eq!(stored.bot_id.as_deref(), Some("random_bot"));
    }
}