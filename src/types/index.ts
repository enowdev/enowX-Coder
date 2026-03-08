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
}
