use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinSet;
use uuid::Uuid;

use crate::agents::prompts::get_prompt;
use crate::error::{AppError, AppResult};
use crate::services::{now_rfc3339, provider_service};
use crate::tools::{ToolCall, ToolExecutor, ToolName};

const MAX_REACT_ITERATIONS: usize = 20;
const SYNTHESIS_REACT_ITERATIONS: usize = 8;

#[derive(Clone)]
pub struct AgentRunner {
    pub db: SqlitePool,
    pub app_handle: AppHandle,
}

pub trait TokenSink: Send + Sync {
    fn send(&self, token: &str);
}

#[derive(Clone)]
struct ChannelTokenSink {
    channel: Channel<String>,
}

impl TokenSink for ChannelTokenSink {
    fn send(&self, token: &str) {
        let _ = self.channel.send(token.to_string());
    }
}

#[derive(Clone, Copy)]
struct NoopTokenSink;

impl TokenSink for NoopTokenSink {
    fn send(&self, _token: &str) {}
}

impl AgentRunner {
    pub fn new(db: SqlitePool, app_handle: AppHandle) -> Self {
        Self { db, app_handle }
    }

    pub async fn run(
        &self,
        session_id: &str,
        agent_type: &str,
        task: &str,
        project_path: &str,
        provider_id: Option<&str>,
        model_id: Option<&str>,
        on_token: Channel<String>,
    ) -> AppResult<String> {
        let token_sink = ChannelTokenSink { channel: on_token };

        self.run_internal(
            session_id,
            agent_type,
            task,
            project_path,
            provider_id,
            model_id,
            None,
            &token_sink,
        )
        .await
    }

