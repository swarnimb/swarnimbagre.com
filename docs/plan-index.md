# Plan Index: swarnimbagre.com

**Date:** 2026-05-06 — **last updated 2026-08-06 (Session 54).**
**Total tasks:** 48 across 4 phases (40 original + T10.5 testing-infra inserted 2026-05-07; T41 + T42 added 2026-05-19, Session 28; T43 added 2026-05-20, Session 32; T44 project + post reordering added 2026-05-28, Session 43; T45 project writeup embedding added 2026-05-28, Session 43; T46 full public-site redesign added 2026-08-04, Session 51; T47 reliable e2e teardown added 2026-08-06, Session 54).
**Entry point for `@session-start`** — load this file to find the active phase file, then load that phase file.

---

## Phase Files

| Phase | File | Tasks | Scope | Status |
|---|---|---|---|---|
| 1 — Foundation | [`plan-phase-1-foundation.md`](plan-phase-1-foundation.md) | T1–T14 + T10.5 (15 tasks) | External-deps prep, Next.js scaffold, Supabase project + schema + RLS, public reads, Markdown render, Storage integration, testing harness, first deploy | Done (2026-05-11) |
| 2 — Admin panel | [`plan-phase-2-admin.md`](plan-phase-2-admin.md) | T15–T28 (14 tasks) | Admin layout, Tailwind scoping, shadcn install, magic link auth, projects + posts CRUD, stats view + manual insert, image upload, orphan cleanup | Done (2026-05-14) |
| 3 — OpenClaw ingestion | [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md) | T29–T31 (3 tasks) | Edge Function `stats-ingest`, OpenClaw config notes, monitoring setup | **Deferred — T30 done; T29 + T31 await OpenClaw operator gate (see session-handoff)** |
| 4 — Polish + launch | [`plan-phase-4-launch.md`](plan-phase-4-launch.md) | T32–T47 (16 tasks; T41 trigger-gated deferred, not an exit blocker) | Admin smoke test, error monitoring, README, env checklist, launch checklist, security review, code review, doc audit, production deploy + post-launch ops + project content-model expansion + project media multi-image carousel + manual project/post drag-reorder + project writeup embedding + full public-site redesign (T46 — new light palette, single responsive tree, mobile fork deleted) | **Complete as of Session 55 (2026-08-06) — all tasks closed or superseded.** Historical: T32–T39, T42, T43, T44, T45, T46 closed (T39 launched the site 2026-05-19/S27; T43 closed 2026-05-23/S40; T45 closed 2026-05-28/S44; T44 closed 2026-06-03/S47; T46 closed 2026-08-04/S51 — full redesign). **Session 55 (2026-08-06):** **T40 closed** by superseding its two remaining criteria (voice check on live copy, launch-checklist post-launch section) as continuous work, not one-time gates — they were superseded, not completed, and that work continues outside the plan. **DS-05 fresh-clone verification superseded as not needed** (both mirrored boxes, T33 criterion 4 and T38's `README.md` criterion). **T47** (reliable e2e teardown) was added at Session 54 and closed at Session 55: teardown now sweeps the database with the service role, restores `sort_order`, and verifies against a fresh read rather than trusting the suite's own report. T41 remains deferred trigger-gated and is not an exit blocker. The Playwright suite has now been run for the first time and is **15/15 green** (Session 54), which closed the long-standing "unrun suite" item and, in the process, found one real production bug (`post_id` missing from `PROJECT_COLUMNS` — the card's Writeup action was inert) and one new defect (the suite leaks live rows even when green → T47). The `/other` content rows were entered at Session 53. **Project image assets were removed from plan tracking at Session 55 by builder decision** — cards rendering "no preview yet" is a known, accepted state, not a missing task. Do not re-add it. Header-tick caveat resolved: T38, T39, T42, T43, T44, T45 were ticked by explicit builder decision at Session 53.** |

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

The 47 tasks across the 4 phase files reflect the architectural decisions in [`architecture.md`](architecture.md), the constraints in [`constraints.md`](constraints.md), and the Founder Briefs in [`founder-brief.md`](founder-brief.md). T41 + T42 (added 2026-05-19, Session 28) extend the original 40-task plan with: discoverability + resilience deferred follow-up (T41) and project content-model expansion (T42). T43 (added 2026-05-20, Session 32) extends Phase 4 with project media multi-image carousel + first public-site JS library (Override 2). T44 + T45 (added 2026-05-28, Session 43) add manual project/post drag-reorder and the embedded project writeup. T46 (added 2026-08-04, Session 51) is the full public-site redesign — it re-baselines CONSTRAINT-05 onto a new design source, retires Overrides 1/2/3, collapses the mobile component fork into a single responsive tree, and returns the public site to zero runtime JS dependencies. Specifically:

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
