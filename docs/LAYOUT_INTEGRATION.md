# Main Layout Integration

## Overview

This PR adds a comprehensive layout system that integrates all IDE features with keyboard shortcuts and proper panel management.

## Features

### Layout Manager (`useLayoutStore`)
- **Left Sidebar**: File Tree (Cmd+B to toggle)
- **Right Sidebar**: Git, Search, Code Review (Cmd+Shift+G/F/R)
- **Bottom Panel**: Terminal (Cmd+` to toggle)
- **Center Area**: Chat or Code Editor (Cmd+E to toggle)

### Keyboard Shortcuts
- `Cmd/Ctrl+B` - Toggle File Tree
- `Cmd/Ctrl+Shift+F` - Open Search
- `Cmd/Ctrl+Shift+G` - Open Git
- `Cmd/Ctrl+Shift+R` - Open Code Review
- `Cmd/Ctrl+\`` - Toggle Terminal
- `Cmd/Ctrl+E` - Toggle Editor

### Components

#### `IntegratedLayout`
Main layout component that wraps the entire app and manages:
- Panel visibility
- Panel sizing
- Keyboard shortcuts
- Component rendering

#### `useLayoutStore`
Zustand store for layout state:
- Panel open/close states
- Panel dimensions
- Active panel types
- Toggle functions

## Integration Points

### Current State (Placeholders)
All panels show placeholder components with "Coming soon" messages. This allows:
1. Testing layout system independently
2. Merging layout before feature PRs
3. Easy feature integration when PRs are merged

### Future Integration (When PRs Merge)
Replace placeholders with actual components:
```tsx
// Before
const FileTreePlaceholder = () => <div>Coming soon</div>;

// After (when PR #8 merges)
import { FileTree } from '@/components/ui/FileTree';
const renderLeftPanel = () => {
  case 'file-tree': return <FileTree />;
}
```

## Usage

```tsx
// In App.tsx or AppShell.tsx
import { IntegratedLayout } from '@/components/layout/IntegratedLayout';

function App() {
  return (
    <IntegratedLayout>
      {/* Existing chat/canvas content */}
      <ChatPanel />
    </IntegratedLayout>
  );
}
```

## Benefits

1. **Unified Layout**: All features in one consistent layout
2. **Keyboard-First**: All panels accessible via shortcuts
3. **Flexible**: Easy to add new panels
4. **Responsive**: Panels can be resized
5. **Persistent**: State can be saved/loaded (future PR)

## Testing

1. Press `Cmd+B` - File Tree placeholder appears
2. Press `Cmd+Shift+G` - Git placeholder appears
3. Press `Cmd+Shift+F` - Search placeholder appears
4. Press `Cmd+Shift+R` - Code Review placeholder appears
5. Press `Cmd+\`` - Terminal placeholder appears
6. Click toolbar buttons - Same behavior

## Next Steps

1. Merge this PR (layout foundation)
2. Merge feature PRs (#6-#13)
3. Replace placeholders with actual components
4. Add state persistence (PR #16)
5. Add resizable panels (future enhancement)
