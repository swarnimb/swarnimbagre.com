# Constraints: swarnimbagre.com

**Date seeded:** 2026-05-06 (by `@plan` Phase 4)
**Last updated:** 2026-08-22 (CONSTRAINT-05 gained an tenth recorded deviation for the T48 full-screen image viewer, carrying the rule that project media is content and never design input. Previously 2026-08-07: status notes re-verified against code and live DNS; all three items formerly flagged `> OPEN` are now resolved — D-3 and D-11 by builder decision, D-6 by `@designer` sign-off. No open items remain.)

> Loaded by `@session-start` every session. Active binding decisions only — not history, not options considered. New constraints are added when `@plan`, `@cto`, or the builder makes a binding decision. A constraint is removed only when the decision is explicitly reversed, with the reversal noted in `docs/session-log.md`.

---

## Active Constraints

---

### [CONSTRAINT-01] Next.js 15 App Router from day one

**Decision:** The site is built on Next.js 15 (App Router) starting at the first commit. No Pages Router. No prior static-deploy phase.

**What it means in practice:** Every public route is an App Router route under `app/`. The design source is ported into Next.js components, never served as standalone HTML. No middleware or build config is written for a static deploy that gets thrown away. (The design source is now the T46 export — see CONSTRAINT-05. The `site/` CDN bundle this originally named is retired and kept only as a historical record.)

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

**Decision:** Tailwind CSS is imported in exactly one file (`app/styles/admin.css`), which is imported only by `app/(admin)/layout.tsx`. Tailwind's Preflight reset is scoped under `.admin-root` via `tailwindcss-scoped-preflight`. The public site bundle never sees Tailwind.

**What it means in practice:** No `className="px-4 text-lg"` style usage in any public component. Public styling is exclusively tokens from `app/styles/colors_and_type.css` plus the hand-written component classes in `app/styles/public*.css`. Admin pages are wrapped in `<div className="admin-root">`. Tailwind's `content` glob in `tailwind.config.ts` lists only `app/(admin)/**`, `components/admin/**` and `components/ui/**`; `corePlugins.preflight` is off and the reset is re-applied under `.admin-root` by `scopedPreflightStyles` + `isolateInsideOfContainer`.

**Who decided and when:** `@plan` (Phase 2 architecture, resolves ASSUMPTION-04), 2026-05-06.

**What this closes off:** Using a Tailwind utility on a public component. Reversing means removing the scoping plugin, refactoring the public bundle to avoid global reset collisions, and abandoning the verbatim-bundle rule.

---

### [CONSTRAINT-04] OpenClaw writes only via Edge Function `stats-ingest`

**Decision:** OpenClaw's only path into the database is the `stats-ingest` Edge Function. The function validates a shared secret in `X-Stats-Secret` using a constant-time comparison (SEC-04 timing-attack mitigation) and inserts via the service role. No publishable-key direct INSERT path is exposed.

**What it means in practice:** The `stats` table has no `INSERT` RLS policy for `anon`. The shared secret lives only in Supabase Edge Function env and OpenClaw's config — never in the public app bundle. Rotating the secret is a two-place operation. The Edge Function is the sole programmatic write path on the project.

**Who decided and when:** `@plan` (Phase 2 architecture, resolves ASSUMPTION-06 with locked option (a)), 2026-05-06.

**What this closes off:** A direct PostgREST + publishable-key write path for OpenClaw. Reversing means publishing a key that is intentionally public-on-the-internet and accepting that anyone can spam the `stats` table.

---

### [CONSTRAINT-05] Public design source is verbatim — inviolable

> **RE-BASELINED at T46 (2026-08-04).** The constraint stands; its *subject* changed. The original dark bundle at `docs/design-source/personal-site-web/` is retired, along with Overrides 1, 2 and 3, which described surfaces that no longer exist. Same for `site/`, `site/components.jsx` and `site/mobile-components.jsx` — historical record only, never build against them.

**Decision:** The Claude Design export at `docs/design-source/redesign-2026-08/` is the source of truth for every public-site visual decision. `template.extracted.html` is the readable unpacked markup; `swarnim-bagre-site.bundled.html` is the shipped artifact it came from. No Tailwind, no shadcn, no Aceternity, no Magic UI on the public site. Tokens come from `app/styles/colors_and_type.css`; component classes from `app/styles/public*.css`.

**What it means in practice:** A new public-site visual pattern requires either (a) finding the matching pattern in the export, or (b) stopping work and consulting `@designer`. No improvisation, no "close enough" substitutes, no library defaults. Same hex codes, same px values, same `clamp()` expressions, same transition timing (`.18s ease` hover, `.4s cubic-bezier(.4, 0, .2, 1)` carousel track). **One width breakpoint: 640px.** (`public-other.css` additionally carries a `max-height: 600px` guard so the viewport-locked Other grid survives short windows; that is a height guard, not a second device breakpoint.)

**Additive prop extensions are permitted** when (a) the component renders identically with the new prop omitted and (b) interactive behavior is wired to real destinations. The verbatim rule governs rendered visual output: pixels, motion, typography. It does not govern prop interfaces or runtime behavior.

