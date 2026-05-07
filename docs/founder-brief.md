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

## How to update this file

When `@cto` or any session changes a decision in [`architecture.md`](architecture.md):

1. Find the matching brief above (or add a new entry).
2. Update the four fields: Decided, What this means, Check before approving, What this closes off.
3. Note the change in `docs/session-log.md` with the date and the reason.
4. If the decision is reversed wholesale, do not delete the entry — rewrite it with the new decision and append a one-line "previously: …" so the lineage is preserved.

A decision in code without a Founder Brief is invisible to the next session.
