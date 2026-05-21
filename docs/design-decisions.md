# Design Decisions

## ⚠ CANONICAL SOURCE — READ FIRST

**The design for swarnimbagre.com is the bundle at `docs/design-source/personal-site-web/`. It is used VERBATIM, not as inspiration.**

**Scope:** These rules apply to the PUBLIC SITE. The admin panel (`/admin`) follows different rules — see "Admin Panel" section below.

- `@ui` and every implementation task MUST use the existing components from `site/components.jsx` and `site/mobile-components.jsx`. New components extend these files; they do not replace them.
- All styling MUST use the existing CSS variables in `site/colors_and_type.css`. No new tokens, no overrides, no "close enough" substitutes.
- Where a pattern exists in the bundle, the implementation matches it exactly — same hex codes, same px sizes, same font weights, same spacing tokens, same animation timing (220ms, `cubic-bezier(.2, .7, .2, 1)`).
- "Similar-looking" is NOT acceptable. If the bundle uses a hairline + 24px gap, the implementation is a hairline + 24px gap — not a card with a shadow, not a 20px gap.
- If a needed pattern does NOT exist in the bundle, stop and consult `@designer` before improvising. Do not derive a "compatible" solution silently.

**Why this rule:** the design was developed through long iteration on claude.ai/design and represents finished, locked decisions. Re-interpretation invalidates that work and produces drift.

---

## Visual Direction

**Type:** Personal site / editorial portfolio. Closest framework category is `consumer`, but treat as a custom type — no library defaults apply.

**Feeling:** A writer's notebook left open — dry, lo-fi, type-driven, anti-marketing. Hairlines and spacing do all the work; chrome and shadows are absent.

**Reference products:** N/A — design is locked in the source bundle, not derived from external references. Do not seek inspiration from other sites.

---

## Audience

**Primary user:** Mixed — recruiters reviewing background, engineering peers, potential collaborators, people landing via social (X, Reddit, etc.), casual readers exploring the writing. Voice and density must hold up across all of them simultaneously; do not optimize for one.

**Platform priority:** Balanced — desktop and mobile are independent, first-class designs (separate `index.html` and `mobile.html`), not a single responsive layout. Both are equally important.

**Use frequency:** Occasional — visitors will read once, maybe return periodically. Not a daily-use tool. Affects density (spacious is fine) and motion (subtle only — nothing that grates on repeat visits).

---

## Component Approach

**Primary library:** None — raw React with custom components in `site/components.jsx` (desktop) and `site/mobile-components.jsx` (mobile).

**Accent libraries:** None.

**Tailwind:** Not used. All styling via CSS variables in `site/colors_and_type.css` plus inline styles in components.

**Rationale:** Component libraries (shadcn, Aceternity, Magic UI, etc.) carry visual conventions — rounded pills, shadows, gradients, default focus rings — that directly violate the bundle's anti-patterns. Importing and overriding every default would be more work than the custom components already in the bundle, and would risk visual drift.

**For `@ui` skill:** Do NOT apply the standard `@ui saas` (shadcn) or `@ui landing` (Aceternity + Magic UI) configurations. The project-specific UI skill (generated during `@recruit`) must reference this file and the source bundle as the only valid pattern source.

---

## Interaction Principles

**Motion:** Subtle transitions only. Permitted: 220ms `cubic-bezier(.2, .7, .2, 1)` on color, border, and small `translateY`. Permitted: SMIL/CSS animations inside `DemoLoop` SVG scenes. Forbidden: page transitions, scroll-triggered animations, entry animations, opacity hover changes, layout shifts.

**Density:** Moderate — closer to spacious than dense. Generous vertical whitespace, hairline-separated sections, asymmetric type-driven layouts. Do not compress to fit more content per screen.

**Feedback:** Inline only. No toasts, no modal confirmations, no banner notifications. State changes happen in place (hover states, button-pressed border shifts, drawer open/close). Navigation uses hash routing (already implemented in the bundle).

---

## What to Avoid

Verbatim from the bundle's anti-patterns. Non-negotiable:

- No rounded pill cards (hairlines + spacing only; max `border-radius` is 12px on mobile section buttons, 4px or 0 elsewhere)
- No shadows on any surface (flat surfaces only)
- No SaaS phrases ("AI-powered", "next-gen", "seamless", "powerful", etc.)
- No emoji — typographic symbols only (※, ¶, *, →, ↗, { })
- No logo brands or brand marks — typographic symbols substitute
- No external images — all visuals are CSS gradients + inline SVG
- No external fonts beyond the three already in use (Fraunces, Inter, JetBrains Mono)
- No animations on page load or transition
- No scroll-triggered animations
- No opacity-based hover states (color, border, or 2px `translateY` lift only)
- No deep-shadow or high-contrast button styles
- No standard form chrome (default radios, checkboxes, inputs) — custom styled controls only
- No background gradients (only inside `DemoLoop` scenes)
- No nested anchors
- No blue — palette is warm dark (browns, golds, sage, sienna). No cool tones.

