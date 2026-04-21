//! hvb.rs
//!
//! Endpoints HvB (Humano vs Bot) usando sesiones.

use axum::{
    extract::{Path, State},
    http::HeaderMap,
    Json,
};
use uuid::Uuid;

use crate::{Coordinates, GameY, Movement, PlayerId};

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

fn resolve_hvb_starter(starter: &HvBStarter) -> bool {
    match starter {
        HvBStarter::Human => true,
        HvBStarter::Bot => false,
        HvBStarter::Random => rand::random::<bool>(),
    }
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

    if session.game.check_game_over() {
        return Err(ApiErrorResponse::conflict(
            "Game already finished",
            "game_finished",
        ));
    }

    Ok(())
}

fn current_hvb_status(session: &GameSession) -> super::dto::GameStatus {
    if session.game.check_game_over() {
        super::dto::GameStatus::Finished {
            winner: session.hvb_winner,
        }
    } else {
        status_hvb(
            session.hvb_next_is_human.unwrap_or(true),
            session.hvb_winner,
        )
    }
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

async fn load_hvb_session_for_action(
    state: &GameServerState,
    headers: &HeaderMap,
    game_id: &str,
) -> Result<(String, GameSession), ApiErrorResponse> {
    let principal = resolve_principal(headers);
    let game_id = parse_uuid(game_id)?;
    let session = load_owned_session(state, &principal, &game_id).await?;
    ensure_hvb_session(&session)?;
    Ok((game_id, session))
}

fn require_human_turn(session: &GameSession) -> Result<(), ApiErrorResponse> {
    let next_is_human = session
        .hvb_next_is_human
        .ok_or_else(|| ApiErrorResponse::internal("HvB session invalid", "session_invalid"))?;

    if !next_is_human {
        return Err(ApiErrorResponse::conflict(
            "It is not human turn",
            "not_human_turn",
        ));
    }

    Ok(())
}

fn require_bot_turn(session: &GameSession) -> Result<(), ApiErrorResponse> {
    let next_is_human = session
        .hvb_next_is_human
        .ok_or_else(|| ApiErrorResponse::internal("HvB session invalid", "session_invalid"))?;

    if next_is_human {
        return Err(ApiErrorResponse::conflict(
            "It is not bot turn",
            "not_bot_turn",
        ));
    }

    Ok(())
}

fn apply_hvb_outcome(session: &mut GameSession, human_turn: bool) {
    if session.game.check_game_over() {
        session.hvb_winner = match session.game.status() {
            crate::GameStatus::Finished {
                winner: Some(_),
            } => Some(if human_turn { Winner::Human } else { Winner::Bot }),
            crate::GameStatus::Finished { winner: None } => None,
            crate::GameStatus::Ongoing { .. } => None,
        };
        session.hvb_next_is_human = Some(human_turn);
    } else {
        session.hvb_winner = None;
        session.hvb_next_is_human = Some(!human_turn);
    }
}

async fn persist_and_respond_move(
    state: &GameServerState,
    game_id: &str,
    session: GameSession,
    move_field: &str,
    applied: AppliedMove,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    save_session(state, game_id, session.clone()).await?;
    Ok(Json(hvb_move_response(game_id, &session, move_field, applied)))
}

fn human_movement(cell_id: u32, size: u32) -> Movement {
    let coords = Coordinates::from_index(cell_id, size);
    Movement::Placement {
        player: PlayerId::new(0),
        coords,
    }
}

fn bot_movement(coords: Coordinates) -> Movement {
    Movement::Placement {
        player: PlayerId::new(1),
        coords,
    }
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
    let next_is_human = resolve_hvb_starter(&cfg.hvb_starter);

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
    let (game_id, mut session) = load_hvb_session_for_action(&state, &headers, &game_id).await?;
    require_human_turn(&session)?;

    let size = session.game.board_size();
    validate_cell_id(req.cell_id, size)?;

    session
        .game
        .add_move(human_movement(req.cell_id, size))
        .map_err(|e| {
            ApiErrorResponse::conflict(format!("Human move rejected: {e}"), "move_rejected")
        })?;

    let human_applied = AppliedMove::new(req.cell_id, size);
    apply_hvb_outcome(&mut session, true);

    persist_and_respond_move(&state, &game_id, session, "human_move", human_applied).await
}

/// POST /api/v1/hvb/games/{game_id}/bot-move
/// Aplica SOLO la jugada del bot.
pub async fn post_bot_move(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let (game_id, mut session) = load_hvb_session_for_action(&state, &headers, &game_id).await?;
    require_bot_turn(&session)?;

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
        .add_move(bot_movement(bot_coords))
        .map_err(|e| {
            ApiErrorResponse::conflict(format!("Bot move rejected: {e}"), "bot_move_rejected")
        })?;

    let bot_applied = AppliedMove::new(bot_cell_id, size);
    apply_hvb_outcome(&mut session, false);

    persist_and_respond_move(&state, &game_id, session, "bot_move", bot_applied).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        extract::{Path, State},
        http::{HeaderMap, HeaderValue, StatusCode},
        Json,
    };
    use tokio::time::{sleep, Duration};

    use crate::game_server::dto::{
        CellMoveRequest, GameConfig, GameStatus, HvBStarter, HvHStarter, NextTurn,
    };

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
                bot_id: bot_id.map(str::to_string),
            },
        );
        sleep(Duration::from_millis(50)).await;
    }

    fn hvb_session(
        owner_key: String,
        size: u32,
        next_is_human: Option<bool>,
        winner: Option<Winner>,
        bot_id: Option<&str>,
    ) -> GameSession {
        GameSession {
            owner_key,
            mode: GameMode::Hvb,
            config: GameConfig {
                size,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: bot_id.map(str::to_string),
            },
            game: GameY::new(size),
            bot_id: bot_id.map(str::to_string),
            hvb_next_is_human: next_is_human,
            hvb_winner: winner,
            hvh_next_player: None,
            hvh_winner: None,
        }
    }

    #[test]
    fn resolve_hvb_starter_returns_true_for_human() {
        assert!(resolve_hvb_starter(&HvBStarter::Human));
    }

    #[test]
    fn resolve_hvb_starter_returns_false_for_bot() {
        assert!(!resolve_hvb_starter(&HvBStarter::Bot));
    }

    #[test]
    fn validate_cell_id_rejects_out_of_range() {
        let err = validate_cell_id(99, 2).unwrap_err();
        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "cell_id_out_of_range");
    }

    #[test]
    fn ensure_hvb_session_rejects_wrong_mode() {
        let mut session = hvb_session("owner".to_string(), 2, Some(true), None, Some("random_bot"));
        session.mode = GameMode::Hvh;

        let err = ensure_hvb_session(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "invalid_game_mode");
    }

    #[test]
    fn ensure_hvb_session_rejects_finished_game() {
        let mut session = hvb_session(
            "owner".to_string(),
            1,
            Some(true),
            None,
            Some("random_bot"),
        );
        session.game.add_move(human_movement(0, 1)).unwrap();

        let err = ensure_hvb_session(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "game_finished");
    }

    #[test]
    fn require_human_turn_rejects_when_it_is_bot_turn() {
        let session = hvb_session("owner".to_string(), 2, Some(false), None, Some("random_bot"));
        let err = require_human_turn(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "not_human_turn");
    }

    #[test]
    fn require_human_turn_rejects_invalid_session_without_flag() {
        let session = hvb_session("owner".to_string(), 2, None, None, Some("random_bot"));
        let err = require_human_turn(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[test]
    fn require_bot_turn_rejects_when_it_is_human_turn() {
        let session = hvb_session("owner".to_string(), 2, Some(true), None, Some("random_bot"));
        let err = require_bot_turn(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "not_bot_turn");
    }

    #[test]
    fn require_bot_turn_rejects_invalid_session_without_flag() {
        let session = hvb_session("owner".to_string(), 2, None, None, Some("random_bot"));
        let err = require_bot_turn(&session).unwrap_err();
        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[test]
    fn apply_hvb_outcome_sets_human_winner_when_game_is_over() {
        let mut session = hvb_session("owner".to_string(), 1, Some(true), None, Some("random_bot"));
        // tablero 1 => la primera jugada termina
        session
            .game
            .add_move(human_movement(0, 1))
            .unwrap();

        apply_hvb_outcome(&mut session, true);

        assert!(matches!(session.hvb_winner, Some(Winner::Human)));
        assert_eq!(session.hvb_next_is_human, Some(true));
    }

    #[test]
    fn apply_hvb_outcome_switches_turn_when_game_continues() {
        let mut session = hvb_session("owner".to_string(), 2, Some(true), None, Some("random_bot"));

        session
            .game
            .add_move(human_movement(0, 2))
            .unwrap();

        apply_hvb_outcome(&mut session, true);

        assert!(session.hvb_winner.is_none());
        assert_eq!(session.hvb_next_is_human, Some(false));
    }

    #[tokio::test]
    async fn create_game_returns_missing_bot_id() {
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

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "missing_bot_id");
    }

    #[tokio::test]
    async fn create_game_returns_unknown_bot_id() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-unknown-bot");
        let principal = Principal::Guest {
            client_id: "hvb-unknown-bot".to_string(),
        };

        store_hvb_config(&state, &principal, 3, HvBStarter::Human, Some("ghost_bot")).await;

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

        assert_eq!(err.0, StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "unknown_bot_id");
    }

    #[tokio::test]
    async fn create_game_with_random_returns_valid_starting_turn() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-random-start");
        let principal = Principal::Guest {
            client_id: "hvb-random-start".to_string(),
        };

        store_hvb_config(&state, &principal, 3, HvBStarter::Random, Some("random_bot")).await;

        let res = create_game(
            State(state),
            headers,
            Json(CreateHvbGameRequest {
                size: None,
                starter: None,
                bot_id: None,
            }),
        )
        .await
        .unwrap();

        assert!(matches!(res.0.mode, GameMode::Hvb));
        match res.0.status {
            GameStatus::Ongoing { next } => {
                assert!(matches!(next, NextTurn::Human | NextTurn::Bot))
            }
            _ => panic!("expected ongoing"),
        }
    }

    #[tokio::test]
    async fn get_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-invalid-uuid");

        let err = get_game(State(state), headers, Path("not-a-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn delete_game_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-delete-invalid");

        let err = delete_game(State(state), headers, Path("not-a-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn get_game_returns_not_found_for_missing_session() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-missing-game");
        let game_id = uuid::Uuid::new_v4().to_string();

        let err = get_game(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn create_get_and_delete_happy_path() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-full");
        let principal = Principal::Guest {
            client_id: "hvb-full".to_string(),
        };

        store_hvb_config(&state, &principal, 3, HvBStarter::Human, Some("random_bot")).await;

        let created = create_game(
            State(state.clone()),
            headers.clone(),
            Json(CreateHvbGameRequest {
                size: None,
                starter: None,
                bot_id: None,
            }),
        )
        .await
        .unwrap();

        let game_id = created.0.game_id.clone();

        let fetched = get_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();

        assert_eq!(fetched.0.game_id, game_id);
        assert!(matches!(fetched.0.mode, GameMode::Hvb));

        let deleted = delete_game(State(state.clone()), headers.clone(), Path(game_id.clone()))
            .await
            .unwrap();
        assert_eq!(deleted.0["deleted"], true);

        let err = get_game(State(state), headers, Path(game_id)).await.unwrap_err();
        assert_eq!(err.1.code, "game_not_found");
    }

    #[tokio::test]
    async fn post_human_move_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-human-invalid");

        let err = post_human_move(
            State(state),
            headers,
            Path("not-a-uuid".to_string()),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn post_human_move_rejects_when_not_human_turn() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-not-human");
        let principal = Principal::Guest {
            client_id: "hvb-not-human".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(false), None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "not_human_turn");
    }

    #[tokio::test]
    async fn post_human_move_rejects_invalid_mode() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-invalid-mode");
        let principal = Principal::Guest {
            client_id: "hvb-invalid-mode".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let mut session = hvb_session(principal.key(), 2, Some(true), None, Some("random_bot"));
        session.mode = GameMode::Hvh;
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "invalid_game_mode");
    }

    #[tokio::test]
    async fn post_human_move_rejects_finished_game() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-finished");
        let principal = Principal::Guest {
            client_id: "hvb-finished".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let mut session = hvb_session(
            principal.key(),
            1,
            Some(true),
            None,
            Some("random_bot"),
        );
        session.game.add_move(human_movement(0, 1)).unwrap();
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "game_finished");
    }

    #[tokio::test]
    async fn post_human_move_rejects_session_without_turn_flag() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-no-flag-human");
        let principal = Principal::Guest {
            client_id: "hvb-no-flag-human".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, None, None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 0 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[tokio::test]
    async fn post_human_move_rejects_out_of_range_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-out-of-range");
        let principal = Principal::Guest {
            client_id: "hvb-out-of-range".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(true), None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_human_move(
            State(state),
            headers,
            Path(game_id),
            Json(CellMoveRequest { cell_id: 99 }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "cell_id_out_of_range");
    }

    #[tokio::test]
    async fn post_human_move_rejects_occupied_cell() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-occupied-cell");
        let principal = Principal::Guest {
            client_id: "hvb-occupied-cell".to_string(),
        };

        let mut session = hvb_session(principal.key(), 2, Some(true), None, Some("random_bot"));
        session.game.add_move(human_movement(0, 2)).unwrap();

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

        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "move_rejected");
    }

    #[tokio::test]
    async fn post_human_move_applies_valid_move() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-human-ok");
        let principal = Principal::Guest {
            client_id: "hvb-human-ok".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(true), None, Some("random_bot"));
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
        assert_eq!(res.0["human_move"]["cell_id"], 0);
        assert_eq!(res.0["status"]["state"], "ongoing");

        let stored = state.sessions.get(&game_id).await.unwrap();
        assert_eq!(stored.hvb_next_is_human, Some(false));
        assert!(stored.hvb_winner.is_none());
    }

    #[tokio::test]
    async fn post_bot_move_rejects_invalid_uuid() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-bot-invalid");

        let err = post_bot_move(State(state), headers, Path("not-a-uuid".to_string()))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.code, "invalid_game_id");
    }

    #[tokio::test]
    async fn post_bot_move_rejects_when_not_bot_turn() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-not-bot");
        let principal = Principal::Guest {
            client_id: "hvb-not-bot".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(true), None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_bot_move(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.code, "not_bot_turn");
    }

    #[tokio::test]
    async fn post_bot_move_rejects_session_without_turn_flag() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-no-flag-bot");
        let principal = Principal::Guest {
            client_id: "hvb-no-flag-bot".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, None, None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_bot_move(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[tokio::test]
    async fn post_bot_move_rejects_missing_bot_id() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-missing-bot-id-session");
        let principal = Principal::Guest {
            client_id: "hvb-missing-bot-id-session".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(false), None, None);
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_bot_move(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.code, "session_invalid");
    }

    #[tokio::test]
    async fn post_bot_move_rejects_unknown_bot_id() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-unknown-bot-id-session");
        let principal = Principal::Guest {
            client_id: "hvb-unknown-bot-id-session".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(false), None, Some("ghost_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let err = post_bot_move(State(state), headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "unknown_bot_id");
    }

    #[tokio::test]
    async fn post_bot_move_applies_valid_move() {
        let state = GameServerState::new_default();
        let headers = headers_with_client("hvb-bot-ok");
        let principal = Principal::Guest {
            client_id: "hvb-bot-ok".to_string(),
        };

        let game_id = uuid::Uuid::new_v4().to_string();
        let session = hvb_session(principal.key(), 2, Some(false), None, Some("random_bot"));
        state.sessions.insert(game_id.clone(), session).await;

        let res = post_bot_move(State(state.clone()), headers, Path(game_id.clone()))
            .await
            .unwrap();

        assert_eq!(res.0["game_id"], game_id);
        assert!(res.0.get("bot_move").is_some());

        let stored = state.sessions.get(&game_id).await.unwrap();
        assert_eq!(stored.hvb_next_is_human, Some(true));
    }

    #[tokio::test]
    async fn get_game_returns_not_found_for_existing_game_of_another_owner() {
        let state = GameServerState::new_default();

        let owner_headers = headers_with_client("owner-hvb");
        let other_headers = headers_with_client("other-hvb");
        let owner = Principal::Guest {
            client_id: "owner-hvb".to_string(),
        };

        store_hvb_config(&state, &owner, 3, HvBStarter::Human, Some("random_bot")).await;

        let created = create_game(
            State(state.clone()),
            owner_headers,
            Json(CreateHvbGameRequest {
                size: None,
                starter: None,
                bot_id: None,
            }),
        )
        .await
        .unwrap();

        let game_id = created.0.game_id;

        let err = get_game(State(state), other_headers, Path(game_id))
            .await
            .unwrap_err();

        assert_eq!(err.0, StatusCode::NOT_FOUND);
        assert_eq!(err.1.code, "game_not_found");
    }
}

/// GET /api/v1/hvb/games/{game_id}/hint
/// Consulta al bot qué movimiento elegiría dado el estado actual,
/// sin aplicarlo ni modificar la sesión. Útil como pista para el jugador humano.
pub async fn get_hint(
    State(state): State<GameServerState>,
    headers: HeaderMap,
    Path(game_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiErrorResponse> {
    let principal = resolve_principal(&headers);
    let game_id = parse_uuid(&game_id)?;

    let session = load_owned_session(&state, &principal, &game_id).await?;
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

    let bot_id = session
        .bot_id
        .clone()
        .ok_or_else(|| ApiErrorResponse::internal("Session missing bot_id", "session_invalid"))?;

    let bot = state.bots.find(&bot_id).ok_or_else(|| {
        ApiErrorResponse::not_found(format!("Unknown bot_id: {bot_id}"), "unknown_bot_id")
    })?;

    let size = session.game.board_size();

    let coords = bot.choose_move(&session.game).ok_or_else(|| {
        ApiErrorResponse::conflict("Bot could not suggest a move", "bot_no_move")
    })?;

    let cell_id = coords.to_index(size);

    Ok(Json(serde_json::json!({ "hint_cell_id": cell_id })))
}
