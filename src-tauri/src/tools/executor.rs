use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::time::Duration;

use globset::{GlobBuilder, GlobSetBuilder};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use walkdir::WalkDir;

use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolName {
    ReadFile,
    WriteFile,
    ListDir,
    SearchFiles,
    RunCommand,
    WebSearch,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub tool: ToolName,
    pub input: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResult {
    pub tool: ToolName,
    pub output: String,
    pub is_error: bool,
}

#[derive(Debug, Clone)]
pub struct ToolExecutor {
    pub sandbox: PathBuf,
    pub command_timeout: Duration,
}

impl ToolExecutor {
    pub fn new(sandbox: PathBuf) -> Self {
        Self {
            sandbox,
            command_timeout: Duration::from_secs(60),
        }
    }

    fn normalize_relative(path: &Path) -> AppResult<PathBuf> {
        let mut normalized = PathBuf::new();
        for component in path.components() {
            match component {
                Component::CurDir => {}
                Component::ParentDir => {
                    if !normalized.pop() {
                        return Err(AppError::Validation(
                            "Path traversal is not allowed".to_string(),
                        ));
                    }
                }
                Component::Normal(seg) => normalized.push(seg),
                Component::Prefix(_) | Component::RootDir => {
                    return Err(AppError::Validation("Invalid relative path".to_string()));
                }
            }
        }
        Ok(normalized)
    }

    fn validate_path(&self, requested: &str) -> AppResult<PathBuf> {
        let sandbox_canonical = self.sandbox.canonicalize().map_err(AppError::from)?;

        let requested_path = if Path::new(requested).is_absolute() {
            PathBuf::from(requested)
        } else {
            self.sandbox.join(requested)
        };

        if requested_path.exists() {
            let canonical = requested_path.canonicalize().map_err(AppError::from)?;
            if !canonical.starts_with(&sandbox_canonical) {
                return Err(AppError::Validation(format!(
                    "Path '{}' is outside project sandbox",
                    requested
                )));
            }
            return Ok(canonical);
        }

        let rel_from_sandbox = requested_path
            .strip_prefix(&self.sandbox)
            .map_err(|_| {
                AppError::Validation(format!("Path '{}' is outside project sandbox", requested))
            })?
            .to_path_buf();
        let normalized_rel = Self::normalize_relative(&rel_from_sandbox)?;
        Ok(sandbox_canonical.join(normalized_rel))
    }

    fn is_sensitive_file(&self, path: &Path) -> bool {
        let mut builder = GlobSetBuilder::new();
        let patterns = [
            ".env",
            ".env.*",
            "**/.env",
            "**/.env.*",
            "**/*.pem",
            "**/*.key",
            "**/.ssh/**",
        ];
        for pattern in patterns {
            if let Ok(glob) = GlobBuilder::new(pattern).build() {
                builder.add(glob);
            }
        }

        builder
            .build()
            .map(|globset| globset.is_match(path))
            .unwrap_or(false)
    }

    pub async fn execute(&self, call: ToolCall) -> ToolResult {
        let tool = call.tool;
        let result = match tool {
            ToolName::ReadFile => self.read_file(&call.input).await,
            ToolName::WriteFile => self.write_file(&call.input).await,
            ToolName::ListDir => self.list_dir(&call.input).await,
            ToolName::SearchFiles => self.search_files(&call.input).await,
            ToolName::RunCommand => self.run_command(&call.input).await,
            ToolName::WebSearch => self.web_search(&call.input).await,
        };

        match result {
            Ok(output) => ToolResult {
                tool,
                output,
                is_error: false,
            },
            Err(error) => ToolResult {
                tool,
                output: error.to_string(),
                is_error: true,
            },
        }
    }

    async fn read_file(&self, input: &serde_json::Value) -> AppResult<String> {
        let path_str = input["path"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'path' field".to_string()))?;
        let safe_path = self.validate_path(path_str)?;
        tokio::fs::read_to_string(safe_path)
            .await
            .map_err(AppError::from)
    }

    async fn write_file(&self, input: &serde_json::Value) -> AppResult<String> {
        let path_str = input["path"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'path' field".to_string()))?;
        let content = input["content"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'content' field".to_string()))?;
        let safe_path = self.validate_path(path_str)?;

        if let Some(parent) = safe_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(AppError::from)?;
        }
        tokio::fs::write(safe_path, content)
            .await
            .map_err(AppError::from)?;

        Ok(format!("Written {} bytes to {}", content.len(), path_str))
    }

    async fn list_dir(&self, input: &serde_json::Value) -> AppResult<String> {
        let path_str = input["path"].as_str().unwrap_or(".");
        let safe_path = self.validate_path(path_str)?;
        let sandbox_canonical = self.sandbox.canonicalize().map_err(AppError::from)?;

        let mut entries = Vec::new();
        for entry_result in WalkDir::new(&safe_path).max_depth(3) {
            let entry = match entry_result {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            let canonical = match entry.path().canonicalize() {
                Ok(canonical) => canonical,
                Err(_) => continue,
            };
            if !canonical.starts_with(&sandbox_canonical) {
                continue;
            }

            let rel = canonical
                .strip_prefix(&sandbox_canonical)
                .unwrap_or(&canonical);
            let kind = if entry.file_type().is_dir() {
                "dir"
            } else {
                "file"
            };
            entries.push(format!("[{}] {}", kind, rel.display()));
        }

        Ok(entries.join("\n"))
    }

    async fn search_files(&self, input: &serde_json::Value) -> AppResult<String> {
        let pattern_str = input["pattern"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'pattern' field".to_string()))?;
        let path_str = input["path"].as_str().unwrap_or(".");
        let safe_path = self.validate_path(path_str)?;
        let sandbox_canonical = self.sandbox.canonicalize().map_err(AppError::from)?;
        let regex = Regex::new(pattern_str)
            .map_err(|error| AppError::Validation(format!("Invalid regex: {error}")))?;

        let mut results = Vec::new();
        for entry_result in WalkDir::new(&safe_path) {
            let entry = match entry_result {
                Ok(entry) => entry,
                Err(_) => continue,
            };
            if !entry.file_type().is_file() {
                continue;
            }

            let canonical = match entry.path().canonicalize() {
                Ok(canonical) => canonical,
                Err(_) => continue,
            };
            if !canonical.starts_with(&sandbox_canonical) {
                continue;
            }

            let content = match tokio::fs::read_to_string(&canonical).await {
                Ok(content) => content,
                Err(_) => continue,
            };

            for (line_index, line) in content.lines().enumerate() {
                if regex.is_match(line) {
                    let rel = canonical
                        .strip_prefix(&sandbox_canonical)
                        .unwrap_or(&canonical);
                    results.push(format!("{}:{}: {}", rel.display(), line_index + 1, line));
                    if results.len() >= 100 {
                        break;
                    }
                }
            }

            if results.len() >= 100 {
                break;
            }
        }

        if results.is_empty() {
            Ok("No matches found".to_string())
        } else {
            Ok(results.join("\n"))
        }
    }

    async fn run_command(&self, input: &serde_json::Value) -> AppResult<String> {
        let cmd = input["command"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'command' field".to_string()))?;

        // Platform-specific shell selection
        let mut command = if cfg!(target_os = "windows") {
            let mut cmd_process = Command::new("cmd");
            cmd_process.arg("/C").arg(cmd);
            cmd_process
        } else {
            let mut sh_process = Command::new("sh");
            sh_process.arg("-c").arg(cmd);
            sh_process
        };

        command
            .current_dir(&self.sandbox)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);

        let child = command.spawn().map_err(AppError::from)?;

        match tokio::time::timeout(self.command_timeout, child.wait_with_output()).await {
            Ok(Ok(output)) => {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let stderr = String::from_utf8_lossy(&output.stderr);
                let exit_code = output.status.code().unwrap_or(-1);
                Ok(format!(
                    "exit_code: {}\nstdout:\n{}\nstderr:\n{}",
                    exit_code, stdout, stderr
                ))
            }
            Ok(Err(error)) => Err(AppError::from(error)),
            Err(_) => Err(AppError::Internal(format!(
                "Command timed out after {}s",
                self.command_timeout.as_secs()
            ))),
        }
    }

    async fn web_search(&self, input: &serde_json::Value) -> AppResult<String> {
        let query = input["query"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'query' field".to_string()))?;
        let client = reqwest::Client::new();
        let url = format!(
            "https://api.duckduckgo.com/?q={}&format=json&no_html=1&skip_disambig=1",
            urlencoding::encode(query)
        );

        let response = client
            .get(&url)
            .header("User-Agent", "enowX-Coder/1.0")
            .send()
            .await
            .map_err(AppError::from)?;

        response.text().await.map_err(AppError::from)
    }

    pub fn requires_permission(&self, path: &str) -> bool {
        self.is_sensitive_file(Path::new(path))
    }

    pub fn is_outside_sandbox(&self, path: &str) -> bool {
        self.validate_path(path).is_err()
    }
}
