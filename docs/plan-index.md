# Plan Index: swarnimbagre.com

**Date:** 2026-05-06
**Total tasks:** 41 across 4 phases (40 original + T10.5 testing-infra inserted 2026-05-07).
**Entry point for `@session-start`** — load this file to find the active phase file, then load that phase file.

---

## Phase Files

| Phase | File | Tasks | Scope | Status |
|---|---|---|---|---|
| 1 — Foundation | [`plan-phase-1-foundation.md`](plan-phase-1-foundation.md) | T1–T14 + T10.5 (15 tasks) | External-deps prep, Next.js scaffold, Supabase project + schema + RLS, public reads, Markdown render, Storage integration, testing harness, first deploy | Done (2026-05-11) |
| 2 — Admin panel | [`plan-phase-2-admin.md`](plan-phase-2-admin.md) | T15–T28 (14 tasks) | Admin layout, Tailwind scoping, shadcn install, magic link auth, projects + posts CRUD, stats view + manual insert, image upload, orphan cleanup | Done (2026-05-14) |
| 3 — OpenClaw ingestion | [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md) | T29–T31 (3 tasks) | Edge Function `stats-ingest`, OpenClaw config notes, monitoring setup | **Deferred — T30 done; T29 + T31 await OpenClaw operator gate (see session-handoff)** |
| 4 — Polish + launch | [`plan-phase-4-launch.md`](plan-phase-4-launch.md) | T32–T40 (9 tasks) | Admin smoke test, error monitoring, README, env checklist, launch checklist, security review, code review, doc audit, production deploy + post-launch ops | **Active (T32 + T33 done 2026-05-14; T34 next)** |

---

## Critical Path Across Phases

Phase 1 → Phase 2 → Phase 3 → Phase 4. Each phase depends on the previous one. The hard sequencing points:

- **End of Phase 1:** the Next.js app builds and deploys to Vercel; public site is live with DB-driven projects, posts, and stats reads. Admin panel routes exist as placeholders only.
- **End of Phase 2:** admin can log in with a magic link, do full CRUD on projects and posts, view + manually insert stats, upload images with required alt text, run orphan cleanup. No programmatic write path yet.
- **End of Phase 3:** OpenClaw can write stats via the `stats-ingest` Edge Function. The shared secret is configured in both Supabase and OpenClaw.
- **End of Phase 4:** site is launched at `swarnimbagre.com`, monitored, and the post-launch checklist is closed.

The earliest-blocking task is T1 (external-deps prep): Vercel project link, Supabase project create, DNS plan. No code can be merged until those exist.

---

## Locked Decisions Reflected in the Plan

The 40 tasks below already reflect the architectural decisions in [`architecture.md`](architecture.md), the constraints in [`constraints.md`](constraints.md), and the Founder Briefs in [`founder-brief.md`](founder-brief.md). Specifically:

- Phase A (static-bundle deploy) is **dropped**. Phase 1 starts at Next.js scaffolding.
- T30 (in Phase 3) is **Edge Function `stats-ingest` only** — no "Path A vs Path B" branching.
- All RLS, Markdown sanitization, Tailwind scoping, image bucket path, slug-lock, and voice rules are encoded into individual task acceptance criteria with the relevant rule codes embedded (SEC-XX, EH-XX, CQ-XX, TS-XX, DS-XX).

---

## How `@session-start` Uses This File

1. Load `manifest.md`, `CLAUDE.md`, this file, [`constraints.md`](constraints.md), [`assumptions.md`](assumptions.md).
2. Find the first phase row with `Status: Active`.
3. Load that phase file as the working plan.
4. Find the first incomplete task in that file. Confirm it is the next task before doing any work.

When all tasks in the active phase are complete, the next phase becomes Active. Mark the previous phase row as Done, mark the next as Active, log the transition in `docs/session-log.md`.
