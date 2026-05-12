import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: (e: KeyboardEvent) => void;
  description?: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcut(shortcut: KeyboardShortcut) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const matchesCtrl = shortcut.ctrl === undefined || e.ctrlKey === shortcut.ctrl;
      const matchesMeta = shortcut.meta === undefined || e.metaKey === shortcut.meta;
      const matchesShift = shortcut.shift === undefined || e.shiftKey === shortcut.shift;
      const matchesAlt = shortcut.alt === undefined || e.altKey === shortcut.alt;

      if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault();
        }
        shortcut.action(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcut]);
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesCtrl = shortcut.ctrl === undefined || e.ctrlKey === shortcut.ctrl;
        const matchesMeta = shortcut.meta === undefined || e.metaKey === shortcut.meta;
        const matchesShift = shortcut.shift === undefined || e.shiftKey === shortcut.shift;
        const matchesAlt = shortcut.alt === undefined || e.altKey === shortcut.alt;

        if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action(e);
          break; // Only execute first matching shortcut
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

// Helper to format shortcut for display
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  parts.push(shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
