use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Emitter};
use std::io::{BufRead, BufReader, Write};
use std::thread;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSession {
    pub id: String,
    pub cwd: String,
}

type SessionMap = Arc<Mutex<HashMap<String, Child>>>;

#[command]
pub async fn create_terminal_session(
    app: AppHandle,
    session_id: String,
    cwd: String,
) -> Result<(), String> {
    let sessions: tauri::State<SessionMap> = app.state();
    
    #[cfg(target_os = "windows")]
    let shell = "powershell.exe";
    #[cfg(not(target_os = "windows"))]
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string());
    
    let mut child = Command::new(shell)
        .current_dir(&cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;
    
    let stdout = child.stdout.take().ok_or("Failed to get stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to get stderr")?;
    
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    
    // Stdout reader thread
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit(&format!("terminal-output-{}", session_id_clone), line);
            }
        }
    });
    
    let session_id_clone = session_id.clone();
    let app_clone = app.clone();
    
    // Stderr reader thread
    thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(line) = line {
                let _ = app_clone.emit(&format!("terminal-output-{}", session_id_clone), line);
            }
        }
    });
    
    sessions.lock().unwrap().insert(session_id, child);
    
    Ok(())
}

#[command]
pub async fn write_to_terminal(
    app: AppHandle,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let sessions: tauri::State<SessionMap> = app.state();
    let mut sessions = sessions.lock().unwrap();
    
    if let Some(child) = sessions.get_mut(&session_id) {
        if let Some(stdin) = child.stdin.as_mut() {
            stdin
                .write_all(data.as_bytes())
                .map_err(|e| format!("Failed to write to terminal: {}", e))?;
            stdin
                .flush()
                .map_err(|e| format!("Failed to flush stdin: {}", e))?;
        }
    }
    
    Ok(())
}

#[command]
pub async fn close_terminal_session(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let sessions: tauri::State<SessionMap> = app.state();
    let mut sessions = sessions.lock().unwrap();
    
    if let Some(mut child) = sessions.remove(&session_id) {
        let _ = child.kill();
    }
    
    Ok(())
}

#[command]
pub async fn resize_terminal(
    _session_id: String,
    _cols: u16,
    _rows: u16,
) -> Result<(), String> {
    // PTY resize would require a proper PTY library like portable-pty
    // For now, this is a placeholder
    Ok(())
}
