//! hvh.rs
//!
//! Endpoints HvH (Humano vs Humano) usando sesiones.

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use uuid::Uuid;

use crate::{GameY, Movement, PlayerId};

use super::auth::resolve_principal;
use super::dto::{AppliedMove, CellMoveRequest, GameMode, GameStateResponse, GameStatus};
use super::error::ApiErrorResponse;
// use super::sessions::{GameSession, SessionStore};
use super::sessions::{GameSession};
use super::state::GameServerState;

fn parse_uuid(id: &str) -> Result<String, ApiErrorResponse> {
    Uuid::parse_str(id)
        .map(|u| u.to_string())
        .map_err(|_| ApiErrorResponse::bad_request("Invalid game_id", "invalid_game_id"))
}

/// POST /api/v1/hvh/games
pub async fn create_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let cfg = state.config_store.get_or_default(&principal).await;

    let next_player = match cfg.hvh_starter {
        Some(super::dto::HvHStarter::Player1) => 1,
        _ => 0,
    };

    let game = GameY::new(cfg.size);
    let game_id = Uuid::new_v4().to_string();

    let session = GameSession {
        owner_key: principal.key(),
        mode: GameMode::Hvh,
        config: cfg.clone(),
        game,
        bot_id: None,
        hvh_next_player: Some(next_player),
        hvh_winner: None,
    };

    state.sessions.insert(game_id.clone(), session.clone()).await;

    let next = if next_player == 1 {
        super::dto::NextTurn::Player1
    } else {
        super::dto::NextTurn::Player0
    };

   Ok(Json(GameStateResponse {
        game_id,
        mode: GameMode::Hvh,
        yen: crate::YEN::from(&session.game),
        status: GameStatus::Ongoing { next },
    }))
}

/// GET /api/v1/hvh/games/{game_id}
pub async fn get_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let session = state
        .sessions
        .assert_owner(&principal, &game_id)
        .await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))?;

    let finished = session.game.check_game_over();

    Ok(Json(GameStateResponse {
        game_id,
        mode: GameMode::Hvh,
        yen: crate::YEN::from(&session.game),
        status: super::dto::status_hvh_from_session(
            finished,
            session.hvh_next_player.unwrap_or(0),
            session.hvh_winner,
        ),
    }))
}

/// DELETE /api/v1/hvh/games/{game_id}
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

