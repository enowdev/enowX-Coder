import { useState, useEffect } from 'react';
import { usePairProgrammingStore, AISuggestion } from '@/stores/usePairProgrammingStore';
import {
  Lightning,
  Check,
  X,
  Sparkle,
  Code,
  Bug,
  ArrowsClockwise,
  TestTube,
  ChatCircle,
} from '@phosphor-icons/react';

export function AIPairProgrammingPanel() {
  const {
    session,
    isEnabled,
    autoSuggest,
    toggleEnabled,
    setMode,
    acceptSuggestion,
    rejectSuggestion,
    clearSuggestions,
    setAutoSuggest,
  } = usePairProgrammingStore();

  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);

  // Mock AI suggestions (in real implementation, call AI API)
  useEffect(() => {
    if (!isEnabled || !autoSuggest) return;

    const timer = setTimeout(() => {
      // Mock suggestion
      const mockSuggestion: AISuggestion = {
        id: `sug-${Date.now()}`,
        type: 'completion',
        title: 'Add error handling',
        description: 'Consider adding try-catch block for better error handling',
        code: 'try {\n  // your code\n} catch (error) {\n  console.error(error);\n}',
        file: session.currentFile || 'unknown',
        line: 42,
        confidence: 0.85,
      };

      // Don't add if we already have suggestions
      if (session.suggestions.length === 0) {
        usePairProgrammingStore.getState().addSuggestion(mockSuggestion);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isEnabled, autoSuggest, session.currentFile, session.suggestions.length]);

  const getSuggestionIcon = (type: AISuggestion['type']) => {
    switch (type) {
      case 'completion':
        return <Code size={16} weight="duotone" />;
      case 'refactor':
        return <ArrowsClockwise size={16} weight="duotone" />;
      case 'fix':
        return <Bug size={16} weight="duotone" />;
      case 'optimize':
        return <Lightning size={16} weight="duotone" />;
      case 'test':
        return <TestTube size={16} weight="duotone" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkle size={20} weight="duotone" className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">AI Pair Programming</h3>
          </div>
          <button
            onClick={toggleEnabled}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              isEnabled
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface-hover)] text-[var(--text-secondary)]'
            }`}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setMode('copilot')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              session.mode === 'copilot'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]'
                : 'bg-[var(--background)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Lightning size={14} className="inline mr-1" />
            Copilot
          </button>
          <button
            onClick={() => setMode('composer')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              session.mode === 'composer'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]'
                : 'bg-[var(--background)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <Code size={14} className="inline mr-1" />
            Composer
          </button>
          <button
            onClick={() => setMode('chat')}
            className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
              session.mode === 'chat'
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]'
                : 'bg-[var(--background)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            <ChatCircle size={14} className="inline mr-1" />
            Chat
          </button>
        </div>

        {/* Auto-suggest toggle */}
        <label className="flex items-center gap-2 mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={autoSuggest}
            onChange={(e) => setAutoSuggest(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs text-[var(--text-secondary)]">Auto-suggest</span>
        </label>
      </div>

      {/* Suggestions list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {session.suggestions.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <Sparkle size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No suggestions yet</p>
            <p className="text-xs mt-1">Start coding to get AI suggestions</p>
          </div>
        ) : (
          session.suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedSuggestion === suggestion.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--background)]'
              }`}
              onClick={() => setSelectedSuggestion(suggestion.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="text-[var(--accent)]">
                    {getSuggestionIcon(suggestion.type)}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{suggestion.title}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {suggestion.file}:{suggestion.line}
                    </div>
                  </div>
                </div>
                <div className={`text-xs font-mono ${getConfidenceColor(suggestion.confidence)}`}>
                  {Math.round(suggestion.confidence * 100)}%
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-[var(--text-secondary)] mb-2">
                {suggestion.description}
              </p>

              {/* Code preview */}
              {selectedSuggestion === suggestion.id && (
                <div className="mb-3">
                  <pre className="text-xs bg-[var(--surface)] p-2 rounded border border-[var(--border)] overflow-x-auto">
                    <code>{suggestion.code}</code>
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    acceptSuggestion(suggestion.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors"
                >
                  <Check size={14} weight="bold" />
                  Accept
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    rejectSuggestion(suggestion.id);
                  }}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
                >
                  <X size={14} weight="bold" />
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {session.suggestions.length > 0 && (
        <div className="p-3 border-t border-[var(--border)]">
          <button
            onClick={clearSuggestions}
            className="w-full px-3 py-2 text-xs bg-[var(--background)] hover:bg-[var(--surface-hover)] rounded transition-colors"
          >
            Clear All Suggestions
          </button>
        </div>
      )}
    </div>
  );
}
