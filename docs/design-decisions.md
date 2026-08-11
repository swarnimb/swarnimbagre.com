# Design Decisions

## ⚠ CANONICAL SOURCE — READ FIRST

**The design for swarnimbagre.com is the Claude Design export at `docs/design-source/redesign-2026-08/`. It is used VERBATIM, not as inspiration.**

- `swarnim-bagre-site.bundled.html` is the shipped artifact (a self-unpacking React bundle).
- `template.extracted.html` is its unpacked markup, and is the readable source of truth for hex codes, `clamp()` expressions, spacing and timing.

> **Re-baselined at T46 (2026-08-04).** The original dark bundle at `docs/design-source/personal-site-web/` is RETIRED. The builder showed the live site to several people; they were confused by it and disliked the look. That is real user feedback, and it outranked every internal argument for keeping the old design. Overrides 1, 2 and 3 retired with it, because they amended surfaces that no longer exist.

**Scope:** These rules apply to the PUBLIC SITE. The admin panel (`/admin`) follows different rules — see "Admin Panel" below.

- Every implementation task MUST use the token layer in `app/styles/colors_and_type.css` and the component classes in `app/styles/public.css` + `public-home.css` / `public-projects.css` / `public-writing.css` / `public-other.css`. No new tokens, no overrides, no "close enough" substitutes.
- Where a pattern exists in the export, the implementation matches it exactly: same hex codes, same px sizes, same `clamp()` expressions, same font weights, same spacing, same timing (`.18s ease` on hover, `.4s cubic-bezier(.4, 0, .2, 1)` on the carousel track).
- "Similar-looking" is NOT acceptable.
- **One width breakpoint: 640px** — the only width query in `app/styles/`, repeated per page sheet. `public-other.css` additionally carries a `max-height: 600px` guard that releases the `.cpage` height lock so the viewport-locked Other grid survives short windows (shipped at `eac4c91`); that is a height guard, not a second device breakpoint, and it fires on any short viewport, desktop included. Single responsive tree. No mobile component fork, no server-side device split. Both were deleted at T46.
- If a needed pattern does NOT exist in the export, stop and consult `@designer` before improvising.

**Why this rule:** the design was developed through long iteration on claude.ai/design and represents finished, locked decisions. Re-interpretation invalidates that work and produces drift.

---

## Deliberate deviations from the export

These are the design as built, not drift. Anything not listed here is bundle-verbatim.

| Deviation | Proof in code |
|---|---|
| The blinking `.h-cursor` caret is removed. It faked a mid-typing state that never resolved and read as a bug. | `app/styles/public-home.css:8` |
| No fourth "Email him" pill on Home. It is replaced by a "Find me here:" row of three branded marks — the only saturated color anywhere on the site. | `components/public/home/SocialIcons.tsx:87` |
| Every page footer is removed; the export has none. | no public footer component exists; removal noted at `app/writing/[slug]/page.tsx:76` |
| `/writing/[slug]` exists. The export pointed every list row back at the list itself, which would have left post bodies unreachable. | `app/writing/[slug]/page.tsx` |
| The carousel is hand-rolled, not embla-backed. The public site carries zero runtime JS dependencies. | no `embla-*` in `package.json`; track transition at `app/styles/public-projects.css:44` |
| Copy is first person throughout, including the home bio, which the export wrote in third person. | `components/public/pages/Home.tsx:101` |
| Viewport units are `svh`, not `vh` — see below. | `app/styles/public-home.css:34-35`, `app/styles/base.css:13-14` |
| `/other` carries a `max-height: 600px` release on the `.cpage` height lock. The export has exactly one media query — `max-width: 640px` — and asks no height question at all, so its one-screen Other grid clips with no scroll on any short viewport. | `app/styles/public-other.css:234`; export query at `template.extracted.html:216` |
| `app/error.tsx` and `app/not-found.tsx` exist. The export has no error state and no 404. Both compose the shared shell plus the export's off-home action pill; `h-*` classes stay home-only. | `app/not-found.tsx`, `app/error.tsx`, `app/styles/public-projects.css:191-227` |

