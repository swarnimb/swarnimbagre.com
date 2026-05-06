// Writing — list-driven. No cards. Magazine-feeling.
// Title + date + one-line description. Type does the work.

function Writing({ onNav }) {
  const posts = [
  {
    date: "APR 2026",
    title: "Things I learned by quitting my todo app, three times",
    desc: "A short essay about systems, in which the system is mostly me."
  },
  {
    date: "FEB 2026",
    title: "On being mediocre, on purpose",
    desc: "Why I pick hobbies I'm bad at, and why everyone telling me to pick one is wrong."
  },
  {
    date: "DEC 2025",
    title: "I taught an LLM to argue with my disc golf scorecard",
    desc: "Build log. Mostly a long list of edge cases for what counts as a 'fair' birdie."
  },
  {
    date: "OCT 2025",
    title: "Personal finance, but only the next 90 minutes",
    desc: "Why most budgeting tools fail at the only question I actually ask."
  },
  {
    date: "JUL 2025",
    title: "Agents, frameworks, and the fine art of half-reading docs",
    desc: "A field report from someone who built one anyway."
  },
  {
    date: "MAY 2025",
    title: "Volleyball: a beginner's grief manual",
    desc: "I started at 28. Here is everything that hurts now."
  },
  {
    date: "FEB 2025",
    title: "Tennis, but mostly an essay about giving up",
    desc: "And then unquitting the next morning, because that's the whole bit."
  }];


  return (
    <Page>
      <Nav current="writing" onNav={onNav} />

      <header style={{ padding: "72px 0 32px", maxWidth: 720 }}>
        <h1 style={{
          font: "300 italic clamp(48px, 6vw, 72px)/1 var(--font-serif)",
          letterSpacing: "-0.025em",
          color: "var(--fg-strong)",
          margin: 0,
          fontVariationSettings: '"SOFT" 100, "WONK" 1'
        }}>Writing

        </h1>
        <p style={{
          font: "var(--body-lg)",
          color: "var(--fg-muted)",
          marginTop: 20,
          textWrap: "pretty",
          maxWidth: 540
        }}>
          Mostly essays I wrote to figure out what I think.
          Occasionally a build log. Never a thread.
        </p>
      </header>

      {/* Magazine list — wide single column. */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {posts.map((p, i) =>
        <li
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(90px, 110px) 1fr",
            gap: 32,
            padding: "26px 0",
            borderBottom: "1px solid var(--hairline)",
            alignItems: "baseline"
          }}>
          
            <div style={{
            font: "var(--meta-sm)",
            color: "var(--fg-muted)",
            letterSpacing: "0.14em"
          }}>
              {p.date}
            </div>
            <div>
              <h2 style={{
              font: "400 26px/1.25 var(--font-serif)",
              color: "var(--fg-strong)",
              letterSpacing: "-0.012em",
              margin: 0
            }}>
                <a href="#" className="link" onClick={(e) => e.preventDefault()}>
                  {p.title}
                </a>
              </h2>
              <p style={{
              font: "var(--body)",
              color: "var(--fg-muted)",
              margin: "6px 0 0",
              maxWidth: 620,
              textWrap: "pretty"
            }}>
                {p.desc}
              </p>
            </div>
          </li>
        )}
      </ul>

      <div style={{ flex: 1 }} />
      <Footer line="Last edited at an embarrassing hour." />
    </Page>);

}

window.Writing = Writing;