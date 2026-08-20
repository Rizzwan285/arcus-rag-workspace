"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import {
  Activity,
  ChevronDown,
  CircleCheck,
  Inbox,
  RotateCcw,
  TriangleAlert,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  Button,
  EmptyState,
  Metric,
  Panel,
  PageHeader,
  SectionLabel,
  Skeleton,
  Status,
  type StatusTone,
} from "@/components/ui";
import {
  cn,
  formatBytes,
  formatDuration,
  formatNumber,
  formatUsd,
  relativeTime,
} from "@/lib/utils";

const RUN_TONE: Record<string, StatusTone> = {
  SUCCEEDED: "ok",
  RUNNING: "busy",
  FAILED: "err",
};

export default function PipelinePage() {
  const { data: session } = useSession();
  const enabled = !!session?.user;
  const utils = trpc.useUtils();

  const { data: stats, isLoading: statsLoading } =
    trpc.document.getPipelineStats.useQuery(undefined, { enabled });
  const { data: failed, isLoading: failedLoading } =
    trpc.document.getFailed.useQuery(undefined, { enabled });
  const { data: runs, isLoading: runsLoading } =
    trpc.document.getRecentRuns.useQuery({ limit: 25 }, { enabled });

  const [expanded, setExpanded] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const retry = trpc.document.retryIngestion.useMutation({
    onSettled: () => {
      setRetryingId(null);
      void utils.document.getFailed.invalidate();
      void utils.document.getRecentRuns.invalidate();
      void utils.document.getPipelineStats.invalidate();
      void utils.document.getAll.invalidate();
      void utils.document.getStats.invalidate();
    },
  });

  const successRate =
    stats && stats.totalRuns > 0
      ? Math.round((stats.succeeded / stats.totalRuns) * 100)
      : null;

  // Dedupe rate quantifies how much repeated work idempotency absorbed.
  const dedupeRate =
    stats && stats.totalChunks + stats.totalDeduped > 0
      ? Math.round(
          (stats.totalDeduped / (stats.totalChunks + stats.totalDeduped)) * 100
        )
      : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System"
        title="Pipeline"
        description="Every ingestion attempt is recorded: latency, chunk yield, dedupe rate, and estimated embedding spend. Documents that exhaust their retries land in the dead letter queue below."
      />

      {/* ── Health ── */}
      <section className="space-y-3">
        <SectionLabel>Health</SectionLabel>
        <Panel className="grid grid-cols-2 divide-line md:grid-cols-3 lg:grid-cols-6">
          <div className="border-r border-b border-line p-4 lg:border-b-0">
            <Metric
              label="Runs"
              value={formatNumber(stats?.totalRuns ?? 0)}
              loading={statsLoading}
              hint="All attempts"
            />
          </div>
          <div className="border-b border-line p-4 md:border-r lg:border-b-0">
            <Metric
              label="Success"
              value={successRate === null ? "—" : successRate}
              unit={successRate === null ? undefined : "%"}
              loading={statsLoading}
              tone={
                successRate === null
                  ? "idle"
                  : successRate === 100
                    ? "ok"
                    : successRate >= 90
                      ? "warn"
                      : "err"
              }
              hint={`${stats?.failed ?? 0} failed`}
            />
          </div>
          <div className="border-r border-b border-line p-4 lg:border-b-0">
            <Metric
              label="p95 latency"
              value={formatDuration(stats?.p95LatencyMs)}
              loading={statsLoading}
              hint="Successful runs"
            />
          </div>
          <div className="border-b border-line p-4 md:border-r lg:border-b-0">
            <Metric
              label="Mean latency"
              value={formatDuration(stats?.avgLatencyMs)}
              loading={statsLoading}
              hint="Successful runs"
            />
          </div>
          <div className="border-r border-line p-4">
            <Metric
              label="Chunks written"
              value={formatNumber(stats?.totalChunks ?? 0)}
              loading={statsLoading}
              hint={`${dedupeRate}% deduped on retry`}
            />
          </div>
          <div className="p-4">
            <Metric
              label="Est. spend"
              value={formatUsd(stats?.totalCostUsd)}
              loading={statsLoading}
              hint={`${formatNumber(stats?.totalTokens ?? 0)} tokens`}
            />
          </div>
        </Panel>
        <p className="text-xs text-surface-400">
          Token counts are estimated locally — Gemini&apos;s batch embedding
          endpoint returns no usage metadata. The rate is configurable via{" "}
          <code className="font-mono text-2xs text-surface-500">
            EMBEDDING_USD_PER_MTOK
          </code>
          .
        </p>
      </section>

      {/* ── Dead Letter Queue ── */}
      <section className="space-y-3">
        <SectionLabel>Dead letter queue</SectionLabel>

        {failedLoading ? (
          <Panel className="space-y-3 p-4">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </Panel>
        ) : !failed || failed.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="Queue is empty"
            description="No document has exhausted its retry budget. Transient failures are retried automatically and never reach this queue."
          />
        ) : (
          <Panel className="divide-y divide-line">
            {failed.map((doc) => {
              const isOpen = expanded === doc.id;
              const lastRun = doc.ingestionRuns[0];

              return (
                <div key={doc.id}>
                  <div className="flex items-start gap-3 px-4 py-3">
                    <TriangleAlert
                      className="mt-0.5 h-4 w-4 shrink-0 text-err"
                      strokeWidth={1.75}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-surface-900">
                        {doc.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-2xs text-surface-400">
                        {doc.failedStep && (
                          <span className="rounded border border-red-200 bg-err-soft px-1.5 py-0.5 text-err">
                            {doc.failedStep}
                          </span>
                        )}
                        {lastRun && (
                          <span>attempt {lastRun.attempt}</span>
                        )}
                        {doc.failedAt && (
                          <>
                            <span className="text-surface-300">·</span>
                            <span>{relativeTime(doc.failedAt)}</span>
                          </>
                        )}
                      </div>
                      {doc.errorMessage && (
                        <p className="mt-1.5 text-xs leading-relaxed text-surface-600">
                          {doc.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {doc.errorTrace && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(isOpen ? null : doc.id)}
                          aria-expanded={isOpen}
                        >
                          Trace
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 transition-transform",
                              isOpen && "rotate-180"
                            )}
                          />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        loading={retryingId === doc.id}
                        onClick={() => {
                          setRetryingId(doc.id);
                          retry.mutate({
                            id: doc.id,
                            purgeExistingChunks: false,
                          });
                        }}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Redrive
                      </Button>
                    </div>
                  </div>

                  {isOpen && doc.errorTrace && (
                    <pre className="overflow-x-auto border-t border-line bg-surface-950 px-4 py-3 font-mono text-2xs leading-relaxed whitespace-pre-wrap text-surface-300">
                      {doc.errorTrace}
                    </pre>
                  )}
                </div>
              );
            })}
          </Panel>
        )}
      </section>

      {/* ── Run history ── */}
      <section className="space-y-3">
        <SectionLabel>Recent runs</SectionLabel>

        {runsLoading ? (
          <Panel className="space-y-3 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/5" />
          </Panel>
        ) : !runs || runs.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No runs recorded yet"
            description="Upload a document and its ingestion run will appear here with full timing and cost breakdown."
          />
        ) : (
          <Panel className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-50 text-left">
                    {[
                      "Document",
                      "Status",
                      "Latency",
                      "Pages",
                      "Yielded",
                      "Written",
                      "Deduped",
                      "Tokens",
                      "Cost",
                      "Size",
                      "When",
                    ].map((header) => (
                      <th
                        key={header}
                        className="px-3 py-2 font-mono text-2xs font-medium tracking-[0.08em] text-surface-400 uppercase"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {runs.map((run) => (
                    <tr
                      key={run.id}
                      className="transition-colors hover:bg-surface-50"
                    >
                      <td className="max-w-[220px] px-3 py-2">
                        <span className="block truncate text-surface-900">
                          {run.document.title}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <Status tone={RUN_TONE[run.status] ?? "idle"}>
                          {run.status.toLowerCase()}
                        </Status>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-700">
                        {formatDuration(run.latencyMs)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {run.pagesParsed ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {run.chunksYielded ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-700">
                        {run.chunksInserted ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {run.chunksDeduped ?? "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {run.embeddingTokens
                          ? formatNumber(run.embeddingTokens)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {run.embeddingCostUsd
                          ? formatUsd(run.embeddingCostUsd)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular text-surface-500">
                        {formatBytes(run.bytesFetched)}
                      </td>
                      <td className="px-3 py-2 font-mono text-2xs whitespace-nowrap text-surface-400">
                        {relativeTime(run.startedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </section>

      {/* ── Architecture note ── */}
      <section className="space-y-3">
        <SectionLabel>How a run works</SectionLabel>
        <Panel className="p-4">
          <ol className="space-y-2.5 text-sm text-surface-600">
            {[
              ["fetch-and-chunk", "Fetch the PDF, extract text, split, normalise, hash, and validate every chunk against a zod schema."],
              ["embed-and-store", "Each batch is embedded and written inside one step, so vectors never cross a step boundary. Writes use ON CONFLICT DO NOTHING against (documentId, contentHash)."],
              ["finalize", "Count what actually landed, then close the run with latency, yield, and token spend."],
            ].map(([step, detail], index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-surface-100 font-mono text-2xs text-surface-500">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <code className="font-mono text-xs text-surface-900">
                    {step}
                  </code>
                  <span className="ml-2 text-surface-500">{detail}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-start gap-2 border-t border-line pt-3">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-surface-400" />
            <p className="text-xs text-surface-500">
              A failure retries up to three times. Only once the budget is
              exhausted does the document move to{" "}
              <code className="font-mono text-2xs">FAILED</code> — so a transient
              rate limit never surfaces here as a broken document.
            </p>
          </div>
        </Panel>
      </section>
    </div>
  );
}
