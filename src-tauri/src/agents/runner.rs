use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;

use futures_util::stream::FuturesUnordered;
use futures_util::StreamExt;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE};
use serde::Serialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::ipc::Channel;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::agents::prompts::get_prompt;
use crate::error::{AppError, AppResult};
use crate::services::{now_rfc3339, provider_service};
use crate::state::PermissionState;
use crate::tools::{ToolCall, ToolExecutor, ToolName};

const MAX_REACT_ITERATIONS: usize = 10;
const SYNTHESIS_REACT_ITERATIONS: usize = 8;
const LANGUAGE_GUARD: &str =
    "IMPORTANT: Reply using the same language as the user's latest message. If user writes Indonesian, answer in Indonesian. Never switch to another language unless the user explicitly asks you to.";

/// Short hint appended when flux is enabled but user didn't ask for visuals (~50 tokens vs ~4500)
const PREVIEW_HINT: &str = "You can create interactive visualizations (charts, diagrams, widgets) by outputting a fenced code block with the language tag `html:preview`. The preview iframe has a full design system pre-loaded with CSS variables, SVG color ramp classes, and light/dark mode support. Use this when the user asks for any visual or interactive content.";

/// Keywords that trigger the full PREVIEW_GUIDE injection
const VISUAL_KEYWORDS: &[&str] = &[
    "chart", "diagram", "graph", "visuali", "svg", "plot", "widget",
    "mockup", "wireframe", "flowchart", "draw", "gambar", "buat grafik",
    "bikin chart", "bikin diagram", "buatkan", "tampilkan", "tabel",
    "html:preview", "interactive", "infographic", "dashboard", "canvas",
    "pie chart", "bar chart", "line chart", "perbandingan", "statistik",
];

const PREVIEW_GUIDE: &str = r#"INTERACTIVE PREVIEW — VISUAL CREATION SYSTEM

When the user asks for a visualization, diagram, chart, interactive demo, UI mockup, or any visual/interactive HTML content, output it directly in your response as a fenced code block with the language tag `html:preview`. Do NOT use write_file — the app renders it as a live interactive preview inline. Only use write_file when the user explicitly asks to save a file on disk.

Format: ```html:preview followed by a COMPLETE standalone HTML document (DOCTYPE, html, head, body).

The preview iframe has a full design system pre-loaded: CSS variables, SVG color ramp classes, pre-styled form elements, and light/dark mode support. Your HTML inherits all of this automatically.

## Core Design Philosophy
- **Seamless**: The widget should feel like a natural extension of the chat, not an embed from somewhere else.
- **Flat**: No gradients, mesh backgrounds, noise textures, drop shadows, blur, glow, or neon effects. Clean flat surfaces only.
- **Transparent background**: Do NOT set background color on `<body>` or outer containers. The host app provides the background. Only set background on inner cards/surfaces using `var(--color-background-secondary)`.
- **Compact**: Show the essential visual inline. All explanatory text goes in your response text OUTSIDE the code block.
- **Text goes in your response, visuals go in the widget** — All explanatory text, descriptions, introductions, and summaries must be written as normal response text OUTSIDE the code block. The widget should contain ONLY the visual element. Never put paragraphs of explanation inside the HTML.
- **Streaming-safe**: `<style>` (short, ≤15 lines) → content HTML → `<script>` last. Prefer inline `style="..."`.
- No comments. No emoji. No `display:none` sections. No tabs or carousels during streaming.

## Typography
- Two weights only: 400 regular, 500 bold. Never 600/700.
- h1=22px, h2=18px, h3=16px (all weight 500). Body=16px, weight 400, line-height 1.7.
- Min font-size: 11px. Sentence case always, never Title Case or ALL CAPS.
- Use `var(--font-sans)` (default), `var(--font-mono)` for code.
- No mid-sentence bolding. Entity names go in `code style` not **bold**.

## CSS Variables (pre-loaded, auto light/dark)
- Backgrounds: `var(--color-background-primary)` (white/page), `-secondary` (surfaces/cards), `-tertiary` (deeper)
- Text: `var(--color-text-primary)` (main), `-secondary` (muted), `-tertiary` (hints)
- Borders: `var(--color-border-tertiary)` (0.15α default), `-secondary` (0.3α hover), `-primary` (0.4α focus)
- Semantic: `-info`, `-danger`, `-success`, `-warning` for bg/text/border
- Radius: `var(--border-radius-md)` (8px), `-lg` (12px preferred for cards), `-xl` (16px)
- Never hardcode colors like `color: #333` — use CSS variables. They auto-adapt to light/dark.
- Never use `position: fixed` — the iframe sizes to content height, fixed elements collapse it.

## Color Palette (9 ramps, 7 stops each: 50=lightest → 900=darkest)
| Ramp | Class | 50 (fill) | 200 | 400 (accent) | 600 (stroke) | 800 (text) |
|------|-------|-----------|-----|-------------|-------------|-----------|
| Purple | c-purple | #EEEDFE | #AFA9EC | #7F77DD | #534AB7 | #3C3489 |
| Teal | c-teal | #E1F5EE | #5DCAA5 | #1D9E75 | #0F6E56 | #085041 |
| Coral | c-coral | #FAECE7 | #F0997B | #D85A30 | #993C1D | #712B13 |
| Blue | c-blue | #E6F1FB | #85B7EB | #378ADD | #185FA5 | #0C447C |
| Amber | c-amber | #FAEEDA | #EF9F27 | #BA7517 | #854F0B | #633806 |
| Green | c-green | #EAF3DE | #97C459 | #639922 | #3B6D11 | #27500A |
| Red | c-red | #FCEBEB | #F09595 | #E24B4A | #A32D2D | #791F1F |
| Gray | c-gray | #F1EFE8 | #B4B2A9 | #888780 | #5F5E5A | #444441 |
| Pink | c-pink | #FBEAF0 | #ED93B1 | #D4537E | #993556 | #72243E |