---

## Overrides to the verbatim-bundle rule

Documented exceptions to CONSTRAINT-05. Every override is scoped to a named surface and recorded here. A pattern that is not under an override entry below is still bundle-verbatim.

### Override 1: Project card redesign (T42, 2026-05-19)

**Rationale.** The bundle's StatusPill encodes lifecycle vocabulary (`active`, `dormant`, `abandoned fondly`) that doesn't match the new content model — progress percent, three link slots, and a before/after slider on one project. The bundle's `DemoLoop` animations (`rings | bars | wave | agent`) don't match the new "real screenshot" intent. Continuing to honor the bundle verbatim on the project-card surface would force schema compromises that deliver less than what the bundle itself would design with the new model in hand.

**What changed (project-card surface only):**

- StatusPill → ProgressRing. SVG dual-stroke ring driven by `progress_percent` (integer, 0–100). At 100 the ring renders as a full circle with a subtle done-glow. Null `progress_percent` → ring not rendered (null in, null out).
- Bundle's fixed status text → 3 conditional buttons via the existing `TypoIcon` component: `{ } code`, `↗ site`, `¶ notes`. Each button renders only when its corresponding URL column (`github_url`, `live_url`, `post_url`) is non-null.
- Bundle's `DemoLoop` animation → real screenshot from `image_id`. When `image_after_id` is set on a project, the before/after slider (existing `BeforeAfterMedia.tsx`) replaces the static image. Bundle's `DemoLoop` code stays in the tree in case revived later, but is dropped from the data path.
- `StillMedia` (bundle dummy) bypassed for direct `<img>` rendering on the real-image path. The bundle dummy has no image-input slot; the real-image path matches `renderRealImage` styling from `BeforeAfterMedia` to keep visual continuity between still and before/after surfaces.

**What stayed (no change):**

- Palette — verbatim hex codes from `colors_and_type.css`.
- Typography — Fraunces and JetBrains Mono families and weights unchanged.
- Spacing tokens — unchanged.
- Animation timing — 220ms `cubic-bezier(.2, .7, .2, 1)` everywhere it applied.
- Voice — CONSTRAINT-13 still binding. Button labels `{ } code`, `↗ site`, `¶ notes` are taken verbatim from the bundle's TypoIcon vocabulary (decision recorded Session 30): the new button surface is wired but the strings are bundle-sourced, so CONSTRAINT-05 is honored at the copy layer without needing an Override 2.
- Everything outside the project-card surface — Home hero, Projects header, Writing pages, Other pages, mobile navigation — remains bundle-verbatim under CONSTRAINT-05.

**Surface boundary.** Override 1 applies to these files only:

- `components/public/ProjectRow`
- `components/public/ProjectCard`
- `components/public/ProjectMedia`
- `components/public/ProgressRing`
- `components/public/BeforeAfterMedia` (real-image path)
- `components/public/mobile/MobileProjectCard`
- `components/public/mobile/MobileProjectRow`
- `components/public/mobile/pages/Home` (project-card region)
- `components/public/mobile/pages/Projects` (project-card region)

Everything outside this list remains bundle-verbatim. A further deviation requires a named Override entry of its own.

### Override 2: Project media carousel (T43, 2026-05-20)

**Rationale.** The bundle ships single-image and before/after slots inside the project card — neither pattern survives the new content model, where a project has 0-20 ordered media rows, each optionally captioned, optionally a pair. There is no precedent in the bundle for navigating among multiple slides; the bundle's "type-driven, no chrome" instinct never had to reckon with a horizontal sequence. Continuing to honor the bundle verbatim on the media surface would force the schema to collapse back to one image per project, deleting the documentary intent of carrying a sequence of screenshots per build. The public site also takes on its first runtime JS dependency here — `embla-carousel-react` — because building a gesture-correct, keyboard-correct, reduced-motion-correct horizontal swiper from scratch would consume more attention than the rest of T43 combined for an audience that won't see the difference. Embla is small, headless (zero default chrome), and integrates by passing children. The chrome stays ours; only the gesture engine is borrowed.

**What changed (project media carousel surface only):**

