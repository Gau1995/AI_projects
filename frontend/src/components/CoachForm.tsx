"use client";

import { useState } from "react";

export interface Profile {
  device: string;
  fingers: number;
  gyroscope: boolean;
  play_style: string;
}

const PLAY_STYLES = ["aggressive", "passive", "balanced", "rush", "sniper"];
const FINGER_OPTIONS = [2, 3, 4, 5, 6];

interface Props {
  onGenerate: (profile: Profile) => void;
  isLoading: boolean;
}

export default function CoachForm({ onGenerate, isLoading }: Props) {
  const [device, setDevice] = useState("iPhone 17");
  const [fingers, setFingers] = useState(4);
  const [gyroscope, setGyroscope] = useState(true);
  const [playStyle, setPlayStyle] = useState("aggressive");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onGenerate({ device, fingers, gyroscope, play_style: playStyle });
  }

  return (
    <form onSubmit={handleSubmit} className="neon-card flex flex-col gap-5">
      <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>
        Your Setup
      </h2>

      {/* Device */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Device</label>
        <input
          className="neon-input"
          value={device}
          onChange={(e) => setDevice(e.target.value)}
          placeholder="e.g. iPhone 17, Samsung S24"
          required
        />
      </div>

      {/* Fingers */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">
          Fingers — <span style={{ color: "var(--orange)" }}>{fingers}</span>
        </label>
        <div className="flex gap-2 flex-wrap">
          {FINGER_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setFingers(n)}
              className={`pill-btn ${fingers === n ? "active" : ""}`}
            >
              {n}F
            </button>
          ))}
        </div>
      </div>

      {/* Gyroscope */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Gyroscope</span>
        <button
          type="button"
          onClick={() => setGyroscope((g) => !g)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none`}
          style={{
            background: gyroscope ? "var(--orange)" : "rgba(255,255,255,0.1)",
          }}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
              gyroscope ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Play style */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-medium uppercase tracking-wider">Play Style</label>
        <div className="flex gap-2 flex-wrap">
          {PLAY_STYLES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPlayStyle(s)}
              className={`pill-btn ${playStyle === s ? "active" : ""}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <button type="submit" className="neon-btn mt-1" disabled={isLoading}>
        {isLoading ? "Generating…" : "Generate Layout"}
      </button>
    </form>
  );
}
