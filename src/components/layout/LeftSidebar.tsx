import React from 'react';
import { ProjectSwitcher } from '@/components/sidebar/ProjectSwitcher';
import { SessionList } from '@/components/sidebar/SessionList';
import { SidebarSimple, GearSix } from '@phosphor-icons/react';

export const LeftSidebar: React.FC = () => {
  return (
    <aside className="h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col w-[var(--sidebar-width-left)]">
      <div className="flex items-center gap-2 p-4 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-lg bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center">
          <SidebarSimple size={15} weight="fill" className="text-white" />
        </div>
        <span className="font-bold text-sm tracking-tight text-white">enowX Coder</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <ProjectSwitcher />
      </div>

      <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--text-subtle)] select-none">
        History
      </div>

      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <SessionList />
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors text-sm">
          <GearSix size={16} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
};
