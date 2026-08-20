"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, ChevronDown, Copy, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceReference {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  pageNumber: number | null;
  similarity: number;
  /** `ts_rank_cd` score from the lexical arm — 0 when only the dense arm matched. */
  keywordScore?: number;
  /** Which retrieval arm surfaced this passage. */
  matchedBy?: "both" | "vector" | "keyword";
}

interface ChatMessageProps {
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SourceReference[];
  isStreaming?: boolean;
}

/** How a passage was found, phrased for a reader rather than an engineer. */
const MATCH_LABEL: Record<string, string> = {
  both: "semantic + keyword",
  vector: "semantic",
  keyword: "keyword",
};

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
    <article
      className={cn("group px-5 py-5", isUser ? "bg-surface-50" : "bg-surface-0")}
    >
      <div className="mx-auto flex max-w-3xl gap-3.5">
        {/* Speaker marker: a letter, not an avatar illustration. */}
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-2xs font-semibold",
            isUser
              ? "bg-surface-200 text-surface-600"
              : "bg-surface-900 text-white"
          )}
          aria-hidden
        >
          {isUser ? "You" : "A"}
        </span>

        <div className="min-w-0 flex-1">
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-surface-800">
              {content}
            </p>
          ) : (
            <div className="prose-arcus">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}

          {isStreaming && !isUser && (
            <span className="mt-2 inline-flex items-center gap-1" aria-label="Generating">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1 w-1 animate-bounce rounded-full bg-surface-400"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
          )}

          {/* ── Actions ── */}
          {!isUser && content && !isStreaming && (
            <div className="mt-3 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-700"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-ok" />
                    <span className="text-ok">Copied</span>
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

          {/* ── Provenance ── */}
          {!isUser && sources && sources.length > 0 && !isStreaming && (
            <div className="mt-3">
              <button
                onClick={() => setShowSources((open) => !open)}
                aria-expanded={showSources}
                className="inline-flex items-center gap-1.5 rounded border border-line bg-surface-50 px-2 py-1 font-mono text-2xs text-surface-500 transition-colors hover:border-line-strong hover:text-surface-800"
              >
                <FileText className="h-3 w-3" />
                {sources.length} passage{sources.length > 1 ? "s" : ""} retrieved
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showSources && "rotate-180"
                  )}
                />
              </button>

              {showSources && (
                <ol className="mt-2 divide-y divide-line rounded-md border border-line">
                  {sources.map((source, index) => (
                    <li key={source.chunkId || index} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-2xs text-surface-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="min-w-0 truncate text-xs font-medium text-surface-800">
                          {source.documentTitle}
                        </span>
                        {source.pageNumber !== null && (
                          <span className="font-mono text-2xs text-surface-400">
                            p{source.pageNumber}
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-2 font-mono text-2xs text-surface-400">
                          {source.matchedBy && (
                            <span className="rounded border border-line bg-surface-50 px-1.5 py-0.5">
                              {MATCH_LABEL[source.matchedBy] ?? source.matchedBy}
                            </span>
                          )}
                          <span className="tabular">
                            {(source.similarity * 100).toFixed(0)}%
                          </span>
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
