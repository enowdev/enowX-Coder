import React, { useRef, useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Paperclip, ArrowUp, Stop } from '@phosphor-icons/react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useChatStore } from '@/stores/useChatStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { ProviderModelConfig, SELECTABLE_AGENTS, AGENT_LABELS } from '@/types';
import { cn } from '@/lib/utils';

export interface ChatInputBarHandle {
  prefill: (text: string) => void;
}

interface ChatInputBarProps {
  onSend: (content: string) => void;
  onStop?: () => void;
}

const MAX_HEIGHT = 200;

export const ChatInputBar = React.forwardRef<ChatInputBarHandle, ChatInputBarProps>(({ onSend, onStop }, ref) => {
  const { isStreaming } = useChatStore();
  const hasRunningAgent = useAgentStore((s) => s.agentRuns.some((r) => r.status === 'running'));
  const isGenerating = isStreaming || hasRunningAgent;
  const { selectedAgentType, setSelectedAgentType } = useAgentStore();
  const { providers, defaultProviderId, selectedModelId, setDefaultProviderId, setSelectedModelId } =
    useSettingsStore();

  const [value, setValue] = useState('');
  const [enabledModels, setEnabledModels] = useState<ProviderModelConfig[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  React.useImperativeHandle(ref, () => ({
    prefill: (text: string) => {
      setValue(text);
      // Focus the textarea after prefill
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
  }));

  // Auto-select provider if only one enabled and none selected
  useEffect(() => {
    const enabled = providers.filter(p => p.isEnabled);
    if (!defaultProviderId && enabled.length > 0) {
      setDefaultProviderId(enabled[0].id);
    }
  }, [providers, defaultProviderId, setDefaultProviderId]);

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
        if (enabled.length > 0) {
          setEnabledModels(enabled);
          const stillValid = enabled.some((m) => m.modelId === selectedModelId);
          if (!stillValid) {
            setSelectedModelId(enabled[0]?.modelId ?? null);
          }
        } else {
          // No models explicitly enabled — fetch all available models as fallback
          invoke<string[]>('list_models', { providerId: defaultProviderId })
            .then((allModels) => {
              const asFake = allModels.map((id) => ({ modelId: id, enabled: true, providerId: defaultProviderId!, id: id, maxTokens: 4096, temperature: 0.7, createdAt: '', updatedAt: '' }));
              setEnabledModels(asFake);
              if (!allModels.includes(selectedModelId ?? '')) {
                setSelectedModelId(allModels[0] ?? null);
              }
            })
            .catch(() => {
              // Last resort: use provider's default model
              const prov = providers.find(p => p.id === defaultProviderId);
              if (prov?.model) {
                setEnabledModels([{ modelId: prov.model, enabled: true, providerId: prov.id, id: prov.model, maxTokens: 4096, temperature: 0.7, createdAt: '', updatedAt: '' }]);
                setSelectedModelId(prov.model);
              }
            });
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
    if (!trimmed || isGenerating) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isGenerating, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = value.trim().length > 0 && !isGenerating;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto w-full">
      <div
        className={cn(
          'relative flex flex-col rounded-2xl border transition-all duration-200',
          'bg-[var(--surface-2)] border-[var(--border)]',
          'focus-within:border-[var(--focus-border)] focus-within:shadow-[0_0_0_3px_var(--focus-glow),0_0_20px_var(--focus-glow)]'
        )}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder="How can I help you today?"
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent px-4 pt-3 pb-2',
            'text-sm leading-relaxed text-[var(--text)]',
            'placeholder:text-[var(--text-subtle)]',
            'custom-scrollbar',
            isGenerating && 'opacity-50 cursor-not-allowed'
          )}
          style={{ minHeight: '24px', maxHeight: `${MAX_HEIGHT}px`, outline: 'none' }}
        />

        <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
          <div className="flex items-center gap-2">
            <Select
              value={selectedAgentType}
              onValueChange={(val: any) => setSelectedAgentType(val)}
              disabled={isGenerating}
            >
              <SelectTrigger className="h-7 text-[11px] max-w-[120px] bg-[var(--surface-3)] border-[var(--border)]">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent side="top" align="start">
                {SELECTABLE_AGENTS.map((agent) => (
                  <SelectItem key={agent} value={agent}>
                    {AGENT_LABELS[agent]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <button
              type="button"
              disabled={isGenerating}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                'text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--hover-bg)]',
                'disabled:opacity-30 disabled:cursor-not-allowed'
              )}
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Provider selector */}
            {providers.filter((p) => p.isEnabled).length > 0 && (
              <Select value={defaultProviderId ?? undefined} onValueChange={setDefaultProviderId} disabled={isGenerating}>
                <SelectTrigger className="h-7 text-[11px] max-w-[120px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  {providers.filter((p) => p.isEnabled).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Model selector */}
            {enabledModels.length > 0 && (
              <Select value={selectedModelId ?? undefined} onValueChange={setSelectedModelId} disabled={isGenerating}>
                <SelectTrigger className="h-7 text-[11px] max-w-[160px]">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent side="top" align="end">
                  {enabledModels.map((m) => (
                    <SelectItem key={m.modelId} value={m.modelId}>{m.modelId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {isGenerating ? (
              <button
                type="button"
                onClick={onStop}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                  'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-95',
                )}
                title="Stop generating"
              >
                <Stop size={16} weight="fill" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-all',
                  canSend
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-95'
                    : 'bg-[var(--surface-3)] text-[var(--text-subtle)] cursor-not-allowed'
                )}
                title="Send (Enter)"
              >
                <ArrowUp size={16} weight="bold" />
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] text-[var(--text-subtle)] mt-2">
        Enter to send · Shift+Enter for newline
      </p>
      </div>
    </div>
  );
});

ChatInputBar.displayName = 'ChatInputBar';
