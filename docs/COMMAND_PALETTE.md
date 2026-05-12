# Command Palette & Keyboard Shortcuts

Comprehensive keyboard shortcuts and command palette system for enowX-Coder.

## Features

### Command Palette (Cmd/Ctrl+K)
- **Quick access** to all app commands
- **Fuzzy search** by command name, description, or category
- **Keyboard navigation** (↑↓ to navigate, Enter to execute, Esc to close)
- **Grouped by category** (Navigation, Chat, View, Settings, Project)
- **Visual shortcuts** displayed for each command

### Global Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Cmd/Ctrl+K` | **Open Command Palette** | Quick access to all commands |
| `Cmd/Ctrl+N` | **New Chat** | Start a new chat session |
| `Cmd/Ctrl+1` | **Switch to Chat** | Switch to chat view |
| `Cmd/Ctrl+2` | **Switch to Canvas** | Switch to canvas view |
| `Cmd/Ctrl+B` | **Toggle Left Sidebar** | Show/hide left sidebar |
| `Cmd/Ctrl+Shift+B` | **Toggle Right Sidebar** | Show/hide right sidebar |
| `Cmd/Ctrl+,` | **Open Settings** | Open settings modal |
| `Cmd/Ctrl+Shift+T` | **Toggle Theme** | Switch between light/dark mode |
| `Esc` | **Close Modal** | Close any open modal/dialog |

## Architecture

### Stores
- **`useCommandPaletteStore`** — Zustand store for command palette state
  - `isOpen` — Command palette visibility
  - `commands` — Registered commands array
  - `registerCommand()` — Register a new command
  - `unregisterCommand()` — Remove a command
  - `executeCommand()` — Execute command by ID

### Hooks
- **`useKeyboardShortcut()`** — Register a single keyboard shortcut
- **`useKeyboardShortcuts()`** — Register multiple shortcuts at once
- **`formatShortcut()`** — Format shortcut for display (Mac/Windows aware)

### Components
- **`<CommandPalette />`** — Command palette modal
  - Fuzzy search
  - Keyboard navigation
  - Grouped commands
  - Visual shortcuts

## Usage

### Registering Commands

```tsx
import { useCommandPaletteStore } from '@/stores/useCommandPaletteStore';

function MyComponent() {
  const { registerCommand } = useCommandPaletteStore();

  useEffect(() => {
    registerCommand({
      id: 'my-command',
      label: 'My Command',
      description: 'Does something cool',
      category: 'navigation',
      shortcut: '⌘+M',
      action: () => {
        // Your action here
      },
    });
  }, [registerCommand]);
}
```

### Using Keyboard Shortcuts

```tsx
import { useKeyboardShortcut } from '@/lib/useKeyboardShortcut';

function MyComponent() {
  useKeyboardShortcut({
    key: 'm',
    meta: true, // Cmd on Mac, Ctrl on Windows
    action: () => {
      console.log('Cmd/Ctrl+M pressed!');
    },
  });
}
```

## Implementation Details

### Cross-Platform Support
- **Mac**: Uses `⌘` (Command) key
- **Windows/Linux**: Uses `Ctrl` key
- Automatically detects platform via `navigator.platform`

### Keyboard Event Handling
- All shortcuts use `keydown` event
- `preventDefault()` called by default (can be disabled)
- Only first matching shortcut executes (prevents conflicts)

### Command Categories
- **navigation** — View switching, navigation
- **chat** — Chat-related actions
- **view** — UI visibility toggles
- **settings** — Settings and configuration
- **project** — Project management

## Future Enhancements

- [ ] Custom shortcut configuration
- [ ] Shortcut conflict detection
- [ ] Command history (recent commands)
- [ ] Command aliases
- [ ] Context-aware commands (only show relevant commands)
- [ ] Command chaining (execute multiple commands)
- [ ] Keyboard shortcut cheat sheet modal

## Testing

```bash
# Run dev server
bun run tauri dev

# Test shortcuts:
# 1. Press Cmd/Ctrl+K → Command palette opens
# 2. Type "theme" → Toggle Theme command appears
# 3. Press Enter → Theme toggles
# 4. Press Cmd/Ctrl+B → Left sidebar toggles
# 5. Press Cmd/Ctrl+1 → Switches to chat view
```

## Credits

Inspired by:
- VS Code Command Palette
- Raycast
- Linear Command Menu
- Slack Command Palette
