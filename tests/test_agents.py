"""Shipped agents, their prompt sources, the Thread Watcher and the hand-off skill.

Run from the app root: ``python3 -m pytest tests -q``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import crew_runtime  # noqa: E402
from scripts import build_agents  # noqa: E402

AGENTS = ROOT / "agents"
PROMPTS = AGENTS / "prompts"


def _manifest() -> dict:
    return json.loads((ROOT / "app.json").read_text(encoding="utf-8"))


def _agent_files() -> list[Path]:
    return sorted(AGENTS.glob("*.json"))


def test_every_manifest_agent_exists_and_is_named_for_its_file() -> None:
    listed = _manifest()["agents"]
    assert listed, "app.json lists no agents"
    for rel in listed:
        path = ROOT / rel
        assert path.is_file(), f"app.json lists a missing agent: {rel}"
        agent = json.loads(path.read_text(encoding="utf-8"))
        assert agent["name"] == path.stem
    assert {ROOT / rel for rel in listed} == set(_agent_files()), "an agent JSON is not in app.json"


@pytest.mark.parametrize("path", _agent_files(), ids=lambda p: p.stem)
def test_agent_prompt_matches_its_md_source(path: Path) -> None:
    source = PROMPTS / f"{path.stem}.md"
    assert source.is_file(), f"no prompt source for {path.name}"
    agent = json.loads(path.read_text(encoding="utf-8"))
    assert agent["prompt"] == build_agents.prompt_source(path.stem), (
        f"{path.name} prompt drifted from {source.name}: run python3 scripts/build_agents.py"
    )
    assert path.read_text(encoding="utf-8") == build_agents.render(agent), f"{path.name} is not in build format"


def test_every_prompt_source_has_an_agent() -> None:
    assert {p.stem for p in PROMPTS.glob("*.md")} == {p.stem for p in _agent_files()}


def test_watcher_is_a_ledger_only_leaf() -> None:
    watcher = json.loads((AGENTS / "slack-radar-watcher.json").read_text(encoding="utf-8"))
    assert watcher["model"] == "auto"
    assert watcher["tools"] == ["@slack-radar:ledger", "thinking"]
    assert watcher["allowedTools"] == ["@slack-radar:ledger"]
    banned = ("execute_bash", "shell", "fs_read", "fs_write", "grep", "glob", "use_subagent", "use_aws")
    for tool in watcher["tools"] + watcher["allowedTools"]:
        assert tool not in banned
        assert not tool.startswith("@kirocrew-core"), "no spawn or session tool"
        assert "spawn" not in tool
    prompt = watcher["prompt"]
    assert "UNTRUSTED DATA" in prompt and "PUBLIC" in prompt and "LOCAL" in prompt
    assert "clear_possibly_resolved" in prompt and '"resolved"' in prompt


def test_brief_carries_the_watcher_rule_and_the_current_marker() -> None:
    brief = (ROOT / "backend" / "crew_brief.md").read_text(encoding="utf-8")
    assert brief.splitlines()[0] == crew_runtime.BRIEF_SENTINEL == "<!-- slack-radar-crew-brief v6 -->"
    assert "slack-radar-watcher" in brief and "5 or more" in brief
    assert "Never more than one Watcher in flight" in brief


def test_handoff_skill_is_shipped_and_parses() -> None:
    manifest = _manifest()
    assert "skills/slack-radar-handoff" in manifest["skills"]
    for rel in manifest["skills"]:
        skill = ROOT / rel / "SKILL.md"
        assert skill.is_file(), f"app.json lists a missing skill: {rel}"
        text = skill.read_text(encoding="utf-8")
        assert text.startswith("---\n")
        front, _, body = text[4:].partition("\n---\n")
        fields = dict(line.split(": ", 1) for line in front.splitlines() if line.strip())
        assert fields["name"] == Path(rel).name
        description = json.loads(fields["description"])  # a quoted YAML scalar is a JSON string here
        assert "Slack" in description and "汇总" in description
        assert "/apps/slack-radar" in body


def test_brief_and_lead_prompt_carry_the_fix_handoff_rule() -> None:
    brief = (ROOT / "backend" / "crew_brief.md").read_text(encoding="utf-8")
    lead = (PROMPTS / "slack-radar-crew.md").read_text(encoding="utf-8")
    for text in (brief, lead):
        assert "fix_handoff" in text and "Do not merge; open a PR for review" in text
        assert "never session_send" in text.replace("`", "") and "crew.next" in text
    assert "5. **Hand off a fix.**" in brief and "8. **Write the ledger before ending the turn." in brief
    tools = json.loads((AGENTS / "slack-radar-crew.json").read_text(encoding="utf-8"))["tools"]
    assert "@kirocrew-core/session_send" not in tools
