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
import { useSessionStore } from '@/stores/useSessionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Message } from '@/types';

export const AppShell: React.FC = () => {
  const { addMessage, appendStreamToken, setStreaming, clearStreaming, setMessages } = useChatStore();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const defaultProviderId = useSettingsStore((s) => s.defaultProviderId);
  const unlistenRef = useRef<UnlistenFn[]>([]);

  useEffect(() => {
    const setup = async () => {
      const unlistenToken = await listen<string>('chat-token', (event) => {
        appendStreamToken(event.payload);
      });

      const unlistenDone = await listen<string>('chat-done', () => {
        const { streamingText } = useChatStore.getState();
        const sessionId = useSessionStore.getState().activeSessionId ?? 'default';
        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: 'assistant',
          content: streamingText,
          createdAt: new Date().toISOString(),
        };
        addMessage(assistantMsg);
        clearStreaming();
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
    const sessionId = activeSessionId ?? 'default';

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setStreaming(true);

    try {
      await invoke('send_message', {
        sessionId,
        content,
        providerId: defaultProviderId ?? null,
      });
    } catch (err) {
      console.error('send_message error:', err);
      clearStreaming();
    }
  };

  return (
    <div className="app-grid bg-[var(--bg)] text-[var(--text)]">
      <LeftSidebar />

      <main className="flex flex-col overflow-hidden">
        <ChatHeader />
        <ChatPanel />
        <ChatInputBar onSend={handleSend} />
      </main>

      <RightSidebar />

      <AppFooter />
    </div>
  );
};
