use axum::Json;
use serde::{Deserialize, Serialize};

use crate::{
    bot_server::error::ErrorResponse,
    Coordinates, GameAction, GameStatus, GameY, Movement, PlayerId, YEN,
};

use crate::game_server::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Starter {
    Player0,
    Player1,
}

#[derive(Debug, Deserialize)]
pub struct NewHvhGameRequest {
    pub size: u32,
    pub starter: Starter,
}

#[derive(Debug, Serialize)]
pub struct NewHvhGameResponse {
    pub yen: YEN,
    pub status: GameState,
}

#[derive(Debug, Deserialize)]
pub struct HumanMoveRequest {
    pub yen: YEN,
    pub cell_id: u32,
}

#[derive(Debug, Serialize)]
pub struct AppliedMove {
    pub cell_id: u32,
    pub coords: Coordinates,
    pub player: String, // "player0" o "player1"
}

#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum GameState {
    Ongoing { next: String },
    Finished { winner: String },
}

#[derive(Debug, Serialize)]
pub struct HumanVsHumanMoveResponse {
    pub yen: YEN,
    pub move_applied: AppliedMove,
    pub status: GameState,
}

fn player_label(player: PlayerId) -> String {
    format!("player{}", player.id())
}

/// POST /v1/game/hvh/new
pub async fn new_hvh_game(Json(req): Json<NewHvhGameRequest>) -> Result<Json<NewHvhGameResponse>, ErrorResponse> {
    if req.size < MIN_BOARD_SIZE || req.size > MAX_BOARD_SIZE {
        return Err(ErrorResponse::error(
            &format!(
                "Board size must be between {} and {}",
                MIN_BOARD_SIZE, MAX_BOARD_SIZE
            ),
            Some("v1".to_string()),
            None,
        ));
    }

    let mut game = GameY::new(req.size);

    if matches!(req.starter, Starter::Player1) {
        game.add_move(Movement::Action {
            player: PlayerId::new(0),
            action: GameAction::Swap,
        })
        .map_err(|e| {
            ErrorResponse::error(
                &format!("Could not set starter player: {}", e),
                Some("v1".to_string()),
                None,
            )
        })?;
    }

    let yen = YEN::from(&game);

    let status = match game.status() {
        GameStatus::Ongoing { next_player } => GameState::Ongoing {
            next: player_label(*next_player),
        },
        GameStatus::Finished { winner } => GameState::Finished {
            winner: player_label(*winner),
        },
    };

    Ok(Json(NewHvhGameResponse { yen, status }))
}

