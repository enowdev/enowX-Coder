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
    let cancel_token = state.cancellations.register(format!("chat:{session_id}"));

    let result = chat_service::send_message(
        state.pool(),
        &session_id,
        &content,
        provider_id.as_deref(),
        model_id.as_deref(),
        on_token,
        &app_handle,
        cancel_token,
    )
    .await;

    // Cleanup the token regardless of outcome
    state.cancellations.remove(&format!("chat:{session_id}"));

    result
}

#[tauri::command]
pub async fn cancel_chat(state: State<'_, AppState>, session_id: String) -> AppResult<()> {
    state.cancellations.cancel(&format!("chat:{session_id}"));
    Ok(())
}

#[tauri::command]
pub async fn generate_excalidraw(
    state: State<'_, AppState>,
    prompt: String,
    existing_elements: Option<String>,
    provider_id: Option<String>,
    model_id: Option<String>,
) -> AppResult<String> {
    chat_service::generate_excalidraw(
        state.pool(),
        &prompt,
        existing_elements.as_deref(),
        provider_id.as_deref(),
        model_id.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn generate_title(
    state: State<'_, AppState>,
    session_id: String,
    provider_id: Option<String>,
    model_id: Option<String>,
) -> AppResult<String> {
    chat_service::generate_title(
        state.pool(),
        &session_id,
        provider_id.as_deref(),
        model_id.as_deref(),
    )
    .await
}
