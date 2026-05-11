'use client'

interface StillMediaProps {
  variant?: string;
}

/* Static composed scene — for the one card without animation. */
export function StillMedia({ variant }: StillMediaProps) {
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "linear-gradient(135deg, #2a231a, #1c1712 70%)",
      padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#7A7060", letterSpacing: 2 }}>
        afford.lunch / today
      </div>
      <div style={{ font: "400 italic 36px/1 var(--font-serif)", color: "#F4ECDC", textAlign: "center" }}>
        yes.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", font: "var(--meta-sm)", color: "#7A7060", letterSpacing: 1 }}>
        <span>budget — ₹720</span>
        <span style={{ color: "#A8C078" }}>spend — ₹260</span>
      </div>
    </div>
  );
}
