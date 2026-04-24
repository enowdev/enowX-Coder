import React, { useState } from 'react';
import { Brain, CaretDown, CaretRight } from '@phosphor-icons/react';

interface ThinkingBlockProps {
  content: string;
  title?: string;
  defaultCollapsed?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  title = 'Thinking',
  defaultCollapsed = true,
}) => {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div>
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors py-1"
      >
        {collapsed ? <CaretRight size={10} weight="bold" /> : <CaretDown size={10} weight="bold" />}
        <Brain size={12} weight="duotone" />
        <span className="font-medium">{title}</span>
      </button>

      {!collapsed && (
        <div className="ml-5 pl-3 border-l-2 border-[var(--border)] text-[12px] leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap mt-1 mb-1">
          {content}
        </div>
      )}
    </div>
  );
};
