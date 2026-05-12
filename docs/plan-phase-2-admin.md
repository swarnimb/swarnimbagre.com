# Plan — Phase 2: Admin Panel

**Date:** 2026-05-06
**Status:** Pending
**Tasks:** T15–T28 (14 tasks)
**Predecessor:** [`plan-phase-1-foundation.md`](plan-phase-1-foundation.md)
**Successor:** [`plan-phase-3-ingestion.md`](plan-phase-3-ingestion.md)

End state: admin can log in via magic link, do full CRUD on projects and posts (with confirm-modal hard-delete), view + manually insert stats, upload images with required alt text, and run orphan cleanup. All admin work is server-side; Tailwind/shadcn is scoped to `/admin/*` only. No programmatic write path yet (that is Phase 3).

---

## T15 — Admin layout + Tailwind/shadcn scoped CSS

**Files:**
- `app/(admin)/layout.tsx` (modify — add Tailwind/shadcn import via admin.css)
- `styles/admin.css` (create — `@tailwind` directives, scoped reset)
- `tailwind.config.ts` (create — content glob limited to admin paths)
- `postcss.config.mjs` (create or update)
- `package.json` (update — add `tailwindcss`, `tailwindcss-scoped-preflight`, `autoprefixer`)

**Functions to implement:** [setup task]

**Acceptance criteria:**
- [x] Tailwind config `content` glob is exactly `./app/(admin)/**/*.{ts,tsx}`, `./components/admin/**/*.{ts,tsx}`, `./components/ui/**/*.{ts,tsx}`. Public paths excluded (CONSTRAINT-03).
- [x] `tailwindcss-scoped-preflight` plugin configured with `scopeOf: '.admin-root'`. Default Preflight is disabled.
- [x] `app/(admin)/layout.tsx` imports `styles/admin.css` and renders children inside `<div className="admin-root">` with the four borrowed color tokens (`--bg`, `--surface`, `--fg`, `--accent`) applied via CSS variables.
- [x] Inter font loaded via `next/font` for admin only. Fraunces and JetBrains Mono are not used in admin (design-decisions.md).
- [x] Public pages have zero Tailwind utility classes — verified by grep (CONSTRAINT-03).
- [x] `npm run build` succeeds; bundle analysis confirms Tailwind CSS does not appear in public route output.

**Tests required:**
- `public route HTML contains no Tailwind utility classes` — Playwright fetch + assertion (TS-04).
- `admin route HTML contains Tailwind utility classes` — Playwright fetch + assertion (TS-01 happy).
- `public route style does not change after navigating from admin` — visit `/admin`, then `/projects`, verify computed styles match a baseline (TS-04).

**Depends on:** Phase 1 complete (specifically T14)

**Specialist:** `@cto`

**Status:** Complete in session 10 (2026-05-11). 35/35 Vitest unit tests pass; 12/12 Playwright tests pass (3 new T15 scope tests + 9 prior, no regressions). Build green: 5 routes, `/admin` at 123 B / 103 kB First Load JS. Tailwind v3.4.17 pinned (not v4) due to `tailwindcss-scoped-preflight` v4 adapter absence. Color tokens namespaced as `--admin-*` to prevent cascade collision with public `:root` vars. Admin stub at `app/(admin)/admin/page.tsx` (not `app/(admin)/page.tsx`) — route group parens are URL-stripped, so the latter collided with `app/page.tsx`.

---

## T16 — shadcn/ui install + admin component primitives

**Files:**
- `components/ui/` (created by shadcn CLI)
- `components.json` (created by shadcn CLI)
- `components/admin/AdminButton.tsx` (create — wrapper enforcing voice rule)
- `components/admin/AdminToast.tsx` (create — `sonner`-based toast)

**Functions to implement:** [setup + thin wrappers]

**Acceptance criteria:**
- [ ] shadcn initialized; the following components installed: `Button`, `Input`, `Label`, `Form`, `Table`, `Dialog`, `Select`, `Checkbox`, `Textarea`, `Badge`, `Sonner` (toast).
- [ ] `components/ui/` files are not modified (they are generated). Customizations go through wrappers in `components/admin/`.
- [ ] No emoji in any default label, placeholder, or button text used by the wrappers (CONSTRAINT-13).
- [ ] No SaaS phrases anywhere — labels use direct nouns ("Save", "Delete", not "Save now", not "Powerful editor") (CONSTRAINT-13).
- [ ] Button variants: default, destructive (red, used for delete confirmation), ghost.
- [ ] Toast component is imported in `app/(admin)/layout.tsx`.

