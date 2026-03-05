//! state.rs
//!
//! Estado global del game_server (Axum state):
//! - registro de bots
//! - store de config (in-memory hoy)
//! - store de sesiones (in-memory)

use std::sync::Arc;

use crate::{MctsBot, RandomBot, YBotRegistry};

use self::config_store::ConfigStore;

use super::sessions::SessionStore;

pub mod config_store {
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    use crate::game_server::dto::{GameConfig, Starter};
    use crate::game_server::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};
    use crate::game_server::auth::Principal;

    #[derive(Debug, Clone)]
    pub struct ConfigStore {
        inner: Arc<RwLock<HashMap<String, GameConfig>>>,
    }

    impl ConfigStore {
        pub fn new() -> Self {
            Self { inner: Arc::new(RwLock::new(HashMap::new())) }
        }

        pub fn default_config() -> GameConfig {
            GameConfig {
                size: 7,
                starter: Starter::Human,
                bot_id: Some("random_bot".to_string()),
            }
        }

        pub fn clamp_size(size: u32) -> u32 {
            size.max(MIN_BOARD_SIZE).min(MAX_BOARD_SIZE)
        }

        pub fn normalize(mut cfg: GameConfig) -> GameConfig {
            cfg.size = Self::clamp_size(cfg.size);
            cfg
        }

        pub fn key(p: &Principal) -> String { p.key() }

        pub fn get_or_default_blocking(map: &HashMap<String, GameConfig>, key: &str) -> GameConfig {
            map.get(key).cloned().unwrap_or_else(Self::default_config)
        }

        pub async fn get_or_default(&self, principal: &Principal) -> GameConfig {
            let r = self.inner.read().await;
            Self::get_or_default_blocking(&r, &Self::key(principal))
        }

        pub fn set(&self, principal: &Principal, cfg: GameConfig) {
            let key = Self::key(principal);
            let cfg = Self::normalize(cfg);
            let inner = self.inner.clone();
            tokio::spawn(async move {
                inner.write().await.insert(key, cfg);
            });
        }
    }
}

#[derive(Clone)]
pub struct GameServerState {
    pub bots: Arc<YBotRegistry>,
    pub sessions: SessionStore,
    pub config_store: ConfigStore,
}

impl GameServerState {
    pub fn new_default() -> Self {
        let bots = YBotRegistry::new()
            .with_bot(Arc::new(RandomBot))
            .with_bot(Arc::new(MctsBot::new(5_000)))
            .with_bot(Arc::new(MctsBot::new(20_000)));

        Self {
            bots: Arc::new(bots),
            sessions: SessionStore::new(),
            config_store: ConfigStore::new(),
        }
    }
}