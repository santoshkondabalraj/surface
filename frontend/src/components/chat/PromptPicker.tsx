"use client";

import { useState, useEffect, useRef } from "react";
import type { MCPPrompt } from "@/lib/types";

interface Props {
  onInsert: (text: string) => void;
  disabled?: boolean;
}

export default function PromptPicker({ onInsert, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [prompts, setPrompts] = useState<MCPPrompt[]>([]);
  const [selected, setSelected] = useState<MCPPrompt | null>(null);
  const [args, setArgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || prompts.length > 0) return;
    setLoading(true);
    fetch("/api/mcp/prompts")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPrompts(data);
        else setError("Failed to load prompts");
      })
      .catch(() => setError("MCP server unavailable"))
      .finally(() => setLoading(false));
  }, [open, prompts.length]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelected(null);
        setArgs({});
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function handleInsert() {
    if (!selected) return;
    try {
      const res = await fetch("/api/mcp/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selected.name, arguments: args }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (data.text) {
        onInsert(data.text);
        setOpen(false);
        setSelected(null);
        setArgs({});
      }
    } catch {
      setError("Failed to get prompt");
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        title="Insert prompt template"
        className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
          open
            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
            : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)]"
        }`}
      >
        <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
          <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
          <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-80 bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--color-surface-border)] flex items-center gap-2">
            <span className="w-0.5 h-3 bg-[var(--color-accent)] rounded-full" />
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Prompt Templates</p>
          </div>

          {loading && (
            <div className="p-4 text-sm text-[var(--color-text-muted)] text-center">Loading…</div>
          )}
          {error && (
            <div className="p-4 text-sm text-[var(--color-error)]">{error}</div>
          )}

          {!loading && !error && !selected && (
            <div className="max-h-64 overflow-y-auto">
              {prompts.map((p) => (
                <button
                  key={p.name}
                  onClick={() => { setSelected(p); setArgs({}); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-[var(--color-surface-overlay)] transition-colors border-l-2 border-l-transparent hover:border-l-[var(--color-accent)]/40"
                >
                  <p className="text-sm text-[var(--color-text-primary)] font-medium">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1">{p.description}</p>
                  )}
                </button>
              ))}
            </div>
          )}

          {selected && (
            <div className="p-3 space-y-3">
              <button
                onClick={() => setSelected(null)}
                className="text-xs text-[var(--color-text-muted)] flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors"
              >
                ← Back
              </button>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{selected.name}</p>
              {(selected.arguments ?? []).map((arg) => (
                <div key={arg.name}>
                  <label className="text-xs text-[var(--color-text-muted)] block mb-1">
                    {arg.name}{arg.required ? " *" : ""}
                  </label>
                  <textarea
                    value={args[arg.name] ?? ""}
                    onChange={(e) => setArgs((a) => ({ ...a, [arg.name]: e.target.value }))}
                    placeholder={arg.description ?? ""}
                    rows={2}
                    className="w-full bg-[var(--color-surface-overlay)] border border-[var(--color-surface-border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-accent)]/50"
                  />
                </div>
              ))}
              <button
                onClick={handleInsert}
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-lg py-1.5 text-sm font-semibold tracking-wide transition-colors"
              >
                Insert prompt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
