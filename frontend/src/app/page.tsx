"use client";

import { useEffect, useRef, useState } from "react";
import CoachForm, { Profile } from "@/components/CoachForm";
import OutputPanel from "@/components/OutputPanel";
import HistoryPanel from "@/components/HistoryPanel";

function ensureUserId(): string {
  const key = "bgmi_user_id";
  const existing = document.cookie
    .split("; ")
    .find((r) => r.startsWith(`${key}=`))
    ?.split("=")[1];
  if (existing) return existing;

  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${key}=${id}; expires=${expires}; path=/; SameSite=Lax`;
  return id;
}

export default function Page() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [activeFingers, setActiveFingers] = useState(4);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    ensureUserId();
  }, []);

  async function handleGenerate(profile: Profile) {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setText("");
    setSessionId(null);
    setIsStreaming(true);
    setActiveFingers(profile.fingers);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) {
        setText("Error: failed to connect to backend.");
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const raw of parts) {
          let eventType = "";
          let dataLine = "";
          for (const line of raw.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6);
          }
          if (!dataLine) continue;

          try {
            const jsonStr = dataLine.replace(/\\n/g, "\n");
            const payload = JSON.parse(jsonStr);

            if (eventType === "message" && payload.text) {
              setText((prev) => prev + payload.text);
            } else if (eventType === "done" && payload.session_id) {
              setSessionId(payload.session_id);
              setHistoryTick((t) => t + 1);
            } else if (eventType === "error") {
              setText((prev) => prev + `\n\n[Error: ${payload.error}]`);
            }
          } catch {
            // malformed JSON chunk — skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setText("Connection error. Is the backend running?");
      }
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleRate(stars: number) {
    if (!sessionId) return;
    await fetch(`/api/rate/${sessionId}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: stars }),
    });
    setHistoryTick((t) => t + 1);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[rgba(255,106,0,0.2)] px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center gap-3">
          <span className="text-2xl font-black tracking-tight text-white">
            BGMI{" "}
            <span style={{ color: "var(--orange)" }}>PRO COACH</span>
          </span>
          <span className="ml-auto text-xs text-gray-600 font-mono">
            AI-Powered Layout Generator
          </span>
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left column */}
          <div className="flex flex-col gap-6 w-full md:w-[340px] flex-shrink-0">
            <CoachForm onGenerate={handleGenerate} isLoading={isStreaming} />
            <HistoryPanel refreshTrigger={historyTick} />
          </div>

          {/* Right column */}
          <div className="flex-1 min-w-0">
            <OutputPanel
              text={text}
              isStreaming={isStreaming}
              sessionId={sessionId}
              fingers={activeFingers}
              onRate={handleRate}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
