//! sessions.rs
//!
//! Store in-memory de partidas activas.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::GameY;

use super::auth::Principal;
use super::dto::{GameConfig, GameMode};

#[derive(Debug, Clone)]
pub struct GameSession {
    pub owner_key: String,
    pub mode: GameMode,
    pub config: GameConfig,
    pub game: GameY,
    pub bot_id: Option<String>,
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