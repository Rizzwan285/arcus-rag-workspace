"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Sparkles,
  Send,
  MessageSquare,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import ChatMessage from "@/components/features/ChatMessage";
import ChatSidebar from "@/components/features/ChatSidebar";

const SUGGESTED_PROMPTS = [
  "Summarize the key concepts in my notes",
  "What are the main topics covered?",
  "Explain this concept in simpler terms",
  "Create a study guide from my documents",
];

/**
 * Extract plain text content from a UIMessage's parts array.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Create session mutation
  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (newSession) => {
      setActiveSessionId(newSession.id);
      utils.chat.getSessions.invalidate();
    },
  });

  // Fetch existing messages when a session is selected
  const { data: existingMessages } =
    trpc.chat.getSessionMessages.useQuery(
      { sessionId: activeSessionId! },
      { enabled: !!activeSessionId }
    );

  // Vercel AI SDK v6 useChat hook
  const {
    messages,
    sendMessage,
    status,
    error,
    setMessages,
    stop,
  } = useChat({
    // Transport config — sends to /api/chat with sessionId in body
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        sessionId: activeSessionId,
      }),
    }),
    onFinish() {
      // Refresh sidebar to show updated message count
      utils.chat.getSessions.invalidate();
    },
    onError(err) {
      console.error("Chat error:", err);
    },
  });

  const isStreaming = status === "streaming" || status === "submitted";

  // Load existing messages when switching sessions
  useEffect(() => {
    if (existingMessages && existingMessages.length > 0) {
      const formatted: UIMessage[] = existingMessages.map((msg) => ({
        id: msg.id,
        role: msg.role === "USER" ? ("user" as const) : ("assistant" as const),
        parts: [{ type: "text" as const, text: msg.content }],
      }));
      setMessages(formatted);
    } else if (activeSessionId && existingMessages?.length === 0) {
      setMessages([]);
    }
  }, [existingMessages, activeSessionId, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle creating a new chat and sending the first message
  const handleNewChatWithMessage = useCallback(
    async (messageContent: string) => {
      // Generate a short title from the message
      const title =
        messageContent.length > 40
          ? messageContent.substring(0, 40) + "..."
          : messageContent;

      const newSession = await createSession.mutateAsync({ title });
      setActiveSessionId(newSession.id);

      // Send message after session is created
      // Small delay to allow state update to propagate
      setTimeout(() => {
        sendMessage({ text: messageContent });
      }, 100);
    },
    [createSession, sendMessage]
  );

  // Auto-send initial query from URL if present
  useEffect(() => {
    const initialQuery = searchParams.get("q");
    if (initialQuery && !activeSessionId && messages.length === 0) {
      // Clear the query from the URL to prevent re-triggering
      router.replace("/dashboard/chat", undefined);
      handleNewChatWithMessage(initialQuery);
    }
  }, [searchParams, activeSessionId, messages.length, handleNewChatWithMessage, router]);

  // Handle form submission
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    const text = inputValue.trim();
    setInputValue("");

    if (!activeSessionId) {
      await handleNewChatWithMessage(text);
    } else {
      sendMessage({ text });
    }
  };

  // Handle clicking a suggested prompt
  const handleSuggestedPrompt = async (prompt: string) => {
    if (isStreaming) return;

    if (!activeSessionId) {
      await handleNewChatWithMessage(prompt);
    } else {
      sendMessage({ text: prompt });
    }
  };

  // Start a new chat (clear state)
  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setInputValue("");
  };

  // Select an existing session
  const handleSelectSession = (sessionId: string) => {
    if (isStreaming) {
      stop();
    }
    setActiveSessionId(sessionId);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-surface-900">
          AI Chat
        </h1>
        <p className="mt-1 text-surface-500">
          Ask questions about your uploaded documents
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
        <div className="flex h-[650px]">
          {/* ── Sidebar ── */}
          <ChatSidebar
            activeSessionId={activeSessionId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
          />

          {/* ── Main Chat Area ── */}
          <div className="flex flex-1 flex-col">
            {/* Chat header */}
            {activeSessionId && (
              <div className="flex items-center gap-3 border-b border-surface-200 px-6 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500">
                  <Sparkles className="h-3.5 w-3.5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">
                    Arcus AI
                  </p>
                  <p className="text-[10px] text-surface-400">
                    {isStreaming
                      ? status === "submitted"
                        ? "Searching documents..."
                        : "Generating response..."
                      : "RAG-powered responses"}
                  </p>
                </div>
                {isStreaming && (
                  <div className="ml-auto flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-arcus-500" />
                    <button
                      onClick={() => stop()}
                      className="rounded-lg px-2 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto">
              {!hasMessages ? (
                /* Empty State */
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-arcus-50 to-purple-50">
                      <Sparkles className="h-10 w-10 text-arcus-500" />
                    </div>
                    <h2 className="mb-2 text-xl font-bold text-surface-900">
                      Chat with Your Documents
                    </h2>
                    <p className="mx-auto mb-8 max-w-sm text-sm text-surface-500">
                      Upload documents first, then ask questions to get
                      AI-powered answers grounded in your course materials.
                    </p>

                    {/* Suggested prompts */}
                    <div className="mx-auto max-w-md space-y-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => handleSuggestedPrompt(prompt)}
                          disabled={createSession.isPending}
                          className="group flex w-full items-center gap-3 rounded-xl border border-surface-200 px-4 py-3 text-left text-sm text-surface-600 transition-all hover:border-arcus-300 hover:bg-arcus-50/50 disabled:opacity-50"
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0 text-surface-400 group-hover:text-arcus-500" />
                          {prompt}
                          <ArrowRight className="ml-auto h-4 w-4 text-surface-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-arcus-500 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Messages */
                <div className="divide-y divide-surface-100">
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

            {/* Error display */}
            {error && (
              <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                <p className="text-xs text-red-600">
                  {error.message ||
                    "Something went wrong. Please try again."}
                </p>
              </div>
            )}

            {/* Input */}
            <div className="border-t border-surface-200 p-4">
              <form onSubmit={onSubmit} className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                      isStreaming
                        ? "Waiting for response..."
                        : "Ask a question about your documents..."
                    }
                    disabled={isStreaming}
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 py-3 pr-4 pl-4 text-sm text-surface-900 placeholder:text-surface-400 focus:border-arcus-500 focus:bg-white focus:ring-2 focus:ring-arcus-500/20 focus:outline-none disabled:opacity-50"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isStreaming}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-lg hover:shadow-arcus-600/30 disabled:opacity-40 disabled:shadow-none"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </form>
              <p className="mt-2 text-center text-xs text-surface-400">
                Powered by RAG — Responses are grounded in your uploaded
                documents
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
