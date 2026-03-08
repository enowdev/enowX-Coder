use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::Message,
};

use super::{now_rfc3339, provider_service};

pub async fn get_messages(db: &SqlitePool, session_id: &str) -> AppResult<Vec<Message>> {
    let messages = sqlx::query_as::<_, Message>(
        "SELECT id, session_id, role, content, created_at FROM messages \
         WHERE session_id = ?1 ORDER BY created_at ASC",
    )
    .bind(session_id)
    .fetch_all(db)
    .await?;

    Ok(messages)
}

pub async fn send_message(
    db: &SqlitePool,
    session_id: &str,
    content: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
    app_handle: &AppHandle,
) -> AppResult<()> {
    let result =
        send_message_inner(db, session_id, content, provider_id, model_id, app_handle).await;
    if let Err(ref error) = result {
        let _ = app_handle.emit("chat-error", error.to_string());
    }
    result
}

async fn send_message_inner(
    db: &SqlitePool,
    session_id: &str,
    content: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
    app_handle: &AppHandle,
) -> AppResult<()> {
    let normalized = content.trim();
    if normalized.is_empty() {
        return Err(AppError::Validation("Message content cannot be empty".to_string()));
    }

    let user_message = Message {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.to_string(),
        role: "user".to_string(),
        content: normalized.to_string(),
        created_at: now_rfc3339(),
    };

    sqlx::query(
        "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&user_message.id)
    .bind(&user_message.session_id)
    .bind(&user_message.role)
    .bind(&user_message.content)
    .bind(&user_message.created_at)
    .execute(db)
    .await?;

    let provider = provider_service::get_provider_for_chat(db, provider_id).await?;
    let history = get_messages(db, session_id).await?;

    // Use caller-supplied model_id if provided, otherwise fall back to provider default
    let model = model_id.unwrap_or(&provider.model);

    let assistant_output = if provider.provider_type == "anthropic" {
        send_anthropic(history, model, provider.api_key.as_deref(), app_handle).await?
    } else {
        send_openai_compatible(
            &provider.base_url,
            model,
            provider.api_key.as_deref(),
            history,
            app_handle,
        )
        .await?
    };

    let assistant_message = Message {
        id: Uuid::new_v4().to_string(),
        session_id: session_id.to_string(),
        role: "assistant".to_string(),
        content: assistant_output,
        created_at: now_rfc3339(),
    };

    sqlx::query(
        "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&assistant_message.id)
    .bind(&assistant_message.session_id)
    .bind(&assistant_message.role)
    .bind(&assistant_message.content)
    .bind(&assistant_message.created_at)
    .execute(db)
    .await?;

    let _ = app_handle.emit("chat-done", assistant_message.id.clone());
    Ok(())
}

async fn send_openai_compatible(
    base_url: &str,
    model: &str,
    api_key: Option<&str>,
    history: Vec<Message>,
    app_handle: &AppHandle,
) -> AppResult<String> {
    let client = reqwest::Client::new();
    let endpoint = format!("{}/chat/completions", base_url.trim_end_matches('/'));

    let messages: Vec<Value> = history
        .iter()
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    let payload = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": true,
    });

    let mut request = client
        .post(&endpoint)
        .header(CONTENT_TYPE, "application/json")
        .json(&payload);

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        request = request.header(AUTHORIZATION, format!("Bearer {key}"));
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("{status}: {body}")));
    }

    stream_openai_sse(response, app_handle).await
}

