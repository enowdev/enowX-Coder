import React, { useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import { useUIStore } from '@/stores/useUIStore';
import { ProviderSettings } from './ProviderSettings';

export const SettingsModal: React.FC = () => {
  const { settingsOpen, setSettingsOpen } = useUIStore();

  useEffect(() => {
    if (!settingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settingsOpen, setSettingsOpen]);

  if (!settingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setSettingsOpen(false)}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-[var(--text)]">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-white/5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <ProviderSettings />
      </div>
    </div>
  );
};
