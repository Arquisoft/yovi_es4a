use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{
    bot_server::error::ErrorResponse,
    bot_server::state::AppState,
    Coordinates, GameY, Movement, PlayerId, YEN,
};

use crate::game_server::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};

#[derive(Debug, Deserialize)]
pub struct NewGameRequest {
    pub size: u32,
}

#[derive(Debug, Serialize)]
pub struct NewGameResponse {
    pub yen: YEN,
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
}

#[derive(Debug, Serialize)]
#[serde(tag = "state", rename_all = "lowercase")]
pub enum GameState {
    Ongoing { next: String },
    Finished { winner: String },
}

#[derive(Debug, Serialize)]
pub struct HumanVsBotMoveResponse {
    pub yen: YEN,
    pub human_move: AppliedMove,
    pub bot_move: Option<AppliedMove>,
    pub status: GameState,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Starter {
    Human,
    Bot,
}

#[derive(Debug, Deserialize)]
pub struct NewHvbGameRequest {
    pub size: u32,
    pub starter: Starter,
}

#[derive(Debug, Serialize)]
pub struct NewHvbGameResponse {
    pub yen: YEN,
    pub bot_move: Option<AppliedMove>,
    pub status: GameState,
}

pub async fn new_hvb_game(
    State(state): State<AppState>,
    Path(bot_id): Path<String>,
    Json(req): Json<NewHvbGameRequest>,
) -> Result<Json<NewHvbGameResponse>, ErrorResponse> {
    if req.size < MIN_BOARD_SIZE || req.size > MAX_BOARD_SIZE {
        return Err(ErrorResponse::error(
            &format!(
                "Board size must be between {} and {}",
                MIN_BOARD_SIZE, MAX_BOARD_SIZE
            ),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        ));
    }

    let mut game = GameY::new(req.size);

    match req.starter {
        Starter::Human => {
            let yen = YEN::from(&game);
            return Ok(Json(NewHvbGameResponse {
                yen,
                bot_move: None,
                status: GameState::Ongoing {
                    next: "human".to_string(),
                },
            }));
        }
        Starter::Bot => {
            // Buscar bot
            let bot = state.bots().find(&bot_id).ok_or_else(|| {
                ErrorResponse::error(
                    &format!("Unknown bot_id: {}", bot_id),
                    Some("v1".to_string()),
                    Some(bot_id.clone()),
                )
            })?;

            // Elegir y aplicar movimiento del bot como player 1
            let bot_coords = bot.choose_move(&game).ok_or_else(|| {
                ErrorResponse::error(
                    "Bot could not choose a move",
                    Some("v1".to_string()),
                    Some(bot_id.clone()),
                )
            })?;

            let bot_cell_id = bot_coords.to_index(req.size);

            game.add_move(Movement::Placement {
                player: PlayerId::new(1),
                coords: bot_coords,
            })
            .map_err(|e| {
                ErrorResponse::error(
                    &format!("Bot move rejected: {}", e),
                    Some("v1".to_string()),
                    Some(bot_id.clone()),
                )
            })?;

            let bot_applied = AppliedMove {
                cell_id: bot_cell_id,
                coords: bot_coords,
            };

            let yen_out = YEN::from(&game);

            let status = if game.check_game_over() {
                GameState::Finished {
                    winner: "bot".to_string(),
                }
            } else {
                GameState::Ongoing {
                    next: "human".to_string(),
                }
            };

            Ok(Json(NewHvbGameResponse {
                yen: yen_out,
                bot_move: Some(bot_applied),
                status,
            }))
        }
    }
}

/// POST /v1/game/new
pub async fn new_game(Json(req): Json<NewGameRequest>) -> Result<Json<NewGameResponse>, ErrorResponse> {
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

    let game = GameY::new(req.size);
    let yen = YEN::from(&game);

    Ok(Json(NewGameResponse { yen }))
}

/// POST /v1/game/hvb/move/{bot_id}
pub async fn human_vs_bot_move(
    State(state): State<AppState>,
    Path(bot_id): Path<String>,
    Json(req): Json<HumanMoveRequest>,
) -> Result<Json<HumanVsBotMoveResponse>, ErrorResponse> {
    // 1) Validar cell_id (sin tocar coords.rs)
    let size = req.yen.size();
    if size < MIN_BOARD_SIZE || size > MAX_BOARD_SIZE {
        return Err(ErrorResponse::error(
            &format!(
                "Invalid board size in YEN. Must be between {} and {}",
                MIN_BOARD_SIZE, MAX_BOARD_SIZE
            ),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        ));
    }

    let total_cells = (size * (size + 1)) / 2;
    if req.cell_id >= total_cells {
        return Err(ErrorResponse::error(
            &format!("cell_id out of range: {} (max {})", req.cell_id, total_cells - 1),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        ));
    }

    // 2) reconstruir GameY desde YEN
    let mut game = GameY::try_from(req.yen.clone()).map_err(|e| {
        ErrorResponse::error(
            &format!("Invalid YEN: {}", e),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        )
    })?;

    // 3) Aplicar movimiento humano (player 0)
    let human_coords = Coordinates::from_index(req.cell_id, size);
    let human_player = PlayerId::new(0);

    game.add_move(Movement::Placement {
        player: human_player,
        coords: human_coords,
    })
    .map_err(|e| {
        ErrorResponse::error(
            &format!("Human move rejected: {}", e),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        )
    })?;

    let human_applied = AppliedMove {
        cell_id: req.cell_id,
        coords: human_coords,
    };

    // Si el humano termina la partida, no mueve bot
    if game.check_game_over() {
        let yen_out = YEN::from(&game);
        return Ok(Json(HumanVsBotMoveResponse {
            yen: yen_out,
            human_move: human_applied,
            bot_move: None,
            status: GameState::Finished {
                winner: "human".to_string(),
            },
        }));
    }

    // 4) Elegir bot y mover (player 1)
    let bot = state.bots().find(&bot_id).ok_or_else(|| {
        ErrorResponse::error(
            &format!("Unknown bot_id: {}", bot_id),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        )
    })?;

    let bot_coords = bot.choose_move(&game).ok_or_else(|| {
        ErrorResponse::error(
            "Bot could not choose a move",
            Some("v1".to_string()),
            Some(bot_id.clone()),
        )
    })?;

    // Convertir coords del bot a cell_id sin Result
    let bot_cell_id = bot_coords.to_index(size);

    game.add_move(Movement::Placement {
        player: PlayerId::new(1),
        coords: bot_coords,
    })
    .map_err(|e| {
        ErrorResponse::error(
            &format!("Bot move rejected: {}", e),
            Some("v1".to_string()),
            Some(bot_id.clone()),
        )
    })?;

    let bot_applied = AppliedMove {
        cell_id: bot_cell_id,
        coords: bot_coords,
    };

    let yen_out = YEN::from(&game);

    let status = if game.check_game_over() {
        GameState::Finished {
            winner: "bot".to_string(),
        }
    } else {
        GameState::Ongoing {
            next: "human".to_string(),
        }
    };

    Ok(Json(HumanVsBotMoveResponse {
        yen: yen_out,
        human_move: human_applied,
        bot_move: Some(bot_applied),
        status,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    use axum::extract::{Path, State};
    use axum::Json;
    use std::sync::Arc;

    use crate::{GameY, Movement, PlayerId, YBot, YBotRegistry, Coordinates, YEN};
    use crate::bot_server::state::AppState;

    #[derive(Debug)]
    struct NoMoveBot;

    impl YBot for NoMoveBot {
        fn name(&self) -> &str {
            "no_move_bot"
        }

        fn choose_move(&self, _board: &GameY) -> Option<Coordinates> {
            None
        }
    }

    #[derive(Debug)]
    struct FixedCoordBot {
        name: &'static str,
        coords: Coordinates,
    }

    impl YBot for FixedCoordBot {
        fn name(&self) -> &str {
            self.name
        }

        fn choose_move(&self, _board: &GameY) -> Option<Coordinates> {
            Some(self.coords)
        }
    }

    fn state_with_bot(bot: Arc<dyn YBot>) -> AppState {
        let registry = YBotRegistry::new().with_bot(bot);
        AppState::new(registry)
    }

    #[tokio::test]
    async fn new_game_rejects_board_size_out_of_range() {
        let err = new_game(Json(NewGameRequest { size: MIN_BOARD_SIZE - 1 }))
            .await
            .unwrap_err();
        assert!(err.message.contains("Board size must be between"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);

        let err = new_game(Json(NewGameRequest { size: MAX_BOARD_SIZE + 1 }))
            .await
            .unwrap_err();
        assert!(err.message.contains("Board size must be between"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, None);
    }

    #[tokio::test]
    async fn new_game_accepts_valid_size_and_returns_yen() {
        let res = new_game(Json(NewGameRequest { size: 3 }))
            .await
            .unwrap()
            .0;

        assert_eq!(res.yen.size(), 3);
    }

    #[tokio::test]
    async fn new_hvb_game_human_starter_returns_ongoing_no_bot_move() {
        let state = state_with_bot(Arc::new(NoMoveBot));

        let res = new_hvb_game(
            State(state),
            Path("no_move_bot".to_string()),
            Json(NewHvbGameRequest {
                size: 3,
                starter: Starter::Human,
            }),
        )
        .await
        .unwrap()
        .0;

        assert_eq!(res.yen.size(), 3);
        assert!(res.bot_move.is_none());

        match res.status {
            GameState::Ongoing { next } => assert_eq!(next, "human"),
            _ => panic!("Expected ongoing game"),
        }
    }

    #[tokio::test]
    async fn new_hvb_game_unknown_bot_id_returns_error() {
        let state = state_with_bot(Arc::new(NoMoveBot));

        let err = new_hvb_game(
            State(state),
            Path("this_bot_does_not_exist".to_string()),
            Json(NewHvbGameRequest {
                size: 3,
                starter: Starter::Bot,
            }),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Unknown bot_id"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, Some("this_bot_does_not_exist".to_string()));
    }

    #[tokio::test]
    async fn new_hvb_game_bot_starter_bot_cannot_choose_move_returns_error() {
        let state = state_with_bot(Arc::new(NoMoveBot));

        let err = new_hvb_game(
            State(state),
            Path("no_move_bot".to_string()),
            Json(NewHvbGameRequest {
                size: 3,
                starter: Starter::Bot,
            }),
        )
        .await
        .unwrap_err();

        assert_eq!(err.message, "Bot could not choose a move");
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, Some("no_move_bot".to_string()));
    }

    #[tokio::test]
    async fn human_vs_bot_move_rejects_cell_id_out_of_range() {
        let state = state_with_bot(Arc::new(NoMoveBot));
        let game = GameY::new(3);
        let yen = YEN::from(&game);

        let err = human_vs_bot_move(
            State(state),
            Path("no_move_bot".to_string()),
            Json(HumanMoveRequest { yen, cell_id: 999 }),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("cell_id out of range"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, Some("no_move_bot".to_string()));
    }

    #[tokio::test]
    async fn human_vs_bot_move_invalid_yen_returns_error() {
        let state = state_with_bot(Arc::new(NoMoveBot));

        let bad_yen = YEN::new(3, 0, vec!['B', 'R'], "X/.B/..R".to_string());

        let err = human_vs_bot_move(
            State(state),
            Path("no_move_bot".to_string()),
            Json(HumanMoveRequest {
                yen: bad_yen,
                cell_id: 0,
            }),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Invalid YEN"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, Some("no_move_bot".to_string()));
    }

    #[tokio::test]
    async fn human_vs_bot_move_human_wins_and_bot_does_not_move() {
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

        let state = state_with_bot(Arc::new(NoMoveBot));

        let res = human_vs_bot_move(
            State(state),
            Path("no_move_bot".to_string()),
            Json(HumanMoveRequest {
                yen,
                cell_id: winning_cell_id,
            }),
        )
        .await
        .unwrap()
        .0;

        assert!(res.bot_move.is_none());

        match res.status {
            GameState::Finished { winner } => assert_eq!(winner, "human"),
            _ => panic!("Expected finished game with human winner"),
        }
    }

    #[tokio::test]
    async fn human_vs_bot_move_bot_move_rejected_if_bot_plays_on_occupied_cell() {
        let size = 3;
        let occupied_cell_id = 0;
        let occupied_coords = Coordinates::from_index(occupied_cell_id, size);

        let bot = FixedCoordBot {
            name: "fixed_bot",
            coords: occupied_coords,
        };
        let state = state_with_bot(Arc::new(bot));

        let game = GameY::new(size);
        let yen = YEN::from(&game);

        let err = human_vs_bot_move(
            State(state),
            Path("fixed_bot".to_string()),
            Json(HumanMoveRequest {
                yen,
                cell_id: occupied_cell_id,
            }),
        )
        .await
        .unwrap_err();

        assert!(err.message.contains("Bot move rejected"));
        assert_eq!(err.api_version, Some("v1".to_string()));
        assert_eq!(err.bot_id, Some("fixed_bot".to_string()));
    }
}