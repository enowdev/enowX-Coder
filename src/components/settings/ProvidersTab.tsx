import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Provider, ProviderModelConfig } from '@/types';
import {
  Trash,
  PencilSimple,
  Check,
  X,
  ArrowsClockwise,
  Sparkle,
  CaretDown,
  CaretRight,
  CheckSquare,
  Square,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type ProviderType = 'enowxlabs' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

const FIXED_BASE_URL: Record<string, boolean> = {
  enowxlabs: true,
  openai: true,
  anthropic: true,
  gemini: true,
};

const PROVIDER_PRESETS: Record<ProviderType, { label: string; baseUrl: string; model: string }> = {
  enowxlabs: { label: 'enowX Labs', baseUrl: 'https://api.enowxlabs.com/v1', model: 'enowx-default' },
  openai:     { label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1',    model: 'gpt-4o' },
  anthropic:  { label: 'Anthropic',  baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
  gemini:     { label: 'Gemini',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  ollama:     { label: 'Ollama',     baseUrl: 'http://localhost:11434/v1',     model: 'llama3.2' },
  custom:     { label: 'Custom',     baseUrl: '',                              model: '' },
};

const SIDEBAR_ITEMS: ProviderType[] = ['enowxlabs', 'openai', 'anthropic', 'gemini', 'ollama', 'custom'];

interface ModelRowProps {
  modelName: string;
  config?: ProviderModelConfig;
  onUpdate: (modelId: string, patch: { enabled?: boolean; contextWindow?: number; temperature?: number }) => void;
}

const ModelRow: React.FC<ModelRowProps> = ({ modelName, config, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [contextWindow, setContextWindow] = useState(config?.maxTokens ?? 4096);
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.7);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setContextWindow(config?.maxTokens ?? 4096);
    setTemperature(config?.temperature ?? 0.7);
    setIsDirty(false);
  }, [config]);

  const handleSave = () => {
    onUpdate(modelName, { contextWindow, temperature });
    setIsDirty(false);
  };

  const toggleEnabled = () => {
    onUpdate(modelName, { enabled: !(config?.enabled ?? false) });
  };

  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-white/[0.02] transition-colors">
        <div className="relative flex items-center justify-center w-5 h-5 cursor-pointer shrink-0" onClick={toggleEnabled}>
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            readOnly
            className="peer appearance-none w-4 h-4 rounded border border-[var(--border)] bg-[var(--surface)] checked:bg-white checked:border-white transition-all cursor-pointer"
          />
          <Check size={10} weight="bold" className="absolute text-black opacity-0 peer-checked:opacity-100 pointer-events-none" />
        </div>

        <span className={cn('text-sm flex-1 truncate', config?.enabled ? 'text-[var(--text)]' : 'text-[var(--text-muted)]')}>
          {modelName}
        </span>

        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors rounded shrink-0"
        >
          {expanded ? <CaretDown size={13} /> : <CaretRight size={13} />}
        </button>
      </div>

      {expanded && (
        <div className="pb-3 pl-11 pr-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-subtle)] font-bold mb-1.5">
                Context Window
              </label>
              <input
                type="number"
                min={1}
                max={2000000}
                value={contextWindow}
                onChange={(e) => { setContextWindow(Number(e.target.value)); setIsDirty(true); }}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-white/30 transition-colors"
              />
              <p className="text-[9px] text-[var(--text-subtle)] mt-1">Total tokens (input + output)</p>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-subtle)] font-bold mb-1.5">
                Temperature
              </label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => { setTemperature(Number(e.target.value)); setIsDirty(true); }}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-white/30 transition-colors"
              />
            </div>
          </div>
          {isDirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="text-[10px] font-bold bg-white text-black px-2.5 py-1 rounded hover:bg-[#e5e5e5] transition-colors"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProvidersTab: React.FC = () => {
  const { providers, setProviders } = useSettingsStore();

  // Selected sidebar item — a providerType key, not a provider id
  const [selectedType, setSelectedType] = useState<ProviderType>('enowxlabs');

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelConfigs, setModelConfigs] = useState<Record<string, ProviderModelConfig>>({});
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const [apiKeyEdit, setApiKeyEdit] = useState('');
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const [baseUrlEdit, setBaseUrlEdit] = useState('');
  const [baseUrlDirty, setBaseUrlDirty] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameEdit, setNameEdit] = useState('');

  // The provider record for the currently selected type (may be null if not yet created)
  const selectedProvider = providers.find(p => p.providerType === selectedType) ?? null;

  const loadProviders = useCallback(async () => {
    try {
      const ps = await invoke<Provider[]>('list_providers');
      setProviders(ps);
    } catch (e) {
      console.error('list_providers error:', e);
    }
  }, [setProviders]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  // When selected type changes, reset all panel state
  useEffect(() => {
    setAvailableModels([]);
    setModelConfigs({});
    setModelsError(null);
    setApiKeyDirty(false);
    setBaseUrlDirty(false);
    setIsEditingName(false);

    const p = providers.find(pr => pr.providerType === selectedType) ?? null;
    setApiKeyEdit(p?.apiKey ?? '');
    setBaseUrlEdit(p?.baseUrl ?? PROVIDER_PRESETS[selectedType].baseUrl);
    setNameEdit(p?.name ?? PROVIDER_PRESETS[selectedType].label);

    if (!p) return;

    const fetchAll = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const [models, configs] = await Promise.all([
          invoke<string[]>('list_models', { providerId: p.id }),
          invoke<ProviderModelConfig[]>('list_provider_models', { providerId: p.id }),
        ]);
        setAvailableModels(models);
        const map: Record<string, ProviderModelConfig> = {};
        configs.forEach(c => { map[c.modelId] = c; });
        setModelConfigs(map);
      } catch (e) {
        setModelsError('Failed to load models. Check API key or connection.');
      } finally {
        setModelsLoading(false);
      }
    };
    fetchAll();
  }, [selectedType, providers.find(p => p.providerType === selectedType)?.id]);

  const refreshModels = async () => {
    if (!selectedProvider) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await invoke<string[]>('list_models', { providerId: selectedProvider.id });
      setAvailableModels(models);
    } catch (e) {
      setModelsError('Failed to load models. Check API key or connection.');
    } finally {
      setModelsLoading(false);
    }
  };

  // Ensure provider exists in DB (create if not), then run callback with it
  const ensureProvider = async (): Promise<Provider | null> => {
    if (selectedProvider) return selectedProvider;
    const preset = PROVIDER_PRESETS[selectedType];
    try {
      const created = await invoke<Provider>('create_provider', {
        name: preset.label,
        providerType: selectedType,
        baseUrl: preset.baseUrl || baseUrlEdit,
        apiKey: apiKeyEdit || null,
        model: preset.model,
      });
      await loadProviders();
      return created;
    } catch (e) {
      console.error('create_provider error:', e);
      return null;
    }
  };

  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    try {
      let p = selectedProvider;
      if (!p) {
        p = await ensureProvider();
        if (!p) return;
      }
      await invoke('update_provider', {
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: apiKeyEdit || null,
        model: p.model,
      });
      await loadProviders();
      setApiKeyDirty(false);
    } catch (e) {
      console.error('update_provider (apiKey) error:', e);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveBaseUrl = async () => {
    if (!selectedProvider) return;
    try {
      await invoke('update_provider', {
        id: selectedProvider.id,
        name: selectedProvider.name,
        baseUrl: baseUrlEdit,
        apiKey: selectedProvider.apiKey ?? null,
        model: selectedProvider.model,
      });
      await loadProviders();
      setBaseUrlDirty(false);
    } catch (e) {
      console.error('update_provider (baseUrl) error:', e);
    }
  };

  const handleSaveName = async () => {
    if (!selectedProvider) return;
    try {
      await invoke('update_provider', {
        id: selectedProvider.id,
        name: nameEdit,
        baseUrl: selectedProvider.baseUrl,
        apiKey: selectedProvider.apiKey ?? null,
        model: selectedProvider.model,
      });
      await loadProviders();
      setIsEditingName(false);
    } catch (e) {
      console.error('update_provider (name) error:', e);
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider || selectedProvider.isBuiltin) return;
    try {
      await invoke('delete_provider', { id: selectedProvider.id });
      await loadProviders();
    } catch (e) {
      console.error('delete_provider error:', e);
    }
  };

  const handleUpsertConfig = async (
    modelId: string,
    patch: { enabled?: boolean; contextWindow?: number; temperature?: number },
  ) => {
    if (!selectedProvider) return;
    const existing = modelConfigs[modelId];
    const enabled = patch.enabled ?? existing?.enabled ?? false;
    const maxTokens = patch.contextWindow ?? existing?.maxTokens ?? 4096;
    const temperature = patch.temperature ?? existing?.temperature ?? 0.7;
    try {
      const updated = await invoke<ProviderModelConfig>('upsert_provider_model', {
        providerId: selectedProvider.id,
        modelId,
        enabled,
        maxTokens,
        temperature,
      });
      setModelConfigs(prev => ({ ...prev, [modelId]: updated }));
    } catch (e) {
      console.error('upsert_provider_model error:', e);
    }
  };

  const handleCheckAll = async (enable: boolean) => {
    if (!selectedProvider) return;
    await Promise.all(
      availableModels.map(modelId => handleUpsertConfig(modelId, { enabled: enable }))
    );
  };

  const allEnabled = availableModels.length > 0 && availableModels.every(m => modelConfigs[m]?.enabled);
  const someEnabled = availableModels.some(m => modelConfigs[m]?.enabled);

  return (
    <div className="flex h-full text-[var(--text)]">
      {/* Sidebar */}
      <div className="w-52 shrink-0 border-r border-[var(--border)] flex flex-col h-full bg-[var(--surface-2)]/10">
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {SIDEBAR_ITEMS.map(type => {
            const exists = providers.some(p => p.providerType === type);
            const isBuiltin = providers.find(p => p.providerType === type)?.isBuiltin ?? false;
            return (
              <div
                key={type}
                onClick={() => setSelectedType(type)}
                className={cn(
                  'cursor-pointer px-3 py-2.5 mx-2 rounded-lg flex items-center gap-2.5 transition-colors',
                  selectedType === type
                    ? 'bg-white/10 text-white'
                    : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]'
                )}
              >
                {isBuiltin ? (
                  <Sparkle size={10} weight="fill" className="shrink-0 text-[var(--text-muted)]" />
                ) : (
                  <div className={cn('w-2 h-2 rounded-full shrink-0', exists ? 'bg-white/60' : 'bg-white/20')} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{PROVIDER_PRESETS[type].label}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-subtle)] truncate">{type}</div>
                </div>
                {exists && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" title="Configured" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col h-full bg-[var(--surface)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between pb-5 border-b border-[var(--border)]">
            <div>
              <div className="flex items-center gap-3">
                {isEditingName && selectedProvider ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameEdit}
                      onChange={(e) => setNameEdit(e.target.value)}
                      className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-base font-bold w-48 focus:border-white/40"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    />
                    <button onClick={handleSaveName} className="p-1 text-[var(--text-muted)] hover:text-white"><Check size={15} /></button>
                    <button onClick={() => setIsEditingName(false)} className="p-1 text-[var(--text-muted)] hover:text-white"><X size={15} /></button>
                  </div>
                ) : (
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    {selectedProvider?.name ?? PROVIDER_PRESETS[selectedType].label}
                    {selectedProvider && !selectedProvider.isBuiltin && (
                      <button onClick={() => setIsEditingName(true)} className="text-[var(--text-muted)] hover:text-white transition-colors">
                        <PencilSimple size={13} />
                      </button>
                    )}
                  </h1>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                  {selectedType}
                </span>
                {selectedProvider?.isBuiltin && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkle size={9} weight="fill" /> Built-in
                  </span>
                )}
                {!selectedProvider && (
                  <span className="text-[10px] text-[var(--text-subtle)]">Not configured</span>
                )}
              </div>
            </div>

            {selectedProvider && !selectedProvider.isBuiltin && (
              <button
                onClick={handleDeleteProvider}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
                title="Remove provider"
              >
                <Trash size={16} />
              </button>
            )}
          </div>

          {/* Configuration */}
          <div className="space-y-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Configuration</p>

            {/* Base URL — only for ollama/custom */}
            {!FIXED_BASE_URL[selectedType] && (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Base URL</label>
                <div className="flex gap-2">
                  <input
                    value={baseUrlEdit}
                    onChange={(e) => { setBaseUrlEdit(e.target.value); setBaseUrlDirty(true); }}
                    placeholder="http://localhost:11434/v1"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                  />
                  {baseUrlDirty && selectedProvider && (
                    <button
                      onClick={handleSaveBaseUrl}
                      className="px-3 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-[#e5e5e5] transition-colors"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* API Key */}
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyEdit}
                  onChange={(e) => { setApiKeyEdit(e.target.value); setApiKeyDirty(true); }}
                  placeholder={selectedType === 'ollama' ? 'Not required for local Ollama' : 'sk-...'}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                />
                {apiKeyDirty && (
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isSavingKey}
                    className="px-3 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-[#e5e5e5] transition-colors disabled:opacity-50"
                  >
                    {isSavingKey ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
              {selectedType === 'enowxlabs' && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                  Get your API key at{' '}
                  <a href="https://api.enowxlabs.com" target="_blank" rel="noreferrer" className="underline hover:text-white">
                    api.enowxlabs.com
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Available Models — only shown when provider is configured */}
          {selectedProvider && (
            <div className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Available Models</p>
                <div className="flex items-center gap-3">
                  {availableModels.length > 0 && !modelsLoading && (
                    <button
                      onClick={() => handleCheckAll(!allEnabled)}
                      className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-white transition-colors"
                    >
                      {allEnabled ? <CheckSquare size={13} weight="fill" /> : someEnabled ? <CheckSquare size={13} /> : <Square size={13} />}
                      {allEnabled ? 'Uncheck all' : 'Check all'}
                    </button>
                  )}
                  <button
                    onClick={refreshModels}
                    disabled={modelsLoading}
                    className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-white transition-colors disabled:opacity-50"
                  >
                    <ArrowsClockwise size={12} className={modelsLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface-2)]/20">
                {modelsLoading ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                    <ArrowsClockwise size={22} className="animate-spin mx-auto mb-2" />
                    Fetching models…
                  </div>
                ) : modelsError ? (
                  <div className="p-8 text-center space-y-2">
                    <p className="text-sm text-[var(--text-muted)]">{modelsError}</p>
                    <button onClick={refreshModels} className="text-xs underline text-[var(--text-muted)] hover:text-white">
                      Try again
                    </button>
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-xs">
                    No models found. Check your API key and try refreshing.
                  </div>
                ) : (
                  <div>
                    {availableModels.map(modelName => (
                      <ModelRow
                        key={modelName}
                        modelName={modelName}
                        config={modelConfigs[modelName]}
                        onUpdate={handleUpsertConfig}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt to save API key first if provider not yet created */}
          {!selectedProvider && (
            <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center space-y-1">
              <p className="text-xs text-[var(--text-muted)]">Enter your API key above and click Save to configure this provider.</p>
              <p className="text-[10px] text-[var(--text-subtle)]">Available models will appear once configured.</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
