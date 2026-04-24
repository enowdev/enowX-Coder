use tauri::State;

use crate::{error::AppResult, models::Provider, services::provider_service, state::AppState};

#[tauri::command]
pub async fn list_providers(state: State<'_, AppState>) -> AppResult<Vec<Provider>> {
    provider_service::list_providers(state.pool()).await
}

#[tauri::command]
pub async fn create_provider(
    state: State<'_, AppState>,
    name: String,
    provider_type: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
) -> AppResult<Provider> {
    provider_service::create_provider(
        state.pool(),
        &name,
        &provider_type,
        &base_url,
        api_key.as_deref(),
        &model,
    )
    .await
}

#[tauri::command]
pub async fn update_provider(
    state: State<'_, AppState>,
    id: String,
    name: String,
    base_url: String,
    api_key: Option<String>,
    model: String,
) -> AppResult<()> {
    provider_service::update_provider(
        state.pool(),
        &id,
        &name,
        &base_url,
        api_key.as_deref(),
        &model,
    )
    .await
}

#[tauri::command]
pub async fn delete_provider(state: State<'_, AppState>, id: String) -> AppResult<()> {
    provider_service::delete_provider(state.pool(), &id).await
}

#[tauri::command]
pub async fn set_default_provider(state: State<'_, AppState>, id: String) -> AppResult<()> {
    provider_service::set_default_provider(state.pool(), &id).await
}

#[tauri::command]
pub async fn toggle_provider_enabled(
    state: State<'_, AppState>,
    id: String,
    enabled: bool,
) -> AppResult<()> {
    provider_service::toggle_provider_enabled(state.pool(), &id, enabled).await
}

#[tauri::command]
pub async fn list_models(
    state: State<'_, AppState>,
    provider_id: String,
) -> AppResult<Vec<String>> {
    let provider =
        crate::services::provider_service::get_provider_for_chat(state.pool(), Some(&provider_id))
            .await?;

    crate::services::model_service::list_models(
        &provider.provider_type,
        &provider.base_url,
        provider.api_key.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn list_provider_models(
    state: State<'_, AppState>,
    provider_id: String,
) -> AppResult<Vec<crate::models::ProviderModelConfig>> {
    crate::services::provider_model_service::list_provider_models(state.pool(), &provider_id).await
}

#[tauri::command]
pub async fn upsert_provider_model(
    state: State<'_, AppState>,
    provider_id: String,
    model_id: String,
    enabled: bool,
    max_tokens: i64,
    temperature: f64,
) -> AppResult<crate::models::ProviderModelConfig> {
    crate::services::provider_model_service::upsert_provider_model(
        state.pool(),
        &provider_id,
        &model_id,
        enabled,
        max_tokens,
        temperature,
    )
    .await
}

#[tauri::command]
pub async fn delete_provider_model(
    state: State<'_, AppState>,
    provider_id: String,
    model_id: String,
) -> AppResult<()> {
    crate::services::provider_model_service::delete_provider_model(
        state.pool(),
        &provider_id,
        &model_id,
    )
    .await
}
