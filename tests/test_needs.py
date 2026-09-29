"""Needs-you rules (``backend/needs.py``) and the two routes that serve and change them.

Rules are tested on small ledger dicts. The routes use the same fake-aiohttp pattern as
``test_org.py``: no server, the handler coroutine is called directly.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import needs, store  # noqa: E402

NOW = 1_800_000_000.0
C1 = "C0AAAAAAA"
C2 = "C0BBBBBBB"


def item(n: int, channel: str = C1, hours: float = 1.0, **kw: Any) -> dict[str, Any]:
    t = NOW - hours * 3600
    key = f"{channel}:{int(t)}.{n:06d}"
    base = {
        "key": key, "channel": channel, "ts_float": t, "permalink": f"https://x.slack.com/archives/{channel}/p{n}",
        "text": f"message {n}", "summary": "", "status": "triaged", "category": "", "priority": "",
        "links": [], "investigation": "", "possibly_resolved": None, "reply_count": 0, "latest_reply": "",
        "handled_at": 0.0, "handled_how": "",
    }
    base.update(kw)
    return base


def ledger(*items: dict[str, Any]) -> dict[str, Any]:
    return {"items": {it["key"]: it for it in items}}


def group(out: dict[str, Any], gid: str) -> dict[str, Any]:
    return {g["id"]: g for g in out["groups"]}[gid]


def keys(out: dict[str, Any], gid: str) -> list[str]:
    return [e["key"] for e in group(out, gid)["entries"]]


# ── rules ──────────────────────────────────────────────────────────────────


def test_groups_are_ordered_and_empty_ledger_is_empty() -> None:
    out = needs.build_needs({"items": {}}, NOW)
    assert [g["id"] for g in out["groups"]] == ["decide", "unanswered", "clusters"]
    assert all(g["total"] == 0 and g["entries"] == [] for g in out["groups"])
    assert out["handled_total"] == 0


def test_decide_takes_open_p0_p1_sorted_by_priority_then_age() -> None:
    p1_old = item(1, priority="p1", hours=30)
    p1_new = item(2, priority="p1", hours=2)
    p0 = item(3, priority="p0", hours=1)
    p2 = item(4, priority="p2")
    closed = item(5, priority="p0", status="resolved")
    out = needs.build_needs(ledger(p1_old, p1_new, p0, p2, closed), NOW)
    assert keys(out, "decide") == [p0["key"], p1_old["key"], p1_new["key"]]
    e = group(out, "decide")["entries"][0]
    assert e["reason"] == "Open p0" and e["age_hours"] == 1.0 and e["permalink"].startswith("https://")
    assert e["summary"] == "message 3"  # no summary yet: the text stands in


def test_decide_finished_investigation_with_links() -> None:
    done = item(1, investigation="spawn s-1", links=["https://github.com/o/r/issues/1"], status="triaged")
    running = item(2, investigation="spawn s-2", links=["https://github.com/o/r/issues/2"], status="investigating")
    no_links = item(3, investigation="spawn s-3", status="triaged")
    host_done = item(4, investigation="spawn s-4", links=["https://github.com/o/r/pull/4"], status="investigating")
    out = needs.build_needs(ledger(done, running, no_links, host_done), NOW, spawn_done=lambda i: i == "s-4")
    assert set(keys(out, "decide")) == {done["key"], host_done["key"]}
    assert {e["reason"] for e in group(out, "decide")["entries"]} == {"Matching GitHub work found"}
    # without a host answer, a still-investigating item waits
    assert keys(needs.build_needs(ledger(running, host_done), NOW), "decide") == []


def test_decide_possibly_resolved() -> None:
    it = item(1, possibly_resolved={"reason": "reply says fixed", "at": NOW})
    out = needs.build_needs(ledger(it), NOW)
    assert group(out, "decide")["entries"][0]["reason"] == "Looks resolved: reply says fixed"


def test_unanswered_questions_over_48h_with_no_reply() -> None:
    q = item(1, category="question", hours=72)
    young = item(2, category="question", hours=10)
    replied = item(3, category="question", hours=72, reply_count=1)
    latest = item(4, category="question", hours=72, latest_reply="1.000001")
    bug = item(5, category="bug-report", hours=72)
    urgent_q = item(6, category="question", hours=72, priority="p1")
    out = needs.build_needs(ledger(q, young, replied, latest, bug, urgent_q), NOW)
    assert keys(out, "unanswered") == [q["key"]]
    assert group(out, "unanswered")["entries"][0]["reason"] == "No reply for 3 days"
    assert keys(out, "decide") == [urgent_q["key"]]  # an item lands in one of the two, decide first


def test_handled_items_leave_every_group_and_are_counted() -> None:
    p1 = item(1, priority="p1", handled_at=NOW - 5, handled_how="done")
    q = item(2, category="question", hours=72, handled_at=NOW - 5, handled_how="ignored")
    out = needs.build_needs(ledger(p1, q), NOW)
    assert all(g["total"] == 0 for g in out["groups"])
    assert out["handled_total"] == 2


def test_clusters_need_same_channel_and_two_shared_words() -> None:
    a = item(1, summary="CSV export fails over 10k rows", hours=5)
    b = item(2, summary="Export to CSV times out", hours=3, priority="p2")
    c = item(3, summary="export button missing")  # only one shared word
    other = item(4, channel=C2, summary="CSV export fails too")  # other channel
    closed = item(5, summary="CSV export broken", status="noise")
    out = needs.build_needs(ledger(a, b, c, other, closed), NOW)
    [cl] = group(out, "clusters")["entries"]
    assert set(cl["members"]) == {a["key"], b["key"]}
    assert cl["key"] == b["key"]  # p2 ranks above no priority
    assert cl["reason"] == "2 similar messages" and cl["age_hours"] == 5.0
    assert set(cl["words"]) == {"csv", "export"}


def test_clusters_are_transitive_and_ignore_stopwords() -> None:
    a = item(1, summary="dashboard blank after login")
    b = item(2, summary="blank dashboard on safari")
    c = item(3, summary="safari dashboard crash")
    noise = item(4, summary="please help thanks")
    noise2 = item(5, summary="thanks please help")
    out = needs.build_needs(ledger(a, b, c, noise, noise2), NOW)
    [cl] = group(out, "clusters")["entries"]
    assert set(cl["members"]) == {a["key"], b["key"], c["key"]}


def test_groups_cap_at_twenty_but_total_is_full() -> None:
    rows = [item(i, priority="p1", hours=i + 1) for i in range(25)]
    g = group(needs.build_needs(ledger(*rows), NOW), "decide")
    assert g["total"] == 25 and len(g["entries"]) == 20
    assert g["entries"][0]["key"] == rows[-1]["key"]  # oldest first within p1


def test_summary_is_clipped_to_200_when_falling_back_to_text() -> None:
    it = item(1, priority="p0", text="x" * 500)
    assert len(group(needs.build_needs(ledger(it), NOW), "decide")["entries"][0]["summary"]) == 200


# ── store: owner-only fields ───────────────────────────────────────────────


def test_apply_handle_sets_and_reopen_clears_keeping_status() -> None:
    it = item(1, priority="p1")
    led = ledger(it)
    out = store.apply_handle(led, it["key"], "done")
    assert out is not None and out["handled_how"] == "done" and out["handled_at"] > 0
    assert out["status"] == "triaged"
    store.apply_handle(led, it["key"], "reopen")
    assert (it["handled_at"], it["handled_how"]) == (0.0, "")
    assert store.apply_handle(led, "C0NOPE:1.000001", "done") is None
    with pytest.raises(ValueError):
        store.apply_handle(led, it["key"], "resolved")


def test_crew_record_cannot_set_handled_fields(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    it = item(1, priority="p1")
    store.mutate(tmp_path, lambda led: led["items"].update({it["key"]: it}))
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(tmp_path))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp_needs", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    tools = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    record = next(t for t in tools if t["name"] == "slack_radar_record")
    props = record["inputSchema"]["properties"]["items"]["items"]["properties"]
    assert "handled_at" not in props and "handled_how" not in props
    out = mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {
        "name": "slack_radar_record",
        "arguments": {"items": [{"key": it["key"], "handled_at": 123.0, "handled_how": "done", "summary": "s"}]},
    }})
    body = json.loads(out["result"]["content"][0]["text"])
    assert out["result"]["isError"] is True and body["applied"] == []
    assert "unknown field(s): handled_at, handled_how" in body["refused"][0]["why"]
    row = store.read_ledger(tmp_path)["items"][it["key"]]
    assert row["summary"] != "s"  # refused whole: nothing in the row is written
    assert (row["handled_at"], row["handled_how"]) == (0.0, "")


def test_new_items_start_unhandled() -> None:
    row = store.normalize_message(C1, {"ts": "1727184000.000001", "text": "hi"})
    assert row is not None and (row["handled_at"], row["handled_how"]) == (0.0, "")


# ── routes ─────────────────────────────────────────────────────────────────


class _Resp:
    def __init__(self, body: Any, status: int = 200) -> None:
        self.body = body
        self.status = status


class _Req(dict):
    """Just enough of aiohttp's request for these handlers and the owner gate."""

    def __init__(self, body: Any = None, query: dict[str, str] | None = None, **flags: Any) -> None:
        super().__init__(flags)
        self._body = body
        self.query = query or {}
        self.method = "POST"
        self.path = "/api/apps/slack-radar/items/handle"
        self.content_length = len(json.dumps(body)) if body is not None else 0
        self.app = {"state": None}

    async def json(self) -> Any:
        if self._body is None:
            raise ValueError("no body")
        return self._body


