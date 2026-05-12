import { create } from 'zustand';

export interface TerminalSession {
  id: string;
  title: string;
  cwd: string;
  created: number;
}

interface TerminalState {
  sessions: TerminalSession[];
  activeSessionId: string | null;
  setActiveSession: (id: string | null) => void;
  addSession: (session: TerminalSession) => void;
  removeSession: (id: string) => void;
  updateSessionTitle: (id: string, title: string) => void;
  updateSessionCwd: (id: string, cwd: string) => void;
  isVisible: boolean;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  sessions: [],
  activeSessionId: null,
  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) =>
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: session.id,
    })),
  removeSession: (id) =>
    set((s) => {
      const newSessions = s.sessions.filter((sess) => sess.id !== id);
      const newActiveId =
        s.activeSessionId === id
          ? newSessions[0]?.id || null
          : s.activeSessionId;
      return { sessions: newSessions, activeSessionId: newActiveId };
    }),
  updateSessionTitle: (id, title) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, title } : sess
      ),
    })),
  updateSessionCwd: (id, cwd) =>
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, cwd } : sess
      ),
    })),
  isVisible: false,
  setVisible: (visible) => set({ isVisible: visible }),
  toggleVisible: () => set((s) => ({ isVisible: !s.isVisible })),
}));
