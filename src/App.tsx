import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { generateId } from '@/lib/utils';

function App() {
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        const session = {
          id: generateId(),
          projectId: activeProjectId ?? 'default',
          title: 'New Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addSession(session);
        setActiveSessionId(session.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProjectId, addSession, setActiveSessionId]);

  return <AppShell />;
}

export default App;
