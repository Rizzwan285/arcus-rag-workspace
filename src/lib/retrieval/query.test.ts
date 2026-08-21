import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildHybridSearchParams,
  HYBRID_SEARCH_SQL,
  toRetrievedChunk,
  toVectorLiteral,
  type FusedRow,
  type QueryParamOptions,
} from "./query";

const baseOptions: QueryParamOptions = {
  queryEmbedding: [0.1, 0.2, 0.3],
  queryText: "gradient descent",
  userId: "user_1",
  limit: 10,
  candidatePool: 40,
  rrfK: 60,
  vectorWeight: 1,
  keywordWeight: 1,
  minSimilarity: 0,
  documentId: null,
  mode: "hybrid",
};

describe("toVectorLiteral", () => {
  it("emits pgvector's bracketed literal form", () => {
    assert.equal(toVectorLiteral([0.5, -1, 2]), "[0.5,-1,2]");
  });

  it("handles an empty vector", () => {
    assert.equal(toVectorLiteral([]), "[]");
  });
});

describe("buildHybridSearchParams", () => {
  it("places every parameter at the position the SQL expects", () => {
    const params = buildHybridSearchParams(baseOptions);

    assert.equal(params.length, 12);
    assert.equal(params[0], "[0.1,0.2,0.3]"); // $1 vector
    assert.equal(params[1], "user_1"); // $2 owner
    assert.equal(params[2], null); // $3 document scope
    assert.equal(params[3], 40); // $4 candidate pool
    assert.equal(params[4], 0); // $5 similarity floor
    assert.equal(params[5], "gradient descent"); // $6 query text
    assert.equal(params[6], 1); // $7 vector weight
    assert.equal(params[7], 60); // $8 rrf k
    assert.equal(params[8], 1); // $9 keyword weight
    assert.equal(params[9], 10); // $10 limit
  });

  it("never lets the candidate pool fall below the requested limit", () => {
    // Otherwise the arms could return fewer rows than the caller asked for.
    const params = buildHybridSearchParams({
      ...baseOptions,
      candidatePool: 5,
      limit: 25,
    });
    assert.equal(params[3], 25);
  });

  it("enables both arms in hybrid mode", () => {
    const params = buildHybridSearchParams({ ...baseOptions, mode: "hybrid" });
    assert.equal(params[10], true);
    assert.equal(params[11], true);
  });

  it("disables the lexical arm in vector mode", () => {
    const params = buildHybridSearchParams({ ...baseOptions, mode: "vector" });
    assert.equal(params[10], true);
    assert.equal(params[11], false);
  });

  it("disables the dense arm in keyword mode", () => {
    const params = buildHybridSearchParams({ ...baseOptions, mode: "keyword" });
    assert.equal(params[10], false);
    assert.equal(params[11], true);
  });

  it("passes a document scope through when one is given", () => {
    const params = buildHybridSearchParams({
      ...baseOptions,
      documentId: "doc_9",
    });
    assert.equal(params[2], "doc_9");
  });

  it("normalises an omitted document scope to null", () => {
    const { documentId: _omitted, ...rest } = baseOptions;
    void _omitted;
    const params = buildHybridSearchParams(rest as QueryParamOptions);
    assert.equal(params[2], null);
  });
});

describe("HYBRID_SEARCH_SQL", () => {
  /** The statement with `--` comments removed, so prose cannot satisfy an assertion. */
  const executable = HYBRID_SEARCH_SQL.split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

  it("references every parameter the builder supplies", () => {
    for (let i = 1; i <= 12; i++) {
      assert.ok(
        executable.includes(`$${i}`),
        `SQL is missing parameter $${i}`,
      );
    }
  });

  it("gates each arm behind its own boolean parameter", () => {
    assert.ok(executable.includes("WHERE $11::bool"));
    assert.ok(executable.includes("WHERE $12::bool"));
  });

  it("uses a full outer join so single-arm hits still compete", () => {
    assert.ok(/FULL OUTER JOIN/i.test(executable));
  });

  it("builds a disjunctive tsquery, not a conjunctive one", () => {
    // AND semantics turn the lexical arm into a boolean filter that returns
    // nothing whenever one query term is absent from the passage. See ADR-021.
    assert.ok(
      !/websearch_to_tsquery|plainto_tsquery/.test(executable),
      "lexical arm must not use an AND-joining tsquery constructor",
    );
    assert.ok(executable.includes("' | '"), "lexical arm must OR its lexemes");
    assert.ok(
      executable.includes("quote_literal(lexeme)"),
      "lexemes must be escaped before being handed to to_tsquery",
    );
  });

  it("ranks the lexical arm with ts_rank_cd", () => {
    assert.ok(executable.includes("ts_rank_cd"));
  });

  it("scopes both arms to the owner", () => {
    const ownerFilters = executable.match(/d\."userId" = \$2/g) ?? [];
    assert.equal(ownerFilters.length, 2);
  });
});

describe("toRetrievedChunk", () => {
  const row = (over: Partial<FusedRow>): FusedRow => ({
    id: "c1",
    documentId: "d1",
    content: "text",
    metadata: null,
    pageNumber: 2,
    chunkIndex: 3,
    similarity: 0.8,
    keywordScore: 0.02,
    vectorRank: 1,
    keywordRank: 4,
    rrfScore: 0.03,
    ...over,
  });

  it("labels a chunk found by both arms", () => {
    assert.equal(toRetrievedChunk(row({})).matchedBy, "both");
  });

  it("labels a dense-only hit", () => {
    assert.equal(
      toRetrievedChunk(row({ keywordRank: null })).matchedBy,
      "vector",
    );
  });

  it("labels a lexical-only hit", () => {
    assert.equal(
      toRetrievedChunk(row({ vectorRank: null })).matchedBy,
      "keyword",
    );
  });

  it("coerces numerics that the driver may return as strings", () => {
    // node-postgres returns float8/numeric as strings depending on the type.
    const chunk = toRetrievedChunk(
      row({ similarity: "0.75", keywordScore: "0.5", rrfScore: "0.01" }),
    );
    assert.equal(chunk.similarity, 0.75);
    assert.equal(chunk.keywordScore, 0.5);
    assert.equal(chunk.rrfScore, 0.01);
    assert.equal(typeof chunk.similarity, "number");
  });
});
