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

/// POST /v1/game/new
pub async fn new_game(Json(req): Json<NewGameRequest>) -> Result<Json<NewGameResponse>, ErrorResponse> {
    if req.size < 2 {
        return Err(ErrorResponse::error(
            "Board size must be >= 2",
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
    if size < 2 {
        return Err(ErrorResponse::error(
            "Invalid board size in YEN",
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
