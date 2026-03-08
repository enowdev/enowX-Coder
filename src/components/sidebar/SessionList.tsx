import React, { useState } from 'react';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { FolderSimple, ChatCircleText, Trash, CaretRight, Plus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/utils';

export const SessionList: React.FC = () => {
  const { sessions, activeSessionId, setActiveSessionId, removeSession, addSession } = useSessionStore();
  const { projects, activeProjectId } = useProjectStore();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => {
    return new Set(activeProjectId ? [activeProjectId] : []);
  });

  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleNewSession = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const now = new Date().toISOString();
    const session = { id: generateId(), projectId, title: 'New Chat', createdAt: now, updatedAt: now };
    addSession(session);
    setActiveSessionId(session.id);
    setExpandedProjects((prev) => new Set(prev).add(projectId));
  };

  if (projects.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <FolderSimple size={28} weight="duotone" className="text-[var(--border)] mb-2" />
        <p className="text-xs text-[var(--text-subtle)]">Open a folder to start</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
      {projects.map((project) => {
        const projectSessions = sessions.filter((s) => s.projectId === project.id);
        const isExpanded = expandedProjects.has(project.id);

        return (
          <div key={project.id}>
            <div
              className="group flex items-center gap-1.5 px-2 py-1.5 mx-1 rounded-md cursor-pointer hover:bg-white/5 transition-colors"
              onClick={() => toggleProject(project.id)}
            >
              <CaretRight
                size={11}
                weight="bold"
                className={cn(
                  'text-[var(--text-subtle)] transition-transform shrink-0',
                  isExpanded && 'rotate-90'
                )}
              />
              <FolderSimple
                size={14}
                weight={isExpanded ? 'fill' : 'regular'}
                className="text-[var(--text-muted)] shrink-0"
              />
              <span className="text-xs font-medium text-[var(--text-muted)] truncate flex-1 group-hover:text-[var(--text)]">
                {project.name}
              </span>
              <button
                onClick={(e) => handleNewSession(e, project.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-[var(--text-subtle)] hover:text-[var(--text)] transition-all"
                title="New chat"
              >
                <Plus size={12} />
              </button>
            </div>

            {isExpanded && (
              <div className="ml-4 border-l border-[var(--border)] pl-1 mb-1">
                {projectSessions.length === 0 ? (
                  <p className="text-[10px] text-[var(--text-subtle)] px-3 py-1.5">No chats yet</p>
                ) : (
                  projectSessions.map((session) => (
                    <div
                      key={session.id}
                      className={cn(
                        'group flex items-center gap-2 px-2 py-1.5 mx-1 rounded-md cursor-pointer transition-colors text-xs',
                        activeSessionId === session.id
                          ? 'bg-white/10 text-white'
                          : 'text-[var(--text-subtle)] hover:bg-white/5 hover:text-[var(--text-muted)]'
                      )}
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <ChatCircleText
                        size={13}
                        weight={activeSessionId === session.id ? 'fill' : 'regular'}
                        className="shrink-0"
                      />
                      <span className="truncate flex-1">{session.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeSession(session.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
                      >
                        <Trash size={11} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
