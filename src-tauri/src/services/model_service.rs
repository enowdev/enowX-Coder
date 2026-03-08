use reqwest::Client;
use serde::Deserialize;

use crate::error::{AppError, AppResult};

#[derive(Debug, Deserialize)]
struct OpenAiModelList {
    data: Vec<OpenAiModel>,
}

#[derive(Debug, Deserialize)]
struct OpenAiModel {
    id: String,
}

#[derive(Debug, Deserialize)]
struct AnthropicModelList {
    data: Vec<AnthropicModel>,
}

#[derive(Debug, Deserialize)]
struct AnthropicModel {
    id: String,
}

pub async fn list_models(
    provider_type: &str,
    base_url: &str,
    api_key: Option<&str>,
) -> AppResult<Vec<String>> {
    match provider_type {
        "enowxlabs" | "openai" | "ollama" | "custom" => {
            fetch_openai_models(base_url, api_key).await
        }
        "anthropic" => fetch_anthropic_models(api_key).await,
        "gemini" => fetch_openai_models(base_url, api_key).await,
        _ => Err(AppError::Validation(format!(
            "Unknown provider type: {provider_type}"
        ))),
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

    let list: OpenAiModelList = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to parse models response: {e}")))?;

    let mut ids: Vec<String> = list.data.into_iter().map(|m| m.id).collect();
    ids.sort();
    Ok(ids)
}

async fn fetch_anthropic_models(api_key: Option<&str>) -> AppResult<Vec<String>> {
    let client = Client::new();
    let mut req = client
        .get("https://api.anthropic.com/v1/models")
        .header("anthropic-version", "2023-06-01");

    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("x-api-key", key);
        }
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch Anthropic models: {e}")))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(format!(
            "Anthropic models endpoint returned {status}: {body}"
        )));
    }

    let list: AnthropicModelList = resp.json().await.map_err(|e| {
        AppError::Internal(format!("Failed to parse Anthropic models response: {e}"))
    })?;

    let mut ids: Vec<String> = list.data.into_iter().map(|m| m.id).collect();
    ids.sort();
    Ok(ids)
}
