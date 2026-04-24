use serde::Deserialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::{
    agents::runner::{AgentRunner, AgentRunParams},
    error::AppResult,
    models::{AgentConfig, AgentRun, ToolCall},
    services::agent_service,
    state::AppState,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunAgentRequest {
    pub session_id: String,
    pub agent_type: String,
    pub task: String,
    pub project_path: String,
    pub provider_id: Option<String>,
    pub model_id: Option<String>,
    #[serde(default = "default_true")]
    pub flux_enabled: bool,
}

fn default_true() -> bool { true }

#[tauri::command]
pub async fn list_agent_runs(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<Vec<AgentRun>> {
    agent_service::list_agent_runs(state.pool(), &session_id).await
}

#[tauri::command]
pub async fn list_tool_calls(
    state: State<'_, AppState>,
    agent_run_id: String,
) -> AppResult<Vec<ToolCall>> {
    agent_service::list_tool_calls(state.pool(), &agent_run_id).await
}

#[tauri::command]
pub async fn run_agent(
    state: State<'_, AppState>,
    app_handle: AppHandle,
    request: RunAgentRequest,
    on_token: Channel<String>,
) -> AppResult<()> {
    let cancel_token = state.cancellations.register(format!("agent:{}", request.session_id));

    let runner = AgentRunner::new(
        state.pool().clone(),
        app_handle,
        state.permissions.clone(),
        cancel_token,
    );

    let params = AgentRunParams {
        session_id: &request.session_id,
        agent_type: &request.agent_type,
        task: &request.task,
        project_path: &request.project_path,
        provider_id: request.provider_id.as_deref(),
        model_id: request.model_id.as_deref(),
        flux_enabled: request.flux_enabled,
    };

    let result = runner.run(params, on_token).await;

    // Cleanup
    state.cancellations.remove(&format!("agent:{}", request.session_id));

    // Swallow Cancelled errors — they are expected when user stops generation
    match result {
        Ok(_) => Ok(()),
        Err(crate::error::AppError::Cancelled) => Ok(()),
        Err(e) => Err(e),
    }
}

#[tauri::command]
pub async fn cancel_agent(state: State<'_, AppState>, id: String) -> AppResult<()> {
    // Cancel via the real cancellation token
    state.cancellations.cancel(&format!("agent:{id}"));
    // Also update DB status
    let _ = agent_service::update_agent_run_status(state.pool(), &id, "cancelled").await;
    Ok(())
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

#[tauri::command]
pub async fn agent_permission_response(
    state: State<'_, AppState>,
    agent_run_id: String,
    allowed: bool,
) -> AppResult<()> {
    if !state.permissions.respond(&agent_run_id, allowed) {
        log::warn!("No pending permission request for agent_run_id: {}", agent_run_id);
    }
    Ok(())
}
