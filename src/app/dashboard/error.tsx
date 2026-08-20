"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Button, ButtonLink, Panel } from "@/components/ui";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl py-16">
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-red-200 bg-err-soft px-4 py-3">
          <TriangleAlert className="h-4 w-4 shrink-0 text-err" strokeWidth={1.75} />
          <h1 className="text-sm font-semibold text-surface-900">
            This view failed to render
          </h1>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm leading-relaxed text-surface-600">
            {error.message ||
              "An unexpected error occurred. Retrying often clears it."}
          </p>

          {/* The digest is what correlates this failure with the server log. */}
          {error.digest && (
            <p className="font-mono text-2xs text-surface-400">
              digest {error.digest}
            </p>
          )}

          <div className="flex items-center gap-2 border-t border-line pt-3">
            <Button variant="solid" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Try again
            </Button>
            <ButtonLink href="/dashboard">Back to overview</ButtonLink>
          </div>
        </div>
      </Panel>
    </div>
  );
}
