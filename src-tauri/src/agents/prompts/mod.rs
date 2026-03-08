pub mod orchestrator;
pub mod planner;
pub mod coder_fe;
pub mod coder_be;
pub mod security;
pub mod ux_researcher;
pub mod ui_designer;
pub mod tester;
pub mod reviewer;
pub mod researcher;
pub mod librarian;

pub fn get_prompt(agent_type: &str) -> Option<&'static str> {
    match agent_type {
        "orchestrator" => Some(orchestrator::SYSTEM_PROMPT),
        "planner" => Some(planner::SYSTEM_PROMPT),
        "coder_fe" => Some(coder_fe::SYSTEM_PROMPT),
        "coder_be" => Some(coder_be::SYSTEM_PROMPT),
        "security" => Some(security::SYSTEM_PROMPT),
        "ux_researcher" => Some(ux_researcher::SYSTEM_PROMPT),
        "ui_designer" => Some(ui_designer::SYSTEM_PROMPT),
        "tester" => Some(tester::SYSTEM_PROMPT),
        "reviewer" => Some(reviewer::SYSTEM_PROMPT),
        "researcher" => Some(researcher::SYSTEM_PROMPT),
        "librarian" => Some(librarian::SYSTEM_PROMPT),
        _ => None,
    }
}
