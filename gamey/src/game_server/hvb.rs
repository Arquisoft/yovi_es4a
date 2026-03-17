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

use super::auth::{resolve_principal, Principal};
use super::dto::{
    status_hvb, AppliedMove, CellMoveRequest, GameMode, GameStateResponse, HvBStarter, Winner,
};
use super::error::ApiErrorResponse;
use super::sessions::GameSession;
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

async fn load_owned_session(
    state: &GameServerState,
    principal: &Principal,
    game_id: &str,
) -> Result<GameSession, ApiErrorResponse> {
    state
        .sessions
        .assert_owner(principal, game_id)
        .await
        .map_err(|_| ApiErrorResponse::not_found("Game not found", "game_not_found"))
}

async fn save_session(
    state: &GameServerState,
    game_id: &str,
    session: GameSession,
) -> Result<(), ApiErrorResponse> {
    state
        .sessions
        .update(game_id, session)
        .await
        .map_err(|_| ApiErrorResponse::internal("Failed to update session", "session_update_failed"))
}

fn validate_cell_id(cell_id: u32, size: u32) -> Result<(), ApiErrorResponse> {
    let total_cells = (size * (size + 1)) / 2;
    if cell_id >= total_cells {
        return Err(ApiErrorResponse::bad_request(
            "cell_id out of range",
            "cell_id_out_of_range",
        ));
    }
    Ok(())
}

fn ensure_hvb_session(session: &GameSession) -> Result<(), ApiErrorResponse> {
    if session.mode != GameMode::Hvb {
        return Err(ApiErrorResponse::conflict(
            "Game is not HvB",
            "invalid_game_mode",
        ));
    }

    if session.hvb_winner.is_some() {
        return Err(ApiErrorResponse::conflict(
            "Game already finished",
            "game_finished",
        ));
    }

    Ok(())
}

fn current_hvb_status(session: &GameSession) -> super::dto::GameStatus {
    status_hvb(
        session.hvb_next_is_human.unwrap_or(true),
        session.hvb_winner,
    )
}

fn hvb_state_response(game_id: String, session: &GameSession) -> GameStateResponse {
    GameStateResponse {
        game_id,
        mode: GameMode::Hvb,
        yen: crate::YEN::from(&session.game),
        status: current_hvb_status(session),
    }
}

fn hvb_move_response(
    game_id: &str,
    session: &GameSession,
    move_field: &str,
    applied: AppliedMove,
) -> serde_json::Value {
    serde_json::json!({
        "game_id": game_id,
        "yen": crate::YEN::from(&session.game),
        move_field: {
            "cell_id": applied.cell_id,
            "coords": applied.coords
        },
        "status": current_hvb_status(session),
    })
}

/// POST /api/v1/hvb/games
pub async fn create_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Json(req): Json<CreateHvbGameRequest>,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);

    let mut cfg = state.config_store.get_or_default(&principal).await;

    if let Some(size) = req.size {
        cfg.size = size;
    }
    if let Some(starter) = req.starter {
        cfg.hvb_starter = starter;
    }
    if let Some(bot_id) = req.bot_id {
        cfg.bot_id = Some(bot_id);
    }

    let bot_id = cfg.bot_id.clone().ok_or_else(|| {
        ApiErrorResponse::bad_request("HvB requires bot_id", "missing_bot_id")
    })?;

    let _bot = state.bots.find(&bot_id).ok_or_else(|| {
        ApiErrorResponse::not_found(format!("Unknown bot_id: {bot_id}"), "unknown_bot_id")
    })?;

    let game = GameY::new(cfg.size);

    state.config_store.set(&principal, cfg.clone());

    let game_id = Uuid::new_v4().to_string();
    let next_is_human = matches!(cfg.hvb_starter, HvBStarter::Human);

    let session = GameSession {
        owner_key: principal.key(),
        mode: GameMode::Hvb,
        config: cfg.clone(),
        game,
        bot_id: Some(bot_id),
        hvb_next_is_human: Some(next_is_human),
        hvb_winner: None,
        hvh_next_player: None,
        hvh_winner: None,
    };

    state.sessions.insert(game_id.clone(), session.clone()).await;

    Ok(Json(hvb_state_response(game_id, &session)))
}

