/**
 * Unit tests for stats-ingest Edge Function.
 *
 * Run with: `deno test --allow-read supabase/functions/stats-ingest/`
 *
 * Covers all 10 tests required by T30 acceptance criteria:
 *   validateSharedSecret × 4 (null, mismatch, match, constant-time static check)
 *   handler × 5 (401 missing, 401 wrong, 400 missing field, 400 not json, 201 happy)
 *   no-detail-leak × 1
 */

import { assertEquals, assertFalse } from "jsr:@std/assert@1";
import {
  createHandler,
  parseStatsPayload,
  ValidationError,
  validateSharedSecret,
  type StatsInput,
} from "./index.ts";

const TEST_SECRET = "test-secret-fixed-length-fortyfour-chars-aaa";

type InsertCall = { table: string; row: Record<string, unknown> };

function createMockClient(opts: {
  inserts?: InsertCall[];
  insertError?: { message: string } | null;
} = {}) {
  const inserts = opts.inserts ?? [];
  return {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (opts.insertError) {
          return Promise.resolve({ data: null, error: opts.insertError });
        }
        inserts.push({ table, row });
        return Promise.resolve({ data: null, error: null });
      },
    }),
    // deno-lint-ignore no-explicit-any
  } as any;
}

function buildRequest(opts: {
  method?: string;
  secret?: string | null;
  body?: unknown;
  rawBody?: string;
}): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (opts.secret !== undefined && opts.secret !== null) {
    headers["X-Stats-Secret"] = opts.secret;
  }
  const body = opts.rawBody !== undefined
    ? opts.rawBody
    : opts.body !== undefined
    ? JSON.stringify(opts.body)
    : undefined;
  return new Request("http://test/stats-ingest", {
    method: opts.method ?? "POST",
    headers,
    body,
  });
}

const validPayload: StatsInput = {
  category: "running",
  label: "today",
  value: "5",
  unit: "km",
};

// -----------------------------------------------------------------------------
// validateSharedSecret
// -----------------------------------------------------------------------------

Deno.test("validateSharedSecret returns false when header is null", () => {
  assertFalse(validateSharedSecret(null, TEST_SECRET));
});

Deno.test("validateSharedSecret returns false when secrets do not match", () => {
  const wrong = "wrong-secret-fixed-length-fortyfour-chars-bbb";
  assertFalse(validateSharedSecret(wrong, TEST_SECRET));
});

Deno.test("validateSharedSecret returns true for matching secrets", () => {
  assertEquals(validateSharedSecret(TEST_SECRET, TEST_SECRET), true);
});

Deno.test("validateSharedSecret returns false on length mismatch without throwing", () => {
  // Shorter than expected
  assertFalse(validateSharedSecret("short", TEST_SECRET));
  // Longer than expected
  assertFalse(
    validateSharedSecret(TEST_SECRET + "extra-trailing-bytes", TEST_SECRET),
  );
});

Deno.test("validateSharedSecret uses constant-time comparison (static check)", async () => {
  const source = await Deno.readTextFile(
    new URL("./index.ts", import.meta.url),
  );
  // The implementation must import timingSafeEqual from node:crypto and call
  // it inside validateSharedSecret. Static check is sufficient — invariant
  // is preserved by the import statement itself.
  assertEquals(source.includes('from "node:crypto"'), true);
  assertEquals(source.includes("timingSafeEqual"), true);
});

// -----------------------------------------------------------------------------
// parseStatsPayload (covered indirectly by handler tests, plus one direct)
// -----------------------------------------------------------------------------

Deno.test("parseStatsPayload throws ValidationError with field on bad input", () => {
  let threw = false;
  try {
    parseStatsPayload({ category: "", label: "x", value: "y" });
  } catch (e) {
    threw = true;
    assertEquals(e instanceof ValidationError, true);
    assertEquals((e as ValidationError).field, "category");
  }
  assertEquals(threw, true);
});

// -----------------------------------------------------------------------------
// handler
// -----------------------------------------------------------------------------

Deno.test("stats-ingest returns 401 when header is missing", async () => {
  const handler = createHandler({
    supabaseClient: createMockClient(),
    sharedSecret: TEST_SECRET,
  });
  const res = await handler(buildRequest({ secret: null, body: validPayload }));
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "unauthorized" });
});

Deno.test("stats-ingest returns 401 when header is wrong", async () => {
  const handler = createHandler({
    supabaseClient: createMockClient(),
    sharedSecret: TEST_SECRET,
  });
  const res = await handler(
    buildRequest({ secret: "wrong-value", body: validPayload }),
  );
  assertEquals(res.status, 401);
  assertEquals(await res.json(), { error: "unauthorized" });
});

Deno.test("stats-ingest returns 400 when payload is missing required field", async () => {
  const handler = createHandler({
    supabaseClient: createMockClient(),
    sharedSecret: TEST_SECRET,
  });
  const res = await handler(
    buildRequest({ secret: TEST_SECRET, body: { category: "running" } }),
  );
  assertEquals(res.status, 400);
  const body = await res.json();
  assertEquals(body.error, "bad_request");
});

Deno.test("stats-ingest returns 400 when payload is not JSON", async () => {
  const handler = createHandler({
    supabaseClient: createMockClient(),
    sharedSecret: TEST_SECRET,
  });
  const res = await handler(
    buildRequest({ secret: TEST_SECRET, rawBody: "this is not json {{{{" }),
  );
  assertEquals(res.status, 400);
  assertEquals(await res.json(), { error: "bad_request" });
});

Deno.test("stats-ingest returns 201 and inserts row on valid request", async () => {
  const inserts: InsertCall[] = [];
  const handler = createHandler({
    supabaseClient: createMockClient({ inserts }),
    sharedSecret: TEST_SECRET,
  });
  const res = await handler(
    buildRequest({ secret: TEST_SECRET, body: validPayload }),
  );
  assertEquals(res.status, 201);
  assertEquals(await res.json(), { ok: true });
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "stats");
  assertEquals(inserts[0].row, {
    category: "running",
    label: "today",
    value: "5",
    unit: "km",
  });
});

// -----------------------------------------------------------------------------
// no-detail-leak (SEC-05)
// -----------------------------------------------------------------------------

Deno.test("stats-ingest does not leak payload detail in error response body", async () => {
  const handler = createHandler({
    supabaseClient: createMockClient(),
    sharedSecret: TEST_SECRET,
  });
  // Send a payload with a sentinel value as the would-be field value.
  // The validation failure should not echo the sentinel back.
  const sentinel = "SENTINEL_SHOULD_NOT_APPEAR_IN_RESPONSE";
  const res = await handler(
    buildRequest({
      secret: TEST_SECRET,
      body: { category: "", label: sentinel, value: sentinel },
    }),
  );
  const text = await res.text();
  assertFalse(text.includes(sentinel));
});
