'use client'

import { useState, useEffect, useRef } from 'react'

interface BeforeAfterMediaProps {
  variant?: string;
}

/* Before/after — drag to compare. Two stylised scenes; no images. */
export function BeforeAfterMedia({ variant }: BeforeAfterMediaProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50); // % from left
  const onDrag = (e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const touchEvent = e as TouchEvent;
    const mouseEvent = e as MouseEvent;
    const x = (touchEvent.touches ? touchEvent.touches[0].clientX : mouseEvent.clientX) - rect.left;
    const pct = Math.max(4, Math.min(96, (x / rect.width) * 100));
    setPos(pct);
  };
  const [drag, setDrag] = useState(false);
  useEffect(() => {
    if (!drag) return;
    const move = (e: MouseEvent | TouchEvent) => onDrag(e);
    const up   = () => setDrag(false);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [drag]);

  // Two stylised "screenshots" composed as CSS scenes.
  const Before = (
    <div style={{
      position: "absolute", inset: 0,
      background: "linear-gradient(180deg, #2a231a, #1c1712)",
      padding: 16, display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#7A7060", letterSpacing: 2 }}>BEFORE · SPREADSHEET</div>
      {[0,1,2,3,4].map((i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: "60px 1fr 50px", gap: 6,
          padding: "4px 6px",
          background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
          font: "400 10px var(--font-mono)", color: "#7A7060",
          borderBottom: "1px solid #2E2820",
        }}>
          <span>{`R${i+1}`}</span>
          <span style={{ color: "#E8E0D0" }}>match {i + 11}</span>
          <span style={{ textAlign: "right" }}>{["L","L","W","L","L"][i]}</span>
        </div>
      ))}
    </div>
  );
  const After = (
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(ellipse at 70% 30%, #2a231a, #1c1712 70%)",
      padding: 18, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <div style={{ font: "500 10px var(--font-mono)", color: "#A8C078", letterSpacing: 2 }}>AFTER · APP</div>
      <div style={{ font: "400 italic 22px/1 var(--font-serif)", color: "#F4ECDC" }}>4 – 11</div>
      <div style={{ font: "400 11px/1.4 var(--font-sans)", color: "#7A7060" }}>this season, generously counted</div>
      <svg viewBox="0 0 200 50" style={{ width: "100%", marginTop: "auto" }}>
        <polyline points="0,40 30,32 60,36 90,22 120,28 150,14 180,18 200,8"
          fill="none" stroke="#C9A84C" strokeWidth="1.5"/>
      </svg>
    </div>
  );

  return (
    <div
      ref={ref}
      onMouseDown={(e) => { setDrag(true); onDrag(e); }}
      onTouchStart={(e) => { setDrag(true); onDrag(e); }}
      style={{
        position: "absolute", inset: 0, cursor: "ew-resize", userSelect: "none",
      }}
    >
      {Before}
      <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 0 0 ${pos}%)` }}>
        {After}
      </div>
      {/* Divider */}
      <div style={{
        position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 1,
        background: "var(--accent)", boxShadow: "0 0 0 3px rgba(201,168,76,0.15)",
        pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute", top: "50%", left: `${pos}%`, transform: "translate(-50%, -50%)",
        width: 26, height: 26, borderRadius: 999,
        background: "var(--bg)", border: "1px solid var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: "500 10px var(--font-mono)", color: "var(--accent)",
        pointerEvents: "none",
      }}>
        ⇆
      </div>
    </div>
  );
}
