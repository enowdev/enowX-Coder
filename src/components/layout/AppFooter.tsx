import React from 'react';
import { GithubLogo, Heart } from '@phosphor-icons/react';

export const AppFooter: React.FC = () => {
  return (
    <footer className="h-7 flex items-center justify-between px-4 border-t border-[var(--border)] bg-[var(--surface)] col-span-3 shrink-0">
      <span className="text-[10px] text-[var(--text-subtle)] tracking-wide select-none">
        enowX Coder v0.1.0
      </span>

      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-[10px] text-[var(--text-subtle)] select-none">
          Made with <Heart size={10} weight="fill" className="text-[var(--text-subtle)]" /> by enowdev
        </span>
        <a
          href="https://github.com/enowdev/enowX-Coder"
          target="_blank"
          rel="noreferrer"
          className="text-[var(--text-subtle)] hover:text-[var(--text-muted)] transition-colors"
          title="GitHub"
        >
          <GithubLogo size={13} />
        </a>
      </div>
    </footer>
  );
};