### Why `svh` (2026-08-04, Session 52)

The export's intent for Home is exactly one screen with no scroll. `vh` implements that intent incorrectly on a browser with dynamic toolbars — it resolves to the LARGE viewport, the height the page would have with the bars retracted. On Chrome for Android/iOS the bars are usually showing, so the box was taller than the visible area, and `.h-conv`'s `margin: auto 0` then centred the conversation inside that oversized box and pushed one end off screen. Safari masked it by collapsing its bars far more eagerly. `svh` is the height guaranteed visible WITH the bars present, so the layout always fits and never shifts. `dvh` was rejected deliberately: it tracks the toolbars as they move, which would make the centred content slide during scroll. This is a defect fix, not a design change — the intent is preserved — but it is a deviation and is recorded rather than left implicit.

**The paired `min-height` declarations are a deliberate fallback pair, not a duplicate.** `min-height: 100vh` sits directly above `min-height: 100svh` in both `app/styles/public-home.css` (`.hpage`) and `app/styles/base.css` (`html, body`); the first line serves engines without `svh` and the second overrides it everywhere else. Do not "tidy away" either line — removing one reintroduces the bug on one class of browser.

**Scope, corrected 2026-08-06 (`a499372`).** This was originally scoped to Home only, with `base.css` left on plain `vh` on purpose. That was wrong and it undid the fix: `vh` is the large viewport and `svh` the small one, so the body floor sat ~120px taller than the home page's own `100svh` box. That gap is dead scrollable space, which is why Home could still scroll off its baseline despite being designed not to scroll at all. `base.css` now carries the same `vh`/`svh` pair. `min-height` only sets a floor, so taller pages still scroll normally.

`.cpage` in `public-other.css` remains on `height: 100vh` deliberately — it is a hard height lock plus `overflow: hidden`, a different mechanism from a `min-height` floor, and it has its own short-viewport release (below).

### Closed at Session 53 (2026-08-06)

Both of these were real defects against the export, now fixed. They are recorded because the *reason they survived* still matters.

**`/other` clipped on a phone held sideways — fixed in `eac4c91`.** `.cpage` released its height lock to `height: auto` only at `max-width: 640px`. A phone in landscape is 852×393: wide enough to clear the 640px breakpoint, so it kept the one-screen-tall layout, but only ~390px tall, and `overflow: hidden` clipped the bottom tile rows with no scroll to recover them. Width is the wrong question to ask about a height lock, so the fix adds a `@media (max-height: 600px)` release alongside the width one (`app/styles/public-other.css:234`). The row `flex: none` in that block is load-bearing, not cosmetic: rows divide a fixed height with `flex: 1`, so once the height goes `auto` there is no free space to divide and a `flex-basis: 0` row collapses to nothing. Confirmed on device by the builder.

**`.ctile` / `.ttile` content was not vertically centred — fixed in `ade464c`.** The export specifies both tile types as `display:flex; flex-direction:column; justify-content:center; gap:...` at `template.extracted.html:447` (`.ctile`) and `:463` (`.ttile`). `public-other.css` implemented every part of that rule **except `justify-content`**, so it fell back to `flex-start` and pinned every tile's content to the top of a box several times its own height.

> **Lesson worth keeping, because it will recur: an empty-state fallback can hide an export deviation indefinitely.** The `.ctile` defect shipped through T46 and survived two security audits and a full test suite — not because anyone looked and missed it, but because it was **unreachable**. `stats` and `notes` were both at 0 rows, so `/other` rendered the `.cempty` state and the tile grid never existed in the DOM. The first real content is what surfaced it. Any public surface with an empty-state branch should be treated as **unverified against the export until it has been seen with real rows in it** — passing tests and a clean build say nothing about a branch that never rendered.

