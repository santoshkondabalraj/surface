import { useState, useCallback } from "react";
import { streamChat } from "@/lib/chat-streaming";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface UseStreamingChatOptions {
  onError?: (error: string) => void;
}

export function useStreamingChat(options?: UseStreamingChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!userContent.trim()) return;

      setMessages((prevMessages) => {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          role: "user",
          content: userContent,
          timestamp: new Date(),
        };

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "",
          timestamp: new Date(),
        };

        return [...prevMessages, userMessage, assistantMessage];
      });

      setIsLoading(true);

      try {
        // Get the current messages for context
        setMessages((prevMessages) => {
          const messagesToSend = prevMessages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

          streamChat(messagesToSend, {
            onText: (delta: string) => {
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === "assistant") {
                  lastMsg.content += delta;
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
              if (options?.onError) options.onError(error);
            },
          }).catch((err) => {
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
            if (options?.onError) options.onError(message);
          });

          return prevMessages;
        });
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
        if (options?.onError) options.onError(message);
      }
    },
    [options]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const stop = useCallback(() => {
    setIsLoading(false);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
    stop,
  };
}