- Single-image / before-after image slot → multi-slide carousel driven by `project_media` rows. The 16:9 image frame dimensions and background (`var(--bg)`) are unchanged from the current ProjectCard slot — the carousel sits inside the same frame.
- Single-image slides render `<img>` with **`object-fit: contain`** (was `cover` on the bundle path). Vertical phone shots and wide screenshots both render uncropped, letterboxed against `var(--bg)`. Pair slides continue to use the existing `BeforeAfterMedia` component with its `object-fit: cover` — symmetric cropping across before and after matters more than uncropped pixels inside a pair.
- New caption block below the image frame: `var(--meta-sm)` (11px JetBrains Mono), `var(--fg-muted)`, padding `12px 16px 0`. The global `.meta-sm` uppercase + letter-spacing is overridden to `textTransform: 'none'` / `letterSpacing: '0'` — captions are prose, not metric labels. Precedent: the existing Footer already overrides these the same way for prose mono. Null captions collapse, no space reserved.
- New dots + arrows chrome below the caption block. Dots: 6px (list view) / 8px (detail view), filled `var(--accent)` for active, outlined `var(--hairline)` for inactive. Arrows: `←` `→` glyphs in `var(--font-mono)`, 14px (list view) / 18px (detail view), color `var(--fg-muted)` transitioning to `var(--accent)` on hover, `var(--fg-faint)` at boundary (no loop). Hit areas 32px (list) / 40px (detail) for pointer precision. Hover transition matches the project standard: `220ms var(--ease)`.
- Pair-slide drag isolation: a 28px-wide hit zone centered on the BeforeAfterMedia divider stops touch propagation to Embla, so the divider drag operates without Embla swiping the slide. Outside that zone, touches reach Embla as normal.
- Admin reorder handle: `⋮⋮` glyph (two U+22EE), left-gutter of each media row, `var(--admin-muted-fg)` to `var(--admin-fg)` on hover. CONSTRAINT-13-compliant (no emoji; typographic glyph).
- Public site takes on `embla-carousel-react` as its first JS dependency. Embla is headless — no default visual chrome ships from the package; only gesture, keyboard, and slide-coordination logic.

**What stayed (no change):**

- Palette — verbatim hex codes from `colors_and_type.css`. No new color tokens introduced. Chrome uses `var(--fg-muted)`, `var(--accent)`, `var(--hairline)`, `var(--hairline-2)`, `var(--fg-faint)`, `var(--bg)` — all pre-existing.
- Typography — Fraunces and JetBrains Mono families and weights unchanged. Captions use the existing `var(--meta-sm)` size definition.
- Spacing tokens — chrome padding values (8/10/12/14/16/18px) all sit within the existing `--space-*` scale and the card's existing padding language.
- Animation timing — 220ms `var(--ease)` everywhere it applied. No new motion patterns.
- Voice — CONSTRAINT-13 still binding. Caption copy is admin-authored prose, capped at 140 soft / 280 hard. No SaaS phrasing, no emoji. The drag-handle glyph is a typographic Unicode character, same family as the existing TypoIcon vocabulary (`{ }`, `↗`, `¶`).
- Existing card chrome — Override 1's ProgressRing, three-link row, card body padding and typography are untouched. The carousel replaces only the image slot's interior.
- BeforeAfterMedia component itself — no changes to its drag math, its 1px visual divider, its 26px handle with 3px glow, or its `object-fit: cover` clip. The carousel wraps it; the slider's existing behavior continues unchanged within its slide.
- Everything outside the project media carousel surface — Home hero, Projects header copy, Writing pages, Other pages, mobile navigation — remains bundle-verbatim under CONSTRAINT-05. No category-wide loosening.

**Surface boundary.** Override 2 applies to these files only:

- `components/public/ProjectMediaCarousel.tsx` (new)
- `components/public/mobile/MobileProjectMediaCarousel.tsx` (new — if a separate mobile component is required by the responsive split; if a single component serves both, only the desktop file lands)
- The `embla-carousel-react` npm dependency
- `components/admin/ProjectMediaRow.tsx` (drag-handle glyph)
- `app/projects/[slug]/page.tsx` (mounts the carousel on the detail page)
- `components/public/ProjectCard.tsx` (image-slot interior swapped to render the carousel; outer frame unchanged)
- `components/public/mobile/MobileProjectCard.tsx` (same)

Everything outside this list remains bundle-verbatim. The chrome decisions above (dots, arrows, caption typography, hit-zone widths) are not portable to any other surface without a further named Override entry of its own.

**Decision specs:**

