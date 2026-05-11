'use client'

interface DemoLoopProps {
  variant?: string;
}

export function DemoLoop({ variant }: DemoLoopProps) {
  // CSS-only animated scenes. One per variant, each in the warm palette.
  // Variants: "rings" (disc-golf radar), "bars" (chart climbing), "wave" (waveform), "agent" (cursor + nodes).
  const common = {
    position: "absolute" as const, inset: 0, width: "100%", height: "100%",
    display: "block",
  };
  if (variant === "bars") {
    return (
      <div style={{ ...common, background: "linear-gradient(180deg, #221d16 0%, #1c1712 100%)" }}>
        <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="bargrad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#8C7530" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#C9A84C"/>
            </linearGradient>
          </defs>
          {/* faint grid */}
          {[40, 80, 120, 160].map((y) => (
            <line key={y} x1="20" y1={y} x2="300" y2={y} stroke="#3A3328" strokeWidth="0.5"/>
          ))}
          {/* climbing bars */}
          {Array.from({ length: 14 }).map((_, i) => {
            const h = 18 + (i * 7) % 90 + (i % 3) * 8;
            return (
              <rect key={i}
                x={28 + i * 19} y={160 - h} width="10" height={h}
                fill="url(#bargrad)" rx="1">
                <animate attributeName="height"
                  values={`${h};${h + 14};${h - 6};${h}`} dur={`${3 + i * 0.13}s`} repeatCount="indefinite"/>
                <animate attributeName="y"
                  values={`${160 - h};${160 - h - 14};${160 - h + 6};${160 - h}`} dur={`${3 + i * 0.13}s`} repeatCount="indefinite"/>
              </rect>
            );
          })}
          {/* trend line */}
          <polyline points="28,140 80,118 132,124 184,96 236,84 288,58"
            fill="none" stroke="#E8E0D0" strokeWidth="1.5" strokeLinecap="round"/>
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">DRUM HOURS / WK</text>
        </svg>
      </div>
    );
  }
  if (variant === "wave") {
    return (
      <div style={{ ...common, background: "radial-gradient(ellipse at 30% 30%, #2a231a, #1c1712 70%)" }}>
        <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id="wgrad" x1="0" x2="1">
              <stop offset="0%" stopColor="#C9A84C" stopOpacity="0"/>
              <stop offset="50%" stopColor="#C9A84C"/>
              <stop offset="100%" stopColor="#C9A84C" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {Array.from({ length: 60 }).map((_, i) => {
            const x = 16 + i * 5;
            const baseH = 4 + Math.abs(Math.sin(i * 0.4)) * 50 + (i % 5) * 4;
            return (
              <rect key={i} x={x} y={90 - baseH / 2} width="2" height={baseH}
                    fill="url(#wgrad)" rx="1">
                <animate attributeName="height"
                  values={`${baseH};${baseH * 1.4};${baseH * 0.7};${baseH}`}
                  dur={`${2 + (i % 7) * 0.2}s`} repeatCount="indefinite"/>
                <animate attributeName="y"
                  values={`${90 - baseH / 2};${90 - baseH * 0.7};${90 - baseH * 0.35};${90 - baseH / 2}`}
                  dur={`${2 + (i % 7) * 0.2}s`} repeatCount="indefinite"/>
              </rect>
            );
          })}
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">REC · TAKE 04</text>
        </svg>
      </div>
    );
  }
  if (variant === "agent") {
    return (
      <div style={{ ...common, background: "linear-gradient(135deg, #221d16, #1c1712 60%)" }}>
        <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
          {/* edges */}
          <g stroke="#3A3328" strokeWidth="1" fill="none">
            <line x1="60" y1="60" x2="160" y2="40"/>
            <line x1="60" y1="60" x2="140" y2="120"/>
            <line x1="160" y1="40" x2="240" y2="80"/>
            <line x1="140" y1="120" x2="240" y2="80"/>
            <line x1="240" y1="80" x2="280" y2="140"/>
          </g>
          {/* nodes */}
          {[
            {x:60,y:60,r:6}, {x:160,y:40,r:7}, {x:140,y:120,r:5},
            {x:240,y:80,r:8}, {x:280,y:140,r:5},
          ].map((n, i) => (
            <circle key={i} cx={n.x} cy={n.y} r={n.r}
                    fill="#252018" stroke="#C9A84C" strokeWidth="1.2">
              <animate attributeName="r" values={`${n.r};${n.r + 2};${n.r}`}
                       dur={`${1.6 + i * 0.3}s`} repeatCount="indefinite"/>
            </circle>
          ))}
          {/* traveling pulse */}
          <circle r="3" fill="#C9A84C">
            <animateMotion dur="3.6s" repeatCount="indefinite"
              path="M60,60 L160,40 L240,80 L140,120 L60,60"/>
          </circle>
          <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
                fontSize="9" fill="#7A7060" letterSpacing="2">AGENT GRAPH</text>
        </svg>
      </div>
    );
  }
  // default: "rings" — disc golf radar
  return (
    <div style={{ ...common, background: "radial-gradient(circle at 50% 60%, #2a231a, #1c1712 70%)" }}>
      <svg viewBox="0 0 320 180" style={{ width: "100%", height: "100%" }}>
        {[20, 40, 60, 80].map((r, i) => (
          <circle key={r} cx="160" cy="110" r={r} fill="none"
                  stroke="#3A3328" strokeWidth="0.6" strokeDasharray="2 4">
            <animate attributeName="r"
              values={`${r};${r + 6};${r}`}
              dur={`${4 + i}s`} repeatCount="indefinite"/>
          </circle>
        ))}
        {/* basket bullseye */}
        <circle cx="160" cy="110" r="4" fill="#C9A84C"/>
        <circle cx="160" cy="110" r="10" fill="none" stroke="#C9A84C" strokeWidth="0.8"/>
        {/* discs in flight */}
        {[
          {cx:80, cy:60, d:"3.4s"},
          {cx:240, cy:140, d:"4.1s"},
          {cx:60, cy:140, d:"5.2s"},
        ].map((p, i) => (
          <g key={i}>
            <circle cx={p.cx} cy={p.cy} r="3.5" fill="#E8E0D0">
              <animateMotion dur={p.d} repeatCount="indefinite"
                path={`M0,0 Q${(160 - p.cx)*0.5},${(110 - p.cy)*0.3 - 30} ${160 - p.cx},${110 - p.cy}`}/>
              <animate attributeName="opacity"
                values="1;1;0;1" dur={p.d} repeatCount="indefinite"/>
            </circle>
          </g>
        ))}
        <text x="22" y="28" fontFamily="ui-monospace, JetBrains Mono, monospace"
              fontSize="9" fill="#7A7060" letterSpacing="2">ROUND 12 · HOLE 04</text>
      </svg>
    </div>
  );
}
