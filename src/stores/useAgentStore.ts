import { create } from 'zustand';
import { AgentRunWithTools, AgentConfig, AgentType, PermissionRequest } from '@/types';

interface AgentState {
  agentRuns: AgentRunWithTools[];
  agentConfigs: AgentConfig[];
  selectedAgentType: AgentType;
  pendingPermission: PermissionRequest | null;

  setAgentRuns: (runs: AgentRunWithTools[]) => void;
  addAgentRun: (run: AgentRunWithTools) => void;
  updateAgentRun: (id: string, patch: Partial<AgentRunWithTools>) => void;
  appendAgentToken: (id: string, token: string) => void;
  clearAgentStreaming: (id: string) => void;

  setAgentConfigs: (configs: AgentConfig[]) => void;
  upsertAgentConfig: (config: AgentConfig) => void;

  setSelectedAgentType: (type: AgentType) => void;
  setPendingPermission: (req: PermissionRequest | null) => void;
}

export const useAgentStore = create<AgentState>((set) => ({
  agentRuns: [],
  agentConfigs: [],
  selectedAgentType: 'orchestrator',
  pendingPermission: null,

  setAgentRuns: (runs) => set({ agentRuns: runs }),
  addAgentRun: (run) => set((state) => ({ agentRuns: [...state.agentRuns, run] })),
  updateAgentRun: (id, patch) =>
    set((state) => ({
      agentRuns: state.agentRuns.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),
  appendAgentToken: (id, token) =>
    set((state) => ({
      agentRuns: state.agentRuns.map((r) =>
        r.id === id ? { ...r, streamingText: r.streamingText + token } : r,
      ),
    })),
  clearAgentStreaming: (id) =>
    set((state) => ({
      agentRuns: state.agentRuns.map((r) =>
        r.id === id ? { ...r, streamingText: '' } : r,
      ),
    })),

  setAgentConfigs: (configs) => set({ agentConfigs: configs }),
  upsertAgentConfig: (config) =>
    set((state) => {
      const exists = state.agentConfigs.some((c) => c.agentType === config.agentType);
      return {
        agentConfigs: exists
          ? state.agentConfigs.map((c) => (c.agentType === config.agentType ? config : c))
          : [...state.agentConfigs, config],
      };
    }),

  setSelectedAgentType: (type) => set({ selectedAgentType: type }),
  setPendingPermission: (req) => set({ pendingPermission: req }),
}));
