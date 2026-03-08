import { create } from 'zustand';

interface UIState {
  rightSidebarOpen: boolean;
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightSidebarOpen: true,
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
}));
