# Contributing to enowX-Coder

Thank you for your interest in contributing! enowX-Coder is a Tauri-based AI code editor built with Rust + React + TypeScript.

## 🏗️ Architecture

- **Backend**: `src-tauri/` — Rust (Tauri v2)
- **Frontend**: `src/` — React + TypeScript
- **Database**: SQLite via `sqlx`
- **AI**: Streaming chat via OpenAI/Anthropic compatible providers

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/kevinnft/enowX-Coder.git
cd enowX-Coder

# Install frontend dependencies
bun install

# Run in development mode
cargo tauri dev
```

## 📝 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `chore` | Maintenance, tooling |
| `docs` | Documentation |
| `build` | Dependencies, build config |
| `test` | Adding/fixing tests |
| `perf` | Performance improvement |

Examples:
```
feat(chat): add model selector dropdown
fix(editor): resolve tab sync issue on file switch
refactor(agents): simplify prompt construction
docs: add setup guide for Linux
```

## 🌿 Git Workflow

- **Trunk-based development**: branch from `main`, short-lived branches only
- Delete branches after merge
- Never force push to `main`
- Use `git add -p` (interactive staging), never blind `git add .`

## 📋 Code Standards

### Rust
- Use `AppError` enum with `thiserror` — never `unwrap()` in production paths
- Commands are thin wrappers — all business logic in `services/`
- All Tauri commands must be `async`
- Use `#[serde(rename_all = "camelCase")]` on structs sent to frontend

### TypeScript / React
- Strict TypeScript — no `as any`, no `@ts-ignore`
- Follow existing component patterns

## 🧪 Pull Requests

Before submitting a PR:
1. Make sure `cargo clippy -- -D warnings` passes
2. Make sure `bunx tsc --noEmit` passes
3. Squash your commits into logical units
4. Write a clear description of what changes and why

## 🤝 Code of Conduct

We follow Contributor Covenant. Be respectful, constructive, and inclusive.
