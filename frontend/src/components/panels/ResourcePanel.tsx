"use client";

import { useState, useEffect } from "react";
import type { MCPResource } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ResourceContent {
  uri: string;
  content: string;
}

export default function ResourcePanel({ open, onClose }: Props) {
  const [resources, setResources] = useState<MCPResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResourceContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    if (!open || resources.length > 0) return;
    setLoading(true);
    fetch("/api/mcp/resources")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResources(data as MCPResource[]);
        else setError("Failed to load resources");
      })
      .catch(() => setError("MCP server unavailable"))
      .finally(() => setLoading(false));
  }, [open, resources.length]);

  async function handleSelect(uri: string) {
    if (selected?.uri === uri) { setSelected(null); return; }
    setLoadingContent(true);
    try {
      const res = await fetch(`/api/mcp/resources?uri=${encodeURIComponent(uri)}`);
      const data = await res.json() as { contents?: Array<{ text?: string }> };
      const text = data.contents?.[0]?.text ?? JSON.stringify(data, null, 2);
      setSelected({ uri, content: text });
    } catch {
      setError("Failed to load resource");
    } finally {
      setLoadingContent(false);
    }
  }

  function copyUri(uri: string, e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(uri);
  }

  const grouped = groupByPrefix(resources);

  return (
    <div
      className={`absolute right-0 top-0 h-full w-80 bg-[var(--color-surface-raised)] border-l border-[var(--color-surface-border)] flex flex-col transform transition-transform duration-200 z-40 ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-surface-border)] flex-shrink-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">Resources</p>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>}
        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}

        {Object.entries(grouped).map(([prefix, items]) => (
          <div key={prefix}>
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold mb-1.5 px-1">{prefix}</p>
            <div className="space-y-0.5">
              {items.map((r) => (
                <div key={r.uri}>
                  <button
                    onClick={() => handleSelect(r.uri)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors group flex items-start gap-2 ${
                      selected?.uri === r.uri
                        ? "bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)] hover:bg-black/5"
                    }`}
                  >
                    <span className="flex-1 font-mono truncate">{r.uri.split("/").pop()}</span>
                    <span
                      onClick={(e) => copyUri(r.uri, e)}
                      title="Copy URI"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && copyUri(r.uri, e as unknown as React.MouseEvent)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-opacity"
                    >
                      <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                    </span>
                  </button>

                  {selected?.uri === r.uri && (
                    <div className="mt-1 mx-2 p-2.5 bg-[var(--color-surface-overlay)] rounded-lg">
                      {loadingContent ? (
                        <p className="text-xs text-[var(--color-text-muted)]">Loading…</p>
                      ) : (
                        <pre className="text-[10px] text-[var(--color-text-secondary)] whitespace-pre-wrap break-words max-h-64 overflow-y-auto font-mono leading-relaxed">
                          {selected.content}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function groupByPrefix(resources: MCPResource[]): Record<string, MCPResource[]> {
  const groups: Record<string, MCPResource[]> = {};
  for (const r of resources) {
    const parts = r.uri.split("/");
    const prefix = parts.slice(0, 3).join("/");
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(r);
  }
  return groups;
}
