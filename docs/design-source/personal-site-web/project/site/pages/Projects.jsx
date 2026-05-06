// Projects — premium 2-column card grid.
// Each card: media (always-playing demo / before-after / still) +
// title + status pill + 1-line blurb + links. No date.

function Projects({ onNav }) {
  const projects = [
    {
      title: "putt-or-not",
      status: "active",
      blurb: "Disc golf stats tracker for me and four friends. Tells us, mathematically, who is the worst.",
      demo:  { kind: "demo", variant: "rings" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }, { kind: "post", href: "#" }],
    },
    {
      title: "afford.lunch",
      status: "dormant",
      blurb: "A finance app that answers exactly one question — can I afford lunch — and refuses to do anything else.",
      demo:  { kind: "still" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }],
    },
    {
      title: "agentless",
      status: "abandoned fondly",
      blurb: "A small framework for AI agent setups. Mostly an excuse to learn what I keep half-understanding from blog posts.",
      demo:  { kind: "demo", variant: "agent" },
      links: [{ kind: "github", href: "#" }, { kind: "post", href: "#" }],
    },
    {
      title: "drumlog",
      status: "active",
      blurb: "Times my drum practice and roughly how loudly my neighbours have to tolerate it. Chart goes up; talent does not.",
      demo:  { kind: "demo", variant: "bars" },
      links: [{ kind: "github", href: "#" }],
    },
    {
      title: "tennis-elbow",
      status: "dormant",
      blurb: "Spreadsheet pretending to be an app. Tracks every match I lose and what I blame it on.",
      demo:  { kind: "before-after" },
      links: [{ kind: "live", href: "#" }, { kind: "post", href: "#" }],
    },
    {
      title: "tape.studio",
      status: "active",
      blurb: "Browser-only loop pedal for people who own no equipment, including me.",
      demo:  { kind: "demo", variant: "wave" },
      links: [{ kind: "github", href: "#" }, { kind: "live", href: "#" }],
    },
  ];

  return (
    <Page>
      <Nav current="projects" onNav={onNav} />

      <header style={{ padding: "72px 0 24px", maxWidth: 720 }}>
        <h1 style={{
          font: "300 italic clamp(48px, 6vw, 72px)/1 var(--font-serif)",
          letterSpacing: "-0.025em",
          color: "var(--fg-strong)",
          margin: 0,
          fontVariationSettings: '"SOFT" 100, "WONK" 1',
        }}>
          projects
        </h1>
        <p style={{
          font: "var(--body-lg)",
          color: "var(--fg-muted)",
          marginTop: 20,
          textWrap: "pretty",
          maxWidth: 540,
        }}>
          Things I made when I should have been doing something else.
          A few are even useful — to me, mostly.
        </p>
      </header>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 24,
        marginTop: 24,
      }}>
        {projects.map((p) => (
          <ProjectCard key={p.title} {...p} />
        ))}
      </div>

      <div style={{ flex: 1 }} />
      <Footer line="Made between disc golf rounds." />
    </Page>
  );
}

window.Projects = Projects;
