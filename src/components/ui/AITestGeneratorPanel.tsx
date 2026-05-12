import { useState } from 'react';
import { useTestGeneratorStore, GeneratedTest } from '@/stores/useTestGeneratorStore';
import {
  TestTube,
  Play,
  Check,
  Trash,
  Lightning,
  CircleNotch,
  ChartBar,
} from '@phosphor-icons/react';

export function AITestGeneratorPanel() {
  const {
    tests,
    isGenerating,
    selectedFramework,
    coverageTarget,
    includeEdgeCases,
    generateTests,
    removeTest,
    applyTest,
    setFramework,
    setCoverageTarget,
    setIncludeEdgeCases,
    clearTests,
  } = useTestGeneratorStore();

  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const handleGenerate = async () => {
    await generateTests('src/utils/myFunction.ts', 'function myFunction(input: string) { return input.toUpperCase(); }');
  };

  const getCoverageColor = (coverage: number) => {
    if (coverage >= 80) return 'text-green-500';
    if (coverage >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-full flex flex-col bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TestTube size={20} weight="duotone" className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">AI Test Generator</h3>
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
                Generate Tests
              </>
            )}
          </button>
        </div>

        {/* Framework selector */}
        <div className="mb-3">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Test Framework
          </label>
          <select
            value={selectedFramework}
            onChange={(e) => setFramework(e.target.value as GeneratedTest['framework'])}
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)]"
          >
            <option value="jest">Jest</option>
            <option value="vitest">Vitest</option>
            <option value="mocha">Mocha</option>
            <option value="pytest">Pytest</option>
            <option value="go-test">Go Test</option>
          </select>
        </div>

        {/* Coverage target */}
        <div className="mb-3">
          <label className="block text-xs text-[var(--text-secondary)] mb-2">
            Coverage Target: {coverageTarget}%
          </label>
          <input
            type="range"
            min={50}
            max={100}
            step={5}
            value={coverageTarget}
            onChange={(e) => setCoverageTarget(parseInt(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Edge cases toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeEdgeCases}
            onChange={(e) => setIncludeEdgeCases(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-xs text-[var(--text-secondary)]">Include edge cases</span>
        </label>
      </div>

      {/* Tests list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {tests.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-secondary)]">
            <TestTube size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No tests generated yet</p>
            <p className="text-xs mt-1">Click "Generate Tests" to start</p>
          </div>
        ) : (
          tests.map((test) => (
            <div
              key={test.id}
              className={`p-3 rounded-lg border transition-all cursor-pointer ${
                selectedTest === test.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border)] hover:border-[var(--border-hover)] bg-[var(--background)]'
              }`}
              onClick={() => setSelectedTest(test.id)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium mb-1">{test.name}</div>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>{test.framework}</span>
                    <span>•</span>
                    <span>{test.targetFunction}</span>
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-xs font-mono ${getCoverageColor(test.coverage)}`}>
                  <ChartBar size={14} />
                  {test.coverage}%
                </div>
              </div>

              {/* Edge cases */}
              {test.edgeCases.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Edge cases:</div>
                  <div className="flex flex-wrap gap-1">
                    {test.edgeCases.map((edge, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-[var(--surface)] border border-[var(--border)] rounded"
                      >
                        {edge}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Code preview */}
              {selectedTest === test.id && (
                <div className="mb-3">
                  <pre className="text-xs bg-[var(--surface)] p-2 rounded border border-[var(--border)] overflow-x-auto max-h-48">
                    <code>{test.code}</code>
                  </pre>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    applyTest(test.id);
                  }}
                  disabled={test.status === 'applied'}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {test.status === 'applied' ? (
                    <>
                      <Check size={14} weight="bold" />
                      Applied
                    </>
                  ) : (
                    <>
                      <Play size={14} weight="fill" />
                      Apply
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTest(test.id);
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
      {tests.length > 0 && (
        <div className="p-3 border-t border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span>Total tests: {tests.length}</span>
            <span>
              Avg coverage:{' '}
              {Math.round(tests.reduce((sum, t) => sum + t.coverage, 0) / tests.length)}%
            </span>
          </div>
          <button
            onClick={clearTests}
            className="w-full px-3 py-2 text-xs bg-[var(--background)] hover:bg-[var(--surface-hover)] rounded transition-colors"
          >
            Clear All Tests
          </button>
        </div>
      )}
    </div>
  );
}
