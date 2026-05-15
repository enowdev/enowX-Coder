# Changelog

All notable changes to enowX Coder are documented here.

---

## [0.2.6] — 2026-04-25

### Token Optimization — 99% Reduction for Anthropic-format Gateways
- **Prompt caching now works for custom providers**: Added `api_format` field (`openai` | `anthropic`) to providers — custom gateways using Anthropic Messages API now get prompt caching, reducing prompt tokens from ~11,700 to ~0 on cache hits
- **Chat history sliding window**: Chat path now applies the same context trimming as agent path — max 20 message pairs, 32K char budget, per-message truncation, `html:preview` blocks stripped. Prevents token bloat on long sessions
- **`uses_anthropic_format()` method**: Centralized routing logic replaces scattered `provider_type == "anthropic" || provider_type == "enowxlabs"` checks across chat service and agent runner

### Gateway SSE Compatibility Fix
- **Event-line fallback for SSE parsing**: Some Anthropic-compatible gateways omit the `"type"` field from SSE data payloads. Parser now tracks the preceding `event:` line and uses it as fallback — fixes empty responses from proxies like LiteLLM, Claude Desktop gateway, and enowX Labs gateway
- Applied to both chat SSE parser (`chat_service.rs`) and agent tool SSE parser (`runner.rs`)

### Non-Streaming Fallback for Unsupported Models
- **Auto-retry without streaming**: When a gateway returns an empty stream (message_start → message_stop with no content blocks), the request is automatically retried with `stream: false` and the full response is parsed synchronously
- Fixes blank responses for models where the gateway doesn't support streaming (e.g. `claude-opus-4.6` on certain proxies)
- Applied to both chat path and agent path (with tool call support)

### Endpoint Resolution Fix for Custom Gateways
- **Preserve `/v1` path for custom providers**: Previously, all non-Anthropic providers had `/v1` stripped from their base URL when building the Anthropic endpoint, resulting in `host/messages` instead of `host/v1/messages`. Now only the built-in `enowxlabs` provider strips `/v1`; custom gateways keep their full path
- Fixed in chat service, title generation, and agent runner

### Model Listing for Custom Providers
- **Custom providers can now list models**: Previously, unknown `provider_type` slugs (e.g. user-created `"my-gateway"`) returned "Unknown provider type" error. Now routes by `api_format` — Anthropic-format providers hit `{base_url}/models` with correct auth headers
- `fetch_anthropic_models` now accepts a configurable base URL and auth scheme instead of hardcoding `api.anthropic.com`

### Provider Settings UI
- **API Format selector**: New toggle (OpenAI / Anthropic) in Settings for custom providers — choose Anthropic for Claude-compatible gateways to enable prompt caching and correct message serialization
- Selector shown in both "Add Provider" form and existing provider detail panel
- Built-in providers (`enowxlabs`, `anthropic`) auto-set to Anthropic format

### Database
- **Migration `20260424000_provider_api_format.sql`**: Adds `api_format TEXT NOT NULL DEFAULT 'openai'` column to providers table. Existing `anthropic` and `enowxlabs` providers auto-updated to `'anthropic'` format

---

## [0.2.5] — 2026-04-23

### Excalidraw Canvas — Collaborative Whiteboard
- **New feature**: Full Excalidraw whiteboard integrated as a Canvas tab — switch between Chat and Canvas via segmented control in header
- Drawings persist per project in SQLite — auto-save every 1 second, auto-load on project switch
- Dark/light theme syncs with app theme toggle
- Full Excalidraw toolbar: shapes, arrows, text, freehand, colors, layers, export to disk

### AI Canvas — Generate Diagrams with AI
- **New feature**: AI prompt bar floating at bottom of canvas — describe what to draw, AI generates Excalidraw elements
- AI generates native Excalidraw JSON (rectangles, ellipses, diamonds, text, arrows with bindings)
- **Context-aware editing**: Existing canvas elements are sent to AI as context — ask "change color of 2021 to yellow" and AI modifies only that element while preserving everything else
- Provider and model selector in canvas prompt bar (shared with chat)
- Merge behavior: AI returns full element set for edits, appends for new drawings

