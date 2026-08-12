# Skill: @ui-swarnimbagre

## Purpose

Routes UI tasks for swarnimbagre.com to the correct mode and enforces the split between them. The public site uses the design export verbatim; the admin panel uses shadcn/ui + Tailwind. This skill replaces the standard global `@ui`, which defaults to shadcn / Aceternity for everything and would violate the public-site rule on its first invocation.

---

## This file restates no facts — and that is deliberate

Three earlier versions of this skill went stale the same way: they copied paths, font names, hex values, transition timings and token lists out of the project docs, and every re-baseline silently invalidated the copy with no update trigger. See `docs/framework-issues.md`, the 2026-05-07 entry and its 2026-08-11 third occurrence.

So this file carries **no concrete values**. It carries mode routing, the consult gate, and the reporting contract — the things it genuinely owns. Everything else is a pointer.

**Rule for anyone editing this file:** if you are about to write a path, a hex code, a font name, a px value, a breakpoint or a timing function into this skill, you are re-creating the defect. Put the value in its owner document and link to it here instead. A sentence that would need editing after a future project re-baseline is a sentence that should have been a pointer.

---

## Fact owners — read these, do not trust this file for values

| What you need | Where it is owned |
|---|---|
| Canonical design-source location; the verbatim rule; the recorded deviations; the system-page carve-out; the one-breakpoint rule and its height-guard exception | `docs/constraints.md` → **CONSTRAINT-05** |
| Deviation table with `file:line` proof-in-code anchors | `docs/design-decisions.md` → *Deliberate deviations from the export* |
| Agent-facing summary of design rules: fonts, breakpoint, which stylesheet owns what, admin rules, voice | `CLAUDE.md` → *Project-Specific Conventions* |
| Repo layout; the complete public-component inventory; the single-responsive-tree render architecture | `docs/architecture.md` → **§4.1**, **§4.10** |
| Admin color tokens — namespacing, the eight values, declaration site, and the standing rule that they are admin-owned and must not be resynced to the public palette | `docs/constraints.md` → **CONSTRAINT-16** (mechanics in `docs/architecture.md` **§4.2**) |
| Tailwind scoping / isolation between admin and public bundles | `docs/constraints.md` → **CONSTRAINT-03**; `docs/architecture.md` **§4.2** |
| Voice, including the em-dash and assistive-technology sub-rules | `docs/constraints.md` → **CONSTRAINT-13** |
| Adding a JS library to the public site — Override requirement and gzip budget | `docs/constraints.md` → **CONSTRAINT-22** |
| Anti-patterns to enforce (public) and anti-patterns relaxed (admin) | `docs/design-decisions.md` → *What to Avoid*, *Admin Panel* |

If any of the above is missing, contradicts another, or reads as stale, **stop and surface it**. Do not resolve the contradiction by picking one.

---

## Mode routing

This is the skill's own decision, and the only thing it decides.

- **No argument** — report that two modes exist, cite CONSTRAINT-05 and CONSTRAINT-16 as their respective rule sets, ask which the task targets. Do nothing else.
- **Mode A — public.** Any surface a visitor sees: public components, public route pages, public stylesheets.
- **Mode B — admin.** Anything under the admin route group.

Determine mode from the target path against `docs/architecture.md` §4.1. If the path is ambiguous — a shared layout, a shared utility, a file that feeds both trees — **ask the builder**. Never infer mode silently, and never write to both trees in one pass without saying so first.

---

## Mode A — public site

### Gate: does this surface exist in the export? Run this before anything else.

Establish whether the surface you are about to build **exists in the design export at all** (the canonical location and its readable-markup file are named in CONSTRAINT-05). If it does not, **STOP and consult `@designer`** before assembling it out of existing classes.

Reusing only pre-existing classes does **not** satisfy CONSTRAINT-05. Class reuse is a claim about the CSS; it says nothing about whether the right pattern was chosen, and a surface absent from the export has no right pattern to find by reading it. *"Nothing was improvised, every class already exists"* is the exact reasoning that shipped the 404 and error boundary using home-only action pills where the export's off-home equivalent — the larger tap target — was correct. On a dead-end page that action row is the only escape route, and it rendered at the smallest tap size on the site.

