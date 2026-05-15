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
    /// Wire format: `"openai"` (default) or `"anthropic"`.
    /// Determines which serialisation path (and prompt caching) is used.
    #[serde(default = "default_api_format")]
    #[sqlx(default)]
    pub api_format: String,
    pub created_at: String,
    pub updated_at: String,
}

fn default_api_format() -> String {
    "openai".to_string()
}

impl Provider {
    /// Returns `true` when the provider should use the Anthropic Messages API
    /// format (content blocks, system-as-top-level, prompt caching).
    pub fn uses_anthropic_format(&self) -> bool {
        self.api_format == "anthropic"
            || self.provider_type == "anthropic"
            || self.provider_type == "enowxlabs"
    }
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