/// POST /api/v1/hvh/games/{game_id}/moves
pub async fn post_move(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
    Json(req): Json<CellMoveRequest>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let mut session = state
        .sessions
        .assert_owner(&principal, &game_id)
        .await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))?;

    let size = session.game.board_size();
    let total_cells = (size * (size + 1)) / 2;
    if req.cell_id >= total_cells {
        return Err(ApiErrorResponse::bad_request(
            "cell_id out of range",
            "cell_id_out_of_range",
        ));
    }

    if session.game.check_game_over() {
        return Err(ApiErrorResponse::conflict(
            "Game is already finished",
            "game_finished",
        ));
    }

    let played_by = session.hvh_next_player.unwrap_or(0);
    let player = PlayerId::new(played_by as u32);

    let coords = crate::Coordinates::from_index(req.cell_id, size);

    session
        .game
        .add_move(Movement::Placement { player, coords })
        .map_err(|e| ApiErrorResponse::conflict(format!("Move rejected: {e}"), "move_rejected"))?;

    let finished = session.game.check_game_over();

    if finished {
        session.hvh_winner = Some(played_by);
    } else {
        session.hvh_next_player = Some(1 - played_by);
    }

    state
        .sessions
        .update(&game_id, session.clone())
        .await
        .map_err(|_| ApiErrorResponse::internal("Failed to update session", "session_update_failed"))?;

    let status = super::dto::status_hvh_from_session(
        finished,
        session.hvh_next_player.unwrap_or(0),
        session.hvh_winner,
    );

    let applied = AppliedMove::new(req.cell_id, size);

    Ok(Json(serde_json::json!({
        "game_id": game_id,
        "yen": crate::YEN::from(&session.game),
        "applied_move": { "cell_id": applied.cell_id, "coords": applied.coords },
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

    async fn store_hvh_config(
        state: &GameServerState,
        principal: &Principal,
        size: u32,
        starter: Option<HvHStarter>,
    ) {
        state.config_store.set(
            principal,
            GameConfig {
                size,
                hvb_starter: HvBStarter::Human,
                hvh_starter: starter,
                bot_id: Some("random_bot".to_string()),
            },
        );
        sleep(Duration::from_millis(50)).await;
    }

    #[tokio::test]
    async fn create_game_uses_player0_by_default() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-create-default");
        let principal = Principal::Guest {
            client_id: "hvh-create-default".to_string(),
        };

        store_hvh_config(&state, &principal, 3, Some(HvHStarter::Player0)).await;

        let res = create_game(State(state), headers).await.unwrap();

        assert!(matches!(res.0.mode, GameMode::Hvh));
        match res.0.status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Player0)),
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn create_game_uses_player1_when_configured() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-create-p1");
        let principal = Principal::Guest {
            client_id: "hvh-create-p1".to_string(),
        };

        store_hvh_config(&state, &principal, 3, Some(HvHStarter::Player1)).await;

        let res = create_game(State(state), headers).await.unwrap();

        assert!(matches!(res.0.mode, GameMode::Hvh));
        match res.0.status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Player1)),
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn get_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-invalid");

        let err = get_game(State(state), headers, Path("not-a-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn get_game_returns_not_found_for_missing_session() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-missing");
        let game_id = uuid::Uuid::new_v4().to_string();

        let err = get_game(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn create_get_and_delete_game_happy_path() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-full");
        let principal = Principal::Guest {
            client_id: "hvh-full".to_string(),
        };

        store_hvh_config(&state, &principal, 3, Some(HvHStarter::Player0)).await;

        let created = create_game(State(state.clone()), headers.clone()).await.unwrap();
        let game_id = created.0.game_id.clone();

        let fetched = get_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();

        assert_eq!(fetched.0.game_id, game_id);
        assert!(matches!(fetched.0.mode, GameMode::Hvh));

        let deleted = delete_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();
        assert_eq!(deleted.0["deleted"], true);

        let err = get_game(State(state), headers, Path(game_id)).await.unwrap_err();
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_move_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-post-invalid");

        let err = post_move(
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
    async fn post_move_rejects_missing_game() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-post-missing");
        let game_id = uuid::Uuid::new_v4().to_string();

        let err = post_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_move_rejects_out_of_range_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-out-of-range");
        let principal = Principal::Guest {
            client_id: "hvh-out-of-range".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: None,
            hvh_next_player: Some(0),
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_move(
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
    async fn post_move_applies_valid_move() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-move-ok");
        let principal = Principal::Guest {
            client_id: "hvh-move-ok".to_string(),
        };

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: None,
            hvh_next_player: Some(0),
            hvh_winner: None,
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        state.sessions.insert(game_id.clone(), session).await;

        let res = post_move(
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

        let owner_headers = headers_with_client("owner-hvh");
        let other_headers = headers_with_client("other-hvh");
        let owner = Principal::Guest {
            client_id: "owner-hvh".to_string(),
        };

        store_hvh_config(&state, &owner, 3, Some(HvHStarter::Player0)).await;

        let created = create_game(State(state.clone()), owner_headers).await.unwrap();
        let game_id = created.0.game_id;

        let err = get_game(State(state), other_headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn delete_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-delete-invalid");

        let err = delete_game(State(state), headers, Path("bad-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn delete_game_returns_not_found_for_other_owner() {
        let state = GameServerState::new_default();

        let owner_headers = headers_with_client("owner-delete-hvh");
        let other_headers = headers_with_client("other-delete-hvh");
        let owner = Principal::Guest {
            client_id: "owner-delete-hvh".to_string(),
        };

        store_hvh_config(&state, &owner, 3, Some(HvHStarter::Player0)).await;

        let created = create_game(State(state.clone()), owner_headers).await.unwrap();
        let game_id = created.0.game_id;

        let err = delete_game(State(state), other_headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn get_game_uses_player0_when_next_player_is_none() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-next-none");
        let principal = Principal::Guest {
            client_id: "hvh-next-none".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: None,
            hvh_next_player: None,
            hvh_winner: None,
        };

        state.sessions.insert(game_id.clone(), session).await;

        let res = get_game(State(state), headers, Path(game_id))
            .await
            .unwrap();

        match res.0.status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Player0)),
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn get_game_returns_finished_with_player1_winner() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-finished-p1");
        let principal = Principal::Guest {
            client_id: "hvh-finished-p1".to_string(),
        };

        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(0, 2),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: crate::Coordinates::from_index(1, 2),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(2, 2),
        }).unwrap();

        let game_id = uuid::Uuid::new_v4().to_string();

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game,
            bot_id: None,
            hvh_next_player: Some(0),
            hvh_winner: Some(1),
        };

        state.sessions.insert(game_id.clone(), session).await;

        let res = get_game(State(state), headers, Path(game_id))
            .await
            .unwrap();

        match res.0.status {
            GameStatus::Finished { winner } => {
                assert!(matches!(winner, super::super::dto::Winner::Player1))
            }
            _ => panic!("expected finished"),
        }
    }

    #[tokio::test]
    async fn post_move_rejects_finished_game() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-finished-move");
        let principal = Principal::Guest {
            client_id: "hvh-finished-move".to_string(),
        };

        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(0, 2),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: crate::Coordinates::from_index(1, 2),
        }).unwrap();
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(2, 2),
        }).unwrap();

        let game_id = uuid::Uuid::new_v4().to_string();

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game,
            bot_id: None,
            hvh_next_player: Some(0),
            hvh_winner: Some(0),
        };

        state.sessions.insert(game_id.clone(), session).await;

        let err = post_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, axum::http::StatusCode::CONFLICT);
        assert_eq!(err.1.code, "game_finished");
    }

    #[tokio::test]
    async fn post_move_rejects_occupied_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvh-occupied");
        let principal = Principal::Guest {
            client_id: "hvh-occupied".to_string(),
        };

        let mut game = GameY::new(2);
        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: crate::Coordinates::from_index(0, 2),
        }).unwrap();

        let game_id = uuid::Uuid::new_v4().to_string();

        let session = GameSession {
            owner_key: principal.key(),
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 2,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game,
            bot_id: None,
            hvh_next_player: Some(1),
            hvh_winner: None,
        };

        state.sessions.insert(game_id.clone(), session).await;

        let err = post_move(
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
}