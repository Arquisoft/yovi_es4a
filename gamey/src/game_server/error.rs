//! error.rs
//!
//! Errores HTTP consistentes para el game_server.
//! Evitamos depender de bot_server para mantener módulos desacoplados.

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct ApiError {
    pub message: String,
    pub code: String,
}

impl ApiError {
    pub fn bad_request(message: impl Into<String>, code: impl Into<String>) -> (StatusCode, Json<ApiError>) {(
        StatusCode::BAD_REQUEST,
        Json(ApiError { message: message.into(), code: code.into() }),
    )}

    pub fn not_found(message: impl Into<String>, code: impl Into<String>) -> (StatusCode, Json<ApiError>) {(
        StatusCode::NOT_FOUND,
        Json(ApiError { message: message.into(), code: code.into() }),
    )}

    pub fn conflict(message: impl Into<String>, code: impl Into<String>) -> (StatusCode, Json<ApiError>) {(
        StatusCode::CONFLICT,
        Json(ApiError { message: message.into(), code: code.into() }),
    )}

    pub fn internal(message: impl Into<String>, code: impl Into<String>) -> (StatusCode, Json<ApiError>) {(
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiError { message: message.into(), code: code.into() }),
    )}
}

#[derive(Debug)]
pub struct ApiErrorResponse(pub StatusCode, pub ApiError);

impl IntoResponse for ApiErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (self.0, Json(self.1)).into_response()
    }
}

impl ApiErrorResponse {
    pub fn bad_request(message: impl Into<String>, code: impl Into<String>) -> Self {
        let (st, Json(body)) = ApiError::bad_request(message, code);
        Self(st, body)
    }

    pub fn not_found(message: impl Into<String>, code: impl Into<String>) -> Self {
        let (st, Json(body)) = ApiError::not_found(message, code);
        Self(st, body)
    }

    pub fn conflict(message: impl Into<String>, code: impl Into<String>) -> Self {
        let (st, Json(body)) = ApiError::conflict(message, code);
        Self(st, body)
    }

    pub fn internal(message: impl Into<String>, code: impl Into<String>) -> Self {
        let (st, Json(body)) = ApiError::internal(message, code);
        Self(st, body)
    }
}