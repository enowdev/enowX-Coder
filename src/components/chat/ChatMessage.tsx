import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Message } from '@/types';
import 'highlight.js/styles/github-dark.css';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ inline, className, children }) => {
  const [copied, setCopied] = React.useState(false);
  const code = String(children).replace(/\n$/, '');
  const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? '';

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded text-[0.82em] font-mono bg-[var(--surface-3)] text-[#e2b96f] border border-[var(--border)]">
        {children}
      </code>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-3)] border-b border-[var(--border)]">
        <span className="text-[11px] font-mono font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          {lang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
        >
          {copied ? <Check size={12} weight="bold" className="text-white" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto text-[13px] leading-relaxed bg-[var(--surface-2)] p-4 m-0">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = React.memo<ChatMessageProps>(({ message }) => {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            'px-4 py-3 rounded-xl text-sm leading-relaxed',
            'bg-[var(--surface-3)] text-[var(--text)]',
            'border border-[var(--border)]',
            'max-w-[75%]'
          )}
          style={{ width: 'fit-content' }}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          AI
        </div>
        <span className="text-[11px] text-[var(--text-subtle)] font-medium">Assistant</span>
      </div>
      <div className="w-full px-4 py-3 rounded-xl bg-[var(--surface)] text-[var(--text)] ai-prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={{
            code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
            pre: ({ children }) => <>{children}</>,
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
