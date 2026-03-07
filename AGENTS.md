# enowX-Coder

Tauri desktop application built with Rust (backend) + React + TypeScript (frontend).

## Project Structure

- `src/` — React + TypeScript frontend
- `src-tauri/` — Rust backend (Tauri)
- `src-tauri/src/` — Rust source: `commands/`, `services/`, `models/`, `state/`, `error.rs`
- `.claude/skills/` — AI skills (loaded on demand)
- `.memory/` — Persistent memory files (written by Mnemosyne)

---

## Always-Active Rules

These rules apply automatically — no need to be asked.

### 1. Git Operations → git-master skill

**Trigger**: Any git operation, commit authoring, branch management, or when a file should be added to `.gitignore`.

- Always follow **Conventional Commits** format: `<type>(<scope>): <description>`
- Always use **trunk-based development**: branch from `main`, short-lived branches only
- Always check `git status` before committing — update `.gitignore` if untracked files should be ignored
- Always use `git add -p` (interactive staging), never blind `git add .`
- Delete branches immediately after merge
- Never force push to `main`
- Commit messages always in English

### 2. Bugs / Errors / Failures → systematic-debugging skill

**Trigger**: Any bug report, test failure, unexpected behavior, or error encountered.

- **NEVER propose a fix before finding the root cause**
- Always complete root cause investigation (Phase 1) before attempting any fix
- Symptom fixes are failure — find the actual cause
- No random changes hoping something works

### 3. New Feature / Implementation → brainstorming skill

**Trigger**: Before implementing any new feature, component, or significant behavior change.

- Always explore intent and requirements before writing code
- Ask clarifying questions one at a time
- Propose 2-3 approaches with trade-offs before proceeding
- Present design in sections, check alignment before implementing

### 4. Task Completion → mnemosyne skill

**Trigger**: After completing any task where files were edited and verified (tests pass, diagnostics clean).

- Write a structured memory file to `.memory/` directory
- Update `.memory/session-summary.md` with overall progress
- Use kebab-case filenames, group related features in subdirectories
- Keep memory files concise: file paths, key decisions, dependencies, next steps
- Update existing memory file if same files were modified (don't create duplicates)

### 5. Project Planning → plan-visualizer skill

**Trigger**: Alongside `brainstorming` when starting a new project or feature set, and alongside `mnemosyne` when task status changes.

- Always read `.plans/src/data/plan.json` before writing — never overwrite blindly
- Update `meta.updatedAt` on every write
- Move tasks between kanban columns as work progresses (`backlog → in_progress → review → done`)
- Update phase `progress` (0–100) based on milestone completion ratio
- Add a `sessionLog` entry for every significant action
- Dev server: `cd .plans && npm run dev` → `http://localhost:1998`

---

## Code Standards

### Rust (src-tauri/)

- Use `AppError` enum with `thiserror` — never `unwrap()` in production paths
- Commands are thin wrappers — all business logic in `services/`
- All Tauri commands must be `async`
- Use `#[serde(rename_all = "camelCase")]` on structs sent to frontend
- Run `cargo clippy -- -D warnings` before considering Rust work done

### TypeScript / React (src/)

- Strict TypeScript — no `as any`, no `@ts-ignore`
- Follow existing component patterns in `src/`

---

## Commit Convention Quick Reference

| Type | Use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `chore` | Maintenance, tooling, gitignore |
| `docs` | Documentation only |
| `build` | Cargo.toml, package.json changes |
| `test` | Adding/fixing tests |
| `perf` | Performance improvement |