**Tests required:** [setup; visual verification covered by smoke test in T28]

**Depends on:** T15

**Specialist:** `@ui-swarnimbagre`

---

## T17 — Magic-link login flow

**Files:**
- `app/(admin)/login/page.tsx` (create)
- `app/auth/callback/route.ts` (create — Supabase Auth callback)
- `lib/auth.ts` (create — auth helpers)
- `components/admin/LoginForm.tsx` (create)

**Functions to implement:**
- `signInWithMagicLink(email: string): Promise<void>` (≤50 lines, CQ-01) — calls `supabase.auth.signInWithOtp({ email })`. Validates email shape with zod (`z.string().email()`) (SEC-02). Throws `ValidationError` on bad input, `ServiceError` on Supabase failure (EH-05).
- `<LoginForm />` (≤200 lines, CQ-02) — shadcn Form component, single email field, submit button.

**Acceptance criteria:**
- [ ] Email input validates as a non-empty email at the boundary before any Supabase call (SEC-02).
- [ ] Errors are logged with context: `{ operation: 'signInWithMagicLink', emailProvided: true, error }` — never the raw email (SEC-05).
- [ ] User-facing error is a generic "Could not send link" message (EH-04). Internal log has full Supabase error.
- [ ] On success, a status message appears in-form (no toast — voice rule prefers inline feedback for an admin-of-one).
- [ ] Auth callback route at `/auth/callback` exchanges the code for a session via Supabase SSR helpers and redirects to `/admin`.
- [ ] All public function doc comments cover params, return, throws (DS-01).

**Tests required:**
- `signInWithMagicLink rejects invalid email` (TS-01 error, TS-04 auth critical).
- `signInWithMagicLink calls supabase.auth.signInWithOtp on valid input` (TS-01 happy, TS-03 mocks Supabase).
- `signInWithMagicLink throws ServiceError when Supabase fails` (TS-01 error 2 — auth requires 2 error tests, TS-01).
- `LoginForm displays error text on failure` (TS-01).
- `auth callback redirects to /admin on valid code` (TS-04).

**Depends on:** T9, T16

**Specialist:** `@supabase`

---

## T18 — Auth middleware + session gating

**Files:**
- `middleware.ts` (modify — add admin auth gate alongside the UA detection from T10)
- `lib/auth.ts` (modify — add `getServerSession()` helper)

**Functions to implement:**
- `middleware(req: NextRequest): NextResponse` (≤50 lines, CQ-01) — UA detection for public routes (already present from T10) + session check for `/admin/*`.
- `getServerSession(): Promise<Session | null>` (≤50 lines, CQ-01) — reads session from Supabase cookie, server-side.

**Acceptance criteria:**
- [ ] All `/admin/*` requests pass through the session check; no session → 307 redirect to `/admin/login` (SEC-04: enforce auth on every protected operation).
- [ ] Public routes are not gated.
- [ ] `/admin/login` itself is exempt — visiting it while signed in redirects to `/admin`.
- [ ] Expired session → redirect to `/admin/login` with a generic message (EH-04). Internal log notes "session expired" (EH-02).
- [ ] No hardcoded user IDs, emails, or roles (CQ-04). Session presence is the sole admin check (CONSTRAINT-09).

**Tests required:**
- `unauthenticated request to /admin redirects to /admin/login` (TS-04 access control critical).
- `authenticated request to /admin proceeds` (TS-01 happy).
- `request to /admin/login while signed in redirects to /admin` (TS-01).
- `expired session redirects with no detail leaked` (TS-04).

**Depends on:** T17

**Specialist:** `@supabase`, `@security`

---

## T19 — Admin home + nav

**Files:**
- `app/(admin)/page.tsx` (create — admin home)
- `components/admin/AdminNav.tsx` (create — nav with Projects, Posts, Stats, Images links + Logout button)

