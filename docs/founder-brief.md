# Founder Brief: swarnimbagre.com

**Date:** 2026-05-06

This file is the plain-language record of every architectural decision. The audience is the builder — non-technical-becoming-architect — and any future Claude session that needs to know what a decision means before changing the code that depends on it.

**Rule:** [`architecture.md`](architecture.md) cannot change without a corresponding update to this file. If a decision is reversed, the Founder Brief entry is rewritten and the change noted in `docs/session-log.md`.

---

## Index

Entries are listed in decision order. The `#` column is a stable ID, not a sort key — #42 and #43 are older entries that were only given IDs later, so they sit out of numeric order.

| # | Decision | Architecture section |
|---|---|---|
| 1 | Stack — Next.js 15 from day one | [§1](architecture.md#1-tech-stack) |
| 2 | Stats schema — single typed table | [§2.3](architecture.md#23-stats) |
| 3 | Tailwind scoping — admin only | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 4 | OpenClaw access — Edge Function with shared secret | [§3.3](architecture.md#33-edge-function--stats-ingest) |
| 5 | Image data layer — Storage bucket + `images` table | [§2.4](architecture.md#24-images) |
| 6 | Markdown renderer — `marked` + DOMPurify whitelist | [§7](architecture.md#7-markdown-renderer-decision-6) |
| 7 | Variant selection — UA-only header injection (RETIRED at T46) | T10b — `middleware.ts` |
| 8 | Styles folder lives at `app/styles/` | [§4.1](architecture.md#41-repo-layout-proposed), [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 9 | CONSTRAINT-05 clarified: additive prop extensions permitted on bundle components | [`constraints.md` CONSTRAINT-05](constraints.md#constraint-05-public-bundle-is-verbatim--inviolable) |
| 10 | UI-boundary error handling — `lib/safe-load.ts` | [§4.4](architecture.md#44-ui-boundary-error-handling--libsafe-loadts) |
| 11 | Server-safe Nav props — plain-data `hrefs` for Server Components (RETIRED at T46) | [§4.5](architecture.md#45-server--client-prop-boundary--nav--mobilenav) |
| 12 | Image URLs are short-lived, generated on demand | [§4.6](architecture.md#46-image-read-pattern) |
| 13 | Image URLs are resolved on the server, not in the browser | [§4.6](architecture.md#46-image-read-pattern) |
| 14 | Admin CSS token namespacing | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 15 | Admin URL pattern locked to `/admin/*` | §4.1 + CONSTRAINT-17 |
| 16 | `'use server'` files contain one Server Action each | [§6.6.1](architecture.md#661) + SEC-08 |
| 17 | Auth Server Actions have a constant-time response floor | [§6.6.2](architecture.md#662) |
| 18 | Supabase auth client locked to `flowType: 'implicit'` | [§6.6.3](architecture.md#663) + CONSTRAINT-18 |
| 42 | Dev-only API routes are env-gated with a compiler-evasion trick | [§4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + CONSTRAINT-19 |
| 43 | Playwright auth fixture uses server-side magic-link generation | [§4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + CONSTRAINT-19 |
| 19 | Admin mutation modules split per resource | [§6.6.5](architecture.md#665-build-invariants-f-14-sec-09) + [§6.6.6](architecture.md#666-admin-mutation-surface--three-module-file-split-per-resource) + [§4.3](architecture.md#43-file-and-function-size-budgets) |
| 20 | Zod .strict() adopted across admin mutation schemas (F-26 closure) | architecture.md §6.6.6 footnote / security-report.md F-26 |
| 21 | `useActionState` dispatch from inside a parent form (BLOCKING-01 closure) | [§6.6.7](architecture.md#667-useactionstate-dispatch-from-inside-a-parent-form) |
| 22 | `storage.objects` RLS policy required per Storage bucket (migration 007) | [§2.4](architecture.md#24-images) + CONSTRAINT-20 |
| 23 | Defer Sentry pre-launch — manual log review until launch (T32 Option B) | [`monitoring.md`](monitoring.md) + CONSTRAINT-05 |
| 24 | Admin query modules split per resource + shared `logQueryError` (T37) | [§6.6.8](architecture.md#668-admin-query-surface--per-resource-split--shared-query-error-helper-t37-cq-02cq-07) |
| 25 | Image-bucket size/MIME limits codified in migration 008 (F-30) | [§2.4](architecture.md#24-images) + [§5.2](architecture.md#52-supabase) |
| 26 | `/api/admin/*` route handlers self-gate via `assertAdminSession()` (F-17; helper replaced at audit 24b) | [§6.6.4](architecture.md#664-apiadmin-route-handler-gate-f-17-audit-pass-5) |
| 27 | Admin theming tokens declared at `:root` to survive Radix portal escape | [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04) |
| 28 | Project content-model expansion — 6 nullable columns + Override 1 (T42; Override 1 retired at T46) | [§2.1](architecture.md#21-projects) + `design-decisions.md` Override 1 |
| 29 | Override 2 — embla-carousel-react opens public-site JS-library posture with byte budget (T43.B; retired at T46) | [§1.2](architecture.md#12-frontend-libraries) + `design-decisions.md` Override 2 |
| 30 | Atomic save — Postgres RPC over application-layer rollback (T43.E) | [§6.6.9](architecture.md#669-atomic-save-surface--postgres-rpc-pattern) + `supabase/migrations/010a_save_project_media_rpc.sql` |
| 31 | CONSTRAINT-22 codified + Override 2 surface boundary recorded — public-site JS-library posture closed (T43.I) | [§4.9](architecture.md#49-carousel-surface--override-2) + `constraints.md` CONSTRAINT-22 + `design-decisions.md` Override 2 |
| 32 | Project↔post link — embedded writeup FK (`projects.post_id`, T45) | [§2.1](architecture.md#21-projects) + `design-decisions.md` Override 3 + `prd.md` §3.8 |
| 33 | Admin manual reorder — `sort_order` column + atomic RPC (T44) | [§2.1](architecture.md#21-projects) + §2.2 + `supabase/migrations/012_sort_order.sql` + `012a_save_sort_order_rpc.sql` |
| 34 | Public-site redesign: one responsive tree, one fewer route, zero JS deps (T46) | [§4.10](architecture.md#410-public-render-architecture-one-responsive-tree-t46) + §2.1 + §2.3 + §2.6 + §4.9 + `constraints.md` CONSTRAINT-05 |
| 35 | Admin actions check who is calling before they act — `assertAdminSession()` (F-39 / F-40, audit 24b) | [§6.6.10](architecture.md#6610-application-layer-auth-guard-on-admin-mutations--assertadminsession-f-39-audit-24b) + §6.2 + §6.6.4 + §6.6.6 |
| 36 | New Other-page rows land at the end of the list, not on top of each other (migration 016) | [§2.3](architecture.md#23-stats) + §2.6 + `supabase/migrations/016_stats_notes_sort_order_append.sql` |
| 37 | A Supabase-installed database function was left callable from the internet; revoked (F-41, migration 015) | [§6.1](architecture.md#61-rls-policies--per-table) + `supabase/migrations/015_revoke_rls_auto_enable_execute.sql` |
| 38 | The e2e teardown talks to the database directly (T47) | [§4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + `tests/e2e/global-teardown.ts` + `tests/e2e/fixtures/cleanup.ts` |
| 39 | The e2e suite runs one file at a time (T47) | [§4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + `playwright.config.ts` |
| 40 | Discoverability and public-route resilience (T41) | `app/robots.ts` + `app/sitemap.ts` + `app/opengraph-image.tsx` + `app/icon.svg` + `app/error.tsx` + `app/not-found.tsx` + `app/layout.tsx` |
| 41 | The way back into a locked-out admin is a service-role script (NB-16) | [`auth-flow.md`](auth-flow.md) §5 + `scripts/recover-admin-session.ts` + CONSTRAINT-09 |

---

## 1. Stack — Next.js 15 from day one

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §1](architecture.md#1-tech-stack)

**Decided:** The site is built on Next.js 15 (App Router) from the first commit. Earlier drafts had a Phase A that deployed a static React-via-CDN bundle to Vercel and migrated later. Phase A is dropped.

**What this means for your product:** Phase 1 takes longer than a "just deploy the bundle" weekend would have. In exchange, the foundation the admin panel and Edge Function need is already there when Phase 2 starts — no migration, no throwaway routing config.

**Check before approving:** Are you OK with the public site going live a few weeks later than a static deploy would have allowed? If "URL live this week" mattered more than "no rework later", this decision goes the other way.

**What this closes off:** A static-only deployment path. Hosting the public site somewhere with no backend now means unwiring Next.js. Vercel + Supabase is a coupled choice from here.

---

## 2. Stats schema — single typed table

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §2.3](architecture.md#23-stats)

**Decided:** One table, `stats`, with text columns `category`, `label`, `value`, `unit`, plus `id` and `created_at`. Append-only. New stat categories do not require a migration — OpenClaw just writes a new `category` value.

**What this means for your product:** Adding "running pace" or "books finished" tomorrow is zero database work. OpenClaw is told the schema once and inserts whatever you describe to it in Telegram.

**Check before approving:** `value` is text, not a typed number/duration/date. Filtering or aggregating by numeric range happens in the app layer, not via SQL `WHERE value > 100`. Fine for a personal stats display; wrong for a leaderboard or analytics product.

**What this closes off:** Per-category strongly-typed tables. Precise cross-hobby aggregation in SQL later means retrofitting a `value_numeric` column or migrating to per-category tables. That cost buys the flexibility.

---

## 3. Tailwind scoping — admin only

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04)

**Decided:** Tailwind CSS is imported in exactly one place — the admin layout — and its global reset (Preflight) is wrapped under a `.admin-root` selector via the `tailwindcss-scoped-preflight` plugin. The public site never sees Tailwind.

**What this means for your product:** Admin uses shadcn defaults (rounded corners, shadows, focus rings) and the public site keeps its own look. Neither bleeds into the other.

**Check before approving:** This adds a build-config dependency (`tailwindcss-scoped-preflight`) that has to keep working as Tailwind versions change. Actively maintained as of 2026, but you are coupled to it.

**What this closes off:** Tailwind anywhere on the public site. Using a single utility class there means unwinding the scoping.

---

## 4. OpenClaw access — Edge Function with shared secret

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §3.3](architecture.md#33-edge-function--stats-ingest)

**Decided:** OpenClaw writes to `stats` by calling the Supabase Edge Function `stats-ingest`. The function checks a shared secret in a request header using a constant-time comparison — so an attacker cannot guess the secret one byte at a time by measuring response timing — and inserts the row with the service role.

**What this means for your product:** Only OpenClaw can write stats, because only OpenClaw has the secret. Rotation is one place: the Edge Function env plus OpenClaw's config. The public anon key cannot insert. The admin panel never holds the secret.

**Check before approving:** You own the operational job of keeping that secret out of repos, screenshots and chat logs. If it leaks, anyone can spam the stats table until you rotate. Blast radius is contained — INSERT only, nothing readable or modifiable.

**What this closes off:** Direct Supabase REST with a publishable key. That key is public on the internet by design, so anyone could spam stats. The Edge Function is ~30 lines and it is the line between you and the open internet.

---

## 5. Image data layer — Storage bucket + `images` table

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §2.4](architecture.md#24-images)

**Decided:** Image files live in a Supabase Storage bucket called `images` at `images/{projects|posts}/{parent_id}/{uuid}_{filename}`. An `images` row tracks the bucket path, the alt text (required), and the parent project or post. Orphans (rows with no parent) older than 7 days can be deleted by an admin button.

**What this means for your product:** Every image has alt text, enforced at the database level by `NOT NULL`. Deleting a project orphans its image; you have a week to reassign it or run cleanup. Cleanup is manual by design — no scheduled job, no quota check — so you will not lose images by accident.

**Check before approving:** You click "Clean orphans" occasionally rather than having it automated. The alternative costs Edge Function invocations and operational complexity. If image volume ever spikes, automation is a small follow-up.

**What this closes off:** Soft-delete. Once you delete a project and run cleanup, the image is gone from Storage. Recovery would mean a `deleted_at` column and a tombstone-cleanup job. Hard-delete with a 7-day grace was the explicit choice.

---

## 6. Markdown renderer — `marked` + DOMPurify whitelist

**Date:** 2026-05-06
**Architecture link:** [`architecture.md` §7](architecture.md#7-markdown-renderer-decision-6)

**Decided:** Posts are stored as raw Markdown. The browser parses them to HTML via `marked` and sanitizes the result through DOMPurify against a fixed whitelist (`p, ul, ol, li, blockquote, code, pre, em, strong, a[href], h1-h4, img[src,alt]`). Anything else is stripped. Sanitization is deliberately deferred to a client-side effect so DOMPurify never runs on the SSR Node path.

**What this means for your product:** You write in Markdown. The database never contains HTML, so pasting something hostile into a post body cannot become a stored XSS attack. Sanitization happens fresh on every read.

**Check before approving:** The whitelist is intentionally tight. A `<details>` collapsible, a YouTube embed or an `<iframe>` means widening it and weighing each addition's XSS surface. Tight default, expand by exception.

**What this closes off:** Storing pre-rendered HTML. That trades slightly faster reads for a much larger trust surface — every post body re-sanitized on edit, and any sanitization bug persisting in the data. "Trust nothing in storage, sanitize on the way out" is the safer default.

---

## 7. Variant selection — UA-only header injection (RETIRED at T46)

**Date:** 2026-05-08
**Architecture link:** T10b — `middleware.ts`

**Decided (and since reversed):** Server-side middleware read the User-Agent string and set an `x-device-variant: mobile|desktop` header on every public request; pages read it at render time to pick a desktop or mobile component variant. No URL rewriting, no client-side viewport detection. Phones and desktops shared one canonical URL per page, so SEO stayed single-source and inbound links did not fork.

**Previously → now:** implemented at T10b and consumed by T10c pages reading `headers()`. T46 deleted the mobile component fork and the device split entirely. The public site is one responsive tree with a single 640px breakpoint, `middleware.ts` no longer computes a variant, and its matcher is narrowed to `/admin/:path*`, so middleware does not execute on public requests at all. See decision #34. This entry is kept because it explains why the old URLs never forked and why there is no `/m/` route history to clean up.

---

## 8. Styles folder lives at `app/styles/`, not `/styles/`

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.1](architecture.md#41-repo-layout-proposed), [§4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04)

**Decided:** The public site's CSS lives at `app/styles/`. The original spec called for a root-level `/styles/`; T2 scaffolding put the files under `app/styles/` and left an orphaned empty root directory behind. The orphan was deleted and the spec updated to match the wiring.

**What this means for your product:** Nothing visual or behavioural. This is a doc-sync, not a refactor — it removes the "which one is real" question for future sessions.

**Check before approving:** CSS sits inside `app/` rather than at the project root. That is closer to Next.js convention and matches where `app/layout.tsx` imports from. Moving the files back was rejected as churn for no benefit.

**What this closes off:** A root-level `/styles/` convention. Adopting it later means moving files and updating every import.

---

## 9. CONSTRAINT-05 clarified: additive prop extensions permitted on bundle components

**Date:** 2026-05-11
**Architecture link:** [`constraints.md` CONSTRAINT-05](constraints.md#constraint-05-public-bundle-is-verbatim--inviolable)

**Decided:** The verbatim-bundle rule governs rendered visual output — pixels, motion, typography — not the prop interface or runtime behaviour. A design-export component may grow optional props whose default equals the existing hardcoded content, so it still renders byte-identically with no props passed.

**What this means for your product:** Public list pages can consume database rows while staying visually verbatim. Without this, every data-wiring task hits the same blocker and buys a per-task design consult that resolves nothing new.

**Check before approving:** When a change touches an export-ported component, check the diff: does it render the same default output with no props? If yes, it respects CONSTRAINT-05. If a pixel moves, it does not. That is the line.

**What this closes off:** A strict letter-reading that forbade any modification to export components. Wiring interactive behaviour (link `href`, form actions) to real targets is expected; only *new visual patterns* still require an `@designer` consult.

**Implementation note:** clarification appended to CONSTRAINT-05 on 2026-05-11, triggered by Wave 3b of T11 correctly blocking on the strict letter and surfacing the decision rather than improvising past it.

---

## 10. UI-boundary error handling — `lib/safe-load.ts`

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.4](architecture.md#44-ui-boundary-error-handling--libsafe-loadts)

**Decided:** When a public page asks the database for content and the database fails — wrong env vars, RLS denying, network blip — the page renders an empty state with a clearly-logged error rather than crashing to a 500. `lib/safe-load.ts` wraps every `lib/db.ts` call a Server Component page makes: it catches the throw, writes a structured stderr line in the same shape as the data-layer logger, and returns the caller-supplied fallback.

**What this means for your product:** A visitor never sees "Application error: a server-side exception has occurred" because of a database hiccup. Worst case they see empty content. The error still hits stderr with full context, so a real failure is debuggable, not silent. This is what kept the site at 200 during session 7's malformed-env-var period while every query was throwing underneath.

**Check before approving:** The failure mode is "page renders empty with no explanation to the visitor". Surfacing an "Oops, content failed to load" message was rejected as too SaaS-flavoured for the voice (CONSTRAINT-13). The existing empty-state copy is the user-facing surface for both genuinely-empty and broken-DB conditions. That is a deliberate trade.

**What this closes off:** Letting `ServiceError` bubble to Next.js's default error UI on user-facing routes. It also fixes the fallback shape per call site rather than per page. A styled "something went wrong" UI for genuine outages, distinct from "nothing here", now lives in the route-level boundary added at T41 (decision #40), not in this wrapper.

---

## 11. Server-safe Nav props — plain-data `hrefs` for Server Components (RETIRED at T46)

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.5](architecture.md#45-server--client-prop-boundary--nav--mobilenav)

**Decided (and since superseded):** The old `Nav` / `MobileNav` components accepted two parallel ways to specify link targets: a `resolveHref` function prop from Client Components, and a static `hrefs={NAV_PATHS}` object from Server Components. The split existed because React Server Components prohibit passing a function value from a Server Component to a Client Component — Next.js throws at request time and the page 500s.

**Previously → now:** shipped in session 7 (2026-05-11) as part of the BLOCKING-03 fix. T46 replaced both components with a single `SiteHeader` and deleted `lib/nav-targets.ts`, so the two-prop shape is gone. **The rule that produced it still binds:** never pass a function across the Server→Client boundary. Pass plain data and let the client compute. This one 500'd only once a real post existed to render, because `notFound()` had always fired first — a reminder that RSC boundary violations can sit latent behind a guard clause.

---

## 12. Image URLs are short-lived, generated on demand

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.6](architecture.md#46-image-read-pattern)

**Decided:** Images are not served from a permanent public link. Every time a page needs one, the server generates a fresh signed URL valid for one hour (`SIGNED_URL_TTL_SECONDS = 3600` in `lib/images.ts`). Visitors viewing the page during that hour are unaffected when it expires.

**What this means for your product:** Visitors see images normally. If anyone copies a URL out of your HTML — devtools, sharing, scraping — it cannot be reused forever to hot-link your images and burn Supabase bandwidth. After an hour it is dead. Cost is a few milliseconds of server work per image.

**Check before approving:** Reversible. If images become truly public and simpler URLs are wanted, flip the bucket to public and switch to `getPublicUrl`.

**What this closes off:** CDN-style permanent links. Embedding one of your images in an external Markdown post, a tweet or a third-party blog needs a different mechanism — a public mirror or a dedicated re-share endpoint.

---

## 13. Image URLs are resolved on the server, not in the browser

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.6](architecture.md#46-image-read-pattern)

**Decided:** The signed URL is resolved during the server render and baked into the HTML before it reaches the visitor. No component fetches its own URL after mount.

**What this means for your product:** Google sees your project and post images when it indexes pages — which matters for a portfolio. Visitors get images with the rest of the page, not a second later when JavaScript catches up. The tradeoff is that the resolving component cannot itself be interactive; interactivity goes in a wrapper.

**Check before approving:** Reversible. If an image surface ever needs browser-side behaviour, split it: a server component for the URL, a client component for the interaction. `ProjectFrame.tsx` already does exactly that — it is a Client Component that receives pre-resolved URLs as plain data.

**What this closes off:** Client-side conditional image loading (for example "only fetch the URL when scrolled into view"). Native `loading="lazy"` covers the typical case.

**Previously:** the pattern was carried by `<ProjectImage>` and `<PostImage>`, both deleted at T46. The resolution now happens in `lib/public-projects.ts` and is handed down as data.

---

## 14. Admin CSS token namespacing

**Date:** 2026-05-11
**Architecture link:** [`architecture.md` §4.2](architecture.md#42-tailwind-scoping-decision-3--resolves-assumption-04)

**Decided:** Admin defines its colour tokens under a namespaced prefix (`--admin-bg`, `--admin-surface`, `--admin-fg`, `--admin-accent`) rather than reusing the bare names the public site uses. Amended 2026-05-12: the palette grew from 4 to 8, adding four semantic tokens (`--admin-destructive`, `--admin-destructive-fg`, `--admin-border`, `--admin-muted-fg`) because shadcn primitives need semantic slots — destructive button background, table border, muted body text — and inline-styling those gaps was the exact sprawl the 4-token rule existed to prevent. `@designer` + `@cto` confirmed extending the palette over inline-styling.

**What this means for your product:** A change to either side's colours cannot repaint the other. The two visual worlds are isolated by variable name, not just by file location. The original rule protected against importing public-site *identity* elements — signature typefaces, hairline grammar, gold-underline links — not against admin palette growth.

**Check before approving:** A token rename or value change means updating both files independently. A single source of truth for the colours would need a build-time copy step; the current setup trades that for isolation.

**What this closes off:** Sharing CSS custom properties across the public/admin boundary. Any component wanting the same colour in both contexts must reference both prefixes, or use the Tailwind theme alias (admin only).

**Note (T46):** the admin hex values were originally *sourced from* the public palette. They no longer mirror anything — the public site went light and admin stayed dark deliberately. They are admin-owned constants and must not be resynced. See CONSTRAINT-16 and decision #34.

---

## 15. Admin URL pattern — locked to `/admin/*`

**Date:** 2026-05-12
**Architecture link:** §4.1 (admin route structure) + CONSTRAINT-17

**Decided:** Admin lives under `/admin/*`. Login is `/admin/login`, dashboard is `/admin`, edit screens are `/admin/projects/[id]/edit`. The public site never uses `/login` or `/dashboard`.

**What this means for your product:** Admin and public live at clearly separate URLs. Crawlers see one rule (`Disallow: /admin`) and skip the whole tree. If you later want a public hobby-stats dashboard, `/dashboard` is still free.

**Check before approving:** Nothing product-level. The URLs you type are slightly longer; that is the only thing you feel.

**What this closes off:** Root-level admin URLs. Does *not* close off a future subdomain split — the `/admin/*` tree maps to `admin.swarnimbagre.com` trivially.

---

## 16. `'use server'` files contain one Server Action each

**Date:** 2026-05-12
**Architecture link:** §6.6.1 + SEC-08 + `auth-flow.md` §2a point 4

**Decided:** Files carrying the `'use server'` directive export exactly one async function — the public Server Action entry point. Throwing helpers, allowlist guards, and any function whose behaviour or timing depends on outcome live in a sibling file with no directive (`lib/auth.ts` wraps `lib/auth-internal.ts`), imported as a regular ES module.

**What this means for your product:** Every export from a `'use server'` module becomes a publicly callable RPC endpoint with a stable hashed ID that ships in the client bundle. An attacker can call any of them directly via the `Next-Action` header, bypassing the wrapper. Keeping helpers out of that file means they are server-internal and unreachable from a browser. T17's audit loop proved this the hard way: the audit-2 fix exported the throwing helper from the `'use server'` file, and the build manifest grew a second action ID that bypassed the wrapper's constant-time bound.

**Check before approving:** One extra import line per auth-adjacent feature. Wrapping helpers inside the `'use server'` file with internal `try/catch` was tried in audit-2 and failed, because Next.js still exports them. There is no "private export from a `'use server'` file" — the file boundary *is* the security boundary.

**What this closes off:** Co-locating throwing helpers next to their wrapper. Verifying `server-reference-manifest.json` against the expected action IDs becomes a required build-time check for every auth-adjacent change.

**Implementation note:** T17 audit-round-3, 2026-05-12 — `lib/auth-internal.ts` created, `lib/auth.ts` reduced to a single export.

---

## 17. Auth Server Actions have a constant-time response floor

**Date:** 2026-05-12
**Architecture link:** §6.6.2 + `auth-flow.md` §2a point 3

**Decided:** The public `signInWithMagicLink` Server Action wraps its internal helper in `try/finally` and pads with `setTimeout` so wall-clock response time has a minimum bound of 750ms regardless of outcome. Fast paths pad up to the floor; slow paths run over without truncation. The wrapper catches and discards thrown errors silently — re-logging inside the catch would itself introduce a timing differential and reopen the channel.

**What this means for your product:** An attacker probing the login endpoint cannot tell "this is the admin's address" from "this is not" by measuring response time. Before the fix, the not-allowlisted path returned in microseconds while the allowlisted path waited ~100-500ms for Supabase — a single HTTP probe revealed the admin email. The cost is a ~750ms login, below the threshold anyone notices on a once-a-month action.

**Check before approving:** Are you OK with login taking ~750ms? That is the floor, not a ceiling. Truncating slow paths with a ceiling was rejected because it introduces a separate oracle (timeouts vs successes). Floor-not-ceiling comes from `auth-flow.md` §2a point 3.

**What this closes off:** Inline error logging on the wrapper's catch branch, and per-outcome custom response shapes (which would reopen the body-shape channel — F-13). Any future auth-adjacent Server Action with outcome-dependent inner timing must follow the same floor-wrap pattern.

**Implementation note:** T17 audit-round-2, 2026-05-12 (`lib/auth.ts`). Verified by a Vitest fake-timer test asserting resolution at ≥750ms across allowlisted, not-allowlisted, malformed and Supabase-failure outcomes.

---

## 18. Supabase auth client locked to `flowType: 'implicit'`

**Date:** 2026-05-12
**Architecture link:** §6.6.3 + `auth-flow.md` §2a point 5 + CONSTRAINT-18

**Decided:** `lib/supabase.ts::createServerClient` sets `auth: { flowType: 'implicit' }` rather than accepting the library default (PKCE). The magic-link callback consumes the `?token_hash=&type=` shape via `verifyOtp`, which works under both flow types, so users experience nothing different. The PKCE-shaped `?code=...` branch in the callback is dead under the current magic-link-only model and is retained intentionally for future OAuth.

**What this means for your product:** PKCE's `*-code-verifier` `Set-Cookie` header would be sent only on the call-Supabase branch, not on the throw-and-skip branch. Anyone watching the network tab could distinguish "this email is allowlisted" from "this email is not" by checking whether the response set a cookie — a single-probe oracle at the HTTP-header level, orthogonal to the body-shape and timing channels closed by #16 and #17. Implicit flow does not emit that cookie, so headers are uniform across all outcomes.

**Check before approving:** This is a quiet but binding config decision. Flipping back to PKCE — or removing the explicit config and inheriting a future library default — reopens the enumeration channel silently, with no runtime error. The guardrail is `tests/auth-cookies.test.ts`, which asserts the production factory passes `flowType: 'implicit'` through to `@supabase/ssr` and that no `*-code-verifier` cookie is written on any branch.

**What this closes off:** OAuth support without revisiting this decision. Adding an OAuth provider means either two clients (implicit for magic-link, PKCE for OAuth) or re-deriving whether uniform headers are reachable under PKCE. Not a problem today (magic-link only, CONSTRAINT-09), flagged for whoever adds OAuth.

---

## 42. Dev-only API routes are env-gated with a compiler-evasion trick

**Date:** 2026-05-12
**Architecture link:** [`architecture.md` §4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + CONSTRAINT-19

**Decided:** Test-fixture routes mount only when three runtime gates pass: `NODE_ENV` equals `'test'` (read via `process.env[NODE_ENV_KEY]` indirection, **not** direct dot access), Vercel's `VERCEL=1` is absent, and a fixture secret matches the request header under constant-time comparison. The indirection exists because Next 15 inlines `process.env.NODE_ENV` at build time — direct access compiles to a literal `true` regardless of runtime env.

**What this means for your product:** Test infra is unreachable in production three independent ways, and any single gate failure returns a 404 with no distinguishable error. The bracket-indirection idiom is non-obvious, so a future session (or you, in six months) might "clean it up" back to dot access and silently re-enable the route in production builds. CONSTRAINT-19 exists to make that a review-catchable mistake.

**Check before approving:** You are OK with a compile-time-evasion idiom in the codebase. Re-run the build-output inspection in `docs/security-report.md` audit 7 if anyone changes the gate.

**What this closes off:** "Just delete the route in production" patterns. The gates *are* the production safety; deleting the file would lose the ability to run e2e tests against production-shape builds, which the test infra requires.

**Implementation note:** T19.2, 2026-05-12. `@security` audit 7 CLEAR — build-output grep shows zero `TEST_FIXTURE_SECRET` references in `.next/static/chunks/*`, so the indirection survived bundling.

---

## 43. Playwright auth fixture uses server-side magic-link generation

**Date:** 2026-05-12
**Architecture link:** [`architecture.md` §4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + CONSTRAINT-19

**Decided:** E2E tests log in via `auth.admin.generateLink` (service-role) plus `auth.verifyOtp` server-side, then hand the bound cookie jar to the browser context. No password anywhere, no email inbox involved.

**What this means for your product:** Test runs cannot leak production secrets or impersonate a real user, they exercise the same `verifyOtp` path real logins hit (so callback-shape regressions get caught), and the fixture identity lives on an unowned subdomain (`test.swarnimbagre.com`) so collisions with real users are impossible.

**Check before approving:** Tests need the Supabase service-role key in the test environment (already required for the stats-ingest Edge Function). The triple-gated `/api/test/sign-in` is what hands the cookie to Playwright — decision #42's three gates are the only thing between this fixture and a production session-mint endpoint.

**What this closes off:** UI-driven magic-link interception (fragile and slow — it needs Supabase's outbound email infra in test) and per-test password storage. A CI-only Supabase project was already closed off by CONSTRAINT-02.

**Implementation note:** T19.2, 2026-05-12. `app/api/test/sign-in/route.ts`, `tests/e2e/fixtures/auth.ts`, `scripts/seed-test-fixture.ts`. The same service-role minting approach is what decision #41 later reuses for admin lockout recovery.

---

## 19. Admin mutation modules split per resource

**Date:** 2026-05-13
**Architecture link:** §6.6.6 + §6.6.5 + §4.3 + `auth-flow.md` §2a point 4

**Decided:** Every admin resource family with a write surface gets its own trio of files, not one shared trio for all of them:

- `-types.ts` — pure types and the user-facing error string. Safe to import from a `'use client'` component.
- `-internal.ts` — throwing helpers and zod schemas. No `'use server'` directive; server-only.
- `-mutations.ts` — the `'use server'` module. Every export is a Server Action, nothing else.

**What this means for your product:** Admin forms get field-level and form-level errors with strongly-typed shapes, because the form knows the action's return type at compile time. Without the third file the client must either lose type-safety or pull in a module that transitively imports `next/headers`, which is a hard Next 15 build error. Adding the next admin write feature means creating one small trio, not bolting onto a monolith. It also keeps unrelated paths apart: a change to the project slug-lock policy cannot regress the stat-insert path, and a file-upload error-handling bug cannot leak into the post-update wrapper. Tests split on the same axis.

**Check before approving:** One extra import line per resource family, and one entry per trio in the SEC-09 inventory in `tests/server-actions-manifest.test.ts`. Audits get easier to scope; anyone reading the architecture has more file paths to hold. Small cost for a one-person project, a clear win for a team.

**What this closes off:** A single shared mutation file any future feature could "just add an action to", and putting the UI state envelope (`fieldErrors`, `formError`, `status`) into the global `lib/types.ts` alongside domain types. Genuinely shared mutation logic gets its own trio (e.g. `lib/admin-publishing-mutations*.ts`), never a bolt-on to an existing resource. Adding an export to a `'use server'` module without updating the manifest test is a build-time failure by design.

**Previously:** T21 introduced this as ONE shared trio (`lib/admin-mutations*.ts`), extended at T22 when `deleteProject` joined it, carrying ten actions across projects, posts and stats. By T25 that had reached 519 and 687 lines — both past CQ-02's 300-line service-file budget, and headed for ~800/~900 with image upload merged in. T25 commit 1 deleted the shared trio and created per-resource trios for projects, posts and stats; the images trio and `uploadImage` followed in commit 2 (allowlist 10 → 11). `@security` audits 8, 9 and 12 CLEAR. The six-channel uniformity contract from `auth-flow.md` §2a applies identically across the auth surface and the mutation surface.

---

## 20. Zod `.strict()` adopted across the admin mutation surface (F-26 closure)

**Date:** 2026-05-13
**Architecture link:** §6.6.6 boundary-validation discipline + `security-report.md` F-26

**Decided:** Every zod schema on the admin write boundary appends `.strict()`, so parsing throws on any input field whose name is not declared. Originally scoped to four schemas by the audit; expanded to all six write-boundary schemas to keep the rule uniform.

**What this means for your product:** Nothing visible changes today. The wrappers read FormData by explicit key, so an extra field in a probe request is simply never read. What changes is depth of defence: if a future refactor switches a wrapper to `Object.fromEntries(formData.entries())` — the kind of shortcut a reasonable agent writes — the schema rejects the request at the boundary instead of silently writing extra fields to the database. F-26 stops being carried forward as a "scope keeps extending" finding.

**Check before approving:** A no-op for users by design. The only visible effect is in tests: any unit test calling `.parse()` with an extra key now throws where it previously passed. Such a test was relying on the old laxness and should drop the extra key.

**What this closes off:** Schema laxness as future-proofing. Adding a field to the admin write surface means adding it to the schema explicitly — there is no quiet path from form to database. Removing `.strict()` is a security regression and `tests/admin-mutations-strict.test.ts` fails loudly.

**Implementation note:** T25 commit 3, six schemas updated in lock-step across the per-resource internal modules. F-26 marked CLOSED at `@security` audit 12.

---

## 21. `useActionState` dispatch from inside a parent form (BLOCKING-01 closure)

**Date:** 2026-05-14
**Architecture link:** §6.6.7 + `tests/ImageUpload.test.tsx` regression pin

**Decided:** An admin client component that holds a Server Action and lives inside a parent `<form>` must not wrap itself in another `<form>`. It uses `useActionState` plus `startTransition(() => dispatch(formData))` behind a `<button type="button" onClick={...}>`, building the `FormData` from refs and state in the click handler.

**What this means for your product:** Image upload from the project and post edit pages actually works. Before this it looked functional and silently failed, because HTML disallows nested forms — the browser dropped the inner form and the outer submit handler intercepted everything. T15-T27 mocked the dispatch path in unit tests, so the bug only surfaced against a real browser at T28.

**Check before approving:** Upload an image while editing an existing project. The new image should appear and replace the old one, with the previous image flowing to `/admin/images` as an orphan eligible for the 7-day sweep.

**What this closes off:** `<form action={serverAction}>` nested inside another form, in any admin client component. The regression test pins `<form>` absence, so the bug cannot return quietly.

**Implementation note:** `components/admin/ImageUpload.tsx` only. The Server Action wrapper and its internal helper were byte-identical afterwards — wire shape and zod boundary unchanged. `@security` audit 15 CLEAR.

---

## 22. `storage.objects` RLS policy required per Storage bucket (migration 007)

**Date:** 2026-05-14
**Architecture link:** §2.4 + CONSTRAINT-20

**Decided:** Every Supabase Storage bucket must carry an explicit `storage.objects` RLS policy scoped to `bucket_id`, applied in the same migration as the table FK that references it. Default-deny applies on Storage exactly as on tables — the Storage analogue of CONSTRAINT-08, formalised as CONSTRAINT-20. The policy must specify both `USING` and `WITH CHECK` for INSERT/UPDATE writes to be permitted.

**What this means for your product:** Image upload is permitted at the database layer. Migration 005 created the `images` bucket but deferred its policy to "T15"; the deferral was forgotten, and T15-T27 never caught it because every unit test mocked the Storage client. T28's first real upload hit it as a hard RLS denial. The next bucket you add starts default-denied with its policy shipping in the same migration.

**Check before approving:** `pg_policies` shows `images_storage_admin_all` with both `qual` and `with_check` set to `(bucket_id = 'images'::text)`.

**What this closes off:** The "table policy is sufficient" assumption. Worth remembering for the next Storage denial: the Supabase JS SDK strips the `for table "X"` suffix from RLS error messages, so a Storage failure reads like a `public.{table}` failure (§2.4).

**Implementation note:** `supabase/migrations/007_rls_storage_images.sql`. The `public.images` policies from migration 005 are unchanged.

---

## 23. Defer Sentry pre-launch — manual log review until launch (T32 Option B)

**Date:** 2026-05-14
**Architecture link:** [`monitoring.md`](monitoring.md) (canonical) + CONSTRAINT-05. No `architecture.md` section — observability posture is operational, not structural.

**Decided:** Error monitoring via Sentry is deferred. Pre-launch the project relies on Vercel Runtime Logs plus Supabase logs (Edge Function, Postgres, Auth, Storage). `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are stubbed in `.env.example` with a deferred-status comment; there is no `lib/sentry.ts` and no Next config plugin. Two named gate conditions flip this to Option A (full Sentry deploy): the first external share of the site URL, or the first production bug discovered hours or days after it happened.

**What this means for your product:** The public site ships with zero third-party tracking bytes. You get no error emails or push notifications during the first weeks of traffic — when something breaks, you go look. `monitoring.md` lists exact log locations for every failure mode the app can produce. The accepted blind spot is post-hydration client-side errors on the public site: if a component throws after the page loads, nothing captures it. That blind spot is the main reason the gate condition exists.

**Check before approving:** Are you OK with no push-style alerts at first? You have to remember to look. The first time you find a bug that was live for a day before you noticed, flip to Option A — do not wait for a second one.

**What this closes off:** Almost nothing. `@sentry/nextjs` is a ~30-minute wizard install. PII-scrubbing rules are deliberately not authored speculatively; they get designed against real event payloads when Option A is activated. "Deferred" here means sequencing, not rejection.

---

## 24. Admin query modules split per resource + shared `logQueryError` (T37)

**Date:** 2026-05-15
**Architecture link:** §6.6.8

**Decided:** `lib/admin-queries.ts` was split into one module per resource, mirroring the mutation-side split in #19. The original path is kept as a thin barrel that re-exports them, so no caller changed. The structured error-logging helper that had been copy-pasted into each query module collapsed into one `logQueryError` in `lib/admin-mutation-log.ts`.

**What this means for your product:** No behaviour change — structural hygiene. The file had grown past the 300-line budget (CQ-02) and carried three near-identical copies of the same helper (CQ-07). Each file is now readable in one sitting, and a bug in the posts query path cannot touch the projects path.

**Check before approving:** Nothing user-visible; verified by a clean build, clean `tsc`, a green suite, and an unchanged Server Action manifest.

**What this closes off:** The "one big admin-queries file" shape and per-module duplicate log helpers. New admin resources get their own `admin-queries-<resource>.ts`, the barrel re-exports it, and query-error logging always goes through `logQueryError`.

**Implementation note:** `@dev` parallel-fix during T37 code review; documented in architecture.md §6.6.8 at T38.

---

## 25. Image-bucket size/MIME limits codified in migration 008 (F-30)

**Date:** 2026-05-15
**Architecture link:** §2.4 + §5.2

**Decided:** The `images` bucket's 2 MB size cap and JPEG/PNG/WebP MIME allowlist live in version control as `supabase/migrations/008_storage_images_limits.sql`. This supersedes the original arrangement, where the limits were hand-set in the Supabase Dashboard and only described in a trailing comment of migration 005. That comment stays unedited — applied migrations are immutable, you write a new one rather than rewriting an old one — and 008 is the source of truth from here.

**What this means for your product:** A fresh clone or a disaster-recovery rebuild reproduces the exact bucket limits from the repo instead of relying on someone remembering which Dashboard fields to click. The limits were already live; 008 is idempotent and only makes production match version control. Closes F-30 (audit 16).

**Check before approving:** After applying, `storage.buckets` for `images` shows `file_size_limit = 2097152` and `allowed_mime_types = {image/jpeg,image/png,image/webp}`. Applying to prod is the T39 deploy step, tracked in `docs/launch-checklist.md` — single prod project, no staging, per CONSTRAINT-02.

**What this closes off:** Storage limits living only in the Dashboard. New buckets codify their limits in a migration.

**Implementation note:** `@dev` during T37 (security audit 16 follow-up); documented in architecture.md §2.4 + §5.2 at T38.

---

## 26. `/api/admin/*` route handlers self-gate via `assertAdminSession()` (F-17)

**Date:** 2026-05-15
**Architecture link:** §6.6.4

**Decided:** The Next.js middleware matcher deliberately excludes `/api/*`, so any endpoint under `app/api/admin/**` is not protected by the middleware admin gate. Standing rule: every such handler calls `assertAdminSession()` from `lib/session.ts` before any business logic and returns a bare 401 if there is nobody there — the API analogue of the page gate's redirect-uniformity contract.

**What this means for your product:** There are no `/api/admin/*` routes today; the only `app/api/` route is the env-gated test-sign-in fixture, which self-protects (see #42). This entry exists so the first admin API route anyone adds ships protected by construction rather than silently bypassing auth. It is a guardrail recorded ahead of the code that needs it.

**Check before approving:** When the first `app/api/admin/**` route ships, code review confirms the guard precedes all logic and the unauthenticated response is a bodyless 401.

**What this closes off:** The silent-bypass failure mode where an endpoint under `/api/` looks protected because the page routes are, and is not.

**Implementation note:** standing rule from `@security` audit pass 5 (F-17); no code yet, guardrail only. Brief entry added at T38 to close the architecture.md §6.6.4 coverage gap.

**Amended 2026-08-04 (audit 24b):** the rule stands; the function it names changed. It previously named `getServerSession()`, which returned a session object if one *appeared* to be present and whose own documentation argued that presence was enough — exactly the reasoning F-39 retired. It had no callers, so it was deleted rather than fixed. See #35.

---

## 27. Admin theming tokens declared at `:root` to survive Radix portal escape

**Date:** 2026-05-19
**Architecture link:** §4.2 (Tailwind scoping — "Declaration site")

**Decided:** The eight `--admin-*` custom properties are declared at `:root` in `app/styles/admin.css` rather than scoped to `.admin-root`. The dark visual chrome — background, text colour, Inter, full-viewport height — stays on `.admin-root`, so the theme is still visually confined to admin routes. Token names and values are unchanged; only the declaration site moved.

**What this means for your product:** Dropdowns and other overlays in admin render with the correct dark surface and gold accent. Before this they painted transparent and let the table rows behind bleed through. The cause is specific to Radix primitives: their overlay content is portalled to `document.body`, outside `.admin-root`, and a CSS variable only resolves inside the selector it is declared on, so the popover utilities hit undefined.

**Check before approving:** Open `/admin/projects` and click the row actions dropdown — it should paint as a solid dark menu with gold focus. The public site references no `--admin-*` variable (Tailwind is admin-only), so nothing public is affected.

**What this closes off:** Reverting the tokens to a `.admin-root`-scoped declaration without first solving portal-resolvability another way — a portal target inside `.admin-root`, or re-declaring tokens on every Radix `Content`. A scope-only revert re-breaks every overlay in admin. Any future portalling primitive now works by default.

**Implementation note:** Session 27 also added `app/(admin)/error.tsx`, a LOUD-failure boundary for the admin segment: uncaught render throws surface `error.message` and `error.digest` verbatim with a `reset()` retry, no swallowed-error path (§4.4). The public equivalent arrived at T41 — see #40.

---

## 28. Project content-model expansion — 6 nullable columns + Override 1 (T42)

**Date:** 2026-05-19
**Architecture link:** [`architecture.md` §2.1](architecture.md#21-projects) + `design-decisions.md` Override 1 (RETIRED at T46) + `constraints.md` CONSTRAINT-05

**Decided:** `projects` grows six nullable columns in `supabase/migrations/009_projects_content_model.sql`: `github_url`, `live_url`, `post_url` (three fixed link slots), `progress_percent` (integer 0–100 with a CHECK), `thumb_kind` (text, vocabulary held in code rather than a DB enum), and `image_after_id` (FK → `images.id` ON DELETE SET NULL, the before/after "after" image). No new tables, no JSONB. The design bundle's `StatusPill` and `DemoLoop` were dropped from the card's data path in favour of a progress ring and three conditional buttons (`{ } code`, `↗ site`, `¶ notes`) wired to the link columns. CONSTRAINT-05 was overridden for the project-card surface only, recorded as Override 1.

**What this means for your product:** Project cards show real progress, real links and real screenshots instead of mock vocabulary — lifecycle pills and animated demos that never matched the screenshots. Buttons appear and disappear depending on which URLs you filled in.

**Why this shape (A) over Shape C from `content-model-expansion.md`:** six nullable columns are lighter than new tables plus JSONB; zero new RLS surface, because the existing `projects_public_select` and `projects_admin_all` policies already cover every column on the table (verified against migration 002); zero new orphan scenarios, because `image_after_id` reuses the `images` row and Storage lifecycle including the 7-day sweep; and fully reversible, since every column is nullable and dropping a slot loses no other data.

**Why override CONSTRAINT-05 rather than bend the schema:** keeping the card verbatim would have forced a schema downgrade — fewer real fields, more mock vocabulary — and delivered a less honest project surface than the bundle itself would have designed with the new model in hand.

**What this closes off:** Progress as anything other than an integer percent — lifecycle stages, multi-stage rings, named milestones — is now a migration. So is a fourth link slot. Video demos are a new component plus a new Storage path.

**Previously → now:** Override 1 retired with the bundle it amended at T46. `github_url`, `live_url`, `progress_percent` and `image_after_id` are live on the redesigned card. `post_url` and `thumb_kind` remain as columns but nothing reads them; historical values survive in case the motif idea is revisited. See #34.

---

## 29. Override 2 — embla-carousel-react opens public-site JS-library posture with byte budget (T43.B)

**Date:** 2026-05-20
**Architecture link:** [§1.2](architecture.md#12-frontend-libraries) + `design-decisions.md` Override 2 + `constraints.md` CONSTRAINT-05

**Decided:** `embla-carousel-react` ^8 was added as the public site's first runtime JS dependency. The posture narrowed from "no JS libraries at all" to "JS libraries only via a named Override entry in `design-decisions.md` with a measured byte budget pinned in the Override". Override 2's budget was **15 KB gzip**, against a measured baseline of ~11.7 KB across three packages.

**Why this over scroll-snap plus custom JS:** the `@cto` consult weighed the budget-zero alternative and rejected it. Custom JS would have to re-implement dot indicators, arrow keys, swipe physics, focus management and ARIA roles — net new bug surface against a battle-tested library — for a delta smaller than one screenshot. The doctrine narrowing was also judged more honest than a "we never use libraries" stance that always eventually breaks.

**What this closes off:** Public-site library proposals are no longer an absolute no, but each one is a deliberate doctrine event: named Override, measured budget, `@cto` approval. There is no blanket permission mechanism.

**Previously → now:** the real production-route delta was re-measured at T43.G/T43.H and came in inside budget (#31). T46 then retired the dependency entirely. `ProjectFrame.tsx` hand-rolls the carousel — the export's version is a single transformed track with dots, arrows and a 40px swipe threshold, about sixty lines, so matching it directly is both more faithful (exact `.4s cubic-bezier`, exact threshold) and one fewer dependency. `embla-carousel-react` is gone from `package.json` and the public site is back to zero runtime JS libraries. The *process* the override established survives as CONSTRAINT-22 (#31). Commit `efa294b` is the original dependency add.

---

## 30. Atomic save — Postgres RPC over application-layer rollback (T43.E)

**Date:** 2026-05-21
**Architecture link:** [§6.6.9](architecture.md#669-atomic-save-surface--postgres-rpc-pattern) + `supabase/migrations/010a_save_project_media_rpc.sql`

**Decided:** `saveProjectMedia` delegates its delete-then-insert work to a single Postgres function call — RPC `public.save_project_media(p_project_id uuid, p_rows jsonb)` — instead of running DELETE and bulk INSERT sequentially from Node with a try/catch rollback. Both statements share one transaction inside the function body.

**What this means for your product:** A carousel reorder or edit saves reliably even if the server crashes mid-save, the network drops between statements, or an INSERT fails for any reason — RLS reject, FK violation, the row-cap trigger firing on the 21st row. The project ends up with entirely the new set of media rows or entirely the old set, never a torn state. The old worst case — reorder, half-save, blank carousel, re-upload from scratch — is gone.

**Check before approving:** `anon` cannot invoke it. Both `revoke from public` and `revoke from anon` are required, because Supabase's project-bootstrap default privileges grant directly to `anon`; `EXECUTE` belongs to `authenticated`, `postgres` and `service_role` only. Rollback on INSERT failure is covered by migration 010's row-cap trigger plus the 21st-row test: the save raises in the trigger and leaves existing media untouched.

**What this closes off:** The RPC name and signature are now a contract — renaming or reshaping parameters needs a coordinated migration plus TypeScript redeploy. Swapping the transaction strategy underneath (serializable isolation, advisory locks) rewrites the SQL but not the caller. Future Server Actions that replace a whole child collection for one parent row follow the same pattern, with the conventions codified in §6.6.9: `LANGUAGE plpgsql`, `SECURITY INVOKER`, `SET search_path = ''`, revoke `EXECUTE` from both public and anon, input-shape guard via `raise exception`, ordering via `WITH ORDINALITY`. Application-layer rollback is now reserved for cases where an RPC adds genuine schema cost.

---

## 31. CONSTRAINT-22 codified + Override 2 surface boundary recorded (T43.I)

**Date:** 2026-05-23
**Architecture link:** [§4.9](architecture.md#49-carousel-surface--override-2) + `constraints.md` CONSTRAINT-22 + `design-decisions.md` Override 2

**Decided:** CONSTRAINT-22 is binding: any JS library on the public site requires (a) a documented Override entry in `design-decisions.md` with a named Surface boundary listing every file the library touches, and (b) a route-chunk gzipped size delta of 15 KB or less on the affected production route, measured against `next build`'s First Load JS output for that route — **not** the package's published ESM size on npm, which is a misleading proxy because of tree-shaking and shared-chunk attribution. Exceeding the budget escalates to `@cto`, never silent absorption. The budget is per-Override-surface, not per-library: multiple deps inside one Override share it.

**What this means for your product:** Adding a public-site JS library costs a paragraph of documentation explaining what changed, what stayed and which files participate, plus a build-time measurement. The site will not accumulate libraries the way most personal sites do — every public-site dependency leaves a paper trail, a measured cost, and a surface boundary the next contributor can audit.

**Check before approving:** Override 2's first invocation measured ~11.7 KB published ESM at T43.B and +8 KB First Load JS on `/projects` and `/projects/[slug]` at T43.H — both inside budget. Its Surface boundary deliberately excludes the data layer, the migrations and the admin field component: it is a visual and JS-runtime boundary, not a content-model boundary. Only `ProjectMediaRow.tsx` made the admin cut, because it carries the `⋮⋮` glyph named in Override 2.

**What this closes off:** Adding public-site JS libraries "to see if it works" without a documented surface and a measured delta. The next invocation restarts the process from scratch — there is no blanket permission. T43 itself closed here at 9/9 sub-tasks; no project had media rows assigned at the time, so the live site was visually unchanged until real content landed under T40.

**Note:** Override 2 itself retired at T46 along with embla (#29). CONSTRAINT-22 survives it as the standing gate for the next proposal.

---

## 32. Project↔post link — embedded writeup FK (`projects.post_id`, T45)

**Date:** 2026-06-03
**Architecture link:** [`architecture.md` §2.1](architecture.md#21-projects) + `design-decisions.md` Override 3 (RETIRED at T46) + `prd.md` §3.8

**Decided:** A project may attach one existing published post as its writeup via a nullable `projects.post_id` FK → `posts(id)` (ON DELETE SET NULL), added in `supabase/migrations/011_project_post_link.sql`.

**What this means for your product:** Project pages carry real long-form content without duplicating the posts system — you write one post, attach it, and it appears both in `/writing` and as the project's writeup. The link is a plain reference, so deleting the post just unlinks it and the project survives.

**Check before approving:**
- Only PUBLISHED linked posts are ever exposed. A draft attached via `post_id` shows nothing, enforced in-query and by RLS.
- The FK is independent of `post_url` (the outbound `¶ notes` button); they coexist.

**What this closes off:** A project-only body field (rejected — duplicates the posts system). Project long-form content flows through the posts system, not a parallel store.

**Implementation note:** `lib/db.ts` was split at this task (CQ-02) into `db-posts.ts` + `db-internal.ts`, mirroring the admin-queries split. `getPublishedPostById` is the published-only loader enforcing the no-draft-leak boundary.

**Previously → now:** Override 3 embedded the linked post's body on the project detail page. T46 deleted that route; `post_id` now resolves a card's "Writeup" action straight to `/writing/<slug>`. See #34.

---

## 33. Admin manual reorder — `sort_order` column + atomic RPC (T44)

**Date:** 2026-06-03
**Architecture link:** [`architecture.md` §2.1](architecture.md#21-projects) + §2.2 + `supabase/migrations/012_sort_order.sql` + `012a_save_sort_order_rpc.sql`

**Decided:** Both `projects` and `posts` get a `sort_order integer NOT NULL` column (CHECK `>= 0`) backing admin drag-reorder. Persistence runs through a `SECURITY INVOKER` Postgres RPC (`save_project_order` / `save_post_order`) that takes an ordered array of row ids and writes 0-based positions in one transaction. New rows append to the end via a `BEFORE INSERT` trigger. The column was backfilled newest-first on apply so the live listing did not reshuffle on deploy. A reorder bumps `updated_at` through the existing trigger.

**What this means for your product:** You control the order projects and posts appear in. The order sticks; a new project drops at the end until you move it. No separate "featured" flag is needed — ordering is the curation tool.

**Check before approving:**
- Reorder writes are admin-only, gated by the existing `*_admin_all` RLS. No new policy.
- Callers send display order only and never set `sort_order` directly; the RPC derives it from array position, so positions cannot drift or collide.
- The whole reorder is one transaction, so a partial failure leaves the old order intact rather than a half-renumbered list.

**What this closes off:** A `created_at`-only public order (no manual curation) and an application-layer multi-UPDATE reorder (non-atomic, can leave gaps or duplicates on partial failure).

**Implementation note:** Server Actions `saveProjectOrder` / `savePostOrder` follow the four-file pattern; the admin UI is `ResourceListReorder` with a "Save order" action.

---

## 34. Public-site redesign: one responsive tree, one fewer route, zero JS deps (T46)

**Date:** 2026-08-04
**Architecture link:** [`architecture.md` §4.10](architecture.md#410-public-render-architecture-one-responsive-tree-t46) + §2.1 + §2.3 + §2.6 + §4.9 + `constraints.md` CONSTRAINT-05 (re-baselined) + `design-decisions.md`

**Decided:** The original dark design bundle is retired and the public site is rebuilt wholesale against a new Claude Design export at `docs/design-source/redesign-2026-08/`. You showed the live site to several people; they were confused by it and did not like the look. That is feedback from the actual audience, and it outranks every internal argument for keeping a design we had already paid for. The palette inverted from warm dark to light (cream `#F4F1EA` background, deep green `#1F3D2F` accent), the typefaces changed to Instrument Serif, Space Grotesk and Space Mono, and the page structures were re-cut. Two migrations added the fields the new design renders: `subtitle` and `tags` on projects (`013_project_card_fields.sql`), `aside` and `sort_order` on stats plus a new `notes` table for the three text tiles on the Other page (`014_other_page_model.sql`). Overrides 1, 2 and 3 retired with the bundle they amended.

**What this means for your product:** The site now looks like something a person would want to read rather than something that needs explaining. Underneath, there is materially less of it to maintain. One component tree instead of two: the mobile fork and the server-side device sniffing are both gone, replaced by a single responsive layout with one breakpoint at 640px. One fewer public route: the project detail page is deleted, and a project's "Writeup" button goes straight to `/writing/<slug>`. One fewer dependency: the carousel is hand-written, so the public site is back to zero runtime JavaScript libraries. Each of those was a place a bug could hide in one copy and not the other. Ordering on the Other page is now yours to set explicitly, as project and post ordering already was.

**Check before approving:**
- **Project cards now require real screenshots.** The old card could fall back to a generated SVG motif when a project had no image. That fallback is gone; a project with no media renders a plain "no preview yet" box. This was chosen deliberately: a hand-drawn motif standing in for a screenshot is decoration pretending to be evidence, and a page of decoration is exactly what reads as unfinished. The price is that capturing screenshots for every project is a **hard launch gate**, not a nice-to-have.
- The old bundle is deleted, not parked. Reverting means restoring components from git history, not flipping a setting.
- `projects.thumb_kind` stays in the database but nothing reads it, so historical values survive if the motif idea is ever revisited.
- Admin deliberately stayed dark while the public site went light. The two palettes are independent by design; admin's four brand colours are its own constants and must not be resynced (CONSTRAINT-16, T46 amendment).
- The writing list's dates and excerpts are derived from `created_at` and `content` at render time rather than stored. If you ever want to hand-write an excerpt, that is the moment to add a column.

**What this closes off:** A separate mobile design. Anything the site does at narrow widths must now be expressible in one tree at one breakpoint, which is a real constraint on layouts that want to be structurally different on phones. Also closed: the project detail page as a place to put content — there is no longer a URL that is "the project's own page". And the tag list on a project is capped at 8 short labels by a database constraint, so tags cannot quietly become a taxonomy.

**Implementation note:** `getStatsByCategory` was replaced by `getOrderedStats()`; `getNotes()` and `lib/post-summary.ts` are new. The `x-device-variant` branch was removed from `middleware.ts` and the matcher narrowed to `/admin/:path*`, so middleware no longer executes on public requests at all. One bug worth remembering: the `next/font` variable classes were first placed on `<body>`, and because a CSS custom property is substituted where it is declared rather than where it is used, every composed font family at `:root` resolved to an invalid value. Every `font:` shorthand on the site silently fell back to Times New Roman with nothing in the console. Moving the classes to `<html>` fixed it, and the comment in `app/layout.tsx` exists so nobody moves them back.

---

## 35. Admin actions check who is calling before they act — `assertAdminSession()` (F-39 / F-40, audit 24b)

**Date:** 2026-08-04
**Architecture link:** [`architecture.md` §6.6.10](architecture.md#6610-application-layer-auth-guard-on-admin-mutations--assertadminsession-f-39-audit-24b) + §6.2 + §6.6.4 + §6.6.6 + `security-report.md` audit 24b

**Decided:** Every admin action that changes data — all 17 of them, across projects, posts, stats, notes, images, project media and reordering — starts by asking Supabase "is there a real logged-in admin behind this request?" and refuses if the answer is no. The check is a single shared function, `assertAdminSession()`, in `lib/session.ts`. The admin page gate in `middleware.ts` was changed at the same time to verify the login token with Supabase rather than reading the expiry date off the browser cookie. Sign-in and sign-out are deliberately not guarded — putting a login check in front of the login would lock you out of your own site.

**What this means for your product:** Until now the only thing stopping a stranger from writing to your database was the database's own permission rules. Those rules are good, but they were the *only* layer, and the whole point of two layers is that the first one catches the day the second one has a typo in it. Nothing about how you use the admin panel changes, beyond a fractional pause on each admin page load — the cost of verifying the token properly instead of trusting the cookie.

The specific hole this closes is worth understanding, because it is not obvious. Next.js admin actions are addressed by an ID that ships inside the public JavaScript your site sends to every visitor. Whoever holds that ID can trigger the action by sending it to *any* address on the site — including addresses like the homepage, where the admin door-check does not run, because at T46 we correctly narrowed that check to `/admin/*` only. So the door was locked and the window next to it was not. The guard is the window lock.

**Check before approving:**
- An unauthenticated attempt looks exactly like any other failure from the outside: same generic error text, same 750 ms response floor, no clue that authentication specifically is what failed. That was designed in — a distinguishable "you are not logged in" response is itself a probe.
- The guard *throws* rather than returning a yes/no. A yes/no answer is one forgotten `if` away from being decoration.
- It deliberately lives in a plain file, not one that publishes actions to the browser. Publishing it would have created a public "is Swarnim logged in right now?" endpoint.
- Database permission rules are unchanged and still authoritative. This did not replace them and is not licence to loosen them.

**What this closes off:** Adding an admin action without an auth check. Any new mutation that skips `assertAdminSession()` is a security regression, and it is in the code-review checklist that way. It also settles where the check goes, so it is not re-litigated per action: on the outer, browser-reachable wrapper — not on the inner helpers, which nothing outside the server can address, and not before the error-handling block, because sitting inside it is what makes an unauthenticated attempt indistinguishable from every other failure.

**Implementation note:** Two files were split in the same pass to stay inside the 300-line service-file budget the guard pushed them over: `lib/admin-projects-mutations-formdata.ts` (form-field reading) and `lib/admin-stats-mutations-schemas.ts` (validation rules), which also brings the stats surface onto the same four-file shape notes already used.

---

## 36. New Other-page rows land at the end of the list, not on top of each other (migration 016)

**Date:** 2026-08-04
**Architecture link:** [`architecture.md` §2.3](architecture.md#23-stats) + §2.6 + `supabase/migrations/016_stats_notes_sort_order_append.sql`

**Decided:** The `sort_order` column on `stats` and `notes` no longer starts every new row at position 0. The database works out the next free position at insert time and puts the row at the end of the list — the same behaviour `projects` and `posts` have had since T44.

**What this means for your product:** This was a live bug shipped at T46, not a refinement. Every stat tile and note you added without typing a position number was given position 0, so they all tied and the Other page fell back to ordering by creation date. The manual ordering control you were promised on that page silently did nothing. It works now: add a tile, it appears last, and you drag or renumber it. Both tables were empty when the fix went in, so there was nothing to repair.

**Check before approving:**
- The fix required *removing* the "start at 0" default, not just adding the position-calculating rule on top of it. Postgres applies defaults before it runs that kind of rule, so with the default in place the rule would have had nothing to do and the bug would have looked fixed while remaining entirely present.
- Typing an explicit position still wins; automatic placement only fills in a position you left blank.
- The database change had to ship *before* the app change, and that order is not interchangeable. The deployed app always sent a position, which the new rule ignores, so database-first was harmless. App-first would have meant the app omitting a position while the database still required one, and every insert would have failed outright.

**What this closes off:** "Add the rule, keep the default" as a way to introduce database-computed values. Any future column where the database computes a value on insert must have its column default removed in the same migration, or the computation is dead code. A column default and an insert-time rule are not interchangeable, and the ordering between them is fixed by Postgres, not by us.

---

## 37. A Supabase-installed database function was left callable from the internet; revoked (F-41, migration 015)

**Date:** 2026-08-04
**Architecture link:** [`architecture.md` §6.1](architecture.md#61-rls-policies--per-table) + `supabase/migrations/015_revoke_rls_auto_enable_execute.sql`

**Decided:** Permission to run `rls_auto_enable()` — a function Supabase installed on your project, not one we wrote — was revoked from anonymous visitors, logged-in users, and the catch-all "everyone" grant. Only the database owner and Supabase's own service account retain it.

**What this means for your product:** Nothing visible changes and nothing was ever at risk. The function switches on row-level security automatically whenever a new table is created, and it still does that: Postgres does not consult run permission when it fires that kind of automatic rule. What it also had was a public web address anyone on the internet could call. Calling it did nothing, because the first thing it tries only works while a table is being created, so it errored out immediately.

The reason to fix a zero-exposure finding is that the function runs with elevated privileges, and the thing keeping it harmless is one line of its body that we do not control. Supabase can rewrite that body in a platform update without telling us, and if the rewrite removes that line, the project inherits an anonymous, elevated-privilege entry point with no review step in between. Removing the grant makes that future update a non-event.

**Check before approving:**
- Auto-enabling of row-level security on new tables still works — confirmed by creating a throwaway table, checking security came back on, and dropping it.
- Both the "everyone" grant and the individually-named ones had to be removed. Supabase grants directly to `anon` and `authenticated` on setup, and those survive removing the general grant, so a partial revoke would have looked done and changed nothing.
- This function appears in no migration in the repository and carries no creation date, so it could not have been found by reading our own code. It surfaced through the security audit.

**What this closes off:** The assumption that the project's security surface is only what the project authored. Anything the platform installs into the database is in scope for review, and the standing rule is now explicit: an elevated-privilege function that anonymous or logged-in callers can run needs either a written justification or a revoke, no matter who put it there.

---

## 38. The e2e teardown talks to the database directly (T47)

**Date:** 2026-08-06
**Architecture link:** [`architecture.md` §4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + `tests/e2e/global-teardown.ts` + `tests/e2e/fixtures/cleanup.ts`

**Decided:** The Playwright suite no longer cleans up by clicking through the admin panel. It connects to the database directly with an administrative key, deletes only its own test rows, and then re-reads the database to prove they are gone.

**What this means for your product:** A passing test run can no longer leave a fake project published on the live site, and can no longer scramble the order of the real projects on `/projects`. Both had actually happened. Before this, a green result meant "the tests were happy", not "the site is clean".

**Check before approving:**
- The safety of this rests on the tests being able to recognise their own rows. They are identified by a title prefix plus a timestamp stamped in at run time, and image files by name plus proof their parent project is gone.
- Confirm you are comfortable that you will not name a real project starting with `T28 `, `T42 ` or `T43F `.

**What this closes off:** The test runner now needs the administrative database key present locally. It was already there; it is now load-bearing, so a machine without it cannot run the e2e suite at all.

---

## 39. The e2e suite runs one file at a time (T47)

**Date:** 2026-08-06
**Architecture link:** [`architecture.md` §4.7](architecture.md#47-test-infrastructure-node_env-gated-dev-only-routes) + `playwright.config.ts`

**Decided:** Playwright now runs with a single worker instead of in parallel.

**What this means for your product:** The test suite is green by default when you run it, instead of failing for reasons that have nothing to do with your code. It is also faster this way — 1.6 minutes against 4.0 — because the parallel runs were fighting each other over one development server rather than sharing it.

**Check before approving:** Nothing to verify. This matches how the suite has always actually been run; it had never once been verified green in parallel.

**What this closes off:** If the suite grows large enough that serial runs become slow, the fix is more dev servers, not more workers. One server is the bottleneck.

---

## 40. Discoverability and public-route resilience (T41)

**Date:** 2026-08-06
**Architecture link:** `app/robots.ts` + `app/sitemap.ts` + `app/opengraph-image.tsx` + `app/icon.svg` + `app/error.tsx` + `app/not-found.tsx` + `app/layout.tsx` metadata

**Decided:** The site now tells crawlers and link-preview scrapers what it is, and it stops falling back to Next.js stock chrome when a URL is wrong or a page throws. Six things landed together: a `robots.txt` that welcomes crawlers everywhere except `/admin` and `/api`; a `sitemap.xml` listing the four root routes plus every published post; a square `S` favicon in the T46 palette; a generated Open Graph card; a public 404; and a public error boundary. Site-wide Open Graph and Twitter defaults live in `app/layout.tsx`, and `/writing/[slug]` is the only route that overrides them, because after T46 it is the only public detail route left. Closes QA findings NB-06 (no public error boundary), NB-07 (no favicon) and NB-08 (unstyled stock 404).

**What this means for your product:** A link to the site pasted anywhere shows a card with your name and lede rather than a bare URL. Google can find every published post without you listing them by hand. A mistyped URL lands on a page written in your voice — "Nothing here." — with two ways back out, instead of the framework's stock white page. If something genuinely throws, the visitor sees the real message and digest, unedited, with a retry button; that is the same LOUD posture the admin boundary already had (#27), and it matters more here because nothing reports public errors to you automatically (#23).

**Check before approving:**
- **T41 is not fully closed.** Google Search Console verification and sitemap submission both need your account and cannot be automated. Until you do them, the sitemap exists but nobody has been told about it.
- Open Graph preview validation needs a public deploy. Preview caches are sticky, so run it the day *before* you first share the URL, not after.
- `app/error.tsx` has not been exercised in a live browser — triggering it needs a deliberately throwing route.
- Drafts are kept out of the sitemap by two independent checks, once in SQL and once again before emit. That is redundant everywhere else in the codebase and deliberate here: this is the one surface that hands URLs to crawlers, a draft URL that reaches one gets fetched, indexed and cached by third parties, and un-publishing afterwards does not undo any of that. The second check also makes the guarantee testable locally.
- The origin `https://swarnimbagre.com` is hardcoded, matching the canonical URLs already on every public page rather than reading from env. One apex, one string, no config to drift — but a domain change means editing each of them.
- The 404 and error pages are assembled entirely from classes that already exist in the design export (`.container`, `.title-block`, `.page-title`, `.page-lede`, `.h-actions`, `.h-btn`, `.h-btn--fill`, `.h-btn--outline`) with zero invented values, because the export contains neither page. But `.h-actions` and `.h-btn` are used off the home page here for the first time, and CONSTRAINT-05 says to consult `@designer` when a pattern is absent from the export. **Flagged for design sign-off, not treated as settled.**

**What this closes off:** An env-driven origin, unless all the hardcoded copies move together. Per-post cover art: posts have no cover image in the data model, so every post shares the site card, and adding per-post images means a new column and a per-route image generator. Silent 500s on public routes — a throw now renders something readable, which is a promise the copy on that page makes out loud.

**Implementation note:** The Open Graph card fetches its two fonts from Google as raw TTF bytes, because `next/font` hands back a CSS class and Satori needs bytes. Every fetch is guarded: on failure the family is simply not registered, Satori falls back to its bundled sans, and the worst case is the right palette in the wrong typeface — never a broken build or a 500 on a crawler's request. The T41 plan spec was three months stale and was overridden in four places: it named the project detail route (deleted at T46), Fraunces and JetBrains Mono (retired at T46), the old dark palette (inverted at T46), and a favicon in the retired bundle. Tests: `tests/robots.test.ts`, `tests/sitemap.test.ts`.

---

## 41. The way back into a locked-out admin is a service-role script (NB-16)

**Date:** 2026-08-06
**Architecture link:** [`auth-flow.md`](auth-flow.md) §5 + `scripts/recover-admin-session.ts` + CONSTRAINT-09

**Decided:** `auth-flow.md` §5 told the operator to recover from a lockout by triggering "Send password recovery" in the Supabase dashboard, or by copying a one-time recovery URL from it. Both were dead. They are replaced by a service-role script, `scripts/recover-admin-session.ts`, which mints a link server-side and builds the callback URL from `properties.hashed_token` rather than the dashboard's `properties.action_link`.

**What this means for your product:** This was the *only* documented way back into your own admin panel, and it could never have worked. Three separate reasons, each sufficient on its own: no passwords exist anywhere (CONSTRAINT-09 is magic-link only); the callback's accepted OTP type set was narrowed to `{email, magiclink}` by the F-4 hardening, so a recovery mail would have been refused even if one had been delivered; and the dashboard's action link targets `/auth/v1/verify` and redirects to the Site URL root rather than `/admin/auth/callback`, while under `flowType: 'implicit'` (#18) the tokens arrive in the URL fragment, which never reaches a server route handler at all.

**Check before approving:**
- The non-obvious part, and the reason this is a script rather than doc prose: discard `properties.action_link` and rebuild the callback URL from `properties.hashed_token`. That bypasses the Site URL, the redirect allowlist and the fragment problem at once. The callback route is a strict-equality middleware exemption, so it is reachable with no session.
- Delete-and-recreate of the admin user is zero-data-loss, and this was verified rather than assumed: all 17 migrations grep clean for `auth.users`, `auth.uid`, `user_id`, `owner_id`, `author_id` and `created_by`. RLS is role-based throughout, so a new UUID behind the same email has identical access.
- Six claims in the rewritten §5 are marked reasoned-but-unverified rather than asserted as tested, chiefly the built-in SMTP cap of two emails per hour and the end-to-end service-role redemption. Neither is checkable while the Supabase MCP is unauthorized.
- **Open for you:** CONSTRAINT-09 still describes the lockout fallback as manual session invalidation in the Supabase dashboard, which is now narrower than what §5 documents. It was left untouched because it is a binding constraint and yours to amend.

**What this closes off:** Dashboard password recovery as a fallback of any kind, for as long as CONSTRAINT-09 keeps the site magic-link-only. Recovery now depends on the service-role key being available locally, which makes that key load-bearing for a second reason beyond the e2e suite (#38). The mechanism is not new — it is the same server-side minting the Playwright fixture has used since T19.2 (#43).

---

## How to update this file

When `@cto` or any session changes a decision in [`architecture.md`](architecture.md):

1. Find the matching brief above, or add a new entry with the next free number.
2. Fill the four fields: Decided, What this means for your product, Check before approving, What this closes off.
3. Add the matching row to the Index.
4. Note the change in `docs/session-log.md` with the date and the reason.
5. If a decision is reversed wholesale, do not delete the entry — rewrite it with the new decision and append a "Previously → now" note so the lineage is preserved.

A decision in code without a Founder Brief is invisible to the next session.
