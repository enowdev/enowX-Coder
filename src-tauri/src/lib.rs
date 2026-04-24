pub mod commands;
pub mod agents;
pub mod error;
pub mod models;
pub mod services;
pub mod state;
pub mod tools;

use state::AppState;
use tauri::Manager;

use crate::error::AppError;

#[cfg(all(desktop, not(rust_analyzer)))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() -> Result<(), AppError> {
    let _ = env_logger::try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::create_project,
            commands::project::list_projects,
            commands::project::delete_project,
            commands::session::create_session,
            commands::session::list_sessions,
            commands::session::delete_session,
            commands::session::update_session_title,
            commands::chat::get_messages,
            commands::chat::send_message,
            commands::chat::generate_title,
            commands::chat::generate_excalidraw,
            commands::chat::cancel_chat,
            commands::provider::list_providers,
            commands::provider::create_provider,
            commands::provider::update_provider,
            commands::provider::delete_provider,
            commands::provider::set_default_provider,
            commands::provider::toggle_provider_enabled,
            commands::provider::list_models,
            commands::provider::list_provider_models,
            commands::provider::upsert_provider_model,
            commands::provider::delete_provider_model,
            commands::drawing::get_drawing,
            commands::drawing::save_drawing,
            commands::agent::list_agent_runs,
            commands::agent::list_tool_calls,
            commands::agent::run_agent,
            commands::agent::cancel_agent,
            commands::agent::get_agent_config,
            commands::agent::upsert_agent_config,
            commands::agent::list_agent_configs,
            commands::agent::agent_permission_response
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();

            let data_dir = app_handle
                .path()
                .app_data_dir()
                .map_err(|e| Box::new(AppError::Internal(e.to_string())))?;

            std::fs::create_dir_all(&data_dir)
                .map_err(|e| Box::new(AppError::Io(e.to_string())))?;

            let db_path = data_dir.join("enowx.db");
            let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

            let (tx, rx) = std::sync::mpsc::channel::<Result<AppState, String>>();

            std::thread::spawn(move || {
                let rt = tokio::runtime::Runtime::new().expect("failed to create tokio runtime");
                let result = rt.block_on(async {
                    let app_state = AppState::new(&db_url).await.map_err(|e| e.to_string())?;
                    sqlx::migrate!("./migrations")
                        .run(app_state.pool())
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok(app_state)
                });
                let _ = tx.send(result);
            });

            let app_state = rx
                .recv()
                .map_err(|_| Box::new(AppError::Internal("DB init thread dropped".into())))?
                .map_err(|e| Box::new(AppError::Database(e)))?;

            app_handle.manage(app_state);

            Ok(())
        })
        .run(tauri::generate_context!())?;

    Ok(())
}

#[cfg(any(not(desktop), rust_analyzer))]
pub fn run() -> Result<(), AppError> {
    Ok(())
}
