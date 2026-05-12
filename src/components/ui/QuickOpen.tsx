import { useEffect, useRef } from 'react';
import { useQuickOpenStore, QuickOpenItem } from '@/stores/useQuickOpenStore';
import {
  MagnifyingGlass,
  File,
  Command,
  Hash,
  ArrowElbowDownLeft,
} from '@phosphor-icons/react';

export function QuickOpen() {
  const {
    isOpen,
    query,
    items,
    selectedIndex,
    mode,
    setOpen,
    setQuery,
    setItems,
    selectNext,
    selectPrevious,
  } = useQuickOpenStore();

  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        useQuickOpenStore.getState().toggleOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Mock fuzzy search (in real implementation, use fuse.js or similar)
  useEffect(() => {
    if (!isOpen) return;

    const searchQuery = query.replace(/^[>@:]/, '').toLowerCase();

    if (mode === 'file') {
      // Mock file search
      const mockFiles: QuickOpenItem[] = [
        { id: '1', label: 'App.tsx', path: 'src/App.tsx', type: 'file' },
        { id: '2', label: 'main.tsx', path: 'src/main.tsx', type: 'file' },
        { id: '3', label: 'AppShell.tsx', path: 'src/components/layout/AppShell.tsx', type: 'file' },
        { id: '4', label: 'ChatPanel.tsx', path: 'src/components/chat/ChatPanel.tsx', type: 'file' },
        { id: '5', label: 'README.md', path: 'README.md', type: 'file' },
      ];

      const filtered = searchQuery
        ? mockFiles.filter((f) => f.label.toLowerCase().includes(searchQuery))
        : mockFiles;

      setItems(filtered);
    } else if (mode === 'command') {
      // Mock command search
      const mockCommands: QuickOpenItem[] = [
        { id: 'c1', label: 'Toggle Theme', description: 'Switch between dark and light mode', type: 'command' },
        { id: 'c2', label: 'Open Settings', description: 'Configure enowX Coder', type: 'command' },
        { id: 'c3', label: 'New Chat', description: 'Start a new conversation', type: 'command' },
        { id: 'c4', label: 'Toggle Terminal', description: 'Show/hide terminal', type: 'command' },
      ];

      const filtered = searchQuery
        ? mockCommands.filter((c) => c.label.toLowerCase().includes(searchQuery))
        : mockCommands;

      setItems(filtered);
    } else if (mode === 'symbol') {
      // Mock symbol search
      const mockSymbols: QuickOpenItem[] = [
        { id: 's1', label: 'App', description: 'function', type: 'symbol' },
        { id: 's2', label: 'useQuickOpenStore', description: 'const', type: 'symbol' },
        { id: 's3', label: 'QuickOpen', description: 'function', type: 'symbol' },
      ];

      const filtered = searchQuery
        ? mockSymbols.filter((s) => s.label.toLowerCase().includes(searchQuery))
        : mockSymbols;

      setItems(filtered);
    }
  }, [query, mode, isOpen, setItems]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectPrevious();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = items[selectedIndex];
      if (selected) {
        console.log('Selected:', selected);
        setOpen(false);
      }
    }
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'file':
        return <File size={16} weight="bold" />;
      case 'command':
        return <Command size={16} weight="bold" />;
      case 'symbol':
        return <Hash size={16} weight="bold" />;
      case 'line':
        return <Hash size={16} weight="bold" />;
    }
  };

  const getModePlaceholder = () => {
    switch (mode) {
      case 'file':
        return 'Search files...';
      case 'command':
        return 'Type a command...';
      case 'symbol':
        return 'Go to symbol...';
      case 'line':
        return 'Go to line...';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-[var(--surface)] border border-[var(--border)] rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <div className="text-[var(--text-secondary)]">{getModeIcon()}</div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getModePlaceholder()}
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <div className="text-xs text-[var(--text-secondary)]">
            {mode === 'file' && 'Cmd+P'}
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">
              <MagnifyingGlass size={32} className="mx-auto mb-2 opacity-50" />
              <p>No results found</p>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${
                  idx === selectedIndex
                    ? 'bg-[var(--accent)]/10 border-l-2 border-[var(--accent)]'
                    : 'hover:bg-[var(--surface-hover)]'
                }`}
                onClick={() => {
                  console.log('Clicked:', item);
                  setOpen(false);
                }}
              >
                <div className="text-[var(--text-secondary)]">
                  {item.type === 'file' && <File size={16} />}
                  {item.type === 'command' && <Command size={16} />}
                  {item.type === 'symbol' && <Hash size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  {item.description && (
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {item.description}
                    </div>
                  )}
                  {item.path && (
                    <div className="text-xs text-[var(--text-secondary)] truncate">
                      {item.path}
                    </div>
                  )}
                </div>
                {idx === selectedIndex && (
                  <ArrowElbowDownLeft size={14} className="text-[var(--text-secondary)]" />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--background)] text-xs text-[var(--text-secondary)] flex items-center gap-4">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
          <span className="ml-auto">
            <span className="font-semibold">&gt;</span> Commands
            <span className="mx-2">•</span>
            <span className="font-semibold">@</span> Symbols
            <span className="mx-2">•</span>
            <span className="font-semibold">:</span> Line
          </span>
        </div>
      </div>
    </div>
  );
}
