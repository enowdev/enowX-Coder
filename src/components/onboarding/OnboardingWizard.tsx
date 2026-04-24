import React, { useState } from 'react';
import { Sparkle, ArrowRight, Check, Robot, FolderOpen } from '@phosphor-icons/react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { Provider, Project } from '@/types';
import { cn } from '@/lib/utils';

interface OnboardingWizardProps {
  onComplete: () => void;
}

type Step = 'welcome' | 'provider' | 'project' | 'done';

const PROVIDER_PRESETS = [
  { label: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', needsKey: true },
  { label: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-20241022', needsKey: true },
  { label: 'Ollama (local)', type: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', needsKey: false },
  { label: 'Custom', type: 'custom', baseUrl: '', model: '', needsKey: false },
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [projectName, setProjectName] = useState('My Project');

  const addProvider = useSettingsStore((s) => s.addProvider);
  const setDefaultProviderId = useSettingsStore((s) => s.setDefaultProviderId);
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProject = useProjectStore((s) => s.setActiveProjectId);

  const preset = PROVIDER_PRESETS[selectedPreset];

  const handleProviderNext = () => {
    const now = new Date().toISOString();
    const provider: Provider = {
      id: crypto.randomUUID(),
      name: preset.label,
      providerType: preset.type,
      baseUrl: baseUrl || preset.baseUrl,
      apiKey: apiKey || undefined,
      model: model || preset.model,
      isDefault: true,
      isBuiltin: false,
      isEnabled: true,
      apiFormat: (preset.type === 'anthropic' || preset.type === 'enowxlabs') ? 'anthropic' : 'openai',
      createdAt: now,
      updatedAt: now,
    };
    addProvider(provider);
    setDefaultProviderId(provider.id);
    setStep('project');
  };

  const handleProjectNext = () => {
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name: projectName.trim() || 'My Project',
      createdAt: now,
      updatedAt: now,
    };
    addProject(project);
    setActiveProject(project.id);
    setStep('done');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl shadow-[var(--shadow)] overflow-hidden">
        <div className="h-1 bg-[var(--surface-2)]">
          <div
            className="h-full bg-[var(--accent)] transition-all duration-500"
            style={{ width: step === 'welcome' ? '0%' : step === 'provider' ? '33%' : step === 'project' ? '66%' : '100%' }}
          />
        </div>

        <div className="p-8">
          {step === 'welcome' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center mx-auto">
                <Sparkle size={32} weight="duotone" className="text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Welcome to enowX Coder</h1>
                <p className="text-sm text-[var(--text-muted)]">
                  Your AI-powered coding assistant. Let's get you set up in 2 quick steps.
                </p>
              </div>
              <button
                onClick={() => setStep('provider')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold transition-colors"
              >
                Get Started <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          )}

          {step === 'provider' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Connect an LLM Provider</h2>
                <p className="text-xs text-[var(--text-muted)]">Choose how you want to power your AI assistant.</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {PROVIDER_PRESETS.map((p, i) => (
                  <button
                    key={p.type}
                    onClick={() => setSelectedPreset(i)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      selectedPreset === i
                        ? 'border-[var(--accent)] bg-[var(--hover-bg)] text-[var(--text)]'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50 text-[var(--text-muted)]'
                    )}
                  >
                    <Robot size={18} weight={selectedPreset === i ? 'fill' : 'regular'} className={selectedPreset === i ? 'text-[var(--accent)] mb-1' : 'mb-1'} />
                    <p className="text-xs font-semibold">{p.label}</p>
                  </button>
                ))}
              </div>

              {preset.needsKey && (
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
              )}

              {preset.type === 'custom' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Base URL</label>
                    <input
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Model</label>
                    <input
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="model-name"
                      className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>
                </>
              )}

              <button
                onClick={handleProviderNext}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold transition-colors"
              >
                Continue <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          )}

          {step === 'project' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-bold mb-1">Create Your First Project</h2>
                <p className="text-xs text-[var(--text-muted)]">Projects help you organize your conversations.</p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-muted)] mb-1">Project Name</label>
                <div className="relative">
                  <FolderOpen size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="My Project"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <button
                onClick={handleProjectNext}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold transition-colors"
              >
                Continue <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center mx-auto">
                <Check size={32} weight="bold" className="text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2">You're all set!</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  enowX Coder is ready. Start a new chat to begin.
                </p>
              </div>
              <button
                onClick={onComplete}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] font-semibold transition-colors"
              >
                Start Coding <Sparkle size={18} weight="fill" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
