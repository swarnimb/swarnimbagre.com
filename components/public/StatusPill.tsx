'use client'

/* Status tint mapping. Pulled from the warm palette only. */
export function statusTint(status: string | undefined | null): { fg: string; bg: string; bd: string } {
  const s = (status || "").toLowerCase();
  if (s.startsWith("active"))    return { fg: "#A8C078", bg: "rgba(138,163,97,0.12)",  bd: "rgba(138,163,97,0.32)" };  // sage
  if (s.startsWith("dormant"))   return { fg: "#D9BB66", bg: "rgba(201,168,76,0.12)", bd: "rgba(201,168,76,0.32)" };   // gold
  if (s.startsWith("abandoned")) return { fg: "#B85C3C", bg: "rgba(184,92,60,0.12)",  bd: "rgba(184,92,60,0.30)"  };   // sienna, dim
  if (s.startsWith("shipped"))   return { fg: "#A8C078", bg: "rgba(138,163,97,0.12)",  bd: "rgba(138,163,97,0.32)" };
  return { fg: "var(--fg-muted)", bg: "transparent", bd: "var(--hairline)" };
}

interface StatusPillProps {
  status?: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  if (!status) return null;
  const c = statusTint(status);
  const fz = size === "md" ? 11 : 10.5;
  return (
    <span style={{
      font: `500 ${fz}px var(--font-mono)`,
      color: c.fg,
      background: c.bg,
      border: `1px solid ${c.bd}`,
      padding: "3px 9px",
      borderRadius: 999,
      textTransform: "uppercase",
      letterSpacing: "0.14em",
      whiteSpace: "nowrap",
      lineHeight: 1.4,
    }}>
      {status}
    </span>
  );
}
