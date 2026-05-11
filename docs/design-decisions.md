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

## Admin Panel

**Scope:** The admin panel at `/admin` follows DIFFERENT rules from the public site. The bundle's anti-patterns and component conventions do NOT apply here.

**Audience:** Single user (Swarnim). Never seen by visitors.

**Component library:** shadcn/ui with Tailwind. Use shadcn's defaults for forms, tables, modals, dropdowns, file upload UIs, and any other CRUD chrome. Do not custom-build admin components in the public-site aesthetic.

**Color continuity:** Borrow these tokens from `site/colors_and_type.css` so admin doesn't feel jarring when bouncing between admin and public site:
- Background: `--bg` (#1C1712)
- Surface: `--surface` (#252018)
- Body text: `--fg` (#E8E0D0)
- Accent / primary action: `--accent` (#C9A84C)

Apply via Tailwind theme config or CSS custom properties. Do NOT pull other tokens (typography, spacing, hairline colors) — those are public-site specific.

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