**Deliberate, recorded deviations from the export** (these are the design as built, not drift):
- The blinking `.h-cursor` caret is removed. It faked a mid-typing state that never resolved and read as a bug.
- The home page has no fourth "Email him" pill. It is replaced by a "Find me here:" row of three branded marks, which are the only saturated color anywhere on the site.
- Every page footer is removed; the export has none.
- `/writing/[slug]` exists. The export pointed every list row back at the list itself, which would have left post bodies unreachable.
- The carousel is hand-rolled, not embla-backed. See the CONSTRAINT-22 note below.
- Copy is first person throughout, including the home bio, which the export wrote in third person.
- The home page root (`.hpage` in `app/styles/public-home.css`) is sized in `svh`, not `vh`. `vh` resolves to the LARGE viewport — the height with the browser's toolbars retracted — so on Chrome for Android/iOS the box was taller than the visible area and `.h-conv`'s `margin: auto 0` centred the conversation inside that oversized box, pushing one end off screen. `svh` is the height guaranteed visible WITH the bars present; `dvh` was rejected because it tracks the bars as they move and would slide the centred content during scroll. **The two `min-height` declarations in `.hpage` are a deliberate fallback pair:** `min-height: 100vh` sits directly above `min-height: 100svh` to serve engines without `svh`. Do not tidy the duplicate away. **The fallback pair propagated to `app/styles/base.css`** (`html, body`, lines 13–14) at `a499372`: leaving the body floor on plain `vh` undid the Home fix, because the floor then sat ~120px taller than Home's own `100svh` box and that gap was dead scrollable space. `app/styles/public-other.css` keeps `.cpage { height: 100vh; overflow: hidden }` at full height, but releases it to `height: auto; overflow: visible` under both `max-width: 640px` and `max-height: 600px` — the latter is what lets `/other` scroll on a phone held sideways.
- `.cpage` in `app/styles/public-other.css` releases its height lock to `height: auto` under **both** `max-width: 640px` and `@media (max-height: 600px)`. The width release alone left a landscape phone (wider than 640px) locked, so `overflow: hidden` clipped the bottom tile rows with no scroll to recover them — width is the wrong question to ask about a height lock. The row `flex: none` inside that block is load-bearing, not cosmetic: rows divide a fixed height with `flex: 1`, so once the height goes `auto` there is no free space to divide and a `flex-basis: 0` row collapses to nothing.
- `app/error.tsx` and `app/not-found.tsx` exist. The export ships four pages and neither an error state nor a 404, so both are new compositions. They introduce no new class, token, hex, px or `clamp()`: the shell is `.container` + `SiteHeader` + `.title-block` / `.page-title` / `.page-lede`, and the escape row is the export's off-home action pill (`.sb-actions` / `.sb-action` / `--primary` / `--secondary`, export `:358-367`), not home's `.h-actions` / `.h-btn`. Home's pills stay home-only on purpose: they are the navigation home does not otherwise have (`public-home.css:5-6`), and they carry no `min-height`, which computes to ~31.5px on mobile and is wrong for the one control a dead-end page exists to offer. `.sb-action` is 44px / 42px. One CSS line was added under this sign-off: `cursor: pointer` on `.sb-action` (`app/styles/public-projects.css`), needed because the retry on `error.tsx` is a `<button>` and the export only ever renders that pill as an `<a>`. Standing rule: system pages (404, error, future `loading.tsx`) compose the shared shell plus `.sb-action`; `h-*` classes never leave the home page. Signed off by `@designer`, 2026-08-07 (closes D-6).
- `components/public/ImageLightbox.tsx` and `app/styles/public-lightbox.css` exist (T48, 2026-08-22). The export ships no full-screen overlay pattern at all, so the viewer is a new composition. It was resolved through this recorded-deviation list rather than an `@designer` consult because nearly every element is reused verbatim from `ProjectFrame` and `app/styles/`: the `‹` / `›` glyphs, the counter pill, the `.sb-live` region, the assistive-technology vocabulary, the 44px control pills, and the whole token set. **The rule governing the one genuinely new visual decision — the scrim — is that project media is content, never design input.** Every project on this site has its own design and its own palette, so no design decision about swarnimbagre.com may be derived from what a project's screenshots look like: a rule read off AmIBroke's near-black dashboards would invert on the next project's light ones. The scrim is therefore derived from the site palette alone and is cream/deep-green, **not** the near-universal dark scrim — `background: var(--bg)` sits directly above `background: color-mix(in srgb, var(--bg) 92%, var(--accent))`, a deliberate fallback pair on the same pattern as the `vh`/`svh` declarations above, so neither line is a duplicate to tidy away. The content-agnostic consequence: because the viewer must display arbitrary imagery it knows nothing about, **the image carries its own edge** — a `var(--border)` hairline over a `var(--surface)` backing at `var(--r-card)` — so it reads as a distinct object against the scrim regardless of what it contains. The edge is not a workaround for dark screenshots; it is the property that makes the viewer indifferent to project design. **Two new numbers, both deliberate: `--z-lightbox: 100` and the `92%` mix ratio, both in `app/styles/public-lightbox.css`.** The mix ratio produces a colour that appears nowhere in the export — it satisfies "no new hex" by being derived from two tokens rather than written as one, which is the honest description of it. The public bundle has no z-index scale — `.mmenu`'s `z-index: 50` (`app/styles/public.css:100`) is the only one in `app/styles/`, and the overlay has to clear it. No new hex, no new timing curve, no new breakpoint. Recorded by the builder, 2026-08-22.

