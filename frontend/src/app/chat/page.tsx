"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import ChatInterface from "@/components/chat/ChatInterface";
import ResourcePanel from "@/components/panels/ResourcePanel";

export default function ChatPage() {
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { createConversation } = useChatStore();

  // Wait for Zustand persist to finish rehydrating from localStorage before
  // deciding whether to create a new conversation. Without this, the initial
  // render always sees activeConversationId=null (pre-hydration) and creates
  // a spurious new thread on every page refresh.
  useEffect(() => {
    const store = useChatStore;
    if (!store.persist) return;

    const ensureActiveConversation = () => {
      const conv = store.getState().activeConversation();
      if (!conv) createConversation();
    };

    if (store.persist.hasHydrated()) {
      ensureActiveConversation();
    } else {
      const unsub = store.persist.onFinishHydration(ensureActiveConversation);
      return unsub;
    }
  }, [createConversation]);

  const abortRef = useRef<(() => void) | null>(null);
  const handleStop = useCallback(() => { abortRef.current?.(); }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((o) => !o)}
      />

      <div className="flex flex-col flex-1 min-w-0 relative">
        <Header
          onToggleResources={() => setResourcesOpen((o) => !o)}
          resourcesOpen={resourcesOpen}
          onStop={handleStop}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((o) => !o)}
        />

        <div className="flex flex-1 min-h-0 relative">
          <div className={`flex flex-col flex-1 min-w-0 transition-all duration-200 ${resourcesOpen ? "mr-80" : ""}`}>
            <ChatInterface />
          </div>

          <ResourcePanel
            open={resourcesOpen}
            onClose={() => setResourcesOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
