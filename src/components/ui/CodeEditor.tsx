import { useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore, EditorTab } from '@/stores/useEditorStore';
import {
  X,
  Circle,
  FileCode,
} from '@phosphor-icons/react';

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  rs: 'rust',
  py: 'python',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  html: 'html',
  css: 'css',
  scss: 'scss',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  sh: 'shell',
  bash: 'shell',
};

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext && LANGUAGE_MAP[ext] ? LANGUAGE_MAP[ext] : 'plaintext';
}

interface EditorPanelProps {
  tab: EditorTab;
}

function EditorPanel({ tab }: EditorPanelProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const { updateTabContent } = useEditorStore();

  const handleEditorDidMount: OnMount = (monacoEditor, monaco) => {
    editorRef.current = monacoEditor;
    
    // Cmd+S / Ctrl+S to save
    monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      handleSave();
    });
  };

  const handleSave = async () => {
    try {
      await invoke('write_file_content', {
        path: tab.path,
        content: tab.content,
      });
      useEditorStore.getState().saveTab(tab.id);
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`Failed to save: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Editor
        height="100%"
        language={tab.language}
        value={tab.content}
        onChange={(value) => updateTabContent(tab.id, value || '')}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, "Courier New", monospace',
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'on',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
        }}
      />
    </div>
  );
}

export function CodeEditor() {
  const { tabs, activeTabId, setActiveTab, removeTab } = useEditorStore();

  useEffect(() => {
    // Listen for file-selected event from FileTree
    const handleFileSelected = async (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string }>;
      const { path } = customEvent.detail;

      // Check if already open
      const existing = useEditorStore.getState().getTabByPath(path);
      if (existing) {
        setActiveTab(existing.id);
        return;
      }

      // Load file content
      try {
        const content = await invoke<string>('read_file_content', { path });
        const filename = path.split(/[/\\]/).pop() || 'untitled';
        const language = getLanguageFromFilename(filename);

        const tab: EditorTab = {
          id: `tab-${Date.now()}`,
          path,
          filename,
          content,
          language,
          isDirty: false,
          savedContent: content,
        };

        useEditorStore.getState().addTab(tab);
      } catch (error) {
        console.error('Failed to load file:', error);
        alert(`Failed to load file: ${error}`);
      }
    };

    window.addEventListener('file-selected', handleFileSelected);
    return () => window.removeEventListener('file-selected', handleFileSelected);
  }, [setActiveTab]);

  const handleCloseTab = async (tab: EditorTab, e: React.MouseEvent) => {
    e.stopPropagation();

    if (tab.isDirty) {
      const confirm = window.confirm(
        `${tab.filename} has unsaved changes. Close anyway?`
      );
      if (!confirm) return;
    }

    removeTab(tab.id);
  };

  const handleSaveTab = async (tab: EditorTab, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      await invoke('write_file_content', {
        path: tab.path,
        content: tab.content,
      });
      useEditorStore.getState().saveTab(tab.id);
    } catch (error) {
      console.error('Failed to save file:', error);
      alert(`Failed to save: ${error}`);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--background)]">
      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer group ${
                activeTabId === tab.id
                  ? 'bg-[var(--background)] text-[var(--text-primary)]'
                  : 'hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]'
              }`}
            >
              <FileCode size={14} />
              <span className="text-xs whitespace-nowrap">{tab.filename}</span>
              {tab.isDirty && (
                <button
                  onClick={(e) => handleSaveTab(tab, e)}
                  className="hover:text-[var(--accent)]"
                  title="Save"
                >
                  <Circle size={10} weight="fill" />
                </button>
              )}
              <button
                onClick={(e) => handleCloseTab(tab, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-[var(--danger)]"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-secondary)]">
            <FileCode size={64} weight="duotone" className="mb-4" />
            <p className="text-lg font-medium mb-2">No file opened</p>
            <p className="text-sm">Select a file from the file tree to start editing</p>
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={`h-full ${activeTabId === tab.id ? 'block' : 'hidden'}`}
            >
              <EditorPanel tab={tab} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
