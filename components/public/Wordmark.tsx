'use client'

interface WordmarkProps {
  onClick?: () => void;
}

export function Wordmark({ onClick }: WordmarkProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: 0,
        padding: 0,
        cursor: "pointer",
        font: "400 italic 28px var(--font-serif)",
        color: "var(--fg-strong)",
        letterSpacing: "-0.012em",
        fontVariationSettings: '"SOFT" 100, "WONK" 1',
      }}
    >
      Swarnim Bagre
    </button>
  );
}
