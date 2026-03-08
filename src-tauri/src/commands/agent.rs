use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::{
    agents::runner::AgentRunner,
    error::AppResult,
    models::{AgentConfig, AgentRun},
    services::agent_service,
    state::AppState,
};

#[tauri::command]
pub async fn list_agent_runs(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<Vec<AgentRun>> {
    agent_service::list_agent_runs(state.pool(), &session_id).await
}

#[tauri::command]
pub async fn run_agent(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    session_id: String,
    agent_type: String,
    task: String,
    project_path: String,
    provider_id: Option<String>,
    model_id: Option<String>,
    on_token: Channel<String>,
) -> AppResult<()> {
    let runner = AgentRunner::new(state.pool().clone(), app_handle);

    runner
        .run(
            &session_id,
            &agent_type,
            &task,
            &project_path,
            provider_id.as_deref(),
            model_id.as_deref(),
            on_token,
        )
        .await?;

    Ok(())
}

#[tauri::command]
pub async fn cancel_agent(state: State<'_, AppState>, id: String) -> AppResult<()> {
    agent_service::update_agent_run_status(state.pool(), &id, "cancelled").await
}

#[tauri::command]
pub async fn get_agent_config(
    state: State<'_, AppState>,
    agent_type: String,
) -> AppResult<Option<AgentConfig>> {
    agent_service::get_agent_config(state.pool(), &agent_type).await
}

#[tauri::command]
pub async fn upsert_agent_config(
    state: State<'_, AppState>,
    agent_type: String,
    provider_id: Option<String>,
    model_id: Option<String>,
) -> AppResult<AgentConfig> {
    agent_service::upsert_agent_config(
        state.pool(),
        &agent_type,
        provider_id.as_deref(),
        model_id.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn list_agent_configs(state: State<'_, AppState>) -> AppResult<Vec<AgentConfig>> {
    agent_service::list_agent_configs(state.pool()).await
}