> **Lesson worth keeping, because it will recur: an empty-state fallback can hide an export deviation indefinitely.** `.ctile` / `.ttile` shipped missing the export's `justify-content: center` (`template.extracted.html:447` and `:463`), pinning every tile's content to the top of a box several times its own height. It survived T46, two security audits and a full test suite — not because anyone looked and missed it, but because it was **unreachable**: `stats` and `notes` were both at 0 rows, so `/other` rendered the `.cempty` state and the tile grid never existed in the DOM. The first real content is what surfaced it. Treat any public surface with an empty-state branch as **unverified against the export until it has been seen with real rows in it** — passing tests and a clean build say nothing about a branch that never rendered.

**Overrides:** none active. Overrides 1, 2 and 3 were retired with the bundle they amended.

**Who decided and when:** Kickoff + `@designer`, 2026-05-05. Re-baselined onto the new export at T46, 2026-08-04, after real user feedback that the original design was confusing and disliked.

**What this closes off:** Faster iteration on public-site visuals using off-the-shelf libraries. Reversing means accepting visual drift from the export and re-deriving design decisions in conversation, which is what having a canonical design source exists to avoid.

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

**What it means in practice:** Adding a new table requires adding RLS policies in the same migration. A table without policies is fully denied — no role can read or write. Reviewers catch missing policies because the table is unusable until they exist. Tables added after the original enumeration follow the same shape and are policied in their own migration — `project_media` (010) and `notes` (014). `service_role` is deliberately never granted a policy on any table: it bypasses RLS, and giving it one would imply a permissive path that does not exist.

**Who decided and when:** Kickoff (security stance) + `@plan` (architecture), 2026-05-06.

**What this closes off:** Quick-and-dirty new tables. Reversing means making "default-allow with deny exceptions" the policy stance, which inverts the security posture.

---

### [CONSTRAINT-09] Magic link auth, single user

**Decision:** Supabase Auth with Email provider only. Magic link flow. One account: the configured admin email (held in `ADMIN_ALLOWED_EMAIL` and the Supabase Auth user record; intentionally not committed to the repo). JWT 1 hour, refresh 30 days inactivity (Supabase defaults). Lockout fallback is `scripts/recover-admin-session.ts`, which mints a session without any email: holding `SUPABASE_SERVICE_ROLE_KEY`, it calls `auth.admin.generateLink({ type: 'magiclink' })` for `ADMIN_ALLOWED_EMAIL`, takes the returned `properties.hashed_token`, and prints a single `{origin}/admin/auth/callback?token_hash=<hash>&type=email` URL. Opening that URL in a browser drives this app's own callback, which redeems the token with `verifyOtp` and writes the session cookies — Supabase's `/auth/v1/verify` endpoint, the Site URL and the redirect-URL allowlist are never consulted, which is why it works when the dashboard's own link flows do not. Its limits: it is unavailable to anyone who has lost the service-role key; the Supabase user record must already exist, because `generateLink` does not create one; and the printed URL is single-use, expires on the project's email-OTP expiry (1 hour by default), and is a live credential — a session in a string — so it is never pasted into chat, a ticket, or a commit. The full ordered fallback ladder, including the email-based steps and the Supabase SMTP rate limit that caps them, is `docs/auth-flow.md` §5.

**What it means in practice:** No password storage. No social login. No multi-user logic. No role check is needed because there is exactly one user; the middleware gate and `assertAdminSession()` both verify the session server-side with `getUser()` (CONSTRAINT-23). Adding a second user is a non-trivial feature.

**Amended 2026-08-07 (D-3):** the fallback clause previously read "manual session invalidation in the Supabase dashboard". That was never a recovery path — invalidating a session ends one, it does not create one — and `docs/auth-flow.md` §5.1 records it as having never worked. It is replaced above by the mechanism that does work. Only the fallback clause changed; magic-link auth, the single account and the allowed-email gate are unchanged.

**Who decided and when:** Kickoff + `@plan`, 2026-05-06. Fallback clause corrected by the builder, 2026-08-07.

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

**Em-dash sub-rule (added 2026-08-07, D-11):** no em-dash (U+2014) in a **shipped string**. A shipped string is anything that can reach a screen or a log: public-site copy, page titles and route metadata, admin labels and microcopy, error and log message text. **The rule stops there.** It does NOT apply to documentation (this file included), code comments, test names, or commit messages — all of which use em-dashes freely throughout this project and are deliberately left alone. Do not sweep them. What to use instead, as established by the sweep in commit `b6f5c82`: a middle dot (`·`) where the dash separated two title-like halves (the three public page titles, the admin pagination line); a plain hyphen for the orphan-cleanup null-size placeholder; a colon where the dash introduced an explanation (the two `logMutationError` warnings, and `ValidationError`, whose message was rephrased to `Validation failed for {field}: {reason}`). In prose, recast the sentence with a comma, a full stop or parentheses rather than swapping the glyph — an em-dash mid-sentence is a structural choice, not a punctuation mark with a drop-in replacement.

**Assistive-technology sub-rule (added 2026-08-11):** the voice rule governs what a visitor **sees**. Strings that exist only for assistive technology — `aria-label`, `aria-live` region text, and anything else no sighted visitor reads — are exempt from the terseness half of it and must be **unambiguous first**. Concretely: `ProjectFrame.tsx` ships `Previous image of {title}` / `Go to image N of {title}` / `Image N of M: {alt}`, not the terse `Slide 1` that T43.A specified in May. Several carousels stack on `/projects`, and `Slide 1` alone does not tell a screen-reader user which project they are paging through — style was being bought at the cost of the only thing those strings exist to do. **The rest of the rule still binds them:** they are shipped strings for the emoji ban and the em-dash sub-rule above, and prose is licensed only where it disambiguates, not as a licence for marketing tone. Visible chrome is untouched by this — the carousel's `‹` / `›` glyphs stay glyphs.

