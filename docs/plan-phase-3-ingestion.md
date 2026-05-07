# Plan — Phase 3: OpenClaw Ingestion

**Date:** 2026-05-06
**Status:** Pending
**Tasks:** T29–T31 (3 tasks)
**Predecessor:** [`plan-phase-2-admin.md`](plan-phase-2-admin.md)
**Successor:** [`plan-phase-4-launch.md`](plan-phase-4-launch.md)

End state: OpenClaw can write hobby stats to the `stats` table by calling the `stats-ingest` Edge Function with a shared-secret header. The secret is configured in both Supabase (Edge Function env) and OpenClaw (its config). No other programmatic write path exists.

The locked decision (CONSTRAINT-04, ASSUMPTION-06 option (a)) is: **Edge Function only.** No publishable-key direct INSERT path. No "Path A vs Path B" branching.

---

## T29 — Generate and store the shared secret

**Files:**
- Supabase Edge Function environment variables (operational)
- OpenClaw configuration (operational, on OpenClaw side)
- `docs/openclaw-config.md` (create — DS-02)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [ ] A high-entropy random secret is generated locally (≥32 bytes, base64 or hex). Generation is documented in `docs/openclaw-config.md` with the exact command used (e.g., `openssl rand -base64 32`).
- [ ] The secret is stored as a Supabase Edge Function env var named `STATS_INGEST_SECRET` via the Supabase dashboard or CLI. Never committed to the repo (SEC-01, SEC-07).
- [ ] The same secret is configured in OpenClaw (separate machine, separate repo). The OpenClaw side is documented but not committed in this repo.
- [ ] `docs/openclaw-config.md` notes: rotation procedure (rotate in Supabase first, then OpenClaw, accept brief 401 window during rotation), where the secret is stored, what to do if it leaks (rotate immediately).
- [ ] The secret never appears in any log, error message, or response body (SEC-05).

**Tests required:** [setup task — covered by T30 tests]

**Depends on:** Phase 2 complete (T28)

**Specialist:** `@supabase`, `@security`

---

## T30 — Edge Function `stats-ingest`

**Files:**
- `supabase/functions/stats-ingest/index.ts` (create)
- `supabase/functions/stats-ingest/deno.json` (if applicable)
- `.env.example` (note in comment: `STATS_INGEST_SECRET` is set in Supabase Edge Function env, not in app env)

