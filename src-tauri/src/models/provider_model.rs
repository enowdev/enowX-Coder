use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ProviderModelConfig {
    pub id: String,
    pub provider_id: String,
    pub model_id: String,
    pub enabled: bool,
    pub max_tokens: i64,
    pub temperature: f64,
    pub created_at: String,
    pub updated_at: String,
}
