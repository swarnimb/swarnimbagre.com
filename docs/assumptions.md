# Assumptions: swarnimbagre.com

> Per-project file. Produced by `@assumptions` command.
> Loaded by `@session-start` alongside `architecture.md` and `constraints.md`.
> This file is complete when every critical assumption is either validated or explicitly accepted as a known risk with a contingency. Nothing invisible. A known risk is acceptable. An unexamined assumption is not.

---

## Status

**Overall:** [x] Complete — all assumptions resolved or accepted

**Last updated:** 2026-05-06

**Categories audited:** All 5. User behavior surfaced no critical assumptions (Swarnim is the only authenticated user and the builder; using his own admin panel is self-evidently motivated, and public visitors are passive readers with no behavioral dependency). The other four categories produced 6 critical assumptions, listed below.

---

## Assumption Categories

Five categories are audited by `@assumptions`. Each critical assumption found falls into one:

1. **Data availability** — Does the data source actually have what this project needs?
2. **Service capability** — Can the third-party service do what the project requires?
3. **User behavior** — Will users actually perform the interaction the product is designed around?
4. **Technical feasibility** — Can this be built with available tools and libraries?
5. **Cost** — Will this be affordable at real usage volume?

---

## Assumptions Log

---

### [ASSUMPTION-01] OpenClaw stat payload schema

**Category:** Data availability

**Assumption:** OpenClaw will write to `stats` using a fixed schema that the project defines. OpenClaw is told (via its system prompt / config) what columns and value types are expected, and produces inserts that match.

**Why it's critical:** Determines whether `stats` is one typed table, a key-value store, or per-category tables. A schema mismatch between OpenClaw's payload and the table prevents stat ingestion entirely.

**Resolution approach:** Research (architectural clarification with builder)

**Resolution detail:** OpenClaw is itself an LLM agent that interprets plain-English Telegram messages and writes to whatever schema it is configured to know. It is not a fixed-output system. Therefore the schema is a `@plan`-time design decision, not a discovery from OpenClaw's existing output. Swarnim defines the columns; OpenClaw is told the schema and inserts to match.

**Outcome:** Schema design is a `@cto` + `@supabase` task at `@plan`. No external discovery needed. OpenClaw is schema-flexible.

**Status:** [x] Resolved

---

### [ASSUMPTION-02] OpenClaw outbound HTTPS capability

**Category:** Service capability

**Assumption:** OpenClaw can make outbound HTTPS calls to a Supabase URL with custom auth headers.

**Why it's critical:** Without outbound HTTPS, OpenClaw cannot write to Supabase regardless of the authentication pattern chosen.

**Resolution approach:** Research (builder confirmation)

**Resolution detail:** Builder confirmed OpenClaw has outbound HTTPS capability. OpenClaw runs on separate infrastructure with its own GitHub and Supabase accounts and can be granted access to swarnimbagre.com's Supabase project to call its REST API directly.

**Outcome:** Confirmed. OpenClaw can reach Supabase.

**Status:** [x] Resolved

---

### [ASSUMPTION-03] OpenClaw access model (kickoff-design supersession)

**Category:** Service capability

**Assumption:** Original kickoff design — OpenClaw writes to `stats` exclusively via an Edge Function with shared-secret header constant-time comparison — is the right pattern.

**Why it's critical:** Determines authentication, security boundary, and audit story for the only programmatic write path on the project.

**Resolution approach:** Research (architectural reconsideration during `@assumptions`)

**Resolution detail:** Builder revealed OpenClaw is an LLM agent that interprets plain-English Telegram messages and reasons about what to write. The original Edge Function + fixed-format design assumes a deterministic client; OpenClaw is non-deterministic. Three options were weighed:
- **(A)** Keep Edge Function gateway, force OpenClaw to format messages in a fixed shape.
- **(B)** Grant OpenClaw INSERT-only direct Supabase access on `stats` only (no UPDATE, no DELETE, no other tables).
- **(C)** Grant OpenClaw full read/write on `stats`.

