//! Shared HTTP client builder for outbound LLM provider requests.
//!
//! All provider-facing HTTP calls (chat completions, model listings,
//! title generation, agent tool runs) go through these constructors.
//! This guarantees:
//!
//! - **Connect timeout** so a dead provider host fails fast (10s).
//! - **Streaming-aware request timeouts** — streaming endpoints get a
//!   long ceiling (10 min) so SSE doesn't get cut, while non-streaming
//!   calls get a sane upper bound (2 min).
//! - **Read timeout** to detect stalled streams between chunks (60s).
//! - **Identifying User-Agent** so providers (and the user's own
//!   proxy/firewall) can attribute traffic to the app.
//!
//! Without this, `reqwest::Client::new()` produces a client with no
//! timeouts at all — a network blip or a silently-rate-limited provider
//! freezes the agent indefinitely.

use std::time::Duration;

use reqwest::Client;

use crate::error::{AppError, AppResult};

const USER_AGENT: &str = concat!("enowX-Coder/", env!("CARGO_PKG_VERSION"));

/// Connect timeout for all outbound HTTP — applies to TCP + TLS handshake.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);

/// Per-chunk read timeout for streaming responses. If we don't see a byte
/// from the upstream provider in this window, the stream is considered dead.
const STREAM_READ_TIMEOUT: Duration = Duration::from_secs(60);

/// Total request timeout for non-streaming calls (model listings,
/// title generation, etc.). Generous, but bounded.
const NON_STREAMING_TIMEOUT: Duration = Duration::from_secs(120);

/// Hard upper bound for streaming requests. SSE streams shouldn't outlast
/// this — if they do, something is wrong upstream.
const STREAMING_TIMEOUT: Duration = Duration::from_secs(600);

/// Build the shared `reqwest::Client` for streaming LLM responses.
///
/// Keeps a long total ceiling so multi-minute completions can finish,
/// but still bounds connect + per-read so dead connections fail fast.
pub fn streaming_client() -> AppResult<Client> {
    Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(CONNECT_TIMEOUT)
        .read_timeout(STREAM_READ_TIMEOUT)
        .timeout(STREAMING_TIMEOUT)
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build streaming HTTP client: {e}")))
}

/// Build the shared `reqwest::Client` for short, non-streaming requests
/// (listing models, generating titles, single-shot completions).
pub fn request_client() -> AppResult<Client> {
    Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(CONNECT_TIMEOUT)
        .timeout(NON_STREAMING_TIMEOUT)
        .build()
        .map_err(|e| AppError::Internal(format!("Failed to build HTTP client: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn streaming_client_builds() {
        let client = streaming_client();
        assert!(client.is_ok(), "streaming_client should build cleanly");
    }

    #[test]
    fn request_client_builds() {
        let client = request_client();
        assert!(client.is_ok(), "request_client should build cleanly");
    }

    #[test]
    fn user_agent_includes_version() {
        assert!(USER_AGENT.starts_with("enowX-Coder/"));
        assert!(USER_AGENT.len() > "enowX-Coder/".len());
    }
}
