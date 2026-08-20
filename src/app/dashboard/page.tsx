"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Brain,
  FileText,
  MessageSquare,
  Upload,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import {
  ButtonLink,
  EmptyState,
  Metric,
  Panel,
  PanelHeader,
  PageHeader,
  SectionLabel,
  Status,
  Tag,
} from "@/components/ui";
import {
  cn,
  formatDuration,
  formatNumber,
  formatUsd,
  relativeTime,
} from "@/lib/utils";

const STATUS_TONE = {
  COMPLETED: "ok",
  PROCESSING: "busy",
  PENDING: "warn",
  FAILED: "err",
} as const;

const STATUS_LABEL = {
  COMPLETED: "indexed",
  PROCESSING: "processing",
  PENDING: "queued",
  FAILED: "failed",
} as const;

export default function DashboardPage() {
  const { data: session } = useSession();
  const enabled = !!session?.user;

  const { data: stats, isLoading } = trpc.document.getStats.useQuery(undefined, {
    enabled,
  });
  const { data: pipeline } = trpc.document.getPipelineStats.useQuery(undefined, {
    enabled,
  });
  const { data: documents } = trpc.document.getAll.useQuery(undefined, {
    enabled,
  });

  const firstName = session?.user?.name?.split(" ")[0];
  const recent = documents?.slice(0, 5) ?? [];
  const failed = stats?.failedCount ?? 0;

  const studyModules =
    (stats?.flashcardDeckCount ?? 0) + (stats?.quizCount ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        description="Your indexed corpus and the health of the pipeline that built it."
        action={
          <ButtonLink href="/dashboard/documents" variant="solid" size="md">
            <Upload className="h-3.5 w-3.5" />
            Upload
          </ButtonLink>
        }
      />

      {/* ── DLQ banner: the only thing allowed to interrupt the page ── */}
      {failed > 0 && (
        <Link
          href="/dashboard/pipeline"
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-err-soft px-4 py-3 transition-colors hover:bg-red-100/60"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-err" strokeWidth={2} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-surface-900">
              {failed} document{failed === 1 ? "" : "s"} failed to ingest
            </p>
            <p className="text-xs text-surface-500">
              Retries were exhausted. Review the error and redrive from the
              pipeline view.
            </p>
          </div>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-surface-400" />
        </Link>
      )}

      {/* ── Corpus ── */}
      <section className="space-y-3">
        <SectionLabel>Corpus</SectionLabel>
        <Panel className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x">
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric
              label="Documents"
              value={formatNumber(stats?.documentCount ?? 0)}
              loading={isLoading}
              hint={
                stats
                  ? `${stats.readyCount} indexed · ${stats.processingCount} in flight`
                  : undefined
              }
            />
          </div>
          <div className="border-b border-line p-4 md:border-b-0">
            <Metric
              label="Chunks indexed"
              value={formatNumber(stats?.chunkCount ?? 0)}
              loading={isLoading}
              hint="Retrievable passages"
            />
          </div>
          <div className="p-4">
            <Metric
              label="Chat sessions"
              value={formatNumber(stats?.chatSessionCount ?? 0)}
              loading={isLoading}
              hint="Grounded conversations"
            />
          </div>
          <div className="p-4">
            <Metric
              label="Study modules"
              value={formatNumber(studyModules)}
              loading={isLoading}
              hint={`${stats?.flashcardDeckCount ?? 0} decks · ${stats?.quizCount ?? 0} quizzes`}
            />
          </div>
        </Panel>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ── Recent documents ── */}
        <section className="space-y-3">
          <SectionLabel
            action={
              <Link
                href="/dashboard/documents"
                className="text-xs text-surface-500 transition-colors hover:text-surface-900"
              >
                View all
              </Link>
            }
          >
            Recent uploads
          </SectionLabel>

          {recent.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload a PDF and Arcus will parse, chunk, embed, and index it for retrieval."
              action={
                <ButtonLink href="/dashboard/documents" variant="solid" size="sm">
                  <Upload className="h-3.5 w-3.5" />
                  Upload a PDF
                </ButtonLink>
              }
            />
          ) : (
            <Panel className="divide-y divide-line">
              {recent.map((doc) => (
                <Link
                  key={doc.id}
                  href="/dashboard/documents"
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-50"
                >
                  <FileText
                    className="h-4 w-4 shrink-0 text-surface-300"
                    strokeWidth={1.75}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-surface-900">
                      {doc.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Status tone={STATUS_TONE[doc.status]}>
                        {STATUS_LABEL[doc.status]}
                      </Status>
                      <span className="text-surface-300">·</span>
                      <span className="font-mono text-2xs tabular text-surface-400">
                        {doc._count.chunks} chunks
                      </span>
                      {doc.pageCount ? (
                        <>
                          <span className="text-surface-300">·</span>
                          <span className="font-mono text-2xs tabular text-surface-400">
                            {doc.pageCount}p
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-2xs text-surface-400">
                    {relativeTime(doc.createdAt)}
                  </span>
                </Link>
              ))}
            </Panel>
          )}
        </section>

        {/* ── Pipeline summary ── */}
        <section className="space-y-3">
          <SectionLabel
            action={
              <Link
                href="/dashboard/pipeline"
                className="text-xs text-surface-500 transition-colors hover:text-surface-900"
              >
                Details
              </Link>
            }
          >
            Pipeline
          </SectionLabel>

          <Panel>
            <PanelHeader
              title="Ingestion health"
              description="Across every run on your documents"
            />
            <div className="grid grid-cols-2 divide-x divide-y divide-line">
              <div className="p-4">
                <Metric
                  label="Runs"
                  value={formatNumber(pipeline?.totalRuns ?? 0)}
                  hint={`${pipeline?.succeeded ?? 0} ok · ${pipeline?.failed ?? 0} failed`}
                  tone={
                    (pipeline?.failed ?? 0) > 0
                      ? "err"
                      : (pipeline?.totalRuns ?? 0) > 0
                        ? "ok"
                        : "idle"
                  }
                />
              </div>
              <div className="p-4">
                <Metric
                  label="p95 latency"
                  value={formatDuration(pipeline?.p95LatencyMs)}
                  hint={`mean ${formatDuration(pipeline?.avgLatencyMs)}`}
                />
              </div>
              <div className="p-4">
                <Metric
                  label="Embed tokens"
                  value={formatNumber(pipeline?.totalTokens ?? 0)}
                  hint="Estimated"
                />
              </div>
              <div className="p-4">
                <Metric
                  label="Est. spend"
                  value={formatUsd(pipeline?.totalCostUsd)}
                  hint={`${formatNumber(pipeline?.totalDeduped ?? 0)} chunks deduped`}
                />
              </div>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-2">
            {[
              {
                href: "/dashboard/chat",
                label: "Ask your documents",
                hint: "Hybrid retrieval · RRF",
                icon: MessageSquare,
              },
              {
                href: "/dashboard/flashcards",
                label: "Flashcards",
                hint: `${stats?.flashcardDeckCount ?? 0} decks`,
                icon: BookOpen,
              },
              {
                href: "/dashboard/quizzes",
                label: "Quizzes",
                hint: `${stats?.quizCount ?? 0} quizzes`,
                icon: Brain,
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "panel panel-interactive group flex items-center gap-3 px-4 py-3"
                )}
              >
                <item.icon
                  className="h-4 w-4 shrink-0 text-surface-400"
                  strokeWidth={1.75}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-surface-900">
                    {item.label}
                  </p>
                  <p className="truncate text-xs text-surface-400">{item.hint}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-surface-300 transition-colors group-hover:text-surface-600" />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* ── How retrieval works: quiet provenance note ── */}
      <section className="space-y-3">
        <SectionLabel>Retrieval</SectionLabel>
        <Panel className="p-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs text-surface-500">
            <Tag mono>pgvector · HNSW</Tag>
            <span className="text-surface-300">+</span>
            <Tag mono>tsvector · GIN</Tag>
            <span className="text-surface-300">→</span>
            <Tag mono>RRF k=60</Tag>
            <span className="ml-1">
              Every question runs a dense and a lexical search, then fuses their
              ranks — so paraphrases and exact terms both land.
            </span>
          </div>
        </Panel>
      </section>
    </div>
  );
}