    async fn run_subagent(
        &self,
        session_id: &str,
        agent_type: &str,
        task: &str,
        project_path: &str,
        provider_id: Option<&str>,
        model_id: Option<&str>,
        parent_agent_run_id: &str,
    ) -> AppResult<String> {
        let token_sink = NoopTokenSink;
        let agent_run_id = Uuid::new_v4().to_string();
        let started_at = now_rfc3339();

        sqlx::query(
            "INSERT INTO agent_runs (id, session_id, agent_type, status, input, started_at, created_at, parent_agent_run_id, project_path) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .bind(&agent_run_id)
        .bind(session_id)
        .bind(agent_type)
        .bind("running")
        .bind(task)
        .bind(&started_at)
        .bind(&started_at)
        .bind(Some(parent_agent_run_id))
        .bind(project_path)
        .execute(&self.db)
        .await?;

        let _ = self.app_handle.emit(
            "agent-started",
            AgentStartedEvent {
                agent_run_id: agent_run_id.clone(),
                agent_type: agent_type.to_string(),
                parent_agent_run_id: Some(parent_agent_run_id.to_string()),
            },
        );

        let result = self
            .execute_agent_leaf(
                &agent_run_id,
                agent_type,
                task,
                project_path,
                provider_id,
                model_id,
                &token_sink,
            )
            .await;

        match result {
            Ok(output) => {
                let completed_at = now_rfc3339();
                sqlx::query(
                    "UPDATE agent_runs SET status = ?1, output = ?2, completed_at = ?3 WHERE id = ?4",
                )
                .bind("completed")
                .bind(&output)
                .bind(&completed_at)
                .bind(&agent_run_id)
                .execute(&self.db)
                .await?;

                let _ = self.app_handle.emit(
                    "agent-done",
                    AgentDoneEvent {
                        agent_run_id,
                        output: output.clone(),
                    },
                );

                Ok(output)
            }
            Err(error) => {
                let completed_at = now_rfc3339();
                let error_message = error.to_string();

                sqlx::query(
                    "UPDATE agent_runs SET status = ?1, error = ?2, completed_at = ?3 WHERE id = ?4",
                )
                .bind("failed")
                .bind(&error_message)
                .bind(&completed_at)
                .bind(&agent_run_id)
                .execute(&self.db)
                .await?;

                let _ = self.app_handle.emit(
                    "agent-error",
                    AgentErrorEvent {
                        agent_run_id,
                        error: error_message,
                    },
                );

                Err(error)
            }
        }
    }

    async fn run_internal<S: TokenSink + Sync>(
        &self,
        session_id: &str,
        agent_type: &str,
        task: &str,
        project_path: &str,
        provider_id: Option<&str>,
        model_id: Option<&str>,
        parent_agent_run_id: Option<&str>,
        token_sink: &S,
    ) -> AppResult<String> {
        if parent_agent_run_id.is_none() {
            let message_id = Uuid::new_v4().to_string();
            let created_at = now_rfc3339();
            sqlx::query(
                "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(&message_id)
            .bind(session_id)
            .bind("user")
            .bind(task)
            .bind(&created_at)
            .execute(&self.db)
            .await?;
        }

        let agent_run_id = Uuid::new_v4().to_string();
        let started_at = now_rfc3339();

        sqlx::query(
            "INSERT INTO agent_runs (id, session_id, agent_type, status, input, started_at, created_at, parent_agent_run_id, project_path) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )
        .bind(&agent_run_id)
        .bind(session_id)
        .bind(agent_type)
        .bind("running")
        .bind(task)
        .bind(&started_at)
        .bind(&started_at)
        .bind(parent_agent_run_id)
        .bind(project_path)
        .execute(&self.db)
        .await?;

        let _ = self.app_handle.emit(
            "agent-started",
            AgentStartedEvent {
                agent_run_id: agent_run_id.clone(),
                agent_type: agent_type.to_string(),
                parent_agent_run_id: parent_agent_run_id.map(std::string::ToString::to_string),
            },
        );

        let result = self
            .execute_agent(
                &agent_run_id,
                session_id,
                agent_type,
                task,
                project_path,
                provider_id,
                model_id,
                token_sink,
            )
            .await;

        match result {
            Ok(output) => {
                let completed_at = now_rfc3339();
                sqlx::query(
                    "UPDATE agent_runs SET status = ?1, output = ?2, completed_at = ?3 WHERE id = ?4",
                )
                .bind("completed")
                .bind(&output)
                .bind(&completed_at)
                .bind(&agent_run_id)
                .execute(&self.db)
                .await?;

                let _ = self.app_handle.emit(
                    "agent-done",
                    AgentDoneEvent {
                        agent_run_id,
                        output: output.clone(),
                    },
                );

                Ok(output)
            }
            Err(error) => {
                let completed_at = now_rfc3339();
                let error_message = error.to_string();

                sqlx::query(
                    "UPDATE agent_runs SET status = ?1, error = ?2, completed_at = ?3 WHERE id = ?4",
                )
                .bind("failed")
                .bind(&error_message)
                .bind(&completed_at)
                .bind(&agent_run_id)
                .execute(&self.db)
                .await?;

                let _ = self.app_handle.emit(
                    "agent-error",
                    AgentErrorEvent {
                        agent_run_id,
                        error: error_message,
                    },
                );

                Err(error)
            }
        }
    }

    async fn execute_agent<S: TokenSink + Sync>(
        &self,
        agent_run_id: &str,
        session_id: &str,
        agent_type: &str,
        task: &str,
        project_path: &str,
        provider_id: Option<&str>,
        model_id: Option<&str>,
        token_sink: &S,
    ) -> AppResult<String> {
        let system_prompt = get_prompt(agent_type).ok_or_else(|| {
            AppError::Validation(format!("Unknown agent type for prompt lookup: {agent_type}"))
        })?;

        let provider = provider_service::get_provider_for_chat(&self.db, provider_id).await?;
        let model = model_id.unwrap_or(&provider.model);
        let tool_executor = ToolExecutor::new(PathBuf::from(project_path));

        let mut messages = vec![
            ConversationMessage::system(system_prompt),
            ConversationMessage::user(task),
        ];

        let mut output = self
            .run_react_loop(
                &provider,
                model,
                agent_run_id,
                agent_type,
                project_path,
                &tool_executor,
                &mut messages,
                MAX_REACT_ITERATIONS,
                token_sink,
            )
            .await?;

        if matches!(agent_type, "orchestrator" | "planner") {
            let subagent_tasks = parse_subagent_tasks(&output);
            if !subagent_tasks.is_empty() {
                let parent_id = agent_run_id.to_string();
                let provider_id_owned = provider_id.map(std::string::ToString::to_string);
                let model_id_owned = model_id.map(std::string::ToString::to_string);
                let mut join_set = JoinSet::new();

                for subagent in subagent_tasks {
                    let runner = self.clone();
                    let session_id_owned = session_id.to_string();
                    let project_path_owned = project_path.to_string();
                    let parent_id_owned = parent_id.clone();
                    let provider_id_owned = provider_id_owned.clone();
                    let model_id_owned = model_id_owned.clone();

                    join_set.spawn(async move {
                        let result = runner
                            .run_subagent(
                                &session_id_owned,
                                &subagent.agent_type,
                                &subagent.task,
                                &project_path_owned,
                                provider_id_owned.as_deref(),
                                model_id_owned.as_deref(),
                                &parent_id_owned,
                            )
                            .await;

                        (subagent.agent_type, subagent.task, result)
                    });
                }

                let mut reports = Vec::new();
                while let Some(join_result) = join_set.join_next().await {
                    match join_result {
                        Ok((sub_type, sub_task, Ok(sub_output))) => {
                            reports.push(format!(
                                "subagent={sub_type}\ntask={sub_task}\nresult:\n{sub_output}"
                            ));
                        }
                        Ok((sub_type, sub_task, Err(error))) => {
                            reports.push(format!(
                                "subagent={sub_type}\ntask={sub_task}\nerror:\n{}",
                                error
                            ));
                        }
                        Err(join_error) => {
                            reports.push(format!("subagent_join_error:\n{}", join_error));
                        }
                    }
                }

                if !reports.is_empty() {
                    let synthesis_prompt = format!(
                        "Subagent reports:\n\n{}\n\nProvide a final synthesis that integrates all reports.",
                        reports.join("\n\n---\n\n")
                    );

                    messages.push(ConversationMessage::user(&synthesis_prompt));

                    let synthesis_output = self
                        .run_react_loop(
                            &provider,
                            model,
                            agent_run_id,
                            agent_type,
                            project_path,
                            &tool_executor,
                            &mut messages,
                            SYNTHESIS_REACT_ITERATIONS,
                            token_sink,
                        )
                        .await?;

                    if !synthesis_output.trim().is_empty() {
                        output = synthesis_output;
                    }
                }
            }
        }

        Ok(output)
    }

    async fn execute_agent_leaf<S: TokenSink + Sync>(
        &self,
        agent_run_id: &str,
        agent_type: &str,
        task: &str,
        project_path: &str,
        provider_id: Option<&str>,
        model_id: Option<&str>,
        token_sink: &S,
    ) -> AppResult<String> {
        let system_prompt = get_prompt(agent_type).ok_or_else(|| {
            AppError::Validation(format!("Unknown agent type for prompt lookup: {agent_type}"))
        })?;

        let provider = provider_service::get_provider_for_chat(&self.db, provider_id).await?;
        let model = model_id.unwrap_or(&provider.model);
        let tool_executor = ToolExecutor::new(PathBuf::from(project_path));

        let mut messages = vec![
            ConversationMessage::system(system_prompt),
            ConversationMessage::user(task),
        ];

        self.run_react_loop(
            &provider,
            model,
            agent_run_id,
            agent_type,
            project_path,
            &tool_executor,
            &mut messages,
            MAX_REACT_ITERATIONS,
            token_sink,
        )
        .await
    }

    #[allow(clippy::too_many_arguments)]
    async fn run_react_loop<S: TokenSink + Sync>(
        &self,
        provider: &crate::models::Provider,
        model: &str,
        agent_run_id: &str,
        agent_type: &str,
        project_path: &str,
        tool_executor: &ToolExecutor,
        messages: &mut Vec<ConversationMessage>,
        max_iterations: usize,
        token_sink: &S,
    ) -> AppResult<String> {
        let mut final_text = String::new();

        for _ in 0..max_iterations {
            let turn = if provider.provider_type == "anthropic" {
                self.send_anthropic_with_tools(
                    &provider.api_key,
                    model,
                    messages,
                    agent_run_id,
                    token_sink,
                )
                .await?
            } else {
                self.send_openai_compatible_with_tools(
                    &provider.base_url,
                    &provider.api_key,
                    model,
                    messages,
                    agent_run_id,
                    token_sink,
                )
                .await?
            };

            messages.push(ConversationMessage::assistant(
                turn.text.clone(),
                turn.tool_calls.clone(),
            ));

            if turn.tool_calls.is_empty() {
                final_text = turn.text.trim().to_string();
                break;
            }

            for tool_call in turn.tool_calls {
                let execution = self
                    .execute_tool_call(
                        agent_run_id,
                        agent_type,
                        project_path,
                        tool_executor,
                        &tool_call,
                    )
                    .await?;

                messages.push(ConversationMessage::tool(
                    &tool_call.id,
                    &execution.output,
                    execution.is_error,
                ));
            }
        }

        Ok(final_text)
    }

    async fn execute_tool_call(
        &self,
        agent_run_id: &str,
        agent_type: &str,
        project_path: &str,
        executor: &ToolExecutor,
        tool_call: &ParsedToolCall,
    ) -> AppResult<ToolExecutionOutcome> {
        let tool_call_id = Uuid::new_v4().to_string();
        let started_at = now_rfc3339();
        let input_json = serde_json::to_string(&tool_call.input)?;

        sqlx::query(
            "INSERT INTO tool_calls (id, agent_run_id, tool_name, input, status, started_at, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        )
        .bind(&tool_call_id)
        .bind(agent_run_id)
        .bind(&tool_call.name)
        .bind(&input_json)
        .bind("running")
        .bind(&started_at)
        .bind(&started_at)
        .execute(&self.db)
        .await?;

        let _ = self.app_handle.emit(
            "agent-tool-call",
            AgentToolCallEvent {
                tool_call_id: tool_call_id.clone(),
                agent_run_id: agent_run_id.to_string(),
                tool_name: tool_call.name.clone(),
                input: tool_call.input.clone(),
            },
        );

        self.emit_permission_request_if_needed(
            agent_run_id,
            agent_type,
            project_path,
            executor,
            tool_call,
        );

        let execution = if let Some(tool_name) = map_tool_name(&tool_call.name) {
            let result = executor
                .execute(ToolCall {
                    tool: tool_name,
                    input: tool_call.input.clone(),
                })
                .await;

            ToolExecutionOutcome {
                output: result.output,
                is_error: result.is_error,
            }
        } else {
            ToolExecutionOutcome {
                output: format!("Unknown tool: {}", tool_call.name),
                is_error: true,
            }
        };

        let completed_at = now_rfc3339();
        if execution.is_error {
            sqlx::query(
                "UPDATE tool_calls SET status = ?1, output = ?2, error = ?3, completed_at = ?4 WHERE id = ?5",
            )
            .bind("failed")
            .bind(&execution.output)
            .bind(&execution.output)
            .bind(&completed_at)
            .bind(&tool_call_id)
            .execute(&self.db)
            .await?;
        } else {
            sqlx::query(
                "UPDATE tool_calls SET status = ?1, output = ?2, error = NULL, completed_at = ?3 WHERE id = ?4",
            )
            .bind("completed")
            .bind(&execution.output)
            .bind(&completed_at)
            .bind(&tool_call_id)
            .execute(&self.db)
            .await?;
        }

        let _ = self.app_handle.emit(
            "agent-tool-result",
            AgentToolResultEvent {
                tool_call_id,
                output: execution.output.clone(),
                is_error: execution.is_error,
            },
        );

        Ok(execution)
    }

    fn emit_permission_request_if_needed(
        &self,
        agent_run_id: &str,
        agent_type: &str,
        project_path: &str,
        executor: &ToolExecutor,
        tool_call: &ParsedToolCall,
    ) {
        let Some(path) = tool_call
            .input
            .get("path")
            .and_then(Value::as_str)
            .map(std::string::ToString::to_string)
        else {
            return;
        };

        let full_path = if PathBuf::from(&path).is_absolute() {
            path
        } else {
            PathBuf::from(project_path)
                .join(path)
                .to_string_lossy()
                .to_string()
        };

        if executor.requires_permission(&full_path) {
            let _ = self.app_handle.emit(
                "agent-permission-request",
                AgentPermissionRequestEvent {
                    agent_run_id: agent_run_id.to_string(),
                    permission_type: "sensitive_file".to_string(),
                    path: full_path,
                    agent_type: agent_type.to_string(),
                },
            );
            return;
        }

        if executor.is_outside_sandbox(&full_path) {
            let _ = self.app_handle.emit(
                "agent-permission-request",
                AgentPermissionRequestEvent {
                    agent_run_id: agent_run_id.to_string(),
                    permission_type: "outside_sandbox".to_string(),
                    path: full_path,
                    agent_type: agent_type.to_string(),
                },
            );
        }
    }

    async fn send_openai_compatible_with_tools<S: TokenSink + Sync>(
        &self,
        base_url: &str,
        api_key: &Option<String>,
        model: &str,
        messages: &[ConversationMessage],
        agent_run_id: &str,
        token_sink: &S,
    ) -> AppResult<LLMTurn> {
        let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

        let payload = json!({
            "model": model,
            "messages": to_openai_messages(messages),
            "tools": openai_tool_definitions(),
            "stream": true,
        });

        let client = reqwest::Client::new();
        let mut request = client
            .post(endpoint)
            .header(CONTENT_TYPE, "application/json")
            .json(&payload);

        if let Some(key) = api_key.as_deref().filter(|k| !k.trim().is_empty()) {
            request = request.header(AUTHORIZATION, format!("Bearer {key}"));
        }

        let response = request.send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Http(format!("{status}: {body}")));
        }

        self.stream_openai_tool_sse(response, agent_run_id, token_sink)
            .await
    }

    async fn send_anthropic_with_tools<S: TokenSink + Sync>(
        &self,
        api_key: &Option<String>,
        model: &str,
        messages: &[ConversationMessage],
        agent_run_id: &str,
        token_sink: &S,
    ) -> AppResult<LLMTurn> {
        let (system, anthropic_messages) = to_anthropic_messages(messages)?;
        let mut payload = json!({
            "model": model,
            "max_tokens": 8096,
            "messages": anthropic_messages,
            "tools": anthropic_tool_definitions(),
            "stream": true,
        });

        if let Some(system_prompt) = system {
            payload["system"] = Value::String(system_prompt);
        }

        let client = reqwest::Client::new();
        let mut request = client
            .post("https://api.anthropic.com/v1/messages")
            .header(CONTENT_TYPE, "application/json")
            .header("anthropic-version", "2023-06-01")
            .json(&payload);

        if let Some(key) = api_key.as_deref().filter(|k| !k.trim().is_empty()) {
            request = request.header("x-api-key", key);
        }

        let response = request.send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Http(format!("Anthropic {status}: {body}")));
        }

        self.stream_anthropic_tool_sse(response, agent_run_id, token_sink)
            .await
    }

