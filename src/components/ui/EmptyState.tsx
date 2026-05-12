import { ChatCircle, FolderOpen, Sparkle, PaintBrush, Gear } from '@phosphor-icons/react';
import { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
      <div className="text-[var(--text-secondary)] mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export function EmptyChat({ onNewChat }: { onNewChat: () => void }) {
  return (
    <EmptyState
      icon={<ChatCircle size={64} weight="duotone" />}
      title="No messages yet"
      description="Start a conversation with AI to get help with coding, brainstorming, or anything else."
      action={{
        label: 'Start Chatting',
        onClick: onNewChat,
      }}
    />
  );
}

export function EmptyProjects({ onCreateProject }: { onCreateProject: () => void }) {
  return (
    <EmptyState
      icon={<FolderOpen size={64} weight="duotone" />}
      title="No projects yet"
      description="Create your first project to organize your chats and keep your work structured."
      action={{
        label: 'Create Project',
        onClick: onCreateProject,
      }}
    />
  );
}

export function EmptySessions({ onNewSession }: { onNewSession: () => void }) {
  return (
    <EmptyState
      icon={<Sparkle size={64} weight="duotone" />}
      title="No chat sessions"
      description="Start a new chat session to begin working with AI agents."
      action={{
        label: 'New Chat',
        onClick: onNewSession,
      }}
    />
  );
}

export function EmptyCanvas() {
  return (
    <EmptyState
      icon={<PaintBrush size={64} weight="duotone" />}
      title="Blank canvas"
      description="Use the toolbar to draw shapes, or ask AI to generate diagrams for you."
    />
  );
}

export function EmptySettings() {
  return (
    <EmptyState
      icon={<Gear size={64} weight="duotone" />}
      title="No settings configured"
      description="Configure your AI providers and preferences to get started."
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      icon={<ChatCircle size={64} weight="duotone" />}
      title="No results found"
      description={`No commands or items match "${query}". Try a different search term.`}
    />
  );
}
