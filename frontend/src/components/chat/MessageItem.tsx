"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "@/lib/types";
import ToolCallBlock from "./ToolCallBlock";
import { useEffect, useState, useRef } from "react";
import type { Components } from "react-markdown";

interface Props {
  message: Message;
}

function useThinkingSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!active) {
      if (ref.current) clearInterval(ref.current);
      setSeconds(0);
      return;
    }
    setSeconds(0);
    ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [active]);
  return seconds;
}

export default function MessageItem({ message }: Props) {
  const isUser = message.role === "user";

  if (isUser) {
    const sep = "\n\n---\n\n";
    const lastSepIdx = message.attachments?.length ? message.content.lastIndexOf(sep) : -1;
    const displayContent = lastSepIdx !== -1
      ? message.content.slice(lastSepIdx + sep.length)
      : message.content;

    return (
      <div className="flex justify-end mb-8">
        <div className="max-w-[75%] flex flex-col gap-2 items-end">
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 justify-end">
              {message.attachments.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1.5 bg-[var(--color-surface-overlay)] border border-[var(--color-surface-border)] rounded-lg px-2.5 py-1 text-[12px] text-[var(--color-text-secondary)]"
                >
                  <span>📎</span>
                  <span className="font-medium">{a.name}</span>
                  <span className="text-[var(--color-text-muted)]">({a.rowCount} rows)</span>
                </span>
              ))}
            </div>
          )}
          <div className="bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded-2xl rounded-br-sm px-4 py-3 text-[16px] font-semibold text-[var(--color-text-primary)] whitespace-pre-wrap break-words leading-relaxed">
            {displayContent}
          </div>
        </div>
      </div>
    );
  }

  const isThinking = !!message.isStreaming && message.toolCalls.length === 0 && !message.content;
  const thinkingSeconds = useThinkingSeconds(isThinking);

  return (
    <div className="mb-10">
      {/* Status line — shown while the LLM is reasoning before its first output */}
      {isThinking && (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s`, opacity: 0.5 }}
              />
            ))}
          </div>
          <span className="text-[13px] font-medium text-[var(--color-text-muted)]">Thinking…</span>
          {thinkingSeconds >= 3 && (
            <span className="text-[12px] tabular-nums text-[var(--color-text-muted)]">{thinkingSeconds}s</span>
          )}
        </div>
      )}

      {/* Tool calls — Perplexity-style "steps" */}
      {message.toolCalls.length > 0 && (
        <div className="mb-5 space-y-1.5">
          {message.toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Answer */}
      {message.content && (
        <div className="prose-oms">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Streaming tail */}
      {message.isStreaming && message.content && (
        <span className="inline-block w-0.5 h-[15px] bg-[var(--color-accent)] ml-0.5 animate-pulse rounded-full align-text-bottom" />
      )}
    </div>
  );
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const lang = match ? match[1] : "";
    const codeStr = String(children).replace(/\n$/, "");
    const isBlock = codeStr.includes("\n") || lang;

    if (!isBlock) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }

    return <ShikiBlock code={codeStr} lang={lang} />;
  },
};


const EXT: Record<string, string> = {
  python: "py", typescript: "ts", javascript: "js", sql: "sql",
  json: "json", yaml: "yml", bash: "sh", shell: "sh", dockerfile: "dockerfile",
  xml: "xml", markdown: "md", csv: "csv", html: "html", css: "css",
};

function downloadCode(code: string, lang: string) {
  const ext = EXT[lang] ?? "txt";
  const blob = new Blob([code], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `artifact.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy"
      className="flex items-center gap-1 bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded-md px-2 py-1 text-[11px] transition-colors hover:border-[var(--color-accent)]"
      style={{ color: copied ? "var(--color-success)" : "var(--color-text-muted)" }}
    >
      {copied ? (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-2M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("shiki").then(({ codeToHtml }) => {
      codeToHtml(code, { lang: lang || "text", theme: "github-light" })
        .then((result) => {
          if (!cancelled) setHtml(result);
        })
        .catch(() => {
          if (!cancelled) setHtml(null);
        });
    });
    return () => { cancelled = true; };
  }, [code, lang]);

  const Toolbar = (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10">
      <CopyButton code={code} />
      <button
        onClick={() => downloadCode(code, lang)}
        title="Download"
        className="flex items-center gap-1 bg-[var(--color-surface-raised)] border border-[var(--color-surface-border)] rounded-md px-2 py-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-accent)]"
      >
        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 3v10m0 0l-3-3m3 3l3-3M4 17h12" />
        </svg>
        Download
      </button>
    </div>
  );

  if (html) {
    return (
      <div className="relative group my-3 rounded-xl overflow-hidden text-sm">
        <div dangerouslySetInnerHTML={{ __html: html }} />
        {Toolbar}
      </div>
    );
  }

  return (
    <div className="relative group my-3">
      <pre className="p-4 rounded-xl bg-[var(--color-pre-bg)] border border-[var(--color-surface-border)] text-sm overflow-x-auto text-[var(--color-text-secondary)]">
        <code>{code}</code>
      </pre>
      {Toolbar}
    </div>
  );
}