@pytest.fixture
def routes(monkeypatch: pytest.MonkeyPatch):
    web = types.SimpleNamespace(json_response=lambda body, status=200: _Resp(body, status),
                                Request=object, Response=_Resp, StreamResponse=_Resp)
    aiohttp = types.ModuleType("aiohttp")
    aiohttp.web = web  # type: ignore[attr-defined]
    registry = types.ModuleType("kiro_crew.apps.route_registry")

    class AppRoute:
        def __init__(self, method: str, path: str, handler: Any) -> None:
            self.method, self.path, self.handler = method, path, handler

    registry.AppRoute = AppRoute  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "aiohttp", aiohttp)
    monkeypatch.setitem(sys.modules, "aiohttp.web", web)
    for name in ("kiro_crew", "kiro_crew.apps"):
        monkeypatch.setitem(sys.modules, name, types.ModuleType(name))
    monkeypatch.setitem(sys.modules, "kiro_crew.apps.route_registry", registry)
    monkeypatch.delitem(sys.modules, "backend.routes", raising=False)
    import backend.routes as mod

    yield mod
    sys.modules.pop("backend.routes", None)


class _Audit:
    def __init__(self) -> None:
        self.rows: list[tuple] = []

    def record(self, *a: Any, **kw: Any) -> None:
        self.rows.append(a)


