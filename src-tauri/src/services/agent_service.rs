use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::{AgentConfig, AgentRun, ToolCall},
};

use super::now_rfc3339;

const AGENT_RUN_SELECT: &str =
    "id, session_id, agent_type, status, input, output, error, started_at, completed_at, created_at, parent_agent_run_id, project_path";
const TOOL_CALL_SELECT: &str =
    "id, agent_run_id, tool_name, input, output, status, error, started_at, completed_at, created_at";
const AGENT_CONFIG_SELECT: &str = "id, agent_type, provider_id, model_id, created_at, updated_at";

pub async fn create_agent_run(
    db: &SqlitePool,
    session_id: &str,
    agent_type: &str,
    input: Option<&str>,
    parent_agent_run_id: Option<&str>,
    project_path: Option<&str>,
) -> AppResult<AgentRun> {
    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    sqlx::query(
        "INSERT INTO agent_runs (id, session_id, agent_type, status, input, output, error, started_at, completed_at, created_at, parent_agent_run_id, project_path) \
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, ?6, NULL, ?7, ?8, ?9)",
    )
    .bind(&id)
    .bind(session_id)
    .bind(agent_type)
    .bind("pending")
    .bind(input)
    .bind(&now)
    .bind(&now)
    .bind(parent_agent_run_id)
    .bind(project_path)
    .execute(db)
    .await?;

    get_agent_run(db, &id).await?.ok_or_else(|| {
        AppError::Internal(format!(
            "Failed to fetch created agent run after insert: {id}"
        ))
    })
}

pub async fn update_agent_run_status(db: &SqlitePool, id: &str, status: &str) -> AppResult<()> {
    let result = sqlx::query("UPDATE agent_runs SET status = ?1 WHERE id = ?2")
        .bind(status)
        .bind(id)
        .execute(db)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Agent run not found: {id}")));
    }

    Ok(())
}

pub async fn complete_agent_run(db: &SqlitePool, id: &str, output: &str) -> AppResult<()> {
    let now = now_rfc3339();
    let result = sqlx::query(
        "UPDATE agent_runs SET status = ?1, output = ?2, error = NULL, completed_at = ?3 WHERE id = ?4",
    )
    .bind("completed")
    .bind(output)
    .bind(&now)
    .bind(id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Agent run not found: {id}")));
    }

    Ok(())
}

pub async fn fail_agent_run(db: &SqlitePool, id: &str, error: &str) -> AppResult<()> {
    let now = now_rfc3339();
    let result = sqlx::query(
        "UPDATE agent_runs SET status = ?1, error = ?2, completed_at = ?3 WHERE id = ?4",
    )
    .bind("failed")
    .bind(error)
    .bind(&now)
    .bind(id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Agent run not found: {id}")));
    }

    Ok(())
}

pub async fn get_agent_run(db: &SqlitePool, id: &str) -> AppResult<Option<AgentRun>> {
    let run = sqlx::query_as::<_, AgentRun>(&format!(
        "SELECT {AGENT_RUN_SELECT} FROM agent_runs WHERE id = ?1"
    ))
    .bind(id)
    .fetch_optional(db)
    .await?;

    Ok(run)
}

pub async fn list_agent_runs(db: &SqlitePool, session_id: &str) -> AppResult<Vec<AgentRun>> {
    let runs = sqlx::query_as::<_, AgentRun>(&format!(
        "SELECT {AGENT_RUN_SELECT} FROM agent_runs WHERE session_id = ?1 ORDER BY created_at DESC"
    ))
    .bind(session_id)
    .fetch_all(db)
    .await?;

    Ok(runs)
}

pub async fn create_tool_call(
    db: &SqlitePool,
    agent_run_id: &str,
    tool_name: &str,
    input: &str,
) -> AppResult<ToolCall> {
    let id = Uuid::new_v4().to_string();
    let now = now_rfc3339();

    sqlx::query(
        "INSERT INTO tool_calls (id, agent_run_id, tool_name, input, output, status, error, started_at, completed_at, created_at) \
         VALUES (?1, ?2, ?3, ?4, NULL, ?5, NULL, ?6, NULL, ?7)",
    )
    .bind(&id)
    .bind(agent_run_id)
    .bind(tool_name)
    .bind(input)
    .bind("pending")
    .bind(&now)
    .bind(&now)
    .execute(db)
    .await?;

    get_tool_call(db, &id).await?.ok_or_else(|| {
        AppError::Internal(format!(
            "Failed to fetch created tool call after insert: {id}"
        ))
    })
}

