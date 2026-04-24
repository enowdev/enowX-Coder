import React, { useState } from 'react';
import { Robot, Code, ChartBar, TerminalWindow, Cpu, Books, SidebarSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';

type Tab = 'agents' | 'skills' | 'metrics';

export const RightSidebar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);

  const tabs = [
    { id: 'agents' as Tab, icon: Robot, label: 'Agents' },
    { id: 'skills' as Tab, icon: Books, label: 'Skills' },
    { id: 'metrics' as Tab, icon: ChartBar, label: 'Metrics' },
  ];

  return (
    <aside className="h-full bg-[var(--surface)] border-l border-[var(--border)] flex flex-col w-[var(--sidebar-width-right)]">
      <div className="flex items-center border-b border-[var(--border)]">
        <button
          onClick={toggleRightSidebar}
          className="p-2.5 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors shrink-0"
          title="Hide panel"
        >
          <SidebarSimple size={16} weight="fill" className="scale-x-[-1]" />
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-3 transition-all relative group",
              activeTab === tab.id 
                ? "text-[var(--text)]" 
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
          >
            <tab.icon size={20} weight={activeTab === tab.id ? "fill" : "regular"} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {activeTab === 'agents' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
              <Cpu size={14} weight="duotone" />
              Active Agents
            </h3>
            <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center mx-auto">
                <TerminalWindow size={20} weight="duotone" className="text-[var(--text)]" />
              </div>
              <p className="text-xs font-medium">No agents running</p>
              <p className="text-[10px] text-[var(--text-muted)]">Spawn an agent from the chat to see progress here.</p>
            </div>
          </div>
        )}

        {activeTab === 'skills' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
              <Code size={14} weight="duotone" />
              Available Skills
            </h3>
            <div className="grid grid-cols-1 gap-2">
              {['git-master', 'brainstorming', 'mnemosyne', 'plan-visualizer'].map(skill => (
                <div key={skill} className="p-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/30 hover:bg-[var(--surface-2)]/50 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--text)]">{skill}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--text-subtle)]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-4 text-center py-10">
            <ChartBar size={48} weight="duotone" className="text-[var(--border)] mx-auto mb-2" />
            <h3 className="text-sm font-bold">Session Metrics</h3>
            <p className="text-xs text-[var(--text-muted)]">Usage data will appear here once the session starts.</p>
          </div>
        )}
      </div>
    </aside>
  );
};