**Color assignment rules**:
- Color encodes **meaning**, not sequence. Don't cycle through colors like a rainbow.
- Group nodes by **category** — all nodes of the same type share one color.
- Use **gray for neutral/structural** nodes (start, end, generic steps).
- Use **≤2-3 ramps** per diagram. More = visual noise.
- Prefer purple, teal, coral, pink for general categories. Reserve blue/green/amber/red for semantic meaning (info/success/warning/error).
- Text on colored bg: use 800 or 900 stop from the same ramp, never black.
- When a box has title + subtitle, use different stops: title darker (800), subtitle lighter (600).

## SVG Diagrams
- `<svg width="100%" viewBox="0 0 680 H">` — always 680px wide. H = content bottom + 40px.
- **Do NOT change 680** — it matches container width for 1:1 pixel rendering. If content is narrow, keep viewBox at 680 and center content.
- Safe area: x=40..640, y=40..(H-40). Background transparent. No wrapper div.
- **Pre-loaded text classes**: `.t` (14px), `.ts` (12px secondary), `.th` (14px bold 500). Every `<text>` needs a class.
- **Pre-loaded shape classes**: `.box` (neutral fill), `.node` (clickable+hover), `.arr` (arrow line 1.5px), `.leader` (dashed 0.5px).
- **Color ramp classes**: `class="c-blue"` on `<g>` wrapping shape+text. Sets fill, stroke, text colors for both light/dark automatically. Apply to `<g>`, `<rect>`, `<circle>`, `<ellipse>` — NOT to `<path>`. Never write `<style>` blocks for colors.
- **c-{ramp} nesting**: These use direct-child selectors (`>`). Put `c-*` on the innermost group holding shapes, not a wrapper.
- Arrow marker (include in every SVG `<defs>`): `<marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>`
- Stroke-width: 0.5 for borders. rx=8 default. Connectors MUST have `fill="none"`.
- Size boxes to fit text: chars × 8px + 24px padding. 60px min spacing between boxes.
- Text: `text-anchor="middle" dominant-baseline="central"` for centered text in boxes.
- Make nodes clickable: `<g class="node c-blue" onclick="sendPrompt('Tell me more about X')">`.
- SVG `<text>` never auto-wraps. Each line needs explicit `<tspan x="..." dy="1.2em">`.
- No rotated text. No icons inside boxes (text only). Minimize standalone floating labels.
- Lines must not cross unrelated boxes. If direct path crosses something, use L-bend: `<path d="M x1 y1 L x1 ymid L x2 ymid L x2 y2" fill="none"/>`.

### Flowchart patterns:
Single-line node (44px): `<g class="node c-blue"><rect x="100" y="20" width="180" height="44" rx="8" stroke-width="0.5"/><text class="th" x="190" y="42" text-anchor="middle" dominant-baseline="central">Label</text></g>`
Two-line node (56px): title `.th` at y=38, subtitle `.ts` at y=56.
Connector: `<line x1="200" y1="76" x2="200" y2="120" class="arr" marker-end="url(#arrow)"/>`
Neutral node: use `class="box"` for auto-themed fill/stroke.

## Diagram Types — Pick the Right One

**Route on the verb, not the noun.** Same subject, different diagram depending on what was asked:

| User says | Type | What to draw |
|---|---|---|
| "how does X work" | **Illustrative** | Spatial metaphor showing the mechanism |
| "X architecture" | **Structural** | Labeled boxes showing containment |
| "what are the steps" | **Flowchart** | Sequential boxes and arrows |
| "explain X" | **Illustrative** | Visual metaphor that builds intuition |

### Flowchart
For sequential processes, cause-and-effect, decision trees. Prefer single-direction flows (top-down or left-right). Max 4-5 nodes per diagram. Keep all nodes same height for same content type.

### Structural diagram
For containment — things inside other things (VPC/subnet/instance, cell organelles, file systems). Large rounded rects as containers (rx=20, lightest fill), smaller rects inside as regions. 20px min padding inside containers. Max 2-3 nesting levels. Use different color ramps for nested levels.

### Illustrative diagram
For building **intuition**. The most powerful diagram type. Physical things get cross-sections. Abstract things get **spatial metaphors**: an LLM is stacked layers with attention threads, gradient descent is a ball rolling down a surface, a hash table is buckets with items falling in.

**Rules for illustrative diagrams**:
- Shapes are freeform: `<path>`, `<ellipse>`, `<circle>`, `<polygon>`, curved lines.
- Layout follows the subject's geometry, not a grid.
- Color encodes **intensity**: warm ramps = heat/energy/active, cool = cold/calm/dormant, gray = inert structure.
- Layering and overlap encouraged for shapes (but NEVER let strokes cross text — 8px clear air around labels).
- Small shape indicators allowed: triangles for flames, circles for bubbles, wavy lines for steam.
- One `<linearGradient>` per diagram permitted (only for continuous physical properties like temperature).
- Labels go outside the drawn object with thin leader lines. Pick one side for all labels.
- **Prefer interactive over static**: if the real system has a control, give the diagram that control (slider for temperature, toggle for on/off, click to highlight).

### Multiple diagrams for complex topics
For complex explanations, use **multiple `html:preview` blocks** — each with its own diagram. This creates a visual narrative:
- Always add **prose text between diagrams** explaining what the next one shows.
- Never stack multiple preview blocks back-to-back without text.
- Promise only what you deliver — if you say "three diagrams", include all three.