    async fn stream_openai_tool_sse<S: TokenSink + Sync>(
        &self,
        response: reqwest::Response,
        agent_run_id: &str,
        token_sink: &S,
    ) -> AppResult<LLMTurn> {
        let mut stream = response.bytes_stream();
        let mut line_buffer = String::new();
        let mut output = String::new();
        let mut stop_reason: Option<String> = None;
        let mut pending_calls: HashMap<usize, StreamingToolCall> = HashMap::new();

        while let Some(chunk) = stream.next().await {
            line_buffer.push_str(&String::from_utf8_lossy(&chunk?));

            while let Some(pos) = line_buffer.find('\n') {
                let mut line = line_buffer[..pos].to_string();
                line_buffer.drain(..=pos);
                if line.ends_with('\r') {
                    let _ = line.pop();
                }

                let should_stop = self.parse_openai_sse_line(
                    &line,
                    agent_run_id,
                    token_sink,
                    &mut output,
                    &mut pending_calls,
                    &mut stop_reason,
                )?;

                if should_stop {
                    return finalize_llm_turn(output, pending_calls, stop_reason);
                }
            }
        }

        finalize_llm_turn(output, pending_calls, stop_reason)
    }

    #[allow(clippy::too_many_arguments)]
    fn parse_openai_sse_line<S: TokenSink + Sync>(
        &self,
        line: &str,
        agent_run_id: &str,
        token_sink: &S,
        output: &mut String,
        pending_calls: &mut HashMap<usize, StreamingToolCall>,
        stop_reason: &mut Option<String>,
    ) -> AppResult<bool> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return Ok(false);
        }

        let Some(payload_raw) = trimmed.strip_prefix("data:") else {
            return Ok(false);
        };

        let payload = payload_raw.trim();
        if payload == "[DONE]" {
            return Ok(true);
        }

        let value: Value = serde_json::from_str(payload)?;
        let Some(choice) = value
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
        else {
            return Ok(false);
        };

        if let Some(reason) = choice.get("finish_reason").and_then(Value::as_str) {
            *stop_reason = Some(reason.to_string());
        }

        if let Some(token) = choice
            .get("delta")
            .and_then(|delta| delta.get("content"))
            .and_then(Value::as_str)
        {
            output.push_str(token);
            token_sink.send(token);
            let _ = self.app_handle.emit(
                "agent-token",
                AgentTokenEvent {
                    agent_run_id: agent_run_id.to_string(),
                    token: token.to_string(),
                },
            );
        }

        if let Some(tool_calls) = choice
            .get("delta")
            .and_then(|delta| delta.get("tool_calls"))
            .and_then(Value::as_array)
        {
            for chunk in tool_calls {
                let index_u64 = chunk
                    .get("index")
                    .and_then(Value::as_u64)
                    .ok_or_else(|| AppError::Json("OpenAI tool call chunk missing index".to_string()))?;
                let index = usize::try_from(index_u64)
                    .map_err(|_| AppError::Json("OpenAI tool call index overflow".to_string()))?;

                let entry = pending_calls.entry(index).or_default();

                if let Some(id) = chunk.get("id").and_then(Value::as_str) {
                    entry.id = id.to_string();
                }

                if let Some(name) = chunk
                    .get("function")
                    .and_then(|function| function.get("name"))
                    .and_then(Value::as_str)
                {
                    entry.name = name.to_string();
                }

                if let Some(arguments_chunk) = chunk
                    .get("function")
                    .and_then(|function| function.get("arguments"))
                    .and_then(Value::as_str)
                {
                    if entry.arguments.is_empty() {
                        entry.arguments.push_str(arguments_chunk);
                    } else if arguments_chunk.starts_with(&entry.arguments) {
                        entry.arguments = arguments_chunk.to_string();
                    } else if entry.arguments == arguments_chunk
                        || entry.arguments.ends_with(arguments_chunk)
                    {
                    } else if serde_json::from_str::<Value>(&entry.arguments).is_ok() {
                        if serde_json::from_str::<Value>(arguments_chunk).is_ok() {
                            entry.arguments = arguments_chunk.to_string();
                        }
                    } else {
                        entry.arguments.push_str(arguments_chunk);
                    }
                }
            }
        }

        Ok(false)
    }

    async fn stream_anthropic_tool_sse<S: TokenSink + Sync>(
        &self,
        response: reqwest::Response,
        agent_run_id: &str,
        token_sink: &S,
    ) -> AppResult<LLMTurn> {
        let mut stream = response.bytes_stream();
        let mut line_buffer = String::new();
        let mut output = String::new();
        let mut stop_reason: Option<String> = None;
        let mut pending_calls: HashMap<usize, StreamingToolCall> = HashMap::new();

        while let Some(chunk) = stream.next().await {
            line_buffer.push_str(&String::from_utf8_lossy(&chunk?));

            while let Some(pos) = line_buffer.find('\n') {
                let mut line = line_buffer[..pos].to_string();
                line_buffer.drain(..=pos);
                if line.ends_with('\r') {
                    let _ = line.pop();
                }

                let should_stop = self.parse_anthropic_sse_line(
                    &line,
                    agent_run_id,
                    token_sink,
                    &mut output,
                    &mut pending_calls,
                    &mut stop_reason,
                )?;

                if should_stop {
                    return finalize_llm_turn(output, pending_calls, stop_reason);
                }
            }
        }

        finalize_llm_turn(output, pending_calls, stop_reason)
    }

    #[allow(clippy::too_many_arguments)]
    fn parse_anthropic_sse_line<S: TokenSink + Sync>(
        &self,
        line: &str,
        agent_run_id: &str,
        token_sink: &S,
        output: &mut String,
        pending_calls: &mut HashMap<usize, StreamingToolCall>,
        stop_reason: &mut Option<String>,
    ) -> AppResult<bool> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return Ok(false);
        }

        if let Some(event_name) = trimmed.strip_prefix("event:") {
            if event_name.trim() == "message_stop" {
                return Ok(true);
            }
            return Ok(false);
        }

        let Some(payload_raw) = trimmed.strip_prefix("data:") else {
            return Ok(false);
        };
        let payload = payload_raw.trim();

        let value: Value = match serde_json::from_str(payload) {
            Ok(value) => value,
            Err(_) => return Ok(false),
        };

        let event_type = value.get("type").and_then(Value::as_str).unwrap_or_default();

        match event_type {
            "content_block_start" => {
                let is_tool_use = value
                    .get("content_block")
                    .and_then(|block| block.get("type"))
                    .and_then(Value::as_str)
                    == Some("tool_use");

                if is_tool_use {
                    let index_u64 = value
                        .get("index")
                        .and_then(Value::as_u64)
                        .ok_or_else(|| {
                            AppError::Json(
                                "Anthropic tool_use content_block_start missing index".to_string(),
                            )
                        })?;
                    let index = usize::try_from(index_u64)
                        .map_err(|_| AppError::Json("Anthropic tool index overflow".to_string()))?;

                    let id = value
                        .get("content_block")
                        .and_then(|block| block.get("id"))
                        .and_then(Value::as_str)
                        .ok_or_else(|| {
                            AppError::Json(
                                "Anthropic tool_use content_block_start missing id".to_string(),
                            )
                        })?
                        .to_string();

                    let name = value
                        .get("content_block")
                        .and_then(|block| block.get("name"))
                        .and_then(Value::as_str)
                        .ok_or_else(|| {
                            AppError::Json(
                                "Anthropic tool_use content_block_start missing name".to_string(),
                            )
                        })?
                        .to_string();

                    pending_calls.insert(
                        index,
                        StreamingToolCall {
                            id,
                            name,
                            arguments: String::new(),
                        },
                    );
                }
            }
            "content_block_delta" => {
                if let Some(token) = value
                    .get("delta")
                    .and_then(|delta| delta.get("text"))
                    .and_then(Value::as_str)
                {
                    output.push_str(token);
                    token_sink.send(token);
                    let _ = self.app_handle.emit(
                        "agent-token",
                        AgentTokenEvent {
                            agent_run_id: agent_run_id.to_string(),
                            token: token.to_string(),
                        },
                    );
                }

                let is_input_json_delta = value
                    .get("delta")
                    .and_then(|delta| delta.get("type"))
                    .and_then(Value::as_str)
                    == Some("input_json_delta");

                if is_input_json_delta {
                    let index_u64 = value
                        .get("index")
                        .and_then(Value::as_u64)
                        .ok_or_else(|| {
                            AppError::Json(
                                "Anthropic input_json_delta missing index".to_string(),
                            )
                        })?;
                    let index = usize::try_from(index_u64).map_err(|_| {
                        AppError::Json("Anthropic input_json_delta index overflow".to_string())
                    })?;

                    if let Some(partial_json) = value
                        .get("delta")
                        .and_then(|delta| delta.get("partial_json"))
                        .and_then(Value::as_str)
                    {
                        let entry = pending_calls.entry(index).or_default();
                        entry.arguments.push_str(partial_json);
                    }
                }
            }
            "message_delta" => {
                if let Some(reason) = value
                    .get("delta")
                    .and_then(|delta| delta.get("stop_reason"))
                    .and_then(Value::as_str)
                {
                    *stop_reason = Some(reason.to_string());
                }
            }
            "message_stop" => return Ok(true),
            _ => {}
        }

        Ok(false)
    }
}

