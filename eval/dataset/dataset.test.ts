import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EVAL_CORPUS, corpusByDocument } from "./corpus";
import { EVAL_QUERIES, queriesByCategory } from "./queries";

describe("evaluation corpus", () => {
  it("has unique passage ids", () => {
    const ids = EVAL_CORPUS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate passage id");
  });

  it("is large enough for top-10 to be selective", () => {
    // With a corpus this small, Recall@10 would saturate and stop
    // discriminating between systems.
    assert.ok(
      EVAL_CORPUS.length >= 100,
      `corpus has ${EVAL_CORPUS.length} passages; want >= 100`,
    );
  });

  it("has no blank or stub passages", () => {
    for (const passage of EVAL_CORPUS) {
      assert.ok(
        passage.text.trim().length >= 80,
        `${passage.id} is too short to be a realistic chunk`,
      );
    }
  });

  it("contains no duplicate passage text", () => {
    // Identical text would collide on contentHash and silently vanish at
    // insert time, because chunk writes are deduplicated by hash.
    const texts = EVAL_CORPUS.map((p) => p.text.trim());
    assert.equal(new Set(texts).size, texts.length, "duplicate passage text");
  });

  it("spreads passages across every document", () => {
    for (const [doc, passages] of Object.entries(corpusByDocument())) {
      assert.ok(passages.length >= 15, `${doc} has only ${passages.length}`);
    }
  });
});

describe("evaluation queries", () => {
  it("has unique query ids", () => {
    const ids = EVAL_QUERIES.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate query id");
  });

  it("labels every query with at least one relevant passage", () => {
    for (const query of EVAL_QUERIES) {
      assert.ok(query.relevant.length > 0, `${query.id} has no judgements`);
    }
  });

  it("only references passages that exist", () => {
    const known = new Set(EVAL_CORPUS.map((p) => p.id));
    for (const query of EVAL_QUERIES) {
      for (const id of query.relevant) {
        assert.ok(known.has(id), `${query.id} references unknown passage ${id}`);
      }
    }
  });

  it("has no duplicate judgements within a query", () => {
    for (const query of EVAL_QUERIES) {
      assert.equal(
        new Set(query.relevant).size,
        query.relevant.length,
        `${query.id} repeats a judgement`,
      );
    }
  });

  it("records a rationale for every judgement set", () => {
    for (const query of EVAL_QUERIES) {
      assert.ok(
        query.rationale.trim().length > 0,
        `${query.id} has no rationale`,
      );
    }
  });

  it("keeps the judgement set small enough that Recall@10 is meaningful", () => {
    for (const query of EVAL_QUERIES) {
      assert.ok(
        query.relevant.length <= 5,
        `${query.id} has ${query.relevant.length} judgements`,
      );
    }
  });

  it("is balanced across categories so no single one dominates the mean", () => {
    const grouped = queriesByCategory();
    for (const [category, queries] of Object.entries(grouped)) {
      assert.ok(
        queries.length >= 8,
        `category ${category} has only ${queries.length} queries`,
      );
    }
  });
});
