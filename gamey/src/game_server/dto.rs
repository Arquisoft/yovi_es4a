//! dto.rs
//!
//! DTOs compartidos por HvH/HvB y endpoints de meta/config.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

// use crate::{Coordinates, GameY, PlayerId, YEN};
use crate::{Coordinates, GameY, YEN};
use super::{API_V1, MAX_BOARD_SIZE, MIN_BOARD_SIZE};
use super::state::GameServerState;

/// Información que la UI necesita para construir el Home: límites + lista de bots.
#[derive(Debug, Serialize)]
pub struct MetaResponse {
    pub api_version: &'static str,
    pub min_board_size: u32,
    pub max_board_size: u32,
    pub bots: Vec<String>,
}

/// GET /api/v1/meta
pub async fn get_meta(State(state): State<GameServerState>) -> Json<MetaResponse> {
    let bots = state.bots.names();
    Json(MetaResponse {
        api_version: API_V1,
        min_board_size: MIN_BOARD_SIZE,
        max_board_size: MAX_BOARD_SIZE,
        bots,
    })
}

/// Configuración que el usuario puede “recordar” para la siguiente partida.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameConfig {
    pub size: u32,
    /// "human" / "bot" en HvB. En HvH no aplica, pero lo guardamos para UX.
    pub starter: Starter,
    /// Solo relevante en HvB. En HvH puede ser None.
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Starter {
    Human,
    Bot,
}

/// Respuesta estándar de estado de juego (para HvH y HvB).
#[derive(Debug, Serialize)]
pub struct GameStateResponse {
    pub game_id: String,
    pub mode: GameMode,
    pub yen: YEN,
    pub status: GameStatus,
}

#[derive(Debug, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum GameMode {
    Hvh,
    Hvb,
}

#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum GameStatus {
    Ongoing { next: NextTurn },
    Finished { winner: Winner },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum NextTurn {
    Human,
    Bot,
    Player0,
    Player1,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Winner {
    Human,
    Bot,
    Player0,
    Player1,
}

/// Movimiento que pide la UI:
#[derive(Debug, Deserialize)]
pub struct CellMoveRequest {
    pub cell_id: u32,
}

#[derive(Debug, Serialize)]
pub struct AppliedMove {
    pub cell_id: u32,
    pub coords: Coordinates,
}

impl AppliedMove {
    pub fn new(cell_id: u32, size: u32) -> Self {
        let coords = Coordinates::from_index(cell_id, size);
        Self { cell_id, coords }
    }
}

/// Helpers para traducir el estado del motor al DTO.
pub fn status_hvh(game: &GameY) -> GameStatus {
    if game.check_game_over() {
        GameStatus::Finished { winner: Winner::Player0 }
    } else {
        GameStatus::Ongoing { next: NextTurn::Player0 }
    }
}

pub fn status_hvb(next_is_human: bool, finished: Option<Winner>) -> GameStatus {
    match finished {
        Some(winner) => GameStatus::Finished { winner },
        None => GameStatus::Ongoing {
            next: if next_is_human { NextTurn::Human } else { NextTurn::Bot },
        },
    }
}