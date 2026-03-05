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