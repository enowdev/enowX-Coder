import React, { useState } from 'react';
import { CaretDown, CaretRight, Terminal, WarningCircle } from '@phosphor-icons/react';
import { ToolCall } from '@/types';
import { cn } from '@/lib/utils';

interface ToolExecutionBlockProps {
  tool: ToolCall;
  defaultExpanded?: boolean;
}

const statusLabel = (status: ToolCall['status']) => {
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'done';
  if (status === 'running') return 'running';
  return 'queued';
};

export const ToolExecutionBlock: React.FC<ToolExecutionBlockProps> = ({
  tool,
  defaultExpanded = false,
}) => {
  const [open, setOpen] = useState(defaultExpanded);
  const isFailed = tool.status === 'failed';

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors py-1"
      >
        {open ? <CaretDown size={10} weight="bold" /> : <CaretRight size={10} weight="bold" />}
        <Terminal size={12} weight="duotone" />
        <span className="font-medium font-mono">{tool.toolName}</span>
        <span
          className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full',
            isFailed
              ? 'text-[var(--danger)] bg-[var(--danger-bg)]'
              : tool.status === 'running'
                ? 'text-[var(--accent)] bg-[var(--hover-bg)]'
                : 'text-[var(--text-subtle)] bg-[var(--surface-3)]',
          )}
        >
          {statusLabel(tool.status)}
        </span>
      </button>

      {open && (
        <div className="ml-5 pl-3 border-l-2 border-[var(--border)] space-y-1.5 mt-1 mb-1">
          <div className="font-mono text-[11px] text-[var(--text-muted)] whitespace-pre-wrap break-all bg-[var(--surface-2)] rounded-lg px-3 py-2">
            {`> ${tool.toolName} ${tool.input}`}
          </div>

          {tool.output && (
            <div className="font-mono text-[11px] text-[var(--text-subtle)] whitespace-pre-wrap break-all bg-[var(--surface-2)] rounded-lg px-3 py-2 max-h-48 overflow-y-auto custom-scrollbar">
              {tool.output}
            </div>
          )}

          {isFailed && (
            <div className="flex items-start gap-1.5 text-[11px] text-[var(--danger)] bg-[var(--danger-bg)] rounded-lg px-3 py-2">
              <WarningCircle size={13} className="mt-0.5 shrink-0" />
              <span>{tool.error ?? 'Tool execution failed.'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
