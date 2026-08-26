"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";

const MODEL = "claude-sonnet-4-6";

interface Props {
  onToggleResources: () => void;
  resourcesOpen: boolean;
  onStop: () => void;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ onToggleResources, resourcesOpen, onStop, sidebarCollapsed, onToggleSidebar }: Props) {
  const isStreaming = useChatStore((s) => s.isStreaming);
  const hasMessages = useChatStore((s) => (s.activeConversation()?.messages.length ?? 0) > 0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="flex items-center justify-between px-4 border-b border-[var(--color-surface-border)] flex-shrink-0 h-11 bg-[var(--color-surface)]">
      <div className="flex items-center gap-3">
        {sidebarCollapsed && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
            title="Open sidebar"
          >
            <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}
        <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
          OMS Q&A • {MODEL}
        </span>
      </div>

      <div className="flex items-center gap-2" data-noprint>
        {mounted && hasMessages && !isStreaming && (
          <button
            onClick={() => window.print()}
            title="Export thread as PDF"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-surface-border)] text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-surface-overlay)] transition-all"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
              <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
            </svg>
            Export PDF
          </button>
        )}
        {isStreaming && (
          <button
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-surface-border)] text-[11px] text-[var(--color-text-secondary)] hover:border-[var(--color-error)]/50 hover:text-[var(--color-error)] transition-all"
          >
            <span className="w-1.5 h-1.5 rounded-sm bg-current" />
            Stop
          </button>
        )}
        <button
          onClick={onToggleResources}
          title="Browse MCP resources"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] transition-all ${
            resourcesOpen
              ? "border-[var(--color-accent)]/40 text-[var(--color-accent)] bg-[var(--color-accent)]/5"
              : "border-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-surface-overlay)]"
          }`}
        >
          <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
          </svg>
          Resources
        </button>
      </div>
    </header>
  );
}
