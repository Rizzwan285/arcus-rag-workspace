"use client";

import { useState } from "react";
import {
  Plus,
  MessageSquare,
  Trash2,
  MoreHorizontal,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";

interface ChatSession {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { messages: number };
}

interface ChatSidebarProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
}

export default function ChatSidebar({
  activeSessionId,
  onSelectSession,
  onNewChat,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const { data: sessions, isLoading } = trpc.chat.getSessions.useQuery(
    undefined,
    { refetchInterval: 10000 } // Auto-refresh every 10s
  );

  const updateTitle = trpc.chat.updateSessionTitle.useMutation({
    onSuccess: () => {
      utils.chat.getSessions.invalidate();
      setEditingId(null);
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => {
      utils.chat.getSessions.invalidate();
    },
  });

  const handleStartEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      updateTitle.mutate({ sessionId, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const handleDelete = (sessionId: string) => {
    deleteSession.mutate({ sessionId });
    setMenuOpenId(null);
    if (activeSessionId === sessionId) {
      onNewChat();
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex h-full w-72 flex-col border-r border-surface-200">
      {/* New Chat Button */}
      <div className="border-b border-surface-200 p-4">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-lg hover:shadow-arcus-600/30 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-surface-100"
              />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  "group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-all",
                  activeSessionId === session.id
                    ? "bg-arcus-50 text-arcus-700"
                    : "text-surface-600 hover:bg-surface-100"
                )}
                onClick={() => {
                  if (editingId !== session.id) {
                    onSelectSession(session.id);
                  }
                }}
              >
                <MessageSquare
                  className={cn(
                    "h-4 w-4 flex-shrink-0",
                    activeSessionId === session.id
                      ? "text-arcus-500"
                      : "text-surface-400"
                  )}
                />

                {editingId === session.id ? (
                  <div className="flex flex-1 items-center gap-1">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(session.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 rounded-md border border-arcus-300 bg-white px-2 py-0.5 text-xs text-surface-900 focus:outline-none focus:ring-1 focus:ring-arcus-500"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSaveEdit(session.id);
                      }}
                      className="rounded p-0.5 text-emerald-500 hover:bg-emerald-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(null);
                      }}
                      className="rounded p-0.5 text-red-400 hover:bg-red-50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-surface-400">
                        {session._count.messages} messages •{" "}
                        {formatRelativeTime(session.updatedAt)}
                      </p>
                    </div>

                    {/* Actions menu */}
                    <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(
                            menuOpenId === session.id ? null : session.id
                          );
                        }}
                        className="rounded-lg p-1 text-surface-400 hover:bg-surface-200 hover:text-surface-600"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>

                      {menuOpenId === session.id && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(null);
                            }}
                          />
                          <div className="absolute right-0 z-50 mt-1 w-36 overflow-hidden rounded-xl border border-surface-200 bg-white shadow-xl">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(session);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-surface-600 hover:bg-surface-50"
                            >
                              <Pencil className="h-3 w-3" />
                              Rename
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(session.id);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <MessageSquare className="mb-3 h-8 w-8 text-surface-300" />
            <p className="text-sm font-medium text-surface-500">
              No conversations yet
            </p>
            <p className="mt-1 text-xs text-surface-400">
              Start a new chat to ask about your docs
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
