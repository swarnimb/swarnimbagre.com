'use client'

// Home — fits in roughly one desktop screen.
// Hero is centered + horizontally stretched; controlled by Tweaks.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { resolveNavPath } from '@/lib/nav-targets';
import { SOCIAL_LINKS } from '@/lib/social-links';
import { Page } from '@/components/public/Page';
import { Nav } from '@/components/public/Nav';
import { SocialIcon } from '@/components/public/SocialIcon';
import { ProjectRow } from '@/components/public/ProjectRow';
import type { PublicProject } from '@/lib/public-projects';
import {
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakSlider,
  TweakText,
  TweakToggle,
  useTweaks,
} from '@/components/public/TweaksPanel';

const HOME_TWEAK_DEFAULTS = {
  "tagline":  "meet the perpetual amateur",
  "headline": "By day I help build gaming things at Alienware. By night I tinker with AI things to scratch my own itches.",
  "subhead":  "… it was supposed to be a hobby, things are getting out of hand.",
  "headlineSize": 38,
  "subheadSize":  24,
  "iconSize": 22,
  "iconGap":  22,
  "heroAlign": "center",
  "heroMaxWidth": 980,
  "showTagline": true,
  "showSubhead": true,
  "showSocials": true
};

interface HomeProps {
  /** DB-resolved projects to render in the scroller. Empty array hides the section. */
  projects?: PublicProject[];
}

export function Home({ projects = [] }: HomeProps = {}) {
  const router = useRouter();
  const onNav = useCallback((target: string) => {
    router.push(resolveNavPath(target));
  }, [router]);

  const [t, setTweak] = useTweaks(HOME_TWEAK_DEFAULTS);

  const socials = [
    { kind: "email", href: SOCIAL_LINKS.email },
    { kind: "x", href: SOCIAL_LINKS.x }, { kind: "linkedin", href: SOCIAL_LINKS.linkedin },
    { kind: "reddit", href: SOCIAL_LINKS.reddit }, { kind: "substack", href: SOCIAL_LINKS.substack }, { kind: "youtube", href: SOCIAL_LINKS.youtube },
  ];

  // Alignment-driven flex props.
  const isCenter = t.heroAlign === "center";
  const sectionAlign = isCenter ? "center" : "flex-start";
  const textAlign    = isCenter ? "center" : "left";
  const socialJustify = isCenter ? "center" : "flex-start";

  return (
    <Page>
      <Nav current="home" onNav={onNav} resolveHref={resolveNavPath} />

      {/* Hero — full-width container, contents centered (or left). */}
      <section
        style={{
          padding: "clamp(28px, 5vh, 64px) 0 clamp(20px, 3.5vh, 40px)",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: sectionAlign,
          textAlign,
        }}
      >
        {false && (
          <p
            style={{
              font: "var(--meta)",
              color: "var(--fg-muted)",
              margin: 0,
              letterSpacing: "0.16em",
              maxWidth: t.heroMaxWidth,
            }}
          >
            ※ {t.tagline}
          </p>
        )}

        <h1
          style={{
            font: `500 clamp(24px, 3.4vw, ${t.headlineSize}px)/1.22 var(--font-sans)`,
            color: "var(--fg-strong)",
            margin: 0,
            maxWidth: t.heroMaxWidth,
            letterSpacing: "-0.012em",
            textWrap: "pretty",
          }}
        >
          {t.headline}
        </h1>

        {t.showSubhead && (
          <p
            style={{
              font: `400 italic clamp(18px, 2.1vw, ${t.subheadSize}px)/1.4 var(--font-serif)`,
              color: "var(--fg-muted)",
              margin: "14px 0 0",
              maxWidth: Math.min(t.heroMaxWidth, 760),
              textWrap: "pretty",
              fontVariationSettings: '"SOFT" 100, "WONK" 1',
            }}
          >
            {t.subhead}
          </p>
        )}

        {t.showSocials && (
          <div
            style={{
              display: "flex",
              gap: t.iconGap,
              alignItems: "center",
              justifyContent: socialJustify,
              marginTop: 23,
              width: "100%",
              maxWidth: t.heroMaxWidth,
            }}
          >
            {socials.map((s) => (
              <SocialIcon key={s.kind} kind={s.kind as 'email' | 'x' | 'linkedin' | 'reddit' | 'substack' | 'youtube'} href={s.href} size={t.iconSize} />
            ))}
          </div>
        )}
      </section>

      <ProjectsScroller projects={projects} onOpen={() => onNav("projects")} />

      <div style={{ flex: 1 }} />

      {/* Tight footer for home — sits close under the fade. */}
      <footer
        style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid var(--hairline)",
          font: "var(--meta-sm)",
          color: "var(--fg-muted)",
          letterSpacing: 0,
          fontFamily: "var(--font-mono)",
        }}
      >
        No cookies, no analytics, no idea what I'm doing.
      </footer>

      {/* Tweaks panel — only renders when host activates edit mode.
          Gated by NEXT_PUBLIC_TWEAKS; statically inlined by Next.js at build
          time, so this becomes dead code in production where the var is unset. */}
      {process.env.NEXT_PUBLIC_TWEAKS === '1' && (
        <TweaksPanel title="Tweaks">
          <TweakSection label="Hero layout" />
          <TweakRadio  label="Alignment" value={t.heroAlign}
                       options={["left", "center"]}
                       onChange={(v) => setTweak("heroAlign", v)} />
          <TweakSlider label="Max width" value={t.heroMaxWidth} min={620} max={1100} step={20} unit="px"
                       onChange={(v) => setTweak("heroMaxWidth", v)} />

          <TweakSection label="Copy" />
          <TweakText   label="Tagline"   value={t.tagline}
                       onChange={(v) => setTweak("tagline", v)} />
          <TweakText   label="Headline"  value={t.headline} multiline
                       onChange={(v) => setTweak("headline", v)} />
          <TweakText   label="Sub-head"  value={t.subhead}  multiline
                       onChange={(v) => setTweak("subhead", v)} />

          <TweakSection label="Sizing" />
          <TweakSlider label="Headline size" value={t.headlineSize} min={22} max={56} unit="px"
                       onChange={(v) => setTweak("headlineSize", v)} />
          <TweakSlider label="Sub-head size" value={t.subheadSize}  min={16} max={36} unit="px"
                       onChange={(v) => setTweak("subheadSize", v)} />
          <TweakSlider label="Icon size"     value={t.iconSize}     min={14} max={32} unit="px"
                       onChange={(v) => setTweak("iconSize", v)} />
          <TweakSlider label="Icon gap"      value={t.iconGap}      min={10} max={48} unit="px"
                       onChange={(v) => setTweak("iconGap", v)} />

          <TweakSection label="Show / hide" />
          <TweakToggle label="Tagline" value={t.showTagline}
                       onChange={(v) => setTweak("showTagline", v)} />
          <TweakToggle label="Sub-head" value={t.showSubhead}
                       onChange={(v) => setTweak("showSubhead", v)} />
          <TweakToggle label="Socials"  value={t.showSocials}
                       onChange={(v) => setTweak("showSocials", v)} />
        </TweaksPanel>
      )}
    </Page>
  );
}

