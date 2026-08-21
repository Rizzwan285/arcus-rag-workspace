/**
 * Labelled query set.
 *
 * HOW THIS WAS BUILT — and its limitations
 * The corpus was written first, then these queries were written as a student
 * would phrase them, then relevance was judged by hand. The same author
 * produced all three, which is the principal threat to validity: the labeller
 * knew the corpus. Two things mitigate it, neither completely:
 *
 *   1. Queries are assigned to a category *before* any retrieval was run, and
 *      the category predicts which arm should win. Results are reported per
 *      category, so a category where the prediction fails is visible rather
 *      than averaged away.
 *   2. No retrieval parameter was tuned against these results. `k = 60`, the
 *      candidate pool, and the arm weights are all at their shipped defaults.
 *
 * This is a *diagnostic* benchmark — it characterises where each arm wins on a
 * corpus with known structure. It is not evidence about general-purpose
 * retrieval quality, and the absolute numbers should not be quoted as such.
 *
 * @see ADR-020 in .claude/decisions.md
 */

/**
 * - `paraphrase` — conceptual phrasing with little vocabulary overlap with the
 *   passage. The dense arm is expected to win.
 * - `exact-term`  — a course code, named theorem, or acronym. The lexical arm is
 *   expected to win.
 * - `mixed`       — a natural question that also carries a distinctive term.
 *   Fusion is expected to help.
 */
export type QueryCategory = "paraphrase" | "exact-term" | "mixed";

export interface EvalQuery {
  id: string;
  text: string;
  category: QueryCategory;
  /** Passage ids judged relevant. Never empty. */
  relevant: string[];
  /** Why these passages, recorded so a judgement can be argued with. */
  rationale: string;
}

