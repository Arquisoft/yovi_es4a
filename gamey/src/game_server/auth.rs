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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::{HeaderMap, HeaderValue};

    #[test]
    fn principal_guest_key_is_built_correctly() {
        let p = Principal::Guest {
            client_id: "abc123".to_string(),
        };
        assert_eq!(p.key(), "guest:abc123");
    }

    #[test]
    fn principal_user_key_is_built_correctly() {
        let p = Principal::User {
            user_id: "user-42".to_string(),
        };
        assert_eq!(p.key(), "user:user-42");
    }

    #[test]
    fn resolve_principal_uses_x_client_id_when_present() {
        let mut headers = HeaderMap::new();
        headers.insert("x-client-id", HeaderValue::from_static("client-1"));

        let p = resolve_principal(&headers);

        assert_eq!(
            p,
            Principal::Guest {
                client_id: "client-1".to_string()
            }
        );
    }

    #[test]
    fn resolve_principal_falls_back_to_anonymous_when_missing() {
        let headers = HeaderMap::new();

        let p = resolve_principal(&headers);

        assert_eq!(
            p,
            Principal::Guest {
                client_id: "anonymous".to_string()
            }
        );
    }

    #[test]
    fn resolve_principal_falls_back_to_anonymous_when_header_is_invalid_utf8() {
        let mut headers = HeaderMap::new();
        let invalid = HeaderValue::from_bytes(&[0xFF, 0xFE]).unwrap();
        headers.insert("x-client-id", invalid);

        let p = resolve_principal(&headers);

        assert_eq!(
            p,
            Principal::Guest {
                client_id: "anonymous".to_string()
            }
        );
    }
}