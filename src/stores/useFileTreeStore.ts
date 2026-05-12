import { create } from 'zustand';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
  size?: number;
  modified?: string;
}

interface FileTreeState {
  rootPath: string | null;
  setRootPath: (path: string | null) => void;
  files: FileNode[];
  setFiles: (files: FileNode[]) => void;
  selectedFile: string | null;
  setSelectedFile: (path: string | null) => void;
  expandedDirs: Set<string>;
  toggleDirectory: (path: string) => void;
  expandDirectory: (path: string) => void;
  collapseDirectory: (path: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useFileTreeStore = create<FileTreeState>((set) => ({
  rootPath: null,
  setRootPath: (path) => set({ rootPath: path }),
  files: [],
  setFiles: (files) => set({ files }),
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),
  expandedDirs: new Set<string>(),
  toggleDirectory: (path) =>
    set((s) => {
      const newExpanded = new Set(s.expandedDirs);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedDirs: newExpanded };
    }),
  expandDirectory: (path) =>
    set((s) => {
      const newExpanded = new Set(s.expandedDirs);
      newExpanded.add(path);
      return { expandedDirs: newExpanded };
    }),
  collapseDirectory: (path) =>
    set((s) => {
      const newExpanded = new Set(s.expandedDirs);
      newExpanded.delete(path);
      return { expandedDirs: newExpanded };
    }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