### Project-media captions removed, not deferred (2026-08-07)

The `project_media` `caption` field was removed from the admin input and from the app-side code path this session. The export has no caption pattern at all — its slide model is `label` / `alt` / `key` only (`template.extracted.html:316-320`) — so drawing one would mean inventing a new design, the T46 embla-to-`ProjectFrame` rewrite had already silently dropped the render, and `project_media` holds 0 rows in production, so nothing was lost. The DB column is deliberately left in place (no migration), but re-adding a caption is a new design that goes through `@designer` first; it is not a form field to put back.

---

## Visual Direction

**Type:** Personal site / editorial portfolio. Closest framework category is `consumer`, but treat as a custom type — no library defaults apply.

**Feeling:** A writer's notebook left open — dry, lo-fi, type-driven, anti-marketing. Hairlines and spacing do all the work; chrome and shadows are absent.

**Reference products:** N/A — design is locked in the export, not derived from external references. Do not seek inspiration from other sites.

---

## Audience

**Primary user:** Mixed — recruiters reviewing background, engineering peers, potential collaborators, people landing via social (X, Reddit, etc.), casual readers exploring the writing. Voice and density must hold up across all of them simultaneously; do not optimize for one.

**Platform priority:** Balanced. Desktop and mobile are equally important, and are served by a SINGLE responsive layout with one width breakpoint at 640px, plus a short-viewport height guard on `/other` (see the CANONICAL SOURCE block above). The old split (separate `index.html` / `mobile.html`, later a `components/public/mobile/` tree and a server-side device header) was retired at T46 because it meant building and maintaining every screen twice, on a one-person site.

**Use frequency:** Occasional — visitors will read once, maybe return periodically. Not a daily-use tool. Affects density (spacious is fine) and motion (subtle only — nothing that grates on repeat visits).

---

## Component Approach

**Primary library:** None. Raw React with custom components under `components/public/`, as a single responsive tree.

**Accent libraries:** None.

**Tailwind:** Not used on the public site. Styling comes from the token layer in `app/styles/colors_and_type.css` plus the component classes in `app/styles/public*.css`, with inline styles only for one-off static values, matching how the export is authored.

**Rationale:** Component libraries (shadcn, Aceternity, Magic UI, etc.) carry visual conventions — rounded pills, shadows, gradients, default focus rings — that directly violate the export's anti-patterns. Importing and overriding every default would be more work than the custom components already in the export, and would risk visual drift.

**For `@ui` skill:** Do NOT apply the standard `@ui saas` (shadcn) or `@ui landing` (Aceternity + Magic UI) configurations. Use the project-specific `@ui-swarnimbagre` skill, which treats this file and `docs/design-source/redesign-2026-08/` as the only valid pattern source.

---

## Interaction Principles

**Motion:** Exactly two transitions exist site-wide, and both are tokenised in `app/styles/colors_and_type.css`: `.18s ease` (`--dur` / `--ease`) on hover states, and `.4s cubic-bezier(.4, 0, .2, 1)` (`--dur-carousel` / `--ease-carousel`) on the carousel track. Nothing else moves. Forbidden: page transitions, scroll-triggered animations, entry animations, opacity hover changes, layout shifts.

**Density:** Moderate — closer to spacious than dense. Generous vertical whitespace, hairline-separated sections, asymmetric type-driven layouts. Do not compress to fit more content per screen.

**Feedback:** Inline only. No toasts, no modal confirmations, no banner notifications. State changes happen in place (hover states, button-pressed border shifts, drawer open/close).

---

## What to Avoid

The export's anti-patterns. Non-negotiable:

