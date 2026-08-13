"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  MoreVertical,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  X,
  File,
  Layers,
  BookOpen,
  RefreshCw,
  Zap,
  Target,
  HelpCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useUploadThing } from "@/lib/uploadthing";

const statusConfig = {
  PENDING: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    animate: false,
    description: "Waiting to start processing",
  },
  PROCESSING: {
    icon: Loader2,
    label: "Processing",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    animate: true,
    description: "Extracting text & generating embeddings",
  },
  COMPLETED: {
    icon: CheckCircle,
    label: "Ready",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    animate: false,
    description: "Searchable — ready for AI chat",
  },
  FAILED: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    animate: false,
    description: "Processing error occurred",
  },
};

interface UploadingFile {
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
}

export default function DocumentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [generatingModuleId, setGeneratingModuleId] = useState<string | null>(null);

  // Handle study module generation
  const handleGenerateModule = async (documentId: string, type: "flashcards" | "quiz") => {
    setGeneratingModuleId(documentId);
    setMenuOpenId(null);
    try {
      const res = await fetch("/api/generate/study-module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, type }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (type === "flashcards") {
          router.push(`/dashboard/flashcards/${data.deckId}`);
        } else {
          router.push(`/dashboard/quizzes/${data.quizId}`);
        }
      } else {
        console.error("Generation failed:", data.error);
        alert(data.error || "Failed to generate module");
      }
    } catch (error) {
      console.error("Failed to generate module:", error);
      alert("An error occurred while generating.");
    } finally {
      setGeneratingModuleId(null);
    }
  };

  // tRPC queries & mutations
  const {
    data: documents = [],
    refetch,
    isLoading,
  } = trpc.document.getAll.useQuery(undefined, {
    enabled: !!session?.user,
    // Auto-poll every 3s if any documents are still processing
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (!docs) return false;
      const hasProcessing = docs.some(
        (d) => d.status === "PROCESSING" || d.status === "PENDING"
      );
      return hasProcessing ? 3000 : false;
    },
  });

  const deleteDocument = trpc.document.delete.useMutation({
    onSuccess: () => refetch(),
  });

  // UploadThing integration
  const { startUpload, isUploading } = useUploadThing("pdfUploader", {
    onClientUploadComplete: (res) => {
      console.log("Upload complete:", res);
      // Mark all uploading files as done
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, progress: 100, status: "done" as const }))
      );
      // Refetch documents to show the new ones
      refetch();
      // Clear upload state after a delay
      setTimeout(() => setUploadingFiles([]), 2000);
    },
    onUploadError: (error) => {
      console.error("Upload error:", error);
      setUploadingFiles((prev) =>
        prev.map((f) => ({ ...f, status: "error" as const }))
      );
      setTimeout(() => setUploadingFiles([]), 4000);
    },
    onUploadProgress: (progress) => {
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading" ? { ...f, progress } : f
        )
      );
    },
  });

  const handleFileUpload = useCallback(
    async (files: File[]) => {
      if (!session?.user) {
        router.push("/auth/signin");
        return;
      }

      const pdfFiles = files.filter(
        (f) => f.type === "application/pdf" || f.name.endsWith(".pdf")
      );
      if (pdfFiles.length === 0) return;

      // Show uploading state
      setUploadingFiles(
        pdfFiles.map((f) => ({ name: f.name, progress: 0, status: "uploading" }))
      );

      // Upload via UploadThing (this triggers onUploadComplete on the server)
      await startUpload(pdfFiles);
    },
    [session, router, startUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFileUpload(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    handleFileUpload(files);
    e.target.value = ""; // Reset input
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const completedCount = documents.filter((d) => d.status === "COMPLETED").length;
  const processingCount = documents.filter(
    (d) => d.status === "PROCESSING" || d.status === "PENDING"
  ).length;
  const totalChunks = documents.reduce(
    (sum, d) => sum + (d._count?.chunks ?? 0),
    0
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-surface-900">
            Documents
          </h1>
          <p className="mt-1 text-surface-500">
            Upload and manage your course materials
          </p>
        </div>

        {/* Stats Summary */}
        {documents.length > 0 && (
          <div className="hidden gap-4 sm:flex">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm">
              <BookOpen className="h-4 w-4 text-emerald-600" />
              <span className="font-medium text-emerald-700">
                {completedCount} ready
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm">
              <Layers className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-700">
                {totalChunks} chunks
              </span>
            </div>
            {processingCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-sm">
                <Zap className="h-4 w-4 text-amber-600" />
                <span className="font-medium text-amber-700">
                  {processingCount} processing
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Upload Zone ── */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300",
          isDragging
            ? "border-arcus-500 bg-arcus-50/50 shadow-lg shadow-arcus-500/10"
            : "border-surface-300 bg-white hover:border-arcus-400 hover:bg-arcus-50/20",
          isUploading && "pointer-events-none opacity-60"
        )}
      >
        <label htmlFor="file-upload" className="cursor-pointer">
          <input
            id="file-upload"
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />
          <div
            className={cn(
              "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
              isDragging
                ? "bg-arcus-100 text-arcus-600"
                : "bg-surface-100 text-surface-400"
            )}
          >
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
          </div>
          <p className="text-lg font-semibold text-surface-900">
            {isDragging
              ? "Drop your files here"
              : isUploading
              ? "Uploading..."
              : "Upload Documents"}
          </p>
          <p className="mt-1 text-sm text-surface-500">
            {isUploading
              ? "Your files are being uploaded and will be processed automatically"
              : "Drag & drop PDF files or click to browse"}
          </p>
          <p className="mt-3 text-xs text-surface-400">
            Supported: PDF • Max 32MB per file • Up to 5 files
          </p>
        </label>
      </div>

      {/* ── Uploading Files ── */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          {uploadingFiles.map((file, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <File className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-surface-900">
                  {file.name}
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      file.status === "error"
                        ? "bg-red-500"
                        : file.status === "done"
                        ? "bg-emerald-500"
                        : "bg-arcus-500"
                    )}
                    style={{ width: `${file.progress}%` }}
                  />
                </div>
              </div>
              {file.status === "uploading" && (
                <Loader2 className="h-4 w-4 animate-spin text-arcus-500" />
              )}
              {file.status === "done" && (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              )}
              {file.status === "error" && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Processing Banner ── */}
      {processingCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-blue-800">
            {processingCount} document{processingCount > 1 ? "s" : ""} being
            processed — extracting text and generating embeddings...
          </p>
          <RefreshCw className="ml-auto h-4 w-4 text-blue-400 animate-pulse" />
        </div>
      )}

      {/* ── Search ── */}
      {documents.length > 0 && (
        <div className="relative">
          <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-surface-200 bg-white py-3 pr-4 pl-11 text-sm text-surface-900 placeholder:text-surface-400 focus:border-arcus-500 focus:ring-2 focus:ring-arcus-500/20 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute top-1/2 right-4 -translate-y-1/2 text-surface-400 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* ── Document List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-arcus-500" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-2xl border border-surface-200 bg-white p-16 text-center">
          <FileText className="mx-auto mb-4 h-12 w-12 text-surface-300" />
          <h3 className="text-lg font-semibold text-surface-900">
            {documents.length === 0
              ? "No documents yet"
              : "No matching documents"}
          </h3>
          <p className="mt-1 text-sm text-surface-500">
            {documents.length === 0
              ? "Upload your first PDF to get started with AI-powered learning"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDocuments.map((doc) => {
            const status =
              statusConfig[doc.status as keyof typeof statusConfig];
            const StatusIcon = status.icon;
            const chunkCount = doc._count?.chunks ?? 0;

            return (
              <div
                key={doc.id}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border bg-white p-4 transition-all hover:shadow-sm",
                  doc.status === "PROCESSING"
                    ? "border-blue-200 bg-blue-50/30"
                    : doc.status === "FAILED"
                    ? "border-red-200 bg-red-50/20"
                    : "border-surface-200 hover:border-surface-300"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    doc.status === "COMPLETED"
                      ? "bg-emerald-50 text-emerald-500"
                      : doc.status === "PROCESSING"
                      ? "bg-blue-50 text-blue-500"
                      : doc.status === "FAILED"
                      ? "bg-red-50 text-red-500"
                      : "bg-surface-100 text-surface-400"
                  )}
                >
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-surface-900 truncate">
                    {doc.title}
                  </p>
                  <p className="text-xs text-surface-500">
                    {doc.status === "COMPLETED" && (
                      <>
                        {chunkCount} chunks
                        {doc.pageCount && ` • ${doc.pageCount} pages`}
                        {" • "}
                      </>
                    )}
                    {doc.status === "PROCESSING" && (
                      <span className="text-blue-600">
                        Processing — extracting text & embeddings...
                      </span>
                    )}
                    {doc.status === "FAILED" && (
                      <span className="text-red-600">
                        Processing failed — try re-uploading
                      </span>
                    )}
                    {(doc.status === "COMPLETED" || doc.status === "PENDING") && (
                      <>
                        Uploaded{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>

                {/* Status Badge */}
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                    status.bg,
                    status.color
                  )}
                  title={status.description}
                >
                  <StatusIcon
                    className={cn(
                      "h-3.5 w-3.5",
                      status.animate && "animate-spin"
                    )}
                  />
                  {status.label}
                </div>

                {/* Actions Menu */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setMenuOpenId(menuOpenId === doc.id ? null : doc.id)
                    }
                    className="rounded-lg p-2 text-surface-400 opacity-0 transition-all hover:bg-surface-100 group-hover:opacity-100"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {menuOpenId === doc.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 z-50 mt-1 w-48 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg">
                        {doc.status === "COMPLETED" && (
                          <>
                            <button
                              onClick={() => {
                                router.push(
                                  `/dashboard/chat?q=${encodeURIComponent(
                                    `Create a detailed study plan with review sessions based on the document "${doc.title}".`
                                  )}`
                                );
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-arcus-50 hover:text-arcus-700"
                            >
                              <Target className="h-4 w-4" />
                              Generate Study Plan
                            </button>
                            <button
                              onClick={() => handleGenerateModule(doc.id, "flashcards")}
                              disabled={generatingModuleId === doc.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-arcus-50 hover:text-arcus-700 disabled:opacity-50"
                            >
                              {generatingModuleId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <BookOpen className="h-4 w-4" />
                              )}
                              Generate Flashcards
                            </button>
                            <button
                              onClick={() => handleGenerateModule(doc.id, "quiz")}
                              disabled={generatingModuleId === doc.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-600 hover:bg-arcus-50 hover:text-arcus-700 disabled:opacity-50"
                            >
                              {generatingModuleId === doc.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <HelpCircle className="h-4 w-4" />
                              )}
                              Generate Quiz
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            deleteDocument.mutate({ id: doc.id });
                            setMenuOpenId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
