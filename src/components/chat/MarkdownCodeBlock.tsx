import React from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import { HtmlPreview } from './HtmlPreview';

interface MarkdownCodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Detect if a language tag is an HTML preview trigger.
 * Supports: html:preview, html:artifact, html:viz, html:visual, html:render
 */
const isPreviewLang = (lang: string): boolean =>
  /^html:(preview|artifact|viz|visual|render)$/i.test(lang);

/**
 * Extract a title hint from the language tag, e.g. "html:preview:My Chart" → "My Chart"
 */
const extractPreviewTitle = (lang: string): string | undefined => {
  const parts = lang.split(':');
  return parts.length >= 3 ? parts.slice(2).join(':') : undefined;
};

/**
 * Detect if HTML code looks like a full interactive page that should be previewed.
 */
const looksLikeFullPage = (code: string): boolean => {
  if (code.length < 100) return false;
  const hasDoctype = /<!doctype\s+html/i.test(code);
  const hasHtmlTag = /<html[\s>]/i.test(code);
  const hasBodyTag = /<body[\s>]/i.test(code);
  const hasScript = /<script[\s>]/i.test(code);
  // Full page: has doctype or html tag, and has script
  if ((hasDoctype || hasHtmlTag) && hasScript) return true;
  // Canvas + script combo
  if (/<canvas/i.test(code) && hasScript) return true;
  // Has body + script
  if (hasBodyTag && hasScript) return true;
  return false;
};

export const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({ inline, className, children }) => {
  const [copied, setCopied] = React.useState(false);
  const code = String(children).replace(/\n$/, '');
  const lang = /language-(\S+)/.exec(className ?? '')?.[1] ?? '';

  if (inline) {
    return (
      <code className="px-1.5 py-0.5 rounded text-[0.84em] font-mono bg-[var(--surface-3)] text-[var(--text)] border border-[var(--border)]">
        {children}
      </code>
    );
  }

  // ── HTML Preview (explicit tag) ───────────────────────────
  if (isPreviewLang(lang)) {
    const title = extractPreviewTitle(lang);
    return <HtmlPreview code={code} title={title} />;
  }

  // ── HTML Preview (auto-detect full page) ──────────────────
  if (lang === 'html' && looksLikeFullPage(code)) {
    return <HtmlPreview code={code} />;
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Normal code block ─────────────────────────────────────
  const displayLang = lang.replace(/:.+$/, '');

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[var(--border)]">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--surface-3)]">
        <span className="text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {displayLang || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)] transition-colors"
        >
          {copied ? <Check size={12} weight="bold" className="text-[var(--accent)]" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto text-[13px] leading-relaxed bg-[var(--surface-2)] p-4 m-0">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};
