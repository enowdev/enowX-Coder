import { create } from 'zustand';

export interface QuickOpenItem {
  id: string;
  label: string;
  description?: string;
  path?: string;
  type: 'file' | 'command' | 'symbol' | 'recent';
  icon?: string;
}

interface QuickOpenState {
  isOpen: boolean;
  query: string;
  items: QuickOpenItem[];
  selectedIndex: number;
  mode: 'file' | 'command' | 'symbol' | 'line';
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setQuery: (query: string) => void;
  setItems: (items: QuickOpenItem[]) => void;
  setSelectedIndex: (index: number) => void;
  setMode: (mode: 'file' | 'command' | 'symbol' | 'line') => void;
  selectNext: () => void;
  selectPrevious: () => void;
}

export const useQuickOpenStore = create<QuickOpenState>((set) => ({
  isOpen: false,
  query: '',
  items: [],
  selectedIndex: 0,
  mode: 'file',
  setOpen: (open) => set({ isOpen: open, query: '', selectedIndex: 0 }),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen, query: '', selectedIndex: 0 })),
  setQuery: (query) => {
    // Detect mode from query prefix
    let mode: 'file' | 'command' | 'symbol' | 'line' = 'file';
    if (query.startsWith('>')) mode = 'command';
    else if (query.startsWith('@')) mode = 'symbol';
    else if (query.startsWith(':')) mode = 'line';
    
    set({ query, mode, selectedIndex: 0 });
  },
  setItems: (items) => set({ items, selectedIndex: 0 }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setMode: (mode) => set({ mode }),
  selectNext: () => set((s) => ({ 
    selectedIndex: s.selectedIndex < s.items.length - 1 ? s.selectedIndex + 1 : 0 
  })),
  selectPrevious: () => set((s) => ({ 
    selectedIndex: s.selectedIndex > 0 ? s.selectedIndex - 1 : s.items.length - 1 
  })),
}));