Builder selected option B. INSERT-only preserves append-only stat semantics, removes the worst-case LLM-hallucination damage scenarios (no edits to historical data, no other tables touched), and keeps OpenClaw's plain-English flexibility. Stat corrections, if ever needed, happen via the admin panel.

**Outcome:** Original Edge Function + shared-secret pattern is **superseded**. OpenClaw uses Supabase REST (PostgREST) with an INSERT-only credential scoped to `stats`. Implementation mechanism is a `@plan`-time choice — see ASSUMPTION-06.

**Status:** [x] Resolved

---

### [ASSUMPTION-04] Tailwind/shadcn isolation in Next.js App Router

**Category:** Technical feasibility

**Assumption:** Next.js (App Router) can host the verbatim public bundle (raw CSS variables + inline styles, no Tailwind) AND the admin panel (Tailwind + shadcn/ui) at `/admin/*` without style bleed in either direction.

**Why it's critical:** If Tailwind utilities or shadcn's reset bleed into public routes, the verbatim-bundle rule in `docs/design-decisions.md` is violated and the public site visually drifts. If isolation is impossible, the project must either keep public site as static files outside Next.js or abandon shadcn for admin.

**Resolution approach:** Research

**Resolution detail:** Achievable but requires three coordinated moves:
1. **Tailwind v4:** `@source "./app/admin/**/*.{ts,tsx}"` inside the admin-only CSS file. **Tailwind v3:** scope `content` glob to `./app/(admin)/**/*` and `./components/admin/**/*`.
2. Import the Tailwind/shadcn CSS file ONLY in `app/(admin)/layout.tsx`, not the root layout. Next.js permits importing global CSS in any layout; scope follows the route subtree.
3. **Caveat — Preflight reset.** Tailwind's Preflight uses bare-element selectors (`html`, `body`, `*`) and leaks globally via the CSS cascade even when imported in a nested layout. Mitigation: disable Preflight (`corePlugins.preflight: false` v3, or skip `@import "tailwindcss/preflight"` v4) and use the `tailwindcss-scoped-preflight` plugin to wrap reset rules under `.admin-root`.

Fonts isolate cleanly via `next/font` per layout — admin uses Inter, public uses Fraunces + JetBrains Mono.

Sources verified: Next.js CSS Styling docs; shadcn/ui Next.js install guide; `tailwindcss-scoped-preflight` package.

**Outcome:** Validated with caveat. `@plan` must include the scoped-preflight setup as a binding architecture step at the time of Next.js migration.

**Status:** [x] Resolved

---

### [ASSUMPTION-05] Supabase free tier capacity

**Category:** Cost

**Assumption:** Supabase free tier covers the project's realistic usage at $0/month.

**Why it's critical:** Project budget is $0 (Vercel + Supabase free tiers only). If real usage exceeds free-tier limits, the project either incurs cost (violates kickoff constraint) or breaks.

**Resolution approach:** Research

**Resolution detail:** Free tier limits (May 2026): 500 MB database, 1 GB Storage (50 MB/file cap), 50,000 MAU, 5 GB DB egress + 5 GB cached egress / month, 500K Edge Function invocations / month, max 2 active projects, project paused after 1 week of inactivity (one-click resume, no data loss), no daily backups.

Project profile:
- **Database:** <10 MB over the first year (well under 500 MB)
- **Storage:** ~75 MB projected for 50 image-bearing posts (~8% of cap; years of headroom)
- **MAU:** 1 (Swarnim — admin only; public visitors do not count)
- **Bandwidth:** dominated by Vercel CDN, not Supabase
- **Edge / API calls:** ~5/day from OpenClaw, occasional admin actions

The 1-week pause rule is the only operational risk. Mitigated by daily OpenClaw stat ingest activity keeping the project warm.

Sources verified: Supabase Pricing page; Storage file limits docs.

**Outcome:** Validated. Comfortable fit on every dimension with substantial headroom. No budget breach risk at expected scale.

**Status:** [x] Resolved

---

