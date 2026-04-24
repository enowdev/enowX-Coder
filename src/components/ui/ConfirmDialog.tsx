import React, { useEffect, useRef } from 'react';
import { Warning } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus confirm button on open
    setTimeout(() => confirmRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl shadow-[var(--shadow)] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
              danger ? 'bg-[var(--danger-bg)]' : 'bg-[var(--hover-bg-strong)]'
            )}>
              <Warning size={20} weight="fill" className={danger ? 'text-[var(--danger)]' : 'text-[var(--text)]'} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-[var(--text)] mb-1">{title}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-bold transition-all active:scale-95',
              danger
                ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]'
                : 'bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
