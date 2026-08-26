"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { streamChat } from "@/lib/chat-streaming";
import { useQueryHistory } from "@/hooks/useQueryHistory";
import MessageRenderer from "./MessageRenderer";
import QueryHistoryPanel from "./QueryHistoryPanel";
import RbacPanel from "./RbacPanel";
import SystemConfigPanel from "./SystemConfigPanel";
import ObservabilityPanel from "./ObservabilityPanel";
import HealthDashboardOverview from "./HealthDashboardOverview";
import DelayedOrdersPanel from "./DelayedOrdersPanel";
import AtRiskOrdersPanel from "./AtRiskOrdersPanel";
import FillRatePanel from "./FillRatePanel";
import InventoryAlertsPanel from "./InventoryAlertsPanel";
import AvailabilityCheckPanel from "./AvailabilityCheckPanel";
import PlaygroundPanel from "./PlaygroundPanel";
import OrderEnquiryPanel from "./OrderEnquiryPanel";
import RootCauseAnalysisPanel from "./RootCauseAnalysisPanel";

interface MainContentProps {
  selectedSection: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// Single brand color
const BRAND_COLOR = {
  light: "text-purple-600",
  border: "border-purple-200",
  bg: "bg-purple-50/30",
  dark: "text-purple-400",
};

const sectionConfig = {
  "query-generator": {
    title: "Query Generator",
    icon: "✨",
    description: "Transform natural language into powerful SQL queries",
  },
  "order-support": {
    title: "Order Support",
    icon: "📦",
    description: "Manage, analyze, and resolve order-related issues",
  },
  "order-enquiry": {
    title: "Order Enquiry",
    icon: "🔍",
    description: "Track orders, check status, payments, returns, and shipping",
  },
  "root-cause": {
    title: "Root Cause Analysis",
    icon: "🔬",
    description: "Investigate stuck orders, backorders, split shipments, and fulfillment issues",
  },
  "inventory-diagnosis": {
    title: "Inventory Diagnosis",
    icon: "📊",
    description: "Monitor inventory health and availability metrics",
  },
  "inventory-rca": {
    title: "Inventory Alerts",
    icon: "🚨",
    description: "Monitor out-of-stock, safety stock breaches, DIO, damaged inventory, slow-turning stock, and ETA breaches",
  },
  "availability": {
    title: "Availability Check",
    icon: "✓",
    description: "Real-time stock level and availability analysis",
  },
  "playground": {
    title: "Playground",
    icon: "🎮",
    description: "Simulate operational decisions and impact on KPIs",
  },
  "functional-health": {
    title: "Fulfillment Health",
    icon: "💚",
    description: "Real-time fulfillment performance and KPIs",
  },
  "delayed-orders": {
    title: "Delayed Orders",
    icon: "⏰",
    description: "Monitor and manage orders that are running late",
  },
  "at-risk": {
    title: "At-Risk Orders",
    icon: "⚠️",
    description: "Identify orders at risk of delay or failure",
  },
  "fill-rate": {
    title: "Fill Rate (48h)",
    icon: "📈",
    description: "Track fulfillment efficiency and completion rates",
  },
  "administration": {
    title: "Administration",
    icon: "⚙️",
    description: "System configuration, access control, and monitoring",
  },
  "rbac": {
    title: "Access Control",
    icon: "🔐",
    description: "Manage user roles, permissions, and groups",
  },
  "system-config": {
    title: "System Config",
    icon: "⚙️",
    description: "Manage system integrations and configurations",
  },
  "observability": {
    title: "Observability",
    icon: "👁️",
    description: "Monitor performance, evaluate models, and manage datasets",
  },
  "billing": {
    title: "Billing",
    icon: "💳",
    description: "Usage tracking and billing management",
  },
};

export default function MainContent({ selectedSection }: MainContentProps) {
  const config = sectionConfig[selectedSection as keyof typeof sectionConfig] || sectionConfig["query-generator"];
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [showSpaces, setShowSpaces] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { history, addQuery, clearHistory } = useQueryHistory({
    storageKey: "query-generator-history",
    maxItems: 10,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    addQuery(inputValue);

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue("");
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      await streamChat(
        updatedMessages.map((m) => ({ role: m.role, content: m.content })),
        {
          onText: (delta: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                // Prevent duplicate appending if this updater is called multiple times
                if (!lastMsg.content.endsWith(delta)) {
                  lastMsg.content += delta;
                }
              }
              return updated;
            });
          },
          onMessageStop: () => {
            setIsLoading(false);
          },
          onError: (error: string) => {
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg && lastMsg.role === "assistant") {
                lastMsg.content = `Error: ${error}`;
              }
              return updated;
            });
            setIsLoading(false);
          },
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) => {
        const updated = [...prev];
        const lastMsg = updated[updated.length - 1];
        if (lastMsg && lastMsg.role === "assistant") {
          lastMsg.content = `Failed to get response: ${message}`;
        }
        return updated;
      });
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    // Find the messages container - look for the space/div containing messages
    let messagesElement = null;

    // Try to find by looking for the messages container in different panel types
    const mainContent = document.querySelector("main .flex-1.overflow-y-auto");
    if (mainContent) {
      // Look for the last div that contains the conversation or query results
      const divs = mainContent.querySelectorAll("div");
      // Find the div that contains message bubbles (has role or className patterns)
      for (let i = divs.length - 1; i >= 0; i--) {
        const div = divs[i];
        if (div.querySelector("[class*='flex'][class*='gap-3']") ||
            div.textContent.includes("Analysis Results") ||
            div.textContent.includes("Query Results") ||
            div.textContent.includes("Conversation")) {
          messagesElement = div;
          break;
        }
      }
    }

    if (!messagesElement) {
      alert("No conversation to export. Please submit a query first.");
      return;
    }

    // Create a print window
    const printWindow = window.open("", "", "width=900,height=800");
    if (!printWindow) {
      alert("Unable to open print window. Please check your browser settings.");
      return;
    }

    // Clone messages
    const clonedMessages = messagesElement.cloneNode(true) as HTMLElement;

    // Remove user/assistant avatars (U and A circles)
    const avatars = clonedMessages.querySelectorAll("[class*='rounded-full'][class*='w-6'][class*='h-6']");
    avatars.forEach((avatar) => {
      (avatar as HTMLElement).style.display = "none";
    });

    const style = document.createElement("style");
    style.innerHTML = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        line-height: 1.8;
        color: #1a1a1a;
        padding: 40px;
        background: white;
        max-width: 900px;
        margin: 0 auto;
      }
      h1 { font-size: 24px; font-weight: 700; margin-bottom: 20px; border-bottom: 3px solid #6366f1; padding-bottom: 10px; }
      h2 { font-size: 18px; font-weight: 600; margin-top: 20px; margin-bottom: 10px; color: #333; }
      h3 { font-size: 15px; font-weight: 600; margin-top: 15px; margin-bottom: 8px; color: #555; }
      p { font-size: 14px; line-height: 1.8; margin-bottom: 12px; }
      li { font-size: 14px; line-height: 1.8; margin-left: 20px; margin-bottom: 8px; }
      ul, ol { margin-bottom: 12px; }

      pre, code {
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 12px;
        font-family: 'Courier New', monospace;
        font-size: 13px;
        overflow-x: auto;
        margin: 12px 0;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin: 15px 0;
        font-size: 13px;
      }
      th { background: #f0f0f0; padding: 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
      td { padding: 8px 10px; border-bottom: 1px solid #eee; }

      .message-user { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #2196f3; }
      .message-assistant { background: white; padding: 15px; margin: 15px 0; }

      strong { font-weight: 600; color: #000; }

      @page { margin: 0.5in; }
      @media print {
        body { padding: 20px; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${config.title} - ${new Date().toISOString().split("T")[0]}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <h1>${config.title}</h1>
          <p style="color: #999; font-size: 12px; margin-bottom: 20px;">Generated on ${new Date().toLocaleString()}</p>
          ${clonedMessages.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.head.appendChild(style);
    printWindow.document.close();

    // Trigger print dialog
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const handleStop = () => {
    setIsLoading(false);
  };

  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear chat history? This cannot be undone.")) {
      setMessages([]);
      setShowChatMenu(false);
    }
  };

  const handleAddToSpace = () => {
    setShowSpaces(!showSpaces);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Check if current section is a special panel or health dashboard subsection
  const isRbacSection = selectedSection === "rbac";
  const isSystemConfigSection = selectedSection === "system-config";
  const isObservabilitySection = selectedSection === "observability";
  const isHealthDashboardSection = selectedSection === "functional-health";
  const isDelayedOrdersSection = selectedSection === "delayed-orders";
  const isAtRiskSection = selectedSection === "at-risk";
  const isFillRateSection = selectedSection === "fill-rate";
  const isInventoryRcaSection = selectedSection === "inventory-rca";
  const isAvailabilitySection = selectedSection === "availability";
  const isPlaygroundSection = selectedSection === "playground";
  const isOrderEnquirySection = selectedSection === "order-enquiry";
  const isRootCauseSection = selectedSection === "root-cause";
  const isHealthDashboardSubsection =
    isDelayedOrdersSection || isAtRiskSection || isFillRateSection;

  return (
    <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950 transition-colors">
      {/* Header */}
      <div className={`border-b ${BRAND_COLOR.border} bg-gradient-to-r ${BRAND_COLOR.bg} dark:bg-slate-900/30 dark:border-slate-700 transition-colors`}>
        <div className="flex items-start justify-between p-4">
          <div className="flex items-start gap-2.5">
            <div className="text-2xl pt-0.5">{config.icon}</div>
            <div>
              <h1 className={`text-base font-semibold ${BRAND_COLOR.light} dark:${BRAND_COLOR.dark}`}>{config.title}</h1>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">{config.description}</p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Show query history"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={handleExportPDF}
              className="p-2 hover:bg-white/50 rounded-lg transition-colors"
              title="Export as PDF"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
            {isLoading && (
              <button
                onClick={handleStop}
                className="px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Stop
              </button>
            )}
            <div className="relative">
              <button
                onClick={() => setShowChatMenu(!showChatMenu)}
                className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                title="Chat options"
              >
                <svg className="w-5 h-5 text-slate-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>

              {/* Chat Menu Dropdown */}
              {showChatMenu && (
                <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-30">
                  <button
                    onClick={handleAddToSpace}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
                  >
                    <span className="text-lg">📁</span>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">Add to Space</p>
                      <p className="text-xs text-slate-500">Organize conversation</p>
                    </div>
                  </button>
                  <button
                    onClick={handleClearHistory}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left text-red-600"
                  >
                    <span className="text-lg">🗑️</span>
                    <div>
                      <p className="font-medium text-sm">Clear History</p>
                      <p className="text-xs opacity-70">Delete all messages</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area, RBAC Panel, or System Config Panel */}
      {isRbacSection ? (
        <RbacPanel />
      ) : isSystemConfigSection ? (
        <SystemConfigPanel />
      ) : isObservabilitySection ? (
        <ObservabilityPanel />
      ) : isHealthDashboardSection ? (
        <HealthDashboardOverview />
      ) : isDelayedOrdersSection ? (
        <DelayedOrdersPanel />
      ) : isAtRiskSection ? (
        <AtRiskOrdersPanel />
      ) : isFillRateSection ? (
        <FillRatePanel />
      ) : isInventoryRcaSection ? (
        <InventoryAlertsPanel />
      ) : isAvailabilitySection ? (
        <AvailabilityCheckPanel />
      ) : isPlaygroundSection ? (
        <PlaygroundPanel />
      ) : isOrderEnquirySection ? (
        <OrderEnquiryPanel />
      ) : isRootCauseSection ? (
        <RootCauseAnalysisPanel />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              // Empty State
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <div className="text-5xl mb-3 opacity-50">{config.icon}</div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Start a Conversation</h2>
                <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm">Ask any question about {config.title.toLowerCase()}. I can help with queries, analysis, and recommendations.</p>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full p-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                    A
                  </div>
                )}

                <div
                  className={`max-w-2xl rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? `${BRAND_COLOR.light} bg-gradient-to-r from-slate-200 to-slate-100 border border-slate-300 dark:from-slate-700 dark:to-slate-600 dark:border-slate-600 dark:text-white`
                      : "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {message.role === "user" ? (
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </div>
                  ) : (
                    <MessageRenderer
                      content={message.content}
                      isStreaming={isLoading && message === messages[messages.length - 1]}
                    />
                  )}
                  <p className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                    U
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
                  A
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}

              <div ref={messagesEndRef} />
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
      )}

      {/* Input Area - Minimal Style (Hide for special panel sections) */}
      {!isRbacSection && !isSystemConfigSection && !isObservabilitySection && !isHealthDashboardSection && !isHealthDashboardSubsection && !isInventoryRcaSection && !isAvailabilitySection && !isPlaygroundSection && !isOrderEnquirySection && !isRootCauseSection && (
        <div className={`border-t ${BRAND_COLOR.border} dark:border-slate-700 bg-white dark:bg-slate-900 p-4 transition-colors`}>
        {/* Input with Controls */}
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${config.title.toLowerCase()}...`}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none resize-none text-sm text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 p-3 transition-colors"
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className={`flex-shrink-0 p-2.5 rounded-lg transition-colors ${
              inputValue.trim() && !isLoading
                ? `${BRAND_COLOR.light} dark:${BRAND_COLOR.dark} hover:opacity-80 dark:hover:opacity-100`
                : "text-slate-400 dark:text-slate-600 opacity-50"
            }`}
            title="Send message (Enter)"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5.951-1.488 5.951 1.488a1 1 0 001.169-1.409l-7-14z" />
            </svg>
          </button>
        </div>

          {/* Hint */}
          <p className="text-xs text-slate-500 dark:text-slate-500 text-center mt-2">⏎ Enter to send • Shift+⏎ New line</p>
        </div>
      )}

      {/* History Sidebar */}
      {showHistory && (
        <div className={`border-l ${BRAND_COLOR.border} dark:border-slate-700 w-64 bg-slate-50 dark:bg-slate-900/30 p-4 space-y-3 max-h-96 overflow-y-auto transition-colors`}>
          <h3 className="font-semibold text-slate-900 text-sm">Recent Queries</h3>
          <div className="space-y-2">
            {messages.filter((m) => m.role === "user").length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-4">No queries yet</p>
            ) : (
              messages
                .filter((m) => m.role === "user")
                .map((msg) => (
                  <button
                    key={msg.id}
                    className="w-full text-left text-xs p-2 rounded hover:bg-white border border-transparent hover:border-slate-300 transition-all text-slate-600 hover:text-slate-900 line-clamp-2"
                  >
                    {msg.content}
                  </button>
                ))
            )}
          </div>
        </div>
      )}

      {/* Spaces Sidebar */}
      {showSpaces && (
        <div className={`border-l ${BRAND_COLOR.border} dark:border-slate-700 w-64 bg-slate-50 dark:bg-slate-900/30 p-4 space-y-3 transition-colors`}>
          <h3 className="font-semibold text-slate-900 text-sm">Add to Space</h3>
          <div className="space-y-2">
            {["General", "Favorites", "Pinned"].map((space) => (
              <button
                key={space}
                onClick={() => {
                  alert(`Conversation added to "${space}" space`);
                  setShowSpaces(false);
                  setShowChatMenu(false);
                }}
                className="w-full flex items-center gap-2 text-left text-sm p-3 rounded-lg hover:bg-white border border-transparent hover:border-slate-300 transition-all"
              >
                <span className="text-lg">📁</span>
                <span className="text-slate-700">{space}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
