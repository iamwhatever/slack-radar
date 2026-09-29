"""A crew session left on an old ledger tool after an app update is replaced, and the
ledger refuses fields it does not know instead of answering ``applied``.

The kiro-cli behind the Lead's slot keeps its ledger MCP server for the life of the
process, so after ``app update`` the Lead can keep calling the old tool code. The
gateway compares the installed app version with the version the session was started
under (``kv/crew_session.json``) and the versions the running servers reported
(``kv/tool_version.json``), and retires a stale slot the same way an agent move does.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import sys
import types
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import crew_runtime, hooks, store  # noqa: E402
from tests.test_reply import DRAFT, open_item  # noqa: E402
from tests.test_needs import ledger as make_ledger  # noqa: E402
from tests.test_wake import _HttpApp, _WakeSlot, env  # noqa: E402,F401

OLD, NEW = "0.8.0", "0.8.1"
KEY = "crew-slack-radar"


@pytest.fixture
def stale(env, monkeypatch: pytest.MonkeyPatch):  # noqa: F811 - the imported fixture
    state, _handler, data = env
    monkeypatch.setattr(store, "installed_version", lambda: NEW)
    closed: list[str] = []

    async def fake_retire(st, slot, key):
        closed.append(key)
        st._slots.pop(key, None)

    monkeypatch.setattr(crew_runtime, "_retire_slot", fake_retire)
    crew_runtime.bind_http_app(_HttpApp(state=state))
    return state, data, closed


def _poll(data: Path, summary: dict[str, Any] | None = None) -> bool:
    return asyncio.run(crew_runtime.after_poll(data, summary or {}, reason="timer"))


def _restart_events(data: Path) -> list[str]:
    return [e["text"] for e in store.read_events(data) if "restarted after app update" in e["text"]]


# ── restart on a version mismatch ──────────────────────────────────────────


def test_session_started_under_an_older_version_is_restarted_once(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, OLD, awaiting=False)
    _poll(data)
    assert closed == [KEY]
    assert store.read_crew(data)["slot_key"] == "crew-slack-radar-g2"
    assert _restart_events(data) == [f"crew session restarted after app update ({OLD} -> {NEW})"]
    session = store.read_crew_session(data)
    assert (session["slot_key"], session["version"], session["awaiting"]) == ("crew-slack-radar-g2", NEW, True)

    # The next wake creates the new slot; until its server reports in, nothing restarts.
    assert _poll(data, {"new": 1}) is True
    assert state.created == [("crew-slack-radar-g2", "slack-radar-crew")]
    _poll(data, {"new": 1})
    assert closed == [KEY] and len(_restart_events(data)) == 1
    # Even an old-version entry showing up now does not restart again while waiting.
    store.write_tool_version(data, OLD, 4241, os.getpid())
    _poll(data, {"new": 1})
    assert closed == [KEY] and len(_restart_events(data)) == 1

    # The new server reports the installed version: the wait ends, still no restart.
    store.write_tool_version(data, NEW, 4242, os.getpid())
    _poll(data, {"new": 1})
    assert closed == [KEY] and store.read_crew_session(data)["awaiting"] is False


def test_session_from_before_the_check_existed_is_restarted(stale) -> None:
    # The live defect: a 0.5.0 server never wrote a version, and no session record exists.
    state, data, closed = stale
    (data / store.CREW_SESSION_FILENAME).unlink()
    _poll(data)
    assert closed == [KEY]
    assert _restart_events(data) == [f"crew session restarted after app update (unknown -> {NEW})"]


def test_a_running_ledger_server_on_an_older_version_restarts_the_session(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, NEW, awaiting=False)
    store.write_tool_version(data, OLD, 4242, os.getpid())  # its host process is alive
    _poll(data)
    assert closed == [KEY]
    assert _restart_events(data) == [f"crew session restarted after app update ({OLD} -> {NEW})"]
    assert store.live_tool_versions(data) == []  # the retired session's entry is forgotten


def test_a_server_whose_host_process_is_gone_does_not_count(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, NEW, awaiting=False)
    store.write_tool_version(data, OLD, 4242, 2**22 + 12345)  # no such process
    _poll(data)
    assert closed == [] and _restart_events(data) == []


def test_same_version_never_restarts(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, NEW, awaiting=False)
    store.write_tool_version(data, NEW, 4242, os.getpid())
    for _ in range(3):
        _poll(data, {"new": 1})
    assert closed == [] and _restart_events(data) == []
    assert state._slots[KEY].prompts  # the same session kept getting its turns


def test_a_slot_the_gateway_does_not_hold_is_left_alone(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, OLD, awaiting=False)
    state._slots.clear()  # no process: the next open starts fresh
    _poll(data)
    assert closed == [] and _restart_events(data) == []


def test_a_mid_turn_session_is_restarted_on_the_next_poll_and_woken(stale) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, OLD, awaiting=False)
    slot = state._slots[KEY]
    slot.running = True
    assert _poll(data) is False
    assert closed == [] and crew_runtime._pending_wake == crew_runtime.RESTART_WAKE_REASON
    assert _poll(data) is False  # still mid-turn: still owed, and the reason does not grow
    assert closed == [] and crew_runtime._pending_wake == crew_runtime.RESTART_WAKE_REASON
    slot.running = False
    assert _poll(data) is True  # restarted, then the owed wake reaches the NEW session
    assert closed == [KEY]
    new = state._slots["crew-slack-radar-g2"]
    assert new.prompts[-1].startswith(f"[crew wake: retry: {crew_runtime.RESTART_WAKE_REASON}]")
    assert slot.prompts == []


def test_startup_restarts_a_stale_session(stale, monkeypatch: pytest.MonkeyPatch) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, OLD, awaiting=False)
    monkeypatch.setattr(hooks.watch, "start", lambda ctx: None)
    asyncio.run(hooks.on_startup(types.SimpleNamespace(http_app=_HttpApp(state=state), data_dir=data)))
    assert closed == [KEY] and len(_restart_events(data)) == 1


def test_a_paused_crew_is_not_restarted_on_startup(stale, monkeypatch: pytest.MonkeyPatch) -> None:
    state, data, closed = stale
    store.write_crew_session(data, KEY, OLD, awaiting=False)
    store.update_crew(data, {"enabled": False})
    monkeypatch.setattr(hooks.watch, "start", lambda ctx: None)
    asyncio.run(hooks.on_startup(types.SimpleNamespace(http_app=_HttpApp(state=state), data_dir=data)))
    assert closed == []


def test_creating_a_slot_records_the_version_it_starts_under(stale) -> None:
    state, data, _closed = stale
    state._slots.clear()
    (data / store.CREW_SESSION_FILENAME).unlink()
    asyncio.run(crew_runtime.ensure_crew_session(state, data, store.read_crew(data)))
    session = store.read_crew_session(data)
    assert (session["slot_key"], session["version"], session["awaiting"]) == (KEY, NEW, False)


# ── the handshake: what the ledger server writes and returns ───────────────


def _load_mcp(data: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(data))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp_stale", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    return mcp


def test_server_records_its_version_on_start_and_returns_it_on_read(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mcp = _load_mcp(tmp_path, monkeypatch)
    app_version = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))["version"]
    assert mcp.RUNNING_VERSION == app_version
    mcp.record_start()
    rec = json.loads((tmp_path / "kv" / "tool_version.json").read_text(encoding="utf-8"))
    assert (rec["version"], rec["pid"], rec["ppid"]) == (app_version, os.getpid(), os.getppid()) and rec["at"] > 0
    read = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/call",
                       "params": {"name": "slack_radar_read", "arguments": {}}})
    assert json.loads(read["result"]["content"][0]["text"])["tool_version"] == app_version
    init = mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "initialize", "params": {}})
    assert init["result"]["serverInfo"]["version"] == app_version


def test_record_tool_tells_the_lead_what_an_unknown_field_refusal_means(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mcp = _load_mcp(tmp_path, monkeypatch)
    tools = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    desc = next(t for t in tools if t["name"] == "slack_radar_record")["description"]
    assert "'unknown field' means this tool is stale; tell the owner" in desc


# ── fail loud: unknown fields are refused, never applied ───────────────────


def _record(led: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    led.setdefault("crew_memory", store.empty_ledger()["crew_memory"])
    return store.apply_crew_record(led, payload)


def test_known_field_reply_draft_is_applied() -> None:
    it = open_item()
    out = _record(make_ledger(it), {"items": [{"key": it["key"], "reply_draft": {"text": DRAFT}}]})
    assert out == {"applied": [it["key"]], "refused": []}
    assert it["reply_draft"]["text"] == DRAFT


def test_unknown_item_field_is_refused() -> None:
    it = open_item()
    out = _record(make_ledger(it), {"items": [{"key": it["key"], "bogus_field": 1}]})
    assert out["applied"] == []
    assert out["refused"] == [{"key": it["key"], "why": f"unknown field(s): bogus_field -- {store.STALE_TOOL_HINT}"}]


def test_known_and_unknown_fields_together_are_refused_whole() -> None:
    it = open_item()
    before = dict(it)
    out = _record(make_ledger(it), {"items": [{"key": it["key"], "summary": "new summary", "note": "n",
                                               "reply_draft": {"text": DRAFT}, "zeta": 1, "alpha": 2}]})
    assert out["applied"] == []
    assert out["refused"][0]["why"].startswith("unknown field(s): alpha, zeta -- ")
    assert it == before  # nothing written, not even the poller-flag clearing


def test_one_bad_row_does_not_block_the_others() -> None:
    a, b = open_item(1), open_item(2)
    out = _record(make_ledger(a, b), {"items": [{"key": a["key"], "bogus": 1}, {"key": b["key"], "note": "ok"}]})
    assert out["applied"] == [b["key"]] and [r["key"] for r in out["refused"]] == [a["key"]]


def test_unknown_crew_field_is_refused_whole() -> None:
    led = make_ledger()
    out = _record(led, {"crew": {"phase": "triaging", "next": "x", "mood": "good"}})
    assert out["refused"] == [{"key": "crew", "why": f"unknown field(s): mood -- {store.STALE_TOOL_HINT}"}]
    assert led["crew_memory"]["phase"] != "triaging" and led["crew_memory"].get("next") != "x"


def test_known_field_sets_match_what_the_tool_schema_offers(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    mcp = _load_mcp(tmp_path, monkeypatch)
    tools = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    props = next(t for t in tools if t["name"] == "slack_radar_record")["inputSchema"]["properties"]
    assert set(props["items"]["items"]["properties"]) == store.ITEM_RECORD_FIELDS
    assert set(props["crew"]["properties"]) == store.CREW_RECORD_FIELDS
