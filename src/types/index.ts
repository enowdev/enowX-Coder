export interface Project {
  id: string;
  name: string;
  path?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {

  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  providerType: string; // e.g., 'openai', 'anthropic', 'ollama'
  baseUrl: string;
  apiKey?: string;
  model: string;
  isDefault: boolean;
  isBuiltin: boolean;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderModelConfig {
  id: string;
  providerId: string;
  modelId: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: string;
  sessionId: string;
  agentType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: string;
  output?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  parentAgentRunId?: string | null;
  projectPath?: string | null;
}

export type AgentType =
  | 'orchestrator'
  | 'planner'
  | 'coder_fe'
  | 'coder_be'
  | 'security'
  | 'ux_researcher'
  | 'ui_designer'
  | 'tester'
  | 'reviewer'
  | 'researcher'
  | 'librarian';

export const SELECTABLE_AGENTS: AgentType[] = ['orchestrator', 'planner'];

export const AGENT_LABELS: Record<AgentType, string> = {
  orchestrator: 'Orchestrator',
  planner: 'Planner',
  coder_fe: 'Coder FE',
  coder_be: 'Coder BE',
  security: 'Security',
  ux_researcher: 'UX Researcher',
  ui_designer: 'UI Designer',
  tester: 'Tester',
  reviewer: 'Reviewer',
  researcher: 'Researcher',
  librarian: 'Librarian',
};

export interface AgentConfig {
  id: string;
  agentType: AgentType;
  providerId: string | null;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCall {
  id: string;
  agentRunId: string;
  toolName: 'read_file' | 'write_file' | 'list_dir' | 'search_files' | 'run_command' | 'web_search';
  input: string;
  output: string | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AgentRunWithTools extends AgentRun {
  toolCalls: ToolCall[];
  streamingText: string;
  thinkingBlocks: string[];
  parentAgentRunId: string | null;
  projectPath: string | null;
}

export interface PermissionRequest {
  type: 'sensitive_file' | 'outside_sandbox';
  path: string;
  agentType: AgentType;
  agentRunId: string;
}
