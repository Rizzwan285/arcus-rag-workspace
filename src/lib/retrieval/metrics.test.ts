import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregate,
  hitAtK,
  ndcgAtK,
  pairedBootstrap,
  recallAtK,
  reciprocalRank,
  scoreQuery,
} from "./metrics";

const rel = (...ids: string[]) => new Set(ids);

describe("recallAtK", () => {
  it("returns the fraction of relevant documents inside the cutoff", () => {
    // 2 of the 4 relevant ids are in the top 5.
    const ranked = ["a", "x", "b", "y", "z"];
    assert.equal(recallAtK(ranked, rel("a", "b", "c", "d"), 5), 0.5);
  });

  it("is capped by k/|relevant| when there are more relevant docs than slots", () => {
    // Three relevant docs cannot all fit in the top 1 — the ceiling is 1/3.
    const ranked = ["a", "b", "c"];
    assert.equal(recallAtK(ranked, rel("a", "b", "c"), 1), 1 / 3);
  });

  it("returns 0 when nothing relevant is retrieved", () => {
    assert.equal(recallAtK(["x", "y"], rel("a"), 10), 0);
  });

  it("does not exceed 1 when the list repeats beyond the cutoff", () => {
    assert.equal(recallAtK(["a", "b"], rel("a", "b"), 10), 1);
  });

  it("returns 0 for an empty judgement set rather than dividing by zero", () => {
    assert.equal(recallAtK(["a"], rel(), 5), 0);
  });

  it("handles an empty ranked list", () => {
    assert.equal(recallAtK([], rel("a"), 5), 0);
  });
});

describe("hitAtK", () => {
  it("is 1 when any relevant document is inside the cutoff", () => {
    assert.equal(hitAtK(["x", "a"], rel("a", "b"), 2), 1);
  });

  it("is 0 when the only relevant document falls outside the cutoff", () => {
    assert.equal(hitAtK(["x", "a"], rel("a"), 1), 0);
  });

  it("diverges from recall when multiple documents are relevant", () => {
    const ranked = ["a", "x", "y"];
    const relevant = rel("a", "b");
    assert.equal(hitAtK(ranked, relevant, 5), 1);
    assert.equal(recallAtK(ranked, relevant, 5), 0.5);
  });
});

describe("reciprocalRank", () => {
  it("uses 1-based rank of the first relevant document", () => {
    assert.equal(reciprocalRank(["a"], rel("a")), 1);
    assert.equal(reciprocalRank(["x", "a"], rel("a")), 0.5);
    assert.equal(reciprocalRank(["x", "y", "a"], rel("a")), 1 / 3);
  });

  it("ignores relevant documents after the first", () => {
    assert.equal(reciprocalRank(["x", "a", "b"], rel("a", "b")), 0.5);
  });

  it("returns 0 when nothing relevant was retrieved", () => {
    assert.equal(reciprocalRank(["x", "y"], rel("a")), 0);
  });
});

describe("ndcgAtK", () => {
  it("is 1 when relevant documents occupy the top positions", () => {
    assert.equal(ndcgAtK(["a", "b", "x"], rel("a", "b"), 10), 1);
  });

  it("is sensitive to position, unlike recall", () => {
    const relevant = rel("a");
    const early = ndcgAtK(["a", "x", "y"], relevant, 10);
    const late = ndcgAtK(["x", "y", "a"], relevant, 10);

    // Recall cannot tell these apart; nDCG must.
    assert.equal(recallAtK(["a", "x", "y"], relevant, 10), 1);
    assert.equal(recallAtK(["x", "y", "a"], relevant, 10), 1);
    assert.ok(early > late, `expected ${early} > ${late}`);
  });

  it("returns 0 when nothing relevant is retrieved", () => {
    assert.equal(ndcgAtK(["x"], rel("a"), 10), 0);
  });

  it("normalises against a capped ideal when |relevant| exceeds k", () => {
    // Two relevant docs, cutoff of 1: retrieving one of them at rank 1 is ideal.
    assert.equal(ndcgAtK(["a", "b"], rel("a", "b"), 1), 1);
  });
});

describe("scoreQuery / aggregate", () => {
  it("macro-averages so every query counts equally", () => {
    const scores = [
      scoreQuery({ queryId: "q1", ranked: ["a"], relevant: rel("a") }),
      scoreQuery({ queryId: "q2", ranked: ["x"], relevant: rel("a") }),
    ];
    const agg = aggregate(scores);

    assert.equal(agg.queries, 2);
    assert.equal(agg.recallAt1, 0.5); // 1 and 0
    assert.equal(agg.mrr, 0.5); // 1 and 0
  });

  it("returns zeroed aggregates for an empty score set", () => {
    const agg = aggregate([]);
    assert.equal(agg.queries, 0);
    assert.equal(agg.mrr, 0);
    assert.equal(agg.recallAt10, 0);
  });
});

describe("pairedBootstrap", () => {
  it("reports a positive, significant delta when A dominates on every query", () => {
    const a = [1, 1, 1, 1, 1, 1, 1, 1];
    const b = [0, 0, 0, 0, 0, 0, 0, 0];
    const result = pairedBootstrap(a, b);

    assert.equal(result.meanDelta, 1);
    assert.equal(result.wins, 8);
    assert.equal(result.losses, 0);
    assert.ok(result.significant);
    assert.ok(result.ci95[0] > 0);
  });

  it("does not call a coin-flip difference significant", () => {
    // Equal wins and losses of equal magnitude: the interval must straddle zero.
    const a = [1, 0, 1, 0, 1, 0, 1, 0];
    const b = [0, 1, 0, 1, 0, 1, 0, 1];
    const result = pairedBootstrap(a, b);

    assert.equal(result.meanDelta, 0);
    assert.equal(result.wins, 4);
    assert.equal(result.losses, 4);
    assert.equal(result.significant, false);
  });

  it("treats identical systems as ties with a zero-width interval", () => {
    const values = [0.4, 0.9, 0.1];
    const result = pairedBootstrap(values, values);

    assert.equal(result.meanDelta, 0);
    assert.equal(result.ties, 3);
    assert.deepEqual(result.ci95, [0, 0]);
    assert.equal(result.significant, false);
  });

  it("is deterministic for a given seed", () => {
    const a = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1];
    const b = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1];
    const first = pairedBootstrap(a, b, { seed: 7 });
    const second = pairedBootstrap(a, b, { seed: 7 });

    assert.deepEqual(first.ci95, second.ci95);
  });

  it("rejects mismatched sample lengths", () => {
    assert.throws(() => pairedBootstrap([1, 2], [1]), /equal-length/);
  });

  it("handles an empty comparison", () => {
    const result = pairedBootstrap([], []);
    assert.equal(result.meanDelta, 0);
    assert.equal(result.significant, false);
  });
});
