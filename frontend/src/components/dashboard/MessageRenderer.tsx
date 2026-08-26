"use client";

import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { ResultCard } from "./ResultCard";

interface MessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

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
      className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-xs transition-colors hover:border-purple-500 dark:hover:border-purple-400"
      style={{ color: copied ? "#10b981" : undefined }}
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

function parseResultData(content: string) {
  // Detect patterns like "1 sales order" or "1 order found"
  const countMatch = content.match(/(\d+)\s+(sales\s+)?(?:order|result)s?\s+(?:found|with|for)/i);
  if (!countMatch) return null;

  const count = parseInt(countMatch[1]);

  // Extract thinking sections
  let contentWithoutThinking = content;
  let thinking = "";

  const thinkingMatch = content.match(/(My Plan:[\s\S]*?)(?=Let me start|Perfect!)/);
  if (thinkingMatch) {
    thinking = thinkingMatch[1].trim();
    contentWithoutThinking = content.replace(/(My Plan:[\s\S]*?)(?=Let me start|Perfect!)/s, "");
  }

  // Extract order data more carefully
  // Look for individual fields in the response
  const data: Record<string, string>[] = [{}];

  // Extract Order Number (starts with Y followed by digits)
  const orderMatch = contentWithoutThinking.match(/Y\d{10,}/);
  if (orderMatch) {
    data[0]["Order No."] = orderMatch[0];
  }

  // Extract Order Header Key (10-20 digit number)
  const headerKeyMatch = contentWithoutThinking.match(/(?:Order Header Key|20\d{14,})([\s:]*)?(\d{14,})/i);
  if (headerKeyMatch) {
    data[0]["Order Header Key"] = headerKeyMatch[2] || headerKeyMatch[1];
  }

  // Extract Order Date (YYYY-MM-DD format)
  const dateMatch = contentWithoutThinking.match(/(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    data[0]["Order Date"] = dateMatch[0];
  }

  // Extract Enterprise (word before "enterprise" or common names)
  const enterpriseMatch = contentWithoutThinking.match(/(?:enterprise|Enterprise)[:\s]+(\w+)/i);
  if (enterpriseMatch) {
    data[0]["Enterprise"] = enterpriseMatch[1];
  }

  // Extract Status
  const statusMatch = contentWithoutThinking.match(/(?:Status|status)[:\s]+([^,.\n]+)/);
  if (statusMatch) {
    data[0]["Status"] = statusMatch[1].trim();
  }

  // Extract Qty or similar
  const qtyMatch = contentWithoutThinking.match(/(?:Qty|Quantity|1\.00)/);
  if (qtyMatch) {
    data[0]["Qty"] = "1.00";
  }

  // If we found at least an Order No, we have data
  if (!data[0]["Order No."]) return null;

  return { count, data, explanation: undefined, thinking: thinking || undefined };
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
        className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-purple-500 dark:hover:border-purple-400"
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
      <div className="relative group my-3 rounded-xl overflow-hidden text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="p-4 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
        {Toolbar}
      </div>
    );
  }

  return (
    <div className="relative group my-3">
      <pre className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm overflow-x-auto text-slate-700 dark:text-slate-300">
        <code>{code}</code>
      </pre>
      {Toolbar}
    </div>
  );
}

