"use client";

import { useState, useCallback } from "react";
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
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const statusConfig = {
  PENDING: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50",
    animate: false,
  },
  PROCESSING: {
    icon: Loader2,
    label: "Processing",
    color: "text-blue-600",
    bg: "bg-blue-50",
    animate: true,
  },
  COMPLETED: {
    icon: CheckCircle,
    label: "Ready",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    animate: false,
  },
  FAILED: {
    icon: AlertCircle,
    label: "Failed",
    color: "text-red-600",
    bg: "bg-red-50",
    animate: false,
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

  // tRPC queries & mutations
  const { data: documents = [], refetch } = trpc.document.getAll.useQuery(
    undefined,
    { enabled: !!session?.user }
  );
  const createDocument = trpc.document.create.useMutation({
    onSuccess: () => refetch(),
  });
  const deleteDocument = trpc.document.delete.useMutation({
    onSuccess: () => refetch(),
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

      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        try {
          // Upload via UploadThing endpoint
          const formData = new FormData();
          formData.append("files", file);

          // Simulate progress (UploadThing handles this internally)
          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress: 30 } : f
            )
          );

          const res = await fetch("/api/uploadthing", {
            method: "POST",
            headers: {
              "x-uploadthing-package": "@uploadthing/react",
            },
          });

          // For now, create a document record with a placeholder URL
          // The actual UploadThing upload flow uses their React components
          const title = file.name.replace(/\.pdf$/i, "");

          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress: 70 } : f
            )
          );

          await createDocument.mutateAsync({
            title,
            fileUrl: `uploadthing://pending/${file.name}`,
            fileType: "pdf",
          });

          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, progress: 100, status: "done" } : f
            )
          );
        } catch {
          setUploadingFiles((prev) =>
            prev.map((f, idx) =>
              idx === i ? { ...f, status: "error" } : f
            )
          );
        }
      }

      // Clear upload state after a delay
      setTimeout(() => setUploadingFiles([]), 3000);
    },
    [session, router, createDocument]
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

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-surface-900">
          Documents
        </h1>
        <p className="mt-1 text-surface-500">
          Upload and manage your course materials
        </p>
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
            : "border-surface-300 bg-white hover:border-arcus-400 hover:bg-arcus-50/20"
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
          />
          <div
            className={cn(
              "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
              isDragging
                ? "bg-arcus-100 text-arcus-600"
                : "bg-surface-100 text-surface-400"
            )}
          >
            <Upload className="h-8 w-8" />
          </div>
          <p className="text-lg font-semibold text-surface-900">
            {isDragging ? "Drop your files here" : "Upload Documents"}
          </p>
          <p className="mt-1 text-sm text-surface-500">
            Drag & drop PDF files or click to browse
          </p>
          <p className="mt-3 text-xs text-surface-400">
            Supported: PDF • Max 32MB per file
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
      {filteredDocuments.length === 0 ? (
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

            return (
              <div
                key={doc.id}
                className="group flex items-center gap-4 rounded-xl border border-surface-200 bg-white p-4 transition-all hover:border-surface-300 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-red-500">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-surface-900">{doc.title}</p>
                  <p className="text-xs text-surface-500">
                    {doc._count.chunks} chunks • Uploaded{" "}
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${status.bg} ${status.color}`}
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
                      <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg">
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
