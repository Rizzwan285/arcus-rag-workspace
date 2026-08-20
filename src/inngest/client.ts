/**
 * Inngest client and event catalogue.
 *
 * Events are declared with `eventType()` and carry their zod schema, so the
 * same contract types the publisher (`inngest.send`) and validates the payload
 * at the consumer. A malformed publish is caught at the edge of the pipeline
 * rather than three steps in.
 *
 * @see ADR-016 in .claude/decisions.md
 */

import { Inngest, eventType } from "inngest";
import { ingestEventSchema } from "@/lib/ingestion/schemas";

export const inngest = new Inngest({ id: "arcus-workspace" });

/** Fired when an uploaded document is ready to be parsed, embedded, and indexed. */
export const documentIngestEvent = eventType("document/ingest", {
  schema: ingestEventSchema,
});
