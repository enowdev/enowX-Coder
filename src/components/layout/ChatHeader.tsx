import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectStore } from '@/stores/useProjectStore';

import { useChatStore } from '@/stores/useChatStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { PencilSimple, DotsThreeVertical, Sun, Moon, Trash, Plus, Check, X, SidebarSimple, ChatCircle, PaintBrush } from '@phosphor-icons/react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { Session } from '@/types';
import { generateId } from '@/lib/utils';

interface ChatHeaderProps {
  onToggleLeftSidebar?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onToggleLeftSidebar }) => {
  const { activeSessionId, sessions, updateSessionTitle, setActiveSessionId, addSession, removeSession, setSessions } = useSessionStore();
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);
  const fluxEnabled = useUIStore((s) => s.fluxEnabled);
  const toggleFlux = useUIStore((s) => s.toggleFlux);
  const mainView = useUIStore((s) => s.mainView);
  const setMainView = useUIStore((s) => s.setMainView);
  const { activeProjectId } = useProjectStore();

  const { theme, toggleTheme } = useUIStore();
  const activeSession = sessions.find(s => s.id === activeSessionId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Focus rename input when entering rename mode
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleStartRename = () => {
    if (!activeSession) return;
    setRenameValue(activeSession.title);
    setIsRenaming(true);
  };

  const handleConfirmRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !activeSessionId) {
      setIsRenaming(false);
      return;
    }
    updateSessionTitle(activeSessionId, trimmed);
    setIsRenaming(false);
    try {
      await invoke('update_session_title', { id: activeSessionId, title: trimmed });
    } catch (e) {
      console.error('Failed to rename session:', e);
    }
  };

  const handleCancelRename = () => {
    setIsRenaming(false);
  };

  const handleNewChat = async () => {
    setMenuOpen(false);
    if (!activeProjectId) return;
    const now = new Date().toISOString();
    const tempSession = { id: generateId(), projectId: activeProjectId, title: 'New Chat', createdAt: now, updatedAt: now };
    addSession(tempSession);
    setActiveSessionId(tempSession.id);
    try {
      const created = await invoke<Session>('create_session', { projectId: activeProjectId, title: 'New Chat' });
      const currentSessions = useSessionStore.getState().sessions;
      setSessions(currentSessions.map(s => s.id === tempSession.id ? created : s));
      setActiveSessionId(created.id);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleDeleteChat = () => {
    setMenuOpen(false);
    if (!activeSessionId || !activeSession) return;
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    setDeleteConfirmOpen(false);
    if (!activeSessionId) return;
    removeSession(activeSessionId);
    useChatStore.getState().setMessages([]);
    useAgentStore.getState().setAgentRuns([]);
    try {
      await invoke('delete_session', { id: activeSessionId });
    } catch (e) {
      console.error('Failed to delete session:', e);
    }
  };



  return (
    <>
    <header className="h-16 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between px-6 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleLeftSidebar && (
          <button
            onClick={onToggleLeftSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title="Open sidebar"
          >
            <SidebarSimple size={18} />
          </button>
        )}
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleConfirmRename();
                if (e.key === 'Escape') handleCancelRename();
              }}
              className="text-sm font-bold bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 w-48 focus:border-[var(--focus-border)] transition-colors"
            />
            <button onClick={() => void handleConfirmRename()} className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              <Check size={14} />
            </button>
            <button onClick={handleCancelRename} className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-bold truncate tracking-tight">
              {activeSession ? activeSession.title : 'Chat'}
            </h1>
            {activeSession && (
              <button
                onClick={handleStartRename}
                className="p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                title="Rename chat"
              >
                <PencilSimple size={14} />
              </button>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* View tabs: Chat / Canvas */}
        <div className="flex items-center bg-[var(--surface-2)]/50 rounded-lg border border-[var(--border)] p-0.5">
          <button
            onClick={() => setMainView('chat')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
              mainView === 'chat'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'
            )}
          >
            <ChatCircle size={13} weight={mainView === 'chat' ? 'fill' : 'regular'} />
            Chat
          </button>
          <button
            onClick={() => setMainView('canvas')}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all',
              mainView === 'canvas'
                ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
                : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)]'
            )}
          >
            <PaintBrush size={13} weight={mainView === 'canvas' ? 'fill' : 'regular'} />
            Canvas
          </button>
        </div>

        <div className="relative group/flux">
          <button
            onClick={toggleFlux}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-wide transition-all duration-200',
              fluxEnabled
                ? 'bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]'
                : 'bg-[var(--surface-2)]/50 border-[var(--border)] text-[var(--text-subtle)]'
            )}
          >
            <div className={cn(
              'w-1.5 h-1.5 rounded-full transition-colors',
              fluxEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--text-subtle)]'
            )} />
            enowX Flux
          </button>
          <div className="absolute top-full right-0 mt-2 w-64 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] shadow-xl opacity-0 invisible group-hover/flux:opacity-100 group-hover/flux:visible transition-all duration-200 z-50 pointer-events-none">
            <p className="text-[12px] font-semibold text-[var(--text)] mb-1">
              {fluxEnabled ? 'enowX Flux is ON' : 'enowX Flux is OFF'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              {fluxEnabled
                ? 'AI can generate interactive charts, diagrams, and visual widgets inline in chat. Uses ~3K extra tokens per request.'
                : 'Text-only mode. AI won\'t generate visuals — saves tokens and speeds up responses.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-[var(--hover-bg)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title="Chat options"
            >
              <DotsThreeVertical size={20} weight="bold" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--surface-2)] border border-[var(--border)] rounded-lg shadow-xl overflow-hidden z-50">
                <button
                  onClick={() => void handleNewChat()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--text)] hover:bg-[var(--hover-bg-strong)] transition-colors"
                >
                  <Plus size={14} />
                  New Chat
                </button>
                {activeSession && (
                  <button
                    onClick={() => void handleDeleteChat()}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs text-[var(--danger-hover)] hover:bg-[var(--danger-bg)] transition-colors"
                  >
                    <Trash size={14} />
                    Delete Chat
                  </button>
                )}
              </div>
            )}
          </div>

          {!rightSidebarOpen && (
            <button
              onClick={toggleRightSidebar}
              className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              title="Show right panel"
            >
              <SidebarSimple size={20} className="scale-x-[-1]" />
            </button>
          )}
        </div>
      </div>
    </header>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete Chat"
        message={`Are you sure you want to delete "${activeSession?.title ?? 'this chat'}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
};
