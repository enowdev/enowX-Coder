import { useState, useEffect } from 'react';
import { GitBranch, Warning, Info, Circle, Lightning } from '@phosphor-icons/react';

interface StatusBarProps {
  currentFile?: string;
  line?: number;
  column?: number;
  language?: string;
  encoding?: string;
  gitBranch?: string;
  errors?: number;
  warnings?: number;
  aiProvider?: string;
  terminalActive?: boolean;
}

export function StatusBar({
  currentFile,
  line = 1,
  column = 1,
  language = 'plaintext',
  encoding = 'UTF-8',
  gitBranch,
  errors = 0,
  warnings = 0,
  aiProvider,
  terminalActive = false,
}: StatusBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-6 bg-[var(--surface)] border-t border-[var(--border)] flex items-center justify-between px-3 text-xs text-[var(--text-secondary)]">
      {/* Left section */}
      <div className="flex items-center gap-4">
        {/* Git branch */}
        {gitBranch && (
          <div className="flex items-center gap-1.5 hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
            <GitBranch size={12} weight="bold" />
            <span>{gitBranch}</span>
          </div>
        )}

        {/* Errors/Warnings */}
        {(errors > 0 || warnings > 0) && (
          <div className="flex items-center gap-3">
            {errors > 0 && (
              <div className="flex items-center gap-1 text-red-500 hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
                <Circle size={10} weight="fill" />
                <span>{errors}</span>
              </div>
            )}
            {warnings > 0 && (
              <div className="flex items-center gap-1 text-yellow-500 hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
                <Warning size={12} weight="fill" />
                <span>{warnings}</span>
              </div>
            )}
          </div>
        )}

        {/* AI Provider */}
        {aiProvider && (
          <div className="flex items-center gap-1.5 hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
            <Lightning size={12} weight="fill" className="text-[var(--accent)]" />
            <span>{aiProvider}</span>
          </div>
        )}
      </div>

      {/* Center section */}
      <div className="flex items-center gap-4">
        {currentFile && (
          <>
            {/* File info */}
            <div className="flex items-center gap-3">
              <span className="font-mono">{currentFile}</span>
              <span className="text-[var(--text-subtle)]">•</span>
              <span>Ln {line}, Col {column}</span>
            </div>

            {/* Language */}
            <div className="hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
              {language}
            </div>

            {/* Encoding */}
            <div className="hover:bg-[var(--surface-hover)] px-2 py-0.5 rounded cursor-pointer">
              {encoding}
            </div>
          </>
        )}
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Terminal indicator */}
        {terminalActive && (
          <div className="flex items-center gap-1.5 text-green-500">
            <Circle size={8} weight="fill" className="animate-pulse" />
            <span>Terminal</span>
          </div>
        )}

        {/* Time */}
        <div className="text-[var(--text-subtle)]">
          {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Info button */}
        <button
          className="hover:bg-[var(--surface-hover)] p-1 rounded"
          title="Show notifications"
        >
          <Info size={14} />
        </button>
      </div>
    </div>
  );
}
