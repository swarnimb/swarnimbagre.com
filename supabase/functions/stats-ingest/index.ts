/**
 * stats-ingest — Supabase Edge Function (Deno runtime).
 *
 * The only programmatic write path to the `stats` table. OpenClaw (or any
 * caller holding the shared secret `STATS_INGEST_SECRET`) POSTs a stats row
 * here; the function validates the secret with constant-time comparison
 * (SEC-04), parses the body with zod (SEC-02), and INSERTs via the service
 * role key (CONSTRAINT-04, CONSTRAINT-08).
 *
 * No other operations are reachable through this endpoint. The service role
 * key is loaded from the Edge Function runtime env, never sent to clients.
 *
 * See: docs/architecture.md §3.3, docs/openclaw-config.md.
 */

import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const SECRET_HEADER = "X-Stats-Secret";
const STATS_TABLE = "stats";

const statsInputSchema = z
  .object({
    category: z.string().min(1),
    label: z.string().min(1),
    value: z.string().min(1),
    unit: z.union([z.string().min(1), z.null()]).optional(),
  })
  .strict();

export type StatsInput = z.infer<typeof statsInputSchema>;

/**
 * Validation error thrown when zod parsing fails. The `field` is the first
 * offending property path; used for internal logging and a generic
 * field-name-only response (SEC-05 — no values, no stack).
 */
export class ValidationError extends Error {
  readonly field: string;
  constructor(message: string, field: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Service error wraps a Supabase-layer failure. The underlying error is
 * preserved via the standard `Error.cause` (ES2022) for internal logs;
 * never surfaced to the response body.
 */
export class ServiceError extends Error {
  constructor(message: string, cause: unknown) {
    super(message, { cause });
    this.name = "ServiceError";
  }
}

/**
 * Constant-time comparison of a header value against the expected secret.
 *
 * Always performs exactly one fixed-size `timingSafeEqual` over buffers of
 * length `expected.length`, regardless of header presence or header length.
 * The length-equality result is AND'd with the content-equality result —
 * both operations are constant-time, so callers cannot distinguish
 * "missing", "wrong length", or "wrong content" via timing (SEC-04).
 *
 * A null header is treated as the empty string for uniform processing.
 *
 * @param headerValue — raw header value from the incoming request, or null
 * @param expected — the secret as stored in the Edge Function env
 * @returns true iff the two values match byte-for-byte
 */
export function validateSharedSecret(
  headerValue: string | null,
  expected: string,
): boolean {
  const expectedBytes = new TextEncoder().encode(expected);
  const headerBytes = new TextEncoder().encode(headerValue ?? "");

  const padded = new Uint8Array(expectedBytes.length);
  for (let i = 0; i < expectedBytes.length; i++) {
    padded[i] = i < headerBytes.length ? headerBytes[i] : 0;
  }

  const contentMatches = timingSafeEqual(
    Buffer.from(padded),
    Buffer.from(expectedBytes),
  );
  const lengthMatches = headerBytes.length === expectedBytes.length;
  return contentMatches && lengthMatches;
}

/**
 * Parse and validate the request body. On schema violation, throws
 * `ValidationError` carrying the first offending field name for internal
 * logs. The field name is generic (the property key, not its value).
 *
 * @throws ValidationError on schema violation
 */
export function parseStatsPayload(body: unknown): StatsInput {
  const result = statsInputSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const field =
      firstIssue.path.length > 0 ? String(firstIssue.path[0]) : "body";
    throw new ValidationError(`invalid_${field}`, field);
  }
  return result.data;
}

/**
 * INSERT a validated stats row using the provided Supabase client. The
 * client must be constructed with the service role key — `stats` has no
 * anon INSERT policy (CONSTRAINT-04, CONSTRAINT-08).
 *
 * @throws ServiceError on any Supabase-side failure
 */
export async function insertStat(
  client: SupabaseClient,
  payload: StatsInput,
): Promise<void> {
  const { error } = await client.from(STATS_TABLE).insert({
    category: payload.category,
    label: payload.label,
    value: payload.value,
    unit: payload.unit ?? null,
  });
  if (error) {
    throw new ServiceError(`stats_insert_failed: ${error.message}`, error);
  }
}

/**
 * Rate-limit hook (CQ-04 marker). No-op in Phase 3 — wired so enforcement
 * can be added without redeploying app code. Future implementation:
 * source-IP token bucket or Supabase invocation-count threshold.
 */
async function checkRateLimit(_req: Request): Promise<void> {
  // intentionally empty — placeholder per T30 acceptance criteria
}

type LogFn = (
  level: "info" | "error",
  msg: string,
  ctx?: Record<string, unknown>,
) => void;

const defaultLog: LogFn = (level, msg, ctx) => {
  const line = JSON.stringify({
    level,
    msg,
    ...ctx,
    ts: new Date().toISOString(),
  });
  if (level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Build the request handler with injected dependencies. The deployment
 * entry point wires this against `Deno.env` + the real Supabase client;
 * tests inject mocks.
 */
export function createHandler(deps: {
  supabaseClient: SupabaseClient;
  sharedSecret: string;
  log?: LogFn;
}): (req: Request) => Promise<Response> {
  const log = deps.log ?? defaultLog;

  return async function handler(req: Request): Promise<Response> {
    try {
      await checkRateLimit(req);

      if (req.method !== "POST") {
        return jsonResponse(405, { error: "method_not_allowed" });
      }

      const headerValue = req.headers.get(SECRET_HEADER);
      if (!validateSharedSecret(headerValue, deps.sharedSecret)) {
        log("info", "stats-ingest auth failure", {
          headerPresent: headerValue !== null,
          forwardedFor: req.headers.get("x-forwarded-for"),
        });
        return jsonResponse(401, { error: "unauthorized" });
      }

      let bodyJson: unknown;
      try {
        bodyJson = await req.json();
      } catch {
        log("info", "stats-ingest malformed json");
        return jsonResponse(400, { error: "bad_request" });
      }

      let payload: StatsInput;
      try {
        payload = parseStatsPayload(bodyJson);
      } catch (e) {
        const field = e instanceof ValidationError ? e.field : "unknown";
        log("info", "stats-ingest validation failure", { field });
        return jsonResponse(400, { error: "bad_request", field });
      }

      try {
        await insertStat(deps.supabaseClient, payload);
      } catch (e) {
        log("error", "stats-ingest insert failed", {
          message: e instanceof Error ? e.message : String(e),
        });
        return jsonResponse(500, { error: "internal_error" });
      }

      return jsonResponse(201, { ok: true });
    } catch (e) {
      log("error", "stats-ingest unhandled exception", {
        message: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      });
      return jsonResponse(500, { error: "internal_error" });
    }
  };
}

function loadEnvOrThrow(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Edge Function env var ${name} is not set (EH-01)`);
  }
  return value;
}

if (import.meta.main) {
  const sharedSecret = loadEnvOrThrow("STATS_INGEST_SECRET");
  const supabaseUrl = loadEnvOrThrow("SUPABASE_URL");
  const serviceRoleKey = loadEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseClient = createClient(supabaseUrl, serviceRoleKey);
  Deno.serve(createHandler({ supabaseClient, sharedSecret }));
}
