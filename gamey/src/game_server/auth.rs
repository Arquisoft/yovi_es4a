//! auth.rs
//!
//! Identidad del cliente para:
//! - Guardar config "recordada"
//! - Asociar sesiones de juego


use axum::http::HeaderMap;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Principal {
    /// Invitado (sin módulo users). Se identifica por client_id estable del navegador.
    Guest { client_id: String },

    /// Futuro: usuario autenticado.
    /// Se identifica por user_id (ej. UUID) que viene del módulo users tras validar token.
    User { user_id: String },
}

impl Principal {
    /// Devuelve una clave estable para HashMaps.
    pub fn key(&self) -> String {
        match self {
            Principal::Guest { client_id } => format!("guest:{client_id}"),
            Principal::User { user_id } => format!("user:{user_id}"),
        }
    }
}

/// Extrae el principal a partir de headers.
pub fn resolve_principal(headers: &HeaderMap) -> Principal {
    let client_id = headers
        .get("x-client-id")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "anonymous".to_string());

    Principal::Guest { client_id }
}