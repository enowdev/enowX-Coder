use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

use crate::error::AppResult;

#[derive(Clone)]
pub struct PermissionState {
    pending: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl Default for PermissionState {
    fn default() -> Self {
        Self::new()
    }
}

impl PermissionState {
    pub fn new() -> Self {
        Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register(&self, agent_run_id: String) -> oneshot::Receiver<bool> {
        let (tx, rx) = oneshot::channel();
        if let Ok(mut pending) = self.pending.lock() {
            pending.insert(agent_run_id, tx);
        }
        rx
    }

    pub fn respond(&self, agent_run_id: &str, allowed: bool) -> bool {
        self.pending
            .lock()
            .ok()
            .and_then(|mut pending| pending.remove(agent_run_id))
            .map(|tx| tx.send(allowed).is_ok())
            .unwrap_or(false)
    }
}

/// Registry for cancellation tokens keyed by an arbitrary ID (session_id or agent_run_id).
#[derive(Clone, Default)]
pub struct CancellationRegistry {
    tokens: Arc<Mutex<HashMap<String, CancellationToken>>>,
}

impl CancellationRegistry {
    pub fn new() -> Self {
        Self {
            tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create and register a new cancellation token for the given key.
    /// Returns the token so the caller can pass it into async work.
    pub fn register(&self, key: String) -> CancellationToken {
        let token = CancellationToken::new();
        if let Ok(mut map) = self.tokens.lock() {
            map.insert(key, token.clone());
        }
        token
    }

    /// Cancel the token associated with the given key (if any).
    pub fn cancel(&self, key: &str) {
        if let Ok(mut map) = self.tokens.lock() {
            if let Some(token) = map.remove(key) {
                token.cancel();
            }
        }
    }

    /// Remove the token for the given key without cancelling it (cleanup after normal completion).
    pub fn remove(&self, key: &str) {
        if let Ok(mut map) = self.tokens.lock() {
            map.remove(key);
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<SqlitePool>,
    pub permissions: PermissionState,
    pub cancellations: CancellationRegistry,
}

impl AppState {
    pub async fn new(database_url: &str) -> AppResult<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;

        sqlx::query("PRAGMA foreign_keys = ON")
            .execute(&pool)
            .await?;

        Ok(Self {
            db: Arc::new(pool),
            permissions: PermissionState::new(),
            cancellations: CancellationRegistry::new(),
        })
    }

    pub fn pool(&self) -> &SqlitePool {
        self.db.as_ref()
    }
}
