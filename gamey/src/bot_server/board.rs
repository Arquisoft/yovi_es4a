use axum::{
    extract::{Path, Query},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::core::Coordinates;
use crate::bot_server::version::check_api_version;

#[derive(Deserialize)]
pub struct BoardQuery {
    pub size: u32,
}

#[derive(Serialize)]
pub struct BoardResponse {
    pub api_version: String,
    pub size: u32,
    pub cells: Vec<Coordinates>,
}

// GET /{api_version}/board?size=7
pub async fn get_board(
    Path(api_version): Path<String>,
    Query(q): Query<BoardQuery>,
) -> impl IntoResponse {
    // valida versión
    if let Err(err) = check_api_version(&api_version) {
        return (StatusCode::BAD_REQUEST, Json(err)).into_response();
    }

    // valida size
    if q.size < 1 {
    return (
        StatusCode::BAD_REQUEST,
        Json(serde_json::json!({
            "api_version": api_version,
            "message": "size must be >= 1"
        })),
    )
        .into_response();
}

    // total celdas en triángulo
    let total_cells = (q.size * (q.size + 1)) / 2;

    // generar coords válidas usando la lógica de gamey
    let mut cells = Vec::with_capacity(total_cells as usize);
    for idx in 0..total_cells {
        cells.push(Coordinates::from_index(idx, q.size));
    }

    let response = BoardResponse {
        api_version,
        size: q.size,
        cells,
    };

    (StatusCode::OK, Json(response)).into_response()
}
