use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Provider {
    pub id: String,
    pub name: String,
    pub provider_type: String,
    pub base_url: String,
    pub api_key: Option<String>,
    pub model: String,
    pub is_default: bool,
    pub is_builtin: bool,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub fn fixed_base_url(provider_type: &str) -> Option<&'static str> {
    match provider_type {
        "enowxlabs" => Some("https://api.enowxlabs.com/v1"),
        "openai" => Some("https://api.openai.com/v1"),
        "anthropic" => Some("https://api.anthropic.com/v1"),
        "gemini" => Some("https://generativelanguage.googleapis.com/v1beta/openai"),
        _ => None,
    }
}
