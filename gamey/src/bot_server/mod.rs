//! HTTP server for Y game bots.
//!
//! This module provides an Axum-based REST API for querying Y game bots.
//! The server exposes endpoints for checking bot status and requesting moves.
//!
//! # Endpoints
//! - `GET /status` - Health check endpoint
//! - `POST /{api_version}/ybot/choose/{bot_id}` - Request a move from a bot
//!
//! # Example
//! ```no_run
//! use gamey::run_bot_server;
//!
//! #[tokio::main]
//! async fn main() {
//!     if let Err(e) = run_bot_server(3000).await {
//!         eprintln!("Server error: {}", e);
//!     }
//! }
//! ```

pub mod choose;
pub mod error;
pub mod state;
pub mod version;
use axum::response::IntoResponse;
use std::sync::Arc;
pub use choose::MoveResponse;
pub use error::ErrorResponse;
pub use version::*;

use crate::{GameYError, RandomBot, YBotRegistry};
use self::state::AppState;

/// Creates the Axum router with the given state.
///
/// This is useful for testing the API without binding to a network port.
pub fn create_router(state: AppState) -> axum::Router {
    axum::Router::new()
        .route("/status", axum::routing::get(status))
        .route(
            "/{api_version}/ybot/choose/{bot_id}",
            axum::routing::post(choose::choose),
        )
        .with_state(state)
}

/// Creates the default application state with the standard bot registry.
///
/// The default state includes the `RandomBot` which selects moves randomly.
pub fn create_default_state() -> AppState {
    let bots = YBotRegistry::new().with_bot(Arc::new(RandomBot));
    AppState::new(bots)
}

/// Starts the bot server on the specified port.
///
/// This function blocks until the server is shut down.
///
/// # Arguments
/// * `port` - The TCP port to listen on
///
/// # Errors
/// Returns `GameYError::ServerError` if:
/// - The TCP port cannot be bound (e.g., port already in use, permission denied)
/// - The server encounters an error while running
pub async fn run_bot_server(port: u16) -> Result<(), GameYError> {
    let state = create_default_state();
    let app = create_router(state);

    let addr = format!("0.0.0.0:{}", port);
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Failed to bind to {}: {}", addr, e),
        })?;

    println!("Server mode: Listening on http://{}", addr);
    axum::serve(listener, app)
        .await
        .map_err(|e| GameYError::ServerError {
            message: format!("Server error: {}", e),
        })?;

    Ok(())
}

/// Health check endpoint handler.
///
/// Returns "OK" to indicate the server is running.
pub async fn status() -> impl IntoResponse {
    "OK"
}

// =============================================================================
// Tests para seguridad de rutas y estados. Si se cambia algo, salta.
// =============================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt; // Para llamar a oneshot()

    // Test: El endpoint de estado responde correctamente
    #[tokio::test]
    async fn test_status_endpoint() {
        let app = create_router(create_default_state());

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/status")
                    .method("GET")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        assert_eq!(body, "OK");
    }

    // Test: La inicialización del estado contiene el bot aleatorio
    #[tokio::test]
    async fn test_state_initialization() {
        let state = create_default_state();
        assert!(state.bots().names().contains(&"random_bot".to_string()));
    }

    // Test: El router maneja rutas desconocidas con 404
    #[tokio::test]
    async fn test_unknown_route() {
        let app = create_router(create_default_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/unknown")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    // Test: Intento de POST a un bot válido con datos de juego
    // Se usa un JSON literal para evitar errores de serialización de GameY
    #[tokio::test]
    async fn test_choose_move_integration() {
        let app = create_router(create_default_state());
        // Simulamos el cuerpo JSON manualmente
        let json_body = r#"{"size": 7, "moves": []}"#;

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/ybot/choose/random_bot")
                    .method("POST")
                    .header("Content-Type", "application/json")
                    .body(Body::from(json_body))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Verificamos que la ruta es válida (no devuelve 404)
        // El resultado puede ser 200 o un error de validación, pero la ruta se visitó
        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    // Test: Versión de API no soportada (v2)
    #[tokio::test]
    async fn test_invalid_api_version() {
        let app = create_router(create_default_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v2/ybot/choose/random_bot")
                    .method("POST")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();

        // Debería fallar o no encontrar la ruta según la configuración
        assert_ne!(response.status(), StatusCode::OK);
    }

    // Test: Bot inexistente
    #[tokio::test]
    async fn test_nonexistent_bot() {
        let app = create_router(create_default_state());
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/v1/ybot/choose/ghost_bot")
                    .method("POST")
                    .header("Content-Type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();

        // No debería dar 200 OK porque el bot no existe en el registro
        assert_ne!(response.status(), StatusCode::OK);
    }
}