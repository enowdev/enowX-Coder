import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useProjectStore } from '@/stores/useProjectStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { FolderOpen, Plus } from '@phosphor-icons/react';
import { generateId } from '@/lib/utils';
import { Project, Session } from '@/types';

export const ProjectSwitcher: React.FC = () => {
  const { addProject, setProjects, setActiveProjectId } = useProjectStore();
  const { addSession, setSessions, setActiveSessionId } = useSessionStore();

  const handleOpenFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (!selected || typeof selected !== 'string') return;

    const folderName = selected.split('/').filter(Boolean).pop() ?? selected;
    const now = new Date().toISOString();
    const projectId = generateId();
    const sessionId = generateId();

    addProject({ id: projectId, name: folderName, path: selected, createdAt: now, updatedAt: now });
    setActiveProjectId(projectId);
    addSession({ id: sessionId, projectId, title: 'New Chat', createdAt: now, updatedAt: now });
    setActiveSessionId(sessionId);

    try {
      const createdProject = await invoke<Project>('create_project', { name: folderName, path: selected });
      const currentProjects = useProjectStore.getState().projects;
      setProjects(currentProjects.map((project) => (project.id === projectId ? createdProject : project)));
      setActiveProjectId(createdProject.id);

      const sessionsAfterProjectCreate = useSessionStore.getState().sessions;
      setSessions(
        sessionsAfterProjectCreate.map((session) =>
          session.id === sessionId ? { ...session, projectId: createdProject.id } : session
        )
      );

      const createdSession = await invoke<Session>('create_session', {
        projectId: createdProject.id,
        title: 'New Chat',
      });
      const currentSessions = useSessionStore.getState().sessions;
      setSessions(currentSessions.map((session) => (session.id === sessionId ? createdSession : session)));
      setActiveSessionId(createdSession.id);
    } catch (error) {
      console.error('Failed to persist project/session:', error);
    }
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
