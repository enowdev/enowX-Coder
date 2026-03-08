import React, { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ChatHeader } from '@/components/layout/ChatHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { Message, Project, Session } from '@/types';

export const AppShell: React.FC = () => {
  const { addMessage, appendStreamToken, setStreaming, clearStreaming, setMessages } = useChatStore();
  const setProjects = useProjectStore((s) => s.setProjects);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setSessions = useSessionStore((s) => s.setSessions);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const { setProviders, setDefaultProviderId, defaultProviderId, selectedModelId } = useSettingsStore();
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const projects = await invoke<Project[]>('list_projects');
        setProjects(projects);

        if (projects.length === 0) {
          setActiveProjectId(null);
          setSessions([]);
          setActiveSessionId(null);
          return;
        }

        const allSessions = (
          await Promise.all(
            projects.map((p) => invoke<Session[]>('list_sessions', { projectId: p.id }))
          )
        ).flat();
        setSessions(allSessions);

        const activeProject = [...projects].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setActiveProjectId(activeProject.id);

        const projectSessions = allSessions.filter((s) => s.projectId === activeProject.id);
        if (projectSessions.length === 0) {
          setActiveSessionId(null);
          return;
        }

        const activeSession = [...projectSessions].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setActiveSessionId(activeSession.id);
      } catch (error) {
        console.error('Failed to load projects and sessions:', error);
      }
    };

    void loadPersistedData();
  }, [setProjects, setActiveProjectId, setSessions, setActiveSessionId]);

  useEffect(() => {
    invoke<{ id: string; name: string; model: string; isDefault: boolean }[]>('list_providers')
      .then((ps) => {
        setProviders(ps as Parameters<typeof setProviders>[0]);
        const def = ps.find((p) => p.isDefault);
        if (def) setDefaultProviderId(def.id);
      })
      .catch(console.error);
  }, [setProviders, setDefaultProviderId]);

  useEffect(() => {
    const setup = async () => {
      const unlistenToken = await listen<string>('chat-token', (event) => {
        appendStreamToken(event.payload);
      });

      const unlistenDone = await listen<string>('chat-done', () => {
        clearStreaming();
        const sessionId = useSessionStore.getState().activeSessionId;
        if (sessionId) {
          invoke<Message[]>('get_messages', { sessionId })
            .then((msgs) => useChatStore.getState().setMessages(msgs))
            .catch(console.error);
        }
      });

      const unlistenError = await listen<string>('chat-error', (event) => {
        console.error('Chat error:', event.payload);
        clearStreaming();
      });

      unlistenRef.current = [unlistenToken, unlistenDone, unlistenError];
    };

    setup();

    return () => {
      unlistenRef.current.forEach((fn) => fn());
    };
  }, [appendStreamToken, addMessage, clearStreaming]);

  useEffect(() => {
    if (!activeSessionId) return;
    invoke<Message[]>('get_messages', { sessionId: activeSessionId })
      .then(setMessages)
      .catch(console.error);
  }, [activeSessionId, setMessages]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) {
      console.warn('No active session — open a folder first');
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setStreaming(true);

    try {
      await invoke('send_message', {
        sessionId: activeSessionId,
        content,
        providerId: defaultProviderId ?? null,
        modelId: selectedModelId ?? null,
      });
    } catch (err) {
      console.error('send_message error:', err);
      clearStreaming();
    }
  };

  return (
    <div
      className="bg-[var(--bg)] text-[var(--text)] h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: rightSidebarOpen
          ? 'var(--sidebar-width-left) 1fr var(--sidebar-width-right)'
          : 'var(--sidebar-width-left) 1fr',
        gridTemplateRows: '1fr auto',
        transition: 'grid-template-columns 0.2s ease',
      }}
    >
      <LeftSidebar />

      <main className="flex flex-col overflow-hidden min-h-0">
        <ChatHeader />
        <ChatPanel />
        <ChatInputBar onSend={handleSend} />
      </main>

      {rightSidebarOpen && <RightSidebar />}

      <AppFooter />

      <SettingsModal />
    </div>
  );
};
