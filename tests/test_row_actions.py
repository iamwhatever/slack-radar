"""What a Needs-you row carries for its one-click actions, and what Ask lead sends the Lead.

* ``/needs`` rows expose ``investigation``, ``investigation_at``, ``links_count``,
  ``links``, ``status`` and ``reanalyze_in_flight``;
* ``reanalyze_prompt`` gives a row with no draft and no hand-off the explicit
  ``decide:`` ask, and leaves it off rows that have either;
* the brief names the ask.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import crew_runtime, needs, store  # noqa: E402

NOW = 1_800_000_000.0
C1 = "C0AAAAAAA"


def _item(n: int, **kw: Any) -> dict[str, Any]:
    t = NOW - n * 3600
    base = {"key": f"{C1}:{int(t)}.{n:06d}", "channel": C1, "ts_float": t, "text": f"export breaks on csv {n}",
            "summary": f"export breaks on csv {n}", "status": "triaged", "priority": "p1",
            "category": "bug-report", "handled_at": 0.0}
    base.update(kw)
    return base


def _decide(led_items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out = needs.build_needs({"items": {r["key"]: r for r in led_items}}, NOW)
    return {e["key"]: e for e in next(g for g in out["groups"] if g["id"] == "decide")["entries"]}


def test_rows_carry_the_investigation_and_its_links() -> None:
    links = [f"https://github.com/acme/app/issues/{i}" for i in range(10)]
    done = _item(1, investigation="spawn sp-1", investigation_at=NOW - 60, links=links)
    fresh = _item(2)
    rows = _decide([done, fresh])
    d = rows[done["key"]]
    assert d["investigation"] == "spawn sp-1" and d["investigation_at"] == NOW - 60
    assert d["links_count"] == 10 and d["links"] == links[: needs.LINKS_SHOWN]
    assert d["status"] == "triaged" and d["reanalyze_in_flight"] is False
    f = rows[fresh["key"]]
    assert f["investigation"] == "" and f["links_count"] == 0 and f["links"] == []


def test_cluster_rows_carry_the_lead_members_investigation() -> None:
    a = _item(1, priority="p3", investigation="spawn sp-7", status="investigating")
    b = _item(2, priority="p3", investigation="spawn sp-7", status="investigating")
    out = needs.build_needs({"items": {r["key"]: r for r in (a, b)}}, NOW)
    [cluster] = next(g for g in out["groups"] if g["id"] == "clusters")["entries"]
    assert cluster["investigation"] == "spawn sp-7" and cluster["status"] == "investigating"
    assert sorted(cluster["members"]) == sorted([a["key"], b["key"]])


def test_reanalyze_in_flight_shows_on_the_row() -> None:
    it = _item(1, reanalyze_requested_at=NOW - 30, updated_at=NOW - 40, links=["https://github.com/acme/app/issues/1"])
    assert _decide([it])[it["key"]]["reanalyze_in_flight"] is True
    it["updated_at"] = NOW - 10  # the Lead recorded the item after the ask
    assert _decide([it])[it["key"]]["reanalyze_in_flight"] is False


def test_reanalyze_prompt_asks_for_a_decision_on_rows_with_neither() -> None:
    bare = _item(1, links=["https://github.com/acme/app/issues/3"], investigation="spawn sp-1")
    drafted = _item(2, reply_draft={"text": "try 1.4", "at": NOW - 5, "by": "lead"})
    handed = _item(3, fix_handoff={"title": "Fix csv", "prompt": "p", "repo": "acme/app", "links": [], "at": NOW})
    text = crew_runtime.reanalyze_prompt([bare, drafted, handed])
    blocks = text.split("\n- key=")
    assert len(blocks) == 4
    assert "ask: decide: fix hand-off, reply draft, or close" in blocks[1]
    assert "investigation links: https://github.com/acme/app/issues/3" in blocks[1]
    assert "ask: decide" not in blocks[2] and "ask: decide" not in blocks[3]
    assert crew_runtime.REANALYZE_DECIDE_RULE in text


def test_the_brief_names_the_decide_ask() -> None:
    brief = (ROOT / "backend" / "crew_brief.md").read_text(encoding="utf-8")
    assert crew_runtime.REANALYZE_DECIDE_ASK in brief
    assert "only through the owner's Re-analyze" in " ".join(brief.split())


def test_reanalyze_items_with_no_draft_are_not_counted_stale() -> None:
    it = _item(1, links=["https://github.com/acme/app/issues/3"])
    assert not store.needs_reanalysis(it)
