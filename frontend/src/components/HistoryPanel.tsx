"use client";

import { useEffect, useState } from "react";

interface Session {
  id: string;
  device: string;
  fingers: number;
  gyroscope: number;
  play_style: string;
  rating: number | null;
  created_at: number;
}

interface Props {
  refreshTrigger: number;
}

export default function HistoryPanel({ refreshTrigger }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    fetch("/api/sessions", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSessions(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, [refreshTrigger]);

  if (sessions.length === 0) return null;

  return (
    <div className="neon-card flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>
        Past Sessions
      </h2>
      <div className="flex flex-col gap-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="rounded-lg border border-[rgba(255,106,0,0.1)] p-3 flex flex-col gap-1.5 bg-[rgba(255,255,255,0.02)]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-medium text-white truncate">{s.device}</span>
              {s.rating && (
                <span className="text-xs shrink-0" style={{ color: "var(--orange)" }}>
                  {"★".repeat(s.rating)}
                  <span style={{ color: "rgba(255,255,255,0.1)" }}>
                    {"★".repeat(5 - s.rating)}
                  </span>
                </span>
              )}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Tag>{s.fingers}F</Tag>
              <Tag>{s.gyroscope ? "Gyro ON" : "Gyro OFF"}</Tag>
              <Tag>{s.play_style}</Tag>
            </div>
            <span className="text-[10px] text-gray-600">
              {new Date(s.created_at * 1000).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[rgba(255,106,0,0.2)] text-gray-400">
      {children}
    </span>
  );
}
