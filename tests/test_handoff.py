"""Slack Radar — the fix hand-off: the Lead writes one, the owner starts or dismisses it.

Store rules, the record tool's schema, the Needs-you reason, and the owner-only
dismiss route. Routes are called directly, as in ``test_needs.py``.
"""

from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path
from typing import Any

import pytest

from test_needs import ROOT, NOW, _ctx, _Req, _route, _seed, group, item, ledger, routes  # noqa: F401

from backend import needs, store

LINK = "https://github.com/acme/widget/issues/42"


def bug(n: int = 1, **kw: Any) -> dict[str, Any]:
    base = {"category": "bug-report", "priority": "p2", "status": "investigating", "links": [LINK]}
    base.update(kw)
    return item(n, **base)


def good_prompt(it: dict[str, Any], links: list[str] | None = None) -> str:
    return (
        f"Repo acme/widget. Slack Radar item {it['key']}.\n"
        f"Links: {' '.join(links if links is not None else [LINK])}\n"
        "Coverage verdict: PARTIAL, the fix is on main but not in the release.\n"
        "Change: guard the empty list in the save path. Verify: run the save tests.\n"
        f"{store.HANDOFF_NO_MERGE}."
    )


def record(led: dict[str, Any], key: str, handoff: Any, **row: Any) -> dict[str, Any]:
    led.setdefault("crew_memory", store.empty_ledger()["crew_memory"])
    return store.apply_crew_record(led, {"items": [{"key": key, "fix_handoff": handoff, **row}]})


def handoff(it: dict[str, Any], **kw: Any) -> dict[str, Any]:
    base = {"title": "Fix the crash on save", "prompt": good_prompt(it), "repo": "acme/widget", "links": [LINK]}
    base.update(kw)
    return base


# ── store ──────────────────────────────────────────────────────────────────


def test_new_items_have_no_handoff() -> None:
    row = store.normalize_message("C0AAAAAAA", {"ts": "1727184000.000001", "text": "hi"})
    assert row is not None and row["fix_handoff"] is None


def test_valid_handoff_is_stored_and_can_be_overwritten() -> None:
    it = bug()
    led = ledger(it)
    out = record(led, it["key"], handoff(it))
    assert out["refused"] == [] and out["applied"] == [it["key"]]
    h = it["fix_handoff"]
    assert (h["title"], h["repo"], h["links"]) == ("Fix the crash on save", "acme/widget", [LINK])
    assert h["at"] > 0 and store.HANDOFF_NO_MERGE in h["prompt"]
    record(led, it["key"], handoff(it, title="Backport the fix"))
    assert it["fix_handoff"]["title"] == "Backport the fix"


def test_links_default_to_the_items_links() -> None:
    it = bug()
    h = handoff(it)
    del h["links"]
    assert record(ledger(it), it["key"], h)["refused"] == []
    assert it["fix_handoff"]["links"] == [LINK]


@pytest.mark.parametrize(
    ("row", "why"),
    [
        ({"status": "resolved"}, "status triaged or investigating"),
        ({"status": "new"}, "status triaged or investigating"),
        ({"category": "question"}, "bug-report or feature-request"),
    ],
)
def test_handoff_only_on_open_fixable_items(row: dict[str, Any], why: str) -> None:
    it = bug(**row)
    out = record(ledger(it), it["key"], handoff(it))
    assert why in out["refused"][0]["why"] and it.get("fix_handoff") is None


def test_status_set_in_the_same_row_counts() -> None:
    it = bug(status="triaged", category="")
    out = record(ledger(it), it["key"], handoff(it), category="feature-request", status="investigating")
    assert out["refused"] == [] and it["fix_handoff"] is not None


@pytest.mark.parametrize(
    ("edit", "why"),
    [
        (lambda it: "not an object", "must be an object"),
        (lambda it: handoff(it, title=""), "title must be"),
        (lambda it: handoff(it, title="x" * 121), "title must be"),
        (lambda it: handoff(it, prompt="x" * 4001), "prompt must be"),
        (lambda it: handoff(it, repo="acme"), "repo must be owner/name"),
        (lambda it: handoff(it, links=[]), "links must list"),
        (lambda it: handoff(it, links=["http://github.com/a/b/issues/1"]), "https URLs"),
        (lambda it: handoff(it, prompt=good_prompt(it) + " See /home/me/src/widget/save.py"), "filesystem path"),
        (lambda it: handoff(it, prompt=good_prompt(it) + " on build-01.corp"), "host name"),
        (lambda it: handoff(it, prompt=good_prompt(it) + " token ghp_" + "a" * 30), "credential"),
        (lambda it: handoff(it, title="Fix save in ~/widget"), "title leaves this machine"),
        (lambda it: handoff(it, prompt=good_prompt(it).replace(it["key"], "the item")), "the item key"),
        (lambda it: handoff(it, prompt=good_prompt(it, links=[])), "every link"),
        (lambda it: handoff(it, prompt=good_prompt(it).replace("Coverage", "Status")), "coverage verdict"),
        (lambda it: handoff(it, prompt=good_prompt(it).replace(store.HANDOFF_NO_MERGE, "Merge it")), "Do not merge"),
    ],
)
def test_bad_handoffs_are_refused(edit: Any, why: str) -> None:
    it = bug()
    out = record(ledger(it), it["key"], edit(it))
    assert why in out["refused"][0]["why"], out
    assert it.get("fix_handoff") is None


