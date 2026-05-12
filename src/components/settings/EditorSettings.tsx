import { useState } from 'react';

interface EditorSettingsProps {
  onSave?: (settings: EditorConfig) => void;
}

export interface EditorConfig {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  insertSpaces: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  minimap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  formatOnSave: boolean;
  theme: 'vs-dark' | 'vs-light';
}

const defaultConfig: EditorConfig = {
  fontSize: 14,
  fontFamily: 'Fira Code, Consolas, monospace',
  tabSize: 2,
  insertSpaces: true,
  wordWrap: true,
  lineNumbers: true,
  minimap: true,
  autoSave: true,
  autoSaveDelay: 1000,
  formatOnSave: false,
  theme: 'vs-dark',
};

export function EditorSettings({ onSave }: EditorSettingsProps) {
  const [config, setConfig] = useState<EditorConfig>(defaultConfig);

  const handleChange = <K extends keyof EditorConfig>(
    key: K,
    value: EditorConfig[K]
  ) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onSave?.(newConfig);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold mb-4">Editor Settings</h3>
        
        {/* Font Size */}
        <div className="mb-4">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Font Size
          </label>
          <input
            type="number"
            value={config.fontSize}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            min={10}
            max={24}
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Font Family */}
        <div className="mb-4">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Font Family
          </label>
          <input
            type="text"
            value={config.fontFamily}
            onChange={(e) => handleChange('fontFamily', e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Tab Size */}
        <div className="mb-4">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Tab Size
          </label>
          <select
            value={config.tabSize}
            onChange={(e) => handleChange('tabSize', parseInt(e.target.value))}
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={8}>8 spaces</option>
          </select>
        </div>

        {/* Checkboxes */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.insertSpaces}
              onChange={(e) => handleChange('insertSpaces', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Insert Spaces (not tabs)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.wordWrap}
              onChange={(e) => handleChange('wordWrap', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Word Wrap</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.lineNumbers}
              onChange={(e) => handleChange('lineNumbers', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show Line Numbers</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.minimap}
              onChange={(e) => handleChange('minimap', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show Minimap</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.autoSave}
              onChange={(e) => handleChange('autoSave', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Auto Save</span>
          </label>

          {config.autoSave && (
            <div className="ml-6">
              <label className="block text-xs text-[var(--text-secondary)] mb-2">
                Auto Save Delay (ms)
              </label>
              <input
                type="number"
                value={config.autoSaveDelay}
                onChange={(e) => handleChange('autoSaveDelay', parseInt(e.target.value))}
                min={500}
                max={5000}
                step={500}
                className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={config.formatOnSave}
              onChange={(e) => handleChange('formatOnSave', e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Format on Save</span>
          </label>
        </div>
      </div>
    </div>
  );
}
