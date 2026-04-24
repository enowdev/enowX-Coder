use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;
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

#[allow(clippy::too_many_arguments)]
pub async fn send_message(
    db: &SqlitePool,
    session_id: &str,
    content: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
    on_token: Channel<String>,
    app_handle: &AppHandle,
    cancel_token: CancellationToken,
) -> AppResult<()> {
    let result = send_message_inner(
        db,
        session_id,
        content,
        provider_id,
        model_id,
        on_token,
        app_handle,
        cancel_token,
    )
    .await;
    match &result {
        Err(AppError::Cancelled) => {
            let _ = app_handle.emit("chat-done", "cancelled");
            return Ok(());
        }
        Err(ref error) => {
            let _ = app_handle.emit("chat-error", error.to_string());
        }
        _ => {}
    }
    result
}

#[allow(clippy::too_many_arguments)]
async fn send_message_inner(
    db: &SqlitePool,
    session_id: &str,
    content: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
    on_token: Channel<String>,
    app_handle: &AppHandle,
    cancel_token: CancellationToken,
) -> AppResult<()> {
    let normalized = content.trim();
    if normalized.is_empty() {
        return Err(AppError::Validation(
            "Message content cannot be empty".to_string(),
        ));
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

    // Pre-flight: check API key is configured (except for local providers like Ollama)
    if provider.provider_type != "ollama"
        && provider
            .api_key
            .as_deref()
            .is_none_or(|k| k.trim().is_empty())
    {
        return Err(AppError::Validation(format!(
            "API key not configured for '{}'. Go to Settings → Providers and enter your API key.",
            provider.name
        )));
    }

    let history = get_messages(db, session_id).await?;

    // Use caller-supplied model_id if provided, otherwise fall back to provider default
    let model = model_id.unwrap_or(&provider.model);

    let assistant_output = if provider.provider_type == "anthropic" {
        send_anthropic(history, model, provider.api_key.as_deref(), &on_token, &cancel_token).await?
    } else {
        send_openai_compatible(
            &provider.base_url,
            model,
            provider.api_key.as_deref(),
            history,
            &on_token,
            &cancel_token,
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
    on_token: &Channel<String>,
    cancel_token: &CancellationToken,
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
        "temperature": 0.2,
        "presence_penalty": 0.0,
        "frequency_penalty": 0.0,
        "stream": true,
    });

    let system_instructions = concat!(
        "IMPORTANT: Reply using the same language as the user's latest message. If user writes Indonesian, answer in Indonesian. Never switch to another language unless the user explicitly asks you to.\n\n",
        "INTERACTIVE PREVIEW: When the user asks for a visualization, diagram, chart, interactive demo, or any visual HTML content, output it as a fenced code block with tag `html:preview`. The app renders it as a live iframe preview with a full design system pre-loaded (CSS variables, SVG color ramp classes, pre-styled form elements, light/dark mode).\n\n",
        "Design rules: flat (no gradients/shadows/glow), use CSS vars for colors (var(--color-text-primary), var(--color-background-secondary), etc). system-ui font, 2 weights (400/500), sentence case. Structure: style → content → script last.\n\n",
        "SVG diagrams: use pre-loaded classes — `.t` (14px text), `.ts` (12px), `.th` (14px bold), `.box` (neutral), `.node` (clickable), `.arr` (arrow), `.leader` (dashed). Color ramps: `class=\"c-blue\"` on `<g>` wrapping shape+text — auto light/dark. Available: c-purple, c-teal, c-coral, c-blue, c-amber, c-green, c-red, c-gray, c-pink. Max 2-3 ramps per diagram.\n\n",
        "Chart.js: wrap canvas in div with position:relative + explicit height. Load UMD from cdnjs.cloudflare.com with onload callback. Disable default legend, build custom HTML legend with 10px colored squares.\n\n",
        "Interactive: form elements pre-styled. Use sendPrompt(text) for drill-down. CDN: cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh only.\n\n",
        "Always output COMPLETE standalone HTML (DOCTYPE, html, head, body). No titles/prose inside widget — explanations go in your response text."
    );
    let payload_with_system = if let Some(arr) = payload.get("messages").and_then(Value::as_array) {
        let mut updated = arr.clone();
        updated.insert(
            0,
            serde_json::json!({
                "role": "system",
                "content": system_instructions,
            }),
        );
        let mut p = payload.clone();
        p["messages"] = Value::Array(updated);
        p
    } else {
        payload
    };

    let mut request = client
        .post(&endpoint)
        .header(CONTENT_TYPE, "application/json")
        .json(&payload_with_system);

    if let Some(key) = api_key.filter(|k| !k.trim().is_empty()) {
        request = request.header(AUTHORIZATION, format!("Bearer {key}"));
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("{status}: {body}")));
    }

    stream_openai_sse(response, on_token, cancel_token).await
}

