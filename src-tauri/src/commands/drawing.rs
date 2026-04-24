use tauri::State;

use crate::{error::AppResult, models::Drawing, services::drawing_service, state::AppState};

#[tauri::command]
pub async fn get_drawing(
    state: State<'_, AppState>,
    project_id: String,
) -> AppResult<Option<Drawing>> {
    drawing_service::get_drawing(state.pool(), &project_id).await
}

#[tauri::command]
pub async fn save_drawing(
    state: State<'_, AppState>,
    project_id: String,
    data: String,
) -> AppResult<Drawing> {
    drawing_service::save_drawing(state.pool(), &project_id, &data).await
}
