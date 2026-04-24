import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { invoke } from '@tauri-apps/api/core';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { Sparkle, ArrowUp, CircleNotch } from '@phosphor-icons/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProviderModelConfig } from '@/types';
import { cn } from '@/lib/utils';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';

export const ExcalidrawCanvas: React.FC = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const theme = useUIStore((s) => s.theme);
  const { providers, defaultProviderId, selectedModelId, setDefaultProviderId, setSelectedModelId } = useSettingsStore();
  const [enabledModels, setEnabledModels] = useState<ProviderModelConfig[]>([]);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const lastSavedRef = useRef('');

  // Auto-select provider if only one enabled and none selected
  useEffect(() => {
    const enabled = providers.filter(p => p.isEnabled);
    if (!defaultProviderId && enabled.length > 0) {
      setDefaultProviderId(enabled[0].id);
    }
  }, [providers, defaultProviderId, setDefaultProviderId]);

  // Load enabled models when provider changes
  useEffect(() => {
    if (!defaultProviderId) { setEnabledModels([]); return; }
    invoke<ProviderModelConfig[]>('list_provider_models', { providerId: defaultProviderId })
      .then((models) => {
        const enabled = models.filter((m) => m.enabled);
        if (enabled.length > 0) {
          setEnabledModels(enabled);
          if (!enabled.some((m) => m.modelId === selectedModelId)) {
            setSelectedModelId(enabled[0]?.modelId ?? null);
          }
        } else {
          invoke<string[]>('list_models', { providerId: defaultProviderId })
            .then((allModels) => {
              const asFake = allModels.map((id) => ({ modelId: id, enabled: true, providerId: defaultProviderId!, id, maxTokens: 4096, temperature: 0.7, createdAt: '', updatedAt: '' }));
              setEnabledModels(asFake);
              if (!allModels.includes(selectedModelId ?? '')) {
                setSelectedModelId(allModels[0] ?? null);
              }
            })
            .catch(() => {
              const prov = providers.find(p => p.id === defaultProviderId);
              if (prov?.model) {
                setEnabledModels([{ modelId: prov.model, enabled: true, providerId: prov.id, id: prov.model, maxTokens: 4096, temperature: 0.7, createdAt: '', updatedAt: '' }]);
                setSelectedModelId(prov.model);
              }
            });
        }
      })
      .catch(() => { setEnabledModels([]); });
  }, [defaultProviderId]);

  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load drawing from DB when project changes
  useEffect(() => {
    if (!activeProjectId || !excalidrawAPI) return;
    isLoadingRef.current = true;

    invoke<{ data: string } | null>('get_drawing', { projectId: activeProjectId })
      .then((drawing) => {
        if (drawing?.data) {
          try {
            const parsed = JSON.parse(drawing.data);
            excalidrawAPI.updateScene({
              elements: parsed.elements || [],
            });
            lastSavedRef.current = drawing.data;
          } catch {}
        } else {
          excalidrawAPI.updateScene({ elements: [] });
          lastSavedRef.current = '';
        }
      })
      .catch(console.error)
      .finally(() => {
        setTimeout(() => { isLoadingRef.current = false; }, 500);
      });
  }, [activeProjectId, excalidrawAPI]);

  // Auto-save with debounce
  const handleChange = useCallback(
    (elements: readonly any[]) => {
      if (!activeProjectId || isLoadingRef.current) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const data = JSON.stringify({ elements });
        if (data === lastSavedRef.current) return;
        lastSavedRef.current = data;
        invoke('save_drawing', { projectId: activeProjectId, data }).catch(console.error);
      }, 1000);
    },
    [activeProjectId],
  );

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => { resizeTextarea(); }, [aiPrompt, resizeTextarea]);

  // AI generate elements
  const handleAiGenerate = useCallback(async () => {
    const prompt = aiPrompt.trim();
    if (!prompt || !excalidrawAPI || aiLoading) return;

    setAiLoading(true);
    setAiError(null);

    try {
      // Send existing elements as context so AI can edit them
      const existing = excalidrawAPI.getSceneElements().filter((e: any) => !e.isDeleted);
      const existingJson = existing.length > 0 ? JSON.stringify(existing) : null;

      const result = await invoke<string>('generate_excalidraw', {
        prompt,
        existingElements: existingJson,
        providerId: defaultProviderId ?? null,
        modelId: selectedModelId ?? null,
      });

      const newElements = JSON.parse(result);
      if (!Array.isArray(newElements)) {
        throw new Error('AI did not return a valid array of elements');
      }

      // Replace entire scene — AI returns the full updated set
      excalidrawAPI.updateScene({
        elements: newElements,
      });

      setAiPrompt('');
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to generate diagram';
      setAiError(msg);
      setTimeout(() => setAiError(null), 5000);
    } finally {
      setAiLoading(false);
    }
  }, [aiPrompt, excalidrawAPI, aiLoading, defaultProviderId, selectedModelId]);

  const canSend = aiPrompt.trim().length > 0 && !aiLoading;

  if (!activeProjectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)]">
        <p className="text-sm">Open a project to use the canvas.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 relative" style={{ height: '100%' }}>
      {/* Excalidraw Canvas — full height */}
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        onChange={handleChange}
        theme={theme}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            export: { saveFileToDisk: true },
          },
        }}
      />

      {/* AI Prompt Bar — floating at bottom center */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[480px] max-w-[calc(100%-32px)] z-[5]">
        <div
          className={cn(
            'relative flex flex-col rounded-2xl border transition-all duration-200',
            'bg-[var(--surface)]/95 backdrop-blur-md border-[var(--border)] shadow-xl shadow-[var(--shadow)]',
            'focus-within:border-[var(--focus-border)]'
          )}
        >
          <textarea
            ref={textareaRef}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleAiGenerate();
              }
            }}
            disabled={aiLoading}
            placeholder="Describe what to draw..."
            rows={1}
            className={cn(
              'w-full resize-none bg-transparent px-4 pt-3 pb-2',
              'text-sm leading-relaxed text-[var(--text)]',
              'placeholder:text-[var(--text-subtle)]',
              aiLoading && 'opacity-50 cursor-not-allowed'
            )}
            style={{ minHeight: '24px', maxHeight: '120px', outline: 'none' }}
          />

          <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)]">
                <Sparkle size={10} weight="fill" className="text-[var(--accent)]" />
                <span className="text-[9px] font-semibold text-[var(--text-muted)]">AI Canvas</span>
              </div>

              {aiError && (
                <span className="text-[9px] text-[var(--danger)] max-w-[150px] truncate" title={aiError}>
                  {aiError}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {providers.filter(p => p.isEnabled).length > 0 && (
                <Select value={defaultProviderId ?? undefined} onValueChange={setDefaultProviderId} disabled={aiLoading}>
                  <SelectTrigger className="h-6 text-[10px] max-w-[100px]">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent side="top" align="end">
                    {providers.filter(p => p.isEnabled).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {enabledModels.length > 0 && (
                <Select value={selectedModelId ?? undefined} onValueChange={setSelectedModelId} disabled={aiLoading}>
                  <SelectTrigger className="h-6 text-[10px] max-w-[130px]">
                    <SelectValue placeholder="Model" />
                  </SelectTrigger>
                  <SelectContent side="top" align="end">
                    {enabledModels.map((m) => (
                      <SelectItem key={m.modelId} value={m.modelId}>{m.modelId}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <button
                type="button"
                onClick={() => void handleAiGenerate()}
                disabled={!canSend}
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-lg transition-all',
                  canSend
                    ? 'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] active:scale-95'
                    : 'bg-[var(--surface-3)] text-[var(--text-subtle)] cursor-not-allowed'
                )}
                title="Generate (Enter)"
              >
                {aiLoading ? (
                  <CircleNotch size={14} weight="bold" className="animate-spin" />
                ) : (
                  <ArrowUp size={14} weight="bold" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
