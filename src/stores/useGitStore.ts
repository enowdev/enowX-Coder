import { create } from 'zustand';

export interface GitStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface GitState {
  repoPath: string | null;
  setRepoPath: (path: string | null) => void;
  currentBranch: string | null;
  setCurrentBranch: (branch: string | null) => void;
  branches: GitBranch[];
  setBranches: (branches: GitBranch[]) => void;
  status: GitStatus[];
  setStatus: (status: GitStatus[]) => void;
  stagedFiles: Set<string>;
  stageFile: (path: string) => void;
  unstageFile: (path: string) => void;
  stageAll: () => void;
  unstageAll: () => void;
  commits: GitCommit[];
  setCommits: (commits: GitCommit[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useGitStore = create<GitState>((set) => ({
  repoPath: null,
  setRepoPath: (path) => set({ repoPath: path }),
  currentBranch: null,
  setCurrentBranch: (branch) => set({ currentBranch: branch }),
  branches: [],
  setBranches: (branches) => set({ branches }),
  status: [],
  setStatus: (status) => set({ status }),
  stagedFiles: new Set<string>(),
  stageFile: (path) =>
    set((s) => {
      const newStaged = new Set(s.stagedFiles);
      newStaged.add(path);
      return { stagedFiles: newStaged };
    }),
  unstageFile: (path) =>
    set((s) => {
      const newStaged = new Set(s.stagedFiles);
      newStaged.delete(path);
      return { stagedFiles: newStaged };
    }),
  stageAll: () =>
    set((s) => ({
      stagedFiles: new Set(s.status.map((f) => f.path)),
    })),
  unstageAll: () => set({ stagedFiles: new Set() }),
  commits: [],
  setCommits: (commits) => set({ commits }),
  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
