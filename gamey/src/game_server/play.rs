use axum::{
    extract::{Query, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{Coordinates, GameY, Movement, YEN};

use super::{error::ApiErrorResponse, state::GameServerState, API_V1};

const DEFAULT_BOT_ID: &str = "random_bot";

#[derive(Debug, Deserialize)]
pub struct PlayQuery {
    pub position: Option<String>,
    pub bot_id: Option<String>,
    pub api_version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PlayResponse {
    pub api_version: String,
    pub bot_id: String,
    pub coords: Coordinates,
    pub position: YEN,
}

/// GET /play?position=<json-yen-url-encoded>&bot_id=<bot>&api_version=v1
///
/// `position` contiene un YEN serializado como JSON dentro del query param.
/// 
/// La respuesta incluye:
/// - coords: coordenadas elegidas por el bot
/// - position: YEN resultante tras aplicar la jugada
pub async fn play(
    State(state): State<GameServerState>,
    Query(query): Query<PlayQuery>,
) -> Result<Json<PlayResponse>, ApiErrorResponse> {
    let api_version = query.api_version.unwrap_or_else(|| API_V1.to_string());

    if api_version != API_V1 {
        return Err(ApiErrorResponse::bad_request(
            format!(
                "Unsupported api_version: {}. Supported version is {}",
                api_version, API_V1
            ),
            "unsupported_api_version",
        ));
    }

    let bot_id = query
        .bot_id
        .unwrap_or_else(|| DEFAULT_BOT_ID.to_string());

    let position_raw = query.position.ok_or_else(|| {
        ApiErrorResponse::bad_request(
            "Missing required query parameter: position",
            "missing_position",
        )
    })?;

    let yen: YEN = serde_json::from_str(&position_raw).map_err(|e| {
        ApiErrorResponse::bad_request(
            format!("Invalid position parameter. Expected JSON-encoded YEN: {e}"),
            "invalid_position",
        )
    })?;

    let game = GameY::try_from(yen).map_err(|e| {
        ApiErrorResponse::bad_request(format!("Invalid YEN position: {e}"), "invalid_yen")
    })?;

    if game.check_game_over() {
        return Err(ApiErrorResponse::conflict(
            "Position is already finished",
            "game_finished",
        ));
    }

    let next_player = game.next_player().ok_or_else(|| {
        ApiErrorResponse::conflict("Position has no next player", "missing_next_player")
    })?;

    let bot = state.bots.find(&bot_id).ok_or_else(|| {
        let mut names = state.bots.names();
        names.sort();

        ApiErrorResponse::not_found(
            format!(
                "Bot not found: {}. Available bots: [{}]",
                bot_id,
                names.join(", ")
            ),
            "bot_not_found",
        )
    })?;

    let coords = bot.choose_move(&game).ok_or_else(|| {
        ApiErrorResponse::conflict(
            "No valid moves available for the bot",
            "no_valid_moves",
        )
    })?;

    let mut next_position = game.clone();
    next_position
        .add_move(Movement::Placement {
            player: next_player,
            coords,
        })
        .map_err(|e| {
            ApiErrorResponse::conflict(
                format!("Bot selected an invalid move: {e}"),
                "invalid_bot_move",
            )
        })?;

    Ok(Json(PlayResponse {
        api_version,
        bot_id,
        coords,
        position: YEN::from(&next_position),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;

    use crate::game_server::create_router;
    use crate::game_server::state::GameServerState;

    fn percent_encode(input: &str) -> String {
        input.bytes()
            .map(|b| match b {
                b'A'..=b'Z'
                | b'a'..=b'z'
                | b'0'..=b'9'
                | b'-'
                | b'_'
                | b'.'
                | b'~' => (b as char).to_string(),
                _ => format!("%{:02X}", b),
            })
            .collect()
    }

    fn build_position_query(yen: &YEN) -> String {
        let raw = serde_json::to_string(yen).unwrap();
        percent_encode(&raw)
    }

    #[tokio::test]
    async fn play_returns_move_and_next_position() {
        let app = create_router(GameServerState::new_default());
        let yen = YEN::new(3, 0, vec!['B', 'R'], ".../../.".to_string());

        let uri = format!(
            "/play?position={}&bot_id=random_bot&api_version=v1",
            build_position_query(&yen)
        );

        let response = app
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn play_uses_default_bot_when_bot_id_is_missing() {
        let app = create_router(GameServerState::new_default());
        let yen = YEN::new(3, 0, vec!['B', 'R'], ".../../.".to_string());

        let uri = format!("/play?position={}", build_position_query(&yen));

        let response = app
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn play_rejects_unsupported_api_version() {
        let app = create_router(GameServerState::new_default());
        let yen = YEN::new(3, 0, vec!['B', 'R'], ".../../.".to_string());

        let uri = format!(
            "/play?position={}&api_version=v2",
            build_position_query(&yen)
        );

        let response = app
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn play_rejects_unknown_bot() {
        let app = create_router(GameServerState::new_default());
        let yen = YEN::new(3, 0, vec!['B', 'R'], ".../../.".to_string());

        let uri = format!(
            "/play?position={}&bot_id=ghost_bot",
            build_position_query(&yen)
        );

        let response = app
            .oneshot(
                Request::builder()
                    .uri(uri)
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn play_requires_position() {
        let app = create_router(GameServerState::new_default());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/play")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}