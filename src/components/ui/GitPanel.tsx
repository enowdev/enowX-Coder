import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useGitStore, GitStatus } from '@/stores/useGitStore';
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  GitPullRequest,
  Plus,
  Minus,
  Circle,
  Check,
  ArrowsClockwise,
} from '@phosphor-icons/react';

export function GitPanel() {
  const {
    repoPath,
    currentBranch,
    setCurrentBranch,
    status,
    setStatus,
    stagedFiles,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    isLoading,
    setIsLoading,
  } = useGitStore();

  const [commitMessage, setCommitMessage] = useState('');

  useEffect(() => {
    if (repoPath) {
      refreshGitStatus();
    }
  }, [repoPath]);

  const refreshGitStatus = async () => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      const [statusResult, branch] = await Promise.all([
        invoke<GitStatus[]>('git_status', { repoPath }),
        invoke<string>('git_current_branch', { repoPath }),
      ]);

      setStatus(statusResult);
      setCurrentBranch(branch);
    } catch (error) {
      console.error('Failed to get git status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageFile = async (path: string) => {
    if (!repoPath) return;

    try {
      await invoke('git_stage', { repoPath, path });
      stageFile(path);
      await refreshGitStatus();
    } catch (error) {
      console.error('Failed to stage file:', error);
      alert(`Failed to stage: ${error}`);
    }
  };

  const handleUnstageFile = async (path: string) => {
    if (!repoPath) return;

    try {
      await invoke('git_unstage', { repoPath, path });
      unstageFile(path);
      await refreshGitStatus();
    } catch (error) {
      console.error('Failed to unstage file:', error);
      alert(`Failed to unstage: ${error}`);
    }
  };

  const handleCommit = async () => {
    if (!repoPath || !commitMessage.trim()) return;

    try {
      await invoke('git_commit', { repoPath, message: commitMessage });
      setCommitMessage('');
      unstageAll();
      await refreshGitStatus();
    } catch (error) {
      console.error('Failed to commit:', error);
      alert(`Failed to commit: ${error}`);
    }
  };

  const handlePush = async () => {
    if (!repoPath) return;

    try {
      const result = await invoke<string>('git_push', { repoPath });
      alert(`Push successful:\n${result}`);
      await refreshGitStatus();
    } catch (error) {
      console.error('Failed to push:', error);
      alert(`Failed to push: ${error}`);
    }
  };

  const handlePull = async () => {
    if (!repoPath) return;

    try {
      const result = await invoke<string>('git_pull', { repoPath });
      alert(`Pull successful:\n${result}`);
      await refreshGitStatus();
    } catch (error) {
      console.error('Failed to pull:', error);
      alert(`Failed to pull: ${error}`);
    }
  };

  const getStatusIcon = (fileStatus: GitStatus) => {
    switch (fileStatus.status) {
      case 'modified':
        return <Circle size={12} weight="fill" className="text-yellow-500" />;
      case 'added':
        return <Plus size={12} weight="bold" className="text-green-500" />;
      case 'deleted':
        return <Minus size={12} weight="bold" className="text-red-500" />;
      case 'untracked':
        return <Circle size={12} className="text-gray-500" />;
      default:
        return <Circle size={12} className="text-gray-500" />;
    }
  };

  const stagedChanges = status.filter((f) => stagedFiles.has(f.path));
  const unstagedChanges = status.filter((f) => !stagedFiles.has(f.path));

  if (!repoPath) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center text-[var(--text-secondary)]">
        <GitBranch size={48} weight="duotone" className="mb-3" />
        <p className="text-sm">No Git repository</p>
        <p className="text-xs mt-2">Open a folder with a Git repository</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--background)]">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GitBranch size={16} weight="bold" />
            <span className="text-sm font-semibold">{currentBranch || 'Git'}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePull}
              className="p-1 hover:bg-[var(--surface-hover)] rounded"
              title="Pull"
            >
              <ArrowsClockwise size={16} />
            </button>
            <button
              onClick={handlePush}
              className="p-1 hover:bg-[var(--surface-hover)] rounded"
              title="Push"
            >
              <GitPullRequest size={16} />
            </button>
            <button
              onClick={refreshGitStatus}
              className="p-1 hover:bg-[var(--surface-hover)] rounded"
              title="Refresh"
            >
              <ArrowsClockwise size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <ArrowsClockwise size={24} className="animate-spin text-[var(--accent)]" />
          </div>
        ) : status.length === 0 ? (
          <div className="p-4 text-center text-sm text-[var(--text-secondary)]">
            <Check size={32} weight="bold" className="mx-auto mb-2 text-green-500" />
            <p>No changes</p>
          </div>
        ) : (
          <div className="p-2">
            {/* Staged Changes */}
            {stagedChanges.length > 0 && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Staged ({stagedChanges.length})
                  </span>
                  <button
                    onClick={unstageAll}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Unstage All
                  </button>
                </div>
                {stagedChanges.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--surface-hover)] rounded cursor-pointer"
                    onClick={() => handleUnstageFile(file.path)}
                  >
                    {getStatusIcon(file)}
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {file.status[0].toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Unstaged Changes */}
            {unstagedChanges.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2 px-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Changes ({unstagedChanges.length})
                  </span>
                  <button
                    onClick={stageAll}
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    Stage All
                  </button>
                </div>
                {unstagedChanges.map((file) => (
                  <div
                    key={file.path}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-[var(--surface-hover)] rounded cursor-pointer"
                    onClick={() => handleStageFile(file.path)}
                  >
                    {getStatusIcon(file)}
                    <span className="text-sm flex-1 truncate">{file.path}</span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {file.status[0].toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Commit Section */}
      {stagedChanges.length > 0 && (
        <div className="p-3 border-t border-[var(--border)] bg-[var(--surface)]">
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="w-full px-3 py-2 text-sm bg-[var(--background)] border border-[var(--border)] rounded outline-none focus:border-[var(--accent)] resize-none"
            rows={3}
          />
          <button
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            className="w-full mt-2 px-3 py-2 text-sm bg-[var(--accent)] text-white rounded hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <GitCommitIcon size={16} weight="bold" />
            Commit ({stagedChanges.length})
          </button>
        </div>
      )}
    </div>
  );
}