#[derive(Debug, Clone)]
struct LLMTurn {
    text: String,
    tool_calls: Vec<ParsedToolCall>,
}

#[derive(Debug, Clone)]
struct ParsedToolCall {
    id: String,
    name: String,
    input: Value,
}

#[derive(Debug, Clone, Default)]
struct StreamingToolCall {
    id: String,
    name: String,
    arguments: String,
}

#[derive(Debug, Clone)]
struct ToolExecutionOutcome {
    output: String,
    is_error: bool,
}

#[derive(Debug, Clone)]
struct ConversationMessage {
    role: String,
    content: String,
    tool_call_id: Option<String>,
    tool_calls: Vec<ParsedToolCall>,
    is_error: bool,
}

impl ConversationMessage {
    fn system(content: &str) -> Self {
        Self {
            role: "system".to_string(),
            content: content.to_string(),
            tool_call_id: None,
            tool_calls: Vec::new(),
            is_error: false,
        }
    }

    fn user(content: &str) -> Self {
        Self {
            role: "user".to_string(),
            content: content.to_string(),
            tool_call_id: None,
            tool_calls: Vec::new(),
            is_error: false,
        }
    }

    fn assistant(content: String, tool_calls: Vec<ParsedToolCall>) -> Self {
        Self {
            role: "assistant".to_string(),
            content,
            tool_call_id: None,
            tool_calls,
            is_error: false,
        }
    }

