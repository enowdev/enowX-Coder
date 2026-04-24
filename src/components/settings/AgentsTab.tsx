import { useState, useEffect } from 'react';
import { AgentConfig, AgentType, AGENT_LABELS } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '@/lib/utils';
import {
  Robot,
  TreeStructure,
  Code,
  Terminal,
  ShieldCheck,
  MagnifyingGlass,
  PaintBrush,
  TestTube,
  Eye,
  BookOpen,
  Books,
} from '@phosphor-icons/react';

const AGENT_TYPES: AgentType[] = [
  'orchestrator',
  'planner',
  'coder_fe',
  'coder_be',
  'security',
  'ux_researcher',
  'ui_designer',
  'tester',
  'reviewer',
  'researcher',
  'librarian',
];

const AGENT_ICONS: Record<AgentType, React.ElementType> = {
  orchestrator: Robot,
  planner: TreeStructure,
  coder_fe: Code,
  coder_be: Terminal,
  security: ShieldCheck,
  ux_researcher: MagnifyingGlass,
  ui_designer: PaintBrush,
  tester: TestTube,
  reviewer: Eye,
  researcher: BookOpen,
  librarian: Books,
};

export function AgentsTab() {
  const { providers } = useSettingsStore();
  const { agentConfigs, setAgentConfigs, upsertAgentConfig } = useAgentStore();
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('orchestrator');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [localConfig, setLocalConfig] = useState<{ providerId: string | null; modelId: string | null }>({
    providerId: null,
    modelId: null,
  });

  const Icon = AGENT_ICONS[selectedAgent];

  useEffect(() => {
    async function loadConfigs() {
      try {
        const configs = await invoke<AgentConfig[]>('list_agent_configs');
        setAgentConfigs(configs);
      } catch (err) {
        console.error('Failed to load agent configs:', err);
      }
    }
    loadConfigs();
  }, [setAgentConfigs]);

  useEffect(() => {
    const config = agentConfigs.find(c => c.agentType === selectedAgent);
    if (config) {
      setLocalConfig({ providerId: config.providerId, modelId: config.modelId });
    } else {
      setLocalConfig({ providerId: null, modelId: null });
    }
  }, [selectedAgent, agentConfigs]);

  useEffect(() => {
    async function loadModels() {
      if (!localConfig.providerId) {
        setModels([]);
        return;
      }
      try {
        const providerModels = await invoke<{ modelId: string; enabled: boolean }[]>('list_provider_models', {
          providerId: localConfig.providerId,
        });
        setModels(providerModels.filter(m => m.enabled).map(m => m.modelId));
      } catch (err) {
        console.error('Failed to load models for provider:', err);
        setModels([]);
      }
    }
    loadModels();
  }, [localConfig.providerId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const savedConfig = await invoke<AgentConfig>('upsert_agent_config', {
        agentType: selectedAgent,
        providerId: localConfig.providerId,
        modelId: localConfig.modelId,
      });
      upsertAgentConfig(savedConfig);
    } catch (err) {
      console.error('Failed to save agent config:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[500px] border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
      <div className="w-1/3 border-r border-[var(--border)] flex flex-col bg-[var(--surface-2)]/30">
        <div className="p-3 border-b border-[var(--border)] text-xs font-semibold uppercase tracking-wider text-[var(--text-subtle)]">
          Agents
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {AGENT_TYPES.map((type) => {
            const ItemIcon = AGENT_ICONS[type];
            return (
              <button
                key={type}
                onClick={() => setSelectedAgent(type)}
                className={cn(
                  "w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  selectedAgent === type
                    ? "bg-[var(--surface-3)] text-[var(--text)] font-medium"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                )}
              >
                <ItemIcon size={16} weight={selectedAgent === type ? "duotone" : "regular"} />
                <span>{AGENT_LABELS[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="p-6 border-b border-[var(--border)] flex items-center space-x-3 bg-[var(--surface)]">
          <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
            <Icon size={20} weight="duotone" className="text-[var(--text)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">{AGENT_LABELS[selectedAgent]}</h2>
            <p className="text-xs text-[var(--text-muted)] font-mono">{selectedAgent}</p>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto bg-[var(--surface-2)]/10">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-[var(--text)] mb-1">Model Override</h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Configure a specific provider and model for this agent. If left unconfigured, the agent will use the default provider and model.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">
                  Provider
                </label>
                <select
                  value={localConfig.providerId || ''}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, providerId: e.target.value || null, modelId: null }))}
                  className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--text-subtle)] transition-colors appearance-none"
                >
                  <option value="">Use Default Provider</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {localConfig.providerId && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-[var(--text-subtle)] uppercase tracking-wider">
                    Model
                  </label>
                  <select
                    value={localConfig.modelId || ''}
                    onChange={(e) => setLocalConfig(prev => ({ ...prev, modelId: e.target.value || null }))}
                    className="w-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--text-subtle)] transition-colors appearance-none"
                  >
                    <option value="" disabled>Select a model</option>
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {!localConfig.providerId && (
              <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-3 text-xs text-[var(--text-muted)] flex items-center space-x-2">
                <Robot size={16} weight="duotone" />
                <span>Currently using default provider model.</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex justify-end bg-[var(--surface)]">
          <button
            onClick={handleSave}
            disabled={loading || (localConfig.providerId !== null && localConfig.modelId === null)}
            className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium rounded-lg hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
