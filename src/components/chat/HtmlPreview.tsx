import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ArrowsOutSimple, Copy, Check, Code, X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/useUIStore';
import { PREVIEW_DESIGN_SYSTEM } from './preview-styles';

interface HtmlPreviewProps {
  code: string;
  title?: string;
  onSendPrompt?: (text: string) => void;
}

const EXPANDED_HEIGHT = '85vh';

/** Strip hardcoded dark backgrounds from AI-generated HTML so it blends with host */
function stripBgFromCode(code: string): string {
  return code
    .replace(/background\s*:\s*#1a1a1a\s*;?/gi, 'background:transparent;')
    .replace(/background\s*:\s*#111111\s*;?/gi, 'background:transparent;')
    .replace(/background\s*:\s*#0a0a0a\s*;?/gi, 'background:transparent;')
    .replace(/background\s*:\s*#000000?\s*;?/gi, 'background:transparent;')
    .replace(/background-color\s*:\s*#1a1a1a\s*;?/gi, 'background-color:transparent;')
    .replace(/background-color\s*:\s*#111\s*;?/gi, 'background-color:transparent;')
    .replace(/background\s*:\s*linear-gradient\([^)]*#1[a0][^)]*\)\s*;?/gi, 'background:transparent;');
}

function buildSrcdoc(code: string, colorScheme: 'light' | 'dark'): string {
  const cleaned = stripBgFromCode(code);
  const themeClass = colorScheme;

  const bridge = `<script>
function sendPrompt(t){window.parent.postMessage({type:'sendPrompt',text:t},'*')}
function openLink(u){window.parent.postMessage({type:'openLink',url:u},'*')}
</script>`;

  const headContent = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><meta name="color-scheme" content="${colorScheme}"><style>${PREVIEW_DESIGN_SYSTEM}</style>${bridge}`;

  if (/<html[\s>]/i.test(cleaned)) {
    let result = cleaned.replace(/<html([^>]*)>/i, `<html class="${themeClass}"$1>`);
    if (/<head[\s>]/i.test(result)) {
      return result.replace(/<head([^>]*)>/i, `<head$1>${headContent}`);
    }
    return result.replace(/<html([^>]*)>/i, `<html$1><head>${headContent}</head>`);
  }

  return `<!DOCTYPE html><html class="${themeClass}"><head>${headContent}</head><body>${cleaned}</body></html>`;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ code, title, onSendPrompt }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(200);
  const theme = useUIStore((s) => s.theme);

  // Debounced srcdoc — only rebuild after code stops changing for 400ms
  // This prevents iframe reload on every streaming token
  const [debouncedCode, setDebouncedCode] = useState(code);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedCode(code);
    }, 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [code]);

  const srcdoc = React.useMemo(() => buildSrcdoc(debouncedCode, theme), [debouncedCode, theme]);

  // Measure iframe content height directly via contentDocument (same-origin allowed by sandbox)
  const pollTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const measureHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (!doc?.body) return;
      // Wrap all body content in a measuring div to get exact height
      const h = doc.body.scrollHeight;
      if (h > 20) {
        setIframeHeight(h);
      }
    } catch {}
  }, []);

  // Poll height after load and at intervals to catch async renders (Chart.js etc)
  const startPolling = useCallback(() => {
    pollTimers.current.forEach(clearTimeout);
    pollTimers.current = [];
    [0, 100, 300, 600, 1000, 2000, 4000].forEach((delay) => {
      pollTimers.current.push(setTimeout(measureHeight, delay));
    });
  }, [measureHeight]);

  // Re-poll when debounced code changes (iframe reloads)
  useEffect(() => {
    startPolling();
    return () => pollTimers.current.forEach(clearTimeout);
  }, [debouncedCode, startPolling]);

  // Re-measure on window resize so iframe adapts when user resizes the app
  useEffect(() => {
    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        measureHeight();
        // Poll again after content reflows
        setTimeout(measureHeight, 200);
        setTimeout(measureHeight, 600);
      });
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(resizeRaf);
    };
  }, [measureHeight]);

  // Listen for sendPrompt/openLink messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'sendPrompt' && typeof data.text === 'string') {
        onSendPrompt?.(data.text);
      }
      if (data.type === 'openLink' && typeof data.url === 'string') {
        window.open(data.url, '_blank', 'noopener');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSendPrompt]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const displayTitle = React.useMemo(() => {
    if (title) return title;
    const match = /<title>(.*?)<\/title>/i.exec(code);
    if (match?.[1]) return match[1];
    return 'Preview';
  }, [title, code]);

  useEffect(() => {
    if (!expanded) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [expanded]);

  const btnClass = 'p-1.5 rounded-lg transition-all duration-150';
  const btnIdle = 'text-[var(--text-subtle)] hover:text-[var(--text-muted)] hover:bg-[var(--hover-bg)]';

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setExpanded(false)}>
          <div className="w-full max-w-5xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-2xl shadow-[var(--shadow)] flex flex-col" style={{ height: EXPANDED_HEIGHT }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]">
              <span className="text-[12px] font-medium text-[var(--text-muted)]">{displayTitle}</span>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setShowSource(!showSource)} className={cn(btnClass, showSource ? 'text-[var(--accent)]' : btnIdle)} title={showSource ? 'Preview' : 'Source'}><Code size={14} /></button>
                <button onClick={handleCopy} className={cn(btnClass, btnIdle)} title="Copy">{copied ? <Check size={14} className="text-[var(--accent)]" /> : <Copy size={14} />}</button>
                <button onClick={() => setExpanded(false)} className={cn(btnClass, btnIdle)} title="Close (Esc)"><X size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {showSource ? (
                <pre className="h-full overflow-auto p-4 text-[13px] leading-relaxed font-mono text-[var(--text-muted)] bg-[var(--bg)] custom-scrollbar">{code}</pre>
              ) : (
                <iframe srcDoc={srcdoc} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0 bg-transparent" title={displayTitle} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seamless inline preview */}
      <div className="group/preview relative my-2">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-[var(--surface)]/90 backdrop-blur-md border border-[var(--border)] shadow-sm opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200 pointer-events-none group-hover/preview:pointer-events-auto">
          <button onClick={() => setShowSource(!showSource)} className={cn(btnClass, 'p-1', showSource ? 'text-[var(--accent)]' : btnIdle)} title={showSource ? 'Preview' : 'Source'}><Code size={13} /></button>
          <button onClick={handleCopy} className={cn(btnClass, 'p-1', btnIdle)} title="Copy">{copied ? <Check size={13} className="text-[var(--accent)]" /> : <Copy size={13} />}</button>
          <button onClick={() => setExpanded(true)} className={cn(btnClass, 'p-1', btnIdle)} title="Expand"><ArrowsOutSimple size={13} /></button>
        </div>

        {showSource ? (
          <pre className="overflow-auto p-4 text-[13px] leading-relaxed font-mono text-[var(--text-muted)] bg-[var(--surface-2)] rounded-xl custom-scrollbar" style={{ maxHeight: '500px' }}>{code}</pre>
        ) : (
          <iframe
            ref={iframeRef}
            srcDoc={srcdoc}
            sandbox="allow-scripts allow-same-origin"
            className="w-full border-0 bg-transparent rounded-xl"
            style={{ height: `${iframeHeight}px`, overflow: 'hidden', display: 'block' }}
            scrolling="no"
            title={displayTitle}
            onLoad={startPolling}
          />
        )}
      </div>
    </>
  );
};