    fn tool(tool_call_id: &str, content: &str, is_error: bool) -> Self {
        Self {
            role: "tool".to_string(),
            content: content.to_string(),
            tool_call_id: Some(tool_call_id.to_string()),
            tool_calls: Vec::new(),
            is_error,
        }
    }
}

fn finalize_llm_turn(
    output: String,
    pending_calls: HashMap<usize, StreamingToolCall>,
    _stop_reason: Option<String>,
) -> AppResult<LLMTurn> {
    let mut sorted: Vec<(usize, StreamingToolCall)> = pending_calls.into_iter().collect();
    sorted.sort_by_key(|(index, _)| *index);

    let mut tool_calls = Vec::new();
    for (_, call) in sorted {
        if call.id.is_empty() || call.name.is_empty() {
            continue;
        }

        let input = if call.arguments.trim().is_empty() {
            json!({})
        } else {
            serde_json::from_str(&call.arguments).map_err(|error| {
                AppError::Json(format!(
                    "Failed to parse tool arguments for '{}': {}. Raw: {}",
                    call.name, error, call.arguments
                ))
            })?
        };

        tool_calls.push(ParsedToolCall {
            id: call.id,
            name: call.name,
            input,
        });
    }

    Ok(LLMTurn {
        text: output,
        tool_calls,
    })
}