async fn send_anthropic(
    history: Vec<Message>,
    model: &str,
    api_key: Option<&str>,
    app_handle: &AppHandle,
) -> AppResult<String> {
    let client = reqwest::Client::new();

    let (system_msgs, chat_msgs): (Vec<_>, Vec<_>) =
        history.iter().partition(|m| m.role == "system");

    let messages: Vec<Value> = chat_msgs
        .iter()
        .filter(|m| m.role == "user" || m.role == "assistant")
        .map(|m| serde_json::json!({ "role": m.role, "content": m.content }))
        .collect();

    let mut payload = serde_json::json!({
        "model": model,
        "max_tokens": 8096,
        "messages": messages,
        "stream": true,
    });

    if let Some(sys) = system_msgs.first() {
        payload["system"] = serde_json::json!(sys.content);
    }

    let mut request = client
        .post("https://api.anthropic.com/v1/messages")
        .header(CONTENT_TYPE, "application/json")
        .header("anthropic-version", "2023-06-01")
        .json(&payload);

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        request = request.header("x-api-key", key);
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("Anthropic {status}: {body}")));
    }

    stream_anthropic_sse(response, app_handle).await
}

async fn stream_openai_sse(
    response: reqwest::Response,
    app_handle: &AppHandle,
) -> AppResult<String> {
    let mut stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut output = String::new();

    while let Some(chunk) = stream.next().await {
        line_buffer.push_str(&String::from_utf8_lossy(&chunk?));

        while let Some(pos) = line_buffer.find('\n') {
            let mut line = line_buffer[..pos].to_string();
            line_buffer.drain(..=pos);
            if line.ends_with('\r') {
                line.pop();
            }

            if parse_openai_sse_line(&line, app_handle, &mut output)? {
                return Ok(output);
            }
        }
    }

    if !line_buffer.is_empty() {
        parse_openai_sse_line(&line_buffer, app_handle, &mut output)?;
    }

    Ok(output)
}

fn parse_openai_sse_line(
    line: &str,
    app_handle: &AppHandle,
    output: &mut String,
) -> AppResult<bool> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }

    let Some(payload) = trimmed.strip_prefix("data:") else {
        return Ok(false);
    };
    let payload = payload.trim();
    if payload == "[DONE]" {
        return Ok(true);
    }

    let value: Value = serde_json::from_str(payload)?;
    if let Some(token) = value
        .get("choices")
        .and_then(Value::as_array)
        .and_then(|c| c.first())
        .and_then(|c| c.get("delta"))
        .and_then(|d| d.get("content"))
        .and_then(Value::as_str)
    {
        output.push_str(token);
        let _ = app_handle.emit("chat-token", token.to_string());
    }

    Ok(false)
}

async fn stream_anthropic_sse(
    response: reqwest::Response,
    app_handle: &AppHandle,
) -> AppResult<String> {
    let mut stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut output = String::new();

    while let Some(chunk) = stream.next().await {
        line_buffer.push_str(&String::from_utf8_lossy(&chunk?));

        while let Some(pos) = line_buffer.find('\n') {
            let mut line = line_buffer[..pos].to_string();
            line_buffer.drain(..=pos);
            if line.ends_with('\r') {
                line.pop();
            }

            if parse_anthropic_sse_line(&line, app_handle, &mut output)? {
                return Ok(output);
            }
        }
    }

    Ok(output)
}

fn parse_anthropic_sse_line(
    line: &str,
    app_handle: &AppHandle,
    output: &mut String,
) -> AppResult<bool> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(false);
    }

    if let Some(event) = trimmed.strip_prefix("event:") {
        let event = event.trim();
        if event == "message_stop" {
            return Ok(true);
        }
        return Ok(false);
    }

    let Some(payload) = trimmed.strip_prefix("data:") else {
        return Ok(false);
    };
    let payload = payload.trim();

    let value: Value = match serde_json::from_str(payload) {
        Ok(v) => v,
        Err(_) => return Ok(false),
    };

    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");

    match event_type {
        "content_block_delta" => {
            if let Some(token) = value
                .get("delta")
                .and_then(|d| d.get("text"))
                .and_then(Value::as_str)
            {
                output.push_str(token);
                let _ = app_handle.emit("chat-token", token.to_string());
            }
        }
        "message_stop" => return Ok(true),
        _ => {}
    }

    Ok(false)
}
