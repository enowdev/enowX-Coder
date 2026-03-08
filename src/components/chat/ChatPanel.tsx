import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { useChatStore } from '@/stores/useChatStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { AgentRunCard } from './AgentRunCard';
import { Message, AgentRunWithTools } from '@/types';

export const ChatPanel: React.FC = () => {
  const { messages, isStreaming, streamingText } = useChatStore();
  const { agentRuns } = useAgentStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const userScrolledUp = useRef(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  const checkAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setAtBottom(isAtBottom);
    userScrolledUp.current = !isAtBottom;
  }, []);

  useEffect(() => {
    if (!userScrolledUp.current) {
      scrollToBottom('smooth');
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isStreaming && !userScrolledUp.current) {
      scrollToBottom('instant');
    }
  }, [streamingText, isStreaming, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming) {
      userScrolledUp.current = false;
      scrollToBottom('smooth');
    }
  }, [isStreaming, scrollToBottom]);

  if (messages.length === 0 && agentRuns.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-60">
        <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] mb-4 flex items-center justify-center">
          <Sparkle size={28} weight="duotone" className="text-[var(--accent)]" />
        </div>
        <h2 className="text-lg font-bold mb-2">How can I help you today?</h2>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          Start a conversation. I can help you write code, debug issues, and build your project.
        </p>
      </div>
    );
  }

  const topLevelRuns = agentRuns.filter(r => r.parentAgentRunId === null);
  const combinedItems = [
    ...messages.map(m => ({ type: 'message' as const, data: m, date: new Date(m.createdAt).getTime() })),
    ...topLevelRuns.map(r => ({ type: 'agent' as const, data: r, date: new Date(r.createdAt).getTime() }))
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="flex-1 relative overflow-hidden min-h-0">
      <div
        ref={scrollRef}
        onScroll={checkAtBottom}
        className="h-full overflow-y-auto custom-scrollbar py-6"
      >
        <div className="max-w-3xl mx-auto w-full px-4 flex flex-col gap-4">
          {combinedItems.map((item) => {
            if (item.type === 'message') {
              return <ChatMessage key={item.data.id} message={item.data as Message} />;
            } else {
              return <AgentRunCard key={item.data.id} run={item.data as AgentRunWithTools} allRuns={agentRuns} />;
            }
          })}
          <StreamingMessage />
          <div ref={bottomRef} />
        </div>
      </div>

      {atBottom && (
        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
        />
      )}
    </div>
  );
};