| Area | Spec |
|---|---|
| Frame | `aspectRatio: 16 / 9`, `background: var(--bg)`, `overflow: hidden`. Identical to current ProjectCard image slot. |
| Single-image fit | `object-fit: contain` over `var(--bg)` (letterbox). |
| Pair-image fit | `object-fit: cover` inside the existing BeforeAfterMedia (unchanged). |
| Caption type | `var(--meta-sm)` (500 11px mono, line-height 1.3), `textTransform: 'none'`, `letterSpacing: '0'`. |
| Caption color | `var(--fg-muted)`. |
| Caption position | Below image frame, above dots row. Padding `12px 16px 0`. Wraps freely. Null → block collapses. |
| Dots, list view | 6px diameter, 8px center-to-center, row padding `8px top / 14px bottom`. |
| Dots, detail view | 8px diameter, 10px center-to-center, row padding `12px top / 18px bottom`. |
| Dot active | Filled `var(--accent)`. |
| Dot inactive | Transparent fill, 1px border `var(--hairline)`. Hover → `var(--hairline-2)`. |
| Arrows, list view | Glyphs `←` `→` in `var(--font-mono)` at 14px. Hit area 32×32. |
| Arrows, detail view | Same glyphs at 18px. Hit area 40×40. |
| Arrow color | `var(--fg-muted)`. Hover → `var(--accent)`. Disabled (at boundary) → `var(--fg-faint)`. |
| Arrow background | Transparent. No fill, no shadow. |
| Motion | All transitions `220ms var(--ease)` on `color`, `background-color`, `border-color`. `prefers-reduced-motion: reduce` disables slide transition. |
| Embla config | `axis: 'x'`, `loop: false`, `dragFree: false`, `containScroll: 'trimSnaps'`. Horizontal-dominant gestures only; vertical-dominant pass through to page scroll. |
| Pair-slide drag priority | 28px-wide hit zone centered on `BeforeAfterMedia` divider stops propagation to Embla on `touchstart` / `mousedown`. Outside that zone, gestures reach Embla. |
| Tap-to-advance | Disabled. Tapping a slide does nothing. Advance via arrows, dots, swipe, or keyboard ←/→ only. |
| Admin drag-handle | Glyph `⋮⋮` (two U+22EE), left gutter 32px wide, vertically centered, color `var(--admin-muted-fg)` → `var(--admin-fg)` on hover. Cursor `grab` / `grabbing`. |
| Boundary behavior | At first slide, left arrow disabled. At last slide, right arrow disabled. No loop. No edge bounce. |

Codified as CONSTRAINT-22 at T43.I.

---

## Admin Panel

**Scope:** The admin panel at `/admin` follows DIFFERENT rules from the public site. The bundle's anti-patterns and component conventions do NOT apply here.

**Audience:** Single user (Swarnim). Never seen by visitors.

**Component library:** shadcn/ui with Tailwind. Use shadcn's defaults for forms, tables, modals, dropdowns, file upload UIs, and any other CRUD chrome. Do not custom-build admin components in the public-site aesthetic.

**Color continuity:** Borrow these tokens from the public palette (`app/styles/colors_and_type.css`) so admin doesn't feel jarring when bouncing between admin and public site. Tokens are namespaced as `--admin-*` in admin CSS — same hex, different variable name — to prevent cascade collisions (see CONSTRAINT-16).

