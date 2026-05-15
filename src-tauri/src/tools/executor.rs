use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::OnceLock;
use std::time::Duration;

use globset::GlobSet;
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::process::Command;
use walkdir::WalkDir;

use crate::error::{AppError, AppResult};

/// Sensitive file patterns — built once, shared across all ToolExecutor instances.
static SENSITIVE_GLOBSET: OnceLock<GlobSet> = OnceLock::new();

fn sensitive_globset() -> &'static GlobSet {
    SENSITIVE_GLOBSET.get_or_init(|| {
        use globset::{GlobBuilder, GlobSetBuilder};
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
            .map_err(|error| format!("sensitive globset build failed: {error}"))
            .unwrap_or_else(|error| panic!("{}", error))
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ToolName {
    ReadFile,
    WriteFile,
    PatchFile,
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

/// Directories to always skip during traversal (common noise).
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    "build",
    ".next",
    "__pycache__",
    ".venv",
    "venv",
    ".turbo",
    ".cache",
];

fn should_skip_dir(name: &str) -> bool {
    SKIP_DIRS.contains(&name)
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
        sensitive_globset().is_match(path)
    }

    pub async fn execute(&self, call: ToolCall) -> ToolResult {
        let tool = call.tool;
        let result = match tool {
            ToolName::ReadFile => self.read_file(&call.input).await,
            ToolName::WriteFile => self.write_file(&call.input).await,
            ToolName::PatchFile => self.patch_file(&call.input).await,
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

    async fn patch_file(&self, input: &serde_json::Value) -> AppResult<String> {
        let path_str = input["path"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'path' field".to_string()))?;
        let old_string = input["old_string"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'old_string' field".to_string()))?;
        let new_string = input["new_string"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'new_string' field".to_string()))?;

        let safe_path = self.validate_path(path_str)?;

        let content = tokio::fs::read_to_string(&safe_path)
            .await
            .map_err(AppError::from)?;

        let occurrences = content.matches(old_string).count();
        if occurrences == 0 {
            return Err(AppError::Validation(format!(
                "old_string not found in {}",
                path_str
            )));
        }
        if occurrences > 1 {
            return Err(AppError::Validation(format!(
                "old_string found {} times in {} — must be unique. Add more context lines to disambiguate.",
                occurrences, path_str
            )));
        }

        let new_content = content.replacen(old_string, new_string, 1);
        tokio::fs::write(&safe_path, &new_content)
            .await
            .map_err(AppError::from)?;

        let old_lines = old_string.lines().count();
        let new_lines = new_string.lines().count();
        Ok(format!(
            "Patched {}: replaced {} lines with {} lines",
            path_str, old_lines, new_lines
        ))
    }

    async fn list_dir(&self, input: &serde_json::Value) -> AppResult<String> {
        let Some(path_str) = input["path"].as_str() else {
            return Err(AppError::Validation("Missing 'path' field".to_string()));
        };
        let safe_path = self.validate_path(path_str)?;
        let sandbox_canonical = self.sandbox.canonicalize().map_err(AppError::from)?;

        let mut entries = Vec::new();
        let walker = WalkDir::new(&safe_path)
            .max_depth(3)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    if let Some(name) = e.file_name().to_str() {
                        return !should_skip_dir(name);
                    }
                }
                true
            });

        for entry_result in walker {
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
                .map_err(|e| AppError::Internal(format!("strip_prefix failed: {e}")))?;
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
        let path_str = input["path"]
            .as_str()
            .ok_or_else(|| AppError::Validation("Missing 'path' field".to_string()))?;
        let safe_path = self.validate_path(path_str)?;
        let sandbox_canonical = self.sandbox.canonicalize().map_err(AppError::from)?;
        let regex = Regex::new(pattern_str)
            .map_err(|error| AppError::Validation(format!("Invalid regex: {error}")))?;

        let mut results = Vec::new();
        let walker = WalkDir::new(&safe_path)
            .into_iter()
            .filter_entry(|e| {
                if e.file_type().is_dir() {
                    if let Some(name) = e.file_name().to_str() {
                        return !should_skip_dir(name);
                    }
                }
                true
            });

        for entry_result in walker {
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
                        .map_err(|e| AppError::Internal(format!("strip_prefix failed: {e}")))?;
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

        const MAX_OUTPUT_BYTES: usize = 256 * 1024; // 256KB limit

        match tokio::time::timeout(self.command_timeout, child.wait_with_output()).await {
            Ok(Ok(output)) => {
                let stdout_raw = &output.stdout;
                let stderr_raw = &output.stderr;
                let exit_code = output.status.code().unwrap_or(-1);

                let stdout = if stdout_raw.len() > MAX_OUTPUT_BYTES {
                    let truncated = String::from_utf8_lossy(&stdout_raw[..MAX_OUTPUT_BYTES]);
                    format!(
                        "{}\n\n... [truncated: {} total bytes, showing first {}]",
                        truncated,
                        stdout_raw.len(),
                        MAX_OUTPUT_BYTES
                    )
                } else {
                    String::from_utf8_lossy(stdout_raw).to_string()
                };

                let stderr = if stderr_raw.len() > MAX_OUTPUT_BYTES {
                    let truncated = String::from_utf8_lossy(&stderr_raw[..MAX_OUTPUT_BYTES]);
                    format!(
                        "{}\n\n... [truncated: {} total bytes, showing first {}]",
                        truncated,
                        stderr_raw.len(),
                        MAX_OUTPUT_BYTES
                    )
                } else {
                    String::from_utf8_lossy(stderr_raw).to_string()
                };

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

        let body = response.text().await.map_err(AppError::from)?;

        // Parse DuckDuckGo response into readable format
        let parsed: Value = serde_json::from_str(&body).unwrap_or_default();
        let mut results = Vec::new();

        // Abstract/instant answer
        if let Some(abstract_text) = parsed["AbstractText"].as_str() {
            if !abstract_text.is_empty() {
                results.push(format!("## Summary\n{}", abstract_text));
                if let Some(url) = parsed["AbstractURL"].as_str() {
                    results.push(format!("Source: {}", url));
                }
            }
        }

        // Answer (direct)
        if let Some(answer) = parsed["Answer"].as_str() {
            if !answer.is_empty() {
                results.push(format!("## Answer\n{}", answer));
            }
        }

        // Related topics
        if let Some(topics) = parsed["RelatedTopics"].as_array() {
            let topic_entries: Vec<String> = topics
                .iter()
                .filter_map(|t| {
                    let text = t["Text"].as_str()?;
                    let url = t["FirstURL"].as_str().unwrap_or("");
                    if text.is_empty() {
                        return None;
                    }
                    Some(format!("- {} ({})", text, url))
                })
                .take(8)
                .collect();
            if !topic_entries.is_empty() {
                results.push(format!("## Related\n{}", topic_entries.join("\n")));
            }
        }

        if results.is_empty() {
            Ok(format!("No results found for: {}", query))
        } else {
            Ok(results.join("\n\n"))
        }
    }

    pub fn requires_permission(&self, path: &str) -> bool {
        self.is_sensitive_file(Path::new(path))
    }

    pub fn is_outside_sandbox(&self, path: &str) -> bool {
        self.validate_path(path).is_err()
    }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── Helpers ────────────────────────────────────────────────────────────────

    fn with_sandbox(test_name: &str) -> PathBuf {
        let base = PathBuf::from("/tmp");
        let path = base.join(format!("enowx-test-{}", test_name));
        if path.exists() {
            std::fs::remove_dir_all(&path).expect("cleanup sandbox");
        }
        std::fs::create_dir_all(&path).expect("create sandbox");
        path
    }

    fn cleanup(test_name: &str) {
        let path = PathBuf::from("/tmp").join(format!("enowx-test-{}", test_name));
        if path.exists() {
            std::fs::remove_dir_all(&path).ok();
        }
    }

    // ── Path Traversal ─────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_path_traversal_dots() {
        let sandbox_path = with_sandbox("path_traversal_dots");

        // Create a real file inside sandbox
        tokio::fs::write(sandbox_path.join("safe.txt"), "hello")
            .await
            .expect("create safe.txt");

        let executor = ToolExecutor::new(sandbox_path.clone());

        // Attempt traversal via relative path — should be rejected
        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "path": "../../../../etc/passwd" }),
        };
        let result = executor.execute(call).await;
        assert!(
            result.is_error,
            "Path traversal with .. should be rejected, got: {}",
            result.output
        );

        cleanup("path_traversal_dots");
    }

    #[tokio::test]
    async fn test_path_traversal_absolute_escape() {
        let sandbox_path = with_sandbox("path_traversal_abs");

        tokio::fs::write(sandbox_path.join("safe.txt"), "hello")
            .await
            .expect("create safe.txt");

        let executor = ToolExecutor::new(sandbox_path);

        // Absolute path pointing outside sandbox
        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "path": "/etc/passwd" }),
        };
        let result = executor.execute(call).await;
        assert!(
            result.is_error,
            "Absolute path outside sandbox should be rejected, got: {}",
            result.output
        );

        cleanup("path_traversal_abs");
    }

    #[tokio::test]
    async fn test_is_outside_sandbox() {
        let sandbox_path = with_sandbox("outside_sandbox");

        tokio::fs::write(sandbox_path.join("file.txt"), "data")
            .await
            .expect("create file");

        let executor = ToolExecutor::new(sandbox_path);

        // Path inside sandbox
        assert!(!executor.is_outside_sandbox("file.txt"));
        assert!(!executor.is_outside_sandbox("subdir/file.txt"));

        // Path attempting escape via ..
        assert!(executor.is_outside_sandbox("../outside.txt"));
        assert!(executor.is_outside_sandbox("../../etc/passwd"));

        // Absolute path outside sandbox
        assert!(executor.is_outside_sandbox("/etc/shadow"));

        cleanup("outside_sandbox");
    }

    // ── Read / Write File ─────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_read_write_file_roundtrip() {
        let sandbox_path = with_sandbox("rw_roundtrip");

        tokio::fs::write(sandbox_path.join("hello.txt"), "initial")
            .await
            .expect("create file");

        let executor = ToolExecutor::new(sandbox_path);

        // Write
        let call = ToolCall {
            tool: ToolName::WriteFile,
            input: serde_json::json!({
                "path": "hello.txt",
                "content": "updated content here"
            }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "write should succeed: {}", result.output);

        // Read back
        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "path": "hello.txt" }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "read should succeed: {}", result.output);
        assert_eq!(result.output, "updated content here");

        cleanup("rw_roundtrip");
    }

    #[tokio::test]
    async fn test_write_file_creates_parent_dirs() {
        let sandbox_path = with_sandbox("rw_mkdirs");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::WriteFile,
            input: serde_json::json!({
                "path": "deeply/nested/dir/file.txt",
                "content": "nested data"
            }),
        };
        let result = executor.execute(call).await;
        assert!(
            !result.is_error,
            "write with nested dirs should succeed: {}",
            result.output
        );

        // Verify file exists by reading it back
        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "path": "deeply/nested/dir/file.txt" }),
        };
        let result = executor.execute(call).await;
        assert_eq!(result.output, "nested data");

        cleanup("rw_mkdirs");
    }

    #[tokio::test]
    async fn test_read_missing_field() {
        let sandbox_path = with_sandbox("read_missing");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "wrong_field": "value" }),
        };
        let result = executor.execute(call).await;
        assert!(result.is_error);
        assert!(result.output.contains("Missing 'path' field"));

        cleanup("read_missing");
    }

    // ── List Directory ────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_list_dir() {
        let sandbox_path = with_sandbox("list_dir");

        tokio::fs::write(sandbox_path.join("file1.txt"), "a").await.unwrap();
        tokio::fs::write(sandbox_path.join("file2.rs"), "b").await.unwrap();
        tokio::fs::create_dir_all(sandbox_path.join("subdir")).await.unwrap();

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::ListDir,
            input: serde_json::json!({ "path": "." }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "list_dir should succeed: {}", result.output);
        assert!(result.output.contains("file1.txt"));
        assert!(result.output.contains("file2.rs"));
        assert!(result.output.contains("subdir"));

        // Each entry should have [dir] or [file] prefix
        for line in result.output.lines() {
            assert!(
                line.starts_with("[dir] ") || line.starts_with("[file] "),
                "Unexpected line format: {line}"
            );
        }

        cleanup("list_dir");
    }

    #[tokio::test]
    async fn test_list_dir_path_traversal_attack() {
        let sandbox_path = with_sandbox("list_dir_traversal");

        let executor = ToolExecutor::new(sandbox_path);

        // Attempt to list outside sandbox
        let call = ToolCall {
            tool: ToolName::ListDir,
            input: serde_json::json!({ "path": "../../.." }),
        };
        let result = executor.execute(call).await;
        assert!(
            result.is_error,
            "list_dir with traversal should be rejected: {}",
            result.output
        );

        cleanup("list_dir_traversal");
    }

    #[tokio::test]
    async fn test_list_dir_missing_path() {
        let sandbox_path = with_sandbox("list_dir_missing");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::ListDir,
            input: serde_json::json!({}),
        };
        let result = executor.execute(call).await;
        assert!(result.is_error);
        assert!(result.output.contains("Missing 'path' field"));

        cleanup("list_dir_missing");
    }

    // ── Search Files ────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_search_files_match() {
        let sandbox_path = with_sandbox("search_files");

        tokio::fs::write(sandbox_path.join("test.rs"), "fn hello() {}")
            .await
            .expect("create test.rs");
        tokio::fs::write(sandbox_path.join("ignore.txt"), "no match here")
            .await
            .expect("create ignore.txt");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::SearchFiles,
            input: serde_json::json!({
                "pattern": "fn hello",
                "path": "."
            }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "search should succeed: {}", result.output);
        assert!(result.output.contains("test.rs"));
        assert!(result.output.contains("fn hello() {}"));
        assert!(!result.output.contains("ignore.txt"));

        cleanup("search_files");
    }

    #[tokio::test]
    async fn test_search_files_invalid_regex() {
        let sandbox_path = with_sandbox("search_invalid_regex");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::SearchFiles,
            input: serde_json::json!({
                "pattern": "[invalid regex",
                "path": "."
            }),
        };
        let result = executor.execute(call).await;
        assert!(result.is_error);
        assert!(result.output.contains("Invalid regex"));

        cleanup("search_invalid_regex");
    }

    #[tokio::test]
    async fn test_search_files_no_matches() {
        let sandbox_path = with_sandbox("search_no_match");

        tokio::fs::write(sandbox_path.join("file.txt"), "nothing to see")
            .await
            .expect("create file");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::SearchFiles,
            input: serde_json::json!({
                "pattern": "NONEXISTENT_PATTERN_XYZ",
                "path": "."
            }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error);
        assert_eq!(result.output, "No matches found");

        cleanup("search_no_match");
    }

    // ── Sensitive File Detection ────────────────────────────────────────────

    #[test]
    fn test_requires_permission_env_files() {
        let executor = ToolExecutor::new(PathBuf::from("/tmp/sandbox"));

        // Should require permission
        assert!(executor.requires_permission(".env"));
        assert!(executor.requires_permission(".env.local"));
        assert!(executor.requires_permission(".env.production"));
        assert!(executor.requires_permission("config/.env"));
        assert!(executor.requires_permission("config/.env.local"));
    }

    #[test]
    fn test_requires_permission_crypto_files() {
        let executor = ToolExecutor::new(PathBuf::from("/tmp/sandbox"));

        assert!(executor.requires_permission("server.key"));
        assert!(executor.requires_permission("certs/server.key"));
        assert!(executor.requires_permission("server.pem"));
        assert!(executor.requires_permission("certs/server.pem"));
    }

    #[test]
    fn test_requires_permission_ssh_files() {
        let executor = ToolExecutor::new(PathBuf::from("/tmp/sandbox"));

        assert!(executor.requires_permission(".ssh/id_rsa"));
        assert!(executor.requires_permission(".ssh/config"));
        assert!(executor.requires_permission("home/user/.ssh/authorized_keys"));
    }

    #[test]
    fn test_does_not_require_permission_for_normal_files() {
        let executor = ToolExecutor::new(PathBuf::from("/tmp/sandbox"));

        assert!(!executor.requires_permission("src/main.rs"));
        assert!(!executor.requires_permission("package.json"));
        assert!(!executor.requires_permission("README.md"));
        assert!(!executor.requires_permission("Cargo.toml"));
        assert!(!executor.requires_permission("index.html"));
        assert!(!executor.requires_permission("data.txt"));
        assert!(!executor.requires_permission("config.yaml"));
    }

    // ── Run Command ──────────────────────────────────────────────────────────

    #[tokio::test]
    async fn test_run_command_success() {
        let sandbox_path = with_sandbox("run_cmd_success");

        tokio::fs::write(sandbox_path.join("hello.txt"), "world")
            .await
            .expect("create file");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::RunCommand,
            input: serde_json::json!({ "command": "cat hello.txt" }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "command should succeed: {}", result.output);
        assert!(result.output.contains("stdout:"));
        assert!(result.output.contains("world"));

        cleanup("run_cmd_success");
    }

    #[tokio::test]
    async fn test_run_command_missing_field() {
        let sandbox_path = with_sandbox("run_cmd_missing");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::RunCommand,
            input: serde_json::json!({}),
        };
        let result = executor.execute(call).await;
        assert!(result.is_error);
        assert!(result.output.contains("Missing 'command' field"));

        cleanup("run_cmd_missing");
    }

    #[tokio::test]
    async fn test_run_command_invalid_command() {
        let sandbox_path = with_sandbox("run_cmd_invalid");

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::RunCommand,
            input: serde_json::json!({ "command": "nonexistent_command_xyz_12345" }),
        };
        let result = executor.execute(call).await;
        assert!(
            result.is_error,
            "invalid command should fail: {}",
            result.output
        );

        cleanup("run_cmd_invalid");
    }

    #[tokio::test]
    async fn test_run_command_timeout() {
        let sandbox_path = with_sandbox("run_cmd_timeout");

        let mut executor = ToolExecutor::new(sandbox_path);
        executor.command_timeout = Duration::from_millis(200);

        let call = ToolCall {
            tool: ToolName::RunCommand,
            input: serde_json::json!({ "command": "sleep 60" }),
        };
        let result = executor.execute(call).await;
        assert!(
            result.is_error,
            "timeout should trigger error: {}",
            result.output
        );
        assert!(result.output.contains("Command timed out"));
        assert!(result.output.contains("60s"));

        cleanup("run_cmd_timeout");
    }

    // ── validate_path edge cases ─────────────────────────────────────────────

    #[tokio::test]
    async fn test_validate_path_valid_nested() {
        let sandbox_path = with_sandbox("validate_nested");

        tokio::fs::create_dir_all(sandbox_path.join("a/b/c"))
            .await
            .unwrap();
        tokio::fs::write(sandbox_path.join("a/b/c/file.txt"), "data")
            .await
            .unwrap();

        let executor = ToolExecutor::new(sandbox_path);

        let call = ToolCall {
            tool: ToolName::ReadFile,
            input: serde_json::json!({ "path": "a/b/c/file.txt" }),
        };
        let result = executor.execute(call).await;
        assert!(!result.is_error, "should read nested file: {}", result.output);
        assert_eq!(result.output, "data");

        cleanup("validate_nested");
    }

    // ── normalize_relative edge cases ────────────────────────────────────────

    #[test]
    fn test_normalize_relative_curdir() {
        let result = ToolExecutor::normalize_relative(Path::new("./src/main.rs"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Path::new("src/main.rs"));
    }

    #[test]
    fn test_normalize_relative_leading_dotdot() {
        let result = ToolExecutor::normalize_relative(Path::new("../outside"));
        assert!(result.is_err());
    }

    #[test]
    fn test_normalize_relative_deep_dotdot() {
        let result = ToolExecutor::normalize_relative(Path::new("a/b/../../c"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Path::new("c"));
    }

    #[test]
    fn test_normalize_relative_normal_only() {
        let result = ToolExecutor::normalize_relative(Path::new("src/components/App.tsx"));
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), Path::new("src/components/App.tsx"));
    }
}
