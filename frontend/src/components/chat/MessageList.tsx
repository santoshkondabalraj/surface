"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";
import MessageItem from "./MessageItem";

interface Props {
  messages: Message[];
  onSuggestion?: (text: string) => void;
}

const SUGGESTIONS = [
  "What's the difference between Order Invoice and Shipment Invoice?",
  "How do order holds work in Sterling?",
  "What are the prerequisites for releasing an order?",
  "Explain the payment authorization flow",
  "How is inventory allocated during order capture?",
  "What happens during shipment confirmation?",
];

export default function MessageList({ messages, onSuggestion }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20">
          🤖
        </div>
        <h2 className="text-[20px] font-extrabold text-[var(--color-text-primary)] mb-1 tracking-tight">
          OMS Q&A Assistant
        </h2>
        <p className="text-[14px] font-medium text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          Ask questions about Sterling OMS business rules, process flows, and integration patterns.
        </p>
        <div className="mt-7 flex flex-wrap gap-2 justify-center max-w-lg">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggestion?.(s)}
              className="bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-overlay)] border border-[var(--color-surface-border)] hover:border-[var(--color-surface-overlay)] rounded-full px-4 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-0">
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
