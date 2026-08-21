# Retrieval Benchmark Results

_Generated 2026-08-20 19:52 UTC by `npm run eval`._

Compares three retrieval configurations over a labelled fixture corpus:
the dense (pgvector/HNSW) arm alone, the lexical (tsvector/GIN) arm alone, and
Reciprocal Rank Fusion over both. All three run through the **same SQL
statement** — the arms are ablated with query parameters, so any difference is
attributable to fusion rather than to a difference in implementation.

## Setup

| | |
| :--- | :--- |
| Corpus | 103 passages across 4 synthetic course documents |
| Queries | 30, hand-labelled, balanced across 3 categories |
| Retrieval depth | top 10, candidate pool 40 per arm |
| RRF constant | k = 60 (untuned — the published default) |
| Embeddings | `gemini-embedding-001`, 768d, asymmetric task types |
| Embedding calls this run | 0 (133 served from cache) |

## Headline

On this corpus, **fusion does not beat the dense arm alone** — it loses
0.072 MRR against it, and the
paired bootstrap puts that difference outside the noise floor. The dense arm
answers 100.0% of queries within the top 10 on its own,
including every exact-term query, so the lexical arm has nothing left to
contribute and its weaker ranking drags the fused order down.

This contradicts the assumption the retriever was built on. It is reported here
rather than buried because it is the finding, and because the conditions that
would change it — a corpus the embedding model handles badly, which is exactly
what the production PDF is — are listed under threats to validity below.

## Overall

| System | R@1 | R@5 | R@10 | MRR | nDCG@10 | Hit@10 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vector only | 83.3 | 100.0 | 100.0 | 0.967 | 0.975 | 100.0 |
| Lexical only | 61.7 | 83.3 | 86.7 | 0.748 | 0.776 | 86.7 |
| Hybrid (RRF) | 76.7 | 93.3 | 96.7 | 0.895 | 0.912 | 96.7 |

Best per column: R@1 → **Vector only**, R@5 → **Vector only**, R@10 → **Vector only**, MRR → **Vector only**, nDCG@10 → **Vector only**.

## By query category

### paraphrase

Conceptual phrasing with little vocabulary overlap. The dense arm is expected to carry these.

| System | R@1 | R@5 | R@10 | MRR | nDCG@10 | Hit@10 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vector only | 80.0 | 100.0 | 100.0 | 0.900 | 0.926 | 100.0 |
| Lexical only | 20.0 | 60.0 | 60.0 | 0.328 | 0.395 | 60.0 |
| Hybrid (RRF) | 60.0 | 80.0 | 90.0 | 0.685 | 0.735 | 90.0 |

### exact-term

Course codes, named theorems, acronyms. The lexical arm is expected to carry these.

| System | R@1 | R@5 | R@10 | MRR | nDCG@10 | Hit@10 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vector only | 100.0 | 100.0 | 100.0 | 1.000 | 1.000 | 100.0 |
| Lexical only | 100.0 | 100.0 | 100.0 | 1.000 | 1.000 | 100.0 |
| Hybrid (RRF) | 100.0 | 100.0 | 100.0 | 1.000 | 1.000 | 100.0 |

### mixed

A natural question that also carries a distinctive term. Fusion is expected to help.

| System | R@1 | R@5 | R@10 | MRR | nDCG@10 | Hit@10 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| Vector only | 70.0 | 100.0 | 100.0 | 1.000 | 1.000 | 100.0 |
| Lexical only | 65.0 | 90.0 | 100.0 | 0.914 | 0.932 | 100.0 |
| Hybrid (RRF) | 70.0 | 100.0 | 100.0 | 1.000 | 1.000 | 100.0 |

## Significance

Paired bootstrap over per-query deltas, 10,000 resamples, seed 42. The
win/loss/tie column counts queries, not magnitude. An interval that straddles
zero means the query set is too small to separate the systems on that metric —
which is the honest reading, not a hedge.

| Comparison | Metric | Mean Δ | 95% CI | W/L/T | Verdict |
| :--- | :--- | ---: | :--- | :--- | :--- |
| Hybrid − Vector | MRR | -0.072 | [-0.158, -0.008] | 0/4/26 | **significant loss** |
| Hybrid − Vector | Recall@10 | -0.033 | [-0.100, 0.000] | 0/1/29 | not significant |
| Hybrid − Lexical | MRR | +0.147 | [0.057, 0.252] | 8/0/22 | **significant gain** |
| Hybrid − Lexical | Recall@10 | +0.100 | [0.000, 0.200] | 3/0/27 | not significant |
| Hybrid − Vector | nDCG@10 | -0.064 | [-0.147, -0.007] | 0/4/26 | **significant loss** |

## Latency

Wall-clock time for the SQL statement only, excluding query embedding
(which is cached and identical across systems).

| System | Median | p95 |
| :--- | ---: | ---: |
| Vector only | 640 ms | 676 ms |
| Lexical only | 640 ms | 659 ms |
| Hybrid (RRF) | 642 ms | 656 ms |

## Keyword-weight sweep (exploratory)

How the fused ranking responds as the lexical arm's RRF weight falls. **This is
not validation.** Picking a weight by its score here would be fitting 30
queries; the sweep only shows the shape of the trade-off, and any change to the
shipped default needs a held-out set.

| Keyword weight | R@1 | R@5 | R@10 | MRR | nDCG@10 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.00 | 83.3 | 100.0 | 100.0 | 0.967 | 0.975 |
| 0.10 | 80.0 | 100.0 | 100.0 | 0.939 | 0.954 |
| 0.25 | 80.0 | 93.3 | 100.0 | 0.926 | 0.943 |
| 0.50 | 80.0 | 93.3 | 96.7 | 0.920 | 0.931 |
| 0.75 | 76.7 | 93.3 | 96.7 | 0.898 | 0.914 |
| 1.00 | 76.7 | 93.3 | 96.7 | 0.895 | 0.912 |

## How to read this

**Recall@k** is the fraction of a query's relevant passages inside the top k. It
is capped by `k / |relevant|`, so a query with two relevant passages has a
Recall@1 ceiling of 0.5 — the number is not broken. **Hit@10** is the softer
"did anything relevant land in the top 10". **MRR** is the mean reciprocal rank
of the *first* relevant passage. **nDCG@10** is the only metric here that is
sensitive to ordering within the top k.

## Threats to validity

1. **The corpus and the labels share an author.** The passages, the queries, and
   the relevance judgements were all written by the same party, which is the
   dominant limitation. Categories were assigned before any retrieval ran, and
   per-category results are reported so a failed prediction stays visible.
2. **The corpus is synthetic and small** (103 passages). Absolute
   numbers would move on a real corpus at production scale. What transfers is the
   *relative* behaviour of the arms on each query type.
3. **This measures ranking, not index recall.** At 103 rows the
   planner may not choose the HNSW index at all, so approximate-nearest-neighbour
   recall is not under test here. Index usage is verified separately by
   `npm run db:verify` and by `EXPLAIN ANALYZE` on the production corpus.
4. **Single embedding model.** Results are specific to `gemini-embedding-001`
   with asymmetric task types.
