"use client";

import React from "react";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  // Simple inline markdown processing
  const renderInline = (text: string) => {
    let elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Match **bold**, *italic*, `code`, and links
    const patterns = [
      { regex: /\*\*([^\*]+)\*\*/g, tag: "strong" },
      { regex: /\*([^\*]+)\*/g, tag: "em" },
      { regex: /`([^\`]+)`/g, tag: "code" },
    ];

    // First split by line breaks
    const lines = text.split("\n");

    return lines.map((line, lineIndex) => {
      let lineElements: React.ReactNode[] = [];
      let lastPos = 0;

      // Process inline formatting
      const regex = /(\*\*[^\*]+\*\*|\*[^\*]+\*|`[^\`]+`)/g;
      let match;

      while ((match = regex.exec(line)) !== null) {
        // Add text before match
        if (match.index > lastPos) {
          lineElements.push(line.substring(lastPos, match.index));
        }

        // Add formatted element
        const matched = match[0];
        if (matched.startsWith("**")) {
          lineElements.push(
            <strong key={`strong-${match.index}`} className="font-semibold">
              {matched.slice(2, -2)}
            </strong>
          );
        } else if (matched.startsWith("*")) {
          lineElements.push(
            <em key={`em-${match.index}`} className="italic">
              {matched.slice(1, -1)}
            </em>
          );
        } else if (matched.startsWith("`")) {
          lineElements.push(
            <code
              key={`code-${match.index}`}
              className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-xs font-mono"
            >
              {matched.slice(1, -1)}
            </code>
          );
        }

        lastPos = match.index + matched.length;
      }

      // Add remaining text
      if (lastPos < line.length) {
        lineElements.push(line.substring(lastPos));
      }

      return (
        <div key={lineIndex}>
          {lineElements.length === 0 ? " " : lineElements}
        </div>
      );
    });
  };

  return (
    <div className="prose-oms text-sm leading-relaxed">
      {renderInline(content)}
      {isStreaming && (
        <span
          className="inline-block w-2 h-5 ml-1 bg-slate-400 dark:bg-slate-500"
          style={{ animation: "blink 1s infinite" }}
        />
      )}
    </div>
  );
}
