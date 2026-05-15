use reqwest::Client;
use serde::Deserialize;

use crate::{
    error::{AppError, AppResult},
    models::Provider,
};

#[derive(Debug, Deserialize)]
struct ModelList {
    data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
struct ModelEntry {
    id: String,
}

/// Fetch available models for a provider.
///
/// Routing logic:
///   1. Known built-in types (`openai`, `anthropic`, `enowxlabs`, …) use their
///      canonical endpoints.
///   2. Custom providers use `api_format` to decide the wire format:
///      - `"anthropic"` → Anthropic `/models` endpoint on the gateway.
///      - anything else → OpenAI `/models` endpoint on the gateway.
pub async fn list_models(provider: &Provider) -> AppResult<Vec<String>> {
    match provider.provider_type.as_str() {
        // Built-in types with known behaviour
        "openai" | "ollama" | "gemini" => {
            fetch_openai_models(&provider.base_url, provider.api_key.as_deref()).await
        }
        "anthropic" => {
            fetch_anthropic_models("https://api.anthropic.com/v1", provider.api_key.as_deref(), true).await
        }
        "enowxlabs" => {
            // enowxlabs gateway: strip /v1 for the models endpoint
            let base = provider.base_url.trim_end_matches('/').trim_end_matches("/v1");
            fetch_anthropic_models(base, provider.api_key.as_deref(), false).await
        }
        // Custom / unknown provider types — decide by api_format
        _ => {
            if provider.uses_anthropic_format() {
                fetch_anthropic_models(
                    provider.base_url.trim_end_matches('/'),
                    provider.api_key.as_deref(),
                    false,
                )
                .await
            } else {
                fetch_openai_models(&provider.base_url, provider.api_key.as_deref()).await
            }
        }
    }
}

async fn fetch_openai_models(base_url: &str, api_key: Option<&str>) -> AppResult<Vec<String>> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = Client::new();
    let mut req = client.get(&url);

    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.bearer_auth(key);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch models: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Models endpoint returned {status}: {body}"
        )));
    }

    let list: ModelList = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse models response: {e}")))?;

    let mut ids: Vec<String> = list.data.into_iter().map(|m| m.id).collect();
    ids.sort();
    Ok(ids)
}

/// Fetch models from an Anthropic-format endpoint.
///
/// `use_x_api_key`: when `true`, send the key as `x-api-key` header (Anthropic
/// direct). When `false`, send as `Authorization: Bearer` (gateways).
async fn fetch_anthropic_models(
    base_url: &str,
    api_key: Option<&str>,
    use_x_api_key: bool,
) -> AppResult<Vec<String>> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = Client::new();
    let mut req = client
        .get(&url)
        .header("anthropic-version", "2023-06-01");

    if let Some(key) = api_key {
        if !key.is_empty() {
            if use_x_api_key {
                req = req.header("x-api-key", key);
            } else {
                req = req.bearer_auth(key);
            }
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch models: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Models endpoint returned {status}: {body}"
        )));
    }

    let list: ModelList = resp.json().await.map_err(|e| {
        AppError::Internal(format!("Failed to parse models response: {e}"))
    })?;

    let mut ids: Vec<String> = list.data.into_iter().map(|m| m.id).collect();
    ids.sort();
    Ok(ids)
}
