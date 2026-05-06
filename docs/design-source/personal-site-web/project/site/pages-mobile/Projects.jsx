// ProjectsMobile — single-column stack of full-width project cards.

function ProjectsMobile({ onNav }) {
  const projects = [
    { title: "putt-or-not", status: "active",
      blurb: "Disc golf stats tracker for me and four friends. Tells us, mathematically, who is the worst.",
      demo:  { kind: "demo", variant: "rings" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }, { kind: "post", href: "#" }] },
    { title: "afford.lunch", status: "dormant",
      blurb: "A finance app that answers exactly one question — can I afford lunch — and refuses to do anything else.",
      demo:  { kind: "still" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }] },
    { title: "agentless", status: "abandoned fondly",
      blurb: "A small framework for AI agent setups. Mostly an excuse to learn what I keep half-understanding from blog posts.",
      demo:  { kind: "demo", variant: "agent" },
      links: [{ kind: "github", href: "#" }, { kind: "post", href: "#" }] },
    { title: "drumlog", status: "active",
      blurb: "Times my drum practice and roughly how loudly my neighbours have to tolerate it.",
      demo:  { kind: "demo", variant: "bars" },
      links: [{ kind: "github", href: "#" }] },
    { title: "tennis-elbow", status: "dormant",
      blurb: "Spreadsheet pretending to be an app. Tracks every match I lose and what I blame it on.",
      demo:  { kind: "before-after" },
      links: [{ kind: "live", href: "#" }, { kind: "post", href: "#" }] },
    { title: "tape.studio", status: "active",
      blurb: "Browser-only loop pedal for people who own no equipment, including me.",
      demo:  { kind: "demo", variant: "wave" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }] },
  ];

  return (
    <MobilePage>
      <MobileNav current="projects" onNav={onNav} />

      <MobilePageTitle
        title="projects"
        sub="Things I made when I should have been doing something else. A few are even useful — to me, mostly."
      />

      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        marginTop: 16,
      }}>
        {projects.map((p) => (
          <MobileProjectCard key={p.title} {...p} />
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <MobileFooter line="Made between disc golf rounds." />
    </MobilePage>
  );
}

window.ProjectsMobile = ProjectsMobile;
