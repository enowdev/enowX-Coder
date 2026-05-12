import { useState } from 'react';
import { useCodeReviewStore, ReviewIssue } from '@/stores/useCodeReviewStore';
import {
  ShieldCheck,
  Warning,
  Info,
  Bug,
  Lightning,
  Code,
  CheckCircle,
  ArrowsClockwise,
  Sparkle,
} from '@phosphor-icons/react';

export function CodeReviewPanel() {
  const {
    isReviewing,
    setIsReviewing,
    currentReview,
    setCurrentReview,
    addReviewToHistory,
    autoReviewEnabled,
    toggleAutoReview,
  } = useCodeReviewStore();

  const [selectedFiles] = useState<string[]>([]);

  const handleReview = async () => {
    setIsReviewing(true);

    // Simulate AI code review (in real implementation, call AI API)
    setTimeout(() => {
      const mockReview = {
        timestamp: Date.now(),
        files: selectedFiles.length > 0 ? selectedFiles : ['src/App.tsx', 'src/main.tsx'],
        issues: [
          {
            file: 'src/App.tsx',
            line: 42,
            severity: 'warning' as const,
            category: 'performance' as const,
            message: 'Unnecessary re-render detected',
            suggestion: 'Use React.memo() or useMemo() to optimize',
          },
          {
            file: 'src/App.tsx',
            line: 67,
            severity: 'error' as const,
            category: 'security' as const,
            message: 'Potential XSS vulnerability',
            suggestion: 'Sanitize user input before rendering',
          },
          {
            file: 'src/main.tsx',
            line: 15,
            severity: 'info' as const,
            category: 'best-practice' as const,
            message: 'Consider using strict mode',
            suggestion: 'Wrap app in <React.StrictMode>',
          },
        ],
        summary: {
          total: 3,
          errors: 1,
          warnings: 1,
          info: 1,
        },
      };

      setCurrentReview(mockReview);
      addReviewToHistory(mockReview);
      setIsReviewing(false);
    }, 2000);
  };

  const getSeverityIcon = (severity: ReviewIssue['severity']) => {
    switch (severity) {
      case 'error':
        return <Bug size={16} weight="fill" className="text-red-500" />;
      case 'warning':
        return <Warning size={16} weight="fill" className="text-yellow-500" />;
      case 'info':
        return <Info size={16} weight="fill" className="text-blue-500" />;
    }
  };

  const getCategoryIcon = (category: ReviewIssue['category']) => {
    switch (category) {
      case 'security':
        return <ShieldCheck size={14} />;
      case 'performance':
        return <Lightning size={14} />;
      case 'style':
        return <Code size={14} />;
      case 'bug':
        return <Bug size={14} />;
      case 'best-practice':
        return <CheckCircle size={14} />;
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkle size={18} weight="fill" className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold">AI Code Review</h3>
          </div>
          <button
            onClick={toggleAutoReview}
            className={`text-xs px-2 py-1 rounded ${
              autoReviewEnabled
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--surface)] text-[var(--text-secondary)]'
            }`}
          >
            Auto-Review {autoReviewEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <button
          onClick={handleReview}
          disabled={isReviewing}
          className="w-full px-3 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isReviewing ? (
            <>
              <ArrowsClockwise size={16} className="animate-spin" />
              Reviewing...
            </>
          ) : (
            <>
              <Sparkle size={16} weight="fill" />
              Review Code
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!currentReview ? (
          <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
            <Sparkle size={48} weight="duotone" className="mx-auto mb-3 text-[var(--accent)]" />
            <p>No review yet</p>
            <p className="text-xs mt-2">Click "Review Code" to start AI analysis</p>
          </div>
        ) : (
          <div className="p-3">
            {/* Summary */}
            <div className="mb-4 p-3 bg-[var(--surface)] rounded">
              <div className="text-xs text-[var(--text-secondary)] mb-2">
                Reviewed {currentReview.files.length} file(s)
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <Bug size={14} className="text-red-500" />
                  <span>{currentReview.summary.errors} errors</span>
                </div>
                <div className="flex items-center gap-1">
                  <Warning size={14} className="text-yellow-500" />
                  <span>{currentReview.summary.warnings} warnings</span>
                </div>
                <div className="flex items-center gap-1">
                  <Info size={14} className="text-blue-500" />
                  <span>{currentReview.summary.info} info</span>
                </div>
              </div>
            </div>

            {/* Issues */}
            {currentReview.issues.length === 0 ? (
              <div className="p-4 text-center text-sm text-green-500">
                <CheckCircle size={32} weight="fill" className="mx-auto mb-2" />
                <p>No issues found! 🎉</p>
              </div>
            ) : (
              <div className="space-y-3">
                {currentReview.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--surface)] rounded border-l-2"
                    style={{
                      borderLeftColor:
                        issue.severity === 'error'
                          ? '#ef4444'
                          : issue.severity === 'warning'
                          ? '#f59e0b'
                          : '#3b82f6',
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getCategoryIcon(issue.category)}
                          <span className="text-xs font-semibold uppercase text-[var(--text-secondary)]">
                            {issue.category}
                          </span>
                        </div>
                        <p className="text-sm font-medium">{issue.message}</p>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mb-2">
                      {issue.file}:{issue.line}
                    </div>
                    {issue.suggestion && (
                      <div className="mt-2 p-2 bg-[var(--background)] rounded text-xs">
                        <div className="text-[var(--accent)] font-semibold mb-1">
                          💡 Suggestion:
                        </div>
                        <div className="text-[var(--text-secondary)]">{issue.suggestion}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