fn to_openai_messages(messages: &[ConversationMessage]) -> Vec<Value> {
    messages
        .iter()
        .map(|message| match message.role.as_str() {
            "assistant" if !message.tool_calls.is_empty() => {
                let content = if message.content.trim().is_empty() {
                    Value::Null
                } else {
                    Value::String(message.content.clone())
                };

                let tool_calls = message
                    .tool_calls
                    .iter()
                    .map(|tool_call| {
                        json!({
                            "id": tool_call.id,
                            "type": "function",
                            "function": {
                                "name": tool_call.name,
                                "arguments": tool_call.input.to_string(),
                            }
                        })
                    })
                    .collect::<Vec<_>>();

                json!({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_calls,
                })
            }
            "tool" => json!({
                "role": "tool",
                "tool_call_id": message.tool_call_id,
                "content": message.content,
            }),
            _ => json!({
                "role": message.role,
                "content": message.content,
            }),
        })
        .collect()
}

fn to_anthropic_messages(messages: &[ConversationMessage]) -> AppResult<(Option<String>, Vec<Value>)> {
    let mut system: Option<String> = None;
    let mut out = Vec::new();

    for message in messages {
        match message.role.as_str() {
            "system" => {
                if system.is_none() {
                    system = Some(message.content.clone());
                }
            }
            "assistant" => {
                let mut blocks = Vec::new();

                if !message.content.trim().is_empty() {
                    blocks.push(json!({
                        "type": "text",
                        "text": message.content,
                    }));
                }

                for tool_call in &message.tool_calls {
                    blocks.push(json!({
                        "type": "tool_use",
                        "id": tool_call.id,
                        "name": tool_call.name,
                        "input": tool_call.input,
                    }));
                }

                push_anthropic_message(&mut out, "assistant", blocks);
            }
            "user" => {
                push_anthropic_message(
                    &mut out,
                    "user",
                    vec![json!({
                        "type": "text",
                        "text": message.content,
                    })],
                );
            }
            "tool" => {
                let tool_use_id = message.tool_call_id.clone().ok_or_else(|| {
                    AppError::Validation("Tool message missing tool_call_id".to_string())
                })?;

                let mut block = json!({
                    "type": "tool_result",
                    "tool_use_id": tool_use_id,
                    "content": message.content,
                });

                if message.is_error {
                    block["is_error"] = Value::Bool(true);
                }

                push_anthropic_message(&mut out, "user", vec![block]);
            }
            _ => {}
        }
    }

    Ok((system, out))
}

