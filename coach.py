#!/usr/bin/env python3
"""BGMI Pro Coach Agent — generates personalized control layouts via Claude."""

import json
import sys
from pathlib import Path
import anthropic

# ── Constants ────────────────────────────────────────────────────────────────

INPUT_FILE = Path(__file__).parent / "input.json"

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


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_input(path: Path) -> dict:
    """Load and validate input.json."""
    if not path.exists():
        print(f"[error] {path} not found. Creating sample …")
        sample = {
            "device": "Samsung Galaxy S23",
            "fingers": 4,
            "gyroscope": True,
            "play_style": "aggressive",
        }
        path.write_text(json.dumps(sample, indent=2))
        return sample

    raw = json.loads(path.read_text())

    required = {"device", "fingers", "gyroscope", "play_style"}
    missing = required - raw.keys()
    if missing:
        print(f"[error] Missing fields in input.json: {missing}")
        sys.exit(1)

    return raw


def build_user_prompt(profile: dict) -> str:
    gyro_text = "enabled" if profile["gyroscope"] else "disabled"
    return (
        f"Generate a complete BGMI pro control layout for:\n\n"
        f"- Device: {profile['device']}\n"
        f"- Fingers: {profile['fingers']}-finger setup\n"
        f"- Gyroscope: {gyro_text}\n"
        f"- Play style: {profile['play_style'].title()}\n\n"
        "Provide step-by-step button positions with exact on-screen placement, "
        "recommended sizes, opacity, and all sensitivity values."
    )


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    profile = load_input(INPUT_FILE)

    print("╔══════════════════════════════════════════╗")
    print("║         BGMI PRO COACH  🎮               ║")
    print("╚══════════════════════════════════════════╝\n")
    print(f"Device       : {profile['device']}")
    print(f"Fingers      : {profile['fingers']}")
    print(f"Gyroscope    : {'ON' if profile['gyroscope'] else 'OFF'}")
    print(f"Play style   : {profile['play_style'].title()}")
    print("\n" + "─" * 50)
    print("Generating your personalised layout …\n")

    client = anthropic.Anthropic()

    # Detect best available model; fall back gracefully
    available = [m.id for m in client.models.list()]
    preferred = [
        "claude-opus-4-7",
        "anthropic--claude-4.6-opus",
        "anthropic--claude-4.5-opus",
        "anthropic--claude-4.6-sonnet",
        "anthropic--claude-4.5-sonnet",
    ]
    model = next((m for m in preferred if m in available), available[0])

    # Prompt caching on the large system prompt (stable prefix)
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
        messages=[
            {"role": "user", "content": build_user_prompt(profile)}
        ],
    ) as stream:
        in_thinking = False
        for event in stream:
            if event.type == "content_block_start":
                if event.content_block.type == "thinking":
                    in_thinking = True
                    print("[Analysing setup …]", flush=True)
                elif event.content_block.type == "text":
                    if in_thinking:
                        print()  # blank line after thinking indicator
                    in_thinking = False
            elif event.type == "content_block_delta":
                if event.delta.type == "text_delta":
                    print(event.delta.text, end="", flush=True)

    final = stream.get_final_message()
    usage = final.usage
    print(f"\n\n{'─' * 50}")
    print(f"Tokens — input: {usage.input_tokens} | output: {usage.output_tokens}"
          f" | cache_read: {usage.cache_read_input_tokens}"
          f" | cache_write: {usage.cache_creation_input_tokens}")


if __name__ == "__main__":
    main()
