"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User, FileText, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceReference {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  similarity: number;
  preview: string;
}

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceReference[];
  isStreaming?: boolean;
}

export default function ChatMessage({
  role,
  content,
  sources,
  isStreaming,
}: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group flex gap-4 px-4 py-5",
        isUser ? "flex-row-reverse" : ""
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl",
          isUser
            ? "bg-gradient-to-br from-arcus-500 to-arcus-700 text-white"
            : "bg-gradient-to-br from-emerald-400 to-teal-500 text-white"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message Content */}
      <div
        className={cn(
          "max-w-[75%] space-y-2",
          isUser ? "text-right" : ""
        )}
      >
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-wider text-surface-400">
          {isUser ? "You" : "Arcus"}
        </p>

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-md bg-gradient-to-r from-arcus-600 to-arcus-500 text-white"
              : "rounded-tl-md border border-surface-200 bg-white text-surface-800 shadow-sm"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-headings:text-surface-900 prose-p:text-surface-700 prose-strong:text-surface-900 prose-code:rounded prose-code:bg-surface-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-arcus-600 prose-pre:bg-surface-900 prose-pre:text-surface-100 prose-li:text-surface-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && !isUser && (
            <span className="mt-1 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-arcus-400 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-arcus-400 [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-arcus-400 [animation-delay:300ms]" />
            </span>
          )}
        </div>

        {/* Action buttons for AI messages */}
        {!isUser && content && !isStreaming && (
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
              title="Copy response"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Citation/Source References */}
        {!isUser && sources && sources.length > 0 && !isStreaming && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className="flex items-center gap-1.5 rounded-lg bg-surface-50 px-3 py-1.5 text-xs font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-surface-700"
            >
              <FileText className="h-3 w-3" />
              {sources.length} source{sources.length > 1 ? "s" : ""} referenced
              {showSources ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showSources && (
              <div className="mt-2 space-y-2">
                {sources.map((source, index) => (
                  <div
                    key={source.chunkId || index}
                    className="rounded-xl border border-surface-200 bg-surface-50/50 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-arcus-500" />
                      <span className="text-xs font-semibold text-surface-700">
                        {source.documentTitle}
                      </span>
                      {source.pageNumber && (
                        <span className="rounded-full bg-arcus-100 px-2 py-0.5 text-[10px] font-medium text-arcus-700">
                          Page {source.pageNumber}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] text-surface-400">
                        {(source.similarity * 100).toFixed(0)}% match
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-surface-500">
                      {source.preview}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
