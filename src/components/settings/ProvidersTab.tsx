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

const PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string; model: string }> = {
  enowxlabs: { label: 'enowX Labs', baseUrl: 'https://api.enowxlabs.com/v1', model: 'enowx-default' },
  openai:     { label: 'OpenAI',     baseUrl: 'https://api.openai.com/v1',    model: 'gpt-4o' },
  anthropic:  { label: 'Anthropic',  baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
  gemini:     { label: 'Gemini',     baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  ollama:     { label: 'Ollama',     baseUrl: 'http://localhost:11434/v1',     model: 'llama3.2' },
};

const BUILTIN_TYPES: ProviderType[] = ['enowxlabs', 'openai', 'anthropic', 'gemini', 'ollama'];

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
      <div className="flex items-center gap-3 py-2.5 px-3 hover:bg-[var(--hover-bg)] transition-colors">
        <div className="relative flex items-center justify-center w-5 h-5 cursor-pointer shrink-0" onClick={toggleEnabled}>
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            readOnly
            className="peer appearance-none w-4 h-4 rounded border border-[var(--border)] bg-[var(--surface)] checked:bg-[var(--accent)] checked:border-[var(--accent)] transition-all cursor-pointer"
          />
          <Check size={10} weight="bold" className="absolute text-[var(--accent-fg)] opacity-0 peer-checked:opacity-100 pointer-events-none" />
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
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-[var(--focus-border)] transition-colors"
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
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-[var(--focus-border)] transition-colors"
              />
            </div>
          </div>
          {isDirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="text-[10px] font-bold bg-[var(--accent)] text-[var(--accent-fg)] px-2.5 py-1 rounded hover:bg-[var(--accent-hover)] transition-colors"
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

  const [modelEdit, setModelEdit] = useState('');
  const [modelDirty, setModelDirty] = useState(false);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameEdit, setNameEdit] = useState('');

  const [saveError, setSaveError] = useState<string | null>(null);

  // Manual model add
  const [manualModelName, setManualModelName] = useState('');

  // Add Provider form state
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newApiFormat, setNewApiFormat] = useState<'openai' | 'anthropic'>('openai');
  const [newSaving, setNewSaving] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

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
    setModelDirty(false);
    setIsEditingName(false);
    setSaveError(null);

    const p = providers.find(pr => pr.providerType === selectedType) ?? null;
    const preset = PROVIDER_PRESETS[selectedType];
    setApiKeyEdit(p?.apiKey ?? '');
    setBaseUrlEdit(p?.baseUrl ?? preset?.baseUrl ?? '');
    setModelEdit(p?.model ?? preset?.model ?? '');
    setNameEdit(p?.name ?? preset?.label ?? selectedType);

    if (!p) return;

    const fetchAll = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const [models, configs] = await Promise.all([
          invoke<string[]>('list_models', { providerId: p.id }).catch(() => [] as string[]),
          invoke<ProviderModelConfig[]>('list_provider_models', { providerId: p.id }),
        ]);
        // Merge: API models + any manually added models from DB configs
        const configModelIds = configs.map(c => c.modelId);
        const manualModels = configModelIds.filter(id => !models.includes(id));
        const allModels = [...models, ...manualModels];
        setAvailableModels(allModels);
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
    const resolvedModel = modelEdit.trim() || preset.model;
    if (!resolvedModel) {
      setSaveError('Model name is required. Enter a model name first.');
      return null;
    }
    try {
      setSaveError(null);
      const created = await invoke<Provider>('create_provider', {
        name: nameEdit || preset.label,
        providerType: selectedType,
        baseUrl: baseUrlEdit || preset.baseUrl,
        apiKey: apiKeyEdit || null,
        model: resolvedModel,
      });
      await loadProviders();
      return created;
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to create provider';
      setSaveError(msg);
      console.error('create_provider error:', e);
      return null;
    }
  };

  const handleSaveApiKey = async () => {
    setIsSavingKey(true);
    setSaveError(null);
    try {
      let p = selectedProvider;
      if (!p) {
        p = await ensureProvider();
        if (!p) return;
      }
      await invoke('update_provider', {
        id: p.id,
        name: p.name,
        baseUrl: baseUrlEdit || p.baseUrl,
        apiKey: apiKeyEdit || null,
        model: modelEdit.trim() || p.model,
      });
      await loadProviders();
      setApiKeyDirty(false);
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to save API key';
      setSaveError(msg);
      console.error('update_provider (apiKey) error:', e);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveBaseUrl = async () => {
    setSaveError(null);
    let p = selectedProvider;
    if (!p) {
      p = await ensureProvider();
      if (!p) return;
    }
    try {
      await invoke('update_provider', {
        id: p.id,
        name: p.name,
        baseUrl: baseUrlEdit,
        apiKey: p.apiKey ?? null,
        model: modelEdit.trim() || p.model,
      });
      await loadProviders();
      setBaseUrlDirty(false);
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to save base URL';
      setSaveError(msg);
      console.error('update_provider (baseUrl) error:', e);
    }
  };

  const handleSaveModel = async () => {
    setSaveError(null);
    const trimmedModel = modelEdit.trim();
    if (!trimmedModel) {
      setSaveError('Model name cannot be empty.');
      return;
    }
    let p = selectedProvider;
    if (!p) {
      p = await ensureProvider();
      if (!p) return;
    }
    try {
      await invoke('update_provider', {
        id: p.id,
        name: p.name,
        baseUrl: p.baseUrl,
        apiKey: p.apiKey ?? null,
        model: trimmedModel,
      });
      await loadProviders();
      setModelDirty(false);
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to save model';
      setSaveError(msg);
      console.error('update_provider (model) error:', e);
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
      setSelectedType('enowxlabs');
    } catch (e) {
      console.error('delete_provider error:', e);
    }
  };

  const handleToggleEnabled = async () => {
    if (!selectedProvider) return;
    try {
      await invoke('toggle_provider_enabled', { id: selectedProvider.id, enabled: !selectedProvider.isEnabled });
      await loadProviders();
    } catch (e) {
      console.error('toggle_provider_enabled error:', e);
    }
  };

  const handleAddProvider = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) { setNewError('Provider name is required.'); return; }
    if (!newBaseUrl.trim()) { setNewError('Base URL is required.'); return; }
    if (!newModel.trim()) { setNewError('Default model is required.'); return; }

    setNewSaving(true);
    setNewError(null);
    try {
      // Use a slug of the name as providerType
      const providerType = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const created = await invoke<Provider>('create_provider', {
        name: trimmedName,
        providerType,
        baseUrl: newBaseUrl.trim(),
        apiKey: newApiKey.trim() || null,
        model: newModel.trim(),
        apiFormat: newApiFormat,
      });
      await loadProviders();
      // Select the new provider
      setSelectedType(created.providerType as ProviderType);
      setAddingNew(false);
      setNewName(''); setNewBaseUrl(''); setNewApiKey(''); setNewModel(''); setNewApiFormat('openai');
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e as Error)?.message ?? 'Failed to create provider';
      setNewError(msg);
    } finally {
      setNewSaving(false);
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

  const handleAddModelManually = async () => {
    const name = manualModelName.trim();
    if (!name || !selectedProvider) return;
    // Add to available models list if not already there
    if (!availableModels.includes(name)) {
      setAvailableModels(prev => [...prev, name]);
    }
    // Auto-enable it
    await handleUpsertConfig(name, { enabled: true });
    setManualModelName('');
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
          {/* Built-in provider types */}
          {BUILTIN_TYPES.map(type => {
            const provider = providers.find(p => p.providerType === type);
            const exists = !!provider;
            return (
              <div
                key={type}
                onClick={() => { setSelectedType(type); setAddingNew(false); }}
                className={cn(
                  'cursor-pointer px-3 py-2.5 mx-2 rounded-lg flex items-center gap-2.5 transition-colors',
                  selectedType === type && !addingNew
                    ? 'bg-[var(--hover-bg-strong)] text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
                )}
              >
                <Sparkle size={10} weight="fill" className="shrink-0 text-[var(--text-muted)]" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{PROVIDER_PRESETS[type]?.label ?? type}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-subtle)] truncate">{type}</div>
                </div>
                {exists && provider.isEnabled && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" title="Active" />
                )}
                {exists && !provider.isEnabled && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--border)] shrink-0" title="Disabled" />
                )}
              </div>
            );
          })}

          {/* User-created providers */}
          {providers.filter(p => !BUILTIN_TYPES.includes(p.providerType as ProviderType) && p.providerType !== 'custom').length > 0 && (
            <div className="mx-4 my-2 border-t border-[var(--border)]" />
          )}
          {providers
            .filter(p => !BUILTIN_TYPES.includes(p.providerType as ProviderType))
            .map(p => (
              <div
                key={p.id}
                onClick={() => { setSelectedType(p.providerType as ProviderType); setAddingNew(false); }}
                className={cn(
                  'cursor-pointer px-3 py-2.5 mx-2 rounded-lg flex items-center gap-2.5 transition-colors',
                  selectedType === p.providerType && !addingNew
                    ? 'bg-[var(--hover-bg-strong)] text-[var(--text)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
                )}
              >
                <div className={cn('w-2 h-2 rounded-full shrink-0', p.isEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]')} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs truncate">{p.name}</div>
                  <div className="text-[9px] uppercase tracking-wider text-[var(--text-subtle)] truncate">{p.providerType}</div>
                </div>
                {p.isEnabled && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" title="Active" />
                )}
              </div>
            ))}
        </div>

        {/* Add Provider button */}
        <div className="p-2 border-t border-[var(--border)]">
          <button
            onClick={() => setAddingNew(true)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              addingNew
                ? 'bg-[var(--hover-bg-strong)] text-[var(--text)]'
                : 'text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text)]'
            )}
          >
            <span className="text-sm">+</span>
            Add Provider
          </button>
        </div>
      </div>

      {/* Content panel */}
      <div className="flex-1 flex flex-col h-full bg-[var(--surface)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Add Provider Form ── */}
          {addingNew ? (
            <>
              <div className="pb-5 border-b border-[var(--border)]">
                <h1 className="text-lg font-bold">Add Provider</h1>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">Add a custom OpenAI-compatible provider.</p>
              </div>

              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Provider Name</label>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Together AI, Groq, DeepSeek"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Base URL</label>
                  <input
                    value={newBaseUrl}
                    onChange={(e) => setNewBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Default Model</label>
                  <input
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    placeholder="e.g. deepseek-chat, llama-3.1-70b"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                  <p className="text-[9px] text-[var(--text-subtle)] mt-1">The model identifier used for API requests</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Format</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewApiFormat('openai')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                        newApiFormat === 'openai'
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--focus-border)]'
                      )}
                    >
                      OpenAI
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewApiFormat('anthropic')}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                        newApiFormat === 'anthropic'
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--focus-border)]'
                      )}
                    >
                      Anthropic
                    </button>
                  </div>
                  <p className="text-[9px] text-[var(--text-subtle)] mt-1">
                    Choose Anthropic for Claude-compatible gateways (enables prompt caching &amp; lower token usage)
                  </p>
                </div>

                {newError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)]">
                    <X size={14} className="text-[var(--danger)] shrink-0" />
                    <p className="text-xs text-[var(--danger)]">{newError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => void handleAddProvider()}
                    disabled={newSaving}
                    className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                  >
                    {newSaving ? 'Creating…' : 'Create Provider'}
                  </button>
                  <button
                    onClick={() => { setAddingNew(false); setNewError(null); }}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
          {/* ── Provider Detail Header ── */}
          <div className="flex items-start justify-between pb-5 border-b border-[var(--border)]">
            <div>
              <div className="flex items-center gap-3">
                {isEditingName && selectedProvider ? (
                  <div className="flex items-center gap-2">
                    <input
                      value={nameEdit}
                      onChange={(e) => setNameEdit(e.target.value)}
                      className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-base font-bold w-48 focus:border-[var(--focus-border)]"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setIsEditingName(false); }}
                    />
                    <button onClick={handleSaveName} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><Check size={15} /></button>
                    <button onClick={() => setIsEditingName(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text)]"><X size={15} /></button>
                  </div>
                ) : (
                  <h1 className="text-lg font-bold flex items-center gap-2">
                    {selectedProvider?.name ?? PROVIDER_PRESETS[selectedType]?.label ?? selectedType}
                    {selectedProvider && !selectedProvider.isBuiltin && (
                      <button onClick={() => setIsEditingName(true)} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
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
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] bg-[var(--hover-bg)] px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkle size={9} weight="fill" /> Built-in
                  </span>
                )}
                {!selectedProvider && (
                  <span className="text-[10px] text-[var(--text-subtle)]">Not configured</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Enable/Disable toggle */}
              {selectedProvider && (
                <button
                  onClick={() => void handleToggleEnabled()}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors',
                    selectedProvider.isEnabled
                      ? 'bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20'
                      : 'bg-[var(--surface-2)] text-[var(--text-subtle)] hover:text-[var(--text-muted)]'
                  )}
                  title={selectedProvider.isEnabled ? 'Disable this provider' : 'Enable this provider'}
                >
                  {selectedProvider.isEnabled ? 'Enabled' : 'Disabled'}
                </button>
              )}

              {/* Delete button (non-builtin only) */}
              {selectedProvider && !selectedProvider.isBuiltin && (
                <button
                  onClick={handleDeleteProvider}
                  className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-bg)] transition-colors"
                  title="Remove provider"
                >
                  <Trash size={16} />
                </button>
              )}
            </div>
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
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                  {baseUrlDirty && (
                    <button
                      onClick={handleSaveBaseUrl}
                      className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Model Name — for custom/ollama */}
            {!FIXED_BASE_URL[selectedType] && (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Default Model</label>
                <div className="flex gap-2">
                  <input
                    value={modelEdit}
                    onChange={(e) => { setModelEdit(e.target.value); setModelDirty(true); setSaveError(null); }}
                    placeholder="e.g. deepseek-v3, llama3.2, gpt-4o"
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                  />
                  {modelDirty && selectedProvider && (
                    <button
                      onClick={handleSaveModel}
                      className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors"
                    >
                      Save
                    </button>
                  )}
                </div>
                <p className="text-[9px] text-[var(--text-subtle)] mt-1">The model identifier used for API requests</p>
              </div>
            )}

            {/* API Format — for custom providers */}
            {!FIXED_BASE_URL[selectedType] && selectedProvider && (
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Format</label>
                <div className="flex gap-2">
                  {(['openai', 'anthropic'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={async () => {
                        try {
                          await invoke('update_provider', {
                            id: selectedProvider.id,
                            name: selectedProvider.name,
                            baseUrl: selectedProvider.baseUrl,
                            apiKey: selectedProvider.apiKey ?? null,
                            model: selectedProvider.model,
                            apiFormat: fmt,
                          });
                          await loadProviders();
                        } catch (e) {
                          console.error('update api_format error:', e);
                        }
                      }}
                      className={cn(
                        'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
                        selectedProvider.apiFormat === fmt
                          ? 'bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)]'
                          : 'bg-[var(--surface-2)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--focus-border)]'
                      )}
                    >
                      {fmt === 'openai' ? 'OpenAI' : 'Anthropic'}
                    </button>
                  ))}
                </div>
                <p className="text-[9px] text-[var(--text-subtle)] mt-1">
                  Choose Anthropic for Claude-compatible gateways (enables prompt caching &amp; lower token usage)
                </p>
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
                    className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-[var(--focus-border)] transition-colors"
                />
                {apiKeyDirty && (
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isSavingKey}
                    className="px-3 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-bold hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50"
                  >
                    {isSavingKey ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
              {selectedType === 'enowxlabs' && (
                <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                  Get your API key at{' '}
                  <a href="https://api.enowxlabs.com" target="_blank" rel="noreferrer" className="underline hover:text-[var(--text)]">
                    api.enowxlabs.com
                  </a>
                </p>
              )}
            </div>

            {/* Error message */}
            {saveError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--danger-bg)] border border-[var(--danger-border)]">
                <X size={14} className="text-[var(--danger)] shrink-0" />
                <p className="text-xs text-[var(--danger)]">{saveError}</p>
              </div>
            )}
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
                      className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {allEnabled ? <CheckSquare size={13} weight="fill" /> : someEnabled ? <CheckSquare size={13} /> : <Square size={13} />}
                      {allEnabled ? 'Uncheck all' : 'Check all'}
                    </button>
                  )}
                  <button
                    onClick={refreshModels}
                    disabled={modelsLoading}
                    className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors disabled:opacity-50"
                  >
                    <ArrowsClockwise size={12} className={modelsLoading ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>
              </div>

              {/* Add model manually */}
              <div className="flex gap-2">
                <input
                  value={manualModelName}
                  onChange={(e) => setManualModelName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleAddModelManually(); }}
                  placeholder="Add model manually (e.g. gpt-4o, claude-sonnet-4)"
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs focus:border-[var(--focus-border)] transition-colors"
                />
                <button
                  onClick={() => void handleAddModelManually()}
                  disabled={!manualModelName.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg-strong)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Add
                </button>
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
                    <button onClick={refreshModels} className="text-xs underline text-[var(--text-muted)] hover:text-[var(--text)]">
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
            </>
          )}

        </div>
      </div>
    </div>
  );
};
