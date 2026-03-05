use axum::Json;
use serde::{Deserialize, Serialize};

use crate::{
    bot_server::error::ErrorResponse,
    Coordinates, GameAction, GameStatus, GameY, Movement, PlayerId, YEN,
};

use crate::game_server::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StarterHvH {
    Player0,
    Player1,
}

#[derive(Debug, Deserialize)]
pub struct NewHvhGameRequest {
    pub size: u32,
    pub starter: StarterHvH,
}

#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum GameState {
    Ongoing { next: String },
    Finished { winner: Option<String> },
}

#[derive(Debug, Serialize)]
pub struct NewHvhGameResponse {
    pub yen: YEN,
    pub status: GameState,
}

#[derive(Debug, Deserialize)]
pub struct HumanVsHumanMoveRequest {
    pub yen: YEN,
    pub cell_id: u32,
}

#[derive(Debug, Serialize)]
pub struct AppliedMoveHvH {
    pub cell_id: u32,
    pub coords: Coordinates,
    pub player: String,
}

#[derive(Debug, Serialize)]
pub struct HumanVsHumanMoveResponse {
    pub yen: YEN,
    pub move_applied: AppliedMoveHvH,
    pub status: GameState,
}

fn player_label(p: PlayerId) -> String {
    if p == PlayerId::new(0) { "player0".to_string() } else { "player1".to_string() }
}

fn status_to_response(game: &GameY) -> GameState {
    match game.status() {
        GameStatus::Ongoing { next_player } => GameState::Ongoing { next: player_label(*next_player) },
        GameStatus::Finished { winner } => GameState::Finished { winner: Some(player_label(*winner)) },
    }
}

/// POST /v1/game/hvh/new
pub async fn new_hvh_game(
    Json(req): Json<NewHvhGameRequest>,
) -> Result<Json<NewHvhGameResponse>, ErrorResponse> {
    if req.size < MIN_BOARD_SIZE || req.size > MAX_BOARD_SIZE {
        return Err(ErrorResponse::error(
            &format!("Board size must be between {} and {}", MIN_BOARD_SIZE, MAX_BOARD_SIZE),
            Some("v1".to_string()),
            None,
        ));
    }

    let mut game = GameY::new(req.size);

    if matches!(req.starter, StarterHvH::Player1) {
        game.add_move(Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Swap,
        })
        .map_err(|e| {
            ErrorResponse::error(
                &format!("Swap rejected: {}", e),
                Some("v1".to_string()),
                None,
            )
        })?;
    }

    Ok(Json(NewHvhGameResponse {
        yen: YEN::from(&game),
        status: status_to_response(&game),
    }))
}

/// POST /v1/game/hvh/move
pub async fn human_vs_human_move(
    Json(req): Json<HumanVsHumanMoveRequest>,
) -> Result<Json<HumanVsHumanMoveResponse>, ErrorResponse> {
    let size = req.yen.size();
    if size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE {
        return Err(ErrorResponse::error(
            &format!(
                "Invalid board size in YEN. Must be between {} and {}",
                MIN_BOARD_SIZE, MAX_BOARD_SIZE
            ),
            Some("v1".to_string()),
            None,
        ));
    }

    let total_cells = (size * (size + 1)) / 2;
    if req.cell_id >= total_cells {
        return Err(ErrorResponse::error(
            &format!("cell_id out of range: {} (max {})", req.cell_id, total_cells - 1),
            Some("v1".to_string()),
            None,
        ));
    }

    let mut game = GameY::try_from(req.yen.clone()).map_err(|e| {
        ErrorResponse::error(
            &format!("Invalid YEN: {}", e),
            Some("v1".to_string()),
            None,
        )
    })?;

    let next = match game.next_player() {
        Some(p) => p,
        None => {
            return Err(ErrorResponse::error(
                "Game already finished",
                Some("v1".to_string()),
                None,
            ))
        }
    };

    let coords = Coordinates::from_index(req.cell_id, size);

    game.add_move(Movement::Placement {
        player: next,
        coords,
    })
    .map_err(|e| {
        ErrorResponse::error(
            &format!("Move rejected: {}", e),
            Some("v1".to_string()),
            None,
        )
    })?;

    Ok(Json(HumanVsHumanMoveResponse {
        yen: YEN::from(&game),
        move_applied: AppliedMoveHvH {
            cell_id: req.cell_id,
            coords,
            player: player_label(next),
        },
        status: status_to_response(&game),
    }))
}