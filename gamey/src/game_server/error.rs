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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;

    #[test]
    fn api_error_bad_request_builder() {
        let (status, Json(body)) = ApiError::bad_request("bad", "bad_code");
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(body.message, "bad");
        assert_eq!(body.code, "bad_code");
    }

    #[test]
    fn api_error_not_found_builder() {
        let (status, Json(body)) = ApiError::not_found("missing", "not_found");
        assert_eq!(status, StatusCode::NOT_FOUND);
        assert_eq!(body.message, "missing");
        assert_eq!(body.code, "not_found");
    }

    #[test]
    fn api_error_conflict_builder() {
        let (status, Json(body)) = ApiError::conflict("conflict", "conflict_code");
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body.message, "conflict");
        assert_eq!(body.code, "conflict_code");
    }

    #[test]
    fn api_error_internal_builder() {
        let (status, Json(body)) = ApiError::internal("boom", "internal_code");
        assert_eq!(status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(body.message, "boom");
        assert_eq!(body.code, "internal_code");
    }

    #[test]
    fn api_error_response_bad_request_builder() {
        let err = ApiErrorResponse::bad_request("bad", "bad_code");
        assert_eq!(err.0, StatusCode::BAD_REQUEST);
        assert_eq!(err.1.message, "bad");
        assert_eq!(err.1.code, "bad_code");
    }

    #[test]
    fn api_error_response_not_found_builder() {
        let err = ApiErrorResponse::not_found("missing", "not_found");
        assert_eq!(err.0, StatusCode::NOT_FOUND);
        assert_eq!(err.1.message, "missing");
        assert_eq!(err.1.code, "not_found");
    }

    #[test]
    fn api_error_response_conflict_builder() {
        let err = ApiErrorResponse::conflict("conflict", "conflict_code");
        assert_eq!(err.0, StatusCode::CONFLICT);
        assert_eq!(err.1.message, "conflict");
        assert_eq!(err.1.code, "conflict_code");
    }

    #[test]
    fn api_error_response_internal_builder() {
        let err = ApiErrorResponse::internal("boom", "internal_code");
        assert_eq!(err.0, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.1.message, "boom");
        assert_eq!(err.1.code, "internal_code");
    }

    #[test]
    fn into_response_preserves_status() {
        let response = ApiErrorResponse::bad_request("bad", "bad_code").into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}