import { CircleNotch } from '@phosphor-icons/react';

interface LoadingSpinnerProps {
  size?: number;
  className?: string;
}

export function LoadingSpinner({ size = 24, className = '' }: LoadingSpinnerProps) {
  return (
    <CircleNotch
      size={size}
      className={`animate-spin text-[var(--accent)] ${className}`}
      weight="bold"
    />
  );
}

export function LoadingOverlay({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-6 flex flex-col items-center gap-4">
        <LoadingSpinner size={32} />
        <p className="text-[var(--text-primary)] font-medium">{message}</p>
      </div>
    </div>
  );
}

export function LoadingInline({ message }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 text-[var(--text-secondary)]">
      <LoadingSpinner size={16} />
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
}

export function LoadingPage({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <LoadingSpinner size={48} />
      <p className="text-[var(--text-secondary)] mt-4">{message}</p>
    </div>
  );
}