### Conversation Memory — Smart Context Management
- **New feature**: AI now remembers previous messages in the same chat session
- Loads user messages + agent outputs from DB, interleaved chronologically
- **Sliding window**: Max 20 recent message pairs to prevent token overflow
- **Strip html:preview blocks**: Widget HTML (5-10KB each) compressed to ~300-500 byte summaries preserving chart data, labels, colors, metrics
- **Token budget**: History capped at ~32K chars (~8K tokens), prioritizing recent messages
- **Smart truncation**: User messages max 500 chars, assistant max 1500 chars, cut at word boundary
- `summarize_html_widget()` extracts Chart.js datasets, labels, colors, metric values from HTML for targeted edits

### Provider System Overhaul
- **Enable/disable toggle**: Per-provider on/off switch in Settings detail panel — disabled providers hidden from chat dropdown
- **Add Provider flow**: "Custom" replaced with "+ Add Provider" button — create unlimited custom providers with name, base URL, API key, model
- User-created providers appear in sidebar list with enable/disable dot indicator
- Delete provider resets selection to enowX Labs
- `is_enabled` column added to providers table (migration)
- **Manual model add**: Input field in Available Models section — type model name, click Add, auto-enabled
- Manual models persist in DB and appear in list even after Settings reopen (merged with API-fetched models)

### Token Optimization
- **MAX_REACT_ITERATIONS reduced**: 20 → 10 — prevents excessive API calls per request while still allowing complex tasks
- **Auto-select provider + model on app start**: If only 1 provider enabled, auto-selected as default. First available model auto-selected. No manual selection needed.
- Provider dropdown shows as label when only 1 provider (no unnecessary dropdown)

