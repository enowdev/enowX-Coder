import { useState } from 'react';
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
  CheckCircle,
  XCircle,
  CircleNotch,
  WarningCircle,
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
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const Icon = AGENT_ICONS[run.agentType as AgentType] || Robot;
  
  const children = allRuns.filter(r => r.parentAgentRunId === run.id);

  const getStatusBadge = () => {
    switch (run.status) {
      case 'pending':
        return <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-subtle)]">Pending</span>;
      case 'running':
        return <span className="text-[10px] uppercase tracking-wider font-bold text-white animate-pulse">Running</span>;
      case 'completed':
        return <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)]">Completed</span>;
      case 'failed':
        return <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] line-through">Failed</span>;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col space-y-3 mb-4",
        run.parentAgentRunId !== null
          ? "border-l-2 border-[var(--border)] ml-4 pl-3"
          : "w-full"
      )}
    >
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/30 overflow-hidden text-sm">
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center space-x-2">
            <Icon size={16} weight="duotone" className="text-[var(--text-muted)]" />
            <span className="font-medium text-[var(--text)]">
              {AGENT_LABELS[run.agentType as AgentType] || run.agentType}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
          </div>
        </div>

        <div className="p-3 space-y-3 text-[var(--text-muted)]">
          {run.streamingText && (
            <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {run.streamingText}
              {run.status === 'running' && <span className="animate-pulse">|</span>}
            </div>
          )}
          
          {!run.streamingText && run.status === 'running' && (
            <div className="flex items-center space-x-1 text-[var(--text-subtle)] h-4">
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {run.status === 'completed' && run.output && !run.streamingText && (
            <div className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
              {run.output}
            </div>
          )}

          {run.status === 'failed' && run.error && (
            <div className="italic text-[var(--text-muted)] text-[12px] flex items-start space-x-2">
              <WarningCircle size={16} className="mt-0.5 shrink-0" />
              <span>{run.error}</span>
            </div>
          )}

          {run.toolCalls && run.toolCalls.length > 0 && (
            <div className="pt-2 border-t border-[var(--border)]/50">
              <button
                onClick={() => setToolsExpanded(!toolsExpanded)}
                className="flex items-center space-x-1 text-[11px] font-medium text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors"
              >
                {toolsExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
                <span>Tools ({run.toolCalls.length})</span>
              </button>

              {toolsExpanded && (
                <div className="mt-2 space-y-2">
                  {run.toolCalls.map((tool) => (
                    <div key={tool.id} className="bg-[var(--surface-3)]/30 rounded border border-[var(--border)] p-2">
                      <div className="flex items-center space-x-2 mb-1 text-[11px]">
                        {tool.status === 'completed' && <CheckCircle size={12} className="text-[var(--text-muted)]" />}
                        {tool.status === 'failed' && <XCircle size={12} className="text-[var(--text-muted)]" />}
                        {tool.status === 'running' && <CircleNotch size={12} className="text-[var(--text-muted)] animate-spin" />}
                        {tool.status === 'pending' && <CircleNotch size={12} className="text-[var(--text-subtle)]" />}
                        <span className="font-mono text-[var(--text)]">{tool.toolName}</span>
                      </div>
                      <div className="font-mono text-[10px] text-[var(--text-subtle)] truncate">
                        {tool.input}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="flex flex-col space-y-3 mt-1">
          {children.map(child => (
            <AgentRunCard key={child.id} run={child} allRuns={allRuns} />
          ))}
        </div>
      )}
    </div>
  );
}
