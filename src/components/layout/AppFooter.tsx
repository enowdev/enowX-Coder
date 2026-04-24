import React from 'react';
import { GithubLogo, Heart, SidebarSimple } from '@phosphor-icons/react';
import { useUIStore } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

export const AppFooter: React.FC = () => {
  const { leftSidebarOpen, toggleLeftSidebar, rightSidebarOpen, toggleRightSidebar } = useUIStore();

  return (
    <footer
      className="h-9 flex items-center justify-between px-4 border-t border-[var(--border)] bg-[var(--surface)] shrink-0 col-span-3"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={toggleLeftSidebar}
          title={leftSidebarOpen ? 'Hide left panel' : 'Show left panel'}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
            leftSidebarOpen
              ? 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)]'
              : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
          )}
        >
          <SidebarSimple size={14} weight={leftSidebarOpen ? 'fill' : 'regular'} />
        </button>
        <span className="text-[10px] text-[var(--text-subtle)] tracking-wide select-none">
          enowX Coder v0.1.0
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)] select-none">
          Made with <Heart size={10} weight="fill" /> by enowdev
        </span>
        <a
          href="https://github.com/enowdev/enowX-Coder"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition-colors"
          title="GitHub"
        >
          <GithubLogo size={13} />
        </a>

        <div className="w-px h-3.5 bg-[var(--border)]" />

        <button
          onClick={toggleRightSidebar}
          title={rightSidebarOpen ? 'Hide right panel' : 'Show right panel'}
          className={cn(
            'flex items-center justify-center w-6 h-6 rounded-md transition-colors',
            rightSidebarOpen
              ? 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)]'
              : 'text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--hover-bg)]'
          )}
        >
          <SidebarSimple size={14} weight={rightSidebarOpen ? 'fill' : 'regular'} className="scale-x-[-1]" />
        </button>
      </div>
    </footer>
  );
};
