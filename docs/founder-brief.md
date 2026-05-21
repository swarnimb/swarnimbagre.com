# Founder Brief: swarnimbagre.com

**Date:** 2026-05-06

This file is the plain-language record of every architectural decision. The audience is the builder — non-technical-becoming-architect — and any future Claude session that needs to know what a decision means before changing the code that depends on it.

**Rule:** [`architecture.md`](architecture.md) cannot change without a corresponding update to this file. If a decision is reversed, the Founder Brief entry is rewritten and the change noted in `docs/session-log.md`.

---

## Index

| # | Decision | Architecture section |
|---|---|---|
| 1 | Stack — Next.js 15 from day one | [§1](architecture.md#1-tech-stack) |
| 2 | Stats schema — single typed table | [§2.3](architecture.md#23-stats) |
| 3 | Tailwind scoping — admin only | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 4 | OpenClaw access — Edge Function with shared secret | [§3.3](architecture.md#33-edge-function--stats-ingest) |
| 5 | Image data layer — Storage bucket + `images` table | [§2.4](architecture.md#24-images) |
| 6 | Markdown renderer — `marked` + DOMPurify whitelist | [§7](architecture.md#7-markdown-renderer-decision-6) |
| 7 | Variant selection — UA-only header injection | T10b — `middleware.ts` |
| 8 | Styles folder lives at `app/styles/` | [§4.1](architecture.md#41-repo-layout-proposed), [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 9 | CONSTRAINT-05 clarified: additive prop extensions permitted on bundle components | [`constraints.md` CONSTRAINT-05](constraints.md#constraint-05-public-bundle-is-verbatim--inviolable) |
| 10 | UI-boundary error handling — `lib/safe-load.ts` | [§4.4](architecture.md#44-ui-boundary-error-handling--libsafe-loadts) |
| 11 | Server-safe Nav props — plain-data `hrefs` for Server Components | [§4.5](architecture.md#45-server--client-prop-boundary--nav--mobilenav) |
| 12 | Image URLs are short-lived, generated on demand | [§4.6](architecture.md#46-image-read-pattern) |
| 13 | Image components render on the server, not the browser | [§4.6](architecture.md#46-image-read-pattern) |
| 14 | Admin CSS token namespacing | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 15 | Admin URL pattern locked to `/admin/*` | §4.1 + CONSTRAINT-17 |
| 16 | `'use server'` files contain one Server Action each | [§6.6.1](architecture.md#661) + SEC-08 |
| 17 | Auth Server Actions have a constant-time response floor | [§6.6.2](architecture.md#662) |
| 18 | Supabase auth client locked to `flowType: 'implicit'` | [§6.6.3](architecture.md#663) + CONSTRAINT-18 |
| 19 | Admin mutation modules split per resource (§6.6.6 evolved) | [§6.6.5](architecture.md#665-build-invariants-f-14-sec-09) + [§6.6.6](architecture.md#666-admin-mutation-surface--three-module-file-split-per-resource) + [§4.3](architecture.md#43-file-and-function-size-budgets) |
| 20 | Zod .strict() adopted across admin mutation schemas (F-26 closure) | architecture.md §6.6.6 footnote / security-report.md F-26 |
| 21 | `useActionState` dispatch from inside a parent form (BLOCKING-01 closure) | [§6.6.7](architecture.md#667-useactionstate-dispatch-from-inside-a-parent-form) |
| 22 | `storage.objects` RLS policy required per Storage bucket (migration 007) | [§2.4](architecture.md#24-images) + CONSTRAINT-20 |
| 23 | Defer Sentry pre-launch — manual log review until launch (T32 Option B) | [`monitoring.md`](monitoring.md) + CONSTRAINT-05 |
| 24 | Admin query modules split per resource + shared `logQueryError` (T37) | [§6.6.8](architecture.md#668-admin-query-surface--per-resource-split--shared-query-error-helper-t37-cq-02cq-07) |
| 25 | Image-bucket size/MIME limits codified in migration 008 (F-30) | [§2.4](architecture.md#24-images) + [§5.2](architecture.md#52-supabase) |
| 26 | `/api/admin/*` route handlers self-gate via `getServerSession()` (F-17) | [§6.6.4](architecture.md#664-apiadmin-route-handler-gate-f-17-audit-pass-5) |
| 27 | Admin theming tokens declared at `:root` to survive Radix portal escape | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 28 | Project content-model expansion — 6 nullable columns + Override 1 (T42) | [§2.1](architecture.md#21-projects) + `design-decisions.md` Override 1 |
| 29 | Override 2 — embla-carousel-react opens public-site JS-library posture with byte budget (T43.B) | [§1.2](architecture.md#12-frontend-libraries) + `design-decisions.md` Override 2 |
| 30 | Atomic save — Postgres RPC over application-layer rollback (T43.E) | [§6.6.9](architecture.md#669-atomic-save-surface--postgres-rpc-pattern) + `supabase/migrations/010a_save_project_media_rpc.sql` |

---

## 1. Stack — Next.js 15 from day one

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §1](architecture.md#1-tech-stack)

**Decided:** The site is built on Next.js 15 (App Router) from the first commit. Earlier drafts had a Phase A that deployed the static React-via-CDN bundle to Vercel and migrated to Next.js later. Phase A is dropped.

**What this means for your product:** Phase 1 takes longer than a "just deploy the bundle" weekend would have. In exchange, the foundation that the admin panel and Edge Function need is already there when you start Phase 2 — no migration, no throwaway routing config.

**Check before approving:** Are you OK with the public site being live a few weeks later than a static deploy would have allowed? If you wanted "URL live this week" more than "no rework later," this decision goes the other way.

**What this closes off:** A static-only deployment path. If you ever want to host the public site on, say, GitHub Pages with no backend, you'd be unwiring Next.js to do it. The Vercel + Supabase pairing is now a coupled choice.

---

## 2. Stats schema — single typed table

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §2.3](architecture.md#23-stats)

**Decided:** One table, `stats`, with text columns `category`, `label`, `value`, `unit`, plus `id` and `created_at`. Append-only. New stat categories do not require a migration — OpenClaw just writes a new `category` value.

**What this means for your product:** Adding "running pace" or "books finished" or "guitar practice minutes" tomorrow is zero database work. OpenClaw is told the schema once and inserts whatever you describe to it in Telegram.

**Check before approving:** You are OK with `value` being stored as text rather than a typed number/duration/date? It means filtering or aggregating by numeric range happens in the app layer, not via SQL `WHERE value > 100`. For a personal stats display this is fine; for a leaderboard or analytics product it would not be.

**What this closes off:** Per-category strongly-typed tables. If you later want to do, e.g., precise minute aggregation across hobbies in SQL, you'd be either retrofitting `value_numeric` columns or migrating to per-category tables. For now this is bought with the flexibility cost.

---

## 3. Tailwind scoping — admin only

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04)

**Decided:** Tailwind CSS is imported in exactly one place — the admin layout — and its global reset (Preflight) is wrapped under a `.admin-root` selector via the `tailwindcss-scoped-preflight` plugin. The public site bundle never sees Tailwind.

**What this means for your product:** The admin panel uses shadcn defaults (rounded corners, subtle shadows, focus rings) and the public site keeps its hairline-driven, anti-chrome look. The two never bleed into each other.

**Check before approving:** This adds a build-config dependency (`tailwindcss-scoped-preflight`) that has to keep working as Tailwind versions change. The plugin is actively maintained as of 2026 but you are coupled to it.

**What this closes off:** Using Tailwind anywhere on the public site. If you ever decide a public component should use a Tailwind utility class, you'd be unwinding the scoping. The trade was made on purpose — you wanted the bundle verbatim.

---

## 4. OpenClaw access — Edge Function with shared secret

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §3.3](architecture.md#33-edge-function--stats-ingest)

**Decided:** OpenClaw writes to the `stats` table by calling a Supabase Edge Function called `stats-ingest`. The function checks a shared secret in a request header (using a constant-time comparison so an attacker cannot guess the secret one byte at a time by measuring response timing) and, if it matches, inserts the row using the service role.

**What this means for your product:** Only OpenClaw can write stats, because only OpenClaw has the secret. If the secret leaks, you rotate it in one place — the Supabase Edge Function env and OpenClaw's config. The public anon key cannot insert. The admin panel never holds the secret.

**Check before approving:** You are OK with the operational responsibility of keeping the shared secret out of repos, screenshots, and chat logs. If it leaks, anyone can spam your stats table until you rotate. The blast radius is contained — they can only INSERT, not read or modify anything else.

**What this closes off:** A "no Edge Function, just direct Supabase REST" path with a publishable key. That path was rejected because the publishable key is public on the internet by design — anyone could spam your stats. The Edge Function is ~30 lines but it is the line between you and the open internet.

---

## 5. Image data layer — Storage bucket + `images` table

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §2.4](architecture.md#24-images)

**Decided:** Image files live in a Supabase Storage bucket called `images` at the path `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. An `images` row in the database tracks the bucket path, the alt text (which is required), and which project or post the image belongs to. Orphans (rows with no parent) older than 7 days can be deleted by an admin button.

**What this means for your product:** Every image has alt text — non-negotiable, enforced at the database level by `NOT NULL`. When you delete a project, the image becomes an orphan; you have a week to either reassign it or run cleanup. Cleanup is manual, by design — no scheduled job, no quota check. You will not lose images by accident.

**Check before approving:** You are OK with manually clicking "Clean orphans" occasionally rather than having it automated. The alternative is a scheduled job that costs Edge Function invocations and adds operational complexity. Manual is fine for a personal site; if image volume ever spikes, automation is a small follow-up.

**What this closes off:** Soft-delete (the deleted-but-recoverable pattern). Once you delete a project and run orphan cleanup, the image is gone from Storage. If you wanted recovery, you'd be adding a `deleted_at` column and a tombstone-cleanup job. You explicitly chose hard-delete with a 7-day grace.

---

## 6. Markdown renderer — `marked` + DOMPurify whitelist

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §7](architecture.md#7-markdown-renderer-decision-6)

**Decided:** Posts are stored in the database as raw Markdown text. When a reader opens a post, the browser parses the Markdown to HTML via `marked` and sanitizes the result through DOMPurify against a fixed whitelist of tags and attributes (`p, ul, ol, li, blockquote, code, pre, em, strong, a[href], h1-h4, img[src,alt]`). Anything outside the whitelist is removed.

**What this means for your product:** You write posts in Markdown — the format you already use for everything. The database never contains HTML, so even if you paste something hostile into a post body by accident, it cannot become a stored XSS attack. Sanitization happens fresh on every read.

**Check before approving:** The whitelist is intentionally tight. If you ever want a `<details>` collapsible, a YouTube embed, or an `<iframe>`, you'll be widening the whitelist and considering each addition's XSS surface. Tight default, expand by exception.

**What this closes off:** Storing pre-rendered HTML in the database. That would have given you slightly faster reads but a much larger trust surface — every post body would have to be re-sanitized on edit, and any sanitization bug would persist in the data. The current approach is "trust nothing in storage, sanitize on the way out" and it is the safer default.

---

---

## 2026-05-08 — Variant selection: UA-only header injection

**Decided:** Server-side middleware uses User-Agent string detection to set an `x-device-variant: mobile|desktop` request header on every public-route request. Pages read this header at render time to pick the appropriate component variant. No URL rewriting, no client-side viewport detection.

**Means for your product:** Phones and desktops share one canonical URL per page (`/projects` works for both — no `/m/projects`). SEO is single-source, inbound links don't fork. A user resizing their desktop browser to a narrow window will continue to see the desktop variant — UA does not change. The bundle's two intentionally distinct device experiences (desktop vs mobile component sets) map cleanly to the device the user is actually on.

**Check before approving:** Are you OK with users on small desktop windows getting the desktop variant? (You said yes — your site is design-led, not a responsive SaaS app.) Are you OK with mobile-emulator tools in dev tools needing a custom UA spoof to preview mobile? (Standard practice — mobile dev tools already do this.)

**What this closes off:** Adding per-variant URL paths later (`/m/projects`, `/desktop/projects`) becomes a non-trivial refactor once T10c+ pages rely on the header. Adding client-side viewport fallback later (e.g. force mobile when viewport < 600px on a desktop laptop) is possible but introduces hydration-mismatch complexity.

**Implemented in:** T10b — `middleware.ts` (2026-05-08).
**Consumed by:** T10c (pages will read `headers()` from `next/headers` to pick a variant).

---

## 2026-05-11 — Styles folder lives at `app/styles/`, not `/styles/`

**Decided:** The CSS files for the public site (`colors_and_type.css`, `base.css`) live at `app/styles/`, not at the project root `/styles/`. The original architecture spec called for a root-level `/styles/` directory; during T2 scaffolding the files were placed under `app/styles/` and the root `/styles/` directory was created but left empty (an orphaned duplicate of `colors_and_type.css` sat there unused). Today we cleaned up: deleted the orphan root directory and updated the spec to match what is wired.

**Means for your product:** Nothing changes visually or behaviourally — the site already imports from `app/styles/`. This is a doc-sync, not a refactor. Future sessions reading `architecture.md` will now see the same path the code actually uses, eliminating a "which one is real" question.

**Check before approving:** Are you OK with the CSS sitting inside the `app/` directory rather than at the project root? It is closer to Next.js convention (route-tree-adjacent), and matches where `app/layout.tsx` imports from. The alternative — moving the files back to `/styles/` and updating one import line — was rejected as more churn for no benefit.

**What this closes off:** Adopting a root-level `/styles/` convention later would mean moving the files again and updating every import. Possible, but no longer the default.

**Implemented in:** doc cleanup, session 5 (2026-05-11). Triggered by drift surfaced in session 4 handoff.

**Previously:** original `architecture.md` §4.1 (2026-05-06) specified `/styles/` at the project root. Code under T2 (2026-05-07) used `app/styles/`. Doc and code disagreed until today.

---

## 2026-05-11 — CONSTRAINT-05 clarified: additive prop extensions permitted on bundle components

**Decided:** During T11 implementation. The verbatim-bundle rule (CONSTRAINT-05) was clarified to govern rendered visual output (pixels, motion, typography) and not the prop interface or runtime behavior. Bundle-ported components may grow optional props whose default value equals the existing hardcoded content, so the bundle still renders byte-identically at design time.

**Means for your product:** Public list pages (Projects, Writing, Other) can now consume database rows while the bundle stays visually verbatim. Without this clarification, every data-wiring task would hit the same blocker — a per-task design consult that costs time without resolving anything new.

**Check before approving:** When a future change touches a bundle component, verify the diff: does the component render the same default output with no props? If yes, the change respects CONSTRAINT-05. If a pixel moves, it doesn't — that's the line.

**What this closes off:** A strict letter-reading of CONSTRAINT-05 that forbade any modification to bundle components. The looser reading expects interactive behavior (link `href`, form actions) to be wired to real targets; only *new visual patterns* still require `@designer` consult.

**Implemented in:** `docs/constraints.md` (CONSTRAINT-05 paragraph appended, 2026-05-11). Triggered by Wave 3b of T11 correctly blocking on the strict letter and surfacing the architectural decision rather than improvising past it.

---

## 2026-05-11 — UI-boundary error handling: `lib/safe-load.ts`

**Decided:** When a public-route page asks the database for content and the database fails (env vars wrong, RLS denying, network blip), the page should render an empty state with a clearly-logged error — not crash to a 500. We added `lib/safe-load.ts`, a small wrapper every Server Component page now uses around its `lib/db.ts` calls. It catches whatever was thrown, writes a structured log line to stderr (same shape as the data-layer logger so log consumers see one consistent format), and returns the caller-supplied fallback (empty array, null, empty record).

**Means for your product:** A visitor will never see "Application error: a server-side exception has occurred" because of a database hiccup. Worst case: they see empty content with whatever copy the bundle reserves for empty states. The error still hits your dev-server stderr with full context, so a real failure is debuggable, not silent. This is what saved the site during session 7's malformed-env-var period — list pages stayed at 200 with empty UI even though every query was throwing under the hood.

**Check before approving:** Are you OK with the failure mode being "page renders empty without obvious explanation to the visitor"? The alternative — surfacing an "Oops, content failed to load" message — was rejected as too SaaS-flavored for the voice (CONSTRAINT-13). The bundle's existing empty-state copy ("Nothing here yet.") is the user-facing surface for both genuinely-empty and broken-DB conditions. That's a deliberate trade.

**What this closes off:** Letting `ServiceError` bubble to Next.js's default error UI on user-facing routes. Reversing means accepting that a transient DB issue crashes a page rather than degrading. It also closes off having a different fallback shape per page (the wrapper is generic; each page picks its own fallback). If you ever want a styled "something went wrong" UI for genuine outages (different from "nothing here"), you'd be widening the wrapper or adding an `error.tsx` boundary above it.

**Implemented in:** session 7 (2026-05-11). Triggered by `docs/qa-report.md` BLOCKING-01 — list pages returning 500 due to missing env vars. Defense-in-depth half of the BLOCKING-01 fix; the data-fix half was the user populating `.env.local` with real values. Lives at [`lib/safe-load.ts`](../lib/safe-load.ts). Used by `app/{projects,writing,other}/page.tsx` and `app/{projects,writing}/[slug]/page.tsx` (both `generateMetadata` and the page body).

---

## 2026-05-11 — Server-safe Nav props (plain-data `hrefs` alongside function `resolveHref`)

**Decided:** The public site's top-nav component (`Nav` on desktop, `MobileNav` on mobile) accepts two parallel ways for a calling page to specify what URL each nav item links to. A list-render component (already `'use client'`) passes `resolveHref={resolveNavPath}` — a function. A detail page (a Server Component) passes `hrefs={NAV_PATHS}` — a static object exported from `lib/nav-targets.ts`. Both achieve the same rendered output. The split exists because Next.js 15's React Server Components prohibit passing function values from a Server Component to a Client Component — the framework throws at request time when you try, and the page 500s.

**Means for your product:** Every nav link on every public page points to the right place — projects, writing, other, home — whether the page is rendered on the server (post detail) or fully on the client (list pages). Without this split, detail pages crashed to 500 the moment a real post existed to render (it was latent before because `notFound()` always fired first when no post matched a slug).

**Check before approving:** The two-prop shape is a little more cognitive overhead than a single `hrefs` everywhere would have been. The trade was made on purpose: Client Components benefit from the function prop because they can compute hrefs dynamically (e.g., parameterized routes) without passing every variant in a static object. Static `hrefs={NAV_PATHS}` works for the current nav because the targets are fixed and known at build time. If the navigation ever becomes dynamic (e.g., "show all categories the user has posted in"), the Client Component path is already there.

**What this closes off:** A single function-only Nav prop interface. Reversing means moving every detail page to a Client Component shell wrapper just to satisfy the RSC boundary — extra ceremony, no functional gain. The current split aligns the prop shape with the actual boundary the page renders on.

**Implemented in:** session 7 (2026-05-11), as part of the BLOCKING-03 fix and the latent RSC-violation fix surfaced during Phase D Playwright verification. Touched `components/public/Nav.tsx`, `components/public/mobile/MobileNav.tsx`, and every page that consumes Nav. `lib/nav-targets.ts` exports the `NAV_PATHS` const used by Server Components.

---

## 12. Image URLs are short-lived, generated on demand

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.6](architecture.md#46-image-read-pattern)

**Decided:** Images on the site aren't served from a permanent public link. Every time a page needs to show an image, the server generates a fresh URL that's only valid for one hour. After that, the URL stops working — but visitors viewing the page during that hour are unaffected.

**What this means for your product:** Visitors see images normally — nothing changes for them. The benefit is that if anyone ever copies a URL out of your site's HTML (devtools, sharing, scraping), it can't be reused forever to hot-link your images and burn your Supabase bandwidth. After an hour, the copied URL is dead. The cost is essentially zero: a few milliseconds of server work per image, hidden in normal page loading.

**Check before approving:** N/A — this is reversible. If we ever decide images are truly public and we want simpler URLs, we can flip the bucket to public and switch to `getPublicUrl`. Until then, signed URLs are the safer default.

**What this closes off:** No image CDN-style permanent links. If we ever want to embed your image in an external Markdown post (a tweet, a third-party blog), we'd need a different mechanism — a public mirror or a dedicated re-share endpoint.

---

## 13. Image components render on the server, not the browser

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.6](architecture.md#46-image-read-pattern)

**Decided:** `<ProjectImage>` and `<PostImage>` run on the server when a page loads, not in the visitor's browser. The image URL is baked into the HTML before it reaches the visitor.

**What this means for your product:** Google sees your project and post images when it indexes pages — important for portfolio SEO. Visitors also see images appear with the rest of the page, not a second later when JavaScript catches up. The tradeoff: these specific components can't have interactive behavior (no hover-zoom inside the component, no client-side filtering). That's fine — interactivity, if needed later, gets a wrapper.

**Check before approving:** N/A — this is reversible. If image components ever need browser-side behavior, we can split: a server component for the URL fetch, a client component for the interactivity.

**What this closes off:** No client-side conditional image loading from these specific components (e.g. "only fetch the URL when scrolled into view"). The `loading="lazy"` attribute handles native browser lazy-loading, which covers the typical use case.

---

## 2026-05-11 — Admin CSS token namespacing

**Architecture link:** [`architecture.md` §4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04)

**Decided:** Admin redefines the four borrowed color tokens under a namespaced prefix (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`) rather than reusing the bare names (`--bg`, `--surface`, `--fg`, `--accent`) the public site uses on `:root`. The hex values are identical; only the variable names differ.

**What this means for your product:** A future change to either side's color tokens cannot accidentally repaint the other side. If you ever decide the warm-brown background should shift a shade darker on the public site, the admin panel stays exactly as it was. The two visual worlds are isolated by variable name, not just by CSS file location.

**Check before approving:** A color-token rename or value change requires updating both files independently. If you want a single source of truth for the four colors, you'd need a build-time pipeline that copies values from one to the other — adds complexity we don't have today. The current setup trades that for isolation.

**What this closes off:** Sharing CSS custom properties across the public/admin boundary. Any component that wants to use the same color in both contexts must reference both prefixes explicitly, or rely on the Tailwind theme alias (admin only).

**Amended 2026-05-12 (session 12):** Admin palette expanded from 4 tokens to 8.
Existing 4 brand tokens (`--admin-bg`, `--admin-surface`, `--admin-fg`,
`--admin-accent`) joined by 4 semantic tokens (`--admin-destructive`,
`--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`). Rationale:
shadcn primitives need semantic slots — destructive button background, table
border, muted body text — and inline-styling the gaps was the exact sprawl
the original 4-token rule was meant to prevent. The original rule protected
against importing public-site identity elements (Fraunces, hairline grammar,
gold-underline links), not against admin palette growth. `@designer` + `@cto`
confirmed Option B (extend palette) over Option A (inline-style gaps) in
parallel consult. Hex values for the 3 sourced-from-public semantic tokens
(`--admin-destructive`, `--admin-border`, `--admin-muted-fg`) match the
public palette siblings (`--danger`, `--hairline`, `--fg-muted`) verbatim to
keep brand coherence; `--admin-destructive-fg` is a fresh value chosen for
contrast against the destructive background.

---

## 2026-05-12 — Admin URL pattern — locked to `/admin/*`

**Architecture reference:** §4.1 (admin route structure) + CONSTRAINT-17

**Decided:** Admin lives under `/admin/*` (path-prefixed). Login is `/admin/login`, dashboard is `/admin`, edit screens are `/admin/projects/[id]/edit`, etc. Public site never uses `/login` or `/dashboard`.

**Means for your product:** The admin panel and the public site live at clearly separate URLs. You'll never bookmark `/login` and forget whether it's admin or public. SEO crawlers see one rule (`Disallow: /admin`) and skip the entire admin tree. If you later add a public dashboard for hobby stats, the slug `/dashboard` is still available.

**Check before approving:** None at this point — this is a plumbing decision, not a product call. The URLs you'll type are slightly longer (`/admin/projects` vs `/projects-edit`); that's the only thing you'll feel as a user.

**What this closes off:** Root-level admin URLs (`/login`, `/dashboard`). Does NOT close off a future subdomain split (`admin.swarnimbagre.com`) — the `/admin/*` tree maps to a subdomain trivially.

---

## 2026-05-12 — `'use server'` files contain one Server Action each

**Architecture reference:** §6.6.1 + SEC-08 + auth-flow.md §2a point 4

**Decided:** Files that carry the `'use server'` directive contain exactly one
exported async function — the public Server Action entry point. Throwing helpers,
allowlist guards, and any function whose behavior or timing depends on outcome
live in a sibling file with no directive (e.g., `lib/auth.ts` wraps
`lib/auth-internal.ts`). The wrapper imports the helper as a regular ES module
function.

**Means for your product:** Every `export` from a `'use server'` module becomes
a publicly callable RPC endpoint with a stable hashed ID that ships in the
client bundle. An attacker can call any of them directly via `Next-Action` HTTP
header, bypassing any wrapper. Keeping helpers in a non-`'use server'` file
means they exist only as server-internal functions — not reachable from a
browser. T17's audit loop caught this the hard way: the audit-2 fix
accidentally exported the throwing helper from the `'use server'` file, and the
build manifest grew a second action ID that bypassed the wrapper's constant-time
bound. The fix was architectural, not parametric — split the file.

**Check before approving:** This adds a sibling-file pattern for every new
auth-adjacent feature (T18-T28, Phase 3 ingestion). The cost is one extra
import line per feature. The alternative — wrapping helpers inside the
`'use server'` file with internal `try/catch` to mask the behavior — was tried
in audit-2 and failed because Next.js still exports the helper. There is no
"private export from a `'use server'` file" — the file boundary IS the security
boundary.

**What this closes off:** Co-locating throwing helpers next to their wrapper
for proximity. The audit-output verification (`server-reference-manifest.json`
lists exactly the expected action IDs) becomes a required build-time check
for every auth-adjacent PR.

**Implemented in:** T17 audit-round-3 fix, 2026-05-12 (`lib/auth-internal.ts`
created, `lib/auth.ts` reduced to single export). Verified via build-manifest
grep: one action ID for `signInWithMagicLink`, zero hits for the prior
`attemptMagicLink` action ID anywhere under `.next/`.

---

## 2026-05-12 — Auth Server Actions have a constant-time response floor

**Architecture reference:** §6.6.2 + auth-flow.md §2a point 3

**Decided:** The public `signInWithMagicLink` Server Action wraps its internal
helper in a `try/finally` and pads the response with `setTimeout` so wall-clock
response time has a minimum bound of 750ms regardless of outcome. Fast paths
(non-allowlisted email, validation reject) pad up to the floor. Slow paths
(Supabase API call) run over without truncation. The wrapper catches and
discards thrown errors silently — re-logging inside the catch would itself
introduce a timing differential and reopen the channel.

**Means for your product:** An attacker probing the login endpoint cannot tell
"this email is the admin's address" from "this email is not the admin's
address" by measuring how fast the server responds. Before this fix, the
not-allowlisted path returned in microseconds (no network call) while the
allowlisted path waited ~100-500ms for Supabase — a single HTTP probe revealed
the admin email. With the 750ms floor, both paths look identical to the wire.
The cost is a ~750ms login UX, which is below the threshold most users notice
on a one-time-per-month action.

**Check before approving:** Are you OK with the login form taking ~750ms to
respond? This is the floor — slow paths can run longer. The alternative —
truncating slow paths with a ceiling — was rejected because it introduces a
separate oracle (timeouts vs successes). The floor-not-ceiling design comes
from `docs/auth-flow.md` §2a point 3.

**What this closes off:** Inline error logging on the wrapper's catch branch
(would reopen the timing channel at a smaller scale). Per-outcome custom
response shapes (would reopen body-shape channel — see Brief C/F-13). Any
future auth-adjacent Server Action with outcome-dependent inner timing must
follow the same floor-wrap pattern.

**Implemented in:** T17 audit-round-2 fix, 2026-05-12 (`lib/auth.ts:14, 55-70`).
Verified via Vitest fake-timer test that the wrapper resolves at ≥750ms across
allowlisted, not-allowlisted, malformed, and Supabase-failure outcomes.

---

## 2026-05-12 — Supabase auth client locked to `flowType: 'implicit'`

**Architecture reference:** §6.6.3 + auth-flow.md §2a point 5 + CONSTRAINT-18

**Decided:** `lib/supabase.ts::createServerClient` constructs the
`@supabase/ssr` client with `auth: { flowType: 'implicit' }` rather than
accepting the library default (PKCE). Magic-link callback consumes the
`?token_hash=&type=` shape via `verifyOtp`, which works under both flow types
— implicit flow has no effect on what the user experiences. The PKCE-shaped
`?code=...` branch in the callback route is dead under the current single-user
magic-link-only model; it is intentionally retained for future OAuth.

**Means for your product:** PKCE's `*-code-verifier` `Set-Cookie` header would
otherwise be sent only on the call-Supabase branch of the login flow, not on
the throw-and-skip (non-allowlisted) branch. Anyone watching the network tab
could distinguish "this email is in the allowlist" from "this email is not"
by checking whether the response set a cookie — a single-probe oracle at the
HTTP-header level, orthogonal to the body-shape and timing channels closed by
the other fixes. Implicit flow does not emit the verifier cookie, so the
response headers are uniform across all outcomes.

**Check before approving:** This is a quiet but binding config decision. If
a future contributor flips the client back to PKCE (or removes the explicit
config and relies on a future library default change), the enumeration channel
reopens silently — there is no runtime error, just leaked information. The
guardrail is `tests/auth-cookies.test.ts`, which asserts the production
factory passes `flowType: 'implicit'` through to `@supabase/ssr` and that no
`*-code-verifier` cookie is written on any branch.

**What this closes off:** OAuth support without revisiting this decision. When
T-future adds an OAuth provider, the architecture splits: either two clients
(implicit for magic-link, PKCE for OAuth) or a re-evaluation of whether
constant-time-uniform headers are reachable under PKCE. Not a problem today
(magic-link only by CONSTRAINT-09); flagged for whoever adds OAuth later.

**Implemented in:** T17 audit-round-3 fix, 2026-05-12 (`lib/supabase.ts:40-42`).
Verified via `tests/auth-cookies.test.ts` (4 tests, ~760ms each — the test
wall-clock proves the wrapper ran end-to-end).

---

## 2026-05-12 — Dev-only API routes are env-gated with a compiler-evasion trick

**Decided:** Test-fixture routes mount only when three runtime gates pass: NODE_ENV must equal `'test'` (read via `process.env[NODE_ENV_KEY]` indirection, NOT direct dot access), Vercel's `VERCEL=1` env var must be absent, AND a fixture secret must match the request header via constant-time comparison. The NODE_ENV indirection exists because Next 15 inlines `process.env.NODE_ENV` at build time — direct access becomes a compile-time `true` regardless of runtime env.

**Means for your product:** Test infra is unreachable in production three independent ways. Any single gate failure returns 404 (no distinguishable error — no enumeration). The bracket-indirection idiom is non-obvious; future maintainers (Claude in future sessions, or you reading code six months from now) might "clean it up" back to `process.env.NODE_ENV` and silently re-enable the route in production builds. CONSTRAINT-19 was added this session to make the rule explicit.

**Check before approving:** You are OK with a compile-time-evasion idiom living in the codebase. The build-output inspection lives in `docs/security-report.md` audit 7 — re-run if anyone changes the gate. The constraint catches this in code review.

**What this closes off:** "Just delete the route in production" patterns (e.g., a build-time file deletion or a conditional Next route). The route is one file with three runtime gates; the gates ARE the production safety. Deleting the file would lose the ability to run e2e tests against production-shape builds (which the test infra requires).

**Implemented in:** T19.2, 2026-05-12. Verified by `@security` audit 7 CLEAR: build-output grep shows zero `TEST_FIXTURE_SECRET` references in `.next/static/chunks/*` — bracket indirection survived bundling.

---

## 2026-05-12 — Playwright auth fixture uses server-side magic-link generation

**Decided:** E2E tests log in via `auth.admin.generateLink` (service-role) + `auth.verifyOtp` server-side, then hand the bound cookie jar back to the browser context. No password stored anywhere, no email inbox involved, mirrors the production callback's `verifyOtp` code path.

**Means for your product:** Test runs cannot leak production secrets (no real-user impersonation), e2e tests exercise the same `verifyOtp` code path real users hit (so regressions in the callback shape get caught), and the fixture identity lives on an unowned subdomain (`test.swarnimbagre.com`) so collisions with real users are impossible.

**Check before approving:** Test pass requires the Supabase service-role key in the test environment (already required for stats-ingest Edge Function). The triple-gated `/api/test/sign-in` is the surface that hands the cookie to Playwright — its three gates are the only thing preventing this from becoming a production session-mint endpoint. CONSTRAINT-19 + the `VERCEL=1` check + the `TEST_FIXTURE_SECRET` discipline all stand between this fixture and a production exploit.

**What this closes off:** UI-driven magic-link interception (would have required intercepting Supabase's outbound email infra in test — fragile and slow). Per-test password storage (no admin password to store). A CI-only Supabase project (CONSTRAINT-02 already closed this off — single project rule).

**Implemented in:** T19.2, 2026-05-12. Files: `app/api/test/sign-in/route.ts`, `tests/e2e/fixtures/auth.ts`, `scripts/seed-test-fixture.ts`.

---

## 2026-05-13 — Admin mutation surface — three-module file split

**Architecture reference:** §6.6.6 + §6.6.1 + auth-flow.md §2a point 4

**Decided:** Admin write surface (create/update/delete on `projects`, `posts`, `stats`, image deletions) splits across three files per resource family, not the two-file split the auth flow uses. Pure types and the user-facing error string live in a `*-types.ts` module that is safe to import from a `'use client'` component. Throwing helpers and zod schemas live in a `*-internal.ts` module that has no `'use server'` directive and is server-only. Public Server Action entry points live in a `*.ts` module that DOES carry `'use server'`. The form imports types from `-types.ts` only; the server modules import helpers from `-internal.ts`; the `'use server'` wrapper imports from both.

**Means for your product:** Admin forms can display field-level validation errors and form-level retry errors with strongly-typed shapes — the form code knows the action's return type at compile time. Without the third file, the client form has to either lose type-safety (treat the return as `unknown`) or pull in a module that transitively imports `next/headers`, which fails the Next 15 build with a hard error. With the third file, every future admin mutation (T23 posts, T24 stats, T25 image deletions) follows the same shape: client gets types, server gets helpers, the wrapper file stays small and audit-ready (every export is a Server Action — no helpers smuggled in).

**Check before approving:** This adds one extra import line per resource family. The cost is real but small. The alternative — pushing the state envelope into the global `lib/types.ts` — would mix UI state shapes (`fieldErrors`, `formError`, `status`) with domain types (`Project`, `Post`, `Stat`). The third file keeps that boundary clean. If you ever decide the admin and public sides should share state types, you'd be unwinding this split.

**What this closes off:** Co-locating types with the throwing helpers (the auth-flow's two-file pattern). The audit-output check from §6.6.5 (`server-reference-manifest.json` lists exactly the test-allowlist) becomes mandatory for every admin-mutation PR — adding an export to `lib/admin-mutations.ts` without updating `tests/server-actions-manifest.test.ts` is a build-time test failure by design.

**Implemented in:** T21, 2026-05-13 (`lib/admin-mutations-types.ts`, `lib/admin-mutations-internal.ts`, `lib/admin-mutations.ts`). Extended in T22 (`deleteProject` joined the same three-file surface). Verified via `@security` audit 8 (T21) and audit 9 (T22), both CLEAR. Six-channel uniformity contract from `auth-flow.md` §2a is now applied identically across the auth surface AND the mutation surface.

---

## 2026-05-13 — Admin mutation modules split per resource (§6.6.6 evolution)

**Architecture reference:** §6.6.6 (rewritten this session) + §6.6.5 + §4.3

**Decided:** The admin write surface, which previously lived in one shared three-module trio (`lib/admin-mutations.ts` + `-internal.ts` + `-types.ts` carrying ten Server Actions across projects, posts, and stats), splits at T25 into per-resource trios — one for each resource family that has a mutation surface: projects, posts, stats, and (in the next commit) images. Every resource gets the same three-file layout it had under the shared trio (`-types.ts` for the client-safe envelope, `-internal.ts` for throwing helpers, `-mutations.ts` for the `'use server'` wrapper). The shared trio is deleted in the same commit that introduces the per-resource trios for projects, posts, and stats; the images trio joins in the next commit.

**Means for your product:** Adding the next admin write feature now means creating one trio for that resource family — three small files — instead of bolting onto a growing monolith. The previous shared `lib/admin-mutations.ts` was 519 lines and `lib/admin-mutations-internal.ts` was 687 lines just before T25; both broke CQ-02's 300-line service-file budget and would have grown to ~800 / ~900 lines with the T25 image-upload code merged in. Splitting now also keeps unrelated paths apart: a future change to the slug-lock policy on projects cannot accidentally regress the schemaless stat-insert path; a bug in the file-upload error-handling cannot leak into the post-update wrapper. Tests follow the same split — mutation tests live next to the resource they cover, and a stats refactor only re-runs stats tests during development.

**Check before approving:** This adds three entries (one per resource trio) to the SEC-09 inventory in `tests/server-actions-manifest.test.ts` and bumps the architecture doc's per-module Server Action inventory in §6.6.5 from "two modules" to "four modules" (`lib/auth.ts` plus three `lib/admin-{resource}-mutations.ts` files). The images trio joins as a fifth module in the next commit. Audits get easier to scope (the security audit's "did this mutation change?" question now points at one file per resource), but anyone reviewing the architecture has more file paths to keep in mind. The cost is real but small for a one-person project; for a team of three or more it would be a clear win on its own.

**What this closes off:** A single shared mutation file that any future admin feature could "just add an action to." From T25 onward, every new mutation surface gets its own trio. If a future feature genuinely shares mutation logic across resources (e.g., a generic "publish" action that flips status on any of projects/posts), that shared logic lives in a new `lib/admin-{resource}-mutations.ts` (e.g., `lib/admin-publishing-mutations.ts`) trio of its own — never bolted onto an existing resource's trio. Reverting this split (going back to a shared trio) would re-introduce the 300-line cap violation and re-couple unrelated write paths.

**Implemented in:** T25 commit 1 (refactor), 2026-05-13. New trios: `lib/admin-projects-mutations*.ts` (3 actions), `lib/admin-posts-mutations*.ts` (3 actions), `lib/admin-stats-mutations*.ts` (2 actions). Deleted: `lib/admin-mutations.ts` + `-internal.ts` + `-types.ts`. Allowlist unchanged at 10 in this commit; the images trio + `uploadImage` (allowlist 10 → 11) ships in commit 2. Test files split per resource on the same axis. Verified via `tests/server-actions-manifest.test.ts` (post-build manifest matches the 10-entry allowlist and the new 4-module structure).

---

## 2026-05-13 — Zod `.strict()` adopted across the admin mutation surface (F-26 closure)

**Architecture reference:** §6.6.6 boundary-validation discipline + `docs/security-report.md` F-26

**Decided:** Every Zod schema on the admin write boundary — `projectCreateSchema`, `projectUpdateSchema`, `postCreateSchema`, `postUpdateSchema`, `statInsertSchema`, and the new `uploadImageSchema` (T25) — appends `.strict()`. Strict-mode parsing throws a `ZodError` with the `unrecognized_keys` issue code on any input field whose name is not declared in the schema. Closes F-26 (carried forward from audit 8 through audit 11; originally scoped to four schemas, expanded to all six write-boundary schemas in this batch to keep the rule uniform across the admin surface).

**Means for your product:** Today nothing visible changes — the admin Server Action wrappers read FormData via explicit `formData.get('title')` / `.get('description')` / etc., so any extra field in a probe request (e.g., a hand-crafted Server Action call sending `?admin=true`) is simply not read. The wire shape stays uniform; the wrapper still resolves with the generic error envelope on any zod throw; the user-facing UI is byte-identical. What changes is the depth of defense: if a future refactor switches a wrapper from explicit-key reads to `Object.fromEntries(formData.entries())` (the kind of shortcut a reasonable Build agent might write), the `.strict()` schema rejects the request at the boundary instead of silently writing extra fields to the database. The security audit can stop carrying F-26 forward as a "scope keeps extending" finding — it is closed at the source.

**Check before approving:** This is a no-op for users today, by design. The only place anyone notices is in tests: any unit test that calls a schema's `.parse()` with a payload containing an extra key starts throwing where it previously passed. If such a test exists, it was relying on the schema's old laxness; the test should either narrow its payload or drop the extra key. The omnibus test file (`tests/admin-mutations-strict.test.ts`) asserts the new behavior holds for all six schemas and serves as a regression guard against anyone removing `.strict()` later.

**What this closes off:** Schema laxness as a "future-proofing" defense ("we might want to add a field later, so let zod ignore extras"). From T25 onward, adding a new field to the admin write surface means adding it to the schema explicitly — there is no quiet path where a field flows from form to database without appearing in the schema. Removing `.strict()` from any of the six schemas is a security regression and the strict-batch tests will fail loudly.

**Implemented in:** T25 commit 3, 2026-05-13. Six schemas updated in lock-step across four per-resource internal modules. Six-case omnibus test file added (`tests/admin-mutations-strict.test.ts`). F-26 marked CLOSED in the next `@security` audit (audit 12).

---

## 2026-05-14 — `useActionState` dispatch from inside a parent form (BLOCKING-01 closure)

**Architecture reference:** §6.6.7 + `tests/ImageUpload.test.tsx` regression pin

**Decided:** When an admin client component holds a Server Action and lives inside a parent `<form>` (e.g., the image upload widget embedded in `ProjectForm` / `PostForm`), it must NOT wrap itself in another `<form>`. It uses `useActionState` + `useTransition.startTransition(() => dispatch(formData))` with a `<button type="button" onClick={...}>` trigger. The `FormData` is constructed from refs / state inside the click handler.

**Means for your product:** Image upload from the project + post edit pages now actually works. Before this fix, the image upload looked functional in the UI but silently failed on submit because HTML disallows nested forms — the browser dropped the inner form and the outer form's submit handler intercepted everything. T15-T27 mocked the dispatch path in unit tests, so the bug only triggered against a real browser at T28's smoke run. Future inner-form components in admin will follow the same `<div>` + `useTransition` + manual `dispatch(formData)` pattern.

**Check before approving:** Try uploading an image while editing an existing project. The new image should appear and replace the old one, with the previous image flowing as an orphan to `/admin/images` (eligible for the 7-day cleanup sweep). T28's smoke test verifies this end-to-end now; the regression test in `tests/ImageUpload.test.tsx` pins `<form>` absence so the nested-form bug cannot return.

**What this closes off:** The naive `<form action={serverAction}>` composition inside another form is now banned in admin client components. Future feature work cannot use that shape — and the regression test will fail loud if anyone tries.

**Implemented in:** `@dev` targeted-fix during T28, 2026-05-14. `components/admin/ImageUpload.tsx` (185 → 198 lines): `<form action={formAction}>` → `<div>` wrapper, `<button type="submit">` → `<button type="button" onClick={handleUpload}>`, manual `FormData` construction inside `useTransition.startTransition()`. `useActionState` envelope unchanged. `lib/admin-images-mutations.ts` (the Server Action wrapper) and `lib/admin-images-mutations-internal.ts` (throwing helper) byte-identical — wire shape and zod boundary unchanged. `@security` audit 15 CLEAR — six-channel uniformity preserved by construction.

---

## 2026-05-14 — `storage.objects` RLS policy required per Storage bucket (migration 007)

**Architecture reference:** §2.4 (storage-layer RLS paragraph) + CONSTRAINT-20

**Decided:** Every Supabase Storage bucket in use must carry an explicit `storage.objects` RLS policy scoped to `bucket_id`, applied in the same migration as the table FK that references it. Default-deny applies on Storage just like on tables (the Storage analogue of CONSTRAINT-08, now formalized as CONSTRAINT-20). Policy MUST specify both `USING` and `WITH CHECK` clauses for INSERT / UPDATE writes to be permitted.

**Means for your product:** Image upload is now actually permitted at the database layer. Migration 005 added the `images` bucket but deferred the policy to "T15" — the deferral was forgotten and T15-T27 never landed it because every unit test mocked the Storage client. T28's first real upload hit the deferred work as a hard RLS denial. Six months from now you'll add another bucket (e.g. for project file attachments); CONSTRAINT-20 ensures you don't repeat the mistake — the bucket starts default-denied and the policy ships in the same migration.

**Check before approving:** Image upload during the T28 smoke test reaches and successfully INSERTs into `storage.objects`. Re-run `npm run test:e2e -- admin-smoke.spec.ts` and confirm green. Live verification via `pg_policies` shows `images_storage_admin_all` with both `qual` and `with_check` set to `(bucket_id = 'images'::text)`.

**What this closes off:** The "table policy is sufficient" assumption. New buckets without an accompanying `storage.objects` policy will be caught by CONSTRAINT-20 review. The sibling diagnostic anchor (§2.4) — that the Supabase JS SDK strips the `for table "X"` suffix from RLS error messages — is captured for future debugging so the next time a Storage RLS denial surfaces it doesn't look like a `public.{table}` failure.

**Implemented in:** `@supabase` diagnosis + migration during T28, 2026-05-14. `supabase/migrations/007_rls_storage_images.sql` installs `images_storage_admin_all` (FOR ALL on `authenticated`, USING and WITH CHECK both `bucket_id = 'images'`). Applied via `mcp__supabase__apply_migration`. The `public.images` policies from migration 005 are unchanged.

---

## 2026-05-14 — Defer Sentry pre-launch — manual log review until launch (T32 Option B)

**Architecture reference:** [`docs/monitoring.md`](monitoring.md) (canonical) + CONSTRAINT-05 (bundle weight invariant). No `architecture.md` section — observability posture is operational, not structural.

**Decided:** Error monitoring via Sentry is deferred. Pre-launch the project relies on Vercel Runtime Logs + Supabase logs (Edge Function, Postgres, Auth, Storage) for visibility. `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are stubbed in `.env.example` with a deferred-status comment; `lib/sentry.ts` and `next.config.ts` Sentry plugin wiring are not added. Two named gate conditions trigger flipping to Option A (full Sentry deploy): first external share of the site URL, or first production bug discovered hours/days after it happened.

**Means for your product:** The public site ships Day 1 with zero third-party tracking bytes — CONSTRAINT-05's verbatim-bundle invariant stays clean. You do not get error emails or push notifications during the first weeks of traffic. When something breaks, you go look — Vercel dashboard for runtime errors, Supabase dashboard for DB/RLS/auth/storage/edge-function errors. `docs/monitoring.md` lists exact log locations for every failure mode the app can produce (admin Server Action, magic-link, image upload, OpenClaw ingest, public 5xx, RLS denial). The accepted blind spot is post-hydration client-side errors on the public site — if a component throws after the page loads, no log captures it, and that is the primary motivation for the gate condition to flip Option A on.

**Check before approving:** Are you OK with no push-style alerts during the first weeks of traffic? You have to remember to look. The `docs/monitoring.md` playbook is concrete (named dashboards, named filters) so triage is fast, but it is still manual. The first time you find a bug that was live for a day before you noticed, that is the signal to flip to Option A — do not wait for a second.

**What this closes off:** Almost nothing material. `@sentry/nextjs` is a ~30-min wizard install; reversibility is high. The only thing forfeited is automatic capture of errors during pre-launch QA — reproducible manually because the builder is the only user. PII-scrubbing rules are deliberately not authored speculatively; they get designed against real event payloads when Option A is activated, which is a feature, not a cost. A future builder reading this entry should not interpret "deferred" as "rejected" — it is a sequencing call.

**Implemented in:** `@cto` consultation + `@dev` execution during T32, 2026-05-14. `.env.example` adds `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` stubs with deferred-status comment block. `docs/monitoring.md` created — interim playbook + flip-to-A gate condition. `docs/plan-phase-4-launch.md` T32 marked `[x]` with "Option chosen: B" header note. No `lib/sentry.ts`, no `next.config.ts` change, no tests (Option A's two tests are gated on actually wiring Sentry). Public bundle untouched.

---

## 2026-05-15 — Admin query modules split per resource + shared `logQueryError` (T37)

**Architecture reference:** §6.6.8

**Decided:** The admin read code (`lib/admin-queries.ts`) was split into one module per resource — `admin-queries-projects.ts`, `admin-queries-posts.ts`, `admin-queries-stats.ts` — exactly mirroring the mutation-side per-resource split (decision #19). The original `lib/admin-queries.ts` path is kept as a thin barrel that re-exports the new modules, so nothing that imported it had to change. The structured error-logging helper that had been copy-pasted into each query module was collapsed into one `logQueryError` in `lib/admin-mutation-log.ts` (the module that already owns the mutation-side `logMutationError`).

**Means for your product:** No behaviour change — this is structural hygiene. `lib/admin-queries.ts` had grown past the 300-line file budget (CQ-02) and carried three near-identical copies of the same logging helper (CQ-07). Splitting it keeps each file small enough to read in one sitting and means a future bug in, say, the posts query path can't accidentally touch the projects path. The barrel keeps the change invisible to every caller.

**Check before approving:** `npm run build` and `npx tsc --noEmit` clean, the full Vitest suite green (201/201), and the Server Action manifest still exactly 12 IDs — confirmed at T37. No consumer import path changed.

**What this closes off:** The "one big admin-queries file" shape, and per-module duplicate log helpers. New admin resources get their own `admin-queries-<resource>.ts`; the barrel re-exports it; query-error logging always goes through `logQueryError`.

**Implemented in:** `@dev` parallel-fix during T37 code review, 2026-05-15. Documented in architecture.md §6.6.8 at T38.

---

## 2026-05-15 — Image-bucket size/MIME limits codified in migration 008 (F-30)

**Architecture reference:** §2.4 (storage bucket path scheme) + §5.2 (Supabase)

**Decided:** The `images` bucket's 2 MB size cap and JPEG/PNG/WebP MIME allowlist are now codified in version control as `supabase/migrations/008_storage_images_limits.sql`. This supersedes the original arrangement, where those limits were hand-set in the Supabase Dashboard and only described in a trailing comment of migration 005. Migration 005's comment is left unedited (applied migrations are immutable — you write a new migration, you never rewrite an old one); 008 is the source of truth from here on.

**Means for your product:** A fresh clone or a disaster-recovery rebuild now reproduces the exact bucket limits from the repo — you are not relying on someone remembering to click the right Dashboard fields. The limits already live in the bucket (hand-set 2026-05-07); 008 is idempotent and only makes production match version control. This closed security finding F-30 (audit 16).

**Check before approving:** Migration 008 is NOT yet applied to the remote project — it is applied during the T39 deploy step (single prod project, no staging, per CONSTRAINT-02). After applying, `storage.buckets` for `images` shows `file_size_limit = 2097152` and `allowed_mime_types = {image/jpeg,image/png,image/webp}`.

**What this closes off:** The "Storage limits live only in the Dashboard" reproducibility gap. New buckets follow the same rule — limits codified in a migration, not hand-set and described in prose.

**Implemented in:** `@dev` during T37 (security audit 16 follow-up), 2026-05-15. Documented in architecture.md §2.4 + §5.2 at T38. Apply-to-prod step tracked in `docs/launch-checklist.md` for T39.

---

## 2026-05-15 — `/api/admin/*` route handlers self-gate via `getServerSession()` (F-17)

**Architecture reference:** §6.6.4

**Decided:** The Next.js middleware matcher deliberately excludes `/api/*`, so any admin endpoint added under `app/api/admin/**` would NOT be protected by the middleware admin-gate. The standing rule: every such handler must call `getServerSession()` from `lib/session.ts` before any business logic and return a uniform bare 401 if there is no session — the API analogue of the page gate's redirect-uniformity contract.

**Means for your product:** Today there are no `/api/admin/*` routes (the only `app/api/` route is the env-gated test-sign-in fixture, which self-protects and never runs in production). This entry exists so that the first time you or a future session adds an admin API route — image upload, a batch operation — it ships protected by construction instead of silently bypassing auth. It is a guardrail recorded ahead of the code that will need it.

**Check before approving:** When the first `app/api/admin/**` route ships: code review confirms a `getServerSession()` call precedes all logic and the unauthenticated response is a bodyless 401.

**What this closes off:** The silent-bypass failure mode where an admin endpoint added under `/api/` looks protected (because the page routes are) but isn't. Caught at code review, not in production.

**Implemented in:** Standing rule from security audit pass 5 (F-17); no code yet — guardrail only. Founder Brief entry added at T38, 2026-05-15, to close the architecture.md §6.6.4 / brief coverage gap.

---

## 2026-05-19 — Admin theming tokens declared at `:root` to survive Radix portal escape

**Architecture reference:** §4.2 (Tailwind scoping — "Declaration site" paragraph)

**Decided:** The eight `--admin-*` CSS custom properties (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`, `--admin-destructive`, `--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`) are declared at `:root` in `app/styles/admin.css` instead of being scoped to the `.admin-root` subtree. The dark visual chrome — background colour, text colour, Inter font, full-viewport height — stays on the `.admin-root` selector, so the admin theme is still visually scoped to admin routes. Token names and values are unchanged; only the declaration site moved.

**Means for your product:** Dropdown menus and other overlay popovers inside the admin panel now render with the correct dark surface and gold accent. Before this change they painted transparent and let the table rows behind bleed through — the bug you reported on 2026-05-19. The cause was specific to how Radix UI primitives (`DropdownMenu`, `Select`, `Popover`, `Tooltip`) render: their overlay content is portalled to `document.body`, which sits outside `.admin-root`. CSS variables only resolve inside the selector they are declared on, so the popover utilities (`bg-popover` etc.) hit undefined and the menus came up transparent. Moving the variables to `:root` makes them resolvable everywhere in the document.

**Check before approving:** Open `/admin/projects` and click the row actions dropdown — it should paint as a solid dark menu with gold focus, not see-through. Token names and values are unchanged from CONSTRAINT-16; only the declaration site differs. The public site does not reference any `--admin-*` variables (Tailwind is admin-only), so the public bundle and its styling are unaffected.

**What this closes off:** Future Radix primitives — `DropdownMenu`, `Popover`, `Tooltip`, `HoverCard`, anything that portals — will Just Work in admin because they resolve the variables from `:root`. Without this change, every new Radix overlay would have hit the same bug. Do NOT revert the tokens back to a `.admin-root`-scoped declaration without first solving portal-resolvability another way (e.g., a portal target inside `.admin-root`, or re-declaring the tokens on every Radix `Content` component). A scope-only revert will re-break every overlay in admin.

**Implemented in:** `@dev` fix during Session 27, 2026-05-19. `app/styles/admin.css` — eight `--admin-*` declarations moved from `.admin-root { ... }` to `:root { ... }`; visual chrome rules (`background-color`, `color`, `font-family`, `min-height`) left on `.admin-root`. No callers changed — every consumer reads via `var(--admin-*)` or via Tailwind slot mapping, both of which resolve identically from `:root`. Also added in the same session: `app/(admin)/error.tsx`, a LOUD-failure error boundary for the admin route segment — uncaught render throws now surface `error.message` and `error.digest` verbatim with a `reset()` retry, no swallowed-error path. See architecture.md §4.4.

---

## 2026-05-19 — Project content-model expansion — 6 nullable columns + Override 1 (T42)

**Architecture reference:** §2.1 (projects table) + `design-decisions.md` Override 1 + `constraints.md` CONSTRAINT-05 (override pointer)

**Decided:** The `projects` table grows six new nullable columns in migration 009: `github_url`, `live_url`, `post_url` (three fixed link slots), `progress_percent` (integer 0–100 with CHECK constraint), `thumb_kind` (text, no DB-side enum — the code-side vocabulary lives in `lib/thumb-kinds.ts`), and `image_after_id` (FK → `images.id` ON DELETE SET NULL — the before/after slider's "after" image). No new tables, no JSONB. The before/after slider is supplied by the existing `BeforeAfterMedia.tsx` component; the new column is what tells the public renderer to switch from a single `<img>` to the slider. The bundle's `StatusPill` and `DemoLoop` were dropped from the data path on the project-card surface and replaced with a new `ProgressRing` SVG and three conditional buttons (`{ } code`, `↗ site`, `¶ notes`) wired to the link columns. CONSTRAINT-05 override approved for the project-card surface only — recorded as Override 1 in `design-decisions.md`.

**Means for your product:** You can now ship a project card that shows real progress, real links, and real screenshots — instead of bundle-mock vocabulary (lifecycle pills, animated demos that never matched the screenshots). The progress ring fills as you raise the percent in admin; the three buttons appear and disappear depending on which URLs you've filled in; the before/after slider unlocks when you assign an "after" image to a project (one project is planned to use it). Outside the card surface — Home hero, Projects header, Writing pages, Other pages, mobile navigation — the public site still ships exactly as the bundle designed it.

**Why this (Shape A) over Shape C from `content-model-expansion.md`:** Shape A is lighter — six nullable columns versus new tables plus JSONB. Zero new RLS surface — the existing `projects_public_select` and `projects_admin_all` policies already cover every column on the table, so no new policies were authored (verified against migration 002). Zero new orphan scenarios beyond what Storage already handles — `image_after_id` reuses the existing `images` row + Storage object lifecycle, including the 7-day orphan-sweep path. Reversible — every new column is nullable, so a future "drop the link surface and go back to bundle-verbatim" is a `DROP COLUMN` per slot with no data loss.

**Why override CONSTRAINT-05 instead of forcing the schema into the bundle's old shape:** The bundle's StatusPill encodes lifecycle vocabulary (`active`, `dormant`, `abandoned fondly`) that doesn't fit the new content model. The bundle's `DemoLoop` animations don't fit the "real screenshot" intent. Keeping the bundle verbatim on project-cards would have forced a schema downgrade — fewer real fields, more mock vocabulary — and would have delivered a less honest project surface than what the bundle itself would design with the new model in hand. Override 1 is scoped to the project-card surface only; everything else outside that list (see `design-decisions.md` Override 1 "Surface boundary") remains bundle-verbatim.

**Check before approving:** Are you OK with the project-card surface looking deliberately different from a strict reading of the source bundle? (Yes — you approved this in the Session 28 brainstorm.) Are you OK that further bundle deviation requires explicit overrides (Override 2, etc.) and is not automatic? (Yes — that's the boundary discipline. Any pattern not under a named override entry in `design-decisions.md` is still bundle-verbatim.)

**What this closes off:** Progress as anything other than an integer percent — lifecycle stages, multi-stage rings, named milestones — now becomes a migration. A 4th link slot is a migration (or a Shape B / Shape C revisit). A video-demo type is a new component plus a new Storage path (the current path is screenshots only for v1; clips were deferred post-launch).

**Implemented in:** T42 Session A (schema + admin form) and Session B (public render desktop), 2026-05-19. Migration `009_projects_expand.sql` applied to prod. New code: `components/public/ProgressRing.tsx`, `lib/public-projects.ts`, four test files (+35 tests, suite at 259/259). Modified: `ProjectRow`, `ProjectCard`, `ProjectMedia`, `BeforeAfterMedia`, public Home and Projects pages, app routes. `StillMedia` bundle-dummy bypassed for the real-image path because the dummy has no image-input slot — direct `<img>` matches `renderRealImage` styling from `BeforeAfterMedia` to keep visual continuity (falls under Override 1).

---

## 2026-05-20 — Override 2 — embla-carousel-react opens public-site JS-library posture with byte budget (T43.B)

**Architecture reference:** [§1.2 Frontend libraries](architecture.md#12-frontend-libraries) + `design-decisions.md` Override 2 (lines 123–185) + `constraints.md` CONSTRAINT-05 (override pointer; CONSTRAINT-22 codification deferred to T43.I)

**Decided:** Add `embla-carousel-react` ^8 to the public site as the first runtime JS dependency. The public-site posture narrows from "no JS libraries at all" (the original CONSTRAINT-05 bundle-verbatim reading) to "JS libraries are allowed only via a named Override entry in `design-decisions.md` with a measured byte budget pinned in the Override." Override 2's budget is **15 KB gzip** with 3 KB headroom above the measured baseline of ~11.7 KB across three packages (`embla-carousel-react` + transitive `embla-carousel` core + `embla-carousel-reactive-utils`). Real production-route-chunk delta will be re-measured at T43.G against the same 15 KB ceiling. Recovered as a retroactive Founder Brief at S34 `@end-session` — the original Founder Brief was issued in the `@cto` consult body but lost at the prior `/clear`; full reconstruction here based on session-log details.

**Means for your product:** The project media carousel ships with battle-tested touch + keyboard + accessibility behavior at a known, capped cost (~12 KB gzip — a fraction of one screenshot). Future patch upgrades of embla have explicit headroom built in. More importantly: any next library proposal must come in through the same gate — named Override entry, measured byte budget, `@cto` review on the budget number. The "we just install whatever feels right" drift back into framework-by-default thinking is closed off.

**Why this over scroll-snap + custom JS:** `@cto` consult weighed scroll-snap as the budget-zero alternative. Rejected because: (a) custom JS would need to re-implement the dot indicators, arrow keys, swipe physics, focus management, and ARIA roles embla provides out of the box — net new bug surface vs. battle-tested library; (b) bundle delta is ~12 KB gzip total, smaller than a single project screenshot, so the cost is non-material; (c) the doctrine narrowing ("Overrides + byte budget" instead of "no libraries ever") is more honest about how this codebase will evolve than a "we never use libraries" stance that always eventually breaks.

**Check before approving (you already did at S34 mid-session):** Are you OK that the no-library purity of the public site is now formally relaxed? (Yes — accepted at the `@cto` consult.) Are you OK with the 15 KB ceiling being a hard tripwire requiring `@cto` re-consult to raise? (Yes — exactly the discipline you wanted.) Are you OK that future libraries must go through a named Override entry instead of just `npm install`? (Yes — that's the boundary that prevents drift.)

**What this closes off:** Subsequent public-site library proposals are no longer "absolute no" but require Override + budget + `@cto` approval — meaning every future library decision is a deliberate doctrine event, not a habit. Bundle-baseline measurement becomes part of every public-site dep-add task spec (T43.B's "halt + `@cto` consult if > ceiling" gate becomes the template). Once embla actually ships at T43.G, the real production-route chunk delta must be re-measured against 15 KB — if real delta exceeds budget, that requires another `@cto` revisit rather than silent absorption.

**Implemented in:** T43.B (2026-05-20, Session 34). `package.json` + `package-lock.json` (embla 8.6.0 + 2 transitive); `docs/architecture.md` §1.2 ("One runtime JS dependency... budget ceiling 15 KB gzip per Override 2"); `docs/design-decisions.md` Override 2 budget block (15 KB ceiling, ~11.7 KB current baseline, 3 KB headroom, real-bundle confirmation deferred to T43.G); `docs/plan-phase-4-launch.md` naming reconciliation (v8 renamed `embla-carousel-core` → `embla-carousel`) + T43.B tripwire updated (10 → 15 KB) + T43.G acceptance criterion added (re-measure against ceiling) + CONSTRAINT-22 wording pre-staged at T43.I. Commit `efa294b`. CONSTRAINT-22 codification — the formal text in `constraints.md` — happens at T43.I cross-doc closure per plan.

---

## 2026-05-21 — Atomic save — Postgres RPC over application-layer rollback (T43.E)

**Architecture reference:** [§6.6.9](architecture.md#669-atomic-save-surface--postgres-rpc-pattern) + `supabase/migrations/010a_save_project_media_rpc.sql`

**Decided:** The `saveProjectMedia` Server Action delegates its delete-then-insert work to a single Postgres function call (Option A — RPC `public.save_project_media(p_project_id uuid, p_rows jsonb)`) instead of running the DELETE and the bulk INSERT sequentially from Node with a try/catch rollback (Option B). Both statements live inside one Postgres transaction inside the function body.

**Means for your product:** Admins can save a carousel reorder or edit reliably even if the server crashes mid-save, the network drops between statements, or an INSERT fails for any reason (RLS reject, FK violation, the row-cap trigger raising on the 21st row). The database layer guarantees the project ends up with either entirely the new set of media rows or entirely the old set — never a torn state with the old rows already deleted and no new rows in to replace them. The old worst-case (an admin reorders the carousel, the save half-completes, the carousel goes blank, you reload the form and have to re-upload from scratch) is gone.

**Check before approving:** That the RPC actually runs in one transaction (confirmed at the `@supabase` consult — function body's DELETE + INSERT share a single statement-level transaction by definition; verdict APPROVE WITH MINOR). That `anon` callers cannot invoke it (confirmed via grants check — `EXECUTE` belongs to `authenticated`, `postgres`, `service_role` only; both `revoke from public` and `revoke from anon` are required because Supabase's project-bootstrap default-privileges grant directly to `anon`). That an INSERT-side failure genuinely rolls back the DELETE (covered by the row-cap trigger behavior in migration 010 plus the 21st-row test: a save with 21 rows raises in the trigger and leaves the existing media untouched).

**What this closes off:** The RPC's name and signature (`save_project_media(uuid, jsonb)`) become a contract — renaming or changing the parameter shape requires a coordinated migration + TypeScript redeploy. Switching the transaction strategy underneath (e.g., to serializable isolation or advisory locks) means rewriting the SQL inside the function but the TypeScript caller does not change. Also: future Server Actions that need atomic multi-statement writes on a parent-children pair (replace-all child collections for one parent row) should follow this same pattern — the conventions are codified in architecture.md §6.6.9 (LANGUAGE plpgsql, SECURITY INVOKER, SET search_path = '', revoke EXECUTE from both public and anon, input shape guard via raise exception, ordering via WITH ORDINALITY). The "Option B with app-rollback" path is now reserved for cases where the RPC route adds genuine schema cost; it is not the default.

**Implemented in:** T43.E (2026-05-21). `supabase/migrations/010a_save_project_media_rpc.sql` — RPC definition + grants + comment. The Server Action wrapper (TypeScript) calls the RPC via `supabase.rpc('save_project_media', { p_project_id, p_rows })` instead of running DELETE and INSERT statements directly. Pattern reference for future atomic-save surfaces: architecture.md §6.6.9.

---

## How to update this file

When `@cto` or any session changes a decision in [`architecture.md`](architecture.md):

1. Find the matching brief above (or add a new entry).
2. Update the four fields: Decided, What this means, Check before approving, What this closes off.
3. Note the change in `docs/session-log.md` with the date and the reason.
4. If the decision is reversed wholesale, do not delete the entry — rewrite it with the new decision and append a one-line "previously: …" so the lineage is preserved.

A decision in code without a Founder Brief is invisible to the next session.