async fn send_anthropic(
    history: Vec<Message>,
    model: &str,
    api_key: Option<&str>,
    on_token: &Channel<String>,
    cancel_token: &CancellationToken,
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
        "temperature": 0.2,
        "stream": true,
    });

    let system_instructions_anthropic = concat!(
        "IMPORTANT: Reply using the same language as the user's latest message. If user writes Indonesian, answer in Indonesian. Never switch to another language unless the user explicitly asks you to.\n\n",
        "INTERACTIVE PREVIEW: When the user asks for a visualization, diagram, chart, interactive demo, or any visual HTML content, output it as a fenced code block with tag `html:preview`. The app renders it as a live iframe preview with a full design system pre-loaded (CSS variables, SVG color ramp classes, pre-styled form elements, light/dark mode).\n\n",
        "Design rules: flat (no gradients/shadows/glow), use CSS vars for colors (var(--color-text-primary), var(--color-background-secondary), etc). system-ui font, 2 weights (400/500), sentence case. Structure: style → content → script last.\n\n",
        "SVG diagrams: use pre-loaded classes — `.t` (14px text), `.ts` (12px), `.th` (14px bold), `.box` (neutral), `.node` (clickable), `.arr` (arrow), `.leader` (dashed). Color ramps: `class=\"c-blue\"` on `<g>` wrapping shape+text — auto light/dark. Available: c-purple, c-teal, c-coral, c-blue, c-amber, c-green, c-red, c-gray, c-pink. Max 2-3 ramps per diagram.\n\n",
        "Chart.js: wrap canvas in div with position:relative + explicit height. Load UMD from cdnjs.cloudflare.com with onload callback. Disable default legend, build custom HTML legend with 10px colored squares.\n\n",
        "Interactive: form elements pre-styled. Use sendPrompt(text) for drill-down. CDN: cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh only.\n\n",
        "Always output COMPLETE standalone HTML (DOCTYPE, html, head, body). No titles/prose inside widget — explanations go in your response text."
    );
    if let Some(sys) = system_msgs.first() {
        payload["system"] = serde_json::json!(format!("{}\n\n{}", sys.content, system_instructions_anthropic));
    } else {
        payload["system"] = serde_json::json!(system_instructions_anthropic);
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

    stream_anthropic_sse(response, on_token, cancel_token).await
}

async fn stream_openai_sse(
    response: reqwest::Response,
    on_token: &Channel<String>,
    cancel_token: &CancellationToken,
) -> AppResult<String> {
    let mut stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut output = String::new();

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                return Err(AppError::Cancelled);
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        line_buffer.push_str(&String::from_utf8_lossy(&bytes));

                        while let Some(pos) = line_buffer.find('\n') {
                            let mut line = line_buffer[..pos].to_string();
                            line_buffer.drain(..=pos);
                            if line.ends_with('\r') {
                                line.pop();
                            }

                            if parse_openai_sse_line(&line, on_token, &mut output)? {
                                return Ok(output);
                            }
                        }
                    }
                    Some(Err(e)) => return Err(AppError::Http(e.to_string())),
                    None => break,
                }
            }
        }
    }

    if !line_buffer.is_empty() {
        parse_openai_sse_line(&line_buffer, on_token, &mut output)?;
    }

    Ok(output)
}

fn parse_openai_sse_line(
    line: &str,
    on_token: &Channel<String>,
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
        let _ = on_token.send(token.to_string());
    }

    Ok(false)
}

async fn stream_anthropic_sse(
    response: reqwest::Response,
    on_token: &Channel<String>,
    cancel_token: &CancellationToken,
) -> AppResult<String> {
    let mut stream = response.bytes_stream();
    let mut line_buffer = String::new();
    let mut output = String::new();

    loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                return Err(AppError::Cancelled);
            }
            chunk = stream.next() => {
                match chunk {
                    Some(Ok(bytes)) => {
                        line_buffer.push_str(&String::from_utf8_lossy(&bytes));

                        while let Some(pos) = line_buffer.find('\n') {
                            let mut line = line_buffer[..pos].to_string();
                            line_buffer.drain(..=pos);
                            if line.ends_with('\r') {
                                line.pop();
                            }

                            if parse_anthropic_sse_line(&line, on_token, &mut output)? {
                                return Ok(output);
                            }
                        }
                    }
                    Some(Err(e)) => return Err(AppError::Http(e.to_string())),
                    None => break,
                }
            }
        }
    }

    Ok(output)
}

