//! sessions.rs
//!
//! Store in-memory de partidas activas.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::GameY;

use super::auth::Principal;
use super::dto::{GameConfig, GameMode, Winner};

#[derive(Debug, Clone)]
pub struct GameSession {
    pub owner_key: String,
    pub mode: GameMode,
    pub config: GameConfig,
    pub game: GameY,
    pub bot_id: Option<String>,

    // Estado específico HvB
    pub hvb_next_is_human: Option<bool>,
    pub hvb_winner: Option<Winner>,

    // Estado específico HvH
    pub hvh_next_player: Option<u8>,
    pub hvh_winner: Option<u8>,
}

#[derive(Debug, Clone)]
pub struct SessionStore {
    inner: Arc<RwLock<HashMap<String, GameSession>>>,
}

impl SessionStore {
    pub fn new() -> Self {
        Self { inner: Arc::new(RwLock::new(HashMap::new())) }
    }

    pub async fn insert(&self, game_id: String, session: GameSession) {
        self.inner.write().await.insert(game_id, session);
    }

    pub async fn get(&self, game_id: &str) -> Option<GameSession> {
        self.inner.read().await.get(game_id).cloned()
    }

    pub async fn remove(&self, game_id: &str) -> Option<GameSession> {
        self.inner.write().await.remove(game_id)
    }

    pub async fn assert_owner(&self, principal: &Principal, game_id: &str) -> Result<GameSession, ()> {
        let s = self.get(game_id).await.ok_or(())?;
        if s.owner_key == principal.key() {
            Ok(s)
        } else {
            Err(())
        }
    }

    pub async fn update(&self, game_id: &str, session: GameSession) -> Result<(), ()> {
        let mut w = self.inner.write().await;
        if w.contains_key(game_id) {
            w.insert(game_id.to_string(), session);
            Ok(())
        } else {
            Err(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::game_server::auth::Principal;
    use crate::game_server::dto::{GameConfig, GameMode, HvBStarter, HvHStarter};

    fn sample_session(owner_key: String) -> GameSession {
        GameSession {
            owner_key,
            mode: GameMode::Hvh,
            config: GameConfig {
                size: 7,
                hvb_starter: HvBStarter::Human,
                hvh_starter: Some(HvHStarter::Player0),
                bot_id: Some("random_bot".to_string()),
            },
            game: GameY::new(2),
            bot_id: None,

            hvb_next_is_human: None,
            hvb_winner: None,

            hvh_next_player: Some(0),
            hvh_winner: None,
        }
    }

    #[tokio::test]
    async fn insert_and_get_session() {
        let store = SessionStore::new();
        let session = sample_session("guest:abc".to_string());

        store.insert("game-1".to_string(), session.clone()).await;

        let found = store.get("game-1").await;
        assert!(found.is_some());
        assert_eq!(found.unwrap().owner_key, "guest:abc");
    }

    #[tokio::test]
    async fn get_missing_session_returns_none() {
        let store = SessionStore::new();
        assert!(store.get("missing").await.is_none());
    }

    #[tokio::test]
    async fn remove_session_returns_removed_value() {
        let store = SessionStore::new();
        let session = sample_session("guest:abc".to_string());

        store.insert("game-2".to_string(), session).await;
        let removed = store.remove("game-2").await;

        assert!(removed.is_some());
        assert!(store.get("game-2").await.is_none());
    }

    #[tokio::test]
    async fn assert_owner_returns_session_for_owner() {
        let store = SessionStore::new();
        let principal = Principal::Guest {
            client_id: "abc".to_string(),
        };
        let session = sample_session(principal.key());

        store.insert("game-3".to_string(), session.clone()).await;

        let found = store.assert_owner(&principal, "game-3").await.unwrap();
        assert_eq!(found.owner_key, principal.key());
    }

    #[tokio::test]
    async fn assert_owner_fails_when_game_does_not_exist() {
        let store = SessionStore::new();
        let principal = Principal::Guest {
            client_id: "abc".to_string(),
        };

        assert!(store.assert_owner(&principal, "missing").await.is_err());
    }

    #[tokio::test]
    async fn assert_owner_fails_for_different_owner() {
        let store = SessionStore::new();
        let owner = Principal::Guest {
            client_id: "owner".to_string(),
        };
        let other = Principal::Guest {
            client_id: "other".to_string(),
        };

        store
            .insert("game-4".to_string(), sample_session(owner.key()))
            .await;

        assert!(store.assert_owner(&other, "game-4").await.is_err());
    }

    #[tokio::test]
    async fn update_existing_session_succeeds() {
        let store = SessionStore::new();
        let mut session = sample_session("guest:abc".to_string());

        store.insert("game-5".to_string(), session.clone()).await;

        session.hvh_next_player = Some(1);
        let res = store.update("game-5", session.clone()).await;
        assert!(res.is_ok());

        let found = store.get("game-5").await.unwrap();
        assert_eq!(found.hvh_next_player, Some(1));
    }

    #[tokio::test]
    async fn update_missing_session_fails() {
        let store = SessionStore::new();
        let session = sample_session("guest:abc".to_string());

        let res = store.update("missing", session).await;
        assert!(res.is_err());
    }
}