Eight tokens total: 4 brand (original) + 4 semantic (added 2026-05-12 after `@designer` + `@cto` consultation to cover shadcn's required slots).

**Brand tokens (original 4):**
- `--admin-bg` (#1C1712) — page background. Maps to shadcn `background`.
- `--admin-surface` (#252018) — raised surfaces. Maps to shadcn `card`, `popover`, `secondary`, `accent`, `muted` (background).
- `--admin-fg` (#E8E0D0) — body text. Maps to shadcn `foreground`, `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground`.
- `--admin-accent` (#C9A84C) — primary action / focus. Maps to shadcn `primary`, `ring`.

**Semantic tokens (added 2026-05-12):**
- `--admin-destructive` (#B85C3C) — sources hex from public `--danger` (burnt sienna). Maps to shadcn `destructive`.
- `--admin-destructive-fg` (#F5E8D8) — high-contrast readable text on destructive bg. Maps to shadcn `destructive-foreground`.
- `--admin-border` (#3A3328) — sources hex from public `--hairline`. Maps to shadcn `border`, `input`.
- `--admin-muted-fg` (#7A7060) — sources hex from public `--fg-muted` (dates, metadata). Maps to shadcn `muted-foreground`.

**Why expanding from 4 to 8 does NOT violate the bundle rule:** the original "4 tokens only" rule existed to keep the public site's *identity elements* out of admin — Fraunces typography, hairline-driven layout grammar, the gold-underline link signature. Those remain public-only. Adding semantic admin tokens for shadcn slot coverage (destructive states, borders, muted text) is mechanical chrome, not identity. The shadcn aesthetic is preserved; only the hex values shift to the warm palette so admin doesn't clash visually when toggled with the public site.

Do NOT pull typography tokens, spacing tokens, motion tokens, or any other public-site variables. The 8 colors above are the complete admin import.

**Typography:** shadcn defaults (Inter or system font). Do NOT use Fraunces or JetBrains Mono in admin — those are public-site signature fonts and using them in admin dilutes the public site's identity.

**Anti-patterns relaxed for admin:**
- Rounded corners — allowed (shadcn defaults, typically 6–8px)
- Shadows — allowed (subtle elevation for modals, dropdowns, popovers)
- Default focus rings — allowed
- Form chrome — shadcn-styled inputs, selects, checkboxes, radios are fine
- Toasts — allowed (shadcn's `sonner` for save confirmations and errors)

**Anti-patterns still enforced:**
- No SaaS phrases ("AI-powered", "next-gen", etc.) — voice discipline applies even in single-user admin
- No emoji in admin UI labels (typographic symbols if needed, but admin doesn't need decoration)

**For `@ui` skill:** When tasks target the admin panel (`/admin/*`), use the `@ui saas` (shadcn) configuration. When tasks target the public site, use the bundle as the only valid source. The skill must distinguish.

**Style isolation:** Admin Tailwind/shadcn styles must not bleed into the public site bundle — see Open Questions for `@cto` for the technical setup.

**Rationale:** Admin is single-user, invisible to public visitors, and built quickly (~1–2 hr scope). Custom-designing CRUD chrome in the public site's "type-driven, no chrome" aesthetic blows up that scope and produces no value for an audience of one. Shadcn provides production-grade form/table conventions immediately. Color continuity prevents jarring bounce between admin and public.

---

## Open Questions for @cto

Design decisions with technical implications that need `@cto` resolution during `@plan`:

1. **Viewport routing strategy.** Bundle ships two independent files (`index.html` desktop, `mobile.html` mobile). Visitors at `/` need to land on the right one. Options: (a) client-side viewport redirect, (b) server-side UA detection, (c) separate URL paths. Has SEO and shareability implications.

2. **`tweaks-panel.jsx` production strategy.** ✅ **RESOLVED 2026-05-07** — gated behind `NEXT_PUBLIC_TWEAKS=1` env var (preview-only, never production), per architecture §5.3 and confirmed at session 2 of 2026-05-07. The earlier proposal to use `?tweaks=1` querystring is rejected — env var is locked at build time, so visitors cannot summon the panel on production no matter what URL they craft. Implementation lands in T10d.

3. **Next.js migration timing.** Kickoff decision: ship initial site as React-via-CDN + Babel-standalone from `site/`, migrate to Next.js App Router when the admin panel is built. `@cto` should confirm this still holds during `@plan`, or revisit if there's a reason to migrate earlier (e.g., SEO for writing posts).

4. **Tailwind + shadcn isolation for admin.** Admin uses Tailwind/shadcn; public site uses raw CSS variables + inline styles (no Tailwind). Build config must ensure: (a) Tailwind utility classes don't bleed into the public site bundle, (b) shadcn component styles are scoped to `/admin/*` routes only. Likely resolved by separate Tailwind config + scoped content paths, or by loading Tailwind only in the admin route layout once Next.js migration happens.

---

## Source Bundle Reference

For granular specs not duplicated in this doc:

- **Color system (14 named tokens with hex):** `docs/design-source/personal-site-web/project/colors_and_type.css`
- **Typography scale (13 semantic roles):** same file
- **Spacing scale (10-step token system):** same file
- **Desktop components:** `docs/design-source/personal-site-web/project/site/components.jsx`
- **Mobile components:** `docs/design-source/personal-site-web/project/site/mobile-components.jsx`
- **Desktop pages:** `docs/design-source/personal-site-web/project/site/pages/{Home,Projects,Writing,Other}.jsx`
- **Mobile pages:** `docs/design-source/personal-site-web/project/site/pages-mobile/{Home,Projects,Writing,Other}.jsx`
- **Design reasoning + iteration history:** `docs/design-source/personal-site-web/chats/chat1.md`
- **Bundle handoff guide:** `docs/design-source/personal-site-web/README.md`

When in doubt about any visual or interaction decision, the bundle is the answer.
