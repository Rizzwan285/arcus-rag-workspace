"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Brain,
  ChevronDown,
  Ellipsis,
  FileText,
  RotateCcw,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useUploadThing } from "@/lib/uploadthing";
import {
  Button,
  EmptyState,
  IndeterminateBar,
  Metric,
  Panel,
  PageHeader,
  ProgressBar,
  SectionLabel,
  Skeleton,
  Status,
  type StatusTone,
} from "@/components/ui";
import { cn, formatNumber, relativeTime } from "@/lib/utils";

type DocStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

const STATUS: Record<DocStatus, { tone: StatusTone; label: string }> = {
  PENDING: { tone: "warn", label: "queued" },
  PROCESSING: { tone: "busy", label: "processing" },
  COMPLETED: { tone: "ok", label: "indexed" },
  FAILED: { tone: "err", label: "failed" },
};

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const utils = trpc.useUtils();

  const [isDragging, setIsDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: documents = [],
    refetch,
    isLoading,
  } = trpc.document.getAll.useQuery(undefined, {
    enabled: !!session?.user,
    // Poll while anything is in flight so status transitions land on their own.
    refetchInterval: (q) => {
      const docs = q.state.data;
      if (!docs) return false;
      return docs.some((d) => d.status === "PROCESSING" || d.status === "PENDING")
        ? 3000
        : false;
    },
  });

  const invalidateAll = useCallback(() => {
    void refetch();
    void utils.document.getStats.invalidate();
    void utils.document.getPipelineStats.invalidate();
    void utils.document.getRecentRuns.invalidate();
    void utils.document.getFailed.invalidate();
  }, [refetch, utils]);

  const deleteDocument = trpc.document.delete.useMutation({
    onSettled: () => {
      setBusyId(null);
      invalidateAll();
    },
  });

  const retryIngestion = trpc.document.retryIngestion.useMutation({
    onError: (err) => setError(err.message),
    onSettled: () => {
      setBusyId(null);
      invalidateAll();
    },
  });

  const { startUpload } = useUploadThing("pdfUploader", {
    onClientUploadComplete: () => {
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, progress: 100, status: "done" as const }))
      );
      invalidateAll();
      setTimeout(() => setUploadingFiles([]), 1800);
    },
    onUploadError: (uploadError) => {
      setError(uploadError.message);
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
      setTimeout(() => setUploadingFiles([]), 4000);
    },
    onUploadProgress: (progress) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.status === "uploading" ? { ...f, progress } : f))
      );
    },
  });

  // Dismiss the row menu on an outside click.
  useEffect(() => {
    if (!menuOpenId) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpenId]);

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      if (!session?.user) {
        router.push("/auth/signin");
        return;
      }
      const pdfs = files.filter(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
      );
      if (pdfs.length === 0) {
        setError("Only PDF files can be ingested.");
        return;
      }
      setError(null);
      setUploadingFiles(
        pdfs.map((f) => ({ name: f.name, progress: 0, status: "uploading" }))
      );
      await startUpload(pdfs);
    },
    [session, router, startUpload]
  );

  const handleGenerate = async (
    documentId: string,
    type: "flashcards" | "quiz"
  ) => {
    setBusyId(documentId);
    setMenuOpenId(null);
    setError(null);
    try {
      const res = await fetch("/api/generate/study-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push(
          type === "flashcards"
            ? `/dashboard/flashcards/${data.deckId}`
            : `/dashboard/quizzes/${data.quizId}`
        );
      } else {
        setError(data.error ?? "Generation failed.");
      }
    } catch {
      setError("An error occurred while generating.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = documents.filter((doc) =>
    doc.title.toLowerCase().includes(query.toLowerCase())
  );

  const readyCount = documents.filter((d) => d.status === "COMPLETED").length;
  const inFlight = documents.filter(
    (d) => d.status === "PROCESSING" || d.status === "PENDING"
  ).length;
  const failedCount = documents.filter((d) => d.status === "FAILED").length;
  const totalChunks = documents.reduce((sum, d) => sum + (d._count?.chunks ?? 0), 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description="PDFs are parsed, chunked, embedded, and indexed for hybrid retrieval. Chunk writes are keyed on a content hash, so a retry can never duplicate your corpus."
        action={
          <Button
            variant="solid"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload PDF
          </Button>
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files ? Array.from(event.target.files) : [];
          void handleFileUpload(files);
          event.target.value = "";
        }}
      />

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-err-soft px-3.5 py-2.5">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-err" />
          <p className="flex-1 text-xs text-surface-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-surface-400 hover:text-surface-700"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Corpus summary ── */}
      {documents.length > 0 && (
        <Panel className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric label="Documents" value={documents.length} />
          </div>
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric
              label="Indexed"
              value={readyCount}
              tone={readyCount > 0 ? "ok" : "idle"}
            />
          </div>
          <div className="p-4">
            <Metric
              label="In flight"
              value={inFlight}
              tone={inFlight > 0 ? "busy" : "idle"}
            />
          </div>
          <div className="p-4">
            <Metric
              label="Chunks"
              value={formatNumber(totalChunks)}
              hint={failedCount > 0 ? `${failedCount} failed` : "Retrievable"}
            />
          </div>
        </Panel>
      )}

      {/* ── Drop zone ── */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void handleFileUpload(Array.from(event.dataTransfer.files));
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-colors",
          isDragging
            ? "border-arcus-500 bg-arcus-50"
            : "border-line-strong hover:border-surface-400 hover:bg-surface-50"
        )}
      >
        <div className="hatch mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-line">
          <Upload className="h-4 w-4 text-surface-400" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-medium text-surface-800">
          {isDragging ? "Release to upload" : "Drop PDFs here"}
        </p>
        <p className="mt-1 font-mono text-2xs text-surface-400">
          PDF · up to 32 MB · 5 files per upload
        </p>
      </div>

      {/* ── In-progress uploads ── */}
      {uploadingFiles.length > 0 && (
        <Panel className="divide-y divide-line">
          {uploadingFiles.map((file) => (
            <div key={file.name} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-surface-800">
                  {file.name}
                </span>
                <span className="shrink-0 font-mono text-2xs tabular text-surface-400">
                  {file.status === "error"
                    ? "failed"
                    : file.status === "done"
                      ? "queued for ingest"
                      : `${Math.round(file.progress)}%`}
                </span>
              </div>
              <ProgressBar value={file.progress} className="mt-2" />
            </div>
          ))}
        </Panel>
      )}

      {/* ── Library ── */}
      <section className="space-y-3">
        <SectionLabel
          action={
            documents.length > 0 ? (
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-surface-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by title"
                  className="h-8 w-56 rounded-md border border-line bg-surface-0 pr-2.5 pl-8 text-sm text-surface-900 placeholder:text-surface-400 focus:border-surface-400 focus:outline-none"
                />
              </div>
            ) : undefined
          }
        >
          Library
        </SectionLabel>

        {isLoading ? (
          <Panel className="divide-y divide-line">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-2 px-4 py-3.5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </Panel>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={query ? "No matches" : "No documents yet"}
            description={
              query
                ? `Nothing matches “${query}”.`
                : "Upload a PDF to build your searchable corpus."
            }
            action={
              query ? (
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Clear filter
                </Button>
              ) : (
                <Button
                  variant="solid"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload a PDF
                </Button>
              )
            }
          />
        ) : (
          <Panel className="divide-y divide-line">
            {filtered.map((doc) => {
              const status = STATUS[doc.status as DocStatus];
              const isFailed = doc.status === "FAILED";
              const isBusy =
                doc.status === "PROCESSING" || doc.status === "PENDING";
              const isExpanded = expandedId === doc.id;

              return (
                <div key={doc.id} className="group">
                  <div className="flex items-start gap-3 px-4 py-3.5">
                    <FileText
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        isFailed ? "text-err" : "text-surface-300"
                      )}
                      strokeWidth={1.75}
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">
                        {doc.title}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Status tone={status.tone}>{status.label}</Status>
                        <span className="text-surface-300">·</span>
                        <span className="font-mono text-2xs tabular text-surface-400">
                          {doc._count.chunks} chunks
                        </span>
                        {doc.pageCount ? (
                          <>
                            <span className="text-surface-300">·</span>
                            <span className="font-mono text-2xs tabular text-surface-400">
                              {doc.pageCount} pages
                            </span>
                          </>
                        ) : null}
                        <span className="text-surface-300">·</span>
                        <span className="font-mono text-2xs text-surface-400">
                          {relativeTime(doc.createdAt)}
                        </span>
                        {doc.failedStep && (
                          <>
                            <span className="text-surface-300">·</span>
                            <span className="rounded border border-red-200 bg-err-soft px-1.5 py-0.5 font-mono text-2xs text-err">
                              {doc.failedStep}
                            </span>
                          </>
                        )}
                      </div>

                      {isBusy && <IndeterminateBar className="mt-2.5 max-w-xs" />}

                      {isFailed && doc.errorMessage && (
                        <p className="mt-1.5 text-xs leading-relaxed text-surface-600">
                          {doc.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isFailed && (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={busyId === doc.id}
                          onClick={() => {
                            setBusyId(doc.id);
                            retryIngestion.mutate({
                              id: doc.id,
                              purgeExistingChunks: false,
                            });
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Retry
                        </Button>
                      )}

                      {doc.status === "COMPLETED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={busyId === doc.id}
                            onClick={() => handleGenerate(doc.id, "flashcards")}
                          >
                            <BookOpen className="h-3 w-3" />
                            Cards
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={busyId === doc.id}
                            onClick={() => handleGenerate(doc.id, "quiz")}
                          >
                            <Brain className="h-3 w-3" />
                            Quiz
                          </Button>
                        </>
                      )}

                      <div className="relative" ref={menuOpenId === doc.id ? menuRef : undefined}>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Actions for ${doc.title}`}
                          aria-expanded={menuOpenId === doc.id}
                          onClick={() =>
                            setMenuOpenId(menuOpenId === doc.id ? null : doc.id)
                          }
                        >
                          <Ellipsis className="h-3.5 w-3.5" />
                        </Button>

                        {menuOpenId === doc.id && (
                          <div
                            role="menu"
                            className="absolute right-0 z-40 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-surface-0 shadow-lg"
                          >
                            <button
                              role="menuitem"
                              onClick={() => {
                                setMenuOpenId(null);
                                setExpandedId(isExpanded ? null : doc.id);
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                              {isExpanded ? "Hide run history" : "Run history"}
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => {
                                setMenuOpenId(null);
                                setBusyId(doc.id);
                                retryIngestion.mutate({
                                  id: doc.id,
                                  purgeExistingChunks: true,
                                });
                              }}
                              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-surface-600 hover:bg-surface-50 hover:text-surface-900"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reprocess from scratch
                            </button>
                            <button
                              role="menuitem"
                              onClick={() => {
                                setMenuOpenId(null);
                                setBusyId(doc.id);
                                deleteDocument.mutate({ id: doc.id });
                              }}
                              className="flex w-full items-center gap-2.5 border-t border-line px-3 py-2 text-left text-sm text-err hover:bg-err-soft"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete document
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isExpanded && <RunHistory documentId={doc.id} />}
                </div>
              );
            })}
          </Panel>
        )}
      </section>
    </div>
  );
}

/**
 * Per-document ingestion history. Loaded on demand so the library list stays
 * one query.
 */
function RunHistory({ documentId }: { documentId: string }) {
  const { data: runs, isLoading } = trpc.document.getIngestionRuns.useQuery({
    documentId,
  });

  if (isLoading) {
    return (
      <div className="border-t border-line bg-surface-50 px-4 py-3">
        <Skeleton className="h-3 w-1/3" />
      </div>
    );
  }

  if (!runs || runs.length === 0) {
    return (
      <div className="border-t border-line bg-surface-50 px-4 py-3">
        <p className="text-xs text-surface-400">
          No runs recorded — this document predates run telemetry.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-surface-50 px-4 py-3">
      <table className="w-full text-left">
        <thead>
          <tr>
            {["Attempt", "Status", "Latency", "Yielded", "Written", "Deduped", "Tokens", "When"].map(
              (header) => (
                <th
                  key={header}
                  className="pb-1.5 font-mono text-2xs font-medium tracking-[0.08em] text-surface-400 uppercase"
                >
                  {header}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="font-mono text-2xs tabular text-surface-600">
              <td className="py-1">{run.attempt}</td>
              <td className="py-1">
                <Status
                  tone={
                    run.status === "SUCCEEDED"
                      ? "ok"
                      : run.status === "FAILED"
                        ? "err"
                        : "busy"
                  }
                >
                  {run.status.toLowerCase()}
                </Status>
              </td>
              <td className="py-1">
                {run.latencyMs === null ? "—" : `${run.latencyMs}ms`}
              </td>
              <td className="py-1">{run.chunksYielded ?? "—"}</td>
              <td className="py-1">{run.chunksInserted ?? "—"}</td>
              <td className="py-1">{run.chunksDeduped ?? "—"}</td>
              <td className="py-1">
                {run.embeddingTokens ? formatNumber(run.embeddingTokens) : "—"}
              </td>
              <td className="py-1 text-surface-400">
                {relativeTime(run.startedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