def _ctx(data: Path, spawn: Any = None) -> Any:
    return types.SimpleNamespace(data_dir=str(data), spawn=spawn, audit=_Audit())


def _seed(data: Path, *rows: dict[str, Any]) -> None:
    store.mutate(data, lambda led: led["items"].update({r["key"]: r for r in rows}))


def _route(routes: Any, method: str, path: str) -> Any:
    return {(r.method, r.path): r.handler for r in routes.register_routes(None)}[(method, path)]


def test_needs_route_is_open_and_serves_groups(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(store, "now", lambda: NOW)
    p1 = item(1, priority="p1")
    _seed(tmp_path, p1, item(2, category="question", hours=72))
    handler = _route(routes, "GET", "/needs")
    assert handler is routes._handle_needs  # a read: no owner gate, like /state
    resp = asyncio.run(handler(_Req(), _ctx(tmp_path)))
    assert resp.status == 200 and resp.body["ok"] is True
    assert [g["total"] for g in resp.body["groups"]] == [1, 1, 0]
    assert resp.body["groups"][0]["entries"][0]["key"] == p1["key"]


def test_handle_route_is_owner_only(routes, tmp_path: Path) -> None:
    it = item(1, priority="p1")
    _seed(tmp_path, it)
    handler = _route(routes, "POST", "/items/handle")
    ctx = _ctx(tmp_path)
    # an agent's internal-secret call presenting as this app is refused
    resp = asyncio.run(handler(_Req({"key": it["key"], "how": "done"}, app="slack-radar", internal_auth=True), ctx))
    assert resp.status == 403 and resp.body["code"] == "owner_only"
    assert store.read_ledger(tmp_path)["items"][it["key"]]["handled_at"] == 0.0
    assert ctx.audit.rows and ctx.audit.rows[0][0] == "owner_gate"


def test_handle_route_done_then_reopen(routes, tmp_path: Path) -> None:
    it = item(1, priority="p1")
    _seed(tmp_path, it)
    handler = _route(routes, "POST", "/items/handle")
    ctx = _ctx(tmp_path)
    owner = {"app": "slack-radar"}
    resp = asyncio.run(handler(_Req({"key": it["key"], "how": "ignored"}, **owner), ctx))
    assert resp.status == 200 and resp.body["item"]["handled_how"] == "ignored"
    row = store.read_ledger(tmp_path)["items"][it["key"]]
    assert row["handled_at"] > 0 and row["status"] == "triaged"
    items = asyncio.run(routes._handle_items(_Req(query={"handled": "1"}), ctx)).body
    assert [r["key"] for r in items["items"]] == [it["key"]]
    needs_body = asyncio.run(routes._handle_needs(_Req(), ctx)).body
    assert needs_body["groups"][0]["total"] == 0 and needs_body["handled_total"] == 1
    asyncio.run(handler(_Req({"key": it["key"], "how": "reopen"}, **owner), ctx))
    row = store.read_ledger(tmp_path)["items"][it["key"]]
    assert (row["handled_at"], row["handled_how"]) == (0.0, "")
    assert asyncio.run(routes._handle_items(_Req(query={"handled": "1"}), ctx)).body["items"] == []


@pytest.mark.parametrize(
    ("body", "status", "code"),
    [
        (None, 400, "body_not_object"),
        ({"key": "nope", "how": "done"}, 400, "invalid_field"),
        ({"key": "C0AAAAAAA:1727184000.000001", "how": "resolved"}, 400, "invalid_field"),
        ({"key": "C0AAAAAAA:1727184000.000009", "how": "done"}, 404, "unknown_item"),
    ],
)
def test_handle_route_validates(routes, tmp_path: Path, body: Any, status: int, code: str) -> None:
    resp = asyncio.run(_route(routes, "POST", "/items/handle")(_Req(body, app="slack-radar"), _ctx(tmp_path)))
    assert (resp.status, resp.body["code"]) == (status, code)
