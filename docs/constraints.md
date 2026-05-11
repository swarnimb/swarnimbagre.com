# Constraints: swarnimbagre.com

**Date seeded:** 2026-05-06 (by `@plan` Phase 4)
**Last updated:** 2026-05-11 (session 7 — CONSTRAINT-14 added)

> Loaded by `@session-start` every session. Active binding decisions only — not history, not options considered. New constraints are added when `@plan`, `@cto`, or the builder makes a binding decision. A constraint is removed only when the decision is explicitly reversed, with the reversal noted in `docs/session-log.md`.

---

## Active Constraints

---

### [CONSTRAINT-01] Next.js 15 App Router from day one

**Decision:** The site is built on Next.js 15 (App Router) starting at the first commit. No Pages Router. No prior static-deploy phase.

**What it means in practice:** Every public route is an App Router route under `app/`. The static React-via-CDN bundle in `site/` is the design source — components are ported into Next.js, not served as standalone HTML. No middleware or build config is written for a static deploy that gets thrown away.

**Who decided and when:** `@plan` (Phase 2 architecture), 2026-05-06.

**What this closes off:** Hosting the public site outside Next.js (e.g., GitHub Pages static). Reverting requires unwiring Next.js routing, removing the admin panel route group, and re-architecting the Supabase auth integration.

---

### [CONSTRAINT-02] Single Supabase project, single Vercel project

**Decision:** Both Vercel and Supabase host exactly one project for swarnimbagre.com. No staging Supabase project. No separate Vercel project for admin.

**What it means in practice:** Production data is the only data. Migrations run against production. Vercel preview deploys connect to the same Supabase project as production. Local dev uses `.env.local` pointing at production for read access, with a local-only test row pattern for writes when needed.

**Who decided and when:** `@plan` (Phase 2 architecture), 2026-05-06. Aligned with the $0 budget constraint from kickoff.

