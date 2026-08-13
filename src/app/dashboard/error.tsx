"use client";

import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-surface-900">
        Something went wrong
      </h2>
      <p className="mb-8 text-sm text-surface-500">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-arcus-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-arcus-500 hover:shadow-lg"
        >
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-5 py-2.5 text-sm font-semibold text-surface-700 transition-all hover:bg-surface-50"
        >
          <Home className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
