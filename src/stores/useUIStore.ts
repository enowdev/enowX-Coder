import { create } from 'zustand';

export type Theme = 'dark' | 'light';
export type MainView = 'chat' | 'canvas';

interface UIState {
  leftSidebarOpen: boolean;
  toggleLeftSidebar: () => void;
  setLeftSidebarOpen: (open: boolean) => void;
  rightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  fluxEnabled: boolean;
  toggleFlux: () => void;
  mainView: MainView;
  setMainView: (view: MainView) => void;
}

const getStoredTheme = (): Theme => {
  try {
    const stored = localStorage.getItem('enowx-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return 'dark';
};

export const useUIStore = create<UIState>((set) => ({
  leftSidebarOpen: true,
  toggleLeftSidebar: () => set((s) => ({ leftSidebarOpen: !s.leftSidebarOpen })),
  setLeftSidebarOpen: (open) => set({ leftSidebarOpen: open }),
  rightSidebarOpen: true,
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  theme: getStoredTheme(),
  setTheme: (theme) => {
    localStorage.setItem('enowx-theme', theme);
    set({ theme });
  },
  toggleTheme: () => set((s) => {
    const next = s.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('enowx-theme', next);
    return { theme: next };
  }),
  fluxEnabled: true,
  toggleFlux: () => set((s) => ({ fluxEnabled: !s.fluxEnabled })),
  mainView: 'chat' as MainView,
  setMainView: (view) => set({ mainView: view }),
}));
