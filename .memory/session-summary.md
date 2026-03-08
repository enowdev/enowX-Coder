# Session Summary — enowX-Coder

**Last updated**: 2026-03-08
**Status**: MVP running — app launches, styles load, DB initializes correctly

## What Was Built

### Phase 1 — Foundation ✅
- Rust backend: `error.rs` (AppError+thiserror), `state.rs` (AppState+Arc<SqlitePool>)
- SQLite migrations: projects, sessions, messages, providers, agent_runs
- Frontend: Tailwind v4, CSS Grid 3-panel, dark theme CSS variables
- 5 Zustand stores, TypeScript types, cn() utility

### Phase 2 — Core Chat ✅
- Rust commands/services for project, session, chat, provider, agent
- Streaming: reqwest SSE → Tauri events (chat-token/chat-done/chat-error) → React listeners
- ChatPanel, ChatMessage (React.memo + react-markdown + rehype-highlight), ChatInput, StreamingMessage
- AppShell wired to Tauri invoke + streaming events

### Phase 3 — Orchestration ✅
- RightSidebar: Agents/Skills/Metrics tabs
- ProviderSettings: add/edit/delete, presets (OpenAI/Anthropic/Ollama/Custom)

### Phase 4 — Polish ✅
- OnboardingWizard: 4-step (welcome → provider → project → done)
- Keyboard shortcut: Cmd+N new chat
- Empty states in ChatPanel

## Bug Fixes Applied
- `fix(backend)`: SQLite path was `sqlite://./enowx.db` (relative to CWD) → now uses `app_data_dir()` via Tauri Manager trait. DB stored at `~/.local/share/com.enowdev.enowxcoder/enowx.db`
- `fix(backend)`: `#[tokio::main]` + `block_on` in setup caused "cannot start runtime from within runtime" panic. Fixed by removing `#[tokio::main]`, using `std::thread::spawn` + fresh `tokio::runtime::Runtime` for DB init, result sent back via `mpsc::channel`
- `fix(frontend)`: `index.css` (Tailwind v4 + CSS vars) was never imported in `main.tsx` — styles not loading

## Commits (main branch)
```
1103de9 fix(frontend): import index.css in main.tsx
79ac75e fix(backend): fix tokio runtime conflict in Tauri setup
cc372b9 fix(backend): resolve SQLite DB path via Tauri app_data_dir
7d23bd0 chore(memory): update session summary after MVP completion
d0fa4fb feat(app): implement full MVP — Rust backend + React frontend
```

## Key Architecture Decisions
- Tauri 2 `app_handle.emit()` for streaming (not WebSocket)
- `React.memo` on ChatMessage to prevent re-renders per token
- `useChatStore.streamingText` accumulates tokens, committed to messages on `chat-done`
- AppState uses `Arc<SqlitePool>` (Send+Sync)
- All Tauri commands are `async`, thin wrappers over services/
- Onboarding shown when `providers.length === 0` OR `localStorage('onboarding-done') !== 'true'`
- DB init: `std::thread::spawn` → fresh tokio runtime → `mpsc::channel` result back to setup()

## File Map
```
src-tauri/src/
  error.rs, state.rs, main.rs, lib.rs
  commands/: project.rs, session.rs, chat.rs, provider.rs, agent.rs
  services/: project_service.rs, session_service.rs, chat_service.rs, provider_service.rs, agent_service.rs
  models/: project.rs, session.rs, message.rs, provider.rs, agent_run.rs
  migrations/20260308000_init.sql

src/
  main.tsx (entry — imports index.css)
  App.tsx (onboarding gate + keyboard shortcuts)
  index.css (Tailwind v4 + CSS vars + app-grid)
  types/index.ts, lib/utils.ts
  stores/: useProjectStore, useSessionStore, useChatStore, useSettingsStore, useAgentStore
  components/
    layout/: AppShell, LeftSidebar, RightSidebar, ChatHeader, ChatFooter
    chat/: ChatPanel, ChatMessage, ChatInput, StreamingMessage
    sidebar/: ProjectSwitcher, SessionList
    settings/: ProviderSettings
    onboarding/: OnboardingWizard
```

## Next Steps (Post-MVP)
- Wire create_session/list_sessions/create_project/list_projects Tauri invokes to stores (currently in-memory only)
- Auto-title generation after 2nd message
- Project folder picker (tauri-plugin-dialog) + file tree context injection
- Cmd+K command palette
- Token usage tracking in DB