**Functions to implement:**
- `validateSharedSecret(headerValue: string | null, expected: string): boolean` (security/validation, ≤80 lines, CQ-01) — constant-time comparison using `crypto.subtle.timingSafeEqual` (or Deno's equivalent / a constant-time library on Deno runtime). Returns `false` on null or mismatched length without short-circuiting (SEC-04: timing-attack mitigation).
- `parseStatsPayload(body: unknown): StatsInput` (security/validation, ≤80 lines, CQ-01) — zod parse of `{ category, label, value, unit? }`. Throws `ValidationError` (EH-05) on bad input. All four fields are strings; `unit` is optional and may be null.
- `handler(req: Request): Promise<Response>` (≤80 lines, CQ-01) — top-level Edge Function handler.
- `insertStat(payload: StatsInput): Promise<void>` (≤50 lines, CQ-01) — INSERT into `stats` using a Supabase client constructed with the service role key.

**Acceptance criteria:**
- [ ] Endpoint: `POST /functions/v1/stats-ingest`.
- [ ] Required header: `X-Stats-Secret`. Required body: JSON with `category` (string, non-empty), `label` (string, non-empty), `value` (string, non-empty), `unit` (string or null) (SEC-02).
- [ ] **Constant-time secret comparison** (SEC-04). The implementation does not return early on length mismatch in a way that leaks a timing oracle — short-circuit only after both buffers have been compared with a fixed-size operation, or use a vetted constant-time library.
- [ ] On valid secret + valid payload: INSERT via service role, return `201 Created` with body `{"ok": true}`.
- [ ] On missing or wrong secret: return `401 Unauthorized` with body `{"error": "unauthorized"}`. Log the attempt with context (IP if available, presence flag for the header — never the value, SEC-05).
- [ ] On malformed payload: return `400 Bad Request` with a generic field-level message (EH-04). Log the parse error internally with the offending field name only — no value (SEC-05).
- [ ] **No detail leak:** the 401 response is identical regardless of whether the header was missing, empty, or wrong. The 400 response does not echo back the payload or stack.
- [ ] Service role key is loaded from the Edge Function env (`SUPABASE_SERVICE_ROLE_KEY`) — never hardcoded (SEC-01).
- [ ] Errors are logged with operation name and stack trace (EH-02, EH-03). Re-thrown as `ServiceError` for the runtime to surface (EH-01, EH-05).
- [ ] **Rate-limit prep:** the handler includes a rate-limit hook — a no-op function `checkRateLimit(req: Request): Promise<void>` is called at the top of `handler` and currently always passes. The hook is in place so enforcement (e.g., Supabase invocation count threshold or a token-bucket keyed by source IP) can be added without redeploying app code. A comment marks the hook clearly (CQ-04).
- [ ] Idempotence: the function does not de-duplicate. The same `(category, label, value, unit)` tuple submitted twice creates two rows. Append-only semantics are preserved (PRD §4).
- [ ] All public functions have doc comments (DS-01) listing params, return, and thrown errors.

**Tests required:**
- `validateSharedSecret returns false when header is null` (TS-01 error).
- `validateSharedSecret returns false when secrets do not match` (TS-01 error).
- `validateSharedSecret returns true for matching secrets` (TS-01 happy).
- `validateSharedSecret uses constant-time comparison` — assert via static analysis or by checking that the implementation calls a known constant-time API. (TS-04 critical for auth.)
- `stats-ingest returns 401 when header is missing` (TS-04 critical).
- `stats-ingest returns 401 when header is wrong` (TS-04 — auth flows require ≥2 error tests).
- `stats-ingest returns 400 when payload is missing required field` (TS-01 error).
- `stats-ingest returns 400 when payload is not JSON` (TS-01 error).
- `stats-ingest returns 201 and inserts row on valid request` (TS-01 happy, TS-04 data write).
- `stats-ingest does not leak payload detail in error response body` (SEC-05 verified).

**Depends on:** T29

**Specialist:** `@supabase`, `@security`

---

## T31 — OpenClaw config notes + integration test

**Files:**
- `docs/openclaw-config.md` (modify — finalize)
- `docs/monitoring.md` (create — DS-02)

**Functions to implement:** [documentation + manual integration test]

**Acceptance criteria:**
- [ ] `docs/openclaw-config.md` documents:
  - The endpoint URL: `https://{project-ref}.supabase.co/functions/v1/stats-ingest`.
  - The exact request shape: method `POST`, header `X-Stats-Secret: {value}`, header `Content-Type: application/json`, body `{ category, label, value, unit? }`.
  - The response codes: 201, 400, 401, 429.
  - Where the secret is held on the Supabase side (Edge Function env), where on the OpenClaw side (OpenClaw config), and the rotation procedure.
  - An example `curl` command OpenClaw can use to test the endpoint (SEC-01: no real secret in the example — placeholder `$STATS_INGEST_SECRET` only).
  - What OpenClaw should do on each error code: 400 → log and stop (malformed message); 401 → alert the builder (secret mismatch — likely rotation in flight); 429 → exponential backoff up to 5 minutes (when rate-limiting is enabled in a later iteration).
  - Data semantics: append-only, duplicates allowed, corrections happen via admin delete + re-insert (PRD §3.4).
- [ ] `docs/monitoring.md` documents:
  - Where to find Supabase Edge Function logs (Supabase dashboard → Logs → Edge Functions).
  - What to look for: 401 spikes (possible secret leak or guessing), 400 spikes (OpenClaw misconfiguration), 5xx (Supabase-side issue).
  - How to monitor `stats` table activity: a saved query in Supabase SQL editor returning rows from the last 24h grouped by category.
  - Alerting: none configured for free tier; builder checks the dashboard manually after launch.
- [ ] **Manual integration test executed (and outcome logged):** trigger one valid `curl` against the live Edge Function from the builder's machine using the production secret, confirm a row appears in `stats`, confirm the row is visible at `/admin/stats` and `/other`. Delete the test row.
- [ ] **Negative test executed:** trigger one `curl` with no header and one with a wrong header, confirm both return 401 with no detail leaked, confirm no row was inserted.

**Tests required:**
- The two manual integration tests above (TS-04 critical-path verification of the only programmatic write path).

**Depends on:** T30

**Specialist:** `@supabase`, `@cto`

---

## Phase 3 Exit Criteria

- All 3 tasks complete; manual integration tests passed; the test rows have been removed.
- OpenClaw is configured and successfully writes a stat from its own runtime (verified via the `/admin/stats` view).
- Mark Phase 3 row Done in [`plan-index.md`](plan-index.md). Mark Phase 4 row Active. Log transition in `docs/session-log.md`.