**Functions to implement:**
- `signOut(): Promise<void>` (≤50 lines, CQ-01) — Supabase signOut, clears session, redirects to `/admin/login`.

**Acceptance criteria:**
- [ ] `/admin` renders only when authenticated (middleware enforces).
- [ ] Nav includes links to `/admin/projects`, `/admin/posts`, `/admin/stats`, `/admin/images`, plus a Logout button.
- [ ] Color tokens applied: bg `#1C1712`, surface `#252018`, fg `#E8E0D0`, accent `#C9A84C`.
- [ ] No "Dashboard" label. The page is just titled "Admin" or empty (CONSTRAINT-13).
- [ ] Logout calls `signOut()`, clears the cookie, redirects to `/admin/login`. Browser back button does not re-authenticate.

**Tests required:**
- `admin home renders when authenticated` (TS-01).
- `signOut clears session and redirects` (TS-04 auth critical).
- `back button after logout does not restore session` (TS-04).

**Depends on:** T18

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T20 — Projects admin: list view

**Files:**
- `app/(admin)/projects/page.tsx` (create)
- `lib/admin-queries.ts` (create — admin-side reads)
- `components/admin/ProjectsList.tsx` (create)

**Functions to implement:**
- `getAllProjects(filter?: 'all' | 'published' | 'draft'): Promise<Project[]>` (≤50 lines, CQ-01) — admin sees drafts and published. Default `'all'`.

**Acceptance criteria:**
- [ ] Table columns: Title, Slug, Status, Created, Actions (Edit, Delete).
- [ ] Status rendered as a Badge (shadcn): `published` accent, `draft` muted.
- [ ] Filter via shadcn Select: All / Published / Draft.
- [ ] Sort by `created_at DESC`.
- [ ] Empty state: "No projects yet" (CONSTRAINT-13: terse, no decoration).
- [ ] Pagination: shadcn Pagination, 50 rows per page.
- [ ] All queries via Supabase query builder (SEC-03).
- [ ] Doc comments on all public functions (DS-01).

**Tests required:**
- `getAllProjects returns drafts and published when filter is all` (TS-01 happy).
- `getAllProjects returns only drafts when filter is draft` (TS-01).
- `getAllProjects throws ServiceError when DB fails` (TS-01 error).

**Depends on:** T19

**Specialist:** `@supabase`

---

## T21 — Projects admin: create + edit forms

**Files:**
- `app/(admin)/projects/new/page.tsx` (create)
- `app/(admin)/projects/[id]/page.tsx` (create — edit)
- `components/admin/ProjectForm.tsx` (create)
- `lib/admin-mutations.ts` (create — Server Actions for writes)
- `lib/slug.ts` (create — slugify helper)

**Functions to implement:**
- `slugify(title: string): string` (≤50 lines, CQ-01) — lowercase, replace non-alphanumerics with `-`, collapse, trim.
- `createProject(input): Promise<Project>` (security/validation — may extend to 80 lines, CQ-01) — Server Action. Validates with zod (`title`, `description`, `status`) (SEC-02). Auto-generates `slug` from `title`. Returns the new row.
- `updateProject(id, input): Promise<Project>` (≤80 lines, CQ-01) — Server Action. Validates with zod. Slug field is omitted from the update payload if `status='published'` was set on the existing row (the DB trigger from T8 is the final guard).
- `<ProjectForm project?: Project>` (≤200 lines, CQ-02).

**Acceptance criteria:**
- [ ] Form validation at boundary: title non-empty + ≤200 chars; description non-empty (SEC-02).
- [ ] Slug field is read-only when `project.status === 'published'`. Edit screen shows the lock state explicitly.
- [ ] Mutations are Server Actions, not client-side Supabase calls (SEC-01: server-only).
- [ ] On success: redirect to `/admin/projects` with a success toast.
- [ ] On error: inline error in the form (EH-04). Internal log has full detail (EH-01, EH-02, EH-03).
- [ ] All queries parameterized via Supabase builder (SEC-03).
- [ ] No PII in logs (SEC-05). Email never appears in mutation logs.
- [ ] All Server Actions have doc comments (DS-01).