def test_dismiss_clears_only_the_handoff() -> None:
    it = bug(fix_handoff={"title": "t", "prompt": "p", "repo": "a/b", "links": [LINK], "at": 1.0})
    led = ledger(it)
    assert store.apply_handoff_dismiss(led, it["key"]) is it
    assert it.get("fix_handoff") is None and it["status"] == "investigating" and it["links"] == [LINK]
    assert store.apply_handoff_dismiss(led, "C0NOPE:1.000001") is None


def test_record_tool_schema_carries_fix_handoff(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    it = bug()
    _seed(tmp_path, it)
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(tmp_path))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp_handoff", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    tools = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    rec = next(t for t in tools if t["name"] == "slack_radar_record")
    props = rec["inputSchema"]["properties"]["items"]["items"]["properties"]["fix_handoff"]["properties"]
    assert set(props) == {"title", "prompt", "repo", "links"}
    assert store.HANDOFF_NO_MERGE in rec["description"]
    out = mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
        "name": "slack_radar_record", "arguments": {"items": [{"key": it["key"], "fix_handoff": handoff(it)}]},
    }})
    assert out["result"]["isError"] is False
    assert store.read_ledger(tmp_path)["items"][it["key"]]["fix_handoff"]["repo"] == "acme/widget"


# ── Needs you ──────────────────────────────────────────────────────────────


def _with_handoff(n: int, **kw: Any) -> dict[str, Any]:
    it = bug(n, **kw)
    it["fix_handoff"] = {"title": f"Fix {n}", "prompt": "p", "repo": "a/b", "links": [LINK], "at": NOW - n}
    return it


def test_handoff_is_the_first_decide_reason_and_carries_the_title() -> None:
    it = _with_handoff(1, priority="p1")
    out = needs.build_needs(ledger(it, bug(2)), NOW)
    [entry] = group(out, "decide")["entries"]
    assert (entry["reason"], entry["handoff_title"]) == (needs.HANDOFF_REASON, "Fix 1")
    assert out["handoffs_total"] == 1 and out["handoffs"][0]["handoff"]["prompt"] == "p"


def test_handled_or_closed_handoffs_leave_decide_but_stay_in_the_fold() -> None:
    done = _with_handoff(1, handled_at=NOW - 5, handled_how="ignored")
    closed = _with_handoff(2, status="resolved")
    out = needs.build_needs(ledger(done, closed), NOW)
    assert group(out, "decide")["total"] == 0
    assert [h["key"] for h in out["handoffs"]] == [done["key"], closed["key"]]
    assert out["handoffs"][0]["handled_how"] == "ignored"


def test_entry_without_handoff_has_no_title() -> None:
    out = needs.build_needs(ledger(bug(1, priority="p1")), NOW)
    assert "handoff_title" not in group(out, "decide")["entries"][0]
    assert out["handoffs"] == [] and out["handoffs_total"] == 0


# ── route ──────────────────────────────────────────────────────────────────


def test_dismiss_route_is_owner_only(routes, tmp_path: Path) -> None:
    it = _with_handoff(1)
    _seed(tmp_path, it)
    handler = _route(routes, "POST", "/items/handoff/dismiss")
    ctx = _ctx(tmp_path)
    resp = asyncio.run(handler(_Req({"key": it["key"]}, app="slack-radar", internal_auth=True), ctx))
    assert resp.status == 403 and resp.body["code"] == "owner_only"
    assert store.read_ledger(tmp_path)["items"][it["key"]]["fix_handoff"] is not None


def test_dismiss_route_clears_and_logs(routes, tmp_path: Path) -> None:
    it = _with_handoff(1)
    _seed(tmp_path, it)
    ctx = _ctx(tmp_path)
    resp = asyncio.run(_route(routes, "POST", "/items/handoff/dismiss")(_Req({"key": it["key"]}, app="slack-radar"), ctx))
    assert resp.status == 200 and resp.body["item"]["fix_handoff"] is None
    assert store.read_ledger(tmp_path)["items"][it["key"]]["fix_handoff"] is None
    assert store.read_events(tmp_path)[-1]["kind"] == "handoff"


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        (None, 400, "body_not_object"),
        ({"key": "nope"}, 400, "invalid_field"),
        ({"key": "C0AAAAAAA:1727184000.000009"}, 404, "unknown_item"),
    ],
)
def test_dismiss_route_validates(routes, tmp_path: Path, body: Any, status: int, code: str) -> None:
    resp = asyncio.run(_route(routes, "POST", "/items/handoff/dismiss")(_Req(body, app="slack-radar"), _ctx(tmp_path)))
    assert (resp.status, resp.body["code"]) == (status, code)
