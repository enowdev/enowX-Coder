pub mod commands;
pub mod error;
pub mod models;
pub mod services;
pub mod state;

use state::AppState;
use tauri::Manager;

use crate::error::AppResult;

#[cfg(all(desktop, not(rust_analyzer)))]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() -> AppResult<()> {
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
            commands::provider::list_providers,
            commands::provider::create_provider,
            commands::provider::update_provider,
            commands::provider::delete_provider,
            commands::provider::set_default_provider,
            commands::agent::list_agent_runs
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                let data_dir = app_handle
                    .path()
                    .app_data_dir()
                    .expect("failed to resolve app data dir");

                std::fs::create_dir_all(&data_dir)
                    .expect("failed to create app data dir");

                let db_path = data_dir.join("enowx.db");
                let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

                let app_state = AppState::new(&db_url)
                    .await
                    .expect("failed to initialize database");

                sqlx::migrate!("./migrations")
                    .run(app_state.pool())
                    .await
                    .expect("failed to run migrations");

                app_handle.manage(app_state);
            });
            Ok(())
        })
        .run(tauri::generate_context!(
            "/run/media/enow/SSD2/enowX-Coder/src-tauri/tauri.conf.json"
        ))?;

    Ok(())
}

#[cfg(any(not(desktop), rust_analyzer))]
pub async fn run() -> AppResult<()> {
    Ok(())
}
