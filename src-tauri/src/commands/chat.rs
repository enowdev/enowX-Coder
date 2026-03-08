use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use crate::{error::AppResult, models::Message, services::chat_service, state::AppState};

#[tauri::command]
pub async fn get_messages(
    state: State<'_, AppState>,
    session_id: String,
) -> AppResult<Vec<Message>> {
    chat_service::get_messages(state.pool(), &session_id).await
}

#[tauri::command]
pub async fn send_message(
    state: State<'_, AppState>,
    session_id: String,
    content: String,
    provider_id: Option<String>,
    model_id: Option<String>,
    on_token: Channel<String>,
    app_handle: AppHandle,
) -> AppResult<()> {
    chat_service::send_message(
        state.pool(),
        &session_id,
        &content,
        provider_id.as_deref(),
        model_id.as_deref(),
        on_token,
        &app_handle,
    )
    .await
}
