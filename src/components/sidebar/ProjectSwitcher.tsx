import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { FolderOpen, CircleNotch } from '@phosphor-icons/react';
import { Project, Session } from '@/types';

export const ProjectSwitcher: React.FC = () => {
  const { addProject, setActiveProjectId } = useProjectStore();
  const { addSession, setActiveSessionId } = useSessionStore();
  const [loading, setLoading] = useState(false);

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;

    setLoading(true);
    try {
      const folderName = selected.split('/').filter(Boolean).pop() ?? selected;

      const project = await invoke<Project>('create_project', { name: folderName, path: selected });
      addProject(project);
      setActiveProjectId(project.id);

      const session = await invoke<Session>('create_session', { projectId: project.id, title: 'New Chat' });
      addSession(session);
      setActiveSessionId(session.id);
    } catch (error) {
      console.error('Failed to open folder:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleOpenFolder}
      disabled={loading}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)] transition-colors text-sm border border-dashed border-[var(--border)] hover:border-[var(--border-strong)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <CircleNotch size={15} className="animate-spin" />
      ) : (
        <FolderOpen size={15} />
      )}
      <span className="text-[13px]">{loading ? 'Opening…' : 'Open folder'}</span>
    </button>
  );
};
