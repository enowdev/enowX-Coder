import React, { useRef, useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
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
import { useSessionStore } from '@/stores/useSessionStore';
import { ProviderModelConfig } from '@/types';
import { cn } from '@/lib/utils';

interface ChatInputBarProps {
  onSend: (content: string) => void;
}

const MAX_HEIGHT = 200;

export const ChatInputBar: React.FC<ChatInputBarProps> = ({ onSend }) => {
  const { isStreaming } = useChatStore();
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const { providers, defaultProviderId, selectedModelId, setDefaultProviderId, setSelectedModelId } =
    useSettingsStore();

  const [value, setValue] = useState('');
  const [enabledModels, setEnabledModels] = useState<ProviderModelConfig[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load enabled models whenever the selected provider changes
  useEffect(() => {
    if (!defaultProviderId) {
      setEnabledModels([]);
      setSelectedModelId(null);
      return;
    }

    invoke<ProviderModelConfig[]>('list_provider_models', { providerId: defaultProviderId })
      .then((models) => {
        const enabled = models.filter((m) => m.enabled);
        setEnabledModels(enabled);
        // Auto-select first enabled model if current selection is invalid
        const stillValid = enabled.some((m) => m.modelId === selectedModelId);
        if (!stillValid) {
          setSelectedModelId(enabled[0]?.modelId ?? null);
        }
      })
      .catch(() => {
        setEnabledModels([]);
        setSelectedModelId(null);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProviderId]);

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

  const canSend = value.trim().length > 0 && !isStreaming && !!activeSessionId;

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
          placeholder={
            activeSessionId ? 'How can I help you today?' : 'Open a folder to start chatting…'
          }
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
            {/* Provider selector */}
            {providers.length > 0 && (
              <Select
                value={defaultProviderId ?? undefined}
                onValueChange={setDefaultProviderId}
                disabled={isStreaming}
              >
                <SelectTrigger className="h-7 text-[11px] max-w-[120px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Model selector — only shown when there are enabled models */}
            {enabledModels.length > 0 && (
              <Select
                value={selectedModelId ?? undefined}
                onValueChange={setSelectedModelId}
                disabled={isStreaming}
              >
                <SelectTrigger className="h-7 text-[11px] max-w-[160px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  {enabledModels.map((m) => (
                    <SelectItem key={m.modelId} value={m.modelId}>
                      {m.modelId}
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
