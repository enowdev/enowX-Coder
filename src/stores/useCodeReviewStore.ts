import { create } from 'zustand';

export interface ReviewIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  category: 'security' | 'performance' | 'style' | 'bug' | 'best-practice';
  message: string;
  suggestion?: string;
}

export interface ReviewResult {
  timestamp: number;
  files: string[];
  issues: ReviewIssue[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
}

interface CodeReviewState {
  isReviewing: boolean;
  setIsReviewing: (reviewing: boolean) => void;
  currentReview: ReviewResult | null;
  setCurrentReview: (review: ReviewResult | null) => void;
  reviewHistory: ReviewResult[];
  addReviewToHistory: (review: ReviewResult) => void;
  autoReviewEnabled: boolean;
  toggleAutoReview: () => void;
}

export const useCodeReviewStore = create<CodeReviewState>((set) => ({
  isReviewing: false,
  setIsReviewing: (reviewing) => set({ isReviewing: reviewing }),
  currentReview: null,
  setCurrentReview: (review) => set({ currentReview: review }),
  reviewHistory: [],
  addReviewToHistory: (review) =>
    set((s) => ({
      reviewHistory: [review, ...s.reviewHistory].slice(0, 10), // Keep last 10
    })),
  autoReviewEnabled: false,
  toggleAutoReview: () => set((s) => ({ autoReviewEnabled: !s.autoReviewEnabled })),
}));
