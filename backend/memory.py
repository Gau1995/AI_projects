"""RecallOptimizer — SQLite-backed session memory for BGMI Pro Coach."""

import sqlite3
import uuid
import time
from pathlib import Path

DB_PATH = Path(__file__).parent / "recall.db"

_DDL = """
CREATE TABLE IF NOT EXISTS sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    device      TEXT NOT NULL,
    fingers     INTEGER NOT NULL,
    gyroscope   INTEGER NOT NULL,
    play_style  TEXT NOT NULL,
    layout_text TEXT NOT NULL,
    rating      INTEGER DEFAULT NULL,
    created_at  REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user ON sessions (user_id, created_at DESC);
"""


class RecallOptimizer:
    def __init__(self, db_path: Path = DB_PATH) -> None:
        self._db = db_path
        with self._conn() as conn:
            conn.executescript(_DDL)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db)
        conn.row_factory = sqlite3.Row
        return conn

    # ── Write ────────────────────────────────────────────────────────────────

    def save_session(self, user_id: str, profile: dict, layout_text: str) -> str:
        session_id = str(uuid.uuid4())
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO sessions "
                "(id, user_id, device, fingers, gyroscope, play_style, layout_text, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    session_id,
                    user_id,
                    profile["device"],
                    int(profile["fingers"]),
                    int(bool(profile["gyroscope"])),
                    profile["play_style"].lower(),
                    layout_text,
                    time.time(),
                ),
            )
        return session_id

    def rate_session(self, session_id: str, rating: int) -> bool:
        """Set 1-5 star rating. Returns True if row was found."""
        rating = max(1, min(5, int(rating)))
        with self._conn() as conn:
            cur = conn.execute(
                "UPDATE sessions SET rating = ? WHERE id = ?", (rating, session_id)
            )
        return cur.rowcount > 0

    # ── Read ─────────────────────────────────────────────────────────────────

    def get_top_recalled(self, user_id: str, profile: dict, top_n: int = 2) -> list[dict]:
        """
        Rank past rated sessions by similarity × quality.
        Score = (fingers_match×3 + style_match×2 + gyro_match×1) × rating
        Only rated sessions are eligible.
        """
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM sessions "
                "WHERE user_id = ? AND rating IS NOT NULL "
                "ORDER BY created_at DESC LIMIT 100",
                (user_id,),
            ).fetchall()

        target_fingers = int(profile["fingers"])
        target_gyro = int(bool(profile["gyroscope"]))
        target_style = profile["play_style"].lower()

        scored = []
        for row in rows:
            similarity = (
                (3 if row["fingers"] == target_fingers else 0)
                + (2 if row["play_style"] == target_style else 0)
                + (1 if row["gyroscope"] == target_gyro else 0)
            )
            score = similarity * row["rating"]
            if score > 0:
                scored.append((score, dict(row)))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [r for _, r in scored[:top_n]]

    def get_sessions(self, user_id: str, limit: int = 20) -> list[dict]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, device, fingers, gyroscope, play_style, rating, created_at "
                "FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]
