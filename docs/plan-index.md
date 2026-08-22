# Plan Index: swarnimbagre.com

**Date:** 2026-05-06 — **last updated 2026-08-07.**
**Total tasks:** 51 across 4 phases — T1–T48, plus T10.5 (testing infrastructure, inserted 2026-05-07) and T19.1 + T19.2 (auth hardening, inserted 2026-05-12).
**Entry point for `@session-start`** — load this file first. It states whether any phase is active before you open a phase file.

---

## Phase Files

| Phase | File | Tasks | Scope | Status |
|---|---|---|---|---|
| 1 — Foundation | [`plan-phase-1-foundation.md`](plan-phase-1-foundation.md) | T1–T14 + T10.5 (15 tasks) | External-deps prep, Next.js scaffold, Supabase project + schema + RLS, public reads, Markdown render, Storage integration, testing harness, first deploy | Done (2026-05-11) |
| 2 — Admin panel | [`plan-phase-2-admin.md`](plan-phase-2-admin.md) | T15–T28 + T19.1 + T19.2 (16 tasks) | Admin layout, Tailwind scoping, shadcn install, magic link auth, projects + posts CRUD, stats view + manual insert, image upload, orphan cleanup | Done (2026-05-14) |
| 3 — OpenClaw ingestion | [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md) | T29–T31 (3 tasks) | Edge Function `stats-ingest`, OpenClaw config notes, monitoring setup | **Deferred** — T30 done; T29 + T31 await the OpenClaw operator gate |
| 4 — Polish + launch | [`plan-phase-4-launch.md`](plan-phase-4-launch.md) | T32–T48 (17 tasks) | Error monitoring, README, env checklist, launch checklist, security review, code review, doc audit, production deploy, post-launch ops, project content-model expansion, project media carousel, manual project/post drag-reorder, project writeup embedding, full public-site redesign (T46), discoverability + public-route resilience (T41), reliable e2e teardown (T47), full-screen image viewer (T48) | **Reopened 2026-08-22** — T32–T47 closed or superseded; T48 added as an `@plan` follow-up and is open. Phase 4 was reopened rather than starting a Phase 5: T48 is a small addition to surfaces this phase already built, not the beginning of new phase-scale work. |

---

## Critical Path Across Phases

Phase 1 → Phase 2 → Phase 3 → Phase 4. Each phase depends on the previous one. The hard sequencing points:

- **End of Phase 1:** the Next.js app builds and deploys to Vercel; public site is live with DB-driven projects, posts, and stats reads. Admin panel routes exist as placeholders only.
- **End of Phase 2:** admin can log in with a magic link, do full CRUD on projects and posts, view + manually insert stats, upload images with required alt text, run orphan cleanup. No programmatic write path yet.
- **End of Phase 3:** OpenClaw can write stats via the `stats-ingest` Edge Function. The shared secret is configured in both Supabase and OpenClaw.
- **End of Phase 4:** site is launched at `swarnimbagre.com`, monitored, and the post-launch checklist is closed.

The earliest-blocking task was T1 (external-deps prep): Vercel project link, Supabase project create, DNS plan. No code could be merged until those existed.

---

## Locked Decisions Reflected in the Plan

The 50 tasks across the 4 phase files reflect the architectural decisions in [`architecture.md`](architecture.md), the constraints in [`constraints.md`](constraints.md), and the Founder Briefs in [`founder-brief.md`](founder-brief.md). Specifically:

- Phase A (static-bundle deploy) is **dropped**. Phase 1 starts at Next.js scaffolding.
- T30 (in Phase 3) is **Edge Function `stats-ingest` only** — no "Path A vs Path B" branching.
- All RLS, Markdown sanitization, Tailwind scoping, image bucket path, slug-lock, and voice rules are encoded into individual task acceptance criteria with the relevant rule codes embedded (SEC-XX, EH-XX, CQ-XX, TS-XX, DS-XX).
- T46 (full public-site redesign, 2026-08-04) re-baselines CONSTRAINT-05 onto a new design source, retires Overrides 1/2/3, collapses the mobile component fork into a single responsive tree, and returns the public site to zero runtime JS dependencies. Task specs written before T46 may name files, fonts, or palette values that no longer exist — the code and `docs/design-source/redesign-2026-08/` win over any older task spec.

---

## Plan Status — CLOSED

**No phase row is marked Active, and that is correct — do not "fix" it by marking one.**

The four-phase plan produced by `@plan` is finished. Phases 1, 2 and 4 are complete. Phase 3 is deferred behind the OpenClaw operator gate, an external dependency and not work an agent can start.

**There is no agent-executable open plan task.** Do not nominate one. What remains:

- **T29 / T31** (Phase 3) await the OpenClaw operator gate.
- **Google Search Console verification + sitemap submission** — the one genuinely open T41 criterion. It needs the builder's Google account and cannot be automated.
- **OG preview validation** — a manual check against a public deploy, to be run the day before the URL is first shared publicly (preview caches are sticky).

**T41 shipped on 2026-08-06 at commit `b369d47`.** `app/robots.ts`, `app/sitemap.ts`, `app/error.tsx`, `app/not-found.tsx`, `app/icon.svg`, `app/opengraph-image.tsx` and the site-wide OG/Twitter metadata in `app/layout.tsx` all exist, with tests in `tests/robots.test.ts` and `tests/sitemap.test.ts`. Its spec in `plan-phase-4-launch.md` was three months stale when it ran and was overridden in four places (a route deleted at T46, two retired fonts, the old dark palette, and a favicon in the retired bundle); per-route OG overrides therefore apply to `/writing/[slug]` only. Treat the code as the record of what T41 did, not the task spec.

**New work arrives via `@create-plan`**, which appends a numbered task to the appropriate phase file. Adding a task does not by itself reopen a phase.

---

## How `@session-start` Uses This File

1. Load `manifest.md`, `CLAUDE.md`, this file, [`constraints.md`](constraints.md), [`assumptions.md`](assumptions.md).
2. Find the first phase row with `Status: Active`. **If no row is Active, stop looking — read "Plan Status" above and report "no active phase; the plan is closed" rather than falling through to the first `[ ]` you can find.** Unticked boxes in the phase files are gated or superseded, not queued.
3. If a phase is Active, load that phase file as the working plan, find the first incomplete task, and confirm it is the next task before doing any work.

When all tasks in an active phase are complete, the next phase becomes Active: mark the previous phase row Done, mark the next Active, log the transition in `docs/session-log.md`. **When the LAST phase completes there is no next phase to activate** — that is the current state, and it is recorded above rather than papered over by leaving a finished phase marked Active.
