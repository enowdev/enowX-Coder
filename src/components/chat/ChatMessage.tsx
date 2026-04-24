import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Sparkle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Message } from '@/types';
import { MarkdownCodeBlock } from './MarkdownCodeBlock';
import { fixMarkdownTables } from '@/lib/utils';
import 'highlight.js/styles/github-dark.css';

/**
 * Strip XML-style segment tags (<thinking>, <tool>, <response>) and
 * heading-based segment markers so we render a single clean markdown block.
 */
const cleanContent = (raw: string): string => {
  let text = raw.replace(/\r\n/g, '\n').trim();

  // Remove XML segment wrappers — keep inner content
  text = text.replace(/<\/?(?:thinking|tool|response)>/gi, '');

  // Remove heading lines that are purely segment labels
  text = text.replace(
    /^#{1,6}\s+(?:thinking|reasoning|analysis|chain of thought|tool execution?|response|final answer|answer)\s*$/gim,
    '',
  );

  // Remove prefix-style segment labels  (e.g. "Response: ...")
  text = text.replace(
    /^(?:thinking|reasoning|analysis|tool|executing tool|response|final answer)\s*[:\-]\s*/gim,
    '',
  );

  // Collapse 3+ consecutive blank lines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
};

const markdownComponents = {
  code: MarkdownCodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
};

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = React.memo<ChatMessageProps>(({ message }) => {
  const isUser = message.role === 'user';

  /* ── User bubble ─────────────────────────────────────────── */
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            'px-4 py-2.5 rounded-3xl rounded-br-lg text-[15px] leading-relaxed',
            'bg-[var(--surface-2)] text-[var(--text)]',
            'max-w-[75%]',
          )}
          style={{ width: 'fit-content' }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  /* ── Assistant message — flat, no boxes ──────────────────── */
  const content = cleanContent(message.content);

  return (
    <div className="flex gap-3 w-full">
      {/* Avatar */}
      <div className="w-7 h-7 rounded-full bg-[var(--accent)] flex items-center justify-center shrink-0 mt-0.5">
        <Sparkle size={14} weight="fill" className="text-[var(--accent-fg)]" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 ai-prose ai-prose-readable pt-0.5">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={markdownComponents}
        >
          {fixMarkdownTables(content)}
        </ReactMarkdown>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
