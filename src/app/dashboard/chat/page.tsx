"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  FileText,
  Clock,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
        <div className="flex h-[600px]">
          {/* ── Sidebar: Chat Sessions ── */}
          <div className="flex w-72 flex-col border-r border-surface-200">
            <div className="border-b border-surface-200 p-4">
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-arcus-600/30">
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {/* Empty state */}
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare className="mb-3 h-8 w-8 text-surface-300" />
                <p className="text-sm font-medium text-surface-500">
                  No conversations yet
                </p>
                <p className="mt-1 text-xs text-surface-400">
                  Start a new chat to ask about your docs
                </p>
              </div>
            </div>
          </div>

          {/* ── Main Chat Area ── */}
          <div className="flex flex-1 flex-col">
            {/* Empty state */}
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-arcus-50 to-purple-50">
                  <Sparkles className="h-10 w-10 text-arcus-500" />
                </div>
                <h2 className="mb-2 text-xl font-bold text-surface-900">
                  Chat with Your Documents
                </h2>
                <p className="mx-auto mb-8 max-w-sm text-sm text-surface-500">
                  Upload documents first, then ask questions to get AI-powered
                  answers with source references.
                </p>

                {/* Suggested prompts */}
                <div className="mx-auto max-w-md space-y-2">
                  {[
                    "Summarize the key concepts in my notes",
                    "What are the main topics covered?",
                    "Explain this concept in simpler terms",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      className="group flex w-full items-center gap-3 rounded-xl border border-surface-200 px-4 py-3 text-left text-sm text-surface-600 transition-all hover:border-arcus-300 hover:bg-arcus-50/50"
                    >
                      <MessageSquare className="h-4 w-4 flex-shrink-0 text-surface-400 group-hover:text-arcus-500" />
                      {prompt}
                      <ArrowRight className="ml-auto h-4 w-4 text-surface-300 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-arcus-500 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="border-t border-surface-200 p-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ask a question about your documents..."
                    className="w-full rounded-xl border border-surface-200 bg-surface-50 py-3 pr-4 pl-4 text-sm text-surface-900 placeholder:text-surface-400 focus:border-arcus-500 focus:bg-white focus:ring-2 focus:ring-arcus-500/20 focus:outline-none"
                  />
                </div>
                <button
                  disabled={!message.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-arcus-600 to-arcus-500 text-white shadow-md shadow-arcus-600/20 transition-all hover:shadow-arcus-600/30 disabled:opacity-40 disabled:shadow-none"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
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
