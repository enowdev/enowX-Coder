import { useMemo, useState } from 'react';
import { AgentRunWithTools, AGENT_LABELS, AgentType } from '@/types';
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
  CaretRight,
  CaretDown,
  CircleNotch,
  Brain,
} from '@phosphor-icons/react';

interface AgentRunCardProps {
  run: AgentRunWithTools;
  allRuns: AgentRunWithTools[];
}

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

export function AgentRunCard({ run, allRuns }: AgentRunCardProps) {
  const [thinkingOpen, setThinkingOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [resultOpen, setResultOpen] = useState(true);

  const Icon = AGENT_ICONS[run.agentType as AgentType] || Robot;
  const children = allRuns.filter((r) => r.parentAgentRunId === run.id);
  const hasToolActivity = (run.toolCalls?.length ?? 0) > 0;

  const thinkingText = useMemo(() => {
    if (run.status === 'failed') return run.error ?? 'Execution failed.';
    if (run.status === 'running' && !hasToolActivity) {
      return run.streamingText.trim().length > 0
        ? `Analyzing: ${run.streamingText.trim()}`
        : 'Planning next action...';
    }
    if (run.status === 'running' && hasToolActivity) {
      return 'Context prepared. Proceeding to tool execution.';
    }
    if (run.status === 'completed') {
      return 'Reasoning phase completed.';
    }
    return 'Pending execution...';
  }, [run.status, run.streamingText, run.error, hasToolActivity]);

  return (
    <div
      className={cn(
        'flex flex-col space-y-3 mb-4',
        run.parentAgentRunId !== null ? 'border-l-2 border-[var(--border)] ml-4 pl-3' : 'w-full'
      )}
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 overflow-hidden text-sm">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex items-center space-x-2">
            <Icon size={16} weight="duotone" className="text-[var(--text-muted)]" />
            <span className="font-semibold text-[var(--text)] tracking-wide">
              {AGENT_LABELS[run.agentType as AgentType] || run.agentType}
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">
            {run.status}
          </span>
        </div>

        <div className="p-3 space-y-3">
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 overflow-hidden">
            <button
              onClick={() => setThinkingOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)]">
                <Brain size={13} weight="duotone" />
                <span>Thinking</span>
              </div>
              {thinkingOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
            </button>
            {thinkingOpen && (
              <div className="px-3 pb-3 text-[12px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                {thinkingText}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 overflow-hidden">
            <button
              onClick={() => setToolsOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-left"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)]">
                <Terminal size={13} weight="duotone" />
                <span>Execute Tools</span>
                <span className="text-[10px] tracking-normal normal-case">({run.toolCalls.length})</span>
              </div>
              {toolsOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
            </button>
            {toolsOpen && (
              <div className="px-3 pb-3 space-y-2">
                {run.toolCalls.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-subtle)]">No tool calls yet.</div>
                ) : (
                  run.toolCalls.map((tool) => (
                    <div key={tool.id} className="rounded border border-[var(--border)] bg-[var(--surface-3)]/40 p-2">
                      <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text)]">
                        {tool.status === 'running' && <CircleNotch size={12} className="animate-spin" />}
                        <span>{tool.toolName}</span>
                        <span className="text-[10px] text-[var(--text-subtle)]">{tool.status}</span>
                      </div>
                      <div className="mt-1 text-[10px] font-mono text-[var(--text-muted)] whitespace-pre-wrap break-all">
                        {tool.input}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          {(run.status === 'completed' || run.status === 'failed') && (
            <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/50 overflow-hidden">
              <button
                onClick={() => setResultOpen((v) => !v)}
                className="w-full flex items-center justify-between px-3 py-2 text-left"
              >
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-[var(--text-muted)]">
                  <Robot size={13} weight="duotone" />
                  <span>Result</span>
                </div>
                {resultOpen ? <CaretDown size={12} /> : <CaretRight size={12} />}
              </button>
              {resultOpen && (
                <div className="px-3 pb-3 text-[12px] leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                  {run.status === 'failed' ? run.error : run.output}
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="flex flex-col space-y-3 mt-1">
          {children.map((child) => (
            <AgentRunCard key={child.id} run={child} allRuns={allRuns} />
          ))}
        </div>
      )}
    </div>
  );
}