**What this closes off:** Isolated staging environments, blue-green deploys, full integration testing against a non-production database. Reversing requires creating a second Supabase project (counts against the free tier's 2-project limit) and a CI step to apply migrations to both.

---

### [CONSTRAINT-03] Tailwind scoped to admin only

**Decision:** Tailwind CSS is imported in exactly one file (`styles/admin.css`), which is imported only by `app/(admin)/layout.tsx`. Tailwind's Preflight reset is scoped under `.admin-root` via `tailwindcss-scoped-preflight`. The public site bundle never sees Tailwind.

**What it means in practice:** No `className="px-4 text-lg"` style usage in any public component. Public styling is exclusively CSS variables from `site/colors_and_type.css` plus inline styles. Admin pages are wrapped in `<div className="admin-root">`. Tailwind config's `content` glob excludes public routes.

**Who decided and when:** `@plan` (Phase 2 architecture, resolves ASSUMPTION-04), 2026-05-06.

**What this closes off:** Using a Tailwind utility on a public component. Reversing means removing the scoping plugin, refactoring the public bundle to avoid global reset collisions, and abandoning the verbatim-bundle rule.

---

### [CONSTRAINT-04] OpenClaw writes only via Edge Function `stats-ingest`

**Decision:** OpenClaw's only path into the database is the `stats-ingest` Edge Function. The function validates a shared secret in `X-Stats-Secret` using a constant-time comparison (SEC-04 timing-attack mitigation) and inserts via the service role. No publishable-key direct INSERT path is exposed.

**What it means in practice:** The `stats` table has no `INSERT` RLS policy for `anon`. The shared secret lives only in Supabase Edge Function env and OpenClaw's config — never in the public app bundle. Rotating the secret is a two-place operation. The Edge Function is the sole programmatic write path on the project.

**Who decided and when:** `@plan` (Phase 2 architecture, resolves ASSUMPTION-06 with locked option (a)), 2026-05-06.

**What this closes off:** A direct PostgREST + publishable-key write path for OpenClaw. Reversing means publishing a key that is intentionally public-on-the-internet and accepting that anyone can spam the `stats` table.

---

### [CONSTRAINT-05] Public bundle is verbatim — inviolable

**Decision:** The design bundle at `docs/design-source/personal-site-web/` is the source of truth for every public-site visual decision. No Tailwind, no shadcn, no Aceternity, no Magic UI on the public site. New public components extend `site/components.jsx` / `site/mobile-components.jsx`; tokens come from `site/colors_and_type.css`.

**What it means in practice:** A new public-site visual pattern requires either (a) finding the matching pattern in the bundle, or (b) stopping work and consulting `@designer`. No improvisation, no "close enough" substitutes, no library defaults. Same hex codes, same px values, same 220ms `cubic-bezier(.2, .7, .2, 1)` timing.

**Additive prop extensions to bundle-ported components are permitted** when (a) the component renders byte-identically with the new prop omitted — i.e., the default value equals the existing hardcoded content, so the bundle still renders verbatim at design time — and (b) interactive behavior (link `href`, form actions, navigation targets) is wired to real destinations. The verbatim rule governs rendered visual output: pixels, motion, typography. It does not govern prop interfaces or runtime behavior. A new *visual* pattern (different layout, new component, off-bundle styling) still requires (a) match in bundle or (b) `@designer` consult per above.

**Who decided and when:** Kickoff + `@designer`, 2026-05-05. Reaffirmed at `@plan`, 2026-05-06.

**What this closes off:** Faster iteration on public-site visuals using off-the-shelf libraries. Reversing means accepting visual drift from the bundle and re-deriving design decisions in conversation, which is what the bundle was created to avoid.

---

### [CONSTRAINT-06] Markdown rendered via `marked` + DOMPurify whitelist

**Decision:** Post content is stored as raw Markdown. Render path is `marked` (parse) → DOMPurify (sanitize) → DOM injection, executed client-side. Whitelist: `p, ul, ol, li, blockquote, code, pre, em, strong, a[href only], h1-h4, img[src, alt only]`.

**What it means in practice:** The DB never contains HTML. Every read sanitizes fresh. `<script>`, inline event handlers, `javascript:` URLs, and `<iframe>` are stripped. Adding a new allowed element (e.g., `<details>`) is a deliberate widening — re-evaluate XSS surface when changing the whitelist.

**Who decided and when:** `@plan` (Phase 2 architecture), 2026-05-06.

**What this closes off:** Storing pre-rendered HTML to skip per-read sanitization cost. Reversing means moving the trust boundary from "sanitize on read" to "sanitize on write" and accepting that any sanitizer bug becomes persistent in stored data.

---

### [CONSTRAINT-07] Image bucket path scheme is fixed

**Decision:** Image files in Supabase Storage live at `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. The `images` table tracks `bucket_path`, `alt_text` (NOT NULL), and the parent FK.

**What it means in practice:** Image upload code constructs paths in this format unconditionally. The orphan cleanup logic relies on the path encoding the parent type and id. Renaming or restructuring breaks orphan detection.

**Who decided and when:** `@plan` (Phase 2 architecture), 2026-05-06.

**What this closes off:** Flat-bucket layouts and per-image custom paths. Reversing means migrating existing files and rewriting the orphan-cleanup query.

---

### [CONSTRAINT-08] RLS default-deny on every table

**Decision:** Every table has RLS enabled at creation. No table has a permissive policy that grants access by default. Each access path is an explicit policy: anon read of published projects, anon read of published posts, anon read of all stats, anon read of images-of-published-parents, authenticated full CRUD for the admin.

**What it means in practice:** Adding a new table requires adding RLS policies in the same migration. A table without policies is fully denied — no role can read or write. Reviewers catch missing policies because the table is unusable until they exist.

**Who decided and when:** Kickoff (security stance) + `@plan` (architecture), 2026-05-06.

**What this closes off:** Quick-and-dirty new tables. Reversing means making "default-allow with deny exceptions" the policy stance, which inverts the security posture.

---

### [CONSTRAINT-09] Magic link auth, single user

**Decision:** Supabase Auth with Email provider only. Magic link flow. One account: swarnim.build@gmail.com. JWT 1 hour, refresh 30 days inactivity (Supabase defaults). Lockout fallback is manual session invalidation in the Supabase dashboard.

**What it means in practice:** No password storage. No social login. No multi-user logic. The middleware's auth check is pure session-presence — no role check is needed because there is exactly one user. Adding a second user is a non-trivial feature.

**Who decided and when:** Kickoff + `@plan`, 2026-05-06.

**What this closes off:** Multi-user collaboration, role-based access, comments-with-accounts. Reversing means designing a user model, role system, and per-resource ownership checks (SEC-04).

---

### [CONSTRAINT-10] Hard-delete only, with confirm modal

**Decision:** Delete operations on `projects`, `posts`, `stats`, and `images` are hard-deletes — the row is removed from the database. Every delete in the admin UI is gated behind a confirm modal. There is no soft-delete column, no tombstone, no undo.

**What it means in practice:** Recovery from accidental delete is via Supabase backups (free tier: ad-hoc, not scheduled). The confirm modal is the only undo path. Builder accepts this trade.

**Who decided and when:** `@plan` (Phase 1 product), 2026-05-06.

**What this closes off:** Trash bins, recoverable deletes, "Recently deleted" admin views. Reversing means adding a `deleted_at` column to every relevant table, updating every read query to filter it, and writing a tombstone-cleanup job.

---

### [CONSTRAINT-11] Status enum: `draft` | `published`

**Decision:** Both `projects` and `posts` use a `status` enum with exactly two values: `draft` and `published`. RLS hides drafts from anonymous reads.

**What it means in practice:** No "scheduled", "archived", or "private" states. Visibility is binary. RLS policies use `WHERE status = 'published'` directly with no other states to consider.

**Who decided and when:** `@plan` (Phase 1 product), 2026-05-06.

**What this closes off:** Scheduled publishing, archive workflows, password-gated content. Reversing means widening the enum, updating RLS policies, and adding admin UI for the new states.

---

### [CONSTRAINT-12] Slug locked at DB level after publish

**Decision:** A BEFORE UPDATE trigger on `projects` and `posts` raises an exception if `slug` is changed while `status='published'`. The lock is enforced at the database, not just the app.

**What it means in practice:** Once a post or project is published, its URL is permanent. The admin UI disables the slug field for published rows; any code path that bypasses the UI still hits the trigger. This is a contract with anyone who has linked to a published page.

**Who decided and when:** `@plan` (Phase 1 product), 2026-05-06.

**What this closes off:** Slug edits on published content. Reversing means dropping the trigger and accepting URL-rot as a possibility.

---

### [CONSTRAINT-13] Voice — dry, anti-LinkedIn, no SaaS jargon, no emoji

**Decision:** All copy on the public site and in admin labels follows a dry, self-deprecating, anti-marketing voice. Forbidden: superlatives ("amazing", "powerful"), SaaS phrases ("AI-powered", "next-gen", "seamless"), LinkedIn-motivational tone, emoji.

**What it means in practice:** Every label, button, error message, and microcopy decision passes the voice rule. "Powerful admin tools" is wrong; "Admin" is right. Decorative emoji are forbidden; typographic symbols (※, ¶, *, →) are allowed in moderation. The rule applies to private admin labels even though no visitor sees them — voice discipline is for the builder, not the audience.

**Who decided and when:** Kickoff + `@designer` + `@plan`, 2026-05-06.

**What this closes off:** Conventional marketing copy patterns. Reversing means rewriting every label and microcopy, and doing so under a different brand premise.

---

### [CONSTRAINT-14] Server-Component data loads must go through `lib/safe-load.ts`

**Decision:** Any public-route Server Component that calls a `lib/db.ts` read function MUST wrap the call in `safeLoad(load, fallback, context)` from `lib/safe-load.ts`. The wrapper catches thrown `ServiceError`s (and any other error), logs structured context (operation, error code, error message, stack) to stderr in the same shape as `logDbError`, then returns the caller-supplied fallback. Pages with no row to render return an empty-state UI, not a 500.

**What it means in practice:** Every list page (`app/projects/page.tsx`, `app/writing/page.tsx`, `app/other/page.tsx`) and every detail page's `generateMetadata` + page body load uses `safeLoad`. A DB failure (env misconfigured, RLS denying, network blip) becomes "empty content, logged error" rather than "Application error" 500 in the user's face. Detail pages still dispatch `notFound()` on null result — that path is `safeLoad` + `if (!row) notFound()`.

**Carve-out:** `safeLoad` is the UI-boundary catch. It is NOT a generic silent-catch — its JSDoc explicitly documents that calling it from non-boundary call sites (inside `lib/`, in mid-render helpers) is a violation of EH-01. Boundary-only.

**Who decided and when:** `@dev` Targeted Fix (BLOCKING-01 from `docs/qa-report.md`), 2026-05-11 session 7.

**What this closes off:** Letting `ServiceError` bubble to Next.js's default error UI on user-facing pages. Reversing means accepting that a transient DB issue, an env-var typo, or an RLS misconfiguration crashes the page rather than degrading. Detail pages had this latent bug for two sessions before seed data exposed it.

---

### [CONSTRAINT-15] Image reads use signed URLs (TTL 3600s), not public URLs

Image URLs are generated at request time via Supabase Storage `createSignedUrl(bucketPath, 3600)`. `getPublicUrl` must not be used for the `images` bucket — the bucket is private per migration `005_rls_images.sql` and public URLs return 404. Signed-URL generation is centralized in `lib/images.ts::getImageUrl`. TTL is fixed at 3600 seconds: long enough for a typical reading session, short enough to limit leaked-URL exposure. Components consuming images (`ProjectImage`, `PostImage`) must call `getImageUrl` rather than constructing URLs directly.

---

## Summary Table

| # | Decision | Practical impact | Decided by | Date |
|---|---|---|---|---|
| 01 | Next.js 15 App Router from day one | No prior static-deploy phase | `@plan` | 2026-05-06 |
| 02 | Single Supabase + Vercel project | No staging environment | `@plan` | 2026-05-06 |
| 03 | Tailwind scoped to admin only | No Tailwind on public site | `@plan` | 2026-05-06 |
| 04 | OpenClaw via Edge Function | Shared-secret header only write path | `@plan` | 2026-05-06 |
| 05 | Public bundle verbatim | No library substitutions on public site | `@designer` + `@plan` | 2026-05-06 |
| 06 | Markdown via marked + DOMPurify | Whitelist enforced; DB stores raw MD | `@plan` | 2026-05-06 |
| 07 | Image bucket path scheme | Path encodes parent type and id | `@plan` | 2026-05-06 |
| 08 | RLS default-deny on all tables | Every new table needs explicit policies | `@plan` | 2026-05-06 |
| 09 | Magic link auth, single user | No multi-user logic anywhere | Kickoff + `@plan` | 2026-05-06 |
| 10 | Hard-delete with confirm modal | No soft-delete, no undo | `@plan` | 2026-05-06 |
| 11 | Status enum: draft \| published | Binary visibility, no scheduling | `@plan` | 2026-05-06 |
| 12 | Slug locked at DB level after publish | URLs permanent on publish | `@plan` | 2026-05-06 |
| 13 | Voice — dry, anti-LinkedIn, no emoji | Applies to public copy AND admin labels | Kickoff + `@plan` | 2026-05-06 |
| 14 | Server-Component data loads via `lib/safe-load.ts` | Page-level catch + log + fallback; no 500 on DB failure | `@dev` Targeted Fix | 2026-05-11 |