## Chart.js
- Wrap canvas: `<div style="position:relative;width:100%;height:300px"><canvas id="c"></canvas></div>`
- Height on wrapper ONLY, never on canvas. Options: `responsive:true, maintainAspectRatio:false`.
- For horizontal bar charts: wrapper height ≥ (num_bars × 40) + 80 pixels.
- Load UMD: `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" onload="initChart()"></script>`
- Define `function initChart() { new Chart(...) }` in inline script. Add `if(window.Chart) initChart();` as fallback.
- Canvas can't resolve CSS vars — use hardcoded hex from the color palette above.
- Always disable default legend: `plugins:{legend:{display:false}}`. Build custom HTML legend with small squares:
```html
<div style="display:flex;flex-wrap:wrap;gap:16px;margin-bottom:8px;font-size:12px;color:var(--color-text-secondary)">
  <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:#378ADD"></span>Chrome 65%</span>
</div>
```
- Include value/percentage in each legend label for categorical data (pie, donut, single-series bar).
- Negative values: `-$5M` not `$-5M`. Sign before currency symbol.
- Multiple charts: unique IDs (`chart1`, `chart2`), each with own canvas+div pair.
- For bubble/scatter: pad scale range ~10% beyond data range to prevent clipping.
- For ≤12 categories: `scales.x.ticks: { autoSkip: false, maxRotation: 45 }` to show all labels.

## Interactive Widgets
Form elements are pre-styled — write bare `<input>`, `<button>`, `<select>` tags. They look correct automatically.

### Slider pattern:
```html
<div style="display:flex;align-items:center;gap:12px;margin:0 0 1.5rem">
  <label style="font-size:14px;color:var(--color-text-secondary)">Years</label>
  <input type="range" min="1" max="40" value="20" id="years" style="flex:1" />
  <span style="font-size:14px;font-weight:500;min-width:24px" id="years-out">20</span>
</div>
```

### Result display:
```html
<div style="display:flex;align-items:baseline;gap:8px;margin:0 0 1.5rem">
  <span style="font-size:14px;color:var(--color-text-secondary)">£1,000 →</span>
  <span style="font-size:24px;font-weight:500" id="result">£3,870</span>
</div>
```

- **Round every displayed number** — JS float math leaks artifacts. Use `Math.round()`, `.toFixed(n)`, or `Intl.NumberFormat`. Set `step="1"` on range sliders.
- Use `sendPrompt(text)` for follow-up actions that benefit from AI thinking.
- CDN allowlist: cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com, esm.sh only.

## UI Components

### Metric cards
For summary numbers (revenue, count, percentage). Use pre-loaded classes:
```html
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
  <div class="metric-card">
    <div class="metric-label">Revenue</div>
    <div class="metric-value">$1.2M</div>
    <div class="metric-change up">↑ 12%</div>
  </div>
</div>
```

### Data record card
Wrap in a single raised card for bounded UI objects (contact card, receipt, order):
```html
<div style="background:var(--color-background-primary);border-radius:var(--border-radius-lg);border:0.5px solid var(--color-border-tertiary);padding:1rem 1.25rem">
  <!-- content -->
</div>
```

### Comparison grid
Side-by-side cards for options. Use `repeat(auto-fit, minmax(160px, 1fr))`. Highlight recommended option with `border: 2px solid var(--color-border-info)` and a small badge.

### Mockup presentation
Contained mockups (mobile screens, chat threads, modals) should sit on a background surface. Full-width mockups (dashboards, settings pages) don't need a wrapper.

## Art and Illustration
For creative requests ("draw me a sunset", "create a geometric pattern"):
- Fill the canvas — art should feel rich, not sparse.
- Bold colors: mix color ramps freely. Custom `<style>` color blocks are fine for art.
- Layer overlapping opaque shapes for depth.
- Organic forms with `<path>` curves, `<ellipse>`, `<circle>`.
- Texture via repetition (parallel lines, dots, hatching) not raster effects.
- Geometric patterns with `<g transform="rotate()">` for radial symmetry.
- CSS `@keyframes` animations permitted (only `transform` and `opacity`). Wrap in `@media (prefers-reduced-motion: no-preference)`."#;

/// Parameters for running an agent
pub struct AgentRunParams<'a> {
    pub session_id: &'a str,
    pub agent_type: &'a str,
    pub task: &'a str,
    pub project_path: &'a str,
    pub provider_id: Option<&'a str>,
    pub model_id: Option<&'a str>,
    pub flux_enabled: bool,
}

/// Internal execution context to reduce parameter count
#[derive(Clone)]
pub struct AgentRunner {
    pub db: SqlitePool,
    pub app_handle: AppHandle,
    pub permissions: PermissionState,
    pub cancel_token: CancellationToken,
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

/// Internal execution context for agent runs
struct InternalRunContext<'a> {
    session_id: &'a str,
    agent_type: &'a str,
    task: &'a str,
    project_path: &'a str,
    provider_id: Option<&'a str>,
    model_id: Option<&'a str>,
    parent_agent_run_id: Option<&'a str>,
    flux_enabled: bool,
}

impl<'a> InternalRunContext<'a> {
    #[allow(clippy::too_many_arguments)]
    fn new(
        session_id: &'a str,
        agent_type: &'a str,
        task: &'a str,
        project_path: &'a str,
        provider_id: Option<&'a str>,
        model_id: Option<&'a str>,
        parent_agent_run_id: Option<&'a str>,
        flux_enabled: bool,
    ) -> Self {
        Self {
            session_id,
            agent_type,
            task,
            project_path,
            provider_id,
            model_id,
            parent_agent_run_id,
            flux_enabled,
        }
    }
}

