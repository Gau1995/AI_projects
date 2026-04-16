"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PhoneMockup from "./PhoneMockup";

interface Props {
  text: string;
  isStreaming: boolean;
  sessionId: string | null;
  fingers: number;
  onRate: (stars: number) => void;
}

export default function OutputPanel({ text, isStreaming, sessionId, fingers, onRate }: Props) {
  const [rated, setRated] = useState(0);
  const [hover, setHover] = useState(0);

  function handleRate(stars: number) {
    setRated(stars);
    onRate(stars);
  }

  const showRating = !isStreaming && sessionId && text.length > 0;
  const showMockup = !isStreaming && text.length > 0;

  if (!text && !isStreaming) {
    return (
      <div className="neon-card flex flex-col items-center justify-center min-h-[300px] text-center gap-3">
        <span className="text-4xl">🎮</span>
        <p className="text-gray-500 text-sm">
          Configure your setup and hit{" "}
          <span style={{ color: "var(--orange)" }}>Generate Layout</span> to get your
          personalized pro coaching.
        </p>
      </div>
    );
  }

  return (
    <div className="neon-card flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest" style={{ color: "var(--orange)" }}>
          Your Layout
        </h2>
        {isStreaming && (
          <span className="text-xs text-gray-500 animate-pulse">streaming…</span>
        )}
      </div>

      {/* Side-by-side: text + phone mockup */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Text output */}
        <div
          className={`prose-gaming text-sm leading-relaxed flex-1 min-w-0 ${
            isStreaming ? "streaming-cursor" : ""
          }`}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>

        {/* Phone mockup — shown only when streaming is done */}
        {showMockup && (
          <div className="flex-shrink-0 self-start lg:sticky lg:top-6">
            <PhoneMockup text={text} fingers={fingers} />
          </div>
        )}
      </div>

      {showRating && (
        <div className="border-t border-[rgba(255,106,0,0.15)] pt-4 flex flex-col gap-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Rate this layout</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                className="text-2xl transition-transform hover:scale-110"
                style={{
                  color:
                    star <= (hover || rated) ? "var(--orange)" : "rgba(255,255,255,0.15)",
                }}
                disabled={rated > 0}
              >
                ★
              </button>
            ))}
            {rated > 0 && (
              <span className="ml-2 text-xs text-gray-500 self-center">
                Saved! Recall optimizer will use this next time.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