/// GET /api/v1/hvb/games/{game_id}
pub async fn get_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<GameStateResponse>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;
    let session = load_owned_session(&state, &principal, &game_id).await?;

    Ok(Json(hvb_state_response(game_id, &session)))
}

/// DELETE /api/v1/hvb/games/{game_id}
pub async fn delete_game(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let _session = load_owned_session(&state, &principal, &game_id).await?;
    state.sessions.remove(&game_id).await;

    Ok(Json(serde_json::json!({ "deleted": true })))
}

/// POST /api/v1/hvb/games/{game_id}/moves
/// Aplica SOLO la jugada humana.
pub async fn post_human_move(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
    Json(req): Json<CellMoveRequest>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let mut session = load_owned_session(&state, &principal, &game_id).await?;
    ensure_hvb_session(&session)?;

    let next_is_human = session
        .hvb_next_is_human
        .ok_or_else(|| ApiErrorResponse::internal("HvB session invalid", "session_invalid"))?;

    if !next_is_human {
        return Err(ApiErrorResponse::conflict(
            "It is not human turn",
            "not_human_turn",
        ));
    }

    let size = session.game.board_size();
    validate_cell_id(req.cell_id, size)?;

    let human_coords = crate::Coordinates::from_index(req.cell_id, size);

    session
        .game
        .add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: human_coords,
        })
        .map_err(|e| {
            ApiErrorResponse::conflict(format!("Human move rejected: {e}"), "move_rejected")
        })?;

    let human_applied = AppliedMove::new(req.cell_id, size);

    if session.game.check_game_over() {
        session.hvb_winner = Some(Winner::Human);
        session.hvb_next_is_human = Some(true);
    } else {
        session.hvb_winner = None;
        session.hvb_next_is_human = Some(false);
    }

    save_session(&state, &game_id, session.clone()).await?;

    Ok(Json(hvb_move_response(
        &game_id,
        &session,
        "human_move",
        human_applied,
    )))
}

/// POST /api/v1/hvb/games/{game_id}/bot-move
/// Aplica SOLO la jugada del bot.
pub async fn post_bot_move(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let mut session = load_owned_session(&state, &principal, &game_id).await?;
    ensure_hvb_session(&session)?;

    let next_is_human = session
        .hvb_next_is_human
        .ok_or_else(|| ApiErrorResponse::internal("HvB session invalid", "session_invalid"))?;

    if next_is_human {
        return Err(ApiErrorResponse::conflict(
            "It is not bot turn",
            "not_bot_turn",
        ));
    }

    let bot_id = session
        .bot_id
        .clone()
        .ok_or_else(|| ApiErrorResponse::internal("Session missing bot_id", "session_invalid"))?;

    let bot = state.bots.find(&bot_id).ok_or_else(|| {
        ApiErrorResponse::not_found(format!("Unknown bot_id: {bot_id}"), "unknown_bot_id")
    })?;

    let size = session.game.board_size();

    let bot_coords = bot.choose_move(&session.game).ok_or_else(|| {
        ApiErrorResponse::conflict("Bot could not choose a move", "bot_no_move")
    })?;

    let bot_cell_id = bot_coords.to_index(size);

    session
        .game
        .add_move(Movement::Placement {
            player: PlayerId::new(1),
            coords: bot_coords,
        })
        .map_err(|e| {
            ApiErrorResponse::conflict(format!("Bot move rejected: {e}"), "bot_move_rejected")
        })?;

    let bot_applied = AppliedMove::new(bot_cell_id, size);

    if session.game.check_game_over() {
        session.hvb_winner = Some(Winner::Bot);
        session.hvb_next_is_human = Some(false);
    } else {
        session.hvb_winner = None;
        session.hvb_next_is_human = Some(true);
    }

    save_session(&state, &game_id, session.clone()).await?;

    Ok(Json(hvb_move_response(
        &game_id,
        &session,
        "bot_move",
        bot_applied,
    )))
}