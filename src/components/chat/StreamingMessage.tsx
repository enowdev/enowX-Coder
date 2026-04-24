import React from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { useChatStore } from '@/stores/useChatStore';

export const StreamingMessage: React.FC = () => {
  const { streamingText, isStreaming } = useChatStore();

  if (!isStreaming) return null;

  return (
    <div className="flex gap-3 w-full">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkle size={14} weight="fill" className="text-[var(--accent-fg)]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed text-[var(--text)]">
        {streamingText ? (
          <>
            <span className="whitespace-pre-wrap">{streamingText}</span>
            <span className="inline-block w-0.5 h-4 bg-[var(--accent)] ml-0.5 align-middle animate-pulse rounded-full" />
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
