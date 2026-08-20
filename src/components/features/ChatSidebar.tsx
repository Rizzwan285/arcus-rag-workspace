"use client";

import { useState } from "react";
import { Check, Ellipsis, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { Skeleton } from "@/components/ui";

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

  const { data: sessions, isLoading } = trpc.chat.getSessions.useQuery(undefined, {
    refetchInterval: 10_000,
  });

  const updateTitle = trpc.chat.updateSessionTitle.useMutation({
    onSuccess: () => {
      void utils.chat.getSessions.invalidate();
      setEditingId(null);
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => void utils.chat.getSessions.invalidate(),
  });

  const startEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditTitle(session.title);
    setMenuOpenId(null);
  };

  const saveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      updateTitle.mutate({ sessionId, title: editTitle.trim() });
    }
    setEditingId(null);
  };

  const remove = (sessionId: string) => {
    deleteSession.mutate({ sessionId });
    setMenuOpenId(null);
    if (activeSessionId === sessionId) onNewChat();
  };

  return (
    <div className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface-50">
      <div className="p-2.5">
        <button
          onClick={onNewChat}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface-0 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-100 hover:text-surface-900"
        >
          <Plus className="h-3.5 w-3.5" />
          New chat
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-2.5">
        {isLoading ? (
          <div className="space-y-1.5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-0.5">
            {sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!isEditing) onSelectSession(session.id);
                  }}
                  onKeyDown={(event) => {
                    if (!isEditing && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onSelectSession(session.id);
                    }
                  }}
                  className={cn(
                    "group relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                    isActive
                      ? "bg-surface-200/70 text-surface-900"
                      : "text-surface-600 hover:bg-surface-100"
                  )}
                >
                  {isActive && (
                    <span className="absolute top-1/2 left-0 h-4 w-[2px] -translate-y-1/2 rounded-r bg-arcus-600" />
                  )}

                  <MessageSquare
                    className={cn(
                      "h-3.5 w-3.5 shrink-0",
                      isActive ? "text-surface-600" : "text-surface-400"
                    )}
                    strokeWidth={1.75}
                  />

                  {isEditing ? (
                    <div className="flex flex-1 items-center gap-1">
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") saveEdit(session.id);
                          if (event.key === "Escape") setEditingId(null);
                        }}
                        onClick={(event) => event.stopPropagation()}
                        autoFocus
                        className="min-w-0 flex-1 rounded border border-line-strong bg-surface-0 px-1.5 py-0.5 text-xs text-surface-900 focus:border-arcus-500 focus:outline-none"
                      />
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          saveEdit(session.id);
                        }}
                        className="rounded p-0.5 text-ok hover:bg-ok-soft"
                        aria-label="Save title"
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingId(null);
                        }}
                        className="rounded p-0.5 text-surface-400 hover:bg-surface-200"
                        aria-label="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {session.title}
                        </p>
                        <p className="font-mono text-2xs text-surface-400">
                          {session._count.messages} msg ·{" "}
                          {relativeTime(session.updatedAt)}
                        </p>
                      </div>

                      <div className="relative shrink-0">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpenId(menuOpenId === session.id ? null : session.id);
                          }}
                          aria-label={`Actions for ${session.title}`}
                          className={cn(
                            "rounded p-1 text-surface-400 transition-opacity hover:bg-surface-200 hover:text-surface-700",
                            menuOpenId === session.id
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                          )}
                        >
                          <Ellipsis className="h-3.5 w-3.5" />
                        </button>

                        {menuOpenId === session.id && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={(event) => {
                                event.stopPropagation();
                                setMenuOpenId(null);
                              }}
                            />
                            <div className="absolute right-0 z-50 mt-1 w-32 overflow-hidden rounded-md border border-line bg-surface-0 shadow-lg">
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  startEdit(session);
                                }}
                                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-surface-600 hover:bg-surface-50"
                              >
                                <Pencil className="h-3 w-3" />
                                Rename
                              </button>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  remove(session.id);
                                }}
                                className="flex w-full items-center gap-2 border-t border-line px-2.5 py-1.5 text-xs text-err hover:bg-err-soft"
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
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center">
            <MessageSquare
              className="mb-2 h-5 w-5 text-surface-300"
              strokeWidth={1.5}
            />
            <p className="text-xs font-medium text-surface-500">
              No conversations
            </p>
            <p className="mt-0.5 text-xs text-surface-400">
              Ask something to start one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