**Tests required:**
- `slugify produces lowercase dashed slug` (TS-01 happy).
- `slugify handles unicode and punctuation` (TS-01 edge).
- `createProject validates title is non-empty` (TS-01 error, TS-04 data write critical).
- `createProject inserts row and returns it on valid input` (TS-01 happy, TS-04).
- `updateProject prevents slug change on published row` — relies on T8 trigger, asserts the error surfaces (TS-04, TS-01 error #2 for data writes).
- `ProjectForm shows error inline on mutation failure` (TS-01).

**Depends on:** T20, T8

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T22 — Projects admin: delete with confirm modal

**Files:**
- `components/admin/DeleteConfirmModal.tsx` (create — reusable)
- `app/(admin)/projects/[id]/page.tsx` (modify — wire delete button)
- `lib/admin-mutations.ts` (modify — add `deleteProject`)

**Functions to implement:**
- `deleteProject(id: string): Promise<void>` (≤50 lines, CQ-01) — Server Action.
- `<DeleteConfirmModal resource: string, name: string, onConfirm: () => Promise<void>, isOpen, onOpenChange>` (≤200 lines, CQ-02) — shadcn Dialog with destructive button.

**Acceptance criteria:**
- [ ] Modal text: `Delete {resource} "{name}"? This cannot be undone.` (CONSTRAINT-10).
- [ ] Buttons: Cancel (close), Delete (destructive variant, red).
- [ ] On Delete: call mutation, close modal, redirect to list with success toast.
- [ ] Hard-delete only — row is gone from DB (CONSTRAINT-10).
- [ ] ESC key closes the modal (shadcn Dialog default).
- [ ] No undo path. Recovery is via Supabase backups — not an admin concern.

**Tests required:**
- `modal opens on delete click` (TS-01).
- `cancel closes modal without deletion` (TS-01).
- `confirm deletes and redirects` (TS-04 data write critical).
- `deleteProject throws ServiceError on DB failure` (TS-01 error #2 for data writes).

**Depends on:** T21

**Specialist:** `@ui-swarnimbagre`

---

## T23 — Posts admin: list, create, edit, delete (same pattern as T20–T22)

**Files:**
- `app/(admin)/posts/page.tsx`
- `app/(admin)/posts/new/page.tsx`
- `app/(admin)/posts/[id]/page.tsx`
- `components/admin/PostsList.tsx`
- `components/admin/PostForm.tsx`
- `lib/admin-queries.ts` (modify — add post queries)
- `lib/admin-mutations.ts` (modify — add post mutations)

**Functions to implement:**
- `getAllPosts(filter?: 'all' | 'published' | 'draft'): Promise<Post[]>` (CQ-01).
- `createPost(input): Promise<Post>` (CQ-01, ≤80 if validation-heavy).
- `updatePost(id, input): Promise<Post>` (CQ-01, ≤80).
- `deletePost(id): Promise<void>` (CQ-01).

**Acceptance criteria:**
- [ ] All Project rules apply identically (slug auto + lock-on-publish, hard-delete with confirm modal, status enum, server-side mutations).
- [ ] Form has a `content` textarea for raw Markdown. No WYSIWYG. The `content` is stored as-is — never converted to HTML before storage (CONSTRAINT-06).
- [ ] Optional Markdown preview pane uses the same `renderMarkdown` from T12. Preview confirms what readers will see.
- [ ] DB trigger from T8 enforces slug-lock on `posts` as well.

**Tests required:**
- `getAllPosts returns drafts and published when filter is all` (TS-01).
- `createPost stores raw Markdown` — assert DB row's `content` matches input verbatim (TS-04 data write).
- `updatePost rejects slug change on published post` (TS-04).
- `deletePost removes the row` (TS-04).
- All happy-path + 1 error case per function (TS-01).

**Depends on:** T22

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T24 — Stats admin: read-only list + manual insert form

**Files:**
- `app/(admin)/stats/page.tsx` (create)
- `components/admin/StatsList.tsx` (create)
- `components/admin/StatsInsertForm.tsx` (create)
- `lib/admin-queries.ts` (modify — add `getAllStats`)
- `lib/admin-mutations.ts` (modify — add `insertStat`)

**Functions to implement:**
- `getAllStats(limit: number, offset: number): Promise<Stat[]>` (≤50 lines, CQ-01).
- `insertStat(input: { category, label, value, unit? }): Promise<Stat>` (≤80 lines, CQ-01) — Server Action with zod validation (SEC-02).

**Acceptance criteria:**
- [ ] List columns: Category, Label, Value, Unit, Created. Reverse-chronological. Pagination 50/page.
- [ ] Manual insert form fields: Category (text), Label (text), Value (text), Unit (text, optional). All non-Unit fields required (SEC-02).
- [ ] Insert is a Server Action; no client-side write (SEC-01).
- [ ] Empty state: "No stats yet" (CONSTRAINT-13).
- [ ] No edit. Corrections are delete-then-reinsert (acknowledged in PRD §3.4 and CONSTRAINT-10).
- [ ] Delete: list rows expose a delete button gated by the same `DeleteConfirmModal` component from T22 (admin-only — RLS allows admin DELETE on stats).

**Tests required:**
- `getAllStats returns rows in reverse-chronological order` (TS-01).
- `insertStat validates required fields` (TS-01 error, TS-04 data write critical).
- `insertStat inserts a row on valid input` (TS-01 happy, TS-04).
- `delete stat removes row after confirm` (TS-04).

**Depends on:** T23

**Specialist:** `@supabase`, `@ui-swarnimbagre`

---

## T25 — Image upload component + Storage integration

**Files:**
- `components/admin/ImageUpload.tsx` (create)
- `lib/admin-mutations.ts` (modify — add `uploadImage`)

**Functions to implement:**
- `uploadImage(file: File, parentType: 'projects' | 'posts', parentId: string, altText: string): Promise<Image>` (≤80 lines, CQ-01) — Server Action. Validates file type (JPEG, PNG, WebP, SVG) and size (≤2 MB) at the boundary (SEC-02). Generates a UUID. Constructs path `images/{parentType}/{parentId}/{uuid}_{filename}`. Uploads to Storage (server-only, service role) (SEC-01). Inserts the `images` row.
- `<ImageUpload onUpload, onError, parentType, parentId>` (≤200 lines, CQ-02).

**Acceptance criteria:**
- [ ] File type whitelist enforced at the boundary (SEC-02).
- [ ] File size ≤ 2 MB enforced at the boundary AND by Storage policy (SEC-02; defense in depth).
- [ ] `alt_text` is a required form field. Submit is disabled until non-empty.
- [ ] Path scheme is exactly `images/{parentType}/{parentId}/{uuid}_{filename}` (CONSTRAINT-07).
- [ ] On success: `images` row inserted with `bucket_path`, `alt_text`, `parent_id`, `parent_type`. Component calls `onUpload(image)`.
- [ ] On error: caught, logged with context (operation + sanitized inputs — never log file content) (EH-01, EH-02, EH-03). Component shows inline error (EH-04).
- [ ] Storage SDK used (no hardcoded URLs) (SEC-01, CQ-04).
- [ ] Doc comment on `uploadImage` lists params, return, throws (DS-01).

**Tests required:**
- `uploadImage rejects file > 2MB` (TS-01 error, TS-04 data write critical).
- `uploadImage rejects empty alt text` (TS-01 error).
- `uploadImage rejects unknown MIME type` (TS-01 error).
- `uploadImage uploads file and inserts row on valid input` (TS-01 happy, TS-04).
- `uploadImage handles Storage failure with logged error` (TS-04 — file uploads require 2 error case tests since they touch storage and validation).

**Depends on:** T7, T21

**Specialist:** `@supabase`

---

## T26 — Wire image upload into Project + Post forms

**Files:**
- `app/(admin)/projects/[id]/page.tsx` (modify)
- `app/(admin)/posts/[id]/page.tsx` (modify)
- `components/admin/ProjectForm.tsx` (modify)
- `components/admin/PostForm.tsx` (modify)
- `lib/admin-mutations.ts` (modify — add image-detach helper if needed)

**Functions to implement:** [composition — wires existing components]

**Acceptance criteria:**
- [ ] Project edit page shows the current image thumbnail (if any) plus an `<ImageUpload>` to replace.
- [ ] Post edit page same as project.
- [ ] When a new image is uploaded, the parent's `image_id` is updated to the new image's id.
- [ ] The previous image record becomes orphaned (parent_id NULL, parent_type NULL) by the update — eligible for cleanup after 7 days (CONSTRAINT-07).
- [ ] Alt text persists on the `images` row; reading the parent re-fetches the alt and renders it in the public components from T13.
- [ ] No image is allowed to be saved with empty alt (UI prevents submit; DB column is NOT NULL).

**Tests required:**
- `attaching an image updates parent.image_id` (TS-04).
- `replacing an image orphans the previous image row` (TS-04).
- `attempting to save with empty alt text fails at the form` (TS-01 error).

**Depends on:** T25

**Specialist:** `@ui-swarnimbagre`, `@supabase`

---

## T27 — Orphan image cleanup page

**Files:**
- `app/(admin)/images/page.tsx` (create)
- `components/admin/OrphanCleanup.tsx` (create)
- `lib/admin-mutations.ts` (modify — add `deleteOrphanImages`)

**Functions to implement:**
- `deleteOrphanImages(): Promise<{ deleted: number, freedBytes: number }>` (≤80 lines, CQ-01) — Server Action. Selects orphans where `parent_id IS NULL AND parent_type IS NULL AND created_at < now() - interval '{ORPHAN_CLEANUP_THRESHOLD_DAYS} days'`. Deletes both Storage objects and `images` rows. Returns count and bytes freed.

**Acceptance criteria:**
- [ ] `ORPHAN_CLEANUP_THRESHOLD_DAYS = 7` is a named constant with a comment explaining the grace period (CQ-04).
- [ ] Page lists current orphans with bucket_path, created date, and size.
- [ ] "Clean orphans" button uses the same `DeleteConfirmModal` (resource: "orphaned images", count interpolated into the prompt).
- [ ] On success: shows "Deleted N images, freed ~M MB". Toast is fine here.
- [ ] On error: inline error, full log (EH-01, EH-02, EH-04).
- [ ] All deletes are parameterized (SEC-03).

**Tests required:**
- `deleteOrphanImages deletes only rows older than 7 days` (TS-04 data write critical).
- `deleteOrphanImages does not delete recent orphans` (TS-01 error case for boundary).
- `deleteOrphanImages handles Storage failure with logged error` (TS-04 — touches Storage; 2 error tests).

**Depends on:** T25

**Specialist:** `@supabase`

---

## T28 — Admin smoke test (end-to-end)

**Files:** all admin files from T15–T27.

**Functions to implement:** [integration test]

**Acceptance criteria:**
- [ ] End-to-end Playwright flow:
  - Navigate to `/admin` while signed out → redirected to `/admin/login`.
  - Sign in via magic link (or pre-seeded session for the test).
  - Land on `/admin`.
  - Create a project → appears in list. Edit it → changes save. Publish it → slug becomes read-only. Delete it (confirm modal) → row removed.
  - Same flow for posts, including a post with raw Markdown that round-trips via the preview pane.
  - Stats: insert a manual stat → appears in list. Delete it → confirmed and removed.
  - Images: upload an image to a project (require alt text) → image attaches. Replace it → previous becomes orphan. Visit `/admin/images` → orphan listed.
  - Logout → back to `/admin/login`. Back button does not restore session.
- [ ] No console errors or warnings in any flow (CQ-05).
- [ ] No XSS reachable via title or alt text inputs (try `<script>` and `<img onerror>` — both render literally, no execution) (SEC-02 verified).
- [ ] Voice/UI rules pass: no SaaS phrases, no emoji in admin labels (CONSTRAINT-13).
- [ ] All admin Tailwind/shadcn styles stay inside `/admin/*` — visit `/projects` after admin work, verify computed style baseline unchanged (CONSTRAINT-03).

**Tests required:**
- The end-to-end Playwright suite above (TS-04: covers auth, data writes, access control).

**Depends on:** T27

**Specialist:** `@qa`

---

## Phase 2 Exit Criteria

- All 14 tasks complete; tests passing.
- Admin can do full CRUD on projects, posts, stats, and images locally + on the production deploy.
- No programmatic write path open yet (Phase 3).
- Mark Phase 2 row Done in [`plan-index.md`](plan-index.md). Mark Phase 3 row Active. Log transition in `docs/session-log.md`.
