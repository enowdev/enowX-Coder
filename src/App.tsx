import { useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { useSessionStore } from '@/stores/useSessionStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useUIStore } from '@/stores/useUIStore';
import { useCommandPaletteStore } from '@/stores/useCommandPaletteStore';
import { generateId } from '@/lib/utils';

function App() {
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSessionId = useSessionStore((s) => s.setActiveSessionId);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);
  const toggleLeftSidebar = useUIStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useUIStore((s) => s.toggleRightSidebar);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setMainView = useUIStore((s) => s.setMainView);
  
  const { open: openCommandPalette, registerCommand } = useCommandPaletteStore();

  // Apply theme class to document root
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
  }, [theme]);

  // Register global commands
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    // Navigation commands
    registerCommand({
      id: 'new-chat',
      label: 'New Chat',
      description: 'Start a new chat session',
      category: 'chat',
      shortcut: `${modKey}+N`,
      action: () => {
        const session = {
          id: generateId(),
          projectId: activeProjectId ?? 'default',
          title: 'New Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addSession(session);
        setActiveSessionId(session.id);
      },
    });

    registerCommand({
      id: 'toggle-theme',
      label: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      category: 'view',
      shortcut: `${modKey}+Shift+T`,
      action: toggleTheme,
    });

    registerCommand({
      id: 'toggle-left-sidebar',
      label: 'Toggle Left Sidebar',
      description: 'Show or hide the left sidebar',
      category: 'view',
      shortcut: `${modKey}+B`,
      action: toggleLeftSidebar,
    });

    registerCommand({
      id: 'toggle-right-sidebar',
      label: 'Toggle Right Sidebar',
      description: 'Show or hide the right sidebar',
      category: 'view',
      shortcut: `${modKey}+Shift+B`,
      action: toggleRightSidebar,
    });

    registerCommand({
      id: 'open-settings',
      label: 'Open Settings',
      description: 'Open the settings modal',
      category: 'settings',
      shortcut: `${modKey}+,`,
      action: () => setSettingsOpen(true),
    });

    registerCommand({
      id: 'switch-to-chat',
      label: 'Switch to Chat',
      description: 'Switch to chat view',
      category: 'navigation',
      shortcut: `${modKey}+1`,
      action: () => setMainView('chat'),
    });

    registerCommand({
      id: 'switch-to-canvas',
      label: 'Switch to Canvas',
      description: 'Switch to canvas view',
      category: 'navigation',
      shortcut: `${modKey}+2`,
      action: () => setMainView('canvas'),
    });
  }, [
    activeProjectId,
    addSession,
    setActiveSessionId,
    toggleTheme,
    toggleLeftSidebar,
    toggleRightSidebar,
    setSettingsOpen,
    setMainView,
    registerCommand,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+K: Open command palette
      if (modKey && e.key === 'k') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Cmd/Ctrl+N: New chat
      if (modKey && e.key === 'n') {
        e.preventDefault();
        const session = {
          id: generateId(),
          projectId: activeProjectId ?? 'default',
          title: 'New Chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addSession(session);
        setActiveSessionId(session.id);
        return;
      }

      // Cmd/Ctrl+Shift+T: Toggle theme
      if (modKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Cmd/Ctrl+B: Toggle left sidebar
      if (modKey && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        toggleLeftSidebar();
        return;
      }

      // Cmd/Ctrl+Shift+B: Toggle right sidebar
      if (modKey && e.shiftKey && e.key === 'B') {
        e.preventDefault();
        toggleRightSidebar();
        return;
      }

      // Cmd/Ctrl+,: Open settings
      if (modKey && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // Cmd/Ctrl+1: Switch to chat
      if (modKey && e.key === '1') {
        e.preventDefault();
        setMainView('chat');
        return;
      }

      // Cmd/Ctrl+2: Switch to canvas
      if (modKey && e.key === '2') {
        e.preventDefault();
        setMainView('canvas');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeProjectId,
    addSession,
    setActiveSessionId,
    toggleTheme,
    toggleLeftSidebar,
    toggleRightSidebar,
    setSettingsOpen,
    setMainView,
    openCommandPalette,
  ]);

  return (
    <>
      <AppShell />
      <CommandPalette />
    </>
  );
}

export default App;