**Standing carve-out:** system pages have a signed-off recipe and do **not** need a per-surface consult. The recipe is recorded in CONSTRAINT-05 (see the `app/error.tsx` / `app/not-found.tsx` deviation bullet). Build to that recipe and proceed; anything outside it needs the consult.

### Then

1. **Reuse before you add.** Compose the existing public components (inventory: `docs/architecture.md` §4.10). Do not duplicate, reimplement or fork them. There is one responsive tree — no device fork, no second component set.
2. **Style only through the existing tokens and component classes** (which file owns which: `CLAUDE.md`, *Design — canonical source rule*). No new tokens, no overrides, no "close enough" substitutes.
3. **Copy rules property-by-property, not by eye.** When you reproduce a rule from the export, diff your declaration list against the export's declaration list one property at a time, and cite the export line number in a comment. A single dropped declaration inside an otherwise faithful rule is the documented failure mode here, and it survives review, tests and a clean build.
4. **A branch that never rendered is unverified.** Any surface with an empty-state fallback has not been checked against the export until it has been rendered with real rows. Green tests do not cover a branch that did not enter the DOM.
5. **No Tailwind, no shadcn, no component library, no substitutions.** The export is the library. Adding any runtime JS dependency requires CONSTRAINT-22's Override and budget, not this skill's permission.
6. **Enforce the public anti-patterns** listed in `docs/design-decisions.md` → *What to Avoid*, and the voice rules in CONSTRAINT-13 — including the assistive-technology sub-rule, which exempts screen-reader-only strings from the terseness half while keeping every other prohibition.
7. **If a needed pattern is not in the export: STOP.** Do not improvise. Consult `@designer`.

---

## Mode B — admin panel

1. **Use shadcn/ui + Tailwind defaults** for all CRUD chrome — layout, forms, tables, modals, dropdowns, file upload, toasts. Do not customize back toward the public-site aesthetic.
2. **Use the admin tokens as defined in CONSTRAINT-16.** They are admin-owned constants. They mirror nothing on the public site and must never be "resynced" to it.
3. **Use shadcn typography defaults.** The public site's signature fonts do not appear in admin — using them dilutes the public site's identity. The current font list is in `CLAUDE.md`; do not hardcode it here or there.
4. **Relaxed in admin:** rounded corners, subtle shadows, default focus rings, standard form chrome. See `docs/design-decisions.md` → *Admin Panel*.
5. **Still enforced in admin:** CONSTRAINT-13 in full. Voice discipline does not stop at the login screen.
6. **Style isolation is a hard requirement.** Admin Tailwind must not reach the public bundle. The mechanism is CONSTRAINT-03 / architecture §4.2 — verify it still holds rather than assuming it; if isolation looks broken, surface to `@cto` before proceeding.

---

## Approval before writing

Both modes: present the plan before writing any code — which mode applies, which existing components are being reused versus extended, which files will be touched, and (Mode A) which export lines the work is being matched against. Wait for explicit builder approval. Revise and re-present on request. Never write a file without confirmation.

---

## Output format

Every response opens with: **mode**, **files to be touched**, **what is being reused**.

Where edits land is defined by the repo layout in `docs/architecture.md` §4.1 — read it rather than assuming a path. If the work needs a file in a location §4.1 does not describe, that is a layout change, not a UI task: surface it before writing.

---

## When to invoke

- Any UI task on any public page.
- Any UI task in the admin panel.
- Any UI task where you are unsure which of the two it is — this skill routes it.

## When not to invoke

- Backend, database, RLS or Edge Function work — `@supabase`.
- Choosing a new visual pattern — that is `@designer`, reached through the Mode A gate above, not a decision this skill makes.
- Copy and voice — `@content-writer`, bound by CONSTRAINT-13.
- The global `@ui` — never, in this project.

---

## Closing report

After execution, report: mode used; files touched; components reused versus extended; for Mode A, the export lines each copied rule was diffed against, and whether any surface was escalated to `@designer`; for Mode B, confirmation that shadcn defaults were used without drift toward the public aesthetic.
