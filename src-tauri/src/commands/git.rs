use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub path: String,
    pub status: String,
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranch {
    pub name: String,
    pub current: bool,
    pub remote: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitCommit {
    pub hash: String,
    pub author: String,
    pub date: String,
    pub message: String,
}

#[command]
pub async fn git_status(repo_path: String) -> Result<Vec<GitStatus>, String> {
    let output = Command::new("git")
        .args(&["status", "--porcelain"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run git status: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut statuses = Vec::new();

    for line in stdout.lines() {
        if line.len() < 3 {
            continue;
        }

        let status_code = &line[0..2];
        let path = line[3..].to_string();

        let (status, staged) = match status_code {
            "M " => ("modified", true),
            " M" => ("modified", false),
            "MM" => ("modified", true),
            "A " => ("added", true),
            " A" => ("added", false),
            "D " => ("deleted", true),
            " D" => ("deleted", false),
            "R " => ("renamed", true),
            " R" => ("renamed", false),
            "??" => ("untracked", false),
            _ => ("unknown", false),
        };

        statuses.push(GitStatus {
            path,
            status: status.to_string(),
            staged,
        });
    }

    Ok(statuses)
}

#[command]
pub async fn git_branches(repo_path: String) -> Result<Vec<GitBranch>, String> {
    let output = Command::new("git")
        .args(&["branch", "-a"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run git branch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut branches = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }

        let current = line.starts_with('*');
        let name = if current {
            line[2..].trim().to_string()
        } else {
            line.to_string()
        };

        let remote = if name.starts_with("remotes/") {
            Some(name.clone())
        } else {
            None
        };

        branches.push(GitBranch {
            name,
            current,
            remote,
        });
    }

    Ok(branches)
}

#[command]
pub async fn git_current_branch(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["branch", "--show-current"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to get current branch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[command]
pub async fn git_log(repo_path: String, limit: usize) -> Result<Vec<GitCommit>, String> {
    let output = Command::new("git")
        .args(&[
            "log",
            &format!("-{}", limit),
            "--pretty=format:%H|%an|%ad|%s",
            "--date=short",
        ])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to run git log: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut commits = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            commits.push(GitCommit {
                hash: parts[0].to_string(),
                author: parts[1].to_string(),
                date: parts[2].to_string(),
                message: parts[3..].join("|"),
            });
        }
    }

    Ok(commits)
}

#[command]
pub async fn git_stage(repo_path: String, path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["add", &path])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to stage file: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[command]
pub async fn git_unstage(repo_path: String, path: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["reset", "HEAD", &path])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to unstage file: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[command]
pub async fn git_commit(repo_path: String, message: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["commit", "-m", &message])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to commit: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[command]
pub async fn git_push(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["push"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to push: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
pub async fn git_pull(repo_path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["pull"])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to pull: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[command]
pub async fn git_checkout(repo_path: String, branch: String) -> Result<(), String> {
    let output = Command::new("git")
        .args(&["checkout", &branch])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to checkout branch: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(())
}

#[command]
pub async fn git_diff(repo_path: String, path: String) -> Result<String, String> {
    let output = Command::new("git")
        .args(&["diff", &path])
        .current_dir(&repo_path)
        .output()
        .map_err(|e| format!("Failed to get diff: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