/// POST /v1/game/hvh/move
pub async fn human_vs_human_move(
    Json(req): Json<HumanMoveRequest>,
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

    let current_player = match game.status() {
        GameStatus::Ongoing { next_player } => *next_player,
        GameStatus::Finished { .. } => {
            return Err(ErrorResponse::error(
                "Game already finished",
                Some("v1".to_string()),
                None,
            ));
        }
    };

    let coords = Coordinates::from_index(req.cell_id, size);

    game.add_move(Movement::Placement {
        player: current_player,
        coords,
    })
    .map_err(|e| {
        ErrorResponse::error(
            &format!("Move rejected: {}", e),
            Some("v1".to_string()),
            None,
        )
    })?;

    let applied = AppliedMove {
        cell_id: req.cell_id,
        coords,
        player: player_label(current_player),
    };

    let yen_out = YEN::from(&game);

    let status = if game.check_game_over() {
        GameState::Finished {
            winner: player_label(current_player),
        }
    }
    else {
        match game.status() {
            GameStatus::Ongoing { next_player } => GameState::Ongoing {
                next: player_label(*next_player),
            },
            GameStatus::Finished { winner } => GameState::Finished {
                winner: player_label(*winner),
            },
        }
    };

    Ok(Json(HumanVsHumanMoveResponse {
        yen: yen_out,
        move_applied: applied,
        status,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    use axum::Json;

    use crate::{Coordinates, GameY, Movement, PlayerId, YEN};

    #[tokio::test]
    async fn new_hvh_game_rejects_board_size_out_of_range() {
        let err = new_hvh_game(Json(NewHvhGameRequest {
            size: MIN_BOARD_SIZE - 1,
            starter: Starter::Player0,
        }))
        .await
        .unwrap_err();

        assert!(err.message.contains("Board size must be between"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);

        let err = new_hvh_game(Json(NewHvhGameRequest {
            size: MAX_BOARD_SIZE + 1,
            starter: Starter::Player0,
        }))
        .await
        .unwrap_err();

        assert!(err.message.contains("Board size must be between"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);
    }

    #[tokio::test]
    async fn new_hvh_game_player0_starter_next_is_player0() {
        let res = new_hvh_game(Json(NewHvhGameRequest {
            size: 3,
            starter: Starter::Player0,
        }))
        .await
        .unwrap()
        .0;

        match res.status {
            GameState::Ongoing { next } => assert_eq!(next, "player0"),
            _ => panic!("Expected ongoing game"),
        }
    }

    #[tokio::test]
    async fn new_hvh_game_player1_starter_next_is_player1() {
        let res = new_hvh_game(Json(NewHvhGameRequest {
            size: 3,
            starter: Starter::Player1,
        }))
        .await
        .unwrap()
        .0;

        match res.status {
            GameState::Ongoing { next } => assert_eq!(next, "player1"),
            _ => panic!("Expected ongoing game"),
        }
    }

    #[tokio::test]
    async fn human_vs_human_move_rejects_cell_id_out_of_range() {
        let game = GameY::new(3);
        let yen = YEN::from(&game);

        let err = human_vs_human_move(Json(HumanMoveRequest { yen, cell_id: 999 }))
            .await
            .unwrap_err();

        assert!(err.message.contains("cell_id out of range"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);
    }

    #[tokio::test]
    async fn human_vs_human_move_invalid_yen_returns_error() {
        let bad_yen = YEN::new(3, 0, vec!['B', 'R'], "X/.B/..R".to_string());

        let err = human_vs_human_move(Json(HumanMoveRequest { yen: bad_yen, cell_id: 0 }))
            .await
            .unwrap_err();

        assert!(err.message.contains("Invalid YEN"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);
    }

    #[tokio::test]
    async fn human_vs_human_move_rejected_if_play_on_occupied_cell() {
        let size = 3;
        let mut game = GameY::new(size);

        let occupied_cell_id = 0;
        let occupied_coords = Coordinates::from_index(occupied_cell_id, size);

        game.add_move(Movement::Placement {
            player: PlayerId::new(0),
            coords: occupied_coords,
        })
        .unwrap();

        let yen = YEN::from(&game);

        let err = human_vs_human_move(Json(HumanMoveRequest {
            yen,
            cell_id: occupied_cell_id,
        }))
        .await
        .unwrap_err();

        assert!(err.message.contains("Move rejected"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);
    }

    #[tokio::test]
    async fn human_vs_human_move_player0_wins() {
        let mut game = GameY::new(3);

        let pre_moves = vec![
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 0, 2),
            },
            Movement::Placement {
                player: PlayerId::new(1),
                coords: Coordinates::new(2, 0, 0),
            },
            Movement::Placement {
                player: PlayerId::new(0),
                coords: Coordinates::new(0, 1, 1),
            },
            Movement::Placement {
                player: PlayerId::new(1),
                coords: Coordinates::new(1, 1, 0),
            },
        ];

        for mv in pre_moves {
            game.add_move(mv).unwrap();
        }

        let winning_coords = Coordinates::new(0, 2, 0);
        let winning_cell_id = winning_coords.to_index(3);

        let yen = YEN::from(&game);

        let res = human_vs_human_move(Json(HumanMoveRequest {
            yen,
            cell_id: winning_cell_id,
        }))
        .await
        .unwrap()
        .0;

        match res.status {
            GameState::Finished { winner } => assert_eq!(winner, "player0"),
            _ => panic!("Expected finished game with player0 winner"),
        }
    }
}