'use client'

import { useState } from 'react'

interface FooterProps {
  line?: string;
}

export function Footer({ line }: FooterProps) {
  const lines = [
    "No cookies, no analytics, no idea what I'm doing.",
    "Made between disc golf rounds.",
    "Last edited at an embarrassing hour.",
    "Built mostly during things I should not have been doing.",
  ];
  // Stable choice per page mount.
  const [chosen] = useState(() => line || lines[Math.floor(Math.random() * lines.length)]);
  return (
    <footer
      style={{
        marginTop: 96,
        paddingTop: 24,
        borderTop: "1px solid var(--hairline)",
        font: "var(--meta-sm)",
        color: "var(--fg-muted)",
        textTransform: "none",       // keep the sentence cased; meta-sm uppercases by default elsewhere
        letterSpacing: "0",
        fontFamily: "var(--font-mono)",
      }}
    >
      {chosen}
    </footer>
  );
}