- Radii are used deliberately, per the export: 16px cards, 999px pills on tags and action buttons, 26px on the chat input, and an asymmetric 18px/4px chat bubble. Match the export; do not import radii from the retired dark bundle.
- No shadows on any surface (flat surfaces only)
- No SaaS phrases ("AI-powered", "next-gen", "seamless", "powerful", etc.)
- No emoji — typographic symbols only (※, ¶, *, →, ↗, { })
- No logo brands or brand marks — typographic symbols substitute. The one deliberate exception is the three branded marks in the home "Find me here:" row.
- Project cards render photographic screenshots from `project_media`. Inline SVG remains the rule for icons and marks.
- No external fonts beyond the three in use: Instrument Serif (display), Space Grotesk (body/UI), Space Mono (kickers, dates, labels). Inter is admin-only.
- No animations on page load or transition
- No scroll-triggered animations
- No opacity-based hover states (color, border, or 2px `translateY` lift only)
- No deep-shadow or high-contrast button styles
- No standard form chrome (default radios, checkboxes, inputs) — custom styled controls only
- No background gradients
- No nested anchors
- The palette is warm LIGHT: cream ground `#F4F1EA`, deep-green accent `#1F3D2F`. The warm-dark palette (browns, golds, sage, sienna) belongs to the retired bundle and survives only in admin, which stayed dark on purpose. The one deliberate exception to "no blue" is the LinkedIn brand mark in the home reach-out row; brand marks are the only saturated color on the site.

---

## Overrides to the verbatim-bundle rule

> **RETIRED T46 (2026-08-04). CONSTRAINT-05 has no active Overrides.** All three amended the original dark bundle and named files that no longer exist (`ProjectCard` as it was, `ProjectMediaCarousel`, `app/projects/[slug]`, the whole `components/public/mobile/` tree). **Do not implement against them.** Full text is in git history and `docs/founder-brief.md`.

- **Override 1 — Project card redesign (T42, 2026-05-19).** RETIRED. Replaced the bundle's StatusPill with a `progress_percent` ProgressRing, its fixed status text with three conditional `{ } code` / `↗ site` / `¶ notes` link buttons, and its `DemoLoop` animation with real screenshots. The current project card comes from the T46 export instead; `DemoLoop` no longer exists in the tree.
- **Override 2 — Project media carousel (T43, 2026-05-20).** RETIRED. Introduced an embla-backed multi-slide carousel with its own dots/arrows chrome and a ≤15 KB gzip dependency budget. It was codified as CONSTRAINT-22 at T43.I; see that constraint for the current position. The carousel is now hand-rolled and embla is gone from `package.json`.
- **Override 3 — Project detail page embedded writeup (T45, 2026-05-28).** RETIRED. Let a project attach a published post whose body rendered below the card on `/projects/<slug>`, reusing the `/writing` body styling.

---

## Admin Panel

**Scope:** The admin panel at `/admin` follows DIFFERENT rules from the public site. The export's anti-patterns and component conventions do NOT apply here.

**Audience:** Single user (Swarnim). Never seen by visitors.

**Component library:** shadcn/ui with Tailwind. Use shadcn's defaults for forms, tables, modals, dropdowns, file upload UIs, and any other CRUD chrome. Do not custom-build admin components in the public-site aesthetic.

**Color:** Admin owns 8 color tokens, defined in `app/styles/admin.css` and namespaced `--admin-*` to prevent cascade collisions. They are **admin-owned constants**, not borrowed values: the public site went light at T46 and admin deliberately stayed dark, so these hex values mirror nothing and must NOT be "resynced" to the public palette. See CONSTRAINT-16.

