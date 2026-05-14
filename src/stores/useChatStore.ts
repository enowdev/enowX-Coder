import { create } from 'zustand';
import { Message, TokenUsage } from '@/types';

interface ChatState {
  messages: Message[];
  streamingText: string;
  isStreaming: boolean;
  sessionUsage: Record<string, TokenUsage>;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamToken: (token: string) => void;
  setStreaming: (isStreaming: boolean) => void;
  clearStreaming: () => void;
  addTokenUsage: (sessionId: string, usage: TokenUsage) => void;
  clearSessionUsage: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  streamingText: '',
  isStreaming: false,
  sessionUsage: {},
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  appendStreamToken: (token) => set((state) => ({ streamingText: state.streamingText + token })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  clearStreaming: () => set({ streamingText: '', isStreaming: false }),
  addTokenUsage: (sessionId, usage) =>
    set((state) => {
      const prev = state.sessionUsage[sessionId];
      return {
        sessionUsage: {
          ...state.sessionUsage,
          [sessionId]: {
            promptTokens: (prev?.promptTokens ?? 0) + usage.promptTokens,
            completionTokens: (prev?.completionTokens ?? 0) + usage.completionTokens,
            totalTokens: (prev?.totalTokens ?? 0) + usage.totalTokens,
          },
        },
      };
    }),
  clearSessionUsage: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...rest } = state.sessionUsage;
      return { sessionUsage: rest };
    }),
}));