### [ASSUMPTION-06] Supabase INSERT-only scoping for OpenClaw

**Category:** Service capability

**Assumption:** Supabase supports cleanly granting an external agent INSERT-only access to one table (`stats`) with no SELECT, UPDATE, DELETE, or access to any other table.

**Why it's critical:** Option B from ASSUMPTION-03 depends on this. If Supabase cannot scope access this tightly via supported patterns, the project must fall back to an Edge Function gateway.

**Resolution approach:** Research

**Resolution detail:** Validated. Current (2026) Supabase pattern:
1. New `sb_publishable_*` key (replaces deprecated `anon` key — legacy keys end-of-life Nov 1, 2025) used as `apikey` HTTP header.
2. RLS enabled on `stats`; single policy: `CREATE POLICY ins ON stats FOR INSERT TO anon WITH CHECK (true)`. No SELECT / UPDATE / DELETE policies = default-denied.
3. `GRANT INSERT ON stats TO anon` (RLS without GRANT = denied).
4. Every other table has RLS enabled with zero `anon` policies = fully denied.

**`@plan`-time architecture decision (deferred):** the publishable key is PUBLIC by design. A literal "publishable-key + RLS-allows-INSERT" implementation means anyone on the internet with the key (it'll be in the public site's JS bundle if reused there) can also insert into `stats`. To restrict to OpenClaw specifically, three options to choose from at `@plan`:
- **(a)** A tiny Edge Function gateway that validates a shared secret OpenClaw owns (~30 lines; brings the original shared-secret pattern back as a thin layer).
- **(b)** A separate Supabase publishable key reserved for OpenClaw only and never embedded in browser code.
- **(c)** Accept that public write to `stats` is acceptable (append-only stat-logging — worst case is spam that the admin can delete).

This choice is for `@cto` + `@supabase` + `@security` at `@plan`. The capability itself — Supabase supporting INSERT-only scoping — is validated.

Sources verified: Supabase API Keys docs; API key migration changelog; Securing Your API guide.

**Outcome:** Validated. Implementation mechanism deferred to `@plan`.

**Status:** [x] Resolved

---

## Summary

| # | Assumption | Category | Approach | Status |
|---|---|---|---|---|
| 01 | OpenClaw stat payload schema | Data availability | Research | Resolved |
| 02 | OpenClaw outbound HTTPS | Service capability | Research | Resolved |
| 03 | OpenClaw access model (kickoff supersession to Option B) | Service capability | Research | Resolved |
| 04 | Tailwind/shadcn isolation in Next.js | Technical feasibility | Research | Resolved |
| 05 | Supabase free tier capacity | Cost | Research | Resolved |
| 06 | Supabase INSERT-only scoping for OpenClaw | Service capability | Research | Resolved |

**Open count:** 0 — `@plan` may now run.

---

## Spike Notes

No spikes were written during this audit. All assumptions resolved via research and builder confirmation.

| Spike | Question answered | Result |
|---|---|---|
| — | — | — |

---

## Hand-off Notes for `@plan`

Implementation details deferred from this audit, to be decided at `@plan`:

1. **`stats` table schema** — single typed table vs. KV vs. per-category tables (ASSUMPTION-01). Owner: `@cto` + `@supabase`.
2. **Tailwind Preflight scoping** — adopt `tailwindcss-scoped-preflight` plugin at the time of Next.js migration (ASSUMPTION-04). Owner: `@cto`.
3. **OpenClaw access mechanism** — choose between (a) thin Edge Function gateway, (b) OpenClaw-only publishable key, or (c) open-public-write-with-spam-tolerance (ASSUMPTION-06). Owner: `@cto` + `@supabase` + `@security`.
4. **Kickoff-brief language is partially superseded.** `docs/kickoff-brief.md` describes OpenClaw writing via "Edge Function with shared-secret auth — sole entry point." That pattern is replaced by ASSUMPTION-03 Option B. `@plan` should record the new architecture in `docs/architecture.md` and `docs/constraints.md`. The kickoff brief is a frozen-in-time record and is left as-is.