**Who decided and when:** Kickoff + `@designer` + `@plan`, 2026-05-06. Em-dash sub-rule added by the builder, 2026-08-07, adopting the `b6f5c82` sweep as standing policy. AT sub-rule added by the builder, 2026-08-11, resolving the T46 ARIA-phrasing drift in favour of the shipped code and retiring the T43.A wording.

**What this closes off:** Conventional marketing copy patterns. Reversing means rewriting every label and microcopy, and doing so under a different brand premise.

---

### [CONSTRAINT-14] Server-Component data loads must go through `lib/safe-load.ts`

**Decision:** Any public-route Server Component that calls a `lib/db.ts` read function MUST wrap the call in `safeLoad(load, fallback, context)` from `lib/safe-load.ts`. The wrapper catches thrown `ServiceError`s (and any other error), logs structured context (operation, error code, error message, stack) to stderr in the same shape as `logDbError`, then returns the caller-supplied fallback. Pages with no row to render return an empty-state UI, not a 500.

**What it means in practice:** Every list page (`app/projects/page.tsx`, `app/writing/page.tsx`, `app/other/page.tsx`) and the `/writing/[slug]` detail page's `generateMetadata` + page body load uses `safeLoad`. A DB failure (env misconfigured, RLS denying, network blip) becomes "empty content, logged error" rather than "Application error" 500 in the user's face. Detail pages still dispatch `notFound()` on null result — that path is `safeLoad` + `if (!row) notFound()`. `app/sitemap.ts` (T41) counts as a boundary for this purpose and uses `safeLoad` too: a failed query degrades to "roots only" rather than 500-ing on the crawler's request.

**Carve-out:** `safeLoad` is the UI-boundary catch. It is NOT a generic silent-catch — its JSDoc explicitly documents that calling it from non-boundary call sites (inside `lib/`, in mid-render helpers) is a violation of EH-01. Boundary-only.

**Who decided and when:** `@dev` Targeted Fix (BLOCKING-01 from `docs/qa-report.md`), 2026-05-11 session 7.

**What this closes off:** Letting `ServiceError` bubble to Next.js's default error UI on user-facing pages. Reversing means accepting that a transient DB issue, an env-var typo, or an RLS misconfiguration crashes the page rather than degrading.

---

### [CONSTRAINT-15] Image reads use public Storage URLs

**AMENDED 2026-08-25 (Session 61). This reverses the original rule, which required `createSignedUrl(bucketPath, 3600)` and forbade `getPublicUrl`.**

The `images` bucket is public as of migration `017_public_images_bucket.sql`. `lib/images.ts::getImageUrl` returns `getPublicUrl(bucketPath)`. Resolution is now pure string construction with no network call, so it cannot fail transiently. Components must still call `getImageUrl` rather than building URLs by hand, so the bucket name and path shape stay in one place.

**Why it was reversed.** Signed URLs cost two things:

1. `/projects` is `force-dynamic`, so every request re-signed every image. `resolveImageUrl` and `resolveMediaImage` each wrapped that call in a try/catch that returned `null`, so one transient Storage failure rendered as a silently missing image. Images appeared and disappeared between reloads and nothing surfaced except a server log.
2. A URL carrying a 1-hour token cannot be optimised or edge-cached by `next/image`, so every cold visitor downloaded full-size originals. The largest carousel PNG is roughly 441KB.

Every object in this bucket is a screenshot of a public demo already linked from the site, so the private bucket protected nothing that was not already published.

**Accepted trade-off.** Objects belonging to unpublished drafts are readable by anyone who knows the path. Row-level security on `public.images` (migration 005) still hides the *records* from `anon`, so drafts never surface in the UI; only direct object URLs are reachable. Builder approved 2026-08-25.

**What this closes off.** Reintroducing signed URLs for this bucket, and reintroducing catch-and-null around image resolution. A failure to resolve an image is now a real fault and must reach the page's `safeLoad` boundary rather than rendering as an absent image.

---

### [CONSTRAINT-16] Admin color tokens namespaced as `--admin-*`

