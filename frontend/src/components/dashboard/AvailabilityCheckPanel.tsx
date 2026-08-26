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
  chartData?: TrendData[];
}

interface TrendData {
  date: string;
  availability: number;
  cumulativeSupply: number;
  cumulativeDemand: number;
}

type TemplateType = "sku-location" | "sku-enterprise" | "sku-cluster" | "7day-trend";

interface Template {
  id: TemplateType;
  label: string;
  emoji: string;
  description: string;
  query: (sku: string, param?: string) => string;
}

export default function AvailabilityCheckPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { history, addQuery, clearHistory } = useQueryHistory({
    storageKey: "availability-check-history",
    maxItems: 10,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const templates: Template[] = [
    {
      id: "sku-location",
      label: "SKU-Location",
      emoji: "📍",
      description: "Check availability at specific location",
      query: (sku, location) => `What is the available stock for SKU ${sku} at location ${location || "[Location]"}?`,
    },
    {
      id: "sku-enterprise",
      label: "SKU-Enterprise",
      emoji: "🏢",
      description: "Total availability across enterprise",
      query: (sku, enterprise) => `What is the total available stock for SKU ${sku} across enterprise ${enterprise || "[Enterprise]"}?`,
    },
    {
      id: "sku-cluster",
      label: "SKU-Cluster",
      emoji: "🔗",
      description: "Availability across cluster",
      query: (sku, cluster) => `What is the available stock for SKU ${sku} across cluster ${cluster || "[Cluster]"}?`,
    },
    {
      id: "7day-trend",
      label: "7-Day Trend",
      emoji: "📊",
      description: "Availability trend with supply/demand",
      query: (sku) => `Show me the 7-day availability trend for SKU ${sku} at network level with cumulative supply and demand.`,
    },
  ];

  // Mock 7-day trend data
  const generateTrendData = (sku: string): TrendData[] => [
    { date: "7d ago", availability: 145, cumulativeSupply: 500, cumulativeDemand: 355 },
    { date: "6d ago", availability: 142, cumulativeSupply: 520, cumulativeDemand: 378 },
    { date: "5d ago", availability: 138, cumulativeSupply: 540, cumulativeDemand: 402 },
    { date: "4d ago", availability: 135, cumulativeSupply: 560, cumulativeDemand: 425 },
    { date: "3d ago", availability: 128, cumulativeSupply: 580, cumulativeDemand: 452 },
    { date: "2d ago", availability: 120, cumulativeSupply: 600, cumulativeDemand: 480 },
    { date: "today", availability: 112, cumulativeSupply: 610, cumulativeDemand: 498 },
  ];

  const handleTemplateClick = (template: Template) => {
    // Generate a template query with helpful placeholders
    let param = "";
    switch (template.id) {
      case "sku-location":
        param = "[e.g., Hub-Central]";
        break;
      case "sku-enterprise":
        param = "[e.g., North America]";
        break;
      case "sku-cluster":
        param = "[e.g., Metro-East]";
        break;
    }
    const query = template.query("SKU-EL-4521", param);
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

  // Chart renderer for 7-day trend
  const TrendChart = ({ data }: { data: TrendData[] }) => {
    if (!data || data.length === 0) return null;

    const maxAvailability = Math.max(...data.map((d) => d.availability));
    const chartHeight = 200;
    const chartWidth = 400;
    const pointSpacing = chartWidth / (data.length - 1);

    const getY = (value: number) => chartHeight - (value / maxAvailability) * chartHeight;

    const points = data
      .map((d, i) => `${i * pointSpacing},${getY(d.availability)}`)
      .join(" ");

    return (
      <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
          7-Day Availability Trend
        </p>
        <div className="relative inline-block">
          <svg width={chartWidth} height={chartHeight + 40} className="overflow-visible">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
              <line
                key={`grid-${i}`}
                x1="0"
                y1={chartHeight - ratio * chartHeight}
                x2={chartWidth}
                y2={chartHeight - ratio * chartHeight}
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.1"
                className="text-slate-400"
              />
            ))}

            {/* Line chart */}
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-purple-600"
            />

            {/* Data points */}
            {data.map((d, i) => {
              const x = i * pointSpacing;
              const y = getY(d.availability);
              return (
                <g key={`point-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4"
                    fill="currentColor"
                    className="text-purple-600"
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                    style={{ cursor: "pointer" }}
                  />
                  {hoveredPoint === i && (
                    <g>
                      <rect
                        x={x - 50}
                        y={y - 65}
                        width="100"
                        height="55"
                        fill="currentColor"
                        className="text-slate-900 dark:text-slate-100"
                        rx="4"
                      />
                      <text
                        x={x}
                        y={y - 45}
                        textAnchor="middle"
                        className="text-xs font-bold fill-white"
                      >
                        {d.date}
                      </text>
                      <text
                        x={x}
                        y={y - 30}
                        textAnchor="middle"
                        className="text-xs fill-white"
                      >
                        Available: {d.availability}
                      </text>
                      <text
                        x={x}
                        y={y - 15}
                        textAnchor="middle"
                        className="text-xs fill-white"
                      >
                        Supply: {d.cumulativeSupply}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={`label-${i}`}
                x={i * pointSpacing}
                y={chartHeight + 20}
                textAnchor="middle"
                className="text-xs fill-slate-500"
              >
                {d.date}
              </text>
            ))}
          </svg>
        </div>
        <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p>
            <span className="font-semibold">Line:</span> Available stock over time
          </p>
          <p>
            <span className="font-semibold">Hover:</span> View supply/demand details
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto w-full p-8 space-y-8">
        {/* Introduction */}
        <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
          <p>• <span className="font-semibold">Question Cards:</span> Click any card below to populate a ready-to-use availability question</p>
          <p>• <span className="font-semibold">Free-form Search:</span> Use the text box to ask custom questions about inventory, stock levels, and supply chain status</p>
        </div>

        {/* Question Cards */}
        <div className="grid grid-cols-2 gap-3">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplateClick(template)}
              className="border-2 border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30 hover:border-purple-300 dark:hover:border-purple-600 transition-all text-left"
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">{template.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{template.label}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2">{template.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Messages Area */}
        {messages.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
              Query Results
            </h3>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30"
                >
                  {message.role === "user" && (
                    <div className="mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Your Query:</p>
                      <p className="text-sm text-slate-900 dark:text-white mt-1">{message.content}</p>
                    </div>
                  )}

                  {message.role === "assistant" && (
                    <div className="w-full" style={{ minHeight: '1.5em' }}>
                      <MessageRenderer
                        content={message.content}
                        isStreaming={isLoading && message === messages[messages.length - 1]}
                      />
                      {message.chartData && <TrendChart data={message.chartData} />}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                        {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="border-2 border-slate-200 dark:border-slate-700 rounded-xl p-5 bg-gradient-to-br from-slate-50/50 to-slate-100/30 dark:from-slate-900/50 dark:to-slate-800/30 flex items-center gap-3">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Processing query...</p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 transition-colors">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
            Availability Search
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about stock levels, availability across locations, supply chain status..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none resize-none text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 p-3 transition-colors"
                rows={2}
              />
              {inputValue.includes("[e.g.,") && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 ml-1">
                  💡 Replace the bracketed placeholder with your specific value (e.g., Hub-Central, North America, Metro-East)
                </p>
              )}
            </div>
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
          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-2">⏎ Enter to send • Shift+⏎ New line</p>
        </div>

        {/* Query History Panel */}
        <QueryHistoryPanel
          history={history}
          onSelectQuery={(query) => setInputValue(query)}
          onClearHistory={clearHistory}
        />
        </div>
      </div>
    </div>
  );
}
