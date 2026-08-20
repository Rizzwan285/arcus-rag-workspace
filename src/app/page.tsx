import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
  Database,
  FileSearch,
  GitBranch,
  Layers,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Grounded chat",
    body: "Answers are constructed only from retrieved passages, with the source document and page attached to every claim.",
  },
  {
    icon: BookOpen,
    title: "Flashcards",
    body: "Decks generated from a document's own content as structured output, not free-form prose.",
  },
  {
    icon: Brain,
    title: "Quizzes",
    body: "Multiple-choice sets with explanations, scored in place and saved back to your workspace.",
  },
  {
    icon: CalendarDays,
    title: "Deadline extraction",
    body: "Tool calls pull dates and syllabus items out of documents and onto an academic calendar.",
  },
];

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Idempotent writes",
    body: "Every chunk is keyed by the SHA-256 of its text under a unique constraint. A retried job re-inserts the same rows and the database absorbs them — a half-finished run can be replayed verbatim.",
  },
  {
    icon: GitBranch,
    title: "Dead letter queue",
    body: "FAILED means the retry budget is exhausted, not that something went wrong once. Terminal input skips retries entirely; everything else is redriveable from the UI with its error trace intact.",
  },
  {
    icon: Layers,
    title: "Run telemetry",
    body: "Each attempt records latency, per-step timings, chunk yield, dedupe count, and estimated token spend — so p95 latency and cost per document are one SQL query away.",
  },
];

