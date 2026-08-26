"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/store/chat-store";
import type { Conversation, Space } from "@/lib/types";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ collapsed, onToggleCollapse }: Props) {
  const {
    conversations, activeConversationId, spaces,
    createConversation, setActiveConversation, deleteConversation,
    createSpace, deleteSpace, updateSpace, moveConversationToSpace,
    clearAllHistory,
  } = useChatStore();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceIcon, setNewSpaceIcon] = useState("📁");
  const [collapsedSpaces, setCollapsedSpaces] = useState<Set<string>>(new Set());
  const [movingConvId, setMovingConvId] = useState<string | null>(null);
  const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const newSpaceInputRef = useRef<HTMLInputElement>(null);
  const movePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (creatingSpace) newSpaceInputRef.current?.focus();
  }, [creatingSpace]);

  // Close move picker on outside click
  useEffect(() => {
    if (!movingConvId) return;
    function handleClick(e: MouseEvent) {
      if (movePickerRef.current && !movePickerRef.current.contains(e.target as Node)) {
        setMovingConvId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [movingConvId]);

  function handleCreateSpace(e: React.FormEvent) {
    e.preventDefault();
    if (!newSpaceName.trim()) return;
    createSpace(newSpaceName.trim(), newSpaceIcon || "📁");
    setNewSpaceName("");
    setNewSpaceIcon("📁");
    setCreatingSpace(false);
  }

  function handleStartEditSpace(space: Space) {
    setEditingSpaceId(space.id);
    setEditName(space.name);
    setEditIcon(space.icon);
  }

  function handleSaveEditSpace(e: React.FormEvent) {
    e.preventDefault();
    if (editingSpaceId && editName.trim()) {
      updateSpace(editingSpaceId, { name: editName.trim(), icon: editIcon || "📁" });
    }
    setEditingSpaceId(null);
  }

  function toggleSpaceCollapse(spaceId: string) {
    setCollapsedSpaces((prev) => {
      const next = new Set(prev);
      if (next.has(spaceId)) next.delete(spaceId);
      else next.add(spaceId);
      return next;
    });
  }

  const spacedConvIds = new Set(conversations.filter((c) => c.spaceId).map((c) => c.id));
  const generalConvs = conversations.filter((c) => !c.spaceId);

  // ── COLLAPSED ICON RAIL ──────────────────────────────────────────────────
  if (collapsed) {
    return (
      <aside className="w-12 flex-shrink-0 flex flex-col h-full bg-[var(--color-surface-raised)] border-r border-[var(--color-surface-border)]">
        {/* Logo / expand */}
        <button
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="flex items-center justify-center h-11 hover:bg-[var(--color-surface-overlay)] transition-colors flex-shrink-0"
        >
          <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
              <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z" />
            </svg>
          </div>
        </button>

        {/* New thread */}
        <button
          onClick={() => createConversation()}
          title="New thread"
          className="flex items-center justify-center py-2.5 hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>

        {spaces.length > 0 && (
          <div className="border-t border-[var(--color-surface-border)] my-1" />
        )}

        {/* Space icons */}
        {spaces.map((space) => (
          <button
            key={space.id}
            onClick={() => { onToggleCollapse(); }}
            title={space.name}
            className="flex items-center justify-center py-2 text-base hover:bg-[var(--color-surface-overlay)] transition-colors"
          >
            {space.icon}
          </button>
        ))}

        {conversations.length > 0 && (
          <div className="border-t border-[var(--color-surface-border)] my-1" />
        )}

        {/* Conversation persona icons */}
        <div className="flex-1 overflow-hidden">
          {conversations.slice(0, 10).map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              title={conv.title}
              className={`w-full flex items-center justify-center py-1.5 text-sm transition-colors ${
                conv.id === activeConversationId
                  ? "bg-[var(--color-surface-overlay)]"
                  : "hover:bg-[var(--color-surface-overlay)]"
              }`}
            >
              💬
            </button>
          ))}
        </div>
      </aside>
    );
  }

  // ── EXPANDED SIDEBAR ─────────────────────────────────────────────────────
  return (
    <aside className="w-60 flex-shrink-0 flex flex-col h-full bg-[var(--color-surface-raised)] border-r border-[var(--color-surface-border)]">
      {/* Brand + collapse */}
      <div className="flex items-center justify-between px-3 h-11 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white">
              <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7 5 5 7 5 9.5S7 14 9.5 14 14 12 14 9.5 12 5 9.5 5Z" />
            </svg>
          </div>
          <span className="text-[15px] font-bold text-[var(--color-text-primary)] tracking-tight">Orbiter</span>
        </div>
        <button
          onClick={onToggleCollapse}
          title="Collapse sidebar"
          className="p-1 rounded-md hover:bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current">
            <path fillRule="evenodd" d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            <path fillRule="evenodd" d="M3 5a1 1 0 011-1 1 1 0 110 2 1 1 0 01-1-1zm0 5a1 1 0 011-1 1 1 0 110 2 1 1 0 01-1-1zm0 5a1 1 0 011-1 1 1 0 110 2 1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* New Thread */}
      <div className="px-2 mb-1">
        <button
          onClick={() => createConversation()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current flex-shrink-0 opacity-60">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
          New thread
        </button>
      </div>

      {/* Scrollable content — gated on mount so server HTML matches client
          initial render (localStorage data isn't available during SSR) */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">{mounted && <>

        {/* ── SPACES ── */}
        {(spaces.length > 0 || creatingSpace) && (
          <div className="mb-3">
            <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold px-2 py-1.5">
              Spaces
            </p>
            {spaces.map((space) => {
              const spaceConvs = conversations.filter((c) => c.spaceId === space.id);
              const isCollapsed = collapsedSpaces.has(space.id);
              const isEditing = editingSpaceId === space.id;

              return (
                <div key={space.id} className="mb-1">
                  {/* Space header */}
                  {isEditing ? (
                    <form onSubmit={handleSaveEditSpace} className="flex items-center gap-1 px-1 py-0.5">
                      <input
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="w-7 text-center text-sm bg-white border border-[var(--color-surface-border)] rounded px-0.5 py-0.5 focus:outline-none focus:border-[var(--color-accent)]"
                        maxLength={2}
                      />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        className="flex-1 text-[12px] bg-white border border-[var(--color-surface-border)] rounded px-2 py-0.5 focus:outline-none focus:border-[var(--color-accent)]"
                        onKeyDown={(e) => e.key === "Escape" && setEditingSpaceId(null)}
                      />
                      <button type="submit" className="text-[var(--color-success)] hover:opacity-70 p-0.5">
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => setEditingSpaceId(null)} className="text-[var(--color-text-muted)] hover:opacity-70 p-0.5">
                        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </form>
                  ) : (
                    <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-[var(--color-surface-overlay)] cursor-pointer transition-colors"
                      onClick={() => toggleSpaceCollapse(space.id)}>
                      <svg viewBox="0 0 20 20" className={`w-3 h-3 fill-current text-[var(--color-text-muted)] flex-shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm">{space.icon}</span>
                      <span className="flex-1 text-[14px] font-semibold text-[var(--color-text-primary)] truncate">{space.name}</span>
                      <span className="text-[11px] text-[var(--color-text-muted)] mr-1">{spaceConvs.length}</span>
                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleStartEditSpace(space)} className="p-0.5 rounded hover:bg-[var(--color-surface-border)] text-[var(--color-text-muted)]" title="Rename">
                          <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                        </button>
                        <button onClick={() => deleteSpace(space.id)} className="p-0.5 rounded hover:text-[var(--color-error)] text-[var(--color-text-muted)]" title="Delete space">
                          <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Space conversations */}
                  {!isCollapsed && spaceConvs.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conv={conv}
                      isActive={conv.id === activeConversationId}
                      onSelect={() => setActiveConversation(conv.id)}
                      onDelete={() => deleteConversation(conv.id)}
                      onMoveOpen={() => setMovingConvId(movingConvId === conv.id ? null : conv.id)}
                      movingOpen={movingConvId === conv.id}
                      movePickerRef={movePickerRef}
                      spaces={spaces}
                      currentSpaceId={conv.spaceId}
                      onMoveTo={(sid) => { moveConversationToSpace(conv.id, sid); setMovingConvId(null); }}
                      indent
                    />
                  ))}

                  {!isCollapsed && spaceConvs.length === 0 && (
                    <p className="text-[11px] text-[var(--color-text-muted)] px-8 py-1 italic">No threads yet</p>
                  )}
                </div>
              );
            })}

            {/* New space form */}
            {creatingSpace ? (
              <form onSubmit={handleCreateSpace} className="flex items-center gap-1 px-1 mt-0.5">
                <input
                  value={newSpaceIcon}
                  onChange={(e) => setNewSpaceIcon(e.target.value)}
                  className="w-7 text-center text-sm bg-white border border-[var(--color-surface-border)] rounded px-0.5 py-0.5 focus:outline-none focus:border-[var(--color-accent)]"
                  placeholder="📁"
                  maxLength={2}
                />
                <input
                  ref={newSpaceInputRef}
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="Space name"
                  className="flex-1 text-[12px] bg-white border border-[var(--color-surface-border)] rounded px-2 py-0.5 focus:outline-none focus:border-[var(--color-accent)]"
                  onKeyDown={(e) => e.key === "Escape" && setCreatingSpace(false)}
                />
                <button type="submit" disabled={!newSpaceName.trim()} className="text-[var(--color-success)] disabled:opacity-30 p-0.5">
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button type="button" onClick={() => setCreatingSpace(false)} className="text-[var(--color-text-muted)] p-0.5">
                  <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </form>
            ) : (
              <button
                onClick={() => setCreatingSpace(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors"
              >
                <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                New space
              </button>
            )}
          </div>
        )}

        {/* Add first space if none exist yet */}
        {spaces.length === 0 && !creatingSpace && (
          <button
            onClick={() => setCreatingSpace(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] transition-colors mb-2"
          >
            <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New space
          </button>
        )}

        {/* ── GENERAL (unspaced) THREADS ── */}
        {generalConvs.length > 0 && (
          <div>
            {spaces.length > 0 && (
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)] font-bold px-2 py-1.5">
                General
              </p>
            )}
            {generalConvs.map((conv) => (
              <ConversationItem
                key={conv.id}
                conv={conv}
                isActive={conv.id === activeConversationId}
                onSelect={() => setActiveConversation(conv.id)}
                onDelete={() => deleteConversation(conv.id)}
                onMoveOpen={() => setMovingConvId(movingConvId === conv.id ? null : conv.id)}
                movingOpen={movingConvId === conv.id}
                movePickerRef={movePickerRef}
                spaces={spaces}
                currentSpaceId={undefined}
                onMoveTo={(sid) => { moveConversationToSpace(conv.id, sid); setMovingConvId(null); }}
              />
            ))}
          </div>
        )}

        {conversations.length === 0 && (
          <p className="text-[12px] text-[var(--color-text-muted)] text-center py-8 px-4">No threads yet</p>
        )}
      </>}</div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--color-surface-border)]">
        <p className="text-[11px] text-[var(--color-text-muted)] mb-2">Orbiter · Local</p>
        {conversations.length > 0 && (
          <button
            onClick={() => {
              if (confirm("Clear all conversation history? This cannot be undone.")) {
                clearAllHistory();
              }
            }}
            className="w-full text-[11px] px-2 py-1.5 rounded text-[var(--color-error)] hover:bg-[var(--color-surface-overlay)] transition-colors"
          >
            Clear history
          </button>
        )}
      </div>
    </aside>
  );
}

// ── Conversation Item ────────────────────────────────────────────────────────

interface ConvItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onMoveOpen: () => void;
  movingOpen: boolean;
  movePickerRef: React.RefObject<HTMLDivElement | null>;
  spaces: Space[];
  currentSpaceId: string | undefined;
  onMoveTo: (spaceId: string | null) => void;
  indent?: boolean;
}

function ConversationItem({
  conv, isActive, onSelect, onDelete, onMoveOpen, movingOpen,
  movePickerRef, spaces, currentSpaceId, onMoveTo, indent,
}: ConvItemProps) {
  return (
    <div className={`group relative flex items-center gap-2 rounded-lg px-2 py-[7px] cursor-pointer transition-colors mb-0.5 ${indent ? "ml-4" : ""} ${
      isActive
        ? "bg-[var(--color-surface-overlay)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-primary)]"
    }`}
      onClick={onSelect}
    >
      <svg viewBox="0 0 20 20" className="w-3.5 h-3.5 fill-current text-[var(--color-text-muted)] flex-shrink-0">
        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
      </svg>

      <span className="flex-1 text-[14px] font-semibold truncate">{conv.title}</span>

      {/* Action buttons */}
      <div
        className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Move to space */}
        {spaces.length > 0 && (
          <div className="relative">
            <button
              onClick={onMoveOpen}
              className="p-0.5 rounded hover:bg-[var(--color-surface-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              title="Move to space"
            >
              <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
            </button>

            {movingOpen && (
              <div
                ref={movePickerRef}
                className="absolute right-0 top-full mt-1 z-50 min-w-[210px] bg-white border border-[var(--color-surface-border)] rounded-xl shadow-lg overflow-hidden"
              >
                <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] font-semibold px-3 pt-2 pb-1">Move to space</p>
                {spaces.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => onMoveTo(sp.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-[var(--color-surface-raised)] transition-colors text-left ${
                      currentSpaceId === sp.id ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                    }`}
                  >
                    <span>{sp.icon}</span>
                    <span className="flex-1 truncate">{sp.name}</span>
                    {currentSpaceId === sp.id && (
                      <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current text-[var(--color-accent)]">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
                {currentSpaceId && (
                  <>
                    <div className="border-t border-[var(--color-surface-border)] my-1" />
                    <button
                      onClick={() => onMoveTo(null)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-raised)] transition-colors text-left"
                    >
                      Remove from space
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Delete */}
        <button
          onClick={onDelete}
          className="p-0.5 rounded hover:text-[var(--color-error)] text-[var(--color-text-muted)]"
          title="Delete thread"
        >
          <svg viewBox="0 0 20 20" className="w-3 h-3 fill-current">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
}
