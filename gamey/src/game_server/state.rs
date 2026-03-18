//! state.rs
//!
//! Estado global del game_server (Axum state):
//! - registro de bots
//! - store de config (in-memory hoy)
//! - store de sesiones (in-memory)

use std::sync::Arc;

use crate::{GreedyBot, MctsBot, RandomBot, YBotRegistry};

use self::config_store::ConfigStore;

use super::sessions::SessionStore;

pub mod config_store {
    use std::collections::HashMap;
    use std::sync::Arc;
    use tokio::sync::RwLock;

    use crate::game_server::dto::{GameConfig, HvBStarter, HvHStarter};
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
                hvb_starter: HvBStarter::Human,
                bot_id: Some("random_bot".to_string()),
                hvh_starter: Some(HvHStarter::Player0),
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
            .with_bot(Arc::new(GreedyBot))
            .with_bot(Arc::new(MctsBot::named("mcts_fast_bot", 5_000)))
            .with_bot(Arc::new(MctsBot::named("mcts_strong_bot", 20_000)));

        Self {
            bots: Arc::new(bots),
            sessions: SessionStore::new(),
            config_store: ConfigStore::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::time::{sleep, Duration};

    use crate::game_server::auth::Principal;
    use crate::game_server::dto::{GameConfig, HvBStarter, HvHStarter};
    use crate::game_server::{MAX_BOARD_SIZE, MIN_BOARD_SIZE};

    #[test]
    fn default_config_has_expected_values() {
        let cfg = config_store::ConfigStore::default_config();

        assert_eq!(cfg.size, 7);
        assert!(matches!(cfg.hvb_starter, HvBStarter::Human));
        assert!(matches!(cfg.hvh_starter, Some(HvHStarter::Player0)));
        assert_eq!(cfg.bot_id.as_deref(), Some("random_bot"));
    }

    #[test]
    fn clamp_size_respects_min() {
        assert_eq!(
            config_store::ConfigStore::clamp_size(MIN_BOARD_SIZE - 1),
            MIN_BOARD_SIZE
        );
    }

    #[test]
    fn clamp_size_respects_max() {
        assert_eq!(
            config_store::ConfigStore::clamp_size(MAX_BOARD_SIZE + 1),
            MAX_BOARD_SIZE
        );
    }

    #[test]
    fn clamp_size_keeps_valid_value() {
        assert_eq!(config_store::ConfigStore::clamp_size(7), 7);
    }

    #[test]
    fn normalize_clamps_size() {
        let cfg = GameConfig {
            size: MAX_BOARD_SIZE + 5,
            hvb_starter: HvBStarter::Human,
            hvh_starter: Some(HvHStarter::Player0),
            bot_id: Some("random_bot".to_string()),
        };

        let normalized = config_store::ConfigStore::normalize(cfg);
        assert_eq!(normalized.size, MAX_BOARD_SIZE);
    }

    #[test]
    fn key_delegates_to_principal() {
        let p = Principal::Guest {
            client_id: "abc".to_string(),
        };

        assert_eq!(config_store::ConfigStore::key(&p), "guest:abc");
    }

    #[test]
    fn get_or_default_blocking_returns_default_for_missing_key() {
        let map = std::collections::HashMap::new();

        let cfg = config_store::ConfigStore::get_or_default_blocking(&map, "missing");
        assert_eq!(cfg.size, 7);
        assert_eq!(cfg.bot_id.as_deref(), Some("random_bot"));
    }

    #[tokio::test]
    async fn get_or_default_returns_stored_config() {
        let store = config_store::ConfigStore::new();
        let principal = Principal::Guest {
            client_id: "stored".to_string(),
        };

        store.set(
            &principal,
            GameConfig {
                size: 9,
                hvb_starter: HvBStarter::Bot,
                hvh_starter: Some(HvHStarter::Player1),
                bot_id: Some("random_bot".to_string()),
            },
        );

        sleep(Duration::from_millis(50)).await;

        let cfg = store.get_or_default(&principal).await;
        assert_eq!(cfg.size, 9);
        assert!(matches!(cfg.hvb_starter, HvBStarter::Bot));
        assert!(matches!(cfg.hvh_starter, Some(HvHStarter::Player1)));
    }

    #[test]
    fn new_default_creates_state_with_expected_bots() {
        let state = GameServerState::new_default();
        let names = state.bots.names();

        assert!(!names.is_empty());
        assert!(names.iter().any(|b| b == "random_bot"));
        assert!(names.iter().any(|b| b == "greedy_bot"));
        assert!(names.iter().any(|b| b == "mcts_fast_bot"));
        assert!(names.iter().any(|b| b == "mcts_strong_bot"));
    }
}