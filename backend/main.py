"""BGMI Pro Coach — FastAPI backend with SSE streaming and recall injection."""

import asyncio
import json
import queue
import threading
import time
from pathlib import Path

import os

import anthropic
from fastapi import Cookie, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from memory import RecallOptimizer

# ── App + CORS ────────────────────────────────────────────────────────────────

app = FastAPI(title="BGMI Pro Coach")

_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

recall = RecallOptimizer()

# ── Model auto-detect (cached) ────────────────────────────────────────────────

_MODEL: str | None = None
_PREFERRED = [
    "claude-opus-4-7",
    "anthropic--claude-4.6-opus",
    "anthropic--claude-4.5-opus",
    "anthropic--claude-4.6-sonnet",
    "anthropic--claude-4.5-sonnet",
]


def get_model() -> str:
    global _MODEL
    if _MODEL:
        return _MODEL
    client = anthropic.Anthropic()
    available = [m.id for m in client.models.list()]
    _MODEL = next((m for m in _PREFERRED if m in available), available[0])
    return _MODEL


# ── System prompt (stable — gets cache hit after first request) ───────────────

SYSTEM_PROMPT = """You are an elite BGMI (Battlegrounds Mobile India) pro coach with deep expertise in mobile controls, ergonomics, and competitive gameplay. You have coached players across all skill levels and know exactly how to craft control layouts for every device, finger count, gyroscope preference, and play style.

## Your Knowledge Base

### Device Categories
- **Small phones** (< 6"): Compact layout, buttons clustered near thumbs, less dead zone space
- **Standard phones** (6"–6.5"): Balanced layout, moderate spread possible
- **Large phones / Plus models** (6.5"+): Wide layout, full claw setups comfortable
- **Tablets**: Maximum spread, dedicated zones per finger

### Finger Configurations
- **2-finger (thumbs only)**: All controls near screen edges; fire on right, movement on left; no claw
- **3-finger**: Add one index finger; place scope or extra fire button at top-right reach zone
- **4-finger**: Two thumbs + two index fingers; scope top-left, fire/peek top-right
- **5-finger**: Add a middle finger; extra buttons (crouch, grenade) mid-screen
- **6-finger claw**: Full pro setup; every control zone optimized; requires large device

### Gyroscope Integration
- **Gyro ON**: Reduce sensitivity for fire buttons; separate scope buttons essential; lean into micro-aim advantage
- **Gyro OFF**: Heavier reliance on drag-scope; fire buttons need larger hit area; compensate with peak buttons

### Play Styles
- **Aggressive**: Fast peek buttons, quick fire placement, crouch within thumb reach, grenade accessible
- **Passive / Camping**: Comfort layout, no rushed positions, larger fire buttons, scope zoom easily reachable
- **Balanced**: Compromise between speed and comfort; moderate button sizes
- **Rush / Entry fragger**: Jump + crouch combo reachable simultaneously, fire priority, peek at index zones
- **Sniper**: Scope zoom buttons prominent, breath-hold button accessible, gyro fine-tune support

## Output Format
Always respond with a structured layout guide that includes:
1. **Profile Summary** — restate the player's setup
2. **Recommended Layout** — step-by-step button placement (position on screen + size + opacity)
3. **Sensitivity Settings** — TPP, FPP, scope sensitivities tailored to gyro preference
4. **Pro Tips** — 3–5 advanced tips specific to this exact configuration
5. **Practice Drill** — one specific drill to master this layout fast"""


# ── Schemas ───────────────────────────────────────────────────────────────────

class ProfileRequest(BaseModel):
    device: str
    fingers: int
    gyroscope: bool
    play_style: str


class RatingRequest(BaseModel):
    rating: int


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    payload = json.dumps(data).replace("\n", "\\n")
    return f"event: {event}\ndata: {payload}\n\n"


def _build_user_message(profile: ProfileRequest, recalled: list[dict]) -> str:
    gyro_text = "enabled" if profile.gyroscope else "disabled"
    msg = (
        f"Generate a complete BGMI pro control layout for:\n\n"
        f"- Device: {profile.device}\n"
        f"- Fingers: {profile.fingers}-finger setup\n"
        f"- Gyroscope: {gyro_text}\n"
        f"- Play style: {profile.play_style.title()}\n\n"
        "Provide step-by-step button positions with exact on-screen placement, "
        "recommended sizes, opacity, and all sensitivity values."
    )
    if recalled:
        snippets = []
        for r in recalled:
            preview = r["layout_text"][:400].replace("\n", " ")
            snippets.append(
                f'[Past {r["fingers"]}-finger {r["play_style"]} layout rated {r["rating"]}/5]: {preview}…'
            )
        recall_block = "\n\n".join(snippets)
        msg += (
            f"\n\n---\n**Recall context** (your top past layouts for this user — "
            f"build on what worked):\n{recall_block}"
        )
    return msg


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/api/generate")
async def generate(
    profile: ProfileRequest,
    bgmi_user_id: str | None = Cookie(default=None),
):
    user_id = bgmi_user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id cookie required")

    recalled = recall.get_top_recalled(user_id, profile.model_dump())
    user_message = _build_user_message(profile, recalled)
    model = get_model()

    # Accumulate full layout text for saving after stream completes
    layout_chunks: list[str] = []
    q: queue.Queue = queue.Queue()

    def _stream_thread():
        try:
            client = anthropic.Anthropic()
            with client.messages.stream(
                model=model,
                max_tokens=4096,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": user_message}],
            ) as stream:
                for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and event.delta.type == "text_delta"
                    ):
                        q.put(("text", event.delta.text))
            q.put(("done", None))
        except Exception as exc:
            q.put(("error", str(exc)))

    threading.Thread(target=_stream_thread, daemon=True).start()

    async def event_generator():
        while True:
            try:
                kind, value = await asyncio.to_thread(q.get, timeout=30)
            except queue.Empty:
                yield _sse("error", {"error": "stream timeout"})
                return

            if kind == "text":
                layout_chunks.append(value)
                yield _sse("message", {"text": value})
            elif kind == "done":
                layout_text = "".join(layout_chunks)
                session_id = recall.save_session(
                    user_id, profile.model_dump(), layout_text
                )
                yield _sse("done", {"done": True, "session_id": session_id})
                return
            elif kind == "error":
                yield _sse("error", {"error": value})
                return

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/sessions")
async def sessions(bgmi_user_id: str | None = Cookie(default=None)):
    user_id = bgmi_user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id cookie required")
    return recall.get_sessions(user_id)


@app.post("/api/rate/{session_id}")
async def rate(
    session_id: str,
    body: RatingRequest,
    bgmi_user_id: str | None = Cookie(default=None),
):
    user_id = bgmi_user_id
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id cookie required")
    ok = recall.rate_session(session_id, body.rating)
    if not ok:
        raise HTTPException(status_code=404, detail="session not found")
    return {"ok": True}
