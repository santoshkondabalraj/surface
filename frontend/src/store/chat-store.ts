"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Conversation, Message, Space, ToolCall } from "@/lib/types";

interface ChatStore {
  conversations: Conversation[];
  activeConversationId: string | null;
  isStreaming: boolean;
  spaces: Space[];

  // Conversation actions
  createConversation: () => string;
  setActiveConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  addMessage: (convId: string, message: Message) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<Message>) => void;
  updateToolCall: (convId: string, msgId: string, toolCallId: string, patch: Partial<ToolCall>) => void;
  appendMessageText: (convId: string, msgId: string, delta: string) => void;
  setStreaming: (val: boolean) => void;
  updateConversationTitle: (convId: string, title: string) => void;
  moveConversationToSpace: (convId: string, spaceId: string | null) => void;
  activeConversation: () => Conversation | null;

  // Space actions
  createSpace: (name: string, icon: string) => string;
  deleteSpace: (spaceId: string) => void;
  updateSpace: (spaceId: string, patch: Partial<Pick<Space, "name" | "icon">>) => void;

  // Maintenance actions
  clearAllHistory: () => void;
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      isStreaming: false,
      spaces: [],

      createConversation: () => {
        const id = makeId();
        const now = Date.now();
        const conv: Conversation = {
          id,
          title: "New thread",
          messages: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ conversations: [conv, ...s.conversations], activeConversationId: id }));
        return id;
      },

      setActiveConversation: (id) => set({ activeConversationId: id }),

      deleteConversation: (id) =>
        set((s) => {
          const remaining = s.conversations.filter((c) => c.id !== id);
          const nextActive =
            s.activeConversationId === id
              ? (remaining[0]?.id ?? null)
              : s.activeConversationId;
          return { conversations: remaining, activeConversationId: nextActive };
        }),

      addMessage: (convId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== convId
              ? c
              : { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
          ),
        })),

      updateMessage: (convId, msgId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== convId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id !== msgId ? m : { ...m, ...patch }
                  ),
                }
          ),
        })),

      appendMessageText: (convId, msgId, delta) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id !== msgId ? m : { ...m, content: m.content + delta }
              ),
            };
          }),
        })),

      updateToolCall: (convId, msgId, toolCallId, patch) =>
        set((s) => ({
          conversations: s.conversations.map((c) => {
            if (c.id !== convId) return c;
            return {
              ...c,
              messages: c.messages.map((m) => {
                if (m.id !== msgId) return m;
                return {
                  ...m,
                  toolCalls: m.toolCalls.map((tc) =>
                    tc.id !== toolCallId ? tc : { ...tc, ...patch }
                  ),
                };
              }),
            };
          }),
        })),

      setStreaming: (val) => set({ isStreaming: val }),

      updateConversationTitle: (convId, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== convId ? c : { ...c, title }
          ),
        })),

      moveConversationToSpace: (convId, spaceId) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id !== convId ? c : { ...c, spaceId: spaceId ?? undefined }
          ),
        })),

      activeConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId) ?? null;
      },

      createSpace: (name, icon) => {
        const id = makeId();
        const space: Space = { id, name, icon, createdAt: Date.now() };
        set((s) => ({ spaces: [...s.spaces, space] }));
        return id;
      },

      deleteSpace: (spaceId) =>
        set((s) => ({
          spaces: s.spaces.filter((sp) => sp.id !== spaceId),
          conversations: s.conversations.map((c) =>
            c.spaceId === spaceId ? { ...c, spaceId: undefined } : c
          ),
        })),

      updateSpace: (spaceId, patch) =>
        set((s) => ({
          spaces: s.spaces.map((sp) =>
            sp.id !== spaceId ? sp : { ...sp, ...patch }
          ),
        })),

      // Clear all conversations and reset store
      clearAllHistory: () =>
        set(() => ({
          conversations: [],
          activeConversationId: null,
          spaces: [],
        })),
    }),
    {
      name: "orbiter-chat-v1",
      storage: createJSONStorage(() => ({
        getItem: (name) => localStorage.getItem(name),
        removeItem: (name) => localStorage.removeItem(name),
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, value);
          } catch (e) {
            if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
              try {
                const parsed = JSON.parse(value) as { state?: { conversations?: Conversation[] } };
                const convs = parsed?.state?.conversations;
                if (convs && convs.length > 1) {
                  const keep = Math.max(1, Math.floor(convs.length * 0.75));
                  parsed.state!.conversations = [...convs]
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .slice(0, keep);
                  localStorage.setItem(name, JSON.stringify(parsed));
                }
              } catch {
                localStorage.removeItem(name);
              }
            } else {
              throw e;
            }
          }
        },
      })),
      // Only persist data — never streaming runtime state
      partialize: (s) => ({
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
        spaces: s.spaces,
      }),
    }
  )
);

// After rehydration, clear any messages stuck in streaming state
// (can happen if the app was closed mid-stream).
// Guard is required — on the server localStorage is unavailable so persist
// exits early without adding .persist to the store, making it undefined.
if (typeof window !== "undefined") {
  useChatStore.persist.onFinishHydration(() => {
    useChatStore.setState((s) => ({
      isStreaming: false,
      conversations: s.conversations.map((c) => ({
        ...c,
        messages: c.messages.map((m) => ({
          ...m,
          isStreaming: false,
          toolCalls: m.toolCalls.map((tc) =>
            tc.status === "pending" || tc.status === "running"
              ? { ...tc, status: "failed" as const, error: "Interrupted — session ended before this tool completed." }
              : tc
          ),
        })),
      })),
    }));
  });
}