export const EVAL_QUERIES: EvalQuery[] = [
  // ── Paraphrase: conceptual, low lexical overlap ─────────────────────
  {
    id: "p01",
    text: "my model does very well on examples it has already seen but badly on new ones",
    category: "paraphrase",
    relevant: ["ml-04"],
    rationale: "Describes overfitting without using the word.",
  },
  {
    id: "p02",
    text: "what happens to a tree when you feed it values that are already in order",
    category: "paraphrase",
    relevant: ["dsa-12"],
    rationale: "The degenerate BST passage; 'sorted' appears there but the query says 'already in order'.",
  },
  {
    id: "p03",
    text: "finding the cheapest route through a network where each road has a different cost",
    category: "paraphrase",
    relevant: ["dsa-25"],
    rationale: "Dijkstra, described without naming it. dsa-24 is the unweighted distractor.",
  },
  {
    id: "p04",
    text: "squeezing many columns down to just a few while keeping most of the variation",
    category: "paraphrase",
    relevant: ["ml-24"],
    rationale: "PCA, described by effect rather than name.",
  },
  {
    id: "p05",
    text: "when two directions meet at a right angle",
    category: "paraphrase",
    relevant: ["lin-18"],
    rationale: "Orthogonality. The passage says 'right angle', so some lexical overlap exists.",
  },
  {
    id: "p06",
    text: "the penalty that makes some weights vanish completely so only a few features matter",
    category: "paraphrase",
    relevant: ["ml-08"],
    rationale: "L1/lasso sparsity. ml-07 (ridge) is the near-neighbour distractor.",
  },
  {
    id: "p07",
    text: "picking one element to divide the list around, then repeating on both halves",
    category: "paraphrase",
    relevant: ["dsa-18"],
    rationale: "Quicksort partitioning without the word 'pivot' or 'quicksort'.",
  },
  {
    id: "p08",
    text: "a container where the most urgent item always comes out first",
    category: "paraphrase",
    relevant: ["dsa-16"],
    rationale: "Heap / priority queue. dsa-06 and dsa-07 are stack/queue distractors.",
  },
  {
    id: "p09",
    text: "why the order you apply two transformations changes the result",
    category: "paraphrase",
    relevant: ["lin-08"],
    rationale: "Non-commutativity of matrix multiplication.",
  },
  {
    id: "p10",
    text: "the classifier looks accurate but it is really just always guessing the common answer",
    category: "paraphrase",
    relevant: ["ml-28"],
    rationale: "Class imbalance. ml-25 (precision/recall) is a near neighbour.",
  },

  // ── Exact term: codes, named results, acronyms ──────────────────────
  {
    id: "e01",
    text: "rank-nullity theorem",
    category: "exact-term",
    relevant: ["lin-05"],
    rationale: "Named theorem appearing in exactly one passage.",
  },
  {
    id: "e02",
    text: "Gram-Schmidt",
    category: "exact-term",
    relevant: ["lin-19"],
    rationale: "Proper noun; lin-20 (QR) is the topical neighbour.",
  },
  {
    id: "e03",
    text: "Bellman-Ford",
    category: "exact-term",
    relevant: ["dsa-26"],
    rationale: "Named algorithm; dsa-25 (Dijkstra) is the neighbour.",
  },
  {
    id: "e04",
    text: "Cauchy-Schwarz inequality",
    category: "exact-term",
    relevant: ["lin-24"],
    rationale: "Named inequality; lin-25 (norms) is the neighbour.",
  },
  {
    id: "e05",
    text: "LU decomposition",
    category: "exact-term",
    relevant: ["lin-13"],
    rationale: "Named factorisation; lin-20 (QR) and lin-23 (SVD) are neighbours.",
  },
  {
    id: "e06",
    text: "ROC AUC",
    category: "exact-term",
    relevant: ["ml-27"],
    rationale: "Acronym pair that embeddings tend to blur into general metric talk.",
  },
  {
    id: "e07",
    text: "CS2010",
    category: "exact-term",
    relevant: ["hb-08"],
    rationale: "Course code. Appears only in the code-scheme passage; a dense model has little to grip.",
  },
  {
    id: "e08",
    text: "Gini index",
    category: "exact-term",
    relevant: ["ml-17"],
    rationale: "Named impurity measure inside the decision tree passage.",
  },
  {
    id: "e09",
    text: "union-find path compression",
    category: "exact-term",
    relevant: ["dsa-28"],
    rationale: "Named structure; dsa-29 (Prim) is the MST neighbour.",
  },
  {
    id: "e10",
    text: "softmax numerical overflow",
    category: "exact-term",
    relevant: ["ml-16"],
    rationale: "dsa-06 mentions 'stack overflow', a deliberate lexical trap.",
  },

  // ── Mixed: natural question carrying a distinctive term ─────────────
  {
    id: "m01",
    text: "what is the minimum CGPA required to graduate",
    category: "mixed",
    relevant: ["hb-05", "hb-18"],
    rationale: "hb-05 states the threshold; hb-18 restates it as a convocation condition.",
  },
  {
    id: "m02",
    text: "can Dijkstra handle negative edge weights",
    category: "mixed",
    relevant: ["dsa-25", "dsa-26"],
    rationale: "dsa-25 states the non-negativity assumption; dsa-26 is the algorithm that lifts it.",
  },
  {
    id: "m03",
    text: "explain the kernel trick used in a support vector machine",
    category: "mixed",
    relevant: ["ml-21", "ml-20"],
    rationale: "ml-21 is the kernel trick itself; ml-20 defines the SVM it applies to.",
  },
  {
    id: "m04",
    text: "how many credits do open electives contribute to the degree",
    category: "mixed",
    relevant: ["hb-04", "hb-01"],
    rationale: "hb-04 gives the figure; hb-01 gives the total it sits within.",
  },
  {
    id: "m05",
    text: "when should I use L1 instead of L2 regularisation",
    category: "mixed",
    relevant: ["ml-08", "ml-07"],
    rationale: "Answering the comparison needs both passages.",
  },
  {
    id: "m06",
    text: "what does the spectral theorem say about symmetric matrices",
    category: "mixed",
    relevant: ["lin-17"],
    rationale: "Named theorem inside a natural question.",
  },
  {
    id: "m07",
    text: "why is mergesort stable but quicksort is not",
    category: "mixed",
    relevant: ["dsa-20"],
    rationale: "One passage addresses the comparison directly.",
  },
  {
    id: "m08",
    text: "how does k-fold cross validation give a better estimate than one split",
    category: "mixed",
    relevant: ["ml-03", "ml-02"],
    rationale: "ml-03 is k-fold; ml-02 is the single split it is being compared against.",
  },
  {
    id: "m09",
    text: "what attendance percentage is required to sit the end semester exam",
    category: "mixed",
    relevant: ["hb-07"],
    rationale: "Specific figure in a single policy passage.",
  },
  {
    id: "m10",
    text: "how is the singular value decomposition used for low rank approximation",
    category: "mixed",
    relevant: ["lin-23"],
    rationale: "SVD passage explicitly covers truncation for low-rank approximation.",
  },
];

/** Queries grouped by category, for the per-category breakdown. */
export function queriesByCategory(): Record<QueryCategory, EvalQuery[]> {
  const grouped: Record<QueryCategory, EvalQuery[]> = {
    paraphrase: [],
    "exact-term": [],
    mixed: [],
  };
  for (const query of EVAL_QUERIES) grouped[query.category].push(query);
  return grouped;
}
