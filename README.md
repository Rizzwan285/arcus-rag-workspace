# Arcus — Academic Retrieval Workspace

Upload course material, ask it questions, get answers grounded in the passages
that actually contain them.

Arcus is a full RAG system: a durable ingestion pipeline that turns PDFs into an
indexed corpus, a hybrid retriever that combines dense and lexical search, and a
chat interface that cites what it used. It is built to be operated as much as
used — every ingestion run is measured, and every failure explains itself.

🔗 **[Live demo](https://arcus-rag-workspace.vercel.app)**

---

## Retrieval architecture

Every query runs **two independent searches** and fuses their *ranks*:

| Arm | Mechanism | Index | Catches |
| :--- | :--- | :--- | :--- |
| Dense | `embedding <=> query::vector` (cosine) | HNSW, `vector_cosine_ops` | Paraphrase, conceptual similarity |
| Lexical | `searchVector @@ websearch_to_tsquery(...)` | GIN over a generated `tsvector` | Exact terms — course codes, theorem names, acronyms, notation |

Results are combined with **Reciprocal Rank Fusion**:

```
score(d) = Σ_arms  weight_arm / (k + rank_arm(d))          k = 60
```

Ranks are fused rather than scores because cosine similarity and `ts_rank_cd`
occupy incomparable scales — normalising them into a weighted blend requires
corpus-wide statistics that shift on every ingest. Rank position doesn't, so RRF
stays calibrated for free.

Both arms filter by owner *inside* their own CTE and carry their own `LIMIT`, so
each stays index-driven rather than ranking the full corpus. The whole thing is
one raw SQL statement — see [`src/lib/retrieval/hybrid-search.ts`](src/lib/retrieval/hybrid-search.ts).

**Measured, not assumed.** `eval/` holds a 103-passage labelled corpus and 30
queries; `npm run eval` scores all three configurations through the *same* SQL
statement, with paired-bootstrap confidence intervals. See
**[eval/RESULTS.md](eval/RESULTS.md)**.

The honest result on that corpus: **fusion does not beat the dense arm alone.**

| System | R@1 | R@5 | R@10 | MRR | nDCG@10 |
| :--- | ---: | ---: | ---: | ---: | ---: |
| Vector only | 83.3 | 100.0 | 100.0 | **0.967** | **0.975** |
| Lexical only | 61.7 | 83.3 | 86.7 | 0.748 | 0.776 |
| Hybrid (RRF) | 76.7 | 93.3 | 96.7 | 0.895 | 0.912 |

Hybrid loses 0.072 MRR to pure dense retrieval (95% CI [−0.158, −0.008]), and a
keyword-weight sweep degrades monotonically. The dense arm answered *every*
exact-term query at rank 1, which falsifies the premise that a lexical arm is
needed for course codes and named theorems.

The defaults were left unchanged anyway: tuning them on 30 synthetic queries is
fitting the evaluation set, and the fixture is clean English text while the real
corpus is a PDF with a partly mangled text layer — the one case where exact
string matching may be all that works. Reasoning in **ADR-022**.

Building the harness also exposed a live bug: the lexical arm used
`websearch_to_tsquery`, which joins terms with **AND**, so
*"what is the minimum CGPA required to graduate"* became
`'minimum' & 'cgpa' & 'requir' & 'graduat'` and matched nothing — the passage
states the rule without using the word "graduate". The arm was returning zero
rows for essentially every natural-language question. Switching to a disjunctive
tsquery took it from 36.7% to 61.7% Recall@1 (**ADR-021**).

Performance on the production corpus: 130–170 ms end to end, with
`EXPLAIN ANALYZE` confirming `Index Scan using DocumentChunk_embedding_hnsw_idx`
and `Bitmap Index Scan on DocumentChunk_searchVector_idx`.

The retriever also sets `hnsw.ef_search` and `hnsw.iterative_scan` per query via
`SET LOCAL`, so a per-user filter can't silently shrink an HNSW result set below
the requested `LIMIT`, and falls back cleanly if those GUCs are unavailable.

---

## Ingestion pipeline

Upload → Inngest event → `fetch-and-chunk` → `embed-and-store` (per batch) →
`finalize`. Three properties it is built around:

### Idempotency
Every chunk carries the SHA-256 of its normalised text in
`DocumentChunk.contentHash`, under `@@unique([documentId, contentHash])`. Writes
are `ON CONFLICT ("documentId", "contentHash") DO NOTHING`.

A step that dies after writing half a batch can be retried verbatim — the
database absorbs the repeats. The statement's row count gives the true insert
count for free, and the difference is the dedupe count, so telemetry costs
nothing extra. Text is normalised *before* hashing, so cosmetically different
extractions of the same passage collapse together instead of slipping through as
"new".

### Observability
Each attempt opens an `IngestionRun` row and closes it with latency, per-step
timings, bytes fetched, pages parsed, chunks yielded / rejected / inserted /
deduped, embedding token estimate, call count, and estimated USD. Structured
single-line JSON logs carry the same identifiers.

Metrics in a table are joinable with the documents they describe, which makes
"p95 latency" and "cost per document" one SQL query — `getPipelineStats` uses
`PERCENTILE_CONT`, because a mean hides the tail that matters.

> Token counts are **estimated locally**: Gemini's batch embedding endpoint
> returns no usage metadata. The heuristic and the price live in
> [`src/lib/ingestion/cost.ts`](src/lib/ingestion/cost.ts), behind
> `EMBEDDING_USD_PER_MTOK`, and every surface labels the figure as an estimate.

### Data quality and the DLQ
Zod contracts guard every pipeline boundary — the event payload, each chunk, and
each embedding vector — in
[`src/lib/ingestion/schemas.ts`](src/lib/ingestion/schemas.ts). Chunks are
validated at creation and again after crossing the Inngest step boundary, since
step output round-trips through JSON. Malformed fragments are rejected
individually and counted; a rejection rate above 50% fails the document as
terminal.

`FAILED` means **the retry budget is exhausted**, not that something went wrong
once. It is set from Inngest's `onFailure` hook, never from the handler's catch,
so a transient 429 never surfaces to the user as a broken document. Input that
can never succeed — an unparseable PDF, a malformed event, a document over the
chunk ceiling — throws `NonRetriableError` to skip the budget entirely. Failed
documents keep `failedStep`, `errorMessage`, and `errorTrace` for triage, and are
redriveable from the Pipeline view.

Embeddings never cross an Inngest step boundary: each batch is embedded *and*
written inside a single step, so step output stays a few hundred bytes of
counters rather than megabytes of float arrays.

---

## Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| API | tRPC — end-to-end type safety |
| Database | PostgreSQL on Supabase, Prisma v7 (`@prisma/adapter-pg`) |
| Vector store | pgvector 0.8 · HNSW · `vector_cosine_ops` |
| Lexical index | `GENERATED ALWAYS` tsvector column · GIN |
| Background jobs | Inngest (typed events, retries, concurrency, singleton, DLQ) |
| Chunking | LangChain `RecursiveCharacterTextSplitter` |
| Models | Gemini `gemini-embedding-001` (768d) · Gemini chat via Vercel AI SDK v6 |
| Auth | NextAuth.js (Google + GitHub OAuth) |
| Uploads | UploadThing |
| Styling | Tailwind CSS v4 |

---

## Features

- **Grounded chat** — answers built only from retrieved passages, each showing
  its source document, page, and which retrieval arm found it.
- **Flashcards & quizzes** — generated as structured output from a document's own
  content, with scoring and explanations.
- **Deadline extraction** — tool calls pull dates and syllabus items out of
  documents onto an academic calendar.
- **Pipeline view** — p95 latency, success rate, token spend, dedupe rate, run
  history, and DLQ triage with one-click redrive.

---

## Running locally

### 1. Install

```bash
git clone https://github.com/Rizzwan285/arcus-rag-workspace.git
cd arcus-rag-workspace
npm install --legacy-peer-deps
```

### 2. Environment

Create `.env` in the project root:

```bash
# Postgres — DATABASE_URL is the pooled connection, DIRECT_URL is session mode.
# The Prisma CLI uses DIRECT_URL; the app runtime uses DATABASE_URL.
DATABASE_URL="postgresql://...:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...:5432/postgres"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GITHUB_ID="..."
GITHUB_SECRET="..."

GOOGLE_API_KEY="..."                   # embeddings (REST client)
GOOGLE_GENERATIVE_AI_API_KEY="..."     # chat (@ai-sdk/google)

UPLOADTHING_TOKEN="..."
INNGEST_SIGNING_KEY="..."
INNGEST_EVENT_KEY="..."

# Optional — overrides the embedding price used for cost telemetry.
# EMBEDDING_USD_PER_MTOK="0.15"
```

### 3. Database

```bash
npx prisma generate
npm run db:migrate          # migrate deploy, then verify the raw objects
```

### 4. Run

```bash
npm run dev
npx inngest-cli@latest dev  # second terminal: background job runner
```

---

## Working on the schema

Two objects in this database **cannot be expressed in `schema.prisma`**: the HNSW
index, and the `GENERATED ALWAYS AS (to_tsvector(...)) STORED` expression on
`searchVector`. Prisma diffs the live database against the schema, sees them as
drift, and will emit a `DROP INDEX` / `DROP DEFAULT` into the next generated
migration.

So after running `npx prisma migrate dev`:

1. **Delete** any `DROP INDEX "DocumentChunk_embedding_hnsw_idx"` or
   `ALTER COLUMN "searchVector" DROP DEFAULT` lines from the generated SQL.
2. Run `npm run db:verify` to confirm both objects survived.
3. If either was lost, `npm run db:repair` replays them from
   [`prisma/sql/retrieval-objects.sql`](prisma/sql/retrieval-objects.sql).

### Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run db:migrate` | Apply migrations, then verify the raw retrieval objects |
| `npm run db:verify` | Assert HNSW, GIN, generated column, and unique index exist |
| `npm run db:repair` | Idempotently replay the objects Prisma can't model |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (metrics, query builder, dataset integrity) |
| `npm run eval` | Retrieval benchmark → `eval/RESULTS.md` |
| `npm run eval -- --sweep` | Benchmark plus the keyword-weight sweep |
| `node scripts/list-models.mjs` | List Gemini models this API key can reach |

---

## Design decisions

Every non-obvious choice is recorded with its rationale and the alternatives
considered in [`.claude/decisions.md`](.claude/decisions.md) — including why RRF
over weighted score blending (ADR-015), why the content hash is the idempotency
key (ADR-016), why telemetry lives in a table rather than logs (ADR-017), why
`FAILED` is set on exhausted retries rather than first failure (ADR-018), how the
evaluation harness is constructed (ADR-020), why the lexical arm needs a
disjunctive tsquery (ADR-021), and why the fusion weights were **left alone**
despite the benchmark suggesting a change (ADR-022).
