#!/usr/bin/env python3
"""Copy each agent's prompt from agents/prompts/<name>.md into agents/<name>.json.

The .md files are the source; the JSON "prompt" is generated. Run from anywhere:
``python3 scripts/build_agents.py``. Exits 1 when a .md source has no JSON agent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENTS = ROOT / "agents"
PROMPTS = AGENTS / "prompts"


def prompt_source(name: str) -> str:
    return (PROMPTS / f"{name}.md").read_text(encoding="utf-8").rstrip("\n")


def render(agent: dict) -> str:
    return json.dumps(agent, indent=2, ensure_ascii=False) + "\n"


def main() -> int:
    missing = 0
    for md in sorted(PROMPTS.glob("*.md")):
        target = AGENTS / f"{md.stem}.json"
        if not target.is_file():
            print(f"no agent JSON for prompt {md.name}", file=sys.stderr)
            missing += 1
            continue
        agent = json.loads(target.read_text(encoding="utf-8"))
        agent["prompt"] = prompt_source(md.stem)
        text = render(agent)
        if target.read_text(encoding="utf-8") != text:
            target.write_text(text, encoding="utf-8")
            print(f"updated {target.relative_to(ROOT)}")
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
