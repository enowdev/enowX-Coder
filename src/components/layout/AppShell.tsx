import React, { useEffect } from 'react';
import { invoke, Channel } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { ChatHeader } from '@/components/layout/ChatHeader';

import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatInputBar, ChatInputBarHandle } from '@/components/chat/ChatInputBar';
import { PermissionDialog } from '@/components/chat/PermissionDialog';
import { useChatStore } from '@/stores/useChatStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useUIStore } from '@/stores/useUIStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { ExcalidrawCanvas } from '@/components/canvas/ExcalidrawCanvas';
import { AgentConfig, AgentRunWithTools, AgentType, Message, PermissionRequest, Project, Provider, ProviderModelConfig, Session, ToolCall } from '@/types';
import { cn } from '@/lib/utils';

export const AppShell: React.FC = () => {
  const { addMessage, appendStreamToken, setStreaming, clearStreaming, setMessages } = useChatStore();
  const setProjects = useProjectStore((s) => s.setProjects);
  const addProject = useProjectStore((s) => s.addProject);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setSessions = useSessionStore((s) => s.setSessions);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const { setProviders, setDefaultProviderId, defaultProviderId, selectedModelId, setSelectedModelId } = useSettingsStore();
  const leftSidebarOpen = useUIStore((s) => s.leftSidebarOpen);
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar);
  const rightSidebarOpen = useUIStore((s) => s.rightSidebarOpen);
  const mainView = useUIStore((s) => s.mainView);

  const {
    addAgentRun,
    setAgentRuns,
    updateAgentRun,
    appendAgentToken,
    flushThinkingBlock,
    setAgentConfigs,
    setPendingPermission,
    pendingPermission,
    selectedAgentType,
    agentConfigs,
  } = useAgentStore();

  const chatInputRef = React.useRef<ChatInputBarHandle>(null);

  // Track which sessions have already been auto-renamed to avoid duplicates
  const renamedSessionsRef = React.useRef<Set<string>>(new Set());

  const autoRenameSession = React.useCallback((sessionId: string) => {
    if (renamedSessionsRef.current.has(sessionId)) return;

    const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
    if (!session || session.title !== 'New Chat') return;

    renamedSessionsRef.current.add(sessionId);

    // Ask the LLM to generate a short title based on the conversation
    const { defaultProviderId: pid, selectedModelId: mid } = useSettingsStore.getState();
    invoke<string>('generate_title', {
      sessionId,
      providerId: pid ?? null,
      modelId: mid ?? null,
    })
      .then((title) => {
        if (title && title !== 'New Chat') {
          useSessionStore.getState().updateSessionTitle(sessionId, title);
          invoke('update_session_title', { id: sessionId, title }).catch(console.error);
        }
      })
      .catch((err) => {
        console.error('Auto-rename failed:', err);
        // Remove from set so it can retry next time
        renamedSessionsRef.current.delete(sessionId);
      });
  }, []);

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
    invoke<Provider[]>('list_providers')
      .then(async (ps) => {
        setProviders(ps);
        // Auto-select provider: default > first enabled > first any
        const def = ps.find((p) => p.isDefault && p.isEnabled);
        const firstEnabled = ps.find((p) => p.isEnabled);
        const picked = def ?? firstEnabled ?? ps[0];
        if (picked) {
          setDefaultProviderId(picked.id);
          // Auto-select first model if none selected
          if (!selectedModelId) {
            try {
              const models = await invoke<ProviderModelConfig[]>('list_provider_models', { providerId: picked.id });
              const enabled = models.filter((m) => m.enabled);
              if (enabled.length > 0) {
                setSelectedModelId(enabled[0].modelId);
              } else {
                // Fallback: fetch all available models
                const allModels = await invoke<string[]>('list_models', { providerId: picked.id });
                if (allModels.length > 0) setSelectedModelId(allModels[0]);
              }
            } catch {}
          }
        }
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
            .then((msgs) => {
              useChatStore.getState().setMessages(msgs);
              autoRenameSession(sessionId);
            })
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
          thinkingBlocks: [],
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
        flushThinkingBlock(agentRunId);
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
          flushThinkingBlock(agentRunId);
          updateAgentRun(agentRunId, {
            status: 'completed',
            output,
            completedAt: new Date().toISOString(),
          });

          // Auto-rename after agent completes
          const sessionId = useSessionStore.getState().activeSessionId;
          if (sessionId) {
            autoRenameSession(sessionId);
          }
        }
      );

      const unlistenAgentError = await listen<{ agentRunId: string; error: string }>(
        'agent-error',
        (event) => {
          const { agentRunId, error } = event.payload;
          flushThinkingBlock(agentRunId);
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
    flushThinkingBlock,
    updateAgentRun,
    setPendingPermission,
  ]);

  useEffect(() => {
    if (!activeSessionId) return;

    // Skip DB reload for sessions we just created — they're empty and we already
    // have the optimistic user message in the store. The reload would wipe it.
    if (justCreatedSessionRef.current.has(activeSessionId)) {
      justCreatedSessionRef.current.delete(activeSessionId);
      return;
    }

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
              thinkingBlocks: [],
              parentAgentRunId: run.parentAgentRunId ?? null,
              projectPath: run.projectPath ?? null,
            } as AgentRunWithTools;
          })
        );

        setAgentRuns(hydratedRuns);
      })
      .catch(console.error);
  }, [activeSessionId, setMessages, setAgentRuns]);

  // Track sessions we just created so the activeSessionId effect doesn't wipe messages
  const justCreatedSessionRef = React.useRef<Set<string>>(new Set());

  const ensureSession = async (): Promise<{ sessionId: string; projectPath: string } | null> => {
    let currentSessionId = useSessionStore.getState().activeSessionId;
    let currentProjectId = useProjectStore.getState().activeProjectId;
    const currentProjects = useProjectStore.getState().projects;

    // If we already have an active session, just return it
    if (currentSessionId) {
      const proj = currentProjects.find(p => p.id === currentProjectId);
      return { sessionId: currentSessionId, projectPath: proj?.path ?? '' };
    }

    try {
      // If no project exists, create a default one
      if (!currentProjectId || currentProjects.length === 0) {
        const project = await invoke<Project>('create_project', { name: 'Default', path: null });
        addProject(project);
        setActiveProjectId(project.id);
        currentProjectId = project.id;
      }

      // Create a new session
      const session = await invoke<Session>('create_session', { projectId: currentProjectId, title: 'New Chat' });
      addSession(session);
      // Mark as just-created so the effect doesn't wipe our optimistic messages
      justCreatedSessionRef.current.add(session.id);
      setActiveSessionId(session.id);
      return { sessionId: session.id, projectPath: currentProjects.find(p => p.id === currentProjectId)?.path ?? '' };
    } catch (err) {
      console.error('Failed to auto-create session:', err);
      return null;
    }
  };

  const handleSend = async (content: string) => {
    const ctx = await ensureSession();
    if (!ctx) return;

    const { sessionId: currentSessionId, projectPath } = ctx;

    if (selectedAgentType === 'orchestrator' || selectedAgentType === 'planner') {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        sessionId: currentSessionId,
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
          request: {
            sessionId: currentSessionId,
            agentType: selectedAgentType,
            task: content,
            projectPath,
            providerId: agentProviderId,
            modelId: agentModelId,
            fluxEnabled: useUIStore.getState().fluxEnabled,
          },
          onToken,
        });
      } catch (err) {
        console.error('run_agent error:', err);
      }
      return;
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sessionId: currentSessionId,
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
        sessionId: currentSessionId,
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

  const handleStop = async () => {
    const currentSessionId = useSessionStore.getState().activeSessionId;

    // 1. Stop chat streaming via backend cancellation
    const { isStreaming, streamingText, clearStreaming } = useChatStore.getState();
    if (isStreaming && currentSessionId) {
      try {
        await invoke('cancel_chat', { sessionId: currentSessionId });
      } catch (e) {
        console.error('Failed to cancel chat:', e);
      }
      // Save partial output as assistant message
      if (streamingText.trim()) {
        const partialMsg: Message = {
          id: crypto.randomUUID(),
          sessionId: currentSessionId,
          role: 'assistant',
          content: streamingText.trim(),
          createdAt: new Date().toISOString(),
        };
        useChatStore.getState().addMessage(partialMsg);
      }
      clearStreaming();
    }

    // 2. Cancel any running agent runs via backend cancellation
    if (currentSessionId) {
      const { agentRuns } = useAgentStore.getState();
      const runningAgents = agentRuns.filter((r) => r.status === 'running');
      if (runningAgents.length > 0) {
        try {
          // Cancel by session ID — this cancels the token that the agent runner uses
          await invoke('cancel_agent', { id: currentSessionId });
        } catch (e) {
          console.error('Failed to cancel agent:', e);
        }
        for (const run of runningAgents) {
          updateAgentRun(run.id, {
            status: 'failed',
            error: 'Stopped by user',
            completedAt: new Date().toISOString(),
          });
        }
      }
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
        gridTemplateColumns: `${leftSidebarOpen ? 'var(--sidebar-width-left)' : '0px'} 1fr ${rightSidebarOpen ? 'var(--sidebar-width-right)' : '0px'}`,
        gridTemplateRows: '1fr',
        transition: 'grid-template-columns 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div className={cn(
        'h-full overflow-hidden transition-opacity duration-200',
        leftSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}>
        <LeftSidebar />
      </div>

      <main className="flex flex-col overflow-hidden min-h-0">
        <ChatHeader onToggleLeftSidebar={!leftSidebarOpen ? toggleLeftSidebar : undefined} />
        {mainView === 'chat' ? (
          <>
            <ChatPanel onChipClick={(text) => chatInputRef.current?.prefill(text)} />
            <ChatInputBar ref={chatInputRef} onSend={handleSend} onStop={handleStop} />
          </>
        ) : (
          <ExcalidrawCanvas />
        )}
      </main>

      <div className={cn(
        'h-full overflow-hidden transition-opacity duration-200',
        rightSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}>
        <RightSidebar />
      </div>

      <SettingsModal />

      <PermissionDialog
        request={pendingPermission}
        onAllow={handlePermissionAllow}
        onDeny={handlePermissionDeny}
      />
    </div>
  );
};
