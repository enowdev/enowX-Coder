import { create } from 'zustand';

export interface AISuggestion {
  id: string;
  type: 'completion' | 'refactor' | 'fix' | 'optimize' | 'test';
  title: string;
  description: string;
  code: string;
  file: string;
  line: number;
  confidence: number;
  accepted?: boolean;
}

export interface PairProgrammingSession {
  active: boolean;
  mode: 'copilot' | 'composer' | 'chat';
  currentFile?: string;
  suggestions: AISuggestion[];
  history: AISuggestion[];
}

interface PairProgrammingState {
  session: PairProgrammingSession;
  isEnabled: boolean;
  autoSuggest: boolean;
  suggestionDelay: number;
  
  // Actions
  toggleEnabled: () => void;
  setMode: (mode: 'copilot' | 'composer' | 'chat') => void;
  setCurrentFile: (file: string) => void;
  addSuggestion: (suggestion: AISuggestion) => void;
  acceptSuggestion: (id: string) => void;
  rejectSuggestion: (id: string) => void;
  clearSuggestions: () => void;
  setAutoSuggest: (enabled: boolean) => void;
  setSuggestionDelay: (delay: number) => void;
}

export const usePairProgrammingStore = create<PairProgrammingState>((set) => ({
  session: {
    active: false,
    mode: 'copilot',
    suggestions: [],
    history: [],
  },
  isEnabled: true,
  autoSuggest: true,
  suggestionDelay: 1000,

  toggleEnabled: () => set((s) => ({ 
    isEnabled: !s.isEnabled,
    session: { ...s.session, active: !s.isEnabled }
  })),

  setMode: (mode) => set((s) => ({
    session: { ...s.session, mode }
  })),

  setCurrentFile: (file) => set((s) => ({
    session: { ...s.session, currentFile: file }
  })),

  addSuggestion: (suggestion) => set((s) => ({
    session: {
      ...s.session,
      suggestions: [...s.session.suggestions, suggestion]
    }
  })),

  acceptSuggestion: (id) => set((s) => {
    const suggestion = s.session.suggestions.find(sug => sug.id === id);
    if (!suggestion) return s;

    return {
      session: {
        ...s.session,
        suggestions: s.session.suggestions.filter(sug => sug.id !== id),
        history: [...s.session.history, { ...suggestion, accepted: true }]
      }
    };
  }),

  rejectSuggestion: (id) => set((s) => {
    const suggestion = s.session.suggestions.find(sug => sug.id === id);
    if (!suggestion) return s;

    return {
      session: {
        ...s.session,
        suggestions: s.session.suggestions.filter(sug => sug.id !== id),
        history: [...s.session.history, { ...suggestion, accepted: false }]
      }
    };
  }),

  clearSuggestions: () => set((s) => ({
    session: { ...s.session, suggestions: [] }
  })),

  setAutoSuggest: (enabled) => set({ autoSuggest: enabled }),
  
  setSuggestionDelay: (delay) => set({ suggestionDelay: delay }),
}));
