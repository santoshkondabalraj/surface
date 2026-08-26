"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { createParser } from "eventsource-parser";
import { useChatStore } from "@/store/chat-store";
import type { StreamEvent, Message, ToolCall, FileAttachment } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

function buildContentWithAttachments(text: string, atts: FileAttachment[]): string {
  if (atts.length === 0) return text;
  const tables = atts
    .map((a) => `**Attached file: ${a.name}** (${a.rowCount} rows)\n\n${a.preview}`)
    .join("\n\n---\n\n");
  return `${tables}\n\n---\n\n${text}`;
}

export default function ChatInterface() {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [mounted, setMounted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const {
    activeConversation,
    addMessage,
    appendMessageText,
    updateMessage,
    updateToolCall,
    updateConversationTitle,
    setStreaming,
    isStreaming,
  } = useChatStore();

  const conv = activeConversation();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
    if (conv) {
      const lastMsg = conv.messages[conv.messages.length - 1];
      if (lastMsg?.role === "assistant") {
        updateMessage(conv.id, lastMsg.id, { isStreaming: false });
      }
    }
  }, [conv, setStreaming, updateMessage]);

  const handleSubmit = useCallback(async () => {
    if ((!input.trim() && attachments.length === 0) || isStreaming || !conv) return;

    const userInput = input.trim();
    const currentAttachments = attachments;
    setInput("");
    setAttachments([]);

    const content = buildContentWithAttachments(userInput, currentAttachments);

    // Set title from the first user message, before the API call so it's
    // immediate and doesn't depend on async closure state at message_stop time.
    if (conv.messages.length === 0 && userInput) {
      const title = userInput.slice(0, 50) + (userInput.length > 50 ? "…" : "");
      updateConversationTitle(conv.id, title);
    }

    // Create user message
    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      role: "user",
      content,
      toolCalls: [],
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
    };
    addMessage(conv.id, userMsg);

    // Create assistant placeholder
    const assistantMsgId = Math.random().toString(36).slice(2);
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      toolCalls: [],
      timestamp: Date.now(),
      isStreaming: true,
    };
    addMessage(conv.id, assistantMsg);
    setStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    // Build message history for API
    const history = conv.messages
      .filter((m) => m.id !== assistantMsgId)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: "user", content });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const convId = conv.id;

      const parser = createParser({
        onEvent(event) {
          if (!event.data) return;
          let data: StreamEvent;
          try {
            data = JSON.parse(event.data) as StreamEvent;
          } catch {
            return;
          }

          switch (data.type) {
            case "text_delta":
              appendMessageText(convId, assistantMsgId, data.delta);
              break;

            case "tool_start": {
              const newToolCall: ToolCall = {
                id: data.toolCallId,
                toolName: data.toolName,
                input: data.input,
                status: "pending",
              };
              useChatStore.getState().updateMessage(convId, assistantMsgId, {
                toolCalls: [
                  ...(useChatStore
                    .getState()
                    .conversations.find((c) => c.id === convId)
                    ?.messages.find((m) => m.id === assistantMsgId)
                    ?.toolCalls ?? []),
                  newToolCall,
                ],
              });
              break;
            }

            case "tool_input":
              updateToolCall(convId, assistantMsgId, data.toolCallId, {
                input: data.input,
                status: "running",
              });
              break;

            case "tool_end":
              updateToolCall(convId, assistantMsgId, data.toolCallId, {
                output: data.output,
                status: "completed",
              });
              break;

            case "tool_error":
              updateToolCall(convId, assistantMsgId, data.toolCallId, {
                error: data.error,
                status: "failed",
              });
              break;

            case "message_stop":
              updateMessage(convId, assistantMsgId, { isStreaming: false });
              setStreaming(false);
              break;

            case "error":
              updateMessage(convId, assistantMsgId, {
                content: `Error: ${data.message}`,
                isStreaming: false,
              });
              setStreaming(false);
              break;
          }
        },
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      updateMessage(conv.id, assistantMsgId, {
        content: `Error: ${(err as Error).message}`,
        isStreaming: false,
      });
      setStreaming(false);
    } finally {
      abortRef.current = null;
    }
  }, [
    input,
    attachments,
    isStreaming,
    conv,
    addMessage,
    appendMessageText,
    updateMessage,
    updateToolCall,
    updateConversationTitle,
    setStreaming,
  ]);

  if (!mounted || !conv) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
        Select or create a conversation to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={conv.messages}
        onSuggestion={setInput}
      />
      <MessageInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        onStop={handleStop}
        isStreaming={isStreaming}
        disabled={isStreaming}
        attachments={attachments}
        onAttach={(files) => setAttachments((prev) => [...prev, ...files])}
        onRemoveAttachment={(i) => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
      />
    </div>
  );
}

