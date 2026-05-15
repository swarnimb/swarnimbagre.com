# Monitoring

**Date:** 2026-05-14
**Status:** Sentry deferred — manual log review until launch + first weeks of traffic.

This doc is the interim observability playbook. It exists because T32 Option B was picked: no automated error reporting pre-launch, no third-party SDK bytes on the public bundle, and no PII-scrubbing rules authored speculatively. Errors are caught the old way — by looking. This file tells the builder exactly where to look.

When the gate condition at the bottom of this file is met, monitoring flips to Sentry (T32 Option A). The deferred env vars are already stubbed in `.env.example`.

---

## Why Sentry is deferred

Pre-launch the only user is the builder, who already sees errors in dev tools. Wiring Sentry now would add ~24–30 KB gzipped to the public bundle (CONSTRAINT-05 invariant), design PII-scrubbing rules against payloads that don't exist yet, and pay a vendor-dependency cost for zero pre-launch benefit. Reversibility is high — `@sentry/nextjs` is a wizard install, and the founder-brief entry for this decision documents the trigger to flip.

Trade-off accepted: pre-launch QA errors are not auto-captured. They are reproducible manually because the builder is the only one hitting the site.

See `docs/founder-brief.md` entry 23 for the full rationale.

---

## Where to look — by failure mode

### Public site renders blank or 5xx

- **Vercel dashboard → swarnimbagre.com project → Logs tab → Runtime Logs.**
- Filter by status: `5xx`. Filter by path: `/` (or the affected route).
- `lib/safe-load.ts` catches DB read failures and returns fallbacks (CONSTRAINT-14), so a 5xx on a public page is unusual — it usually means a build error, a missing env var, or a Server Component throw outside `safeLoad`.
- Cross-check: Vercel → Deployments → most recent — was the latest deploy successful?

### Admin Server Action fails silently in the UI

- Per the four-channel uniformity contract (architecture §6.6.6), Server Action throws are converted to `formError` on the wire — they do not surface a stack trace to the user.
- **Vercel dashboard → Runtime Logs.** Filter by path: `/admin/*`. The internal helper logs the original error via `logMutationError` (see `lib/admin-mutation-log.ts`) with the action name, resource, and stack — that is the canonical record.
- If the action calls Supabase: also check **Supabase dashboard → Database → Logs** for the same minute window. RLS denials and constraint violations appear there, not in Vercel.

### Magic-link sign-in does not arrive or token is rejected

- **Supabase dashboard → Authentication → Logs.** Filter by event: `magiclink` / `token`.
- Cross-check the email allowlist: `ADMIN_ALLOWED_EMAIL` in Vercel Production env must match the sender. CONSTRAINT-09 enforces single-user.
- If the token loop redirects oddly, also check Vercel Runtime Logs for the `/auth/callback` and `/auth/confirm` routes (CONSTRAINT-18 — `flowType: 'implicit'`).

### Image upload fails

- Symptoms: upload spinner finishes, image does not appear, or admin form shows a generic `formError`.
- **Supabase dashboard → Storage → Logs** for `storage.objects` policy denials (`images_storage_admin_all`, scoped to `bucket_id = 'images'`). RLS denials surface here, not in Vercel.
- **Supabase dashboard → Database → Logs** for the `public.images` table — insert failures appear here.
- Vercel Runtime Logs (`/admin/projects/*` or `/admin/posts/*`) — the action's mutation-log entry will name the resource and the failing step. See `lib/admin-images-mutations-internal.ts` for the throwing helper.

### OpenClaw stats ingest fails

- **Supabase dashboard → Edge Functions → `stats-ingest` → Logs.**
- 401 responses indicate a missing or wrong `X-Stats-Secret` header — log entry names the header presence flag, never the value (SEC-05).
- 400 responses indicate payload validation failure — log entry names the offending field, never the value.
- 5xx — service-role insert failed; check Postgres logs for the `public.stats` insert error in the same window.

### Database — RLS denial or constraint violation

- **Supabase dashboard → Database → Logs.** Filter by severity: `ERROR`. Filter by user role: `authenticated` (admin actions) or `anon` (public site reads).
- RLS denials over `storage.objects` surface as policy errors with the bucket-scoped policy name. The Supabase JS SDK strips the `for table "X"` suffix from RLS errors at the wire layer — see architecture §2.4 diagnostic anchor.

---

## MCP shortcut

When working with Claude in this repo, Supabase logs are also accessible via:

```
mcp__supabase__get_logs(service: "edge-function" | "postgres" | "auth" | "storage" | "api" | "realtime")
```

`@supabase` uses this directly. The builder can also ask `@dev` to pull a log window when triaging.

---

## What this does not cover

- **Client-side JS errors on the public site.** If a component throws after hydration, the user sees a broken page and there is no log. This is the largest blind spot of Option B and is the primary motivation to eventually flip to Option A.
- **Performance regressions.** No RUM, no Web Vitals capture. Vercel Analytics is the closest free-tier substitute but is not wired up.
- **Silent data inconsistencies.** If a Server Action writes the wrong row, no alert fires. The data is correct or it is not; nothing watches.

These are accepted gaps for the deferred window. The gate condition closes them.

---

## Gate condition — flip to Option A (Sentry)

Activate Sentry (T32 Option A) the first time **either** of these is true:

1. **The site URL is shared beyond the builder.** Once the URL appears in a public profile, a portfolio link, a social post, or anywhere a non-builder might land on it, the manual-log-review posture is no longer sufficient. Sentry wires in before the first external visitor.

2. **A production bug is discovered hours or days after it happened.** The first time the builder notices something was broken and the logs are already rolled or context is gone, the deferral has cost more than the install would have. Wire Sentry that same session.

Operationally — Option A is a ~30 min job: create a Sentry project on the free tier (5K events/month), copy the DSN into `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel Production env, create `lib/sentry.ts` with `initSentry()`, register it in `next.config.ts` via the official Sentry Next.js plugin, configure PII scrubbing (strip email, tokens, request bodies — SEC-05), add the two tests from T32 Option A acceptance criteria, and re-run `@security` if the wiring touches the auth flow.

---

## Related files

- `.env.example` — `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` stubs, with deferred-status comment.
- `docs/founder-brief.md` entry 23 — full rationale.
- `docs/plan-phase-4-launch.md` T32 — task spec with Option A and Option B acceptance criteria.
- `docs/architecture.md` §6.6.6 — admin mutation logging contract that this playbook leans on.
- `lib/safe-load.ts` — the catch-and-fallback shape that makes public-site 5xx rare (CONSTRAINT-14).
- `lib/admin-mutation-log.ts` — `logMutationError`, the admin canonical error record.
