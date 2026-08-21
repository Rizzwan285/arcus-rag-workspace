/**
 * Retrieval benchmark entry point.
 *
 *   npm run eval              seed, measure, tear down, write eval/RESULTS.md
 *   npm run eval -- --keep    leave the fixture in place for manual inspection
 *
 * Exits non-zero on failure so it can gate CI.
 */

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import {
  aggregate,
  pairedBootstrap,
  scoreQuery,
  type PerQueryScores,
} from "../src/lib/retrieval/metrics";
import { EVAL_CORPUS } from "./dataset/corpus";
import { EVAL_QUERIES, type QueryCategory } from "./dataset/queries";
import { embedAll } from "./embeddings";
import {
  acquireLock,
  connect,
  passageIdForChunk,
  releaseLock,
  search,
  seed,
  teardown,
} from "./harness";
import {
  renderReport,
  SYSTEM_LABEL,
  type RunSummary,
  type SystemName,
} from "./report";
import {
  DEFAULT_CANDIDATE_POOL,
  DEFAULT_RRF_K,
} from "../src/lib/retrieval/query";

const SYSTEMS: SystemName[] = ["vector", "keyword", "hybrid"];
const RETRIEVAL_DEPTH = 10;

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[index];
}

async function main(): Promise<void> {
  const keepFixture = process.argv.includes("--keep");

  console.log("Arcus retrieval benchmark");
  console.log(
    `  corpus ${EVAL_CORPUS.length} passages · ${EVAL_QUERIES.length} queries · top ${RETRIEVAL_DEPTH}\n`,
  );

  // ── Embeddings (cached across runs) ────────────────────────────────
  process.stdout.write("Embedding corpus… ");
  const corpusEmbeddings = await embedAll(
    EVAL_CORPUS.map((p) => p.text),
    "RETRIEVAL_DOCUMENT",
  );
  console.log(
    `${corpusEmbeddings.cacheHits} cached, ${corpusEmbeddings.apiCalls} API call(s)`,
  );

  process.stdout.write("Embedding queries… ");
  const queryEmbeddings = await embedAll(
    EVAL_QUERIES.map((q) => q.text),
    "RETRIEVAL_QUERY",
  );
  console.log(
    `${queryEmbeddings.cacheHits} cached, ${queryEmbeddings.apiCalls} API call(s)`,
  );

  let client: Client | undefined;
  try {
    client = await connect();
    await acquireLock(client);

    process.stdout.write("Seeding fixture… ");
    const seeded = await seed(client, corpusEmbeddings.vectors);
    console.log(`${seeded.chunks} chunks across ${seeded.documents} documents\n`);

    // ── Run every system over every query ───────────────────────────
    const perQuery: Record<SystemName, PerQueryScores[]> = {
      vector: [],
      keyword: [],
      hybrid: [],
    };
    const latencies: Record<SystemName, number[]> = {
      vector: [],
      keyword: [],
      hybrid: [],
    };
    const perQueryByCategory: Record<
      QueryCategory,
      Record<SystemName, PerQueryScores[]>
    > = {
      paraphrase: { vector: [], keyword: [], hybrid: [] },
      "exact-term": { vector: [], keyword: [], hybrid: [] },
      mixed: { vector: [], keyword: [], hybrid: [] },
    };

    for (const query of EVAL_QUERIES) {
      const embedding = queryEmbeddings.vectors.get(query.text);
      if (!embedding) throw new Error(`Missing embedding for query ${query.id}`);

      for (const mode of SYSTEMS) {
        const { chunks, latencyMs } = await search(client, {
          mode,
          limit: RETRIEVAL_DEPTH,
          queryText: query.text,
          queryEmbedding: embedding,
        });

        const ranked = chunks
          .map((chunk) => passageIdForChunk(chunk.id))
          .filter((id): id is string => id !== null);

        const scores = scoreQuery({
          queryId: query.id,
          ranked,
          relevant: new Set(query.relevant),
        });

        perQuery[mode].push(scores);
        perQueryByCategory[query.category][mode].push(scores);
        latencies[mode].push(latencyMs);
      }
    }

    // ── Aggregate ───────────────────────────────────────────────────
    const overall = {
      vector: aggregate(perQuery.vector),
      keyword: aggregate(perQuery.keyword),
      hybrid: aggregate(perQuery.hybrid),
    };

    const byCategory = {
      paraphrase: {
        vector: aggregate(perQueryByCategory.paraphrase.vector),
        keyword: aggregate(perQueryByCategory.paraphrase.keyword),
        hybrid: aggregate(perQueryByCategory.paraphrase.hybrid),
      },
      "exact-term": {
        vector: aggregate(perQueryByCategory["exact-term"].vector),
        keyword: aggregate(perQueryByCategory["exact-term"].keyword),
        hybrid: aggregate(perQueryByCategory["exact-term"].hybrid),
      },
      mixed: {
        vector: aggregate(perQueryByCategory.mixed.vector),
        keyword: aggregate(perQueryByCategory.mixed.keyword),
        hybrid: aggregate(perQueryByCategory.mixed.hybrid),
      },
    };

    // ── Paired significance tests ───────────────────────────────────
    const comparisons = [
      {
        label: "Hybrid − Vector",
        metric: "MRR",
        result: pairedBootstrap(
          perQuery.hybrid.map((s) => s.reciprocalRank),
          perQuery.vector.map((s) => s.reciprocalRank),
        ),
      },
      {
        label: "Hybrid − Vector",
        metric: "Recall@10",
        result: pairedBootstrap(
          perQuery.hybrid.map((s) => s.recallAt10),
          perQuery.vector.map((s) => s.recallAt10),
        ),
      },
      {
        label: "Hybrid − Lexical",
        metric: "MRR",
        result: pairedBootstrap(
          perQuery.hybrid.map((s) => s.reciprocalRank),
          perQuery.keyword.map((s) => s.reciprocalRank),
        ),
      },
      {
        label: "Hybrid − Lexical",
        metric: "Recall@10",
        result: pairedBootstrap(
          perQuery.hybrid.map((s) => s.recallAt10),
          perQuery.keyword.map((s) => s.recallAt10),
        ),
      },
      {
        label: "Hybrid − Vector",
        metric: "nDCG@10",
        result: pairedBootstrap(
          perQuery.hybrid.map((s) => s.ndcgAt10),
          perQuery.vector.map((s) => s.ndcgAt10),
        ),
      },
    ];

    const summary: RunSummary = {
      overall,
      byCategory,
      comparisons,
      latencyMs: {
        vector: {
          median: percentile(latencies.vector, 0.5),
          p95: percentile(latencies.vector, 0.95),
        },
        keyword: {
          median: percentile(latencies.keyword, 0.5),
          p95: percentile(latencies.keyword, 0.95),
        },
        hybrid: {
          median: percentile(latencies.hybrid, 0.5),
          p95: percentile(latencies.hybrid, 0.95),
        },
      },
      meta: {
        ranAt: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC",
        corpusSize: EVAL_CORPUS.length,
        queryCount: EVAL_QUERIES.length,
        limit: RETRIEVAL_DEPTH,
        rrfK: DEFAULT_RRF_K,
        candidatePool: DEFAULT_CANDIDATE_POOL,
        embeddingModel: "gemini-embedding-001",
        apiCalls: corpusEmbeddings.apiCalls + queryEmbeddings.apiCalls,
        cacheHits: corpusEmbeddings.cacheHits + queryEmbeddings.cacheHits,
      },
    };

    // ── Console summary ─────────────────────────────────────────────
    console.log("Overall");
    console.log(
      "  system         R@1    R@5    R@10   MRR    nDCG@10",
    );
    for (const system of SYSTEMS) {
      const s = overall[system];
      console.log(
        `  ${SYSTEM_LABEL[system].padEnd(14)} ` +
          `${(s.recallAt1 * 100).toFixed(1).padStart(5)}  ` +
          `${(s.recallAt5 * 100).toFixed(1).padStart(5)}  ` +
          `${(s.recallAt10 * 100).toFixed(1).padStart(5)}  ` +
          `${s.mrr.toFixed(3)}  ${s.ndcgAt10.toFixed(3)}`,
      );
    }

    console.log("\nSignificance (paired bootstrap, 95% CI)");
    for (const c of comparisons) {
      const [lo, hi] = c.result.ci95;
      console.log(
        `  ${c.label} on ${c.metric.padEnd(10)} ` +
          `Δ=${c.result.meanDelta >= 0 ? "+" : ""}${c.result.meanDelta.toFixed(3)} ` +
          `CI=[${lo.toFixed(3)}, ${hi.toFixed(3)}] ` +
          `${c.result.significant ? "significant" : "not significant"}`,
      );
    }

    // ── Exploratory: how does the fused ranking respond to arm weight? ──
    // NOT validation. Choosing a weight by its score on this set would be
    // fitting 30 queries; the sweep only shows the shape of the trade-off.
    const sweep: RunSummary["sweep"] = [];
    if (process.argv.includes("--sweep")) {
      console.log("\nKeyword-weight sweep (exploratory)");
      for (const keywordWeight of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
        const scores: PerQueryScores[] = [];
        for (const query of EVAL_QUERIES) {
          const embedding = queryEmbeddings.vectors.get(query.text)!;
          const { chunks } = await search(client, {
            mode: "hybrid",
            limit: RETRIEVAL_DEPTH,
            queryText: query.text,
            queryEmbedding: embedding,
            keywordWeight,
          });
          const ranked = chunks
            .map((chunk) => passageIdForChunk(chunk.id))
            .filter((id): id is string => id !== null);
          scores.push(
            scoreQuery({
              queryId: query.id,
              ranked,
              relevant: new Set(query.relevant),
            }),
          );
        }
        const agg = aggregate(scores);
        sweep.push({ keywordWeight, scores: agg });
        console.log(
          `  w=${keywordWeight.toFixed(2)}  ` +
            `R@1 ${(agg.recallAt1 * 100).toFixed(1).padStart(5)}  ` +
            `R@10 ${(agg.recallAt10 * 100).toFixed(1).padStart(5)}  ` +
            `MRR ${agg.mrr.toFixed(3)}  nDCG@10 ${agg.ndcgAt10.toFixed(3)}`,
        );
      }
    }

    summary.sweep = sweep;

    const outputPath = join(process.cwd(), "eval", "RESULTS.md");
    writeFileSync(outputPath, renderReport(summary));
    writeFileSync(
      join(process.cwd(), "eval", "results.json"),
      JSON.stringify(summary, null, 2),
    );
    console.log(`\nWrote eval/RESULTS.md and eval/results.json`);
  } finally {
    if (client) {
      if (keepFixture) {
        console.log("\n--keep: fixture left in place. Re-run to clean it up.");
      } else {
        await teardown(client);
        console.log("Fixture removed.");
      }
      await releaseLock(client).catch(() => {
        // The lock dies with the session anyway; never mask the real error.
      });
      await client.end();
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "\nBenchmark failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
