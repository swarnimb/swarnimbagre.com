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

---

## How to update this file

When `@cto` or any session changes a decision in [`architecture.md`](architecture.md):

1. Find the matching brief above (or add a new entry).
2. Update the four fields: Decided, What this means, Check before approving, What this closes off.
3. Note the change in `docs/session-log.md` with the date and the reason.
4. If the decision is reversed wholesale, do not delete the entry — rewrite it with the new decision and append a one-line "previously: …" so the lineage is preserved.

A decision in code without a Founder Brief is invisible to the next session.
