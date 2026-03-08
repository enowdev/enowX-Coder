import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { Provider, ProviderModelConfig } from '@/types';
import {
  Plus,
  Trash,
  PencilSimple,
  Check,
  X,
  Robot,
  ArrowsClockwise,
  Sparkle,
  CaretDown,
  CaretRight,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

type ProviderType = 'enowxlabs' | 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

const FIXED_BASE_URL: Record<string, boolean> = {
  enowxlabs: true,
  openai: true,
  anthropic: true,
  gemini: true,
};

const PROVIDER_PRESETS: Record<ProviderType, { label: string; providerType: ProviderType; baseUrl: string; model: string }> = {
  enowxlabs: { label: 'enowX Labs', providerType: 'enowxlabs', baseUrl: 'https://api.enowxlabs.com/v1', model: 'enowx-default' },
  openai: { label: 'OpenAI', providerType: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  anthropic: { label: 'Anthropic', providerType: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022' },
  gemini: { label: 'Gemini', providerType: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash' },
  ollama: { label: 'Ollama', providerType: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  custom: { label: 'Custom', providerType: 'custom', baseUrl: '', model: '' },
};

interface ProviderFormData {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const defaultForm: ProviderFormData = {
  name: '',
  providerType: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
};

function ProviderIcon({ type, isBuiltin }: { type: string; isBuiltin: boolean }) {
  if (isBuiltin) {
    return (
      <div className="w-5 h-5 rounded-md bg-white/5 flex items-center justify-center text-[var(--text-muted)]">
        <Sparkle size={12} weight="fill" />
      </div>
    );
  }
  
  let colorClass = "bg-[var(--text-muted)]";
  if (type === 'openai') colorClass = "bg-green-500/50";
  if (type === 'anthropic') colorClass = "bg-amber-700/50";
  if (type === 'gemini') colorClass = "bg-blue-500/50";
  if (type === 'ollama') colorClass = "bg-white/80";
  if (type === 'enowxlabs') colorClass = "bg-purple-500/50";

  return <div className={cn("w-2 h-2 rounded-full", colorClass)} />;
}

interface ModelRowProps {
  providerId: string;
  modelName: string;
  config?: ProviderModelConfig;
  onUpdate: (config: Partial<ProviderModelConfig> & { modelId: string }) => void;
}

const ModelRow: React.FC<ModelRowProps> = ({ modelName, config, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const [maxTokens, setMaxTokens] = useState(config?.maxTokens ?? 4096);
  const [temperature, setTemperature] = useState(config?.temperature ?? 0.7);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setMaxTokens(config?.maxTokens ?? 4096);
    setTemperature(config?.temperature ?? 0.7);
    setIsDirty(false);
  }, [config]);

  const handleSave = () => {
    onUpdate({
      modelId: modelName,
      maxTokens,
      temperature,
      enabled: config?.enabled ?? false,
    });
    setIsDirty(false);
  };

  const toggleEnabled = () => {
    onUpdate({
      modelId: modelName,
      enabled: !(config?.enabled ?? false),
      maxTokens,
      temperature
    });
  };

  return (
    <div className="group border-b border-[var(--border)] last:border-0">
      <div className="flex items-center gap-3 py-3 px-1 hover:bg-white/[0.02] transition-colors rounded-lg">
        <div 
          className="relative flex items-center justify-center w-5 h-5 cursor-pointer"
          onClick={toggleEnabled}
        >
          <input
            type="checkbox"
            checked={config?.enabled ?? false}
            readOnly
            className="peer appearance-none w-4 h-4 rounded border border-[var(--border)] bg-[var(--surface)] checked:bg-white checked:border-white transition-all cursor-pointer"
          />
          <Check size={10} weight="bold" className="absolute text-black opacity-0 peer-checked:opacity-100 pointer-events-none" />
        </div>
        
        <span className={cn("text-sm flex-1", config?.enabled ? "text-[var(--text)]" : "text-[var(--text-muted)]")}>
          {modelName}
        </span>

        <button 
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors rounded"
        >
          {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="pb-4 pl-9 pr-2 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-subtle)] font-bold mb-1.5">Max Tokens</label>
              <input
                type="number"
                min={1}
                max={200000}
                value={maxTokens}
                onChange={(e) => {
                  setMaxTokens(Number(e.target.value));
                  setIsDirty(true);
                }}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-white/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-[var(--text-subtle)] font-bold mb-1.5">Temperature</label>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={temperature}
                onChange={(e) => {
                  setTemperature(Number(e.target.value));
                  setIsDirty(true);
                }}
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1.5 text-xs text-[var(--text)] focus:border-white/30 transition-colors"
              />
            </div>
          </div>
          {isDirty && (
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="text-[10px] font-bold bg-white text-black px-2 py-1 rounded hover:bg-gray-200 transition-colors"
              >
                Save Config
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


export const ProvidersTab: React.FC = () => {
  const { providers, setProviders, addProvider, removeProvider } = useSettingsStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const [form, setForm] = useState<ProviderFormData>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelConfigs, setModelConfigs] = useState<Record<string, ProviderModelConfig>>({});
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  const [apiKeyEdit, setApiKeyEdit] = useState('');
  const [isSavingKey, setIsSavingKey] = useState(false);
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameEdit, setNameEdit] = useState('');

  const selectedProvider = providers.find(p => p.id === selectedId);

  useEffect(() => {
    invoke<Provider[]>('list_providers')
      .then(ps => {
        setProviders(ps);
        if (ps.length > 0 && !selectedId && !isAdding) {
          setSelectedId(ps[0].id);
        }
      })
      .catch(console.error);
  }, [setProviders]);

  useEffect(() => {
    if (!selectedProvider) return;
    
    setAvailableModels([]);
    setModelConfigs({});
    setModelsError(null);
    setApiKeyEdit(selectedProvider.apiKey || '');
    setNameEdit(selectedProvider.name);
    
    const fetchModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      try {
        const models = await invoke<string[]>('list_models', { providerId: selectedProvider.id });
        setAvailableModels(models);
      } catch (e) {
        console.error("Failed to list models", e);
        setModelsError("Failed to load models. Check API key or connection.");
      } finally {
        setModelsLoading(false);
      }
    };

    const fetchConfigs = async () => {
      try {
        const configs = await invoke<ProviderModelConfig[]>('list_provider_models', { providerId: selectedProvider.id });
        const map: Record<string, ProviderModelConfig> = {};
        configs.forEach(c => map[c.modelId] = c);
        setModelConfigs(map);
      } catch (e) {
        console.error("Failed to load model configs", e);
      }
    };

    fetchModels();
    fetchConfigs();
    
  }, [selectedProvider?.id]);

  const loadModels = async (providerId: string) => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const models = await invoke<string[]>('list_models', { providerId });
      setAvailableModels(models);
    } catch (e) {
      console.error("Failed to list models", e);
      setModelsError("Failed to load models. Check API key or connection.");
    } finally {
      setModelsLoading(false);
    }
  };

  const handleUpsertConfig = async (partial: Partial<ProviderModelConfig> & { modelId: string }) => {
    if (!selectedProvider) return;
    
    const { modelId, enabled = false, maxTokens = 4096, temperature = 0.7 } = partial;
    
    try {
      const updated = await invoke<ProviderModelConfig>('upsert_provider_model', {
        providerId: selectedProvider.id,
        modelId,
        enabled,
        maxTokens,
        temperature
      });
      
      setModelConfigs(prev => ({
        ...prev,
        [modelId]: updated
      }));
    } catch (e) {
      console.error("Failed to save model config", e);
    }
  };

  const handleSaveApiKey = async () => {
    if (!selectedProvider) return;
    setIsSavingKey(true);
    try {
      await invoke('update_provider', {
        ...selectedProvider,
        apiKey: apiKeyEdit
      });
      const updatedList = await invoke<Provider[]>('list_providers');
      setProviders(updatedList);
    } catch (e) {
      console.error("Failed to update API key", e);
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleSaveName = async () => {
    if (!selectedProvider) return;
    try {
      await invoke('update_provider', {
        ...selectedProvider,
        name: nameEdit
      });
      const updatedList = await invoke<Provider[]>('list_providers');
      setProviders(updatedList);
      setIsEditingName(false);
    } catch (e) {
      console.error("Failed to update name", e);
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider || selectedProvider.isBuiltin) return;
    if (!confirm(`Delete ${selectedProvider.name}?`)) return;
    
    try {
      await invoke('delete_provider', { id: selectedProvider.id });
      removeProvider(selectedProvider.id);
      setSelectedId(null);
    } catch (e) {
      console.error("Failed to delete provider", e);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const newProvider = await invoke<Provider>('create_provider', {
        name: form.name,
        providerType: form.providerType,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey || null,
        model: form.model,
      });
      addProvider(newProvider);
      setIsAdding(false);
      setSelectedId(newProvider.id);
      setForm(defaultForm);
    } catch (e) {
      console.error("Failed to create provider", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePreset = (key: ProviderType) => {
    const p = PROVIDER_PRESETS[key];
    setForm((prev) => ({
      ...prev,
      name: p.label,
      providerType: p.providerType,
      baseUrl: p.baseUrl,
      model: p.model,
    }));
  };

  return (
    <div className="flex h-full text-[var(--text)]">
      <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col h-full bg-[var(--surface-2)]/10">
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {providers.map(p => (
            <div
              key={p.id}
              onClick={() => {
                setSelectedId(p.id);
                setIsAdding(false);
              }}
              className={cn(
                "cursor-pointer px-3 py-2.5 mx-2 rounded-lg flex items-center gap-2.5 transition-colors",
                selectedId === p.id && !isAdding
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text)]"
              )}
            >
              <ProviderIcon type={p.providerType} isBuiltin={p.isBuiltin} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs truncate">{p.name}</div>
                <div className="text-[9px] uppercase tracking-wider text-[var(--text-subtle)] truncate">
                  {p.providerType}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-2 border-t border-[var(--border)]">
          <button
            onClick={() => {
              setIsAdding(true);
              setSelectedId(null);
            }}
            className={cn(
              "w-full text-xs flex items-center justify-center gap-2 px-3 py-2 rounded-lg border transition-all",
              isAdding 
                ? "bg-white text-black border-transparent font-semibold"
                : "text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--text)] hover:border-[var(--text-muted)]"
            )}
          >
            <Plus size={12} weight="bold" />
            Add Provider
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[var(--surface)] overflow-hidden">
        {isAdding ? (
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-md mx-auto space-y-6">
              <div>
                <h2 className="text-lg font-bold">Add New Provider</h2>
                <p className="text-xs text-[var(--text-muted)] mt-1">Configure a new LLM provider connection.</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PROVIDER_PRESETS) as ProviderType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handlePreset(key)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors',
                      form.providerType === key
                        ? 'border-white/40 text-white bg-white/5'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                    )}
                  >
                    {PROVIDER_PRESETS[key].label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Name</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                  />
                </div>

                {!FIXED_BASE_URL[form.providerType] && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Base URL</label>
                    <input
                      required
                      value={form.baseUrl}
                      onChange={(e) => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Key</label>
                  <input
                    type="password"
                    value={form.apiKey}
                    onChange={(e) => setForm(f => ({ ...f, apiKey: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                  />
                </div>
                
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">Default Model ID</label>
                  <input
                    required
                    value={form.model}
                    onChange={(e) => setForm(f => ({ ...f, model: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-4 py-2 rounded-lg text-xs font-semibold hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Provider'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : selectedProvider ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            <div className="flex items-start justify-between pb-6 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-3">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={nameEdit}
                        onChange={(e) => setNameEdit(e.target.value)}
                        className="bg-[var(--surface-2)] border border-[var(--border)] rounded px-2 py-1 text-base font-bold w-48 focus:border-white/40"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                      />
                      <button onClick={handleSaveName} className="p-1 hover:text-white text-green-500"><Check size={16} /></button>
                      <button onClick={() => setIsEditingName(false)} className="p-1 hover:text-white text-red-500"><X size={16} /></button>
                    </div>
                  ) : (
                    <h1 className="text-xl font-bold flex items-center gap-2">
                      {selectedProvider.name}
                      {!selectedProvider.isBuiltin && (
                        <button 
                          onClick={() => setIsEditingName(true)} 
                          className="text-[var(--text-muted)] hover:text-white transition-colors"
                        >
                          <PencilSimple size={14} />
                        </button>
                      )}
                    </h1>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                    {selectedProvider.providerType}
                  </span>
                  {selectedProvider.isBuiltin && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Sparkle size={10} weight="fill" /> Built-in
                    </span>
                  )}
                </div>
              </div>

              {!selectedProvider.isBuiltin && (
                <button
                  onClick={handleDeleteProvider}
                  className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                  title="Delete Provider"
                >
                  <Trash size={18} />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Configuration</label>
              <div className="bg-[var(--surface-2)]/30 rounded-xl p-4 border border-[var(--border)]">
                <div className="mb-3">
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1.5">API Key</label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKeyEdit}
                      onChange={(e) => setApiKeyEdit(e.target.value)}
                      placeholder={selectedProvider.isBuiltin ? "Managed automatically" : "sk-..."}
                      disabled={selectedProvider.isBuiltin}
                      className="flex-1 px-3 py-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-sm focus:border-white/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {!selectedProvider.isBuiltin && apiKeyEdit !== selectedProvider.apiKey && (
                      <button
                        onClick={handleSaveApiKey}
                        disabled={isSavingKey}
                        className="px-3 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-gray-200 transition-colors"
                      >
                        {isSavingKey ? 'Saving...' : 'Save'}
                      </button>
                    )}
                  </div>
                  {selectedProvider.providerType === 'enowxlabs' && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                      Get your API key at <a href="https://api.enowxlabs.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">api.enowxlabs.com</a>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 pb-8">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Available Models</label>
                <button
                  onClick={() => loadModels(selectedProvider.id)}
                  disabled={modelsLoading}
                  className="text-[10px] flex items-center gap-1.5 text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <ArrowsClockwise size={12} className={modelsLoading ? "animate-spin" : ""} />
                  Refresh List
                </button>
              </div>

              <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface-2)]/20">
                {modelsLoading ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-sm">
                    <ArrowsClockwise size={24} className="animate-spin mx-auto mb-2" />
                    Fetching models...
                  </div>
                ) : modelsError ? (
                  <div className="p-8 text-center">
                    <p className="text-red-400 text-sm mb-2">{modelsError}</p>
                    <button 
                      onClick={() => loadModels(selectedProvider.id)}
                      className="text-xs underline text-[var(--text-muted)] hover:text-white"
                    >
                      Try Again
                    </button>
                  </div>
                ) : availableModels.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-xs">
                    No models found. Check your API key.
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {availableModels.map(modelName => (
                      <ModelRow
                        key={modelName}
                        providerId={selectedProvider.id}
                        modelName={modelName}
                        config={modelConfigs[modelName]}
                        onUpdate={handleUpsertConfig}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] flex items-center justify-center mb-4">
              <Robot size={32} weight="duotone" className="opacity-50" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-1">Select a Provider</h3>
            <p className="text-xs max-w-[200px]">
              Choose a provider from the sidebar to configure settings and models.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
