use tauri::State;

use crate::{error::AppResult, models::Session, services::session_service, state::AppState};

#[tauri::command]
pub async fn create_session(
    state: State<'_, AppState>,
    project_id: String,
    title: String,
) -> AppResult<Session> {
    session_service::create_session(state.pool(), &project_id, &title).await
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<Vec<Session>> {
    session_service::list_sessions(state.pool(), &project_id).await
}

#[tauri::command]
pub async fn delete_session(state: State<'_, AppState>, id: String) -> AppResult<()> {
    session_service::delete_session(state.pool(), &id).await
}

#[tauri::command]
pub async fn update_session_title(
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> AppResult<()> {
    session_service::update_session_title(state.pool(), &id, &title).await
}
