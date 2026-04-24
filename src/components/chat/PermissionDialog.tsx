import { PermissionRequest, AGENT_LABELS } from '@/types';
import { Warning } from '@phosphor-icons/react';

interface PermissionDialogProps {
  request: PermissionRequest | null;
  onAllow: () => void;
  onDeny: () => void;
}

export function PermissionDialog({ request, onAllow, onDeny }: PermissionDialogProps) {
  if (!request) return null;

  const agentLabel = AGENT_LABELS[request.agentType] || request.agentType;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4 text-[var(--text)]">
          <Warning size={24} weight="duotone" className="text-yellow-500" />
          <h2 className="text-lg font-semibold">Permission Required</h2>
        </div>

        <p className="text-[var(--text-muted)] text-sm mb-6 leading-relaxed">
          {request.type === 'sensitive_file' && (
            <>
              Agent <span className="font-semibold text-[var(--text)]">{agentLabel}</span> wants to read a sensitive file:
            </>
          )}
          {request.type === 'outside_sandbox' && (
            <>
              Agent <span className="font-semibold text-[var(--text)]">{agentLabel}</span> wants to access a path outside the project:
            </>
          )}
          <br />
          <span className="inline-block mt-2 font-mono text-xs bg-[var(--surface-2)] px-2 py-1 rounded border border-[var(--border)] break-all">
            {request.path}
          </span>
        </p>

        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onDeny}
            className="px-4 py-2 rounded-lg bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors text-sm font-medium"
          >
            Deny
          </button>
          <button
            onClick={onAllow}
            className="px-4 py-2 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-colors text-sm font-medium"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
