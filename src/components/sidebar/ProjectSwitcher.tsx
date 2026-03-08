import React from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { FolderOpen, Plus } from '@phosphor-icons/react';
import { generateId } from '@/lib/utils';

export const ProjectSwitcher: React.FC = () => {
  const { addProject, setActiveProjectId } = useProjectStore();
  const { addSession, setActiveSessionId } = useSessionStore();

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;

    const folderName = selected.split('/').filter(Boolean).pop() ?? selected;
    const now = new Date().toISOString();
    const projectId = generateId();

    addProject({ id: projectId, name: folderName, path: selected, createdAt: now, updatedAt: now });
    setActiveProjectId(projectId);

    const sessionId = generateId();
    addSession({ id: sessionId, projectId, title: 'New Chat', createdAt: now, updatedAt: now });
    setActiveSessionId(sessionId);
  };

  return (
    <button
      onClick={handleOpenFolder}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors text-sm border border-dashed border-[var(--border)] hover:border-[var(--border-strong)]"
    >
      <FolderOpen size={15} />
      <span className="text-xs">Open folder</span>
      <Plus size={12} className="ml-auto opacity-50" />
    </button>
  );
};
