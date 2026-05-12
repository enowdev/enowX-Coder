import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useTerminalStore } from '@/stores/useTerminalStore';
import { Plus, X, Terminal as TerminalIcon } from '@phosphor-icons/react';
import '@xterm/xterm/css/xterm.css';

interface TerminalPanelProps {
  sessionId: string;
  cwd: string;
}

function TerminalPanel({ sessionId, cwd }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1a1a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Handle terminal input
    xterm.onData((data) => {
      invoke('write_to_terminal', { sessionId, data: data + '\n' });
    });

    // Create terminal session
    invoke('create_terminal_session', { sessionId, cwd })
      .catch((err) => {
        xterm.writeln(`\x1b[31mFailed to create terminal: ${err}\x1b[0m`);
      });

    // Listen for output
    const unlisten = listen<string>(`terminal-output-${sessionId}`, (event) => {
      xterm.write(event.payload + '\r\n');
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const { cols, rows } = xterm;
      invoke('resize_terminal', { sessionId, cols, rows });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      unlisten.then((fn) => fn());
      invoke('close_terminal_session', { sessionId });
      xterm.dispose();
    };
  }, [sessionId, cwd]);

  return (
    <div className="h-full w-full bg-[#1a1a1a]">
      <div ref={terminalRef} className="h-full w-full p-2" />
    </div>
  );
}

export function Terminal() {
  const {
    sessions,
    activeSessionId,
    setActiveSession,
    addSession,
    removeSession,
    isVisible,
    toggleVisible,
  } = useTerminalStore();

  const handleNewTerminal = () => {
    const id = `term-${Date.now()}`;
    const cwd = process.env.HOME || '/';
    addSession({
      id,
      title: 'Terminal',
      cwd,
      created: Date.now(),
    });
  };

  const handleCloseTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeSession(id);
  };

  if (!isVisible) return null;

  return (
    <div className="h-64 border-t border-[var(--border)] bg-[var(--background)] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
        <TerminalIcon size={16} weight="bold" className="text-[var(--text-secondary)]" />
        <span className="text-sm font-semibold text-[var(--text-primary)]">Terminal</span>
        
        {/* Tabs */}
        <div className="flex-1 flex items-center gap-1 ml-2">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSession(session.id)}
              className={`flex items-center gap-2 px-3 py-1 rounded cursor-pointer ${
                activeSessionId === session.id
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              <span className="text-xs">{session.title}</span>
              <button
                onClick={(e) => handleCloseTerminal(session.id, e)}
                className="hover:text-[var(--danger)]"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <button
          onClick={handleNewTerminal}
          className="p-1 hover:bg-[var(--surface-hover)] rounded"
          title="New Terminal"
        >
          <Plus size={16} weight="bold" />
        </button>
        <button
          onClick={toggleVisible}
          className="p-1 hover:bg-[var(--surface-hover)] rounded"
          title="Close Terminal"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      {/* Terminal Content */}
      <div className="flex-1 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
            <TerminalIcon size={48} weight="duotone" className="mb-3" />
            <p className="text-sm mb-3">No terminal sessions</p>
            <button
              onClick={handleNewTerminal}
              className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90"
            >
              New Terminal
            </button>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`h-full ${activeSessionId === session.id ? 'block' : 'hidden'}`}
            >
              <TerminalPanel sessionId={session.id} cwd={session.cwd} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
