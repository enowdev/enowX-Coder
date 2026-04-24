import React, { useRef, useEffect } from 'react';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useChatStore } from '@/stores/useChatStore';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (content: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const { isStreaming } = useChatStore();
  const [value, setValue] = React.useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 144)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-end gap-3 p-4 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder={isStreaming ? 'Waiting for response…' : 'Message enowX… (⌘↵ to send)'}
          rows={1}
          className={cn(
            'w-full resize-none rounded-xl px-4 py-3 text-sm leading-relaxed',
            'bg-[var(--surface-2)] border border-[var(--border)]',
            'text-[var(--text)] placeholder:text-[var(--text-muted)]',
            'focus:border-[var(--accent)] focus:outline-none transition-colors',
            'custom-scrollbar',
            isStreaming && 'opacity-50 cursor-not-allowed'
          )}
          style={{ minHeight: '44px', maxHeight: '144px' }}
        />
      </div>
      <button
        onClick={handleSend}
        disabled={!value.trim() || isStreaming}
        className={cn(
          'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all',
          value.trim() && !isStreaming
            ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] active:scale-95'
            : 'bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed opacity-50'
        )}
      >
        <PaperPlaneTilt size={18} weight="fill" />
      </button>
    </div>
  );
};
