//! dto.rs
//!
//! DTOs compartidos por HvH/HvB y endpoints de meta/config.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};

// use crate::{Coordinates, GameY, PlayerId, YEN};
use crate::{Coordinates, YEN};
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
    pub hvb_starter: HvBStarter,
    pub hvh_starter: Option<HvHStarter>,
    pub bot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HvBStarter {
    Human,
    Bot,
    Random,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HvHStarter {
    Player0,
    Player1,
    Random,
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

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NextTurn {
    Human,
    Bot,
    Player0,
    Player1,
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize, PartialEq, Eq)]
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
    pub next_player: Option<u8>,
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
pub fn status_hvh_from_session(
    finished: bool,
    next_player: u8,
    winner: Option<u8>,
) -> GameStatus {
    if finished {
        let w = match winner.unwrap_or(0) {
            1 => Winner::Player1,
            _ => Winner::Player0,
        };
        GameStatus::Finished { winner: w }
    } else {
        let next = match next_player {
            1 => NextTurn::Player1,
            _ => NextTurn::Player0,
        };
        GameStatus::Ongoing { next }
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::State;

    use crate::game_server::state::GameServerState;

    #[tokio::test]
    async fn get_meta_returns_expected_limits_and_bots() {
        let state = GameServerState::new_default();

        let Json(meta) = get_meta(State(state)).await;

        assert_eq!(meta.api_version, API_V1);
        assert_eq!(meta.min_board_size, MIN_BOARD_SIZE);
        assert_eq!(meta.max_board_size, MAX_BOARD_SIZE);
        assert!(!meta.bots.is_empty());
        assert!(meta.bots.iter().any(|b| b == "random_bot"));
    }

    #[test]
    fn applied_move_new_builds_cell_and_coords() {
        let applied = AppliedMove::new(0, 2);

        assert_eq!(applied.cell_id, 0);
        assert_eq!(applied.coords, Coordinates::from_index(0, 2));
    }

    #[test]
    fn status_hvh_finished_defaults_to_player0_when_winner_is_none() {
        let status = status_hvh_from_session(true, 1, None);

        match status {
            GameStatus::Finished { winner } => {
                assert!(matches!(winner, Winner::Player0));
            }
            _ => panic!("expected finished"),
        }
    }

    #[test]
    fn status_hvh_finished_with_player1_winner() {
        let status = status_hvh_from_session(true, 0, Some(1));

        match status {
            GameStatus::Finished { winner } => {
                assert!(matches!(winner, Winner::Player1));
            }
            _ => panic!("expected finished"),
        }
    }

    #[test]
    fn status_hvh_ongoing_with_player0() {
        let status = status_hvh_from_session(false, 0, None);

        match status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Player0)),
            _ => panic!("expected ongoing"),
        }
    }

    #[test]
    fn status_hvh_ongoing_with_player1() {
        let status = status_hvh_from_session(false, 1, None);

        match status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Player1)),
            _ => panic!("expected ongoing"),
        }
    }

    #[test]
    fn status_hvb_returns_finished_when_winner_exists() {
        let status = status_hvb(true, Some(Winner::Bot));

        match status {
            GameStatus::Finished { winner } => assert!(matches!(winner, Winner::Bot)),
            _ => panic!("expected finished"),
        }
    }

    #[test]
    fn status_hvb_returns_human_turn_when_not_finished() {
        let status = status_hvb(true, None);

        match status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Human)),
            _ => panic!("expected ongoing"),
        }
    }

    #[test]
    fn status_hvb_returns_bot_turn_when_not_finished_and_human_is_false() {
        let status = status_hvb(false, None);

        match status {
            GameStatus::Ongoing { next } => assert!(matches!(next, NextTurn::Bot)),
            _ => panic!("expected ongoing"),
        }
    }

    #[test]
    fn hvb_starter_deserializes_random() {
        let starter: HvBStarter = serde_json::from_str("\"random\"").unwrap();
        assert!(matches!(starter, HvBStarter::Random));
    }

    #[test]
    fn hvh_starter_deserializes_random() {
        let starter: HvHStarter = serde_json::from_str("\"random\"").unwrap();
        assert!(matches!(starter, HvHStarter::Random));
    }
}