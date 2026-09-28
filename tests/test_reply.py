"""Slack Radar — one-click reply: the Lead drafts, the owner sends to the thread.

Store rules for ``reply_draft``, the record tool's schema, the Needs-you reason, the
owner-only draft and send routes (called directly, as in ``test_needs.py``), and the
guard that keeps ``post_message`` out of every path but the send route.
"""

from __future__ import annotations

import asyncio
import importlib.util
from pathlib import Path
from typing import Any

import pytest

from test_needs import C1, C2, NOW, ROOT, _ctx, _Req, _route, _seed, group, item, ledger, routes  # noqa: F401
from test_slack_radar import FakeMcp

from backend import needs, slack_mcp, store
from backend import settings as settings_mod
from backend.slack_mcp import McpTransportError, NeedsLogin, ToolNotAllowed

ISSUE = "https://github.com/acme/widget/issues/42"
DRAFT = f"Thanks for the report. This is tracked in {ISSUE}; no fix is released yet."


def open_item(n: int = 1, **kw: Any) -> dict[str, Any]:
    it = item(n, **{"category": "question", "status": "triaged", **kw})
    it["ts"] = it["key"].split(":", 1)[1]
    it["thread_ts"] = it["ts"]
    return it


def record(led: dict[str, Any], key: str, draft: Any, **row: Any) -> dict[str, Any]:
    led.setdefault("crew_memory", store.empty_ledger()["crew_memory"])
    return store.apply_crew_record(led, {"items": [{"key": key, "reply_draft": draft, **row}]})


# ── store: the Lead's draft ────────────────────────────────────────────────


def test_lead_draft_is_stored_local_with_its_author() -> None:
    it = open_item()
    led = ledger(it)
    out = record(led, it["key"], {"text": f"  {DRAFT}  "})
    assert out["refused"] == []
    assert it["reply_draft"]["text"] == DRAFT and it["reply_draft"]["by"] == "lead" and it["reply_draft"]["at"] > 0
    assert store.has_reply_draft(it)
    assert record(led, it["key"], None)["refused"] == [] and it["reply_draft"] is None


@pytest.mark.parametrize(
    ("draft", "why"),
    [
        ({"text": ""}, "non-empty"),
        ({"text": "x" * (store.MAX_REPLY_DRAFT + 1)}, "at most"),
        ({"text": "Logs are in /home/alice/app/logs"}, "filesystem path"),
        ({"text": "Try http://build-7.corp for now"}, "host name"),
        ({"text": "Same as the report in C0BBBBBBB yesterday"}, "another channel"),
        ({"text": "Someone said: the export button crashes when the sheet is very large today"}, "another channel"),
    ],
)
def test_bad_lead_drafts_are_refused(draft: Any, why: str) -> None:
    it = open_item()
    other = item(9, channel=C2, text="the export button crashes when the sheet is very large today")
    led = ledger(it, other)
    out = record(led, it["key"], draft)
    assert out["refused"] and why in out["refused"][0]["why"]
    assert not store.has_reply_draft(it)


def test_own_channel_may_be_named_and_quoted() -> None:
    it = open_item(text="the export button crashes when the sheet is very large today")
    led = ledger(it)
    out = record(led, it["key"], {"text": f"About {C1}: the export button crashes when the sheet is very large today, see {ISSUE}"})
    assert out["refused"] == []


@pytest.mark.parametrize("status", ["resolved", "noise"])
def test_draft_only_on_open_items(status: str) -> None:
    it = open_item(status=status)
    out = record(ledger(it), it["key"], {"text": DRAFT})
    assert "open item" in out["refused"][0]["why"] and not store.has_reply_draft(it)


def test_lead_cannot_write_the_sent_record() -> None:
    it = open_item()
    record(ledger(it), it["key"], {"text": DRAFT}, replied={"ts": "1.1", "text": "x"})
    assert "replied" not in it


def test_owner_edit_saves_as_owner_and_skips_the_public_check() -> None:
    it = open_item()
    led = ledger(it)
    got, why = store.apply_reply_draft_edit(led, it["key"], "Look in /opt/app/logs, I will check tomorrow")
    assert (got, why) == (it, "") and it["reply_draft"]["by"] == "owner"
    _, why = store.apply_reply_draft_edit(led, it["key"], "   ")
    assert "non-empty" in why and it["reply_draft"]["by"] == "owner"
    assert store.apply_reply_draft_edit(led, "C0NOPE0000:1.000001", "x") == (None, "")


def test_record_tool_schema_carries_reply_draft(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    it = open_item()
    _seed(tmp_path, it)
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(tmp_path))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp_reply", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    tools = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    rec = next(t for t in tools if t["name"] == "slack_radar_record")
    props = rec["inputSchema"]["properties"]["items"]["items"]["properties"]["reply_draft"]["properties"]
    assert set(props) == {"text"} and "owner sends it" in rec["description"]
    out = mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
        "name": "slack_radar_record", "arguments": {"items": [{"key": it["key"], "reply_draft": {"text": DRAFT}}]},
    }})
    assert out["result"]["isError"] is False
    assert store.read_ledger(tmp_path)["items"][it["key"]]["reply_draft"]["text"] == DRAFT


# ── the crew and the poller can never post ─────────────────────────────────


def test_call_still_refuses_post_message() -> None:
    fake = FakeMcp()
    with pytest.raises(ToolNotAllowed):
        fake.call("post_message", {"channelId": C1, "text": "hi"})
    assert fake.calls == []
    assert slack_mcp.WRITE_TOOLS == {"post_message"} and not (slack_mcp.WRITE_TOOLS & slack_mcp.READ_TOOLS)


def test_post_reply_checks_its_arguments_before_the_process() -> None:
    fake = FakeMcp()
    for args in [("general", "1727184000.000001", "hi"), (C1, "", "hi"), (C1, "1727184000.000001", " "),
                 (C1, "1727184000.000001", "x" * (slack_mcp.MAX_REPLY_CHARS + 1))]:
        with pytest.raises(ToolNotAllowed):
            fake.post_reply(*args)
    assert fake.calls == []


def test_crew_mcp_server_and_poller_have_no_post_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    for rel in ("backend/mcp_server.py", "backend/watch.py", "backend/crew_runtime.py"):
        src = (ROOT / rel).read_text(encoding="utf-8")
        assert "post_reply" not in src and "post_message" not in src, rel
    mcp_src = (ROOT / "backend" / "mcp_server.py").read_text(encoding="utf-8")
    assert "slack_mcp" not in mcp_src
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(tmp_path))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp_nopost", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    names = {t["name"] for t in mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]}
    assert names == {"slack_radar_read", "slack_radar_record", "slack_radar_digest", "slack_radar_request_digest"}


# ── Needs you ──────────────────────────────────────────────────────────────


def _drafted(n: int, **kw: Any) -> dict[str, Any]:
    it = open_item(n, **kw)
    it["reply_draft"] = {"text": f"draft {n}", "at": NOW, "by": "lead"}
    return it


def test_reply_draft_is_a_decide_reason_below_the_handoff() -> None:
    it = _drafted(1)
    both = _drafted(2, category="bug-report", status="investigating")
    both["fix_handoff"] = {"title": "Fix 2", "prompt": "p", "repo": "a/b", "links": [ISSUE], "at": NOW}
    out = needs.build_needs(ledger(it, both), NOW)
    rows = {e["key"]: e for e in group(out, "decide")["entries"]}
    assert rows[it["key"]]["reason"] == needs.REPLY_REASON == "Reply ready to send"
    assert rows[it["key"]]["reply_draft"] == "draft 1"
    assert rows[both["key"]]["reason"] == needs.HANDOFF_REASON


def test_replied_fold_lists_sent_replies_newest_first() -> None:
    a, b = open_item(1), open_item(2)
    a["replied"] = {"ts": "1.1", "at": NOW - 10, "text": "old", "permalink": "https://x/1"}
    b["replied"] = {"ts": "1.2", "at": NOW, "text": "new", "permalink": "https://x/2"}
    out = needs.build_needs(ledger(a, b, open_item(3)), NOW)
    assert out["replied_total"] == 2 and [r["text"] for r in out["replied"]] == ["new", "old"]
    assert out["replied"][0]["permalink"] == "https://x/2"


# ── routes ─────────────────────────────────────────────────────────────────


class PostingMcp(FakeMcp):
    def __init__(self, error: Exception | None = None) -> None:
        super().__init__()
        self.error = error

    def _call_tool(self, name: str, args: dict[str, Any]) -> Any:
        if name == "post_message":
            self.calls.append((name, args))
            if self.error:
                raise self.error
            return {"ok": True, "channel": args["channelId"], "ts": "1800000100.000200"}
        return super()._call_tool(name, args)


@pytest.fixture
def send(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(store, "now", lambda: NOW)
    monkeypatch.setattr(settings_mod, "read_settings",
                        lambda: {**settings_mod.defaults(), "workspace_url": "https://acme.slack.com"})
    fake = PostingMcp()
    monkeypatch.setattr(slack_mcp, "get_client", lambda command: fake)
    handler = _route(routes, "POST", "/items/reply/send")

    def call(body: Any, **flags: Any) -> Any:
        return asyncio.run(handler(_Req(body, **({"app": "slack-radar"} | flags)), _ctx(tmp_path)))

    call.fake = fake  # type: ignore[attr-defined]
    return call


def test_send_posts_in_the_thread_and_marks_handled(send, tmp_path: Path) -> None:
    it = _drafted(1)
    it["thread_ts"] = "1799990000.000001"
    _seed(tmp_path, it)
    resp = send({"key": it["key"]})
    assert resp.status == 200, resp.body
    assert send.fake.calls == [("post_message", {"channelId": C1, "threadTs": "1799990000.000001", "text": "draft 1"})]
    row = store.read_ledger(tmp_path)["items"][it["key"]]
    assert row["reply_draft"] is None and row["replied"]["text"] == "draft 1" and row["replied"]["ts"] == "1800000100.000200"
    assert row["replied"]["permalink"] == (
        f"https://acme.slack.com/archives/{C1}/p1800000100000200?thread_ts=1799990000.000001&cid={C1}"
    )
    assert (row["handled_at"], row["handled_how"]) == (NOW, "done")
    ev = store.read_events(tmp_path)[-1]
    assert ev["kind"] == "reply" and ev["text"] == f"replied in {C1} · draft 1" and ev["key"] == it["key"]


def test_send_falls_back_to_the_message_ts_and_can_keep_open(send, tmp_path: Path) -> None:
    it = _drafted(1)
    del it["thread_ts"]
    _seed(tmp_path, it)
    assert send({"key": it["key"], "keep_open": True}).status == 200
    assert send.fake.calls[0][1]["threadTs"] == it["ts"]
    row = store.read_ledger(tmp_path)["items"][it["key"]]
    assert row["handled_at"] == 0.0 and row["replied"]


def test_send_is_owner_only(send, tmp_path: Path) -> None:
    it = _drafted(1)
    _seed(tmp_path, it)
    resp = send({"key": it["key"]}, internal_auth=True)
    assert resp.status == 403 and resp.body["code"] == "owner_only" and send.fake.calls == []


def test_send_refused_while_slack_needs_login(send, tmp_path: Path) -> None:
    it = _drafted(1)
    _seed(tmp_path, it)
    store.mutate(tmp_path, lambda led: led.update(source_state="needs_login"))
    resp = send({"key": it["key"]})
    assert (resp.status, resp.body["code"]) == (409, "needs_login") and send.fake.calls == []
    assert store.has_reply_draft(store.read_ledger(tmp_path)["items"][it["key"]])


def test_one_send_per_item_per_minute(send, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    it = _drafted(1)
    _seed(tmp_path, it)
    send.fake.error = McpTransportError("post_message timed out")
    first = send({"key": it["key"]})
    assert (first.status, first.body["code"]) == (502, "send_unknown")
    second = send({"key": it["key"]})
    assert (second.status, second.body["code"]) == (429, "rate_limited") and second.body["retry_after"] == 60
    assert len(send.fake.calls) == 1
    monkeypatch.setattr(store, "now", lambda: NOW + 61)
    send.fake.error = None
    assert send({"key": it["key"]}).status == 200 and len(send.fake.calls) == 2


def test_a_refused_post_releases_the_minute(send, tmp_path: Path) -> None:
    it = _drafted(1)
    _seed(tmp_path, it)
    send.fake.error = NeedsLogin("invalid_auth")
    resp = send({"key": it["key"]})
    assert (resp.status, resp.body["code"]) == (409, "needs_login")
    send.fake.error = None
    assert send({"key": it["key"]}).status == 200


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        (None, 400, "body_not_object"),
        ({"key": "nope"}, 400, "invalid_field"),
        ({"key": "C0AAAAAAA:1727184000.000009"}, 404, "unknown_item"),
    ],
)
def test_send_validates(send, body: Any, status: int, code: str) -> None:
    resp = send(body)
    assert (resp.status, resp.body["code"]) == (status, code) and send.fake.calls == []


def test_send_without_a_draft_is_refused(send, tmp_path: Path) -> None:
    it = open_item(1)
    _seed(tmp_path, it)
    resp = send({"key": it["key"]})
    assert (resp.status, resp.body["code"]) == (409, "no_draft") and send.fake.calls == []


def test_draft_route_saves_owner_edit_and_is_owner_only(routes, tmp_path: Path) -> None:
    it = _drafted(1)
    _seed(tmp_path, it)
    handler = _route(routes, "POST", "/items/reply/draft")
    denied = asyncio.run(handler(_Req({"key": it["key"], "text": "x"}, app="slack-radar", internal_auth=True), _ctx(tmp_path)))
    assert denied.status == 403
    ok = asyncio.run(handler(_Req({"key": it["key"], "text": "edited by me"}, app="slack-radar"), _ctx(tmp_path)))
    assert ok.status == 200
    draft = store.read_ledger(tmp_path)["items"][it["key"]]["reply_draft"]
    assert (draft["text"], draft["by"]) == ("edited by me", "owner")
    bad = asyncio.run(handler(_Req({"key": it["key"], "text": ""}, app="slack-radar"), _ctx(tmp_path)))
    assert (bad.status, bad.body["code"]) == (400, "invalid_field")


# ── brief ──────────────────────────────────────────────────────────────────


def test_brief_and_lead_prompt_carry_the_reply_rule() -> None:
    brief = (ROOT / "backend" / "crew_brief.md").read_text(encoding="utf-8")
    lead = (ROOT / "agents" / "prompts" / "slack-radar-crew.md").read_text(encoding="utf-8")
    assert "7. **Draft a reply**" in brief
    for text in (brief, lead):
        assert "reply_draft" in text and "you never post" in text
        assert "never claim a fix is shipped unless the investigator's coverage verdict says so" in text
