// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = enowx_coder_lib::run() {
        eprintln!("Failed to run application: {error}");
    }
}
