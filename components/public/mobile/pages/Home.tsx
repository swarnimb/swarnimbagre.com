'use client'

// HomeMobile — adapted hero + featured project list, no horizontal scroll.

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { SOCIAL_LINKS } from '@/lib/social-links';
import { MobilePage } from '@/components/public/mobile/MobilePage';
import { MobileNav } from '@/components/public/mobile/MobileNav';
import { MobileFooter } from '@/components/public/mobile/MobileFooter';
import { SocialIcon } from '@/components/public/SocialIcon';
import {
  TweaksPanel,
  TweakSection,
  TweakSlider,
  TweakText,
  useTweaks,
} from '@/components/public/TweaksPanel';

const HOME_M_TWEAK_DEFAULTS = {
  "tagline":  "meet the perpetual amateur",
  "headline": "By day I help build gaming things at Alienware. By night I tinker with AI things to scratch my own itches.",
  "subhead":  "… it was supposed to be a hobby, things are getting out of hand.",
  "headlineSize": 26,
  "subheadSize":  18
};

export function Home() {
  const router = useRouter();
  const onNav = useCallback((target: string) => {
    router.push(resolveNavPath(target));
  }, [router]);

  const [t, setTweak] = useTweaks(HOME_M_TWEAK_DEFAULTS);

  const sections = [
    { id: "projects", label: "projects",        sub: "things I've built and broken"   },
    { id: "writing",  label: "writing",         sub: "notes, rants, half-baked ideas" },
    { id: "other",    label: "everything else", sub: "the leftovers"                  },
  ];

  const socials = [
    { kind: "email", href: SOCIAL_LINKS.email },
    { kind: "x", href: SOCIAL_LINKS.x }, { kind: "linkedin", href: SOCIAL_LINKS.linkedin },
    { kind: "reddit", href: SOCIAL_LINKS.reddit }, { kind: "substack", href: SOCIAL_LINKS.substack }, { kind: "youtube", href: SOCIAL_LINKS.youtube },
  ];

  return (
    <MobilePage>
      <MobileNav current="home" onNav={onNav} resolveHref={resolveNavPath} />

      {/* Hero */}
      <section style={{ padding: "18px 0 14px" }}>
        <h1 style={{
          font: `500 ${t.headlineSize}px/1.28 var(--font-sans)`,
          color: "var(--fg-strong)",
          margin: 0,
          letterSpacing: "-0.012em",
          textWrap: "pretty",
        }}>
          {t.headline}
        </h1>

        <p style={{
          font: `400 italic ${t.subheadSize}px/1.45 var(--font-serif)`,
          color: "var(--fg-muted)",
          margin: "10px 0 0",
          textWrap: "pretty",
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}>
          {t.subhead}
        </p>

        {/* Socials — single row, snug spacing so all icons fit on one line */}
        <div style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          marginTop: 16,
          flexWrap: "nowrap",
          justifyContent: "space-between",
          maxWidth: 360,
        }}>
          {socials.map((s) => (
            <span key={s.kind} style={{
              minWidth: 40, minHeight: 40,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <SocialIcon kind={s.kind as 'email' | 'x' | 'linkedin' | 'reddit' | 'substack' | 'youtube'} href={s.href} size={20} />
            </span>
          ))}
        </div>
      </section>

      {/* Section buttons — vertical list. Drives into the three pages. */}
      <section style={{
        marginTop: 14,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        {sections.map((s) => (
          <a
            key={s.id}
            href={resolveNavPath(s.id)}
            onClick={(e) => { e.preventDefault(); onNav(s.id); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              minHeight: 50,
              padding: "11px 16px",
              border: "1px solid var(--hairline)",
              borderRadius: 12,
              background: "var(--bg)",
              color: "var(--fg-strong)",
              textDecoration: "none",
              backgroundImage: "none",
              transition: "border-color var(--dur) var(--ease), color var(--dur) var(--ease)",
            }}
            onTouchStart={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onTouchEnd={(e) => { e.currentTarget.style.borderColor = "var(--hairline)"; }}
          >
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{
                font: "500 18px/1.2 var(--font-sans)",
                letterSpacing: "-0.01em",
              }}>
                {s.label}
              </span>
              <span style={{
                font: "400 italic 13px/1.3 var(--font-serif)",
                color: "var(--fg-muted)",
                fontVariationSettings: '"SOFT" 100, "WONK" 1',
              }}>
                {s.sub}
              </span>
            </span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2.4"
                 strokeLinecap="round" strokeLinejoin="round"
                 style={{ color: "var(--fg-muted)", flex: "0 0 auto" }}
                 aria-hidden="true">
              <path d="M7 17 17 7"/>
              <path d="M9 7h8v8"/>
            </svg>
          </a>
        ))}
      </section>

      <div style={{ flex: 1 }} />
      <MobileFooter line="No cookies, no analytics, no idea what I'm doing." />

      {/* Tweaks panel — only renders when host activates edit mode.
          Gated by NEXT_PUBLIC_TWEAKS; statically inlined by Next.js at build
          time, so this becomes dead code in production where the var is unset. */}
      {process.env.NEXT_PUBLIC_TWEAKS === '1' && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Copy" />
          <TweakText  label="Tagline"  value={t.tagline}
                      onChange={(v) => setTweak("tagline", v)} />
          <TweakText  label="Headline" value={t.headline} multiline
                      onChange={(v) => setTweak("headline", v)} />
          <TweakText  label="Sub-head" value={t.subhead}  multiline
                      onChange={(v) => setTweak("subhead", v)} />

          <TweakSection label="Sizing" />
          <TweakSlider label="Headline size" value={t.headlineSize} min={20} max={36} unit="px"
                       onChange={(v) => setTweak("headlineSize", v)} />
          <TweakSlider label="Sub-head size" value={t.subheadSize}  min={14} max={24} unit="px"
                       onChange={(v) => setTweak("subheadSize", v)} />
        </TweaksPanel>
      )}
    </MobilePage>
  );
}
