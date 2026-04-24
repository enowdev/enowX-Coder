import React, { useMemo, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { AgentRunWithTools, ToolCall } from '@/types';
import { ToolExecutionBlock } from './ToolExecutionBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { MarkdownCodeBlock } from './MarkdownCodeBlock';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useAgentStore } from '@/stores/useAgentStore';
import { Sparkle, CircleNotch, Copy, Check } from '@phosphor-icons/react';
import { fixMarkdownTables } from '@/lib/utils';

const markdownComponents = {
  code: MarkdownCodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

interface AgentRunCardProps {
  run: AgentRunWithTools;
}

type TimelineEventItem =
  | { kind: 'thinking'; key: string; content: string }
  | { kind: 'tool_execution'; key: string; tool: ToolCall }
  | { kind: 'tool_failed'; key: string; tool: ToolCall }
  | { kind: 'result'; key: string; content: string };

/** Format duration between two ISO timestamps into a human-readable string */
const formatDuration = (startedAt?: string, completedAt?: string): string | null => {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.round(secs % 60);
  return `${mins}m ${remainSecs}s`;
};

export function AgentRunCard({ run }: AgentRunCardProps) {
  const normalizedBlocks = run.thinkingBlocks
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const liveStream = run.streamingText.trim();

  // Get model name from agent config or default provider
  const { agentConfigs } = useAgentStore();
  const { providers, selectedModelId } = useSettingsStore();
  const agentConfig = agentConfigs.find((c) => c.agentType === run.agentType);
  const modelName = agentConfig?.modelId
    ?? selectedModelId
    ?? providers.find((p) => p.isDefault)?.model
    ?? null;

  const duration = formatDuration(run.startedAt, run.completedAt);
  const isRunning = run.status === 'running';

  const events = useMemo<TimelineEventItem[]>(() => {
    const list: TimelineEventItem[] = [];

    // Thinking blocks (collapsed, from previous iterations)
    normalizedBlocks.forEach((block, i) => {
      list.push({ kind: 'thinking', key: `${run.id}-thinking-${i}`, content: block });
    });

    // Tool calls
    run.toolCalls.forEach((tool) => {
      if (tool.status === 'failed') {
        list.push({ kind: 'tool_failed', key: `${run.id}-${tool.id}-failed`, tool });
      } else {
        list.push({ kind: 'tool_execution', key: `${run.id}-${tool.id}-exec`, tool });
      }
    });

    // Live streaming text — show as result (markdown rendered) while generating
    if (run.status === 'running' && liveStream.length > 0) {
      list.push({ kind: 'result', key: `${run.id}-streaming`, content: liveStream });
    }

    // Final output
    if (run.status === 'completed' && run.output) {
      list.push({ kind: 'result', key: `${run.id}-result`, content: run.output });
    }

    if (run.status === 'failed' && run.error) {
      list.push({ kind: 'result', key: `${run.id}-result-failed`, content: run.error });
    }

    return list;
  }, [
    run.id,
    run.output,
    run.error,
    run.status,
    run.toolCalls,
    normalizedBlocks,
    liveStream,
  ]);

  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = run.output ?? run.error ?? '';
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [run.output, run.error]);

  return (
    <div className="flex gap-3 w-full">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkle size={14} weight="fill" className="text-[var(--accent-fg)]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {/* Agent type + status */}
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
          <span className="font-medium">{run.agentType}</span>
          {isRunning && (
            <>
              <span className="text-[var(--text-subtle)]">·</span>
              <CircleNotch size={11} weight="bold" className="text-[var(--accent)] animate-spin" />
            </>
          )}
        </div>

        {/* Events */}
        <div className="space-y-2">
          {events.map((event) => {
            if (event.kind === 'thinking') {
              return <ThinkingBlock key={event.key} content={event.content} defaultCollapsed={true} />;
            }

            if (event.kind === 'tool_execution') {
              return <ToolExecutionBlock key={event.key} tool={event.tool} defaultExpanded={false} />;
            }

            if (event.kind === 'tool_failed') {
              return <ToolExecutionBlock key={event.key} tool={event.tool} defaultExpanded={true} />;
            }

            // result (or live streaming)
            const isLiveStreaming = isRunning && event.key.endsWith('-streaming');
            return (
              <div key={event.key} className="ai-prose ai-prose-readable text-[var(--text)]">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={markdownComponents}
                >
                  {fixMarkdownTables(event.content)}
                </ReactMarkdown>
                {isLiveStreaming && (
                  <span className="inline-block w-0.5 h-4 bg-[var(--accent)] ml-0.5 align-middle animate-pulse rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom bar: copy + model + duration — only after generation is done */}
        {!isRunning && (run.output || run.error) && (
          <div className="flex items-center gap-3 pt-1 text-[11px] text-[var(--text-subtle)]">
            <button
              onClick={() => void handleCopy()}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-[var(--surface-2)] hover:text-[var(--text-muted)] transition-colors"
              title="Copy response"
            >
              {copied ? <Check size={12} weight="bold" className="text-[var(--accent)]" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {modelName && (
              <>
                <span>·</span>
                <span>{modelName}</span>
              </>
            )}

            {duration && (
              <>
                <span>·</span>
                <span>{duration}</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