**Brand tokens (original 4):**
- `--admin-bg` (#1C1712) — page background. Maps to shadcn `background`.
- `--admin-surface` (#252018) — raised surfaces. Maps to shadcn `card`, `popover`, `secondary`, `accent`, `muted` (background).
- `--admin-fg` (#E8E0D0) — body text. Maps to shadcn `foreground`, `card-foreground`, `popover-foreground`, `secondary-foreground`, `accent-foreground`.
- `--admin-accent` (#C9A84C) — primary action / focus. Maps to shadcn `primary`, `ring`.

**Semantic tokens (added 2026-05-12** after `@designer` + `@cto` consultation, to cover shadcn's required slots**):**
- `--admin-destructive` (#B85C3C) — maps to shadcn `destructive`.
- `--admin-destructive-fg` (#F5E8D8) — high-contrast readable text on destructive bg. Maps to shadcn `destructive-foreground`.
- `--admin-border` (#3A3328) — maps to shadcn `border`, `input`.
- `--admin-muted-fg` (#7A7060) — dates, metadata. Maps to shadcn `muted-foreground`.

**Why 8 tokens does NOT violate the verbatim rule:** the original "4 tokens only" rule existed to keep the public site's *identity elements* out of admin — the display face, hairline-driven layout grammar, the link signature. Those remain public-only. Semantic tokens for shadcn slot coverage (destructive states, borders, muted text) are mechanical chrome, not identity.

Do NOT pull typography tokens, spacing tokens, motion tokens, or any other public-site variables. The 8 colors above are the complete admin palette.

**Typography:** shadcn defaults (Inter or system font). Do NOT use the public-site signature fonts — **Instrument Serif, Space Grotesk and Space Mono** — in admin. Using them there dilutes the public site's identity.

**Anti-patterns relaxed for admin:**
- Rounded corners — allowed (shadcn defaults, typically 6–8px)
- Shadows — allowed (subtle elevation for modals, dropdowns, popovers)
- Default focus rings — allowed
- Form chrome — shadcn-styled inputs, selects, checkboxes, radios are fine
- Toasts — allowed (shadcn's `sonner` for save confirmations and errors)

**Anti-patterns still enforced:**
- No SaaS phrases ("AI-powered", "next-gen", etc.) — voice discipline applies even in single-user admin
- No emoji in admin UI labels (typographic symbols if needed, but admin doesn't need decoration)

**For `@ui` skill:** When tasks target the admin panel (`/admin/*`), use the `@ui saas` (shadcn) configuration. When tasks target the public site, use the export as the only valid source. The skill must distinguish.

**Rationale:** Admin is single-user, invisible to public visitors, and built quickly. Custom-designing CRUD chrome in the public site's "type-driven, no chrome" aesthetic blows up that scope and produces no value for an audience of one. Shadcn provides production-grade form/table conventions immediately.

---

## Open Questions for @cto

All four are resolved. Kept as stubs because other docs cite them by number.

1. **Viewport routing strategy.** ✅ **RESOLVED T46 (2026-08-04)** — moot. The two-file desktop/mobile split it was asking about no longer exists; the site is a single responsive tree with one width breakpoint at 640px (plus a height guard on `/other`, which routes nothing either), so there is nothing to route.
2. **`tweaks-panel.jsx` production strategy.** ✅ **RESOLVED 2026-05-07** — gated behind the `NEXT_PUBLIC_TWEAKS=1` env var (preview-only, never production), per architecture §5.3. A `?tweaks=1` querystring was rejected: an env var is locked at build time, so visitors cannot summon the panel on production no matter what URL they craft.
3. **Next.js migration timing.** ✅ **RESOLVED** — the site is on the Next.js App Router.
4. **Tailwind + shadcn isolation for admin.** ✅ **RESOLVED** — Tailwind is scoped so its utilities do not reach the public-site bundle, and shadcn styles load only under `/admin/*`. See `docs/architecture.md`.

---

## Source Bundle Reference

> **RETIRED T46 (2026-08-04).** This section indexed granular specs inside the original dark bundle at `docs/design-source/personal-site-web/` — its 14 color tokens, 13 typography roles, 10-step spacing scale, desktop/mobile component and page files, and its iteration chat log. That bundle is no longer the design source and nothing should be built from it. It is kept on disk only as a historical record.
>
> **Current source:** `docs/design-source/redesign-2026-08/`, with `template.extracted.html` as the readable markup. See the CANONICAL SOURCE block at the top of this file. When in doubt about any visual or interaction decision, that export is the answer.
