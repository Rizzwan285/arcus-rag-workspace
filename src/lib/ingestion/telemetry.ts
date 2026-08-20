/**
 * Pipeline Telemetry
 *
 * Structured, single-line JSON logging plus a step timer. Every ingestion log
 * line shares a shape (`ts`, `level`, `event`, `documentId`, `runId`, …) so it
 * can be queried directly in Vercel/Datadog/Axiom without regex scraping.
 *
 * @see ADR-017 in .claude/decisions.md
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Fields attached to every line emitted by a given logger instance. */
export interface LogContext {
  documentId?: string;
  runId?: string;
  attempt?: number;
  [key: string]: unknown;
}

function emit(level: LogLevel, event: string, fields: Record<string, unknown>) {
  const line = JSON.stringify(
    {
      ts: new Date().toISOString(),
      level,
      pipeline: "document-ingestion",
      event,
      ...fields,
    },
    // Errors do not serialise through JSON.stringify by default.
    (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
  );

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** A logger bound to one ingestion run. */
export class PipelineLogger {
  constructor(private readonly context: LogContext) {}

  private log(level: LogLevel, event: string, fields: Record<string, unknown> = {}) {
    emit(level, event, { ...this.context, ...fields });
  }

  debug(event: string, fields?: Record<string, unknown>) {
    this.log("debug", event, fields);
  }
  info(event: string, fields?: Record<string, unknown>) {
    this.log("info", event, fields);
  }
  warn(event: string, fields?: Record<string, unknown>) {
    this.log("warn", event, fields);
  }
  error(event: string, fields?: Record<string, unknown>) {
    this.log("error", event, fields);
  }

  /** Derive a logger carrying extra context (e.g. a step name). */
  child(extra: LogContext): PipelineLogger {
    return new PipelineLogger({ ...this.context, ...extra });
  }
}

/**
 * Accumulates per-step wall-clock timings for the run.
 *
 * Inngest already records step durations, but persisting them on `IngestionRun`
 * means latency can be queried in SQL alongside chunk yield and token spend —
 * which is what makes "p95 latency by document size" a one-line query.
 */
export class StepTimer {
  private readonly timings: Record<string, number> = {};
  private readonly runStart = Date.now();

  /** Time an async step, record its duration, and re-throw on failure. */
  async measure<T>(step: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      return await fn();
    } finally {
      this.timings[step] = (this.timings[step] ?? 0) + (Date.now() - start);
    }
  }

  /** Record a duration measured elsewhere (e.g. inside an Inngest step). */
  record(step: string, ms: number) {
    this.timings[step] = (this.timings[step] ?? 0) + ms;
  }

  get stepTimings(): Record<string, number> {
    return { ...this.timings };
  }

  /** Total wall-clock latency of the run so far, in milliseconds. */
  get elapsedMs(): number {
    return Date.now() - this.runStart;
  }
}

/**
 * Normalise an unknown throwable into the message/trace pair stored on
 * `Document` (DLQ) and `IngestionRun`.
 */
export function describeError(error: unknown): { message: string; trace: string } {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      trace: error.stack ?? `${error.name}: ${error.message}`,
    };
  }
  const message = typeof error === "string" ? error : JSON.stringify(error);
  return { message: message.slice(0, 2_000), trace: message.slice(0, 8_000) };
}
