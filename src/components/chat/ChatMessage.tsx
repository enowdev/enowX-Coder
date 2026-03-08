import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import {
  Copy,
  Check,
  Brain,
  Wrench,
  ChatCircleText,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { Message } from '@/types';
import 'highlight.js/styles/github-dark.css';

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

type AssistantSegmentType = 'thinking' | 'tool' | 'response';

interface AssistantSegment {
  type: AssistantSegmentType;
  content: string;
  title?: string;
}

const segmentMeta: Record<
  AssistantSegmentType,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; weight?: 'regular' | 'fill' | 'duotone' | 'thin' | 'light' | 'bold'; className?: string }>;
    wrapperClass: string;
    headerClass: string;
    iconClass: string;
  }
> = {
  thinking: {
    label: 'Thinking',
    icon: Brain,
    wrapperClass: 'bg-[var(--surface-2)] border border-[var(--border)]',
    headerClass: 'border-b border-[var(--border)] bg-[var(--surface-3)]',
    iconClass: 'text-[var(--text-muted)]',
  },
  tool: {
    label: 'Tool Execution',
    icon: Wrench,
    wrapperClass: 'bg-[var(--surface-2)] border border-[var(--border-strong)]',
    headerClass: 'border-b border-[var(--border-strong)] bg-[var(--surface-3)]',
    iconClass: 'text-[var(--text-muted)]',
  },
  response: {
    label: 'Response',
    icon: ChatCircleText,
    wrapperClass: 'bg-[var(--surface)] border border-[var(--border)]',
    headerClass: 'border-b border-[var(--border)] bg-[var(--surface-2)]',
    iconClass: 'text-[var(--text-muted)]',
  },
};

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

const classifySegmentType = (text: string): AssistantSegmentType | null => {
  const normalized = text.toLowerCase();
  if (/(thinking|reasoning|analysis|chain of thought)/i.test(normalized)) return 'thinking';
  if (/(tool|function call|execute|executing|running tool)/i.test(normalized)) return 'tool';
  if (/(response|final answer|answer)/i.test(normalized)) return 'response';
  return null;
};

const parseAssistantSegments = (rawContent: string): AssistantSegment[] => {
  const content = rawContent.replace(/\r\n/g, '\n').trim();
  if (!content) return [{ type: 'response', content: '' }];

  const xmlMatches = Array.from(content.matchAll(/<(thinking|tool|response)>([\s\S]*?)<\/\1>/gi));
  if (xmlMatches.length > 0) {
    return xmlMatches
      .map((m) => ({
        type: m[1].toLowerCase() as AssistantSegmentType,
        content: (m[2] ?? '').trim(),
      }))
      .filter((segment) => segment.content.length > 0);
  }

  const lines = content.split('\n');
  const segments: AssistantSegment[] = [];
  let activeType: AssistantSegmentType | null = null;
  let activeTitle: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const merged = buffer.join('\n').trim();
    if (!merged || !activeType) {
      buffer = [];
      return;
    }
    segments.push({ type: activeType, title: activeTitle, content: merged });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/);
    if (headingMatch) {
      const candidateTitle = headingMatch[1].trim();
      const detectedType = classifySegmentType(candidateTitle);
      if (detectedType) {
        flush();
        activeType = detectedType;
        activeTitle = candidateTitle;
        continue;
      }
    }

    const prefixMatch = line.match(/^(thinking|reasoning|analysis|tool|executing tool|response|final answer)\s*[:\-]\s*(.*)$/i);
    if (prefixMatch) {
      const detectedType = classifySegmentType(prefixMatch[1]);
      if (detectedType) {
        flush();
        activeType = detectedType;
        activeTitle = prefixMatch[1];
        const remaining = prefixMatch[2]?.trim();
        if (remaining) buffer.push(remaining);
        continue;
      }
    }

    if (!activeType) {
      activeType = 'response';
    }
    buffer.push(line);
  }

  flush();

  if (segments.length === 0) {
    return [{ type: 'response', content }];
  }

  return segments;
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
            'px-4 py-3 rounded-xl text-[15px] leading-relaxed',
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

  const segments = parseAssistantSegments(message.content);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-md bg-[var(--surface-3)] border border-[var(--border)] flex items-center justify-center text-[10px] font-bold text-white shrink-0">
          AI
        </div>
        <span className="text-[12px] text-[var(--text-muted)] font-medium">Assistant</span>
      </div>

      <div className="flex flex-col gap-3 w-full">
        {segments.map((segment, index) => {
          const meta = segmentMeta[segment.type];
          const Icon = meta.icon;
          return (
            <div key={`${message.id}-${segment.type}-${index}`} className={cn('w-full rounded-xl overflow-hidden', meta.wrapperClass)}>
              <div className={cn('flex items-center gap-2 px-3 py-2', meta.headerClass)}>
                <Icon size={14} weight="duotone" className={meta.iconClass} />
                <span className="text-[11px] font-semibold tracking-wide uppercase text-[var(--text-muted)]">
                  {segment.title ? segment.title : meta.label}
                </span>
              </div>
              <div className="px-4 py-3 ai-prose ai-prose-readable">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    code: CodeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
                    pre: ({ children }) => <>{children}</>,
                  }}
                >
                  {segment.content}
                </ReactMarkdown>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
