import { useEffect } from 'react';
import { useLayoutStore } from '@/stores/useLayoutStore';

// Placeholder components - will be replaced when PRs are merged
const FileTreePlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">File Tree</p>
      <p className="text-xs">PR #8 - Coming soon</p>
    </div>
  </div>
);

const GitPanelPlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">Git Integration</p>
      <p className="text-xs">PR #11 - Coming soon</p>
    </div>
  </div>
);

const SearchPanelPlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">Search & Replace</p>
      <p className="text-xs">PR #12 - Coming soon</p>
    </div>
  </div>
);

const CodeReviewPanelPlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">AI Code Review</p>
      <p className="text-xs">PR #13 - Coming soon</p>
    </div>
  </div>
);

const TerminalPlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">Integrated Terminal</p>
      <p className="text-xs">PR #9 - Coming soon</p>
    </div>
  </div>
);

const CodeEditorPlaceholder = () => (
  <div className="h-full flex items-center justify-center p-4 text-center text-[var(--text-secondary)]">
    <div>
      <p className="text-sm font-semibold mb-2">Monaco Code Editor</p>
      <p className="text-xs">PR #10 - Coming soon</p>
    </div>
  </div>
);

export function IntegratedLayout({ children }: { children: React.ReactNode }) {
  const {
    leftSidebarOpen,
    leftSidebarWidth,
    leftPanel,
    rightSidebarOpen,
    rightSidebarWidth,
    rightPanel,
    bottomPanelOpen,
    bottomPanelHeight,
    bottomPanel,
    editorVisible,
    toggleLeftSidebar,
    toggleRightSidebar,
    toggleBottomPanel,
    setLeftPanel,
    setRightPanel,
    setBottomPanel,
  } = useLayoutStore();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isShift = e.shiftKey;

      // Cmd/Ctrl+Shift+F - Search
      if (isMod && isShift && e.key === 'F') {
        e.preventDefault();
        setRightPanel('search');
        return;
      }

      // Cmd/Ctrl+Shift+G - Git
      if (isMod && isShift && e.key === 'G') {
        e.preventDefault();
        setRightPanel('git');
        return;
      }

      // Cmd/Ctrl+Shift+R - Code Review
      if (isMod && isShift && e.key === 'R') {
        e.preventDefault();
        setRightPanel('code-review');
        return;
      }

      // Cmd/Ctrl+` - Terminal
      if (isMod && e.key === '`') {
        e.preventDefault();
        setBottomPanel('terminal');
        toggleBottomPanel();
        return;
      }

      // Cmd/Ctrl+B - Toggle File Tree
      if (isMod && e.key === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setLeftPanel, setRightPanel, setBottomPanel, toggleBottomPanel, toggleLeftSidebar, toggleRightSidebar]);

  const renderLeftPanel = () => {
    switch (leftPanel) {
      case 'file-tree':
        return <FileTreePlaceholder />;
      default:
        return null;
    }
  };

  const renderRightPanel = () => {
    switch (rightPanel) {
      case 'git':
        return <GitPanelPlaceholder />;
      case 'search':
        return <SearchPanelPlaceholder />;
      case 'code-review':
        return <CodeReviewPanelPlaceholder />;
      default:
        return null;
    }
  };

  const renderBottomPanel = () => {
    switch (bottomPanel) {
      case 'terminal':
        return <TerminalPlaceholder />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--background)]">
      {/* Top toolbar */}
      <div className="h-12 border-b border-[var(--border)] flex items-center px-4 gap-2">
        <button
          onClick={toggleLeftSidebar}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
          title="Toggle File Tree (Cmd+B)"
        >
          📁 Files
        </button>
        <button
          onClick={() => setRightPanel(rightPanel === 'git' ? 'none' : 'git')}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
          title="Git (Cmd+Shift+G)"
        >
          🌿 Git
        </button>
        <button
          onClick={() => setRightPanel(rightPanel === 'search' ? 'none' : 'search')}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
          title="Search (Cmd+Shift+F)"
        >
          🔍 Search
        </button>
        <button
          onClick={() => setRightPanel(rightPanel === 'code-review' ? 'none' : 'code-review')}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
          title="Code Review (Cmd+Shift+R)"
        >
          ✨ Review
        </button>
        <button
          onClick={() => {
            setBottomPanel(bottomPanel === 'terminal' ? 'none' : 'terminal');
            toggleBottomPanel();
          }}
          className="px-2 py-1 text-xs rounded hover:bg-[var(--surface-hover)]"
          title="Terminal (Cmd+`)"
        >
          💻 Terminal
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar */}
        {leftSidebarOpen && (
          <div
            className="border-r border-[var(--border)] bg-[var(--surface)]"
            style={{ width: leftSidebarWidth }}
          >
            {renderLeftPanel()}
          </div>
        )}

        {/* Center area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Main content (Chat or Editor) */}
          <div className="flex-1 overflow-hidden">
            {editorVisible ? <CodeEditorPlaceholder /> : children}
          </div>

          {/* Bottom panel */}
          {bottomPanelOpen && (
            <div
              className="border-t border-[var(--border)] bg-[var(--surface)]"
              style={{ height: bottomPanelHeight }}
            >
              {renderBottomPanel()}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        {rightSidebarOpen && (
          <div
            className="border-l border-[var(--border)] bg-[var(--surface)]"
            style={{ width: rightSidebarWidth }}
          >
            {renderRightPanel()}
          </div>
        )}
      </div>
    </div>
  );
}
