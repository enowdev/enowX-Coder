import { create } from 'zustand';

export interface Command {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category: 'navigation' | 'chat' | 'view' | 'settings' | 'project';
  action: () => void;
  icon?: string;
}

interface CommandPaletteState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  commands: Command[];
  registerCommand: (command: Command) => void;
  unregisterCommand: (id: string) => void;
  executeCommand: (id: string) => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  commands: [],
  registerCommand: (command) => set((s) => ({
    commands: [...s.commands.filter(c => c.id !== command.id), command]
  })),
  unregisterCommand: (id) => set((s) => ({
    commands: s.commands.filter(c => c.id !== id)
  })),
  executeCommand: (id) => {
    const command = get().commands.find(c => c.id === id);
    if (command) {
      command.action();
      get().close();
    }
  },
}));