/* ProjectsScroller — vertically scrollable, ~3 rows visible, soft fade.  */
function ProjectsScroller({ projects, onOpen }: { projects: PublicProject[]; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const remaining = el.scrollHeight - el.clientHeight - el.scrollTop;
      setAtEnd(remaining < 24);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // ~3 rows visible; each row ~140px including its hairline.
  const visibleHeight = "clamp(380px, 44vh, 480px)";

  if (projects.length === 0) return null;

  return (
    <div style={{ position: "relative", marginTop: 14, borderTop: "1px solid var(--hairline)", paddingTop: 4, paddingBottom: 10 }}>
      <div style={{
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
        padding: "10px 0 6px",
      }}>
        ※ projects
      </div>
      <div
        ref={ref}
        className="no-scrollbar"
        style={{
          height: visibleHeight,
          overflowY: "auto",
          paddingRight: 8,
          WebkitMaskImage:
            "linear-gradient(to bottom, black 0, black calc(100% - 72px), transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, black 0, black calc(100% - 72px), transparent 100%)",
        }}
      >
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            title={p.title}
            blurb={p.description}
            progressPercent={p.progressPercent}
            githubUrl={p.githubUrl}
            liveUrl={p.liveUrl}
            postUrl={p.postUrl}
            thumbKind={p.thumbKind}
            onClick={onOpen}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0, right: 8, bottom: -22,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          opacity: atEnd ? 0 : 1,
          transition: "opacity var(--dur) var(--ease)",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5"
             strokeLinecap="round" strokeLinejoin="round"
             style={{ color: "var(--fg-faint)" }}>
          <path d="M12 5v14"/>
          <path d="M6 13l6 6 6-6"/>
        </svg>
      </div>
    </div>
  );
}