fn push_anthropic_message(out: &mut Vec<Value>, role: &str, mut blocks: Vec<Value>) {
    if blocks.is_empty() {
        return;
    }

    if let Some(last) = out.last_mut() {
        let same_role = last.get("role").and_then(Value::as_str) == Some(role);
        if same_role {
            if let Some(content) = last.get_mut("content").and_then(Value::as_array_mut) {
                content.append(&mut blocks);
                return;
            }
        }
    }

    out.push(json!({
        "role": role,
        "content": blocks,
    }));
}

fn openai_tool_definitions() -> Vec<Value> {
    vec![
        json!({
            "type": "function",
            "function": {
                "name": "read_file",
                "description": "Read a file from the project",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "File path relative to project root"
                        }
                    },
                    "required": ["path"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "write_file",
                "description": "Write content to a file",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "list_dir",
                "description": "List directory contents",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "search_files",
                "description": "Search for a pattern in files",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "pattern": { "type": "string" },
                        "path": { "type": "string" }
                    },
                    "required": ["pattern"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "run_command",
                "description": "Run a shell command in the project directory",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" }
                    },
                    "required": ["command"]
                }
            }
        }),
        json!({
            "type": "function",
            "function": {
                "name": "web_search",
                "description": "Search the web",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }
            }
        }),
    ]
}

fn anthropic_tool_definitions() -> Vec<Value> {
    openai_tool_definitions()
        .into_iter()
        .filter_map(|tool| {
            let function = tool.get("function")?;
            let name = function.get("name")?.as_str()?;
            let description = function.get("description")?.as_str()?;
            let input_schema = function.get("parameters")?;

            Some(json!({
                "name": name,
                "description": description,
                "input_schema": input_schema,
            }))
        })
        .collect()
}

fn map_tool_name(name: &str) -> Option<ToolName> {
    match name {
        "read_file" => Some(ToolName::ReadFile),
        "write_file" => Some(ToolName::WriteFile),
        "list_dir" => Some(ToolName::ListDir),
        "search_files" => Some(ToolName::SearchFiles),
        "run_command" => Some(ToolName::RunCommand),
        "web_search" => Some(ToolName::WebSearch),
        _ => None,
    }
}

#[derive(Debug, Clone)]
struct SubagentTask {
    agent_type: String,
    task: String,
}

fn parse_subagent_tasks(response: &str) -> Vec<SubagentTask> {
    let mut out = Vec::new();

    if let Ok(value) = serde_json::from_str::<Value>(response) {
        extract_subagent_tasks_from_value(&value, &mut out);
    }

    for block in extract_fenced_json_blocks(response) {
        if let Ok(value) = serde_json::from_str::<Value>(&block) {
            extract_subagent_tasks_from_value(&value, &mut out);
        }
    }

    for candidate in extract_braced_json_candidates(response) {
        if let Ok(value) = serde_json::from_str::<Value>(&candidate) {
            extract_subagent_tasks_from_value(&value, &mut out);
        }
    }

    let mut seen = HashSet::new();
    out.into_iter()
        .filter(|task| {
            let key = format!("{}::{}", task.agent_type, task.task);
            seen.insert(key)
        })
        .collect()
}

fn extract_subagent_tasks_from_value(value: &Value, out: &mut Vec<SubagentTask>) {
    let Some(subagents) = value.get("subagents").and_then(Value::as_array) else {
        return;
    };

    for subagent in subagents {
        let Some(agent_type) = subagent.get("type").and_then(Value::as_str) else {
            continue;
        };
        let Some(task) = subagent.get("task").and_then(Value::as_str) else {
            continue;
        };

        if !agent_type.trim().is_empty() && !task.trim().is_empty() {
            out.push(SubagentTask {
                agent_type: agent_type.to_string(),
                task: task.to_string(),
            });
        }
    }
}

fn extract_fenced_json_blocks(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut rest = text;

    while let Some(start) = rest.find("```json") {
        let after_start = &rest[start + "```json".len()..];
        if let Some(end) = after_start.find("```") {
            out.push(after_start[..end].trim().to_string());
            rest = &after_start[end + "```".len()..];
        } else {
            break;
        }
    }

    out
}

fn extract_braced_json_candidates(text: &str) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    let mut out = Vec::new();
    let mut starts = Vec::new();
    let mut depth: usize = 0;
    let mut in_string = false;
    let mut escaped = false;

    for (index, ch) in chars.iter().enumerate() {
        if in_string {
            if escaped {
                escaped = false;
                continue;
            }

            if *ch == '\\' {
                escaped = true;
                continue;
            }

            if *ch == '"' {
                in_string = false;
            }

            continue;
        }

        if *ch == '"' {
            in_string = true;
            continue;
        }

        if *ch == '{' {
            if depth == 0 {
                starts.push(index);
            }
            depth = depth.saturating_add(1);
            continue;
        }

        if *ch == '}' {
            if depth == 0 {
                continue;
            }

            depth -= 1;
            if depth == 0 {
                if let Some(start) = starts.pop() {
                    let candidate: String = chars[start..=index].iter().collect();
                    if candidate.contains("\"subagents\"") {
                        out.push(candidate);
                    }
                }
            }
        }
    }

    out
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentStartedEvent {
    agent_run_id: String,
    agent_type: String,
    parent_agent_run_id: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentTokenEvent {
    agent_run_id: String,
    token: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentToolCallEvent {
    tool_call_id: String,
    agent_run_id: String,
    tool_name: String,
    input: Value,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentToolResultEvent {
    tool_call_id: String,
    output: String,
    is_error: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentDoneEvent {
    agent_run_id: String,
    output: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentErrorEvent {
    agent_run_id: String,
    error: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentPermissionRequestEvent {
    agent_run_id: String,
    #[serde(rename = "type")]
    permission_type: String,
    path: String,
    agent_type: String,
}
