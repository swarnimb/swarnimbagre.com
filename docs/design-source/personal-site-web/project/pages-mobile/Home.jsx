// HomeMobile — adapted hero + featured project list, no horizontal scroll.

const HOME_M_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tagline": "meet the perpetual amateur",
  "headline": "By day I help build gaming things at Alienware. By night I tinker with AI things to scratch my own itches.",
  "subhead": "… it was supposed to be a hobby, things are getting out of hand.",
  "headlineSize": 26,
  "subheadSize": 18
} /*EDITMODE-END*/;

function HomeMobile({ onNav }) {
  const [t, setTweak] = useTweaks(HOME_M_TWEAK_DEFAULTS);

  const sections = [
  { id: "projects", label: "projects", sub: "things I'm making" },
  { id: "writing", label: "writing", sub: "occasional essays" },
  { id: "other", label: "everything else", sub: "hobbies, life-things" }];


  const socials = [
  { kind: "email", href: "mailto:hello@swarnim.dev" },
  { kind: "x", href: "#" }, { kind: "linkedin", href: "#" },
  { kind: "reddit", href: "#" }, { kind: "substack", href: "#" }, { kind: "youtube", href: "#" }];


  return (
    <MobilePage>
      <MobileNav current="home" onNav={onNav} />

      {/* Hero */}
      <section style={{ padding: "20px 0 16px" }}>
        <p style={{
          font: "var(--meta)",
          color: "var(--fg-muted)",
          margin: 0,
          letterSpacing: "0.16em"
        }}>
          ※ {t.tagline}
        </p>

        <h1 style={{
          font: `500 ${t.headlineSize}px/1.3 var(--font-sans)`,
          color: "var(--fg-strong)",
          margin: "16px 0 0",
          letterSpacing: "-0.012em",
          textWrap: "pretty"
        }}>
          {t.headline}
        </h1>

        <p style={{
          font: `400 italic ${t.subheadSize}px/1.5 var(--font-serif)`,
          color: "var(--fg-muted)",
          margin: "12px 0 0",
          textWrap: "pretty",
          fontVariationSettings: '"SOFT" 100, "WONK" 1'
        }}>
          {t.subhead}
        </p>

        {/* Socials — generous gap so each tap target is easy */}
        <div style={{
          display: "flex",

          alignItems: "center",
          marginTop: 20,
          flexWrap: "wrap", margin: "20px 0px 0px", gap: "10px"
        }}>
          {socials.map((s) =>
          <span key={s.kind} style={{
            minWidth: 44, minHeight: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
              <SocialIcon kind={s.kind} href={s.href} size={22} />
            </span>
          )}
        </div>
      </section>

      {/* Section buttons — horizontal row, replaces the old projects list.
                    Drives into Projects / Writing / Everything else pages. */}
      <section style={{
        marginTop: 20,
        paddingTop: 16,
        borderTop: "1px solid var(--hairline)"
      }}>
        <div style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          overflowY: "hidden",
          paddingBottom: 6,
          margin: "0 -20px",
          padding: "2px 20px 8px",
          scrollSnapType: "x proximity"
        }} className="no-scrollbar">
          {sections.map((s) =>
          <a
            key={s.id}
            href="#"
            onClick={(e) => {e.preventDefault();onNav(s.id);}}
            style={{
              flex: "0 0 auto",
              scrollSnapAlign: "start",
              display: "inline-flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: 14,
              minWidth: 168,
              minHeight: 92,
              padding: "14px 16px",
              border: "1px solid var(--hairline)",
              borderRadius: 14,
              background: "var(--bg)",
              color: "var(--fg-strong)",
              textDecoration: "none",
              backgroundImage: "none",
              transition: "border-color var(--dur) var(--ease), color var(--dur) var(--ease)"
            }}
            onTouchStart={(e) => {e.currentTarget.style.borderColor = "var(--accent)";}}
            onTouchEnd={(e) => {e.currentTarget.style.borderColor = "var(--hairline)";}}>
            
              <span style={{
              font: "var(--meta-sm)",
              color: "var(--fg-muted)",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono)"
            }}>
                {s.sub}
              </span>
              <span style={{
              font: "500 20px/1.2 var(--font-sans)",
              letterSpacing: "-0.01em"
            }}>
                {s.label} →
              </span>
            </a>
          )}
        </div>
      </section>

      <div style={{ flex: 1 }} />
      <MobileFooter line="No cookies, no analytics, no idea what I'm doing." />

      <TweaksPanel title="Tweaks">
        <TweakSection label="Copy" />
        <TweakText label="Tagline" value={t.tagline}
        onChange={(v) => setTweak("tagline", v)} />
        <TweakText label="Headline" value={t.headline} multiline
        onChange={(v) => setTweak("headline", v)} />
        <TweakText label="Sub-head" value={t.subhead} multiline
        onChange={(v) => setTweak("subhead", v)} />

        <TweakSection label="Sizing" />
        <TweakSlider label="Headline size" value={t.headlineSize} min={20} max={36} unit="px"
        onChange={(v) => setTweak("headlineSize", v)} />
        <TweakSlider label="Sub-head size" value={t.subheadSize} min={14} max={24} unit="px"
        onChange={(v) => setTweak("subheadSize", v)} />
      </TweaksPanel>
    </MobilePage>);

}

window.HomeMobile = HomeMobile;