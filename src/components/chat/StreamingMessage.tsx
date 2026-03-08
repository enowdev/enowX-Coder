import React from 'react';
import { useChatStore } from '@/stores/useChatStore';

export const StreamingMessage: React.FC = () => {
  const { streamingText, isStreaming } = useChatStore();

  if (!isStreaming) return null;

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          AI
        </div>
        <span className="text-[11px] text-[var(--text-subtle)] font-medium">Assistant</span>
      </div>
      <div className="w-full px-4 py-3 rounded-xl text-sm leading-relaxed bg-[var(--surface)] text-[var(--text)]">
        {streamingText ? (
          <>
            <span className="whitespace-pre-wrap">{streamingText}</span>
            <span className="inline-block w-0.5 h-4 bg-white/70 ml-0.5 align-middle animate-pulse" />
          </>
        ) : (
          <span className="text-[var(--text-subtle)]" aria-label="Generating">
            {'Generating...'.split('').map((char, i) => (
              <span
                key={i}
                className="wave-letter"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
};
