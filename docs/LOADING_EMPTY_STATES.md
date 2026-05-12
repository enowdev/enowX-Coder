# Loading States & Empty States

Comprehensive loading and empty state components for enowX-Coder.

## Components

### Loading States

#### `<Skeleton />`
Generic skeleton loader for any content.

```tsx
<Skeleton className="h-4 w-32" />
```

#### Specialized Skeletons
- `<ChatMessageSkeleton />` — Chat message placeholder
- `<SessionListSkeleton />` — Session list placeholder
- `<ProjectSwitcherSkeleton />` — Project switcher placeholder
- `<AgentRunSkeleton />` — Agent run card placeholder
- `<CanvasSkeleton />` — Canvas loading state

#### `<LoadingSpinner />`
Animated spinner for loading states.

```tsx
<LoadingSpinner size={24} />
```

#### Loading Variants
- `<LoadingOverlay message="Loading..." />` — Full-screen overlay
- `<LoadingInline message="Loading..." />` — Inline loader
- `<LoadingPage message="Loading..." />` — Full-page loader

### Empty States

#### `<EmptyState />`
Generic empty state with icon, title, description, and optional action.

```tsx
<EmptyState
  icon={<ChatCircle size={64} />}
  title="No messages"
  description="Start a conversation"
  action={{ label: 'New Chat', onClick: handleNewChat }}
/>
```

#### Specialized Empty States
- `<EmptyChat onNewChat={...} />` — No messages in chat
- `<EmptyProjects onCreateProject={...} />` — No projects
- `<EmptySessions onNewSession={...} />` — No chat sessions
- `<EmptyCanvas />` — Blank canvas
- `<EmptySettings />` — No settings configured
- `<EmptySearch query="..." />` — No search results

## Usage Examples

### Loading State

```tsx
import { ChatMessageSkeleton } from '@/components/ui/Skeleton';

function ChatView() {
  const { messages, isLoading } = useChatStore();

  if (isLoading) {
    return (
      <div>
        <ChatMessageSkeleton />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton />
      </div>
    );
  }

  return <MessageList messages={messages} />;
}
```

### Empty State

```tsx
import { EmptyChat } from '@/components/ui/EmptyState';

function ChatView() {
  const { messages } = useChatStore();
  const handleNewChat = () => {
    // Create new chat
  };

  if (messages.length === 0) {
    return <EmptyChat onNewChat={handleNewChat} />;
  }

  return <MessageList messages={messages} />;
}
```

### Loading Overlay

```tsx
import { LoadingOverlay } from '@/components/ui/LoadingSpinner';

function App() {
  const { isInitializing } = useAppStore();

  return (
    <>
      <AppShell />
      {isInitializing && <LoadingOverlay message="Initializing..." />}
    </>
  );
}
```

## Design Principles

### Loading States
- **Skeleton loaders** for content that will appear
- **Spinners** for indeterminate progress
- **Overlays** for blocking operations
- **Inline loaders** for non-blocking operations

### Empty States
- **Friendly icons** (duotone style from Phosphor Icons)
- **Clear title** (what's missing)
- **Helpful description** (why it's empty, what to do)
- **Optional action** (CTA to resolve empty state)

## Accessibility

- All loading states use `aria-hidden="true"` (screen readers skip)
- Empty states use semantic HTML (headings, paragraphs)
- Action buttons are keyboard accessible
- Loading overlays trap focus (modal behavior)

## Animation

- **Skeleton**: Pulse animation (1.5s ease-in-out infinite)
- **Spinner**: Rotate animation (1s linear infinite)
- **Fade-in**: Empty states fade in smoothly

## Customization

### Skeleton Colors
Skeletons use `--surface-hover` CSS variable (theme-aware).

### Empty State Icons
Use any Phosphor Icon with `weight="duotone"` for consistency.

### Loading Messages
All loading components accept optional `message` prop.

## Future Enhancements

- [ ] Progress bars for determinate loading
- [ ] Shimmer effect for skeletons
- [ ] Animated empty state illustrations
- [ ] Retry mechanism for failed states
- [ ] Error states (separate from empty states)

## Credits

Inspired by:
- Linear empty states
- GitHub loading skeletons
- Vercel loading spinners
- Stripe empty states