export default function MessageRenderer({ content, isStreaming }: MessageRendererProps) {
  // Remove plan thinking section and make it collapsible
  const [showThinking, setShowThinking] = useState(false);

  // Extract thinking section - ONLY the plan outline (3-4 steps) - not internal debug work
  let thinkingContent = "";
  let displayContent = content;

  // Match "My Plan:" section with its bullet points (typically 3 bullets)
  // Stop at first blank line + answer section marker
  const planMatch = content.match(/My Plan:([\s\S]*?)(?:\n\n)/);

  if (planMatch) {
    thinkingContent = "My Plan:" + planMatch[1].trim();

    // Find where the answer section starts
    // Look for patterns like: "## Results", "## Orders", "Found: X", "Order Tracking", "Summary:", "Order No" (table header)
    const answerPatterns = [
      /\n##\s+/,  // ## header
      /\nFound:\s*\d+/,  // Found: X
      /\nOrder\s+(?:Tracking|Details|No)/i,  // Order Tracking/Details/No
      /\nSummary:/i,  // Summary:
      /\n\|.*\|/,  // Table (markdown row)
    ];

    let answerStart = -1;
    for (const pattern of answerPatterns) {
      const match = content.match(pattern);
      if (match && match.index) {
        if (answerStart === -1 || match.index < answerStart) {
          answerStart = match.index;
        }
      }
    }

    if (answerStart > 0) {
      // Found a clear answer marker - remove plan and everything before it
      displayContent = content.substring(answerStart).trim();
    } else {
      // Fallback: just remove the plan section, keep rest as-is
      const planEndIndex = (planMatch.index ?? 0) + planMatch[0].length;
      displayContent = content.substring(planEndIndex).trim();
    }
  }

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const lang = match ? match[1] : "";
      const codeStr = String(children).replace(/\n$/, "");
      const isBlock = codeStr.includes("\n") || lang;

      if (!isBlock) {
        return (
          <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-slate-900 dark:text-slate-100" {...props}>
            {children}
          </code>
        );
      }

      return <ShikiBlock code={codeStr} lang={lang} />;
    },
    h2({ children }) {
      return (
        <h2 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-2 border-b border-slate-200 dark:border-slate-700 pb-0.5">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-3 mb-2">
          {children}
        </h3>
      );
    },
    ul({ children }) {
      return (
        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 ml-4 my-0">
          {children}
        </ul>
      );
    },
    ol({ children }) {
      return (
        <ol className="list-decimal list-inside text-slate-700 dark:text-slate-300 ml-4 my-0">
          {children}
        </ol>
      );
    },
    li({ children }) {
      return <li className="text-sm leading-tight text-slate-700 dark:text-slate-300">{children}</li>;
    },
    p({ children }) {
      const childStr = String(children).trim();

      // Detect table-like pattern: headers followed by data rows
      if ((childStr.includes("Order No") || childStr.includes("Order Header")) && childStr.includes("Status")) {
        const lines = childStr.split('\n').filter(line => line.trim());
        if (lines.length >= 2) {
          // Parse header row - try to find column positions
          const headerLine = lines[0];

          // Find header positions to align columns
          const headerPositions: { name: string; start: number }[] = [];
          const headerPattern = /Order No|Order Header Key|Enterprise|Order Date|Status|Customer Name|Overall Status|Items|Qty|Holds|Line Count/g;
          let match;

          while ((match = headerPattern.exec(headerLine)) !== null) {
            headerPositions.push({ name: match[0], start: match.index });
          }

          if (headerPositions.length < 2) {
            return <p className="text-sm leading-snug text-slate-700 dark:text-slate-400 mb-1">{children}</p>;
          }

          const headers = headerPositions.map((h) => h.name);

          // Parse data rows using column positions
          const dataRows = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (line && !line.startsWith("Summary") && !line.startsWith("Total") && !line.startsWith("Order Details")) {
              const cells = [];
              for (let j = 0; j < headerPositions.length; j++) {
                const colStart = headerPositions[j].start;
                const colEnd = j < headerPositions.length - 1 ? headerPositions[j + 1].start : line.length;
                const cell = line.substring(colStart, colEnd).trim();
                if (cell) cells.push(cell);
              }
              if (cells.length > 0) {
                dataRows.push(cells);
              }
            }
          }

          if (headers.length > 1 && dataRows.length > 0 && dataRows[0].length === headers.length) {
            return (
              <div className="overflow-x-auto my-2 border border-slate-300 dark:border-slate-600 rounded-lg">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
                      {headers.map((header, idx) => (
                        <th key={idx} className="px-2 py-1.5 text-left font-bold text-slate-900 dark:text-white text-xs">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-slate-200 dark:border-slate-700">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="px-2 py-1.5 text-slate-900 dark:text-slate-100 text-xs">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
        }
      }

      return <p className="text-sm leading-tight text-slate-700 dark:text-slate-400 my-0">{children}</p>;
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto border border-slate-300 dark:border-slate-600 rounded-lg">
          <table className="w-full border-collapse text-sm">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return (
        <thead className="bg-slate-100 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-600">
          {children}
        </thead>
      );
    },
    tbody({ children }) {
      return <tbody>{children}</tbody>;
    },
    tr({ children, header }: any) {
      return (
        <tr className={header ? "" : "border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/50"}>
          {children}
        </tr>
      );
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left font-bold text-slate-900 dark:text-white text-xs">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 text-slate-900 dark:text-slate-100 text-xs break-words">
          {children}
        </td>
      );
    },
    strong({ children }) {
      return <strong className="font-semibold text-slate-900 dark:text-white">{children}</strong>;
    },
    a({ href, children }) {
      return (
        <a href={href} className="text-purple-600 dark:text-purple-400 hover:underline">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="space-y-3">
      {/* Collapsible Thinking Section - Hidden from PDF */}
      {thinkingContent && (
        <div className="border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden print:hidden">
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="w-full px-4 py-2 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">💭 {showThinking ? "Hide" : "Show"} thinking</span>
            <svg
              className={`w-4 h-4 text-blue-900 dark:text-blue-300 transition-transform ${showThinking ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>
          {showThinking && (
            <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/20 text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto print:hidden">
              {thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* Main Content - Rendering Rules:
           - Single spacing between sections (headers/content blocks)
           - Within sections use bullets under headers
           - Between heading and next line: 1.5 line spacing
           - Tables auto-rendered from markdown
      */}
      <div className="prose-dashboard text-sm leading-tight text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {displayContent}
        </ReactMarkdown>
        {isStreaming && (
          <span className="inline-block w-0.5 h-[15px] bg-purple-600 ml-0.5 animate-pulse rounded-full align-text-bottom" />
        )}
      </div>
    </div>
  );
}
