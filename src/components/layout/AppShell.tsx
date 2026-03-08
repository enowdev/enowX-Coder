import React, { useEffect } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ChatHeader } from '@/components/layout/ChatHeader';
import { AppFooter } from '@/components/layout/AppFooter';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { PermissionDialog } from '@/components/chat/PermissionDialog';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { AgentConfig, AgentRunWithTools, AgentType, Message, PermissionRequest, Project, Session, ToolCall } from '@/types';

export const AppShell: React.FC = () => {
  const { addMessage, appendStreamToken, setStreaming, clearStreaming, setMessages } = useChatStore();
  const setProjects = useProjectStore((s) => s.setProjects);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const projects = useProjectStore((s) => s.projects);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setSessions = useSessionStore((s) => s.setSessions);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const { setProviders, setDefaultProviderId, defaultProviderId, selectedModelId } = useSettingsStore();
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const {
    addAgentRun,
    setAgentRuns,
    updateAgentRun,
    appendAgentToken,
    clearAgentStreaming,
    setAgentConfigs,
    setPendingPermission,
    pendingPermission,
    selectedAgentType,
    agentConfigs,
  } = useAgentStore();

  useEffect(() => {
    const loadPersistedData = async () => {
      try {
        const loadedProjects = await invoke<Project[]>('list_projects');
        setProjects(loadedProjects);

        if (loadedProjects.length === 0) {
          setActiveProjectId(null);
          setSessions([]);
          setActiveSessionId(null);
          return;
        }

        const allSessions = (
          await Promise.all(
            loadedProjects.map((p) => invoke<Session[]>('list_sessions', { projectId: p.id }))
          )
        ).flat();
        setSessions(allSessions);

        const activeProject = [...loadedProjects].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setActiveProjectId(activeProject.id);

        const projectSessions = allSessions.filter((s) => s.projectId === activeProject.id);
        if (projectSessions.length === 0) {
          setActiveSessionId(null);
          return;
        }

        const activeSession = [...projectSessions].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0];
        setActiveSessionId(activeSession.id);
      } catch (error) {
        console.error('Failed to load projects and sessions:', error);
      }
    };

    void loadPersistedData();
  }, [setProjects, setActiveProjectId, setSessions, setActiveSessionId]);

  useEffect(() => {
    invoke<{ id: string; name: string; model: string; isDefault: boolean }[]>('list_providers')
      .then((ps) => {
        setProviders(ps as Parameters<typeof setProviders>[0]);
        const def = ps.find((p) => p.isDefault);
        if (def) setDefaultProviderId(def.id);
      })
      .catch(console.error);
  }, [setProviders, setDefaultProviderId]);

  useEffect(() => {
    invoke<AgentConfig[]>('list_agent_configs')
      .then(setAgentConfigs)
      .catch(console.error);
  }, [setAgentConfigs]);

  useEffect(() => {
    let cancelled = false;
    const localUnlisten: UnlistenFn[] = [];

    const setup = async () => {
      const unlistenChatDone = await listen<string>('chat-done', () => {
        clearStreaming();
        const sessionId = useSessionStore.getState().activeSessionId;
        if (sessionId) {
          invoke<Message[]>('get_messages', { sessionId })
            .then((msgs) => useChatStore.getState().setMessages(msgs))
            .catch(console.error);
        }
      });

      const unlistenChatError = await listen<string>('chat-error', (event) => {
        console.error('Chat error:', event.payload);
        clearStreaming();
      });

      const unlistenAgentStarted = await listen<{
        agentRunId: string;
        agentType: string;
        parentAgentRunId: string | null;
      }>('agent-started', (event) => {
        const { agentRunId, agentType, parentAgentRunId } = event.payload;
        if (useAgentStore.getState().agentRuns.some((r) => r.id === agentRunId)) {
          return;
        }

        const now = new Date().toISOString();
        const newRun: AgentRunWithTools = {
          id: agentRunId,
          sessionId: useSessionStore.getState().activeSessionId ?? '',
          agentType: agentType as AgentType,
          status: 'running',
          input: undefined,
          output: undefined,
          error: undefined,
          startedAt: now,
          completedAt: undefined,
          createdAt: now,
          toolCalls: [],
          streamingText: '',
          parentAgentRunId: parentAgentRunId,
          projectPath: null,
        };
        addAgentRun(newRun);
      });

      const unlistenAgentToken = await listen<{ agentRunId: string; token: string }>(
        'agent-token',
        (event) => {
          appendAgentToken(event.payload.agentRunId, event.payload.token);
        }
      );

      const unlistenAgentToolCall = await listen<{
        toolCallId: string;
        agentRunId: string;
        toolName: string;
        input: unknown;
      }>('agent-tool-call', (event) => {
        const { toolCallId, agentRunId, toolName, input } = event.payload;
        const now = new Date().toISOString();
        const newToolCall: ToolCall = {
          id: toolCallId,
          agentRunId,
          toolName: toolName as ToolCall['toolName'],
          input: typeof input === 'string' ? input : JSON.stringify(input),
          output: null,
          status: 'running',
          error: null,
          startedAt: now,
          completedAt: null,
          createdAt: now,
        };
        updateAgentRun(agentRunId, {
          toolCalls: (() => {
            const existing = useAgentStore
              .getState()
              .agentRuns.find((r) => r.id === agentRunId)?.toolCalls ?? [];
            if (existing.some((tc) => tc.id === newToolCall.id)) {
              return existing;
            }
            return [...existing, newToolCall];
          })(),
        });
      });

      const unlistenAgentToolResult = await listen<{
        toolCallId: string;
        output: string;
        isError: boolean;
      }>('agent-tool-result', (event) => {
        const { toolCallId, output, isError } = event.payload;
        const runs = useAgentStore.getState().agentRuns;
        const run = runs.find((r) => r.toolCalls.some((tc) => tc.id === toolCallId));
        if (!run) return;
        const updatedToolCalls = run.toolCalls.map((tc) =>
          tc.id === toolCallId
            ? {
                ...tc,
                output,
                status: (isError ? 'failed' : 'completed') as ToolCall['status'],
                completedAt: new Date().toISOString(),
              }
            : tc
        );
        updateAgentRun(run.id, { toolCalls: updatedToolCalls });
      });

      const unlistenAgentDone = await listen<{ agentRunId: string; output: string }>(
        'agent-done',
        (event) => {
          const { agentRunId, output } = event.payload;
          clearAgentStreaming(agentRunId);
          updateAgentRun(agentRunId, {
            status: 'completed',
            output,
            completedAt: new Date().toISOString(),
          });
        }
      );

      const unlistenAgentError = await listen<{ agentRunId: string; error: string }>(
        'agent-error',
        (event) => {
          const { agentRunId, error } = event.payload;
          clearAgentStreaming(agentRunId);
          updateAgentRun(agentRunId, {
            status: 'failed',
            error,
            completedAt: new Date().toISOString(),
          });
        }
      );

      const unlistenPermission = await listen<{
        agentRunId: string;
        type: 'sensitive_file' | 'outside_sandbox';
        path: string;
        agentType: string;
      }>('agent-permission-request', (event) => {
        const req: PermissionRequest = {
          agentRunId: event.payload.agentRunId,
          type: event.payload.type,
          path: event.payload.path,
          agentType: event.payload.agentType as AgentType,
        };
        setPendingPermission(req);
      });

      localUnlisten.push(
        unlistenChatDone,
        unlistenChatError,
        unlistenAgentStarted,
        unlistenAgentToken,
        unlistenAgentToolCall,
        unlistenAgentToolResult,
        unlistenAgentDone,
        unlistenAgentError,
        unlistenPermission,
      );

      if (cancelled) {
        localUnlisten.forEach((fn) => fn());
      }
    };

    void setup();

    return () => {
      cancelled = true;
      localUnlisten.forEach((fn) => fn());
    };
  }, [
    clearStreaming,
    addAgentRun,
    appendAgentToken,
    updateAgentRun,
    clearAgentStreaming,
    setPendingPermission,
  ]);

  useEffect(() => {
    if (!activeSessionId) return;
    invoke<Message[]>('get_messages', { sessionId: activeSessionId })
      .then(setMessages)
      .catch(console.error);

    invoke<AgentRunWithTools[]>('list_agent_runs', { sessionId: activeSessionId })
      .then(async (runs) => {
        const hydratedRuns = await Promise.all(
          runs.map(async (run) => {
            const toolCalls = await invoke<ToolCall[]>('list_tool_calls', { agentRunId: run.id }).catch(
              () => [] as ToolCall[]
            );

            return {
              ...run,
              toolCalls,
              streamingText: '',
              parentAgentRunId: run.parentAgentRunId ?? null,
              projectPath: run.projectPath ?? null,
            } as AgentRunWithTools;
          })
        );

        setAgentRuns(hydratedRuns);
      })
      .catch(console.error);
  }, [activeSessionId, setMessages, setAgentRuns]);

  const handleSend = async (content: string) => {
    if (!activeSessionId) {
      console.warn('No active session — open a folder first');
      return;
    }

    const activeProject = projects.find((p) => p.id === activeProjectId);
    const projectPath = activeProject?.path ?? '';

    if (selectedAgentType === 'orchestrator' || selectedAgentType === 'planner') {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: activeSessionId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
      };
      addMessage(userMsg);

      const agentConfig = agentConfigs.find((c) => c.agentType === selectedAgentType);
      const agentProviderId = agentConfig?.providerId ?? defaultProviderId ?? null;
      const agentModelId = agentConfig?.modelId ?? selectedModelId ?? null;

      const onToken = new Channel<string>();
      onToken.onmessage = () => {};

      try {
        await invoke('run_agent', {
          sessionId: activeSessionId,
          agentType: selectedAgentType,
          task: content,
          projectPath,
          providerId: agentProviderId,
          modelId: agentModelId,
          onToken,
        });
      } catch (err) {
        console.error('run_agent error:', err);
      }
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(userMsg);
    setStreaming(true);

    const onToken = new Channel<string>();
    onToken.onmessage = (token) => {
      appendStreamToken(token);
    };

    try {
      await invoke('send_message', {
        sessionId: activeSessionId,
        content,
        providerId: defaultProviderId ?? null,
        modelId: selectedModelId ?? null,
        onToken,
      });
    } catch (err) {
      console.error('send_message error:', err);
      clearStreaming();
    }
  };

  const handlePermissionAllow = () => {
    if (!pendingPermission) return;
    invoke('agent_permission_response', {
      agentRunId: pendingPermission.agentRunId,
      allowed: true,
    }).catch(console.error);
    setPendingPermission(null);
  };

  const handlePermissionDeny = () => {
    if (!pendingPermission) return;
    invoke('agent_permission_response', {
      agentRunId: pendingPermission.agentRunId,
      allowed: false,
    }).catch(console.error);
    setPendingPermission(null);
  };

  return (
    <div
      className="bg-[var(--bg)] text-[var(--text)] h-screen w-screen overflow-hidden"
      style={{
        display: 'grid',
        gridTemplateColumns: rightSidebarOpen
          ? 'var(--sidebar-width-left) 1fr var(--sidebar-width-right)'
          : 'var(--sidebar-width-left) 1fr',
        gridTemplateRows: '1fr auto',
        transition: 'grid-template-columns 0.2s ease',
      }}
    >
      <LeftSidebar />

      <main className="flex flex-col overflow-hidden min-h-0">
        <ChatHeader />
        <ChatPanel />
        <ChatInputBar onSend={handleSend} />
      </main>

      {rightSidebarOpen && <RightSidebar />}

      <AppFooter />

      <SettingsModal />

      <PermissionDialog
        request={pendingPermission}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
      />
    </div>
  );
};