### Dark Mode — Warm Claude Palette
- Replaced cold pure black (#0a0a0a) with warm Claude-inspired tones
- Background: #1a1816 (warm dark brown), Surface: #201e1b, Text: #e8e4de (warm off-white)
- Accent color: #D4845A (terracotta/copper) matching light mode
- Borders, links, focus rings all use warm tones
- Danger colors updated to Claude red palette (#E24B4A)

### Markdown Table Fix
- `fixMarkdownTables()` rewritten — fixes malformed tables from streaming
- Auto-corrects separator row column count to match header
- Splits crammed rows (multiple rows on one line)
- Injects missing separator rows without duplicating between data rows
- Applied to both agent streaming output and final chat messages

### Scroll Bounce Fix
- Removed gradient overlay conditional mount/unmount (caused layout shift loop)
- Added `isAutoScrolling` guard — scroll events from auto-scroll ignored
- Throttled streaming scroll to 80ms intervals
- `requestAnimationFrame` for scroll-to-bottom to avoid layout thrashing

### UI Polish
- Left sidebar font sizes increased: project names, session titles, labels from 12px to 13px
- Model dropdown: `max-height: 360px` with scroll for long model lists
- Footer bar removed for cleaner layout
- Right sidebar toggle button in header (hidden when sidebar open)
- enowX Flux tooltip on hover with description and token usage info

---

## [0.2.0] — 2026-04-22

### enowX Flux — Generative UI System
- **New feature**: enowX Flux — AI generates interactive charts, diagrams, SVG illustrations, dashboards, and widgets inline in chat
- Integrated Claude.ai's reverse-engineered design system (CSS variables, SVG color ramps, pre-styled form elements, light/dark mode)
- `html:preview` code blocks render as live interactive iframes with full JS/CSS support
- Chart.js, D3, Canvas, and CDN libraries supported inside previews
- Debounced iframe rendering during streaming (400ms) to prevent flicker
- Auto-resize iframe to match content height via direct DOM measurement + ResizeObserver
- Re-measure on window resize for responsive behavior
- Expand preview to fullscreen modal with source code view and copy button
- Toggle button in header to enable/disable Flux (saves ~3K tokens per request when off)
- Custom tooltip on hover explaining what enowX Flux does
- Enhanced `PREVIEW_GUIDE` with full Claude guidelines: diagram types, illustrative patterns, interactive examples, UI components, art/illustration

### Welcome Screen
- Welcome screen with greeting + quick action chips (Write, Learn, Code, Personal, Brainstorm)
- Chips prefill prompt in input bar on click
- Auto-create project + session when user sends first message (no need to open folder first)
- Input bar always enabled — no more "Open a folder to start chatting"

### Chat Improvements
- **Streaming output**: Agent responses now stream token-by-token with blinking cursor, instead of appearing all at once
- **Auto-rename chat**: After first AI response, LLM generates a short 2-5 word title (e.g. "Greeting", "React Auth Setup")
- **Copy response**: Copy button below each AI response with model name and generation duration
- **Agent info relocated**: Model name and duration moved to bottom of response, agent type stays at top
- **Markdown table fix**: `fixMarkdownTables()` utility fixes malformed tables from streaming — auto-corrects separator column count, splits crammed rows, injects missing separators
- **Scroll bounce fix**: Removed gradient overlay mount/unmount loop, added `isAutoScrolling` guard, throttled streaming scroll (80ms)

### Sidebar
- **Left sidebar toggle**: Click logo icon to collapse/expand with smooth CSS grid animation (0.25s cubic-bezier)
- **Right sidebar toggle**: Toggle button inside sidebar header + in chat header when closed
- **Sidebar font size**: Increased project names, session titles, and labels from 12px to 13px for readability
- **Footer removed**: Cleaner layout, sidebar toggles moved to header

### Settings & Providers
- **Custom provider fix**: Added "Default Model" input field for Custom/Ollama providers — fixes silent save failure
- **Error feedback**: Save errors now shown as red inline messages instead of silent `console.error`
- **Base URL save**: Can now save base URL even when provider doesn't exist yet (auto-creates)
- **Model dropdown scroll**: Fixed dropdown clipping — added `max-height: 360px` with scrollbar for long model lists

### Header & Navigation
- **Rename chat**: Click pencil icon → inline edit with Enter/Escape
- **Three-dot menu**: New Chat + Delete Chat options
- **Delete confirmation**: Custom dark-themed confirm dialog (replaced broken native `window.confirm`)
- **Theme toggle**: Dark/light mode switch in header
- **enowX Flux toggle**: ON/OFF pill button with status tooltip

### Theme & Design
- **Dark mode warm palette**: Replaced cold pure black (#0a0a0a) with warm Claude-inspired tones (#1a1816 bg, #e8e4de text, #D4845A accent)
- **Light/dark preview sync**: iframe previews now use class-based theme switching (`.light`/`.dark`) instead of `prefers-color-scheme` media query — syncs with app toggle
- **Tauri dialog permissions**: Upgraded from `dialog:allow-open` to `dialog:default` for full dialog support

### Bug Fixes
- **Agent request fix**: Fixed parameter mismatch — frontend now wraps `run_agent` params in `request` object matching Rust `RunAgentRequest` struct
- **API key pre-flight**: Added validation check before API calls — clear error message instead of cryptic 401
- **First message missing**: Fixed race condition where `setActiveSessionId` triggered DB reload that wiped optimistic user message
- **Clippy warnings**: Fixed all Rust clippy warnings — dead code removal, parameter struct refactoring, simplified patterns

### Infrastructure
- **Tauri capabilities**: Added `dialog:default` permission for ask/confirm/message dialogs
- **Generate title command**: New `generate_title` Tauri command — LLM generates chat title via non-streaming API call

---

## [0.1.0] — Initial Release

- Tauri desktop app with Rust backend + React/TypeScript frontend
- Multi-agent system: Orchestrator, Planner, Coder FE/BE, Security, UX, UI, Tester, Reviewer, Researcher, Librarian
- Provider support: enowX Labs, OpenAI, Anthropic, Gemini, Ollama, Custom (OpenAI-compatible)
- Chat with streaming responses
- Tool execution: read_file, write_file, list_dir, search_files, run_command, web_search
- Settings modal with provider configuration and model management
- Project and session management
- Agent configuration per agent type
