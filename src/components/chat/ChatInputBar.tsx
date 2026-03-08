import React, { useRef, useEffect, useCallback } from 'react';
import { Paperclip, ArrowUp } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  onSend: (content: string) => void;
}

const MAX_HEIGHT = 200;

export const ChatInputBar: React.FC<ChatInputBarProps> = ({ onSend }) => {
  const { isStreaming } = useChatStore();
  const { providers, defaultProviderId, setDefaultProviderId } = useSettingsStore();
  const [value, setValue] = React.useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isStreaming, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="px-4 pb-4 pt-2">
      <div
        className={cn(
          'relative flex flex-col rounded-2xl border transition-all duration-200',
          'bg-[var(--surface-2)] border-[var(--border)]',
          'focus-within:border-white/15 focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.06),0_0_20px_rgba(255,255,255,0.04)]'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="How can I help you today?"
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent px-4 pt-3 pb-2',
            'text-sm leading-relaxed text-[var(--text)]',
            'placeholder:text-[var(--text-subtle)]',
            'custom-scrollbar',
            isStreaming && 'opacity-50 cursor-not-allowed'
          )}
          style={{ minHeight: '24px', maxHeight: `${MAX_HEIGHT}px`, outline: 'none' }}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={isStreaming}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                'text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-white/5',
                'disabled:opacity-30 disabled:cursor-not-allowed'
              )}
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {providers.length > 0 && (
              <Select
                value={defaultProviderId ?? undefined}
                onValueChange={setDefaultProviderId}
                disabled={isStreaming}
              >
                <SelectTrigger className="h-7 text-[11px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {p.model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                canSend
                  ? 'bg-white text-black hover:bg-[#e5e5e5] active:scale-95'
                  : 'bg-[var(--surface-3)] text-[var(--text-subtle)] cursor-not-allowed'
              )}
              title="Send (Enter)"
            >
              <ArrowUp size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-[var(--text-subtle)] mt-2">
        Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
};
