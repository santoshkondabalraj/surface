"use client";

import { useRef, useEffect, KeyboardEvent } from "react";
import * as XLSX from "xlsx";
import type { FileAttachment } from "@/lib/types";
import PromptPicker from "./PromptPicker";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isStreaming?: boolean;
  disabled?: boolean;
  attachments?: FileAttachment[];
  onAttach?: (files: FileAttachment[]) => void;
  onRemoveAttachment?: (index: number) => void;
}

function buildMarkdownTable(rows: unknown[][]): string {
  if (rows.length === 0) return "";
  const header = rows[0].map(String);
  const sep = header.map(() => "---");
  const body = rows.slice(1).map((r) => (r as unknown[]).map(String));
  return [header, sep, ...body].map((r) => `| ${r.join(" | ")} |`).join("\n");
}

export default function MessageInput({
  value, onChange, onSubmit, onStop, isStreaming, disabled,
  attachments, onAttach, onRemoveAttachment,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [value]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSubmit();
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      const preview = buildMarkdownTable(rows.slice(0, 50));
      const attachment: FileAttachment = {
        name: file.name,
        type: file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel",
        rowCount: Math.max(0, rows.length - 1),
        preview,
      };
      onAttach?.([attachment]);
    } catch {
      // ignore parse errors silently
    }
    e.target.value = "";
  }

  return (
    <div className="px-4 pb-6 pt-2" data-noprint>
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded-2xl transition-all focus-within:border-[#3a3a3c] focus-within:shadow-[0_0_0_3px_rgba(32,178,170,0.08)]">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKey}
            disabled={isStreaming}
            placeholder="Ask anything…"
            rows={1}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-[16px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] resize-none focus:outline-none min-h-[52px] max-h-[200px] overflow-y-auto leading-relaxed"
          />

          {/* Attachment chips */}
          {attachments && attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-4 pt-1 pb-2">
              {attachments.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 bg-[var(--color-surface-overlay)] border border-[var(--color-surface-border)] rounded-lg px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)]"
                >
                  <span>📎</span>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-[var(--color-text-muted)]">({a.rowCount} rows)</span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment?.(i)}
                    className="ml-1 text-[var(--color-text-muted)] hover:text-[var(--color-error)] transition-colors leading-none"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-1.5">
              <PromptPicker onInsert={(text) => onChange(text)} disabled={disabled} />
              <span className="text-[11px] text-[var(--color-text-muted)]">Templates</span>

              {/* File upload */}
              <label className="cursor-pointer flex items-center justify-center w-7 h-7 rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors ml-1">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={disabled ?? isStreaming}
                />
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </label>
              <span className="text-[11px] text-[var(--color-text-muted)]">Excel/CSV</span>
            </div>

            {isStreaming ? (
              <button
                onClick={onStop}
                className="flex items-center gap-1.5 bg-[var(--color-surface-overlay)] hover:bg-[var(--color-surface-border)] border border-[var(--color-surface-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-error)] hover:border-[var(--color-error)]/30 rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all"
              >
                <span className="w-2 h-2 rounded-sm bg-current" />
                Stop
              </button>
            ) : (
              <button
                onClick={onSubmit}
                disabled={!value.trim() && !(attachments && attachments.length > 0)}
                className="flex items-center justify-center w-8 h-8 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-20 disabled:cursor-not-allowed text-white rounded-full transition-all"
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current rotate-90">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-[12px] text-[var(--color-text-muted)] text-center mt-2.5">
          Orbiter may make mistakes. Verify generated code and queries before use.
        </p>
      </div>
    </div>
  );
}
