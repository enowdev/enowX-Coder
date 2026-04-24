import React, { useEffect, useRef, useCallback } from 'react';
import { Sparkle, PencilLine, GraduationCap, Code, Briefcase, Lightning } from '@phosphor-icons/react';
import { useChatStore } from '@/stores/useChatStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { ChatMessage } from './ChatMessage';
import { StreamingMessage } from './StreamingMessage';
import { AgentRunCard } from './AgentRunCard';
import { Message, AgentRunWithTools } from '@/types';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  onChipClick?: (text: string) => void;
}

const QUICK_CHIPS = [
  { icon: PencilLine, label: 'Write', prompt: 'Help me write ' },
  { icon: GraduationCap, label: 'Learn', prompt: 'Explain how ' },
  { icon: Code, label: 'Code', prompt: 'Write code to ' },
  { icon: Briefcase, label: 'Personal', prompt: 'Help me with ' },
  { icon: Lightning, label: 'Brainstorm', prompt: 'Brainstorm ideas for ' },
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ onChipClick }) => {
  const { messages, isStreaming, streamingText } = useChatStore();
  const { agentRuns } = useAgentStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const isAutoScrolling = useRef(false);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isAutoScrolling.current = true;
    requestAnimationFrame(() => {
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      // Reset flag after browser has applied the scroll
      requestAnimationFrame(() => { isAutoScrolling.current = false; });
    });
  }, []);

  // Track user scroll intent — ignore scroll events caused by our own scrollToBottom
  const handleScroll = useCallback(() => {
    if (isAutoScrolling.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distFromBottom > 150;
  }, []);

  // Auto-scroll only when genuinely new messages are added
  const prevMsgCount = useRef(messages.length);

  useEffect(() => {
    const newMsg = messages.length > prevMsgCount.current;
    prevMsgCount.current = messages.length;

    if (newMsg && !userScrolledUp.current) {
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom]);

  // During active streaming only, follow new tokens (throttled)
  const streamScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isStreaming || userScrolledUp.current) return;
    if (streamScrollTimer.current) return; // throttle
    streamScrollTimer.current = setTimeout(() => {
      streamScrollTimer.current = null;
      if (!userScrolledUp.current) scrollToBottom();
    }, 80);
  }, [streamingText, isStreaming, scrollToBottom]);

  const isEmpty = messages.length === 0 && agentRuns.length === 0 && !isStreaming;

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center pt-[12vh] text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--surface-2)] to-[var(--surface-3)] border border-[var(--border)] mb-6 flex items-center justify-center">
          <Sparkle size={26} weight="duotone" className="text-[var(--accent)]" />
        </div>
        <h2 className="text-2xl font-bold mb-2 tracking-tight">Welcome Back!</h2>
        <p className="text-sm text-[var(--text-muted)] mb-8 max-w-sm">
          What would you like to work on today?
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => onChipClick?.(chip.prompt)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full',
                'border border-[var(--border)] bg-[var(--surface-2)]/50',
                'text-xs text-[var(--text-muted)] font-medium',
                'hover:bg-[var(--hover-bg-strong)] hover:text-[var(--text)] hover:border-[var(--border-strong)]',
                'transition-all duration-200 active:scale-95'
              )}
            >
              <chip.icon size={14} weight="duotone" />
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const topLevelRuns = agentRuns.filter((r) => r.parentAgentRunId === null);
  const combinedItems = [
    ...messages.map((m) => ({ type: 'message' as const, data: m, date: new Date(m.createdAt).getTime() })),
    ...topLevelRuns.map((r) => ({ type: 'agent' as const, data: r, date: new Date(r.createdAt).getTime() })),
  ].sort((a, b) => a.date - b.date);

  return (
    <div className="flex-1 relative overflow-hidden min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto custom-scrollbar py-6"
      >
        <div className="max-w-3xl mx-auto w-full px-4 flex flex-col gap-6">
          {combinedItems.map((item) => {
            if (item.type === 'message') {
              const message = item.data as Message;
              return <ChatMessage key={message.id} message={message} />;
            }
            return <AgentRunCard key={item.data.id} run={item.data as AgentRunWithTools} />;
          })}
          <StreamingMessage />
          <div ref={bottomRef} />
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, var(--bg))' }}
      />
    </div>
  );
};
