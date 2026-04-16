"use client";

import { useMemo } from "react";

interface Button {
  label: string;
  x: number; // 0–100 %
  y: number; // 0–100 %
  color: string;
  size: number; // radius px
}

// Known BGMI buttons with their default screen zones.
// We parse the layout text to override positions when explicit coords appear.
const BASE_BUTTONS: Button[] = [
  { label: "Move",    x: 14, y: 72, color: "#FF6A00", size: 28 },
  { label: "Jump",    x: 82, y: 62, color: "#FF6A00", size: 14 },
  { label: "Crouch",  x: 88, y: 72, color: "#4a9eff", size: 13 },
  { label: "Fire",    x: 78, y: 74, color: "#ff3c3c", size: 18 },
  { label: "Scope",   x: 18, y: 30, color: "#a3ff6a", size: 13 },
  { label: "Peek L",  x: 26, y: 58, color: "#ffd234", size: 12 },
  { label: "Peek R",  x: 72, y: 58, color: "#ffd234", size: 12 },
  { label: "Grenade", x: 58, y: 22, color: "#ff8c42", size: 11 },
  { label: "Map",     x: 90, y: 12, color: "#888",    size: 10 },
  { label: "Prone",   x: 88, y: 82, color: "#4a9eff", size: 11 },
];

// Finger-count overlays: which buttons appear at which finger count
const FINGER_VISIBILITY: Record<number, string[]> = {
  2: ["Move", "Fire", "Jump", "Scope", "Map"],
  3: ["Move", "Fire", "Jump", "Scope", "Map", "Peek R"],
  4: ["Move", "Fire", "Jump", "Scope", "Map", "Peek L", "Peek R", "Crouch"],
  5: ["Move", "Fire", "Jump", "Scope", "Map", "Peek L", "Peek R", "Crouch", "Grenade"],
  6: ["Move", "Fire", "Jump", "Scope", "Map", "Peek L", "Peek R", "Crouch", "Grenade", "Prone"],
};

function parseButtonsFromText(text: string, fingers: number): Button[] {
  const visible = new Set(FINGER_VISIBILITY[fingers] ?? FINGER_VISIBILITY[4]);
  return BASE_BUTTONS.filter((b) => visible.has(b.label)).map((b) => {
    // Try to extract position hints like "top-left", "bottom-right", percentages
    const lowerText = text.toLowerCase();
    const labelLower = b.label.toLowerCase();
    const idx = lowerText.indexOf(labelLower);
    let { x, y } = b;
    if (idx !== -1) {
      const snippet = lowerText.slice(idx, idx + 120);
      if (snippet.includes("top-left") || snippet.includes("upper left"))   { x = 15; y = 20; }
      else if (snippet.includes("top-right") || snippet.includes("upper right")) { x = 85; y = 20; }
      else if (snippet.includes("bottom-left") || snippet.includes("lower left")) { x = 15; y = 80; }
      else if (snippet.includes("bottom-right") || snippet.includes("lower right")) { x = 85; y = 80; }
      else if (snippet.includes("center"))   { x = 50; y = 50; }
      else if (snippet.includes("mid-left")) { x = 20; y = 55; }
      else if (snippet.includes("mid-right")) { x = 80; y = 55; }
    }
    return { ...b, x, y };
  });
}

interface Props {
  text: string;
  fingers: number;
}

export default function PhoneMockup({ text, fingers }: Props) {
  const buttons = useMemo(() => parseButtonsFromText(text, fingers), [text, fingers]);

  // SVG viewport: 220 × 420  (portrait phone ratio ~9:19)
  const W = 220;
  const H = 420;
  const R = 18; // corner radius

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>
        Control Map
      </p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,106,0,0.3)", boxShadow: "0 0 20px rgba(255,106,0,0.15)" }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
          {/* Phone body */}
          <rect x={0} y={0} width={W} height={H} rx={R} fill="#0a0a0a" />

          {/* Screen bezel */}
          <rect x={4} y={4} width={W - 8} height={H - 8} rx={R - 2} fill="#0D0D0D" />

          {/* Hex grid background — matches CSS */}
          <defs>
            <pattern id="hex" x={0} y={0} width={28} height={50} patternUnits="userSpaceOnUse">
              <path
                d="M14 0 L28 8 L28 25 L14 33 L0 25 L0 8 Z"
                fill="none"
                stroke="rgba(255,106,0,0.06)"
                strokeWidth="0.8"
              />
              <path
                d="M14 25 L28 33 L28 50 L14 58 L0 50 L0 33 Z"
                fill="none"
                stroke="rgba(255,106,0,0.06)"
                strokeWidth="0.8"
              />
            </pattern>
          </defs>
          <rect x={4} y={4} width={W - 8} height={H - 8} rx={R - 2} fill="url(#hex)" />

          {/* Notch */}
          <rect x={W / 2 - 20} y={6} width={40} height={8} rx={4} fill="#1a1a1a" />

          {/* D-pad hint circle for move joystick */}
          {buttons.find((b) => b.label === "Move") && (() => {
            const mv = buttons.find((b) => b.label === "Move")!;
            const cx = (mv.x / 100) * W;
            const cy = (mv.y / 100) * H;
            return (
              <circle
                cx={cx}
                cy={cy}
                r={mv.size + 10}
                fill="rgba(255,106,0,0.06)"
                stroke="rgba(255,106,0,0.18)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            );
          })()}

          {/* Buttons */}
          {buttons.map((btn) => {
            const cx = (btn.x / 100) * W;
            const cy = (btn.y / 100) * H;
            const isMove = btn.label === "Move";
            return (
              <g key={btn.label}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={btn.size}
                  fill={isMove ? "rgba(255,106,0,0.15)" : `${btn.color}22`}
                  stroke={btn.color}
                  strokeWidth={isMove ? 2 : 1.2}
                />
                <text
                  x={cx}
                  y={cy + (btn.size > 15 ? 4 : 3.5)}
                  textAnchor="middle"
                  fill={btn.color}
                  fontSize={btn.size > 15 ? 7 : 6}
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  {isMove ? "MOVE" : btn.label}
                </text>
              </g>
            );
          })}

          {/* Finger count badge */}
          <rect x={W - 36} y={H - 26} width={30} height={18} rx={4} fill="rgba(255,106,0,0.15)" stroke="rgba(255,106,0,0.4)" strokeWidth="0.8" />
          <text x={W - 21} y={H - 13} textAnchor="middle" fill="#FF6A00" fontSize={9} fontWeight="700" fontFamily="system-ui">
            {fingers}F
          </text>

          {/* Home bar */}
          <rect x={W / 2 - 24} y={H - 10} width={48} height={4} rx={2} fill="#333" />
        </svg>
      </div>
      <p className="text-[10px] text-gray-600 text-center max-w-[200px]">
        Approximate zones — exact positions in the layout guide above
      </p>
    </div>
  );
}
