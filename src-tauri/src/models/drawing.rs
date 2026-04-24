use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Drawing {
    pub id: String,
    pub project_id: String,
    pub data: String,
    pub created_at: String,
    pub updated_at: String,
}