const stack = [
  ["Framework", "Next.js (App Router) · React · TypeScript"],
  ["API", "tRPC · end-to-end type safety"],
  ["Database", "PostgreSQL on Supabase · Prisma ORM"],
  ["Vector store", "pgvector · HNSW · vector_cosine_ops"],
  ["Lexical index", "tsvector generated column · GIN"],
  ["Ingestion", "Inngest · LangChain splitters · zod contracts"],
  ["Models", "Gemini embeddings · Gemini chat"],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-0">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 border-b border-line bg-surface-0/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-900 font-mono text-sm font-bold text-white">
              A
            </span>
            <span className="text-sm font-semibold tracking-tight text-surface-900">
              Arcus
            </span>
          </div>

          <div className="hidden items-center gap-7 md:flex">
            {[
              ["Retrieval", "#retrieval"],
              ["Pipeline", "#pipeline"],
              ["Stack", "#stack"],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="text-sm text-surface-500 transition-colors hover:text-surface-900"
              >
                {label}
              </a>
            ))}
          </div>

          <Link
            href="/dashboard"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-surface-900 px-3.5 text-sm font-medium text-white transition-colors hover:bg-surface-800"
          >
            Open workspace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1080px] px-6 py-20 md:py-28">
          <p className="mb-5 font-mono text-2xs tracking-[0.14em] text-surface-400 uppercase">
            Academic retrieval workspace
          </p>

          <h1 className="max-w-3xl text-4xl leading-[1.08] text-surface-900 md:text-6xl">
            Ask your course material
            <br />
            <span className="text-surface-400">and get sourced answers.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-surface-500">
            Arcus indexes your PDFs for hybrid retrieval — dense vector search
            and PostgreSQL full-text search, fused by rank — then answers only
            from what it actually found.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-surface-900 px-5 text-base font-medium text-white transition-colors hover:bg-surface-800"
            >
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#retrieval"
              className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong px-5 text-base font-medium text-surface-700 transition-colors hover:bg-surface-50"
            >
              How retrieval works
            </a>
          </div>

          {/* System line — the stack, stated plainly rather than claimed. */}
          <div className="mt-14 flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-line pt-5 font-mono text-2xs text-surface-400">
            {[
              "pgvector/HNSW",
              "tsvector/GIN",
              "RRF k=60",
              "SHA-256 idempotency",
              "Inngest DLQ",
              "run telemetry",
            ].map((item, index) => (
              <span key={item} className="flex items-center gap-2">
                {index > 0 && <span className="text-surface-300">·</span>}
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Retrieval ── */}
      <section id="retrieval" className="border-b border-line">
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <p className="mb-3 font-mono text-2xs tracking-[0.14em] text-surface-400 uppercase">
            Retrieval
          </p>
          <h2 className="max-w-2xl text-3xl text-surface-900">
            Two searches, fused by rank
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-surface-500">
            Embeddings are good at paraphrase and bad at exact tokens — course
            codes, theorem names, notation. Full-text search is the reverse.
            Arcus runs both on every question and combines them with Reciprocal
            Rank Fusion, so neither weakness reaches your answer.
          </p>

          {/* Fusion diagram */}
          <div className="mt-12 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
            <div className="panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <Database className="h-4 w-4 text-surface-400" strokeWidth={1.75} />
                <h3 className="text-sm font-semibold text-surface-900">
                  Dense arm
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-surface-500">
                Cosine distance over 768-dimensional Gemini embeddings, served
                by an HNSW index. Finds passages that mean the same thing in
                different words.
              </p>
              <div className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-2xs text-surface-400">
                <p>embedding &lt;=&gt; query::vector</p>
                <p>USING hnsw (vector_cosine_ops)</p>
              </div>
            </div>

            <div className="flex items-center justify-center px-2">
              <div className="flex h-full flex-col items-center justify-center gap-2">
                <div className="hidden h-full w-px bg-line md:block" />
                <span className="rounded-md border border-line bg-surface-50 px-2.5 py-1 font-mono text-2xs whitespace-nowrap text-surface-600">
                  RRF · k=60
                </span>
                <div className="hidden h-full w-px bg-line md:block" />
              </div>
            </div>

            <div className="panel p-5">
              <div className="mb-3 flex items-center gap-2">
                <FileSearch
                  className="h-4 w-4 text-surface-400"
                  strokeWidth={1.75}
                />
                <h3 className="text-sm font-semibold text-surface-900">
                  Lexical arm
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-surface-500">
                PostgreSQL full-text search over a generated tsvector column,
                served by a GIN index. Finds the exact term you typed, even when
                the embedding blurs it.
              </p>
              <div className="mt-4 space-y-1 border-t border-line pt-3 font-mono text-2xs text-surface-400">
                <p>searchVector @@ websearch_to_tsquery(...)</p>
                <p>USING gin (&quot;searchVector&quot;)</p>
              </div>
            </div>
          </div>

          <div className="panel mt-4 p-5">
            <p className="font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase">
              Fusion
            </p>
            <p className="mt-3 font-mono text-sm text-surface-800">
              score(d) = Σ<sub className="text-surface-400">arms</sub> weight ÷
              (k + rank<sub className="text-surface-400">arm</sub>(d))
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-surface-500">
              Cosine similarity and <code className="font-mono">ts_rank_cd</code>{" "}
              live on incomparable scales, so blending their scores needs
              constant recalibration. Rank position doesn&apos;t — which is why
              RRF stays honest as the corpus grows. A passage both arms rank
              moderately well beats one that a single arm ranks first.
            </p>
          </div>
        </div>
      </section>

      {/* ── Pipeline ── */}
      <section id="pipeline" className="border-b border-line bg-surface-50">
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <p className="mb-3 font-mono text-2xs tracking-[0.14em] text-surface-400 uppercase">
            Ingestion
          </p>
          <h2 className="max-w-2xl text-3xl text-surface-900">
            A pipeline you can inspect
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-surface-500">
            Upload triggers a durable background job: fetch, parse, chunk,
            validate, embed, upsert. Every stage is measured, and every failure
            is either retried or explained.
          </p>

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {guarantees.map((item) => (
              <div key={item.title} className="bg-surface-0 p-5">
                <item.icon
                  className="mb-3 h-4 w-4 text-surface-400"
                  strokeWidth={1.75}
                />
                <h3 className="text-sm font-semibold text-surface-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-500">
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          {/* Step trace */}
          <div className="panel mt-4 divide-y divide-line">
            {[
              ["01", "fetch-and-chunk", "Parse the PDF, split it, normalise whitespace, hash each chunk, and validate against a zod schema. Malformed fragments are rejected individually and counted."],
              ["02", "embed-and-store", "Each batch is embedded and written inside a single step, so vectors never cross a step boundary. Writes are ON CONFLICT DO NOTHING."],
              ["03", "finalize", "Count what actually landed, then close the run with latency, yield, dedupe count, and token spend."],
            ].map(([number, step, detail]) => (
              <div key={step} className="flex gap-4 p-4">
                <span className="font-mono text-2xs text-surface-300">
                  {number}
                </span>
                <div className="min-w-0">
                  <code className="font-mono text-sm text-surface-900">
                    {step}
                  </code>
                  <p className="mt-1 text-sm leading-relaxed text-surface-500">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <p className="mb-3 font-mono text-2xs tracking-[0.14em] text-surface-400 uppercase">
            Workspace
          </p>
          <h2 className="max-w-2xl text-3xl text-surface-900">
            What you can do with an indexed document
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {capabilities.map((item) => (
              <div key={item.title} className="bg-surface-0 p-6">
                <item.icon
                  className="mb-3 h-4 w-4 text-surface-400"
                  strokeWidth={1.75}
                />
                <h3 className="text-sm font-semibold text-surface-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-surface-500">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stack ── */}
      <section id="stack" className="border-b border-line">
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <p className="mb-3 font-mono text-2xs tracking-[0.14em] text-surface-400 uppercase">
            Stack
          </p>
          <h2 className="text-3xl text-surface-900">Built on</h2>

          <dl className="mt-10 max-w-2xl">
            {stack.map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-1 border-b border-line py-3 sm:flex-row sm:items-baseline sm:gap-6"
              >
                <dt className="w-36 shrink-0 font-mono text-2xs tracking-[0.1em] text-surface-400 uppercase">
                  {label}
                </dt>
                <dd className="text-sm text-surface-700">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Close ── */}
      <section>
        <div className="mx-auto max-w-[1080px] px-6 py-20">
          <h2 className="max-w-xl text-3xl text-surface-900">
            Upload a PDF and ask it something.
          </h2>
          <Link
            href="/dashboard"
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-md bg-surface-900 px-5 text-base font-medium text-white transition-colors hover:bg-surface-800"
          >
            Open workspace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-6 py-7">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-surface-900 font-mono text-2xs font-bold text-white">
              A
            </span>
            <span className="font-mono text-2xs text-surface-400">
              Arcus — academic retrieval workspace
            </span>
          </div>
          <Link
            href="/dashboard"
            className="font-mono text-2xs text-surface-400 transition-colors hover:text-surface-900"
          >
            Open workspace →
          </Link>
        </div>
      </footer>
    </div>
  );
}
