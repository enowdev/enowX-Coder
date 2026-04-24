pub mod agent_service;
pub mod chat_service;
pub mod drawing_service;
pub mod model_service;
pub mod project_service;
pub mod provider_model_service;
pub mod provider_service;
pub mod session_service;

pub(crate) fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}