/// Parameters for running a subagent
struct SubagentParams {
    session_id: String,
    agent_type: String,
    task: String,
    project_path: String,
    provider_id: Option<String>,
    model_id: Option<String>,
    parent_agent_run_id: String,
    flux_enabled: bool,
}

impl AgentRunner {
    pub fn new(db: SqlitePool, app_handle: AppHandle, permissions: PermissionState, cancel_token: CancellationToken) -> Self {
        Self { db, app_handle, permissions, cancel_token }
    }

    pub async fn run(
        &self,
        params: AgentRunParams<'_>,
        on_token: Channel<String>,
    ) -> AppResult<String> {
        let token_sink = ChannelTokenSink { channel: on_token };
        let ctx = InternalRunContext::new(
            params.session_id,
            params.agent_type,
            params.task,
            params.project_path,
            params.provider_id,
            params.model_id,
            None,
            params.flux_enabled,
        );

        self.run_internal(&ctx, &token_sink).await
    }

    async fn run_subagent_internal(&self, params: SubagentParams) -> AppResult<String> {
        let token_sink = NoopTokenSink;
        let ctx = InternalRunContext::new(
            &params.session_id,
            &params.agent_type,
            &params.task,
            &params.project_path,
            params.provider_id.as_deref(),
            params.model_id.as_deref(),
            Some(&params.parent_agent_run_id),
            params.flux_enabled,
        );
        self.run_internal(&ctx, &token_sink).await
    }

