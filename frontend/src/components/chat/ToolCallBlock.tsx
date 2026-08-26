"use client";

import { useState, useEffect } from "react";
import type { ToolCall } from "@/lib/types";

interface Props {
  toolCall: ToolCall;
}

function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return seconds;
}

export default function ToolCallBlock({ toolCall }: Props) {
  const isPending = toolCall.status === "pending";
  const isRunning = toolCall.status === "running";
  const isActive = isPending || isRunning;

  // Active calls start open automatically so the user sees what's happening.
  // Completed calls stay collapsed unless the user manually opens them.
  const [userOpen, setUserOpen] = useState(false);
  const open = isActive || userOpen;

  const elapsed = useElapsed(isActive);

  return (
    <div className="rounded-xl border border-[var(--color-surface-border)] bg-[var(--color-surface-raised)] overflow-hidden text-sm">
      <button
        onClick={() => setUserOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-[var(--color-surface-overlay)] transition-colors text-left"
      >
        {/* Status indicator */}
        {isActive ? (
          <svg className="w-3.5 h-3.5 animate-spin text-[var(--color-accent)] flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : toolCall.status === "completed" ? (
          <svg className="w-3.5 h-3.5 text-[var(--color-success)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[var(--color-error)] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}

        <span className="font-mono text-[13px] font-semibold text-[var(--color-accent)]">{toolCall.toolName}</span>

        <span className="text-[12px] ml-auto mr-1 flex items-center gap-1.5">
          {isPending && <span className="text-[var(--color-text-muted)] animate-pulse">preparing…</span>}
          {isRunning && (
            <>
              <span className="text-[var(--color-warning)] animate-pulse">running…</span>
              {elapsed > 0 && (
                <span className="text-[var(--color-text-muted)] tabular-nums">{elapsed}s</span>
              )}
            </>
          )}
          {toolCall.status === "completed" && <span className="text-[var(--color-text-muted)]">done</span>}
          {toolCall.status === "failed" && <span className="text-[var(--color-error)]">failed</span>}
        </span>

        <svg
          className={`w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--color-surface-border)] divide-y divide-[var(--color-surface-border)]">
          {Object.keys(toolCall.input).length > 0 && (
            <div className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2 font-bold">Input</p>
              <pre className="text-[13px] overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-all leading-relaxed font-mono">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}

          {isRunning && (
            <div className="px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s`, opacity: 0.5 }}
                  />
                ))}
              </div>
            </div>
          )}

          {toolCall.output && (
            <div className="px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-[var(--color-text-muted)] mb-2 font-bold">Output</p>
              <pre className="text-[12px] overflow-x-auto text-[var(--color-text-secondary)] whitespace-pre-wrap break-all max-h-64 leading-relaxed font-mono">
                {toolCall.output}
              </pre>
            </div>
          )}

          {toolCall.error && (
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-[var(--color-error)]/60 mb-2 font-semibold">Error</p>
              <pre className="text-[13px] text-[var(--color-error)] whitespace-pre-wrap font-mono">{toolCall.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
