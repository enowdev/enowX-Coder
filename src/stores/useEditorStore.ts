import { create } from 'zustand';

export interface EditorTab {
  id: string;
  path: string;
  filename: string;
  content: string;
  language: string;
  isDirty: boolean;
  savedContent: string;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  setActiveTab: (id: string | null) => void;
  addTab: (tab: EditorTab) => void;
  removeTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveTab: (id: string) => void;
  getTabByPath: (path: string) => EditorTab | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  setActiveTab: (id) => set({ activeTabId: id }),
  addTab: (tab) =>
    set((s) => {
      const existing = s.tabs.find((t) => t.path === tab.path);
      if (existing) {
        return { activeTabId: existing.id };
      }
      return {
        tabs: [...s.tabs, tab],
        activeTabId: tab.id,
      };
    }),
  removeTab: (id) =>
    set((s) => {
      const newTabs = s.tabs.filter((t) => t.id !== id);
      const newActiveId =
        s.activeTabId === id ? newTabs[0]?.id || null : s.activeTabId;
      return { tabs: newTabs, activeTabId: newActiveId };
    }),
  updateTabContent: (id, content) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id
          ? { ...t, content, isDirty: content !== t.savedContent }
          : t
      ),
    })),
  saveTab: (id) =>
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === id ? { ...t, savedContent: t.content, isDirty: false } : t
      ),
    })),
  getTabByPath: (path) => get().tabs.find((t) => t.path === path),
}));