fn parse_anthropic_sse_line(
    line: &str,
    on_token: &Channel<String>,
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
                let _ = on_token.send(token.to_string());
            }
        }
        "message_stop" => return Ok(true),
        _ => {}
    }

    Ok(false)
}

/// Generate a short title for a conversation using the same provider/model.
pub async fn generate_title(
    db: &SqlitePool,
    session_id: &str,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> AppResult<String> {
    let provider = provider_service::get_provider_for_chat(db, provider_id).await?;
    let model = model_id.unwrap_or(&provider.model);
    let history = get_messages(db, session_id).await?;

    if history.is_empty() {
        return Ok("New Chat".to_string());
    }

    // Build a compact summary of the conversation (max first 2 exchanges)
    let snippet: Vec<Value> = history
        .iter()
        .filter(|m| m.role != "system")
        .take(4)
        .map(|m| {
            let content = if m.content.len() > 200 {
                format!("{}…", &m.content[..200])
            } else {
                m.content.clone()
            };
            serde_json::json!({ "role": m.role, "content": content })
        })
        .collect();

    let mut messages = vec![serde_json::json!({
        "role": "system",
        "content": "Generate a short title (2-5 words) for this conversation. Reply with ONLY the title, nothing else. No quotes, no punctuation at the end. Examples: 'React Auth Setup', 'Greeting', 'Python Bug Fix', 'Database Migration Help'."
    })];
    messages.extend(snippet);
    messages.push(serde_json::json!({
        "role": "user",
        "content": "Generate a short title for the conversation above."
    }));

    let title = if provider.provider_type == "anthropic" {
        generate_title_anthropic(&provider, model, &messages).await?
    } else {
        generate_title_openai(&provider, model, &messages).await?
    };

    // Clean up: remove quotes, trim, cap length
    let cleaned = title
        .trim()
        .trim_matches('"')
        .trim_matches('\'')
        .trim_end_matches('.')
        .trim();

    let final_title = if cleaned.is_empty() {
        "New Chat".to_string()
    } else if cleaned.len() > 50 {
        let cut = &cleaned[..50];
        let last_space = cut.rfind(' ').unwrap_or(50);
        format!("{}…", &cleaned[..last_space])
    } else {
        cleaned.to_string()
    };

    Ok(final_title)
}

async fn generate_title_openai(
    provider: &crate::models::Provider,
    model: &str,
    messages: &[Value],
) -> AppResult<String> {
    let client = reqwest::Client::new();
    let endpoint = format!(
        "{}/chat/completions",
        provider.base_url.trim_end_matches('/')
    );

    let payload = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 20,
        "stream": false,
    });

    let mut request = client
        .post(&endpoint)
        .header(CONTENT_TYPE, "application/json")
        .json(&payload);

    if let Some(key) = provider.api_key.as_deref().filter(|k| !k.trim().is_empty()) {
        request = request.header(AUTHORIZATION, format!("Bearer {key}"));
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("{status}: {body}")));
    }

    let body: Value = response.json().await?;
    let title = body["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("New Chat")
        .to_string();

    Ok(title)
}

async fn generate_title_anthropic(
    provider: &crate::models::Provider,
    model: &str,
    messages: &[Value],
) -> AppResult<String> {
    // Extract system message and user/assistant messages
    let system = messages
        .first()
        .and_then(|m| m["content"].as_str())
        .unwrap_or("");

    let non_system: Vec<Value> = messages
        .iter()
        .filter(|m| m["role"].as_str() != Some("system"))
        .cloned()
        .collect();

    let payload = serde_json::json!({
        "model": model,
        "max_tokens": 20,
        "system": system,
        "messages": non_system,
        "temperature": 0.3,
    });

    let client = reqwest::Client::new();
    let mut request = client
        .post("https://api.anthropic.com/v1/messages")
        .header(CONTENT_TYPE, "application/json")
        .header("anthropic-version", "2023-06-01")
        .json(&payload);

    if let Some(key) = provider.api_key.as_deref().filter(|k| !k.trim().is_empty()) {
        request = request.header("x-api-key", key);
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("{status}: {body}")));
    }

    let body: Value = response.json().await?;
    let title = body["content"][0]["text"]
        .as_str()
        .unwrap_or("New Chat")
        .to_string();

    Ok(title)
}