Admin owns 8 color tokens, all namespaced under `--admin-*` — NOT as bare `--bg`, `--surface`, `--fg`, `--accent`, etc. (those names are owned by the public site's `:root` block in `app/styles/colors_and_type.css`).

**T46 amendment (2026-08-04):** these were originally described as *borrowed* from the public palette. They are now **admin-owned constants**. The public site went light (cream `#F4F1EA`, deep-green accent `#1F3D2F`) in the T46 redesign; admin deliberately stayed dark. Admin is single-user and behind auth, so restyling it buys nothing externally, and dark is easier for long content-authoring sessions. The hex values below are therefore no longer a mirror of anything and must not be "resynced" to the public palette. This prevents cascade collisions if the public `:root` ever leaks into admin or vice versa. Tailwind's `theme.colors` config maps shadcn slot names to the `--admin-*` variables, so utility class names and shadcn component internals stay clean.

**The 8 tokens and their shadcn slot mappings:**

1. `--admin-bg` #1C1712 → shadcn `background`
2. `--admin-surface` #252018 → shadcn `card`, `popover`, `secondary`, `accent`, `muted` (background)
3. `--admin-fg` #E8E0D0 → shadcn `foreground`, `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground`
4. `--admin-accent` #C9A84C → shadcn `primary`, `ring`
5. `--admin-destructive` #B85C3C → shadcn `destructive` (sources hex from public `--danger`)
6. `--admin-destructive-fg` #F5E8D8 → shadcn `destructive-foreground` (high-contrast readable text on destructive bg)
7. `--admin-border` #3A3328 → shadcn `border`, `input` (sources hex from public `--hairline`)
8. `--admin-muted-fg` #7A7060 → shadcn `muted-foreground` (sources hex from public `--fg-muted`)

**Declaration site — `:root`, not `.admin-root` (amended 2026-05-19, Session 27):** All eight `--admin-*` variables are declared at `:root` in `app/styles/admin.css`. Names and values are unchanged; only the DECLARATION SITE moved. Visual chrome (`background-color`, `color`, `font-family`, `min-height`) stays on the `.admin-root` selector so the dark admin theme remains visually scoped. Reason: Radix UI primitives (`Select`, `DropdownMenu`, `Popover`, `Tooltip`) render overlay content via `Portal` at `document.body` — outside the `.admin-root` subtree. CSS custom properties are scope-bound to the selector they are declared on; `bg-popover` resolved to undefined when the overlay escaped `.admin-root`, producing transparent menus. Declaring the variables at `:root` makes them resolvable everywhere. The public site does not reference any `--admin-*`-mapped utilities (Tailwind is admin-only per CONSTRAINT-03), so this change is invisible on the public bundle. **Do not revert the declaration to `.admin-root` without first solving portal-resolvability another way** — doing so will re-break every Radix overlay in admin.

See `architecture.md` §4.2 and `founder-brief.md` "Admin CSS token namespacing" + "Admin theming tokens declared at `:root`". Established T15 (2026-05-11). Amended 2026-05-12 (session 12) — added 4 semantic shadcn tokens after `@designer` + `@cto` consultation. Amended 2026-05-19 (session 27) — declaration site moved to `:root` to resolve Radix portal escape. Rationale captured in `design-decisions.md` and `founder-brief.md`.

---

### [CONSTRAINT-17] Admin URL pattern locked to `/admin/*` (path-prefixed)

**Decision:** All admin routes live under `/admin/*`. Login at `/admin/login`. Dashboard at `/admin`. CRUD at `/admin/{projects,posts,stats,images}/...`. Magic-link callback at `/admin/auth/callback`. Middleware matcher: `['/admin/:path*']`. Public site never uses `/login`, `/dashboard`, or other admin-shaped root-level URLs.

**Rationale:** Single boundary alignment — URL boundary = layout boundary = Tailwind-scope boundary = middleware boundary = robots.txt boundary. Matches T17–T28 plan specs (already nested) and T15 implementation (`app/(admin)/admin/page.tsx`). Industry convention (Vercel, Supabase, GitHub, Linear all path-prefix).

**Who decided and when:** `@cto` consultation pre-T16, 2026-05-12.

**What this closes off:** Root-level admin URLs (`/login`, `/dashboard`). Does NOT close off future subdomain split (`admin.swarnimbagre.com`) — the `/admin/*` tree maps there trivially.

---

### [CONSTRAINT-18] Supabase SSR client locked to `flowType: 'implicit'`

**Decision:** `lib/supabase.ts::createServerClient` constructs the
`@supabase/ssr` client with `auth: { flowType: 'implicit' }`. The library's
PKCE default is not used.

**What it means in practice:** Magic-link callback consumes `?token_hash=&type=`
via `verifyOtp` (PKCE-agnostic). The `?code=...` branch in
`app/(admin)/admin/auth/callback/route.ts` is dead under this lock but is
retained for future OAuth. No `*-code-verifier` `Set-Cookie` is emitted on any
auth path, closing the response-header enumeration channel. Test guardrail:
`tests/auth-cookies.test.ts` asserts the production factory passes the option
through AND that no verifier cookie is written on any branch.

**Who decided and when:** T17 audit-round-3 fix (`@security` F-15 finding),
2026-05-12.

**What this closes off:** Switching back to PKCE without revisiting the
header-channel decomposition in `docs/auth-flow.md` §2a point 5. Adding an
OAuth provider (which requires PKCE) requires either a second client factory
or a re-evaluation of header uniformity under PKCE.

---

### [CONSTRAINT-19] Dev-only API routes use `process.env[NODE_ENV_KEY]` bracket indirection

**Decision:** Any route handler that must refuse to mount in production reads `NODE_ENV` via an intermediate constant — `const NODE_ENV_KEY = 'NODE_ENV'; process.env[NODE_ENV_KEY]` — NOT the direct `process.env.NODE_ENV` form. The gate must additionally include an explicit `if (process.env.VERCEL === '1')` refusal AND a `timingSafeEqual` shared-secret check (SEC-04). All three gates are independent; any single gate failure returns 404.

**What it means in practice:** Direct `process.env.NODE_ENV` access is folded into a literal at build time by Next 15's compile-time inlining. The dot-notation form becomes a constant `'development' !== 'test'` at build, defeating the runtime gate entirely. The bracket-with-variable form preserves the runtime read. Reviewers see `[NODE_ENV_KEY]` and recognize that the literal form would be a regression. Currently applies to `app/api/test/sign-in/route.ts`; any future dev-only API surface follows the same pattern.

**Who decided and when:** T19.2 implementation, `@dev`, 2026-05-12. Confirmed against a production build by `@security` audit 7: the bracket indirection survives Next 15 / SWC bundling and the runtime gate holds.

**What this closes off:** "Just use `process.env.NODE_ENV`" simplification PRs. The literal form is a build-time constant; the bracket form is a runtime check. They look identical but behave differently. Reversing requires either accepting the bundler's literal-substitution (and dropping the dev-route gate entirely) or migrating to a different runtime-only access pattern (e.g., `globalThis.process.env.NODE_ENV` — untested).

---

### [CONSTRAINT-20] Storage bucket RLS policies must accompany table FK migrations

**Decision:** Every Supabase Storage bucket in use must have an explicit RLS policy on `storage.objects` scoped to `bucket_id`, applied in the same migration that creates (or first references) the bucket. Policy MUST specify both USING and WITH CHECK clauses for INSERT / UPDATE writes to be permitted — a policy with USING alone denies INSERT because there is no clause to satisfy on the new row.

**What it means in practice:** Storage's RLS layer is separate from per-table RLS and must be considered explicitly during schema work. The Storage analogue of CONSTRAINT-08 (default-deny RLS on every table) — `storage.objects` is RLS-enabled by default in Supabase, so a bucket without a permissive policy is fully denied for `authenticated` and `anon`. New buckets get the same shape as `images_storage_admin_all` from migration 007: `for all to authenticated using (bucket_id = '<name>') with check (bucket_id = '<name>')`. The bucket-id predicate keeps each policy scoped so future buckets start default-denied.

**Who decided and when:** `@supabase` diagnosis + main-thread lock during T28 BLOCKING-02 resolution, 2026-05-14.

**What this closes off:** The "table policy is sufficient" assumption. Migration 005 created the `images` bucket but deferred its `storage.objects` policy, and the deferral was forgotten until the first real upload failed; migration 007 closed it. See `docs/founder-brief.md` (`storage.objects` RLS policy entry, 2026-05-14).

---

### [CONSTRAINT-21] Canonical domain is the apex `swarnimbagre.com` (no `www`)

**Decision:** The canonical public origin is the bare apex `https://swarnimbagre.com`. `www.swarnimbagre.com` is a non-canonical alias that redirects to the apex. Every origin-bearing setting must resolve to the apex: Vercel primary domain, Supabase Auth Site URL, Supabase redirect-URL allowlist, `NEXT_PUBLIC_SITE_URL`, and the magic-link email template's `{{ .SiteURL }}` base.

**What it means in practice:** One canonical host avoids split auth-cookie domains and a double redirect on the magic-link callback. **Reality now matches the constraint** (verified live 2026-08-07): `https://swarnimbagre.com` returns `200 OK` directly and `https://www.swarnimbagre.com` returns `308 Permanent Redirect` to it. The Vercel primary-flip that was outstanding at 2026-05-16 has been done. The auth callback no longer crosses an apex→www hop, and `app/robots.ts` and `app/sitemap.ts` inline the apex as `SITE_ORIGIN`, so crawlers are handed terminal URLs rather than redirecting ones.

**Who decided and when:** Main thread on the builder's behalf during the T39 launch (builder overwhelmed, delegated the call), confirmed by the builder at `@end-session`, 2026-05-16.

**What this closes off:** A `www`-canonical or dual-canonical setup. Reversing means re-pointing Vercel primary, Supabase Site URL + redirect allowlist, `NEXT_PUBLIC_SITE_URL`, and the email template base, then re-testing the magic-link callback end-to-end.

---

### [CONSTRAINT-22] JS libraries on the public site require a named Override and a 15 KB gzip budget

> **T46 status (2026-08-04): the constraint stands, but it currently has zero consumers.** Its only invocation was Override 2's `embla-carousel-react`. The redesigned carousel is hand-rolled — the export's version is a single transformed track with dots, arrows and a 40px swipe threshold, so matching it directly was both more faithful and one dependency fewer than restyling embla to imitate it. `embla-carousel-react` was uninstalled and Override 2 retired with the rest of the old bundle. **The public site is now back to zero runtime JS dependencies.** The rule below applies unchanged to the next library anyone proposes.

**Decision:** JS libraries on the public site are permitted only with a documented Override and ≤15 KB gzip total per Override surface (measured against the production route chunk, not published ESM).

**What it means in practice:** Adding a runtime npm dependency to any public-site code path is not a unilateral choice — it requires (a) a named Override entry in `docs/design-decisions.md` with a Surface boundary listing every file the library touches, and (b) a build-time measurement showing the route-chunk delta on the affected production route stays at or under 15 KB gzip. The measurement is taken from `next build` output on the route that mounts the new code (e.g., `/projects` First Load JS delta), not from the package's published ESM size on npm — bundler tree-shaking, code-splitting, and shared-chunk attribution make the published size a misleading proxy. Exceeding the budget triggers an `@cto` re-evaluation, not a silent absorption. The first invocation of this constraint is Override 2 (T43, `embla-carousel-react`), which measured ~11.7 KB gzip published ESM at T43.B and +8 KB First Load JS on `/projects` + `/projects/[slug]` at T43.H — both inside budget.

**Who decided and when:** `@cto` pre-T43.B consultation, Session 34, 2026-05-20. Codified at T43.I, 2026-05-23.

**What this closes off:** Adding a public-site JS library "to see if it works" without a documented surface and a route-chunk measurement. Reversing means accepting drift from CONSTRAINT-05's verbatim-bundle posture without a paper trail — the Override + budget pair is the mechanism that makes a deviation from CONSTRAINT-05 reviewable instead of incremental.

---

### [CONSTRAINT-23] Admin Server Actions call `assertAdminSession()` first, inside the `try`

**Decision:** Every Server Action that mutates admin-owned data calls `assertAdminSession()` (from `lib/session.ts`) as the first statement inside its `try` block — before any FormData read, zod parse, or database call. Authorization is two-layered: this application-layer check plus Postgres RLS. Neither layer alone is sufficient.

**What it means in practice:** Before this, admin authorization was single-layered on RLS. SEC-04 requires both an authentication check and a resource-level authorization check; RLS supplies only the second. It matters because Next.js dispatches a Server Action on the `Next-Action` header against whatever URL is POSTed. T46 narrowed the middleware matcher to `/admin/:path*`, so an action ID lifted from the client bundle could be POSTed to `/` — a path middleware never sees — and the action body would run with only RLS refusing it. Applies to all 17 admin mutation actions across 7 modules as of Session 52. A new admin mutation action is not finished until the call is in place.

**Placement is load-bearing.** The call goes INSIDE the existing `try`. Outside it, the rejection escapes `finally { await padToFloor(start) }` and becomes distinguishable by response time (SEC-09 Channel 3), and escapes the `catch` that produces the uniform envelope (Channel 2). The guard throws rather than returning a boolean, so a caller cannot silently ignore its result. It lives in a directive-free module so it does not itself become a Server Action, and therefore a wire-level "is an admin session present?" oracle (SEC-08). It uses `getUser()` — server-side signature verification — never `getSession()`, which only decodes the local cookie and checks `exp`; the same substitution was made at the `middleware.ts` gate.

**Exemption:** `lib/auth.ts` (`signInWithMagicLink`, `signOut`) is the single, deliberate exception. Guarding sign-in would lock the single user out of their own login.

**Who decided and when:** `@security` audit 24 finding F-39, Session 52, 2026-08-04.

**What this closes off:** Relying on middleware plus RLS alone to authorize admin mutations. Reversing means accepting that an action ID lifted from the client bundle can be invoked on a path middleware does not cover, with RLS as the only thing between the request and the write.

---

### [CONSTRAINT-24] Review outputs stay local; design outputs get committed

**Decision:** Documents that record the STATE of the work — security findings, QA findings, session logs, session handoff, framework issues — are gitignored and never committed. Documents that record WHAT TO BUILD — `prd.md`, `architecture.md`, `constraints.md`, the plan files, `design-decisions.md`, `kickoff-brief.md`, `founder-brief.md` — are committed deliberately.

**What it means in practice:** The repository is PUBLIC (`github.com/swarnimb/swarnimbagre.com`, verified `private: false` on 2026-08-06). A findings document in a public repo is a target-specific attack guide. When a new document type is created, classify it by this rule rather than waiting for SEC-07's filename list to be updated — the list is what failed here. `.gitignore` carries this rule as a comment on its SEC-07 section.

**Who decided and when:** Builder, 2026-08-06, Session 55, on discovering finding F-49.

**What this closes off:** Nothing structural. Note the residual: `docs/qa-report.md` and `docs/security-report.md` were tracked across 18 commits before this rule existed, and remain in the public history. Treat their prior contents as permanently disclosed.

---

### [CONSTRAINT-25] Lint gates the build

**Decision:** `eslint.config.mjs` exists at the repo root, so `next build` runs a lint pass over `app/`, `components/` and `lib/`. An error-level violation fails the build. **Do not set `eslint.ignoreDuringBuilds` in `next.config`**, and do not silence a rule to get a build green.

**What it means in practice:** Before 2026-08-12 there was no ESLint config in the repo, so `npm run lint` dropped into an interactive setup prompt and `next build` silently skipped its lint pass — lint had been doing nothing at all for the life of the project. Restoring the config restored the build-time gate as a side effect, and that gate is kept deliberately: it is the only automated check standing between a lint-class defect and production, and this project's error-handling rule is that failures are loud.

Two consequences worth knowing. First, `npm test` shells out to `npm run build` (via `tests/server-actions-manifest.test.ts`), so a lint error fails the test suite too — that is one gate, not two. Second, rule suppressions belong in `eslint.config.mjs` with a comment stating why, not as inline `eslint-disable` directives scattered through source. Inline directives outlive the problems they suppress: the two removed at S59 were both dead, and one had drifted three lines away from the violation it was aimed at.

Current deliberate suppressions, each carrying its reason in the config: `next-env.d.ts` and `supabase/functions/**` ignored (generated file; Deno toolchain), `^_` honoured as the unused-binding convention, and `@next/next/no-img-element` off. **Amended 2026-08-25:** the original reason (short-TTL signed URLs `next/image` cannot optimise) died with the CONSTRAINT-15 amendment, and the carousel in `ProjectFrame.tsx` now uses `next/image` with `fill`. The rule stays off because four `<img>` sites remain and each has a standing reason: `MarkdownContent.tsx` injects image nodes imperatively into the DOM, where a React component cannot be used at all; `ImageLightbox.tsx` and the two admin previews size themselves from the image's intrinsic dimensions via `max-width`/`max-height`, which `fill` would break and which `width`/`height` cannot supply because the `images` table stores no dimensions. Turning the rule on would mean four scattered file-level disables, which hides the reasoning rather than recording it. Revisit if image dimensions are ever persisted at upload.

**Who decided and when:** Builder, 2026-08-12, Session 59, on restoring the lint config at `bc97b8c`.

**What this closes off:** Treating a red build as a lint configuration problem. If lint fails the build, the fix is the code or a justified config-level rule change with a written reason — not disabling the gate. Reversing this means accepting that lint runs only when someone remembers to run it, which is the state that let it rot unnoticed in the first place.

---

## Summary Table

| # | Decision | Practical impact | Decided by | Date |
|---|---|---|---|---|
| 01 | Next.js 15 App Router from day one | No prior static-deploy phase | `@plan` | 2026-05-06 |
| 02 | Single Supabase + Vercel project | No staging environment | `@plan` | 2026-05-06 |
| 03 | Tailwind scoped to admin only | No Tailwind on public site | `@plan` | 2026-05-06 |
| 04 | OpenClaw via Edge Function | Shared-secret header only write path | `@plan` | 2026-05-06 |
| 05 | Public design source verbatim | No library substitutions on public site. Re-baselined onto `docs/design-source/redesign-2026-08/` at T46; Overrides 1/2/3 retired. **Closed 2026-08-07 (D-6):** `app/error.tsx` + `app/not-found.tsx` are accepted deviations — system pages compose the shared shell plus `.sb-action`; `h-*` classes stay home-only | `@designer` + `@plan`, re-baselined T46, D-6 signed off by `@designer` | 2026-05-06 / 2026-08-04 / 2026-08-07 |
| 06 | Markdown via marked + DOMPurify | Whitelist enforced; DB stores raw MD | `@plan` | 2026-05-06 |
| 07 | Image bucket path scheme | Path encodes parent type and id | `@plan` | 2026-05-06 |
| 08 | RLS default-deny on all tables | Every new table needs explicit policies | `@plan` | 2026-05-06 |
| 09 | Magic link auth, single user | No multi-user logic anywhere. **Amended 2026-08-07 (D-3):** lockout fallback is `scripts/recover-admin-session.ts` (service-role key required, no email involved), not dashboard session invalidation, which never worked | Kickoff + `@plan`, fallback corrected by builder | 2026-05-06 / amended 2026-08-07 |
| 10 | Hard-delete with confirm modal | No soft-delete, no undo | `@plan` | 2026-05-06 |
| 11 | Status enum: draft \| published | Binary visibility, no scheduling | `@plan` | 2026-05-06 |
| 12 | Slug locked at DB level after publish | URLs permanent on publish | `@plan` | 2026-05-06 |
| 13 | Voice — dry, anti-LinkedIn, no emoji | Applies to public copy AND admin labels. **Added 2026-08-07 (D-11):** no em-dash (U+2014) in shipped strings; docs, comments, test names and commit messages are exempt | Kickoff + `@plan`, em-dash sub-rule by builder | 2026-05-06 / amended 2026-08-07 |
| 14 | Server-Component data loads via `lib/safe-load.ts` | Page-level catch + log + fallback; no 500 on DB failure | `@dev` Targeted Fix | 2026-05-11 |
| 15 | Image reads use signed URLs (TTL 3600s) | `getImageUrl` centralized; no `getPublicUrl` for private bucket | `@plan` + T14 | 2026-05-11 |
| 16 | Admin color tokens namespaced as `--admin-*` | 8-token semantic palette, admin-owned (not mirrored from public); declared at `:root` so Radix portals resolve them | T15 | 2026-05-11 / amended 2026-05-12 + 2026-05-19 |
| 17 | Admin URL pattern locked to `/admin/*` | URL = layout = Tailwind = middleware = robots boundary | `@cto` pre-T16 | 2026-05-12 |
| 18 | Supabase SSR client locked to flowType: implicit | No PKCE verifier cookie; header channel uniform | `@security` audit 3 | 2026-05-12 |
| 19 | Dev-only routes use bracket NODE_ENV indirection | Defeats Next 15 compile-time inlining; runtime gate enforced | `@dev` + T19.2 | 2026-05-12 |
| 20 | Storage bucket RLS policies accompany table FK migrations | Every bucket gets a `storage.objects` policy scoped to `bucket_id` (USING + WITH CHECK); default-deny applies to Storage | `@supabase` + T28 | 2026-05-14 |
| 21 | Canonical domain = apex `swarnimbagre.com` (no `www`) | All origin config (Vercel/Supabase/env/email) resolves to apex. **Live as of 2026-08-07:** apex 200, `www` 308 → apex; the Vercel primary-flip is done | Main thread on builder behalf, confirmed by builder | 2026-05-16 |
| 22 | Public-site JS libraries require a named Override + ≤15 KB gzip route-chunk budget | Every public-site npm dep gets a Surface boundary doc and a measured route-chunk delta. **Zero consumers as of T46**: embla was uninstalled and the carousel hand-rolled, so the public site has no runtime JS dependencies | `@cto` S34, codified at T43.I | 2026-05-20 / codified 2026-05-23 / zeroed 2026-08-04 |
| 23 | Admin Server Actions call `assertAdminSession()` first, inside the `try` | Two-layer authorization (app check + RLS) on all 17 admin mutation actions; `lib/auth.ts` sign-in/sign-out exempt | `@security` audit 24 (F-39) | 2026-08-04 |
| 24 | Review outputs stay local; design outputs get committed | State-of-the-work docs (security / QA findings, logs, handoff, framework issues) are gitignored; what-to-build docs are committed. The repo is public, so a findings file is an attack guide | Builder (on F-49) | 2026-08-06 |
| 25 | Lint gates the build | `next build` runs ESLint; an error fails the build, and `npm test` with it. No `eslint.ignoreDuringBuilds`. Suppressions go in `eslint.config.mjs` with a stated reason, not as inline `eslint-disable` directives | Builder | 2026-08-12 |
