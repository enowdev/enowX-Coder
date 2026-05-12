import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSearchStore, SearchResult } from '@/stores/useSearchStore';
import {
  MagnifyingGlass,
  X,
  ArrowsClockwise,
  TextAa,
  Quotes,
  Asterisk,
  CaretDown,
} from '@phosphor-icons/react';

export function SearchPanel() {
  const {
    query,
    setQuery,
    replaceText,
    setReplaceText,
    results,
    setResults,
    isSearching,
    setIsSearching,
    caseSensitive,
    toggleCaseSensitive,
    wholeWord,
    toggleWholeWord,
    useRegex,
    toggleUseRegex,
    isVisible,
    toggleVisible,
    selectedResult,
  } = useSearchStore();

  const [rootPath] = useState('/'); // Default root path
  const [showReplace, setShowReplace] = useState(false);
  const [groupedResults, setGroupedResults] = useState<Map<string, SearchResult[]>>(new Map());

  const handleSearch = async () => {
    if (!rootPath || !query.trim()) return;

    setIsSearching(true);
    try {
      const searchResults = await invoke<SearchResult[]>('search_in_files', {
        rootPath,
        query,
        caseSensitive,
        wholeWord,
        useRegex,
      });

      setResults(searchResults);

      // Group by file
      const grouped = new Map<string, SearchResult[]>();
      searchResults.forEach((result) => {
        const existing = grouped.get(result.path) || [];
        existing.push(result);
        grouped.set(result.path, existing);
      });
      setGroupedResults(grouped);
    } catch (error) {
      console.error('Search failed:', error);
      alert(`Search failed: ${error}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleReplace = async (filePath: string) => {
    if (!replaceText && replaceText !== '') return;

    try {
      const count = await invoke<number>('replace_in_file', {
        path: filePath,
        search: query,
        replace: replaceText,
        caseSensitive,
        wholeWord,
        useRegex,
      });

      alert(`Replaced ${count} occurrence(s) in ${filePath}`);
      await handleSearch(); // Refresh results
    } catch (error) {
      console.error('Replace failed:', error);
      alert(`Replace failed: ${error}`);
    }
  };

  const handleReplaceAll = async () => {
    if (!replaceText && replaceText !== '') return;
    if (!confirm(`Replace all ${results.length} occurrences?`)) return;

    const files = Array.from(groupedResults.keys());
    let totalCount = 0;

    for (const file of files) {
      try {
        const count = await invoke<number>('replace_in_file', {
          path: file,
          search: query,
          replace: replaceText,
          caseSensitive,
          wholeWord,
          useRegex,
        });
        totalCount += count;
      } catch (error) {
        console.error(`Failed to replace in ${file}:`, error);
      }
    }

    alert(`Replaced ${totalCount} occurrence(s) in ${files.length} file(s)`);
    await handleSearch();
  };

  const handleResultClick = (result: SearchResult) => {
    // Emit event to open file in editor
    window.dispatchEvent(
      new CustomEvent('file-selected', { detail: { path: result.path } })
    );
  };

  if (!isVisible) return null;

  return (
    <div className="h-full flex flex-col bg-[var(--background)] border-r border-[var(--border)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Search</h3>
          <button
            onClick={toggleVisible}
            className="p-1 hover:bg-[var(--surface-hover)] rounded"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-2">
          <MagnifyingGlass
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
          />
          <input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-7 pr-2 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          />
        </div>

        {/* Replace Input */}
        {showReplace && (
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Replace..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="w-full px-2 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}

        {/* Options */}
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={toggleCaseSensitive}
            className={`p-1 rounded ${
              caseSensitive ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-hover)]'
            }`}
            title="Case Sensitive"
          >
            <TextAa size={16} weight="bold" />
          </button>
          <button
            onClick={toggleWholeWord}
            className={`p-1 rounded ${
              wholeWord ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-hover)]'
            }`}
            title="Whole Word"
          >
            <Quotes size={16} weight="bold" />
          </button>
          <button
            onClick={toggleUseRegex}
            className={`p-1 rounded ${
              useRegex ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-hover)]'
            }`}
            title="Use Regex"
          >
            <Asterisk size={16} weight="bold" />
          </button>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="ml-auto text-xs text-[var(--accent)] hover:underline"
          >
            {showReplace ? 'Hide Replace' : 'Show Replace'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSearch}
            disabled={!query.trim() || isSearching}
            className="flex-1 px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSearching ? (
              <ArrowsClockwise size={14} className="animate-spin" />
            ) : (
              <MagnifyingGlass size={14} />
            )}
            Search
          </button>
          {showReplace && (
            <button
              onClick={handleReplaceAll}
              disabled={!replaceText && replaceText !== ''}
              className="px-3 py-1.5 text-sm bg-[var(--surface)] border border-[var(--border)] rounded hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Replace All
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
            {query ? 'No results found' : 'Enter search query'}
          </div>
        ) : (
          <div className="p-2">
            <div className="mb-2 px-2 text-xs text-[var(--text-secondary)]">
              {results.length} result(s) in {groupedResults.size} file(s)
            </div>
            {Array.from(groupedResults.entries()).map(([filePath, fileResults]) => (
              <div key={filePath} className="mb-3">
                <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-[var(--text-primary)] bg-[var(--surface)] rounded">
                  <CaretDown size={12} weight="bold" />
                  <span className="flex-1 truncate">{filePath.split('/').pop()}</span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {fileResults.length}
                  </span>
                  {showReplace && (
                    <button
                      onClick={() => handleReplace(filePath)}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      Replace
                    </button>
                  )}
                </div>
                {fileResults.map((result, idx) => (
                  <div
                    key={`${result.path}-${result.line}-${idx}`}
                    onClick={() => handleResultClick(result)}
                    className={`px-4 py-1 cursor-pointer hover:bg-[var(--surface-hover)] ${
                      selectedResult === idx ? 'bg-[var(--accent)]/10' : ''
                    }`}
                  >
                    <div className="text-xs text-[var(--text-secondary)] mb-1">
                      Line {result.line}:{result.column}
                    </div>
                    <div className="text-sm font-mono truncate">
                      {result.text}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