pub async fn complete_tool_call(db: &SqlitePool, id: &str, output: &str) -> AppResult<()> {
    let now = now_rfc3339();
    let result = sqlx::query(
        "UPDATE tool_calls SET status = ?1, output = ?2, error = NULL, completed_at = ?3 WHERE id = ?4",
    )
    .bind("completed")
    .bind(output)
    .bind(&now)
    .bind(id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Tool call not found: {id}")));
    }

    Ok(())
}

pub async fn fail_tool_call(db: &SqlitePool, id: &str, error: &str) -> AppResult<()> {
    let now = now_rfc3339();
    let result = sqlx::query(
        "UPDATE tool_calls SET status = ?1, error = ?2, completed_at = ?3 WHERE id = ?4",
    )
    .bind("failed")
    .bind(error)
    .bind(&now)
    .bind(id)
    .execute(db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Tool call not found: {id}")));
    }

    Ok(())
}

pub async fn list_tool_calls(db: &SqlitePool, agent_run_id: &str) -> AppResult<Vec<ToolCall>> {
    let calls = sqlx::query_as::<_, ToolCall>(&format!(
        "SELECT {TOOL_CALL_SELECT} FROM tool_calls WHERE agent_run_id = ?1 ORDER BY created_at ASC"
    ))
    .bind(agent_run_id)
    .fetch_all(db)
    .await?;

    Ok(calls)
}

pub async fn get_agent_config(db: &SqlitePool, agent_type: &str) -> AppResult<Option<AgentConfig>> {
    let config = sqlx::query_as::<_, AgentConfig>(&format!(
        "SELECT {AGENT_CONFIG_SELECT} FROM agent_configs WHERE agent_type = ?1"
    ))
    .bind(agent_type)
    .fetch_optional(db)
    .await?;

    Ok(config)
}

pub async fn upsert_agent_config(
    db: &SqlitePool,
    agent_type: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> AppResult<AgentConfig> {
    let existing = sqlx::query_as::<_, (String, String)>(
        "SELECT id, created_at FROM agent_configs WHERE agent_type = ?1",
    )
    .bind(agent_type)
    .fetch_optional(db)
    .await?;

    let now = now_rfc3339();
    let (id, created_at) = if let Some((existing_id, existing_created_at)) = existing {
        (existing_id, existing_created_at)
    } else {
        (Uuid::new_v4().to_string(), now.clone())
    };

    sqlx::query(
        "INSERT OR REPLACE INTO agent_configs (id, agent_type, provider_id, model_id, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    )
    .bind(&id)
    .bind(agent_type)
    .bind(provider_id)
    .bind(model_id)
    .bind(&created_at)
    .bind(&now)
    .execute(db)
    .await?;

    sqlx::query_as::<_, AgentConfig>(&format!(
        "SELECT {AGENT_CONFIG_SELECT} FROM agent_configs WHERE id = ?1"
    ))
    .bind(&id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| {
        AppError::Internal(format!(
            "Failed to fetch upserted agent config after write: {id}"
        ))
    })
}

pub async fn list_agent_configs(db: &SqlitePool) -> AppResult<Vec<AgentConfig>> {
    let configs = sqlx::query_as::<_, AgentConfig>(&format!(
        "SELECT {AGENT_CONFIG_SELECT} FROM agent_configs ORDER BY agent_type ASC"
    ))
    .fetch_all(db)
    .await?;

    Ok(configs)
}

async fn get_tool_call(db: &SqlitePool, id: &str) -> AppResult<Option<ToolCall>> {
    let tool_call = sqlx::query_as::<_, ToolCall>(&format!(
        "SELECT {TOOL_CALL_SELECT} FROM tool_calls WHERE id = ?1"
    ))
    .bind(id)
    .fetch_optional(db)
    .await?;

    Ok(tool_call)
}