    async fn run_internal<S: TokenSink + Sync>(
        &self,
        ctx: &InternalRunContext<'_>,
        token_sink: &S,
    ) -> AppResult<String> {
        if ctx.parent_agent_run_id.is_none() {
            let message_id = Uuid::new_v4().to_string();
            let created_at = now_rfc3339();
            sqlx::query(
                "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            )
            .bind(&message_id)
            .bind(ctx.session_id)
            .bind("user")
            .bind(ctx.task)
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
        .bind(ctx.session_id)
        .bind(ctx.agent_type)
        .bind("running")
        .bind(ctx.task)
        .bind(&started_at)
        .bind(&started_at)
        .bind(ctx.parent_agent_run_id)
        .bind(ctx.project_path)
        .execute(&self.db)
        .await?;

        let _ = self.app_handle.emit(
            "agent-started",
            AgentStartedEvent {
                agent_run_id: agent_run_id.clone(),
                agent_type: ctx.agent_type.to_string(),
                parent_agent_run_id: ctx.parent_agent_run_id.map(std::string::ToString::to_string),
            },
        );

        let result = self
            .execute_agent(
                &agent_run_id,
                ctx,
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

    /// Load conversation history from DB with smart context management:
    /// - Sliding window: max 20 recent message pairs
    /// - Strip html:preview blocks from assistant outputs (saves ~5-10KB per widget)
    /// - Token budget: ~8K tokens max for history (~32K chars)
    /// - Smarter truncation: user messages 500 chars, assistant 1500 chars
    async fn load_conversation_history(
        &self,
        session_id: &str,
    ) -> AppResult<Vec<ConversationMessage>> {
        const MAX_HISTORY_PAIRS: usize = 20;
        const MAX_TOTAL_CHARS: usize = 32_000; // ~8K tokens
        const MAX_USER_MSG_CHARS: usize = 500;
        const MAX_ASSISTANT_MSG_CHARS: usize = 1500;

        // Load user messages
        let user_messages = sqlx::query_as::<_, crate::models::Message>(
            "SELECT id, session_id, role, content, created_at FROM messages \
             WHERE session_id = ?1 ORDER BY created_at ASC",
        )
        .bind(session_id)
        .fetch_all(&self.db)
        .await?;

        // Load completed top-level agent runs (not subagents)
        let agent_runs = sqlx::query_as::<_, crate::models::AgentRun>(
            "SELECT id, session_id, agent_type, status, input, output, error, started_at, completed_at, created_at, parent_agent_run_id, project_path \
             FROM agent_runs \
             WHERE session_id = ?1 AND parent_agent_run_id IS NULL AND status = 'completed' AND output IS NOT NULL \
             ORDER BY created_at ASC",
        )
        .bind(session_id)
        .fetch_all(&self.db)
        .await?;

        // Interleave chronologically
        let mut history: Vec<(String, String, String)> = Vec::new();

        for msg in &user_messages {
            history.push((msg.created_at.clone(), msg.role.clone(), msg.content.clone()));
        }

        for run in &agent_runs {
            if let Some(output) = &run.output {
                let created = run.completed_at.as_deref().unwrap_or(&run.created_at);
                history.push((created.to_string(), "assistant".to_string(), output.clone()));
            }
        }

        history.sort_by(|a, b| a.0.cmp(&b.0));

        // Sliding window: take only the most recent N pairs
        let window_start = if history.len() > MAX_HISTORY_PAIRS * 2 {
            history.len() - MAX_HISTORY_PAIRS * 2
        } else {
            0
        };
        let windowed = &history[window_start..];

        // Convert to ConversationMessages with smart truncation + token budget
        let mut conversation: Vec<ConversationMessage> = Vec::new();
        let mut total_chars: usize = 0;

        for (_, role, content) in windowed {
            if total_chars >= MAX_TOTAL_CHARS {
                break;
            }

            let cleaned = if role == "assistant" {
                // Strip html:preview code blocks — they're huge and not useful for context
                strip_preview_blocks(content)
            } else {
                content.clone()
            };

            let max_len = if role == "user" {
                MAX_USER_MSG_CHARS
            } else {
                MAX_ASSISTANT_MSG_CHARS
            };

            let truncated = if cleaned.len() > max_len {
                // Truncate at word boundary
                let cut = &cleaned[..max_len];
                let last_space = cut.rfind(' ').unwrap_or(max_len);
                format!("{}… [truncated]", &cleaned[..last_space])
            } else {
                cleaned
            };

            total_chars += truncated.len();

            if role == "user" {
                conversation.push(ConversationMessage::user(&truncated));
            } else {
                conversation.push(ConversationMessage::assistant(truncated, Vec::new()));
            }
        }

        Ok(conversation)
    }

    async fn execute_agent<S: TokenSink + Sync>(
        &self,
        agent_run_id: &str,
        ctx: &InternalRunContext<'_>,
        token_sink: &S,
    ) -> AppResult<String> {
        let system_prompt = get_prompt(ctx.agent_type).ok_or_else(|| {
            AppError::Validation(format!("Unknown agent type for prompt lookup: {}", ctx.agent_type))
        })?;

        let provider = provider_service::get_provider_for_chat(&self.db, ctx.provider_id).await?;

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

        let model = ctx.model_id.unwrap_or(&provider.model);
        let tool_executor = ToolExecutor::new(PathBuf::from(ctx.project_path));

        // Solusi 1: Lazy PREVIEW_GUIDE — only inject full guide when user asks for visuals
        let system_content = if ctx.flux_enabled {
            if needs_full_preview_guide(ctx.task) {
                format!("{}\n\n{}\n\n{}", system_prompt, LANGUAGE_GUARD, PREVIEW_GUIDE)
            } else {
                // Mini hint only (~50 tokens vs ~4500)
                format!("{}\n\n{}\n\n{}", system_prompt, LANGUAGE_GUARD, PREVIEW_HINT)
            }
        } else {
            format!("{}\n\n{}", system_prompt, LANGUAGE_GUARD)
        };

        // Load conversation history for context
        let history = self.load_conversation_history(ctx.session_id).await?;

        // Build messages: system + history (excluding last user msg) + current task
        let mut messages = vec![ConversationMessage::system(&system_content)];

        // Add history but skip the last user message (it's the current task we're about to add)
        if history.len() > 1 {
            let history_without_last = &history[..history.len() - 1];
            messages.extend_from_slice(history_without_last);
        }

        messages.push(ConversationMessage::user(ctx.task));

        let mut output = self
            .run_react_loop(
                &provider,
                model,
                agent_run_id,
                ctx.agent_type,
                ctx.project_path,
                &tool_executor,
                &mut messages,
                MAX_REACT_ITERATIONS,
                token_sink,
            )
            .await?;

        if matches!(ctx.agent_type, "orchestrator" | "planner") {
            let subagent_tasks = parse_subagent_tasks(&output);
            if !subagent_tasks.is_empty() {
                let parent_id = agent_run_id.to_string();
                let provider_id_owned = ctx.provider_id.map(std::string::ToString::to_string);
                let model_id_owned = ctx.model_id.map(std::string::ToString::to_string);
                
                let mut futures = FuturesUnordered::new();

                for subagent in subagent_tasks {
                    let session_id_owned = ctx.session_id.to_string();
                    let project_path_owned = ctx.project_path.to_string();
                    let parent_id_owned = parent_id.clone();
                    let provider_id_owned = provider_id_owned.clone();
                    let model_id_owned = model_id_owned.clone();
                    let agent_type_owned = subagent.agent_type.clone();
                    let task_owned = subagent.task.clone();

                    let future = async move {
                        let params = SubagentParams {
                            session_id: session_id_owned,
                            agent_type: agent_type_owned.clone(),
                            task: task_owned.clone(),
                            project_path: project_path_owned,
                            provider_id: provider_id_owned,
                            model_id: model_id_owned,
                            parent_agent_run_id: parent_id_owned,
                            flux_enabled: ctx.flux_enabled,
                        };
                        let result = self.run_subagent_internal(params).await;

                        (agent_type_owned, task_owned, result)
                    };
                    
                    futures.push(future);
                }

                let mut reports = Vec::new();
                while let Some((sub_type, sub_task, result)) = futures.next().await {
                    match result {
                        Ok(sub_output) => {
                            reports.push(format!(
                                "subagent={sub_type}\ntask={sub_task}\nresult:\n{sub_output}"
                            ));
                        }
                        Err(error) => {
                            reports.push(format!(
                                "subagent={sub_type}\ntask={sub_task}\nerror:\n{}",
                                error
                            ));
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
                            ctx.agent_type,
                            ctx.project_path,
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

    #[allow(dead_code)]
    async fn execute_agent_leaf<S: TokenSink + Sync>(
        &self,
        agent_run_id: &str,
        ctx: &InternalRunContext<'_>,
        token_sink: &S,
    ) -> AppResult<String> {
        let system_prompt = get_prompt(ctx.agent_type).ok_or_else(|| {
            AppError::Validation(format!("Unknown agent type for prompt lookup: {}", ctx.agent_type))
        })?;

        let provider = provider_service::get_provider_for_chat(&self.db, ctx.provider_id).await?;
        let model = ctx.model_id.unwrap_or(&provider.model);
        let tool_executor = ToolExecutor::new(PathBuf::from(ctx.project_path));

        let system_content = if ctx.flux_enabled {
            if needs_full_preview_guide(ctx.task) {
                format!("{}\n\n{}\n\n{}", system_prompt, LANGUAGE_GUARD, PREVIEW_GUIDE)
            } else {
                format!("{}\n\n{}\n\n{}", system_prompt, LANGUAGE_GUARD, PREVIEW_HINT)
            }
        } else {
            format!("{}\n\n{}", system_prompt, LANGUAGE_GUARD)
        };

        // Load conversation history for context
        let history = self.load_conversation_history(ctx.session_id).await?;

        let mut messages = vec![ConversationMessage::system(&system_content)];
        if history.len() > 1 {
            let history_without_last = &history[..history.len() - 1];
            messages.extend_from_slice(history_without_last);
        }
        messages.push(ConversationMessage::user(ctx.task));

        self.run_react_loop(
            &provider,
            model,
            agent_run_id,
            ctx.agent_type,
            ctx.project_path,
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
            // Check cancellation before each iteration
            if self.cancel_token.is_cancelled() {
                return Err(AppError::Cancelled);
            }

            let turn = if provider.uses_anthropic_format() {
                self.send_anthropic_with_tools(
                    &provider.base_url,
                    &provider.api_key,
                    &provider.provider_type,
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
                // Check cancellation before each tool execution
                if self.cancel_token.is_cancelled() {
                    return Err(AppError::Cancelled);
                }

                let execution = self
                    .execute_tool_call(
                        agent_run_id,
                        agent_type,
                        project_path,
                        tool_executor,
                        &tool_call,
                    )
                    .await?;

                // Solusi 3: Truncate large tool results to reduce token accumulation
                let truncated_output = truncate_tool_result(&execution.output);

                messages.push(ConversationMessage::tool(
                    &tool_call.id,
                    &truncated_output,
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
        _project_path: &str,
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

        // Check if permission is needed and wait for approval
        let permission_rx = self.emit_permission_request_if_needed(
            agent_run_id,
            agent_type,
            executor,
            tool_call,
        );

        if let Some(rx) = permission_rx {
            // Wait for permission with 60 second timeout
            match tokio::time::timeout(Duration::from_secs(60), rx).await {
                Ok(Ok(true)) => {
                    // Permission granted, continue
                }
                Ok(Ok(false)) => {
                    // Permission denied
                    let error_msg = "Permission denied by user";
                    sqlx::query(
                        "UPDATE tool_calls SET status = ?1, output = ?2, error = ?3, completed_at = ?4 WHERE id = ?5",
                    )
                    .bind("failed")
                    .bind(error_msg)
                    .bind(error_msg)
                    .bind(now_rfc3339())
                    .bind(tool_call_id)
                    .execute(&self.db)
                    .await?;

                    return Ok(ToolExecutionOutcome {
                        output: error_msg.to_string(),
                        is_error: true,
                    });
                }
                Ok(Err(_)) => {
                    // Channel closed
                    let error_msg = "Permission request cancelled";
                    sqlx::query(
                        "UPDATE tool_calls SET status = ?1, output = ?2, error = ?3, completed_at = ?4 WHERE id = ?5",
                    )
                    .bind("failed")
                    .bind(error_msg)
                    .bind(error_msg)
                    .bind(now_rfc3339())
                    .bind(tool_call_id)
                    .execute(&self.db)
                    .await?;

                    return Ok(ToolExecutionOutcome {
                        output: error_msg.to_string(),
                        is_error: true,
                    });
                }
                Err(_) => {
                    // Timeout
                    let error_msg = "Permission request timed out after 60 seconds";
                    sqlx::query(
                        "UPDATE tool_calls SET status = ?1, output = ?2, error = ?3, completed_at = ?4 WHERE id = ?5",
                    )
                    .bind("failed")
                    .bind(error_msg)
                    .bind(error_msg)
                    .bind(now_rfc3339())
                    .bind(tool_call_id)
                    .execute(&self.db)
                    .await?;

                    return Ok(ToolExecutionOutcome {
                        output: error_msg.to_string(),
                        is_error: true,
                    });
                }
            }
        }

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
        executor: &ToolExecutor,
        tool_call: &ParsedToolCall,
    ) -> Option<oneshot::Receiver<bool>> {
        let path = tool_call
            .input
            .get("path")
            .and_then(Value::as_str)
            .map(std::string::ToString::to_string)?;

        if executor.requires_permission(&path) {
            let display_path = if PathBuf::from(&path).is_absolute() {
                path.clone()
            } else {
                executor.sandbox.join(&path).to_string_lossy().to_string()
            };
            
            let rx = self.permissions.register(agent_run_id.to_string());
            
            let _ = self.app_handle.emit(
                "agent-permission-request",
                AgentPermissionRequestEvent {
                    agent_run_id: agent_run_id.to_string(),
                    permission_type: "sensitive_file".to_string(),
                    path: display_path,
                    agent_type: agent_type.to_string(),
                },
            );
            return Some(rx);
        }

        if executor.is_outside_sandbox(&path) {
            let display_path = if PathBuf::from(&path).is_absolute() {
                path
            } else {
                executor.sandbox.join(path).to_string_lossy().to_string()
            };
            
            let rx = self.permissions.register(agent_run_id.to_string());
            
            let _ = self.app_handle.emit(
                "agent-permission-request",
                AgentPermissionRequestEvent {
                    agent_run_id: agent_run_id.to_string(),
                    permission_type: "outside_sandbox".to_string(),
                    path: display_path,
                    agent_type: agent_type.to_string(),
                },
            );
            return Some(rx);
        }
        
        None
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

    #[allow(clippy::too_many_arguments)]
    async fn send_anthropic_with_tools<S: TokenSink + Sync>(
        &self,
        base_url: &str,
        api_key: &Option<String>,
        provider_type: &str,
        model: &str,
        messages: &[ConversationMessage],
        agent_run_id: &str,
        token_sink: &S,
    ) -> AppResult<LLMTurn> {
        let (system, mut anthropic_messages) = to_anthropic_messages(messages)?;

        // Prompt caching: mark last user message with cache_control (like Claude Desktop)
        if let Some(last_msg) = anthropic_messages.last_mut() {
            if last_msg.get("role").and_then(Value::as_str) == Some("user") {
                if let Some(content) = last_msg.get_mut("content").and_then(Value::as_array_mut) {
                    if let Some(last_block) = content.last_mut() {
                        last_block["cache_control"] = json!({"type": "ephemeral"});
                    }
                }
            }
        }

        // Prompt caching: tools cached
        let tools_with_cache = {
            let mut tools = anthropic_tool_definitions();
            if let Some(last_tool) = tools.last_mut() {
                last_tool["cache_control"] = json!({"type": "ephemeral"});
            }
            tools
        };

        let mut payload = json!({
            "model": model,
            "max_tokens": 8096,
            "messages": anthropic_messages,
            "tools": tools_with_cache,
            "stream": true,
        });

        // System prompt as cached content block array
        if let Some(system_prompt) = system {
            payload["system"] = json!([
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"}
                }
            ]);
        }

        // Resolve endpoint: same logic as chat_service::send_anthropic
        let endpoint = if provider_type == "anthropic" {
            "https://api.anthropic.com/v1/messages".to_string()
        } else if provider_type == "enowxlabs" {
            format!("{}/messages", base_url.trim_end_matches('/').trim_end_matches("/v1"))
        } else {
            // Custom gateway: preserve full base_url path (e.g. /v1/messages)
            format!("{}/messages", base_url.trim_end_matches('/'))
        };

        let client = reqwest::Client::new();
        let mut request = client
            .post(&endpoint)
            .header(CONTENT_TYPE, "application/json")
            .header("anthropic-version", "2023-06-01")
            .header("anthropic-beta", "prompt-caching-2024-07-31");

        // Auth: x-api-key for Anthropic direct, Bearer for gateways
        if let Some(key) = api_key.as_deref().filter(|k| !k.trim().is_empty()) {
            if provider_type == "anthropic" {
                request = request.header("x-api-key", key);
            } else {
                request = request.header(AUTHORIZATION, format!("Bearer {key}"));
            }
        }

        let response = request.json(&payload).send().await?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::Http(format!("Anthropic {status}: {body}")));
        }

        let turn = self
            .stream_anthropic_tool_sse(response, agent_run_id, token_sink)
            .await?;

        // Fallback: some gateways return message_start → message_stop without
        // any content_block events when streaming certain models.  When that
        // happens, retry the request with `stream: false` and parse the full
        // response synchronously.
        if turn.text.is_empty() && turn.tool_calls.is_empty() {
            log::warn!("anthropic stream returned empty — retrying non-streaming");
            payload["stream"] = json!(false);

            let mut retry_req = client
                .post(&endpoint)
                .header(CONTENT_TYPE, "application/json")
                .header("anthropic-version", "2023-06-01")
                .json(&payload);

            if let Some(key) = api_key.as_deref().filter(|k| !k.trim().is_empty()) {
                if provider_type == "anthropic" {
                    retry_req = retry_req.header("x-api-key", key);
                } else {
                    retry_req = retry_req.header(AUTHORIZATION, format!("Bearer {key}"));
                }
            }

            let retry_resp = retry_req.send().await?;
            if !retry_resp.status().is_success() {
                let status = retry_resp.status();
                let body = retry_resp.text().await.unwrap_or_default();
                return Err(AppError::Http(format!("Anthropic non-stream {status}: {body}")));
            }

            let body: Value = retry_resp.json().await?;
            return parse_anthropic_non_stream_response(&body, agent_run_id, token_sink, &self.app_handle);
        }

        Ok(turn)
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
        // Track the most recent `event:` line so we can fall back to it when
        // the JSON payload omits the top-level `"type"` field (some gateways).
        let mut current_event = String::new();

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
                    &mut current_event,
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
        current_event: &mut String,
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
            let event_name = event_name.trim();
            *current_event = event_name.to_string();
            if event_name == "message_stop" {
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

        // Prefer `"type"` from JSON payload; fall back to the preceding
        // `event:` line when the gateway strips it.
        let event_type = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or(current_event.as_str());

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

/// Parse a non-streaming Anthropic Messages API response into an `LLMTurn`.
///
/// Used as a fallback when the gateway returns an empty stream (some proxies
/// don't support streaming for certain models).
fn parse_anthropic_non_stream_response<S: TokenSink + Sync>(
    body: &Value,
    agent_run_id: &str,
    token_sink: &S,
    app_handle: &tauri::AppHandle,
) -> AppResult<LLMTurn> {
    let mut text = String::new();
    let mut tool_calls = Vec::new();

    if let Some(content) = body.get("content").and_then(Value::as_array) {
        for block in content {
            let block_type = block.get("type").and_then(Value::as_str).unwrap_or("");
            match block_type {
                "text" => {
                    if let Some(t) = block.get("text").and_then(Value::as_str) {
                        text.push_str(t);
                        // Send tokens to UI so the user sees the response
                        token_sink.send(t);
                        let _ = app_handle.emit(
                            "agent-token",
                            AgentTokenEvent {
                                agent_run_id: agent_run_id.to_string(),
                                token: t.to_string(),
                            },
                        );
                    }
                }
                "tool_use" => {
                    let id = block.get("id").and_then(Value::as_str).unwrap_or("").to_string();
                    let name = block.get("name").and_then(Value::as_str).unwrap_or("").to_string();
                    let input = block.get("input").cloned().unwrap_or(Value::Object(Default::default()));
                    tool_calls.push(ParsedToolCall { id, name, input });
                }
                _ => {}
            }
        }
    }

    Ok(LLMTurn { text, tool_calls })
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

/// Compress ```html:preview code blocks in conversation history.
/// Instead of sending the full 5-10KB HTML, extract a compact text summary
/// that preserves the widget's content/data so the AI can make targeted edits.
fn strip_preview_blocks(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut in_preview = false;
    let mut preview_content = String::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if !in_preview
            && trimmed.starts_with("```")
            && (trimmed.contains("html:preview")
                || trimmed.contains("html:artifact")
                || trimmed.contains("html:viz")
                || trimmed.contains("html:render"))
        {
            in_preview = true;
            preview_content.clear();
            continue;
        }
        if in_preview {
            if trimmed == "```" {
                in_preview = false;
                // Extract a compact summary from the HTML
                let summary = summarize_html_widget(&preview_content);
                result.push_str(&format!("[enowX Flux widget: {}]\n", summary));
            } else {
                preview_content.push_str(line);
                preview_content.push('\n');
            }
            continue;
        }
        result.push_str(line);
        result.push('\n');
    }

    result.trim().to_string()
}

/// Extract a compact text summary from HTML widget content.
/// Keeps: text content, data values, labels, chart config hints.
/// Removes: HTML tags, CSS, boilerplate.
fn summarize_html_widget(html: &str) -> String {
    let mut summary = String::new();

    // Extract title if present
    if let Some(cap) = regex::Regex::new(r"<title>([^<]+)</title>")
        .ok()
        .and_then(|re| re.captures(html))
    {
        summary.push_str(&format!("title: {}. ", &cap[1]));
    }

    // Extract visible text from key elements (h1-h3, labels, spans with data)
    let text_re = regex::Regex::new(
        r"<(?:h[1-3]|label|th|td)[^>]*>([^<]{1,100})<"
    ).ok();
    if let Some(re) = text_re {
        let mut texts: Vec<&str> = Vec::new();
        for cap in re.captures_iter(html) {
            let t = cap.get(1).map_or("", |m| m.as_str()).trim();
            if !t.is_empty() && !texts.contains(&t) {
                texts.push(t);
            }
        }
        if !texts.is_empty() {
            summary.push_str(&format!("content: {}. ", texts.join(", ")));
        }
    }

    // Extract Chart.js datasets info
    if html.contains("Chart(") || html.contains("chart.js") || html.contains("Chart.js") {
        // Try to find labels and dataset labels
        let labels_re = regex::Regex::new(r"labels:\s*\[([^\]]{1,300})\]").ok();
        let dataset_re = regex::Regex::new(r#"label:\s*['"]([^'"]{1,50})['"]"#).ok();
        let data_re = regex::Regex::new(r"data:\s*\[([^\]]{1,300})\]").ok();
        let bg_re = regex::Regex::new(r#"backgroundColor:\s*['"]([^'"]{1,30})['"]"#).ok();

        if let Some(re) = labels_re {
            if let Some(cap) = re.captures(html) {
                summary.push_str(&format!("chart labels: [{}]. ", &cap[1]));
            }
        }
        if let Some(re) = dataset_re {
            let names: Vec<&str> = re.captures_iter(html).filter_map(|c| c.get(1).map(|m| m.as_str())).collect();
            if !names.is_empty() {
                summary.push_str(&format!("datasets: {}. ", names.join(", ")));
            }
        }
        if let Some(re) = data_re {
            for (i, cap) in re.captures_iter(html).enumerate() {
                if i < 3 {
                    summary.push_str(&format!("data[{}]: [{}]. ", i, &cap[1]));
                }
            }
        }
        if let Some(re) = bg_re {
            let colors: Vec<&str> = re.captures_iter(html).filter_map(|c| c.get(1).map(|m| m.as_str())).collect();
            if !colors.is_empty() {
                summary.push_str(&format!("colors: {}. ", colors.join(", ")));
            }
        }
    }

    // Extract metric card values
    let metric_re = regex::Regex::new(r"metric-value[^>]*>([^<]{1,50})<").ok();
    if let Some(re) = metric_re {
        let vals: Vec<&str> = re.captures_iter(html).filter_map(|c| c.get(1).map(|m| m.as_str().trim())).collect();
        if !vals.is_empty() {
            summary.push_str(&format!("metrics: {}. ", vals.join(", ")));
        }
    }

    if summary.is_empty() {
        // Fallback: extract all visible text (strip tags)
        let stripped = regex::Regex::new(r"<[^>]+>")
            .ok()
            .map(|re| re.replace_all(html, " ").to_string())
            .unwrap_or_default();
        let clean: String = stripped.split_whitespace().take(50).collect::<Vec<&str>>().join(" ");
        if !clean.is_empty() {
            summary.push_str(&clean);
        } else {
            summary.push_str("interactive visual widget");
        }
    }

    // Cap summary length
    if summary.len() > 500 {
        summary.truncate(500);
        summary.push('…');
    }

    summary
}

/// Truncate tool results to prevent token bloat in ReAct loop.
/// File contents and large outputs are capped; short results pass through unchanged.
const MAX_TOOL_RESULT_CHARS: usize = 3000;

fn truncate_tool_result(output: &str) -> String {
    if output.len() <= MAX_TOOL_RESULT_CHARS {
        return output.to_string();
    }

    // Keep first and last portions for context
    let head_size = MAX_TOOL_RESULT_CHARS * 2 / 3; // ~2000 chars from start
    let tail_size = MAX_TOOL_RESULT_CHARS / 3;      // ~1000 chars from end

    let head = &output[..head_size];
    let tail = &output[output.len() - tail_size..];
    let omitted = output.len() - head_size - tail_size;

    format!(
        "{}\n\n… [{} chars omitted] …\n\n{}",
        head, omitted, tail
    )
}

/// Check if the user's message contains keywords that need the full PREVIEW_GUIDE
fn needs_full_preview_guide(task: &str) -> bool {
    let lower = task.to_lowercase();
    VISUAL_KEYWORDS.iter().any(|kw| lower.contains(kw))
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
            "system" if system.is_none() => {
                system = Some(message.content.clone());
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
