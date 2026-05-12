import { create } from 'zustand';

export interface SearchResult {
  path: string;
  line: number;
  column: number;
  text: string;
  match: string;
}

interface SearchState {
  query: string;
  setQuery: (query: string) => void;
  replaceText: string;
  setReplaceText: (text: string) => void;
  results: SearchResult[];
  setResults: (results: SearchResult[]) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;
  caseSensitive: boolean;
  toggleCaseSensitive: () => void;
  wholeWord: boolean;
  toggleWholeWord: () => void;
  useRegex: boolean;
  toggleUseRegex: () => void;
  isVisible: boolean;
  setVisible: (visible: boolean) => void;
  toggleVisible: () => void;
  selectedResult: number;
  setSelectedResult: (index: number) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  replaceText: '',
  setReplaceText: (text) => set({ replaceText: text }),
  results: [],
  setResults: (results) => set({ results, selectedResult: 0 }),
  isSearching: false,
  setIsSearching: (searching) => set({ isSearching: searching }),
  caseSensitive: false,
  toggleCaseSensitive: () => set((s) => ({ caseSensitive: !s.caseSensitive })),
  wholeWord: false,
  toggleWholeWord: () => set((s) => ({ wholeWord: !s.wholeWord })),
  useRegex: false,
  toggleUseRegex: () => set((s) => ({ useRegex: !s.useRegex })),
  isVisible: false,
  setVisible: (visible) => set({ isVisible: visible }),
  toggleVisible: () => set((s) => ({ isVisible: !s.isVisible })),
  selectedResult: 0,
  setSelectedResult: (index) => set({ selectedResult: index }),
}));
