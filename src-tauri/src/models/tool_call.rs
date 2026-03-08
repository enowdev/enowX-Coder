use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    pub agent_run_id: String,
    pub tool_name: String,
    pub input: String,
    pub output: Option<String>,
    pub status: String,
    pub error: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}