const EXCALIDRAW_SYSTEM_PROMPT: &str = r##"You generate Excalidraw diagram elements as JSON. Output ONLY a valid JSON array of Excalidraw elements. No markdown, no explanation, no code fences.

Each element needs these fields:
- id: unique string (use short ids like "a1", "b2", etc)
- type: "rectangle" | "ellipse" | "diamond" | "text" | "arrow" | "line"
- x, y: position (number, start from 100,100, space elements 200px apart)
- width, height: size (rectangles: 200x80, text: auto based on content)
- strokeColor: "#1e1e1e"
- backgroundColor: "transparent" or color like "#a5d8ff", "#b2f2bb", "#ffd8a8", "#ffc9c9", "#d0bfff"
- fillStyle: "solid" for colored fills, "hachure" for sketch style
- strokeWidth: 2
- roughness: 1 (sketchy) or 0 (clean)
- opacity: 100
- angle: 0
- seed: random integer (1000-9999)
- version: 1
- versionNonce: random integer
- isDeleted: false
- groupIds: []
- boundElements: null or [{"id": "textId", "type": "text"}] for shapes with text inside
- updated: 1700000000000
- link: null
- locked: false
- frameId: null
- index: null

For TEXT elements, also include:
- fontSize: 20 (or 16 for smaller)
- fontFamily: 1
- text: "the text content"
- textAlign: "center"
- verticalAlign: "middle"
- containerId: "parentShapeId" (if inside a shape) or null
- originalText: same as text
- autoResize: true
- lineHeight: 1.25

For ARROW/LINE elements, also include:
- points: [[0,0],[200,0]] (relative points from x,y)
- startBinding: {"elementId": "sourceId", "focus": 0, "gap": 5, "fixedPoint": null} or null
- endBinding: {"elementId": "targetId", "focus": 0, "gap": 5, "fixedPoint": null} or null
- startArrowhead: null
- endArrowhead: "arrow" (for arrows) or null (for lines)
- lastCommittedPoint: null
- elbowed: false

RULES:
- Text inside shapes: create shape with boundElements:[{"id":"tId","type":"text"}] AND text with containerId:"shapeId"
- Space elements 200px+ apart
- Use arrows with startBinding/endBinding to connect shapes
- Output ONLY the JSON array"##;

/// Generate Excalidraw elements from a text prompt using the LLM.
pub async fn generate_excalidraw(
    db: &SqlitePool,
    prompt: &str,
    existing_elements: Option<&str>,
    provider_id: Option<&str>,
    model_id: Option<&str>,
) -> AppResult<String> {
    let provider = provider_service::get_provider_for_chat(db, provider_id).await?;
    let model = model_id.unwrap_or(&provider.model);

    let mut messages = vec![
        serde_json::json!({"role": "system", "content": EXCALIDRAW_SYSTEM_PROMPT}),
    ];

    // If there are existing elements, include them so AI can edit
    if let Some(elements) = existing_elements {
        messages.push(serde_json::json!({
            "role": "user",
            "content": format!("Here are the current canvas elements:\n{}\n\nIMPORTANT: When I ask you to modify something, return ALL elements (modified + unmodified). Keep all existing element IDs, positions, and properties unless I specifically ask to change them.", elements)
        }));
        messages.push(serde_json::json!({
            "role": "assistant",
            "content": "I understand. I'll return the complete set of elements, only modifying what you ask for while preserving everything else exactly as-is."
        }));
    }

    messages.push(serde_json::json!({"role": "user", "content": prompt}));

    let client = reqwest::Client::new();
    let endpoint = format!("{}/chat/completions", provider.base_url.trim_end_matches('/'));

    let payload = serde_json::json!({
        "model": model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 4000,
        "stream": false,
    });

    let mut request = client
        .post(&endpoint)
        .header(CONTENT_TYPE, "application/json")
        .json(&payload);

    if let Some(key) = provider.api_key.as_deref().filter(|k| !k.trim().is_empty()) {
        request = request.header(AUTHORIZATION, format!("Bearer {key}"));
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(AppError::Http(format!("{status}: {body}")));
    }

    let body: Value = response.json().await?;
    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("[]")
        .to_string();

    // Strip markdown code fences if AI added them
    let cleaned = content
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string();

    Ok(cleaned)
}
