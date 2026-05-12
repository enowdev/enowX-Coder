import { useState } from 'react';
import { useDocsGeneratorStore, GeneratedDoc } from '@/stores/useDocsGeneratorStore';
import {
  Books,
  Lightning,
  Check,
  Trash,
  CircleNotch,
  Copy,
  FileText,
} from '@phosphor-icons/react';

export function AIDocsGeneratorPanel() {
  const {
    docs,
    isGenerating,
    selectedType,
    includeExamples,
    includeTypes,
    generateDocs,
    removeDoc,
    applyDoc,
    setType,
    setIncludeExamples,
    setIncludeTypes,
    clearDocs,
  } = useDocsGeneratorStore();

  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const handleGenerate = async () => {
    await generateDocs(
      'src/utils/myFunction.ts',
      'function myFunction(input: string) { return input.toUpperCase(); }',
      selectedType
    );
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const getTypeIcon = (_type: GeneratedDoc['type']) => {
    return <FileText size={16} weight="duotone" />;
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Books size={20} weight="duotone" className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">AI Docs Generator</h3>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <CircleNotch size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Lightning size={14} />
                Generate Docs
              </>
            )}
          </button>
        </div>

        {/* Type selector */}
        <div className="mb-3">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Documentation Type
          </label>
          <select
            value={selectedType}
            onChange={(e) => setType(e.target.value as GeneratedDoc['type'])}
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          >
            <option value="jsdoc">JSDoc</option>
            <option value="tsdoc">TSDoc</option>
            <option value="readme">README</option>
            <option value="api">API Docs</option>
            <option value="changelog">Changelog</option>
            <option value="comment">Inline Comments</option>
          </select>
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeExamples}
              onChange={(e) => setIncludeExamples(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs text-[var(--text-secondary)]">Include examples</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTypes}
              onChange={(e) => setIncludeTypes(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-xs text-[var(--text-secondary)]">Include type annotations</span>
          </label>
        </div>
      </div>

      {/* Docs list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {docs.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Books size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No documentation generated yet</p>
            <p className="text-xs mt-1">Click "Generate Docs" to start</p>
          </div>
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedDoc === doc.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--background)]'
              }`}
              onClick={() => setSelectedDoc(doc.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  <div className="text-[var(--accent)]">
                    {getTypeIcon(doc.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {doc.type}
                      {doc.targetElement && ` • ${doc.targetElement}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(doc.content);
                  }}
                  className="p-1 hover:bg-[var(--surface-hover)] rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy size={14} />
                </button>
              </div>

              {/* Content preview */}
              {selectedDoc === doc.id && (
                <div className="mb-3">
                  <pre className="text-xs bg-[var(--surface)] p-2 rounded border border-[var(--border)] overflow-x-auto max-h-64">
                    <code>{doc.content}</code>
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    applyDoc(doc.id);
                  }}
                  disabled={doc.status === 'applied'}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {doc.status === 'applied' ? (
                    <>
                      <Check size={14} weight="bold" />
                      Applied
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      Apply
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDoc(doc.id);
                  }}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                >
                  <Trash size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {docs.length > 0 && (
        <div className="p-3 border-t border-[var(--border)] space-y-2">
          <div className="text-xs text-[var(--text-secondary)]">
            Total docs: {docs.length}
          </div>
          <button
            onClick={clearDocs}
            className="w-full px-3 py-2 text-xs bg-[var(--background)] hover:bg-[var(--surface-hover)] rounded transition-colors"
          >
            Clear All Docs
          </button>
        </div>
      )}
    </div>
  );
}
