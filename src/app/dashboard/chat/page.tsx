"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  CircleStop,
  MessageSquare,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import ChatMessage from "@/components/features/ChatMessage";
import ChatSidebar from "@/components/features/ChatSidebar";
import { PageHeader, Panel, Status, Tag } from "@/components/ui";

const SUGGESTED_PROMPTS = [
  "Summarise the key concepts in my notes",
  "What topics does this material cover?",
  "Explain this in simpler terms",
  "Build me a study guide from my documents",
];

/** Extract plain text from a UIMessage's parts array. */
function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export default function ChatPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const router = useRouter();

  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (newSession) => {
      setActiveSessionId(newSession.id);
      void utils.chat.getSessions.invalidate();
    },
  });

  const { data: existingMessages } = trpc.chat.getSessionMessages.useQuery(
    { sessionId: activeSessionId! },
    { enabled: !!activeSessionId }
  );

  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ sessionId: activeSessionId }),
    }),
    onFinish() {
      void utils.chat.getSessions.invalidate();
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Hydrate the transcript when a persisted session is opened. Keyed on the
  // loaded payload, so it runs when a session's messages arrive rather than on
  // every render.
  const hydratedSessionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeSessionId || !existingMessages) return;
    if (hydratedSessionRef.current === activeSessionId) return;

    hydratedSessionRef.current = activeSessionId;
    setMessages(
      existingMessages.map((msg) => ({
        id: msg.id,
        role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
        parts: [{ type: "text" as const, text: msg.content }],
      }))
    );
  }, [existingMessages, activeSessionId, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChatWithMessage = useCallback(
    async (messageContent: string) => {
      const title =
        messageContent.length > 48
          ? `${messageContent.slice(0, 48)}…`
          : messageContent;

      const newSession = await createSession.mutateAsync({ title });
      hydratedSessionRef.current = newSession.id;
      setActiveSessionId(newSession.id);

      // Let the session id land in state before the transport reads it.
      setTimeout(() => sendMessage({ text: messageContent }), 100);
    },
    [createSession, sendMessage]
  );

  // Accept an initial question passed via ?q=. This is a user action arriving
  // through the URL rather than state synchronisation, so it is deferred out of
  // the effect body — updating state synchronously here would cascade renders.
  const bootstrappedRef = useRef(false);
  useEffect(() => {
    if (bootstrappedRef.current) return;

    const initialQuery = searchParams.get("q");
    if (!initialQuery) return;

    bootstrappedRef.current = true;
    const timer = setTimeout(() => {
      router.replace("/dashboard/chat", undefined);
      void handleNewChatWithMessage(initialQuery);
    }, 0);

    return () => clearTimeout(timer);
  }, [searchParams, handleNewChatWithMessage, router]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    setInputValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (!activeSessionId) {
      await handleNewChatWithMessage(trimmed);
    } else {
      sendMessage({ text: trimmed });
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Chat"
        description="Every question runs a dense and a lexical search over your corpus, fused by rank. Answers cite the passages they came from."
        action={
          <Tag mono>
            <span className="h-1.5 w-1.5 rounded-full bg-ok" />
            hybrid · RRF
          </Tag>
        }
      />

      <Panel className="overflow-hidden p-0">
        <div className="flex h-[min(680px,calc(100vh-260px))]">
          <ChatSidebar
            activeSessionId={activeSessionId}
            onSelectSession={(sessionId) => {
              if (isStreaming) stop();
              setActiveSessionId(sessionId);
            }}
            onNewChat={() => {
              hydratedSessionRef.current = null;
              setActiveSessionId(null);
              setMessages([]);
              setInputValue("");
            }}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            {/* ── Conversation status strip ── */}
            {activeSessionId && (
              <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
                <Status tone={isStreaming ? "busy" : "ok"}>
                  {isStreaming
                    ? status === "submitted"
                      ? "retrieving context"
                      : "generating"
                    : "grounded in your documents"}
                </Status>
                {isStreaming && (
                  <button
                    onClick={() => stop()}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-900"
                  >
                    <CircleStop className="h-3.5 w-3.5" />
                    Stop
                  </button>
                )}
              </div>
            )}

            {/* ── Transcript ── */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {!hasMessages ? (
                <div className="flex h-full items-center justify-center px-6 py-10">
                  <div className="w-full max-w-md">
                    <p className="font-mono text-2xs tracking-[0.12em] text-surface-400 uppercase">
                      Start a conversation
                    </p>
                    <h2 className="mt-2 text-xl text-surface-900">
                      Ask your documents a question
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-surface-500">
                      Answers are built only from passages retrieved out of your
                      own uploads. If the corpus doesn&apos;t contain an answer,
                      Arcus says so rather than inventing one.
                    </p>

                    <div className="mt-6 space-y-1.5">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => void submit(prompt)}
                          disabled={createSession.isPending}
                          className="group flex w-full items-center gap-2.5 rounded-md border border-line px-3 py-2.5 text-left text-sm text-surface-600 transition-colors hover:border-line-strong hover:bg-surface-50 hover:text-surface-900 disabled:opacity-50"
                        >
                          <MessageSquare
                            className="h-3.5 w-3.5 shrink-0 text-surface-400"
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1 truncate">{prompt}</span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-surface-300 opacity-0 transition-opacity group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {messages.map((message, index) => (
                    <ChatMessage
                      key={message.id || index}
                      role={message.role as "user" | "assistant"}
                      content={getMessageText(message)}
                      isStreaming={
                        isStreaming &&
                        index === messages.length - 1 &&
                        message.role === "assistant"
                      }
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {error && (
              <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-red-200 bg-err-soft px-3 py-2">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-err" />
                <p className="text-xs text-surface-700">
                  {error.message || "Something went wrong. Try again."}
                </p>
              </div>
            )}

            {/* ── Composer ── */}
            <div className="shrink-0 border-t border-line p-3">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit(inputValue);
                }}
                className={cn(
                  "flex items-end gap-2 rounded-lg border border-line bg-surface-50 p-2 transition-colors",
                  "focus-within:border-surface-400 focus-within:bg-surface-0"
                )}
              >
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputValue}
                  onChange={(event) => {
                    setInputValue(event.target.value);
                    // Grow with content, capped so the transcript stays visible.
                    const el = event.target;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void submit(inputValue);
                    }
                  }}
                  placeholder={
                    isStreaming
                      ? "Waiting for the response…"
                      : "Ask about your documents…"
                  }
                  disabled={isStreaming}
                  className="max-h-[140px] min-h-[28px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-surface-900 placeholder:text-surface-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming}
                  aria-label="Send message"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-900 text-white transition-colors hover:bg-surface-800 disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </form>
              <p className="mt-1.5 px-1 font-mono text-2xs text-surface-400">
                Enter to send · Shift+Enter for a new line
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
