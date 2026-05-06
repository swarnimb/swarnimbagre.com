# Skill: @ui-swarnimbagre

## Purpose
Routes UI tasks for swarnimbagre.com to the correct mode based on target path. Replaces the standard global `@ui` skill for this project. The public site (`site/*` and any non-`/admin` route) uses the verbatim design bundle; the admin panel (`/admin/*`) uses shadcn/ui + Tailwind. This skill enforces that split — it does not invent patterns, and it does not let one mode bleed into the other.

---

## Modes

### `@ui-swarnimbagre` (reference / no-arg invocation)
Reports the two modes (Public, Admin), restates the canonical-source rule from `docs/design-decisions.md`, and asks which mode the task targets. Does nothing else until a target path is confirmed.

### `@ui-swarnimbagre public [target]`
Mode A — Public site work. Touches files under `site/*` or any non-`/admin` route. Uses the existing component bundle verbatim — no library substitutions, no improvisation.

### `@ui-swarnimbagre admin [target]`
Mode B — Admin panel work. Touches files under `/admin/*`. Uses shadcn/ui + Tailwind with four borrowed color tokens from `colors_and_type.css`.

---

## Pre-conditions

Before executing:
1. Read `docs/design-decisions.md` — this is the only valid pattern source for both modes. If it is missing or stale, stop and surface this.
2. Confirm the target path of the task. If the path is ambiguous (e.g., a shared utility, a top-level layout file), ask the builder which mode applies before writing any code.
3. Confirm the correct mode (Public vs Admin) explicitly with the builder before writing any code. Do not infer mode silently.
4. For Public mode: confirm `site/components.jsx`, `site/mobile-components.jsx`, and `site/colors_and_type.css` exist and are readable. If a needed pattern does not exist in the bundle, stop and recommend `@designer` — do not improvise.
5. For Admin mode: confirm shadcn/ui + Tailwind are set up in the project. If admin tooling is not yet in place, surface this to `@cto` / `@supabase` as a setup prerequisite before proceeding.

---

## Process

### Mode A — Public site (`site/*` or any non-`/admin` route)

1. Use existing components from `site/components.jsx` (desktop) and `site/mobile-components.jsx` (mobile) verbatim. Import and compose; do not duplicate or reimplement.
2. Style only via the CSS variables defined in `site/colors_and_type.css`. No new tokens. No overrides. No "close enough" substitutes.
3. NO Tailwind. NO shadcn. NO Aceternity. NO Magic UI. NO library substitutions of any kind. The bundle is the library.
4. New components extend the existing files (`site/components.jsx`, `site/mobile-components.jsx`) — they do not replace them and they do not live in separate files unless the bundle's structure already does so.
5. Match the bundle exactly: same hex codes, same px values, same font weights (Fraunces / Inter / JetBrains Mono only), same spacing tokens, same animation timing (220ms `cubic-bezier(.2, .7, .2, 1)`). "Similar-looking" is not acceptable.
6. Enforce the bundle's anti-patterns: no rounded pill cards (max 12px on mobile section buttons, 4px or 0 elsewhere), no shadows, no SaaS phrases, no emoji, no logo brands, no external images, no external fonts beyond the three already used, no page-load animations, no scroll-triggered animations, no opacity-based hover states, no deep-shadow buttons, no standard form chrome, no background gradients (except inside `DemoLoop` SVG scenes), no nested anchors, no blue.
7. If a needed pattern does not exist in the bundle: STOP. Do not improvise. Recommend `@designer` consult before continuing.

### Mode B — Admin (`/admin/*`)

1. Use shadcn/ui components and Tailwind for all layout, forms, tables, modals, dropdowns, file upload UIs, and any other CRUD chrome. Use shadcn defaults — do not customize back toward the public-site aesthetic.
2. Borrow ONLY these four color tokens from `site/colors_and_type.css` (apply via Tailwind theme config or CSS custom properties):
   - Background: `--bg` (#1C1712)
   - Surface: `--surface` (#252018)
   - Body text: `--fg` (#E8E0D0)
   - Accent / primary action: `--accent` (#C9A84C)
3. Use shadcn defaults for everything else: typography (Inter or system font — NOT Fraunces, NOT JetBrains Mono), spacing, component shapes, focus rings, form chrome.
4. Anti-patterns relaxed for admin (permitted): rounded corners (typically 6–8px shadcn defaults), subtle shadows on modals/dropdowns/popovers, default focus rings, shadcn-styled inputs / selects / checkboxes / radios, toasts via shadcn's `sonner` for save confirmations and errors.
5. Anti-patterns still enforced in admin: no SaaS phrases ("AI-powered", "next-gen", "seamless", "powerful", etc.) — voice discipline applies even in single-user admin; no emoji in admin UI labels (typographic symbols if any decoration is needed, but admin generally needs none).
6. Style isolation: admin Tailwind / shadcn styles must not bleed into the public site bundle. Confirm the build setup keeps these scoped (separate Tailwind content paths, or Tailwind loaded only in the admin route layout post-Next.js migration). If isolation is not yet configured, surface to `@cto` before proceeding.

---

## Approval Before Writing

For both modes: present the planned approach (which components used or extended, which tokens applied, which files touched) before writing any code. Wait for explicit builder approval. If the builder requests changes, revise and re-present. Never write a file without confirmation.

---

## Output Format

- Public mode: edits land in existing files (`site/components.jsx`, `site/mobile-components.jsx`, `site/pages/*.jsx`, `site/pages-mobile/*.jsx`, `site/colors_and_type.css`). New components are appended to the existing component files unless the bundle's structure dictates otherwise.
- Admin mode: edits land in `/admin/*` route files (path confirmed at `@plan` time — likely `app/admin/*` after Next.js migration, or `site/admin/*` in the interim). Tailwind config and shadcn component installs go in their conventional locations.

Every output starts with: which mode applies, which files will be touched, and which tokens or components will be reused.

---

## When To Invoke

- Any UI task targeting the public site (any of the 4 pages: Home, Projects, Writing, Other; either desktop or mobile entry point)
- Any UI task targeting the admin panel (`/admin/*` routes — CRUD forms, tables, file upload UIs, auth screens)
- When in doubt whether a UI task is public or admin — invoke this skill first; it will ask which mode and route correctly

---

## When Not To Invoke

- Backend / database / RLS / Edge Function work — use `@supabase`
- Visual design decisions for the public site — those are locked in `docs/design-decisions.md` and the source bundle; do not seek inspiration elsewhere
- Visual design decisions for the admin panel — defer to shadcn defaults; do not custom-design admin chrome in the public-site aesthetic
- Content / copy / voice — use `@content-writer`
- The standard global `@ui` skill — do not invoke; this project's `@ui-swarnimbagre` replaces it (standard `@ui` defaults to shadcn/Aceternity for everything, which violates the public-site bundle rule)

---

## Closing

After execution, report: which mode was used, which files were touched, which existing components were reused vs extended, and confirmation that the relevant anti-patterns were enforced (public mode) or that shadcn defaults were used without drift back toward the public aesthetic (admin mode). Note any patterns that did not exist in the bundle and were escalated to `@designer`.
