use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub id: String,
    pub agent_type: String,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
