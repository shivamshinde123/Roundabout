"""Generate the voiceover for each scene with Microsoft's neural "Brian" voice (edge-tts),
plus word timings for the captions.

Writes public/voiceover/<id>.mp3 and src/voiceover.json ([{id, text, durationMs, words:[{text,startMs,endMs}]}]).
Run from video/:  python scripts/voiceover.py   (pip install edge-tts; needs ffprobe)
"""
import asyncio
import json
import pathlib
import subprocess

VOICE = "en-US-BrianMultilingualNeural"  # approachable, casual (same voice as the Unseencue video)
RATE = "+4%"
PITCH = "+1Hz"

SCENES = [
    ("hook", "Claude Code is fixing a bug. Codex is writing tests. Cursor is on the API. So, who's doing what, right now?"),
    ("problem", "Every agent lives in its own chat. Handoffs get lost, blockers wait for hours, and finding out what's actually done means scrolling through all of them."),
    ("reveal", "Meet Roundabout. One Kanban board for all your AI agents."),
    ("board", "Every task moves from Backlog to Done, and each card tells its story at a glance: waiting for pickup, handed off, blocked, or stalled."),
    ("connect", "Agents join over MCP, the Model Context Protocol. Paste one command, pick the projects it may use, and it's connected, with its own scoped, revocable token."),
    ("pickup", "Assign a task, and the agent picks it up on its next turn. The card glides into In Progress, and if two claims race, exactly one wins."),
    ("handoff", "Halfway through, Claude can hand the task to Codex, with what's done and what's next. Stuck? It reports a blocker, and your answer goes straight back."),
    ("review", "When the work is ready, the agent submits its result, with a link to the pull request. Review is on by default, so nothing is done until you approve it."),
    ("updates", "While they work, every reply tells agents what changed: a requested change, a new handoff, a message. They stay in sync, and they never start on their own."),
    ("clients", "And it works with the agents you already use. Claude Code, Codex, Cursor, Gemini, Copilot, ChatGPT, and over a dozen more."),
    ("trust", "Under the hood, it's one app with one set of rules. Every change is a single transaction, recorded with who made it. Tokens are hashed, and access is per project."),
    ("cta", "Roundabout. Open source, and free to try. Give your agents one place to report."),
]

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "voiceover"
OUT.mkdir(parents=True, exist_ok=True)


def duration_ms(path: pathlib.Path) -> int:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    return round(float(out) * 1000)


async def make(scene_id: str, text: str) -> dict:
    import edge_tts

    comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
    words = []
    path = OUT / f"{scene_id}.mp3"
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 10_000  # 100 ns ticks -> ms
                words.append({"text": chunk["text"], "startMs": round(start), "endMs": round(start + chunk["duration"] / 10_000)})
    return {"id": scene_id, "text": text, "durationMs": duration_ms(path), "words": words}


async def main():
    result = [await make(i, t) for i, t in SCENES]
    (ROOT / "src" / "voiceover.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    for r in result:
        tokens = len(r["text"].split())
        flag = "" if tokens == len(r["words"]) else f"  (!) {tokens} tokens vs {len(r['words'])} words"
        print(f"{r['id']:<10} {r['durationMs'] / 1000:5.2f}s  {len(r['words'])} words{flag}")
    print(f"total {sum(r['durationMs'] for r in result) / 1000:.1f}s")


asyncio.run(main())
