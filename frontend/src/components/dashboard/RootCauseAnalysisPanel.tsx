"use client";

import { useState, useRef, useEffect } from "react";
import { streamChat } from "@/lib/chat-streaming";
import { useBufferedStreaming } from "@/lib/useBufferedStreaming";
import { useQueryHistory } from "@/hooks/useQueryHistory";
import MessageRenderer from "./MessageRenderer";
import QueryHistoryPanel from "./QueryHistoryPanel";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  templateType?: string;
}

interface QuestionTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  query: (orderNum?: string) => string;
}

const questionTemplates: QuestionTemplate[] = [
  {
    id: "stuck-order",
    label: "Orders Stuck",
    emoji: "🔴",
    description: "Order not progressing - stuck in fulfillment",
    query: (orderNum) =>
      `Why is my order ${orderNum || "ORD-2024-001"} stuck? It's been in processing for days with no progress. What's blocking fulfillment?`,
  },
  {
    id: "backordered",
    label: "Backorder Reason",
    emoji: "📦",
    description: "Why was my order backord­ered?",
    query: (orderNum) =>
      `My order ${orderNum || "ORD-2024-001"} was backordered. Which items were out of stock and why? When will they be available?`,
  },
  {
    id: "multiple-shipments",
    label: "Multiple Shipments",
    emoji: "🚚",
    description: "Why did my order split into multiple shipments?",
    query: (orderNum) =>
      `Why was my order ${orderNum || "ORD-2024-001"} split into multiple shipments? What items are in each shipment and why the split?`,
  },
  {
    id: "fund-transfer",
    label: "Fund Transfer",
    emoji: "💰",
    description: "Return & exchange fund transfer issues",
    query: (orderNum) =>
      `I have a question about fund transfer between my return and exchange for order ${orderNum || "ORD-2024-001"}. How is the credit being applied?`,
  },
  {
    id: "transfer-dropship",
    label: "Transfer & Drop Ship",
    emoji: "🔀",
    description: "Transfer orders and drop ship fulfillment",
    query: (orderNum) =>
      `My order ${orderNum || "ORD-2024-001"} involves transfer fulfillment or drop shipping. Can you explain how this will be fulfilled and timeline?`,
  },
];

export default function RootCauseAnalysisPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { history, addQuery, clearHistory } = useQueryHistory({
    storageKey: "root-cause-history",
    maxItems: 10,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleTemplateClick = (template: QuestionTemplate) => {
    const query = template.query(orderNumber || undefined);
    setInputValue(query);
    inputRef.current?.focus();
  };

  const currentAssistantIdRef = useRef<string>("");

  const { handleDelta, flushBuffer } = useBufferedStreaming((bufferedText: string) => {
    setMessages((current) => {
      const updated = [...current];
      const assistantMsg = updated.find((m) => m.id === currentAssistantIdRef.current);
      if (assistantMsg) {
        // Prevent duplicate appending if this updater is called multiple times
        if (!assistantMsg.content.endsWith(bufferedText)) {
          assistantMsg.content += bufferedText;
        }
      }
      return updated;
    });
  });

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    addQuery(inputValue);

    setInputValue("");
    setIsLoading(true);

    // Create assistant message placeholder with unique ID
    const assistantId = (Date.now() + Math.random()).toString();
    currentAssistantIdRef.current = assistantId;

    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    // Update state FIRST (synchronously)
    const prevMessages = messages;
    setMessages([...messages, userMessage, assistantMessage]);

    // Then stream SEPARATELY (no async inside state setter)
    try {
      await streamChat(
        prevMessages.map((m) => ({ role: m.role, content: m.content })).concat([
          { role: "user", content: userMessage.content },
        ]),
        {
          onText: handleDelta,
          onMessageStop: () => {
            flushBuffer();
            setIsLoading(false);
          },
          onError: (error: string) => {
            flushBuffer();
            setMessages((current) => {
              const updated = [...current];
              const assistantMsg = updated.find((m) => m.id === assistantId);
              if (assistantMsg) {
                assistantMsg.content = `Error: ${error}`;
              }
              return updated;
            });
            setIsLoading(false);
          },
        }
      );
    } catch (err) {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full p-8 space-y-8">
        {/* Introduction */}
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p>
            • <span className="font-semibold">Root Cause Analysis:</span> Investigate why orders are
            stuck, backordered, split, or facing fulfillment issues
          </p>
          <p>
            • <span className="font-semibold">Order Number (Optional):</span> Enter your order number
            below to analyze specific fulfillment problems
          </p>
        </div>

        {/* Order Number Input */}
        <div className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50/50 dark:bg-slate-900/30">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2">
            Order Number (Optional)
          </label>
          <input
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="e.g., ORD-2024-001, #123456"
            className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Enter your order number to analyze specific fulfillment issue. Leave blank to use generic
            examples.
          </p>
        </div>

        {/* Question Cards */}
        <div className="grid grid-cols-2 gap-3">
          {questionTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{template.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{template.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">
                    {template.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Messages Area */}
        {messages.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">
              Analysis Results
            </h3>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                      A
                    </div>
                  )}

                  <div
                    className={`w-full max-w-4xl rounded-lg px-4 py-3 text-xs ${
                      message.role === "user"
                        ? "bg-purple-600 dark:bg-purple-700 text-white rounded-br-none"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-none"
                    }`}
                    style={{ minHeight: '1.5em' }}
                  >
                    {message.role === "user" ? (
                      <div className="leading-relaxed whitespace-pre-wrap break-words overflow-wrap-break-word">
                        {message.content}
                      </div>
                    ) : (
                      <MessageRenderer
                        content={message.content}
                        isStreaming={isLoading && message === messages[messages.length - 1]}
                      />
                    )}
                    <p className="text-xs opacity-60 mt-2">
                      {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  {message.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                      U
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
                    A
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-4 py-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    ></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
        </div>

        {/* Query History Panel */}
        <QueryHistoryPanel
          history={history}
          onSelectQuery={(query) => setInputValue(query)}
          onClearHistory={clearHistory}
        />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 transition-colors">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Root Cause Analysis Query
          </p>
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask why your order is stuck, backordered, split, or has fulfillment issues..."
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none resize-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 p-3 transition-colors"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className={`flex-shrink-0 p-2.5 rounded-lg transition-colors ${
                inputValue.trim() && !isLoading
                  ? "text-purple-600 dark:text-purple-400 hover:opacity-80"
                  : "text-slate-400 dark:text-slate-600 opacity-50"
              }`}
              title="Send message (Enter)"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.488 5.951 1.488a1 1 0 001.169-1.409l-7-14z" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-2">
            ⏎ Enter to send • Shift+⏎ New line
          </p>
        </div>
      </div>
    </div>
  );
}
