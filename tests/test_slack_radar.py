"""Unit tests for the deterministic parts: MCP client guard, ledger, poll cycle, digest, crew tools.

Run from the app root: ``python3 -m pytest tests -q`` (stdlib + pytest only; no gateway, no
Slack). The Slack MCP subprocess is faked by overriding ``SlackMcpClient._call_tool`` — the
single funnel every tools/call goes through — so the allowlist in ``call()`` and the
separate ``send_self_dm()`` path are exercised exactly as in production.
"""

from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import slack_mcp, store, watch  # noqa: E402
from backend.settings import DEFAULT_SETTINGS, validate_settings  # noqa: E402
from backend.slack_mcp import NeedsLogin, SlackMcpClient, ToolNotAllowed  # noqa: E402

C1 = "C0AAAAAAA"
C2 = "C0BBBBBBB"


def ts(n: float) -> str:
    return f"{n:.6f}"


class FakeMcp(SlackMcpClient):
    """No subprocess: answers tools/call in the Slack MCP's real response shapes."""

    def __init__(self) -> None:
        super().__init__("fake-slack-mcp")
        self.calls: list[tuple[str, dict]] = []
        self.history_msgs: dict[str, list[dict]] = {}
        self.threads: dict[tuple[str, str], list[dict]] = {}
        self.channel_errors: dict[str, str] = {}
        self.auth_expired = False
        self.dm_error: Exception | None = None

    def _call_tool(self, name: str, args: dict[str, Any]) -> Any:
        self.calls.append((name, args))
        if self.auth_expired:
            raise NeedsLogin("invalid_auth")
        if name == "batch_get_channel_info":
            return [{"channelId": c, "result": {"ok": True}} for c in args["channelIds"]]
        if name == "batch_get_conversation_history":
            out = []
            for req in args["channels"]:
                cid = req["channelId"]
                if cid in self.channel_errors:
                    out.append({"channelId": cid, "error": f'bad response: {{"ok":false,"error":"{self.channel_errors[cid]}"}}'})
                    continue
                oldest = float(watch.iso_to_ts(req["oldest"]))
                msgs = [m for m in self.history_msgs.get(cid, []) if float(m["ts"]) > oldest]
                out.append({"channelId": cid, "result": {"ok": True, "messages": sorted(msgs, key=lambda m: -float(m["ts"])), "has_more": False}})
            return out
        if name == "batch_get_thread_replies":
            out = []
            for req in args["threads"]:
                key = (req["channelId"], req["threadTs"])
                if key in self.threads and self.threads[key] is None:
                    out.append({**req, "error": 'bad response: {"ok":false,"error":"thread_not_found"}'})
                else:
                    msgs = self.threads.get(key) or [{"ts": req["threadTs"], "text": "parent"}]
                    out.append({**req, "result": {"ok": True, "messages": msgs}})
            return out
        if name == "self_dm":
            if self.dm_error:
                raise self.dm_error
            return {"ok": True}
        raise AssertionError(f"unexpected tool {name}")


def settings(**kw) -> dict:
    s = dict(DEFAULT_SETTINGS)
    s.update({"channels": [C1, C2], "backfill_hours": 24, "slack_login": "jdoe",
              "workspace_url": "https://acme.slack.com"})
    s.update(kw)
    return s


# ── MCP client guard ───────────────────────────────────────────────────────


@pytest.mark.parametrize("tool", ["post_message", "create_draft", "reaction_tool", "self_dm", "search", "add_channel_members"])
def test_allowlist_refuses_non_read_tools_before_the_process(tool: str) -> None:
    fake = FakeMcp()
    with pytest.raises(ToolNotAllowed):
        fake.call(tool, {})
    assert fake.calls == []  # nothing reached the (fake) subprocess


def test_allowlist_admits_read_tools() -> None:
    fake = FakeMcp()
    fake.call("batch_get_channel_info", {"channelIds": [C1]})
    assert [c[0] for c in fake.calls] == ["batch_get_channel_info"]
    assert slack_mcp.READ_TOOLS == {
        "list_channels", "batch_get_conversation_history", "batch_get_thread_replies",
        "batch_get_channel_info", "batch_get_user_info",
    }


def test_parse_tool_text_classifies_auth_errors() -> None:
    with pytest.raises(NeedsLogin):
        slack_mcp.parse_tool_text({"isError": True, "content": [{"type": "text", "text": "Midway session expired, run mwinit"}]})
    with pytest.raises(slack_mcp.ToolError):
        slack_mcp.parse_tool_text({"isError": True, "content": [{"type": "text", "text": "channel_not_found"}]})
    assert slack_mcp.parse_tool_text({"content": [{"type": "text", "text": "[1]"}]}) == [1]


def test_binary_not_found_and_bad_command() -> None:
    with pytest.raises(slack_mcp.BinaryNotFound):
        slack_mcp.resolve_command("definitely-not-a-real-slack-mcp-binary")
    assert slack_mcp.validate_command("slack-mcp --flag") is not None
    assert slack_mcp.validate_command("ai-community-slack-mcp") is None


# ── ts <-> ISO ─────────────────────────────────────────────────────────────


def test_ts_iso_round_trip_floors_to_milliseconds() -> None:
    assert watch.ts_to_iso("1727184000.123456") == "2024-09-24T13:20:00.123Z"
    assert watch.iso_to_ts("2024-09-24T13:20:00.123Z") == "1727184000.123000"
    for raw in ("1727184000.000000", "1788220800.999999", "1600000000.5"):
        back = float(watch.iso_to_ts(watch.ts_to_iso(raw)))
        assert back <= float(raw) < back + 0.001  # never later than the cursor: nothing skipped
    assert watch.iso_to_ts("2024-09-24T15:20:00+02:00") == "1727184000.000000"


# ── poll cycle ─────────────────────────────────────────────────────────────


def test_poll_ingests_advances_cursor_and_skips_noise(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    fake.history_msgs[C1] = [
        {"ts": ts(now - 100), "user": "U1", "text": "Login is broken since v2"},
        {"ts": ts(now - 90), "subtype": "channel_join", "user": "U2", "text": "joined"},
        {"ts": ts(now - 70), "user": "U3", "text": "token xoxb-1234567890-abcdefghij leaked"},
    ]
    summary = watch.run_cycle(tmp_path, fake, settings())
    assert summary["new"] == 2 and summary["source_state"] == "ok"
    led = store.read_ledger(tmp_path)
    assert led["channels"][C1]["cursor_ts"] == ts(now - 70)
    texts = "".join(it["text"] for it in led["items"].values())
    assert "xoxb-" not in texts and store.REDACTED in texts  # pasted credentials never stored
    key = store.item_key(C1, ts(now - 100))
    assert led["items"][key]["permalink"] == f"https://acme.slack.com/archives/{C1}/p{ts(now - 100).replace('.', '')}"
    # one batched history call for both channels, oldest sent as ISO
    hist = [a for n, a in fake.calls if n == "batch_get_conversation_history"]
    assert len(hist) == 1 and {c["channelId"] for c in hist[0]["channels"]} == {C1, C2}
    assert hist[0]["channels"][0]["oldest"].endswith("Z")

    fake.calls.clear()
    assert watch.run_cycle(tmp_path, fake, settings())["new"] == 0
    sent = next(c for c in fake.calls[0][1]["channels"] if c["channelId"] == C1)
    assert sent["oldest"] == watch.ts_to_iso(ts(now - 70))


def test_per_channel_error_does_not_stop_other_channels(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    fake.channel_errors[C1] = "channel_not_found"
    fake.history_msgs[C2] = [{"ts": ts(now - 5), "user": "U1", "text": "hi"}]
    summary = watch.run_cycle(tmp_path, fake, settings())
    assert summary["errors"] == {C1: "channel_not_found"} and summary["new"] == 1
    assert store.read_ledger(tmp_path)["channels"][C1]["last_error"] == "channel_not_found"


def test_auth_error_sets_needs_login_without_moving_cursors(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    fake.history_msgs[C1] = [{"ts": ts(now - 10), "user": "U1", "text": "first"}]
    watch.run_cycle(tmp_path, fake, settings())
    before = store.read_ledger(tmp_path)["channels"][C1]["cursor_ts"]

    fake.history_msgs[C1].append({"ts": ts(now - 1), "user": "U1", "text": "second"})
    fake.auth_expired = True
    summary = watch.run_cycle(tmp_path, fake, settings())
    led = store.read_ledger(tmp_path)
    assert summary["source_state"] == "needs_login" and summary["new"] == 0
    assert led["source_state"] == "needs_login" and "login" in led["source_error"].lower()
    assert led["channels"][C1]["cursor_ts"] == before  # never read as "no new messages"

    # next cycle: still expired -> one cheap probe read only, then skip
    fake.calls.clear()
    watch.run_cycle(tmp_path, fake, settings())
    assert [n for n, _ in fake.calls] == ["batch_get_channel_info"]

    # re-login: probe passes, poll resumes, the held-back message arrives
    fake.auth_expired = False
    summary = watch.run_cycle(tmp_path, fake, settings())
    assert summary["source_state"] == "ok" and summary["new"] == 1
    assert store.read_ledger(tmp_path)["source_state"] == "ok"


def test_per_channel_auth_error_is_needs_login(tmp_path: Path) -> None:
    fake = FakeMcp()
    fake.channel_errors[C2] = "invalid_auth"
    assert watch.run_cycle(tmp_path, fake, settings())["source_state"] == "needs_login"


def test_thread_recheck_flags_possibly_resolved_never_resolves(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    parent_ts = ts(now - 5000)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": "U1", "text": "CI is red on main"}]
    assert watch.run_cycle(tmp_path, fake, settings(channels=[C1]))["possibly_resolved"] == 0
    key = store.item_key(C1, parent_ts)
    store.mutate(tmp_path, lambda led: led["items"][key].update(last_thread_check_at=0.0))
    fake.threads[(C1, parent_ts)] = [
        {"ts": parent_ts, "text": "CI is red on main"},
        {"ts": ts(now - 10), "text": "fixed in the last merge, thanks"},
    ]
    summary = watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    assert summary["possibly_resolved"] == 1 and summary["thread_changed"] == 1
    item = store.read_ledger(tmp_path)["items"][key]
    assert item["possibly_resolved"]["reason"] and item["status"] == "new"  # code never resolves
    fake.threads[(C1, parent_ts)].append({"ts": ts(now - 5), "text": "another"})
    assert watch.run_cycle(tmp_path, fake, settings(channels=[C1]))["thread_changed"] == 0  # 30-min gap


def test_deleted_parent_is_flagged(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    parent_ts = ts(now - 5000)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": "U1", "text": "question"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, parent_ts)
    store.mutate(tmp_path, lambda led: led["items"][key].update(last_thread_check_at=0.0))
    fake.threads[(C1, parent_ts)] = None  # type: ignore[assignment]
    assert watch.run_cycle(tmp_path, fake, settings(channels=[C1]))["possibly_resolved"] == 1
    assert "deleted" in store.read_ledger(tmp_path)["items"][key]["possibly_resolved"]["reason"]


# ── crew write path + digest ───────────────────────────────────────────────


def test_crew_record_validates_and_clears_flags(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeMcp()
    fake.history_msgs[C1] = [{"ts": ts(now - 10), "user": "U1", "text": "please add dark mode"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, ts(now - 10))
    result = store.mutate(
        tmp_path,
        lambda led: store.apply_crew_record(
            led,
            {
                "items": [
                    {"key": key, "category": "feature-request", "priority": "p2", "status": "triaged",
                     "summary": "Dark mode request", "links": ["https://github.com/o/r/issues/1", "file:///etc/passwd"]},
                    {"key": key, "priority": "p9"},
                    {"key": "C0NOPE:1.000001"},
                ],
                "crew": {"phase": "triaging", "next": "check dark mode dupes"},
            },
        ),
    )
    assert result["applied"] == [key, key]
    assert {r["key"] for r in result["refused"]} == {key, "C0NOPE:1.000001"}
    it = store.read_ledger(tmp_path)["items"][key]
    assert (it["category"], it["priority"], it["status"]) == ("feature-request", "p2", "triaged")
    assert it["links"] == ["https://github.com/o/r/issues/1"] and it["needs_triage"] is False


def _pending_digest(tmp_path: Path, fake: FakeMcp) -> str:
    now = time.time()
    fake.history_msgs[C1] = [{"ts": ts(now - 10), "user": "U1", "text": "SECRET-RAW-TEXT crash on save"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, ts(now - 10))

    def _crew(led):
        store.apply_crew_record(led, {"items": [{"key": key, "category": "bug-report", "priority": "p1",
                                                  "summary": "Crash on save", "note": "LOCAL-NOTE"}]})
        led["digest"]["pending"] = {"headline": "One p1 bug today", "top_keys": [key]}

    store.mutate(tmp_path, _crew)
    fake.calls.clear()
    return key


def test_digest_self_dm_is_the_only_write(tmp_path: Path) -> None:
    fake = FakeMcp()
    _pending_digest(tmp_path, fake)
    notified: list[str] = []
    out = watch.deliver_pending_digest(tmp_path, fake, settings(digest_destination="self_dm"),
                                       lambda t, b: notified.append(b))
    assert out == "sent"
    assert [n for n, _ in fake.calls] == ["self_dm"]
    args = fake.calls[0][1]
    assert args["login"] == "jdoe"
    assert "Crash on save" in args["text"] and "One p1 bug today" in args["text"]
    assert "SECRET-RAW-TEXT" not in args["text"] and "LOCAL-NOTE" not in args["text"]
    d = store.read_ledger(tmp_path)["digest"]
    assert d["pending"] is None and d["last_destination"] == "self_dm" and d["last_text"]


def test_digest_dashboard_mode_touches_no_slack_tool(tmp_path: Path) -> None:
    fake = FakeMcp()
    _pending_digest(tmp_path, fake)
    notified: list[str] = []
    assert watch.deliver_pending_digest(tmp_path, fake, settings(digest_destination="dashboard"),
                                        lambda t, b: notified.append(b)) == "dashboard"
    assert fake.calls == [] and "Crash on save" in notified[0]


def test_digest_needs_login_keeps_pending_for_retry(tmp_path: Path) -> None:
    fake = FakeMcp()
    _pending_digest(tmp_path, fake)
    fake.dm_error = NeedsLogin("invalid_auth")
    assert watch.deliver_pending_digest(tmp_path, fake, settings(digest_destination="self_dm")) == "needs_login"
    assert store.read_ledger(tmp_path)["digest"]["pending"] is not None


def test_corrupt_ledger_is_refused_not_replaced(tmp_path: Path) -> None:
    store.ledger_path(tmp_path).write_text("[1, 2]", encoding="utf-8")
    with pytest.raises(store.StoreError):
        store.mutate(tmp_path, lambda led: None)
    assert store.ledger_path(tmp_path).read_text(encoding="utf-8") == "[1, 2]"


def test_settings_validation() -> None:
    base = dict(DEFAULT_SETTINGS, slack_login="jdoe")
    merged, errors = validate_settings({"channels": ["c0aaaaaaa", "C0AAAAAAA", "#general"]}, base)
    assert merged["channels"] == ["C0AAAAAAA"] and errors and "GENERAL" in errors[0]
    _, errors = validate_settings({"slack_mcp_command": "rm -rf /"}, base)
    assert errors
    _, errors = validate_settings({"digest_destination": "C0CHANNEL1"}, base)
    assert errors  # no channel posting destination exists
    _, errors = validate_settings({"digest_destination": "self_dm", "slack_login": ""}, base)
    assert errors
    merged, errors = validate_settings({"workspace_url": "https://evil.example.com"}, base)
    assert errors
    merged, errors = validate_settings({"poll_interval_secs": 5, "slack_mcp_command": "my-slack-mcp"}, base)
    assert not errors and merged["poll_interval_secs"] == 60 and merged["slack_mcp_command"] == "my-slack-mcp"


def test_mcp_server_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SLACK_RADAR_DATA_DIR", str(tmp_path))
    spec = importlib.util.spec_from_file_location("slack_radar_mcp", ROOT / "backend" / "mcp_server.py")
    mcp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mcp)  # type: ignore[union-attr]
    init = mcp.handle({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}})
    assert init["result"]["serverInfo"]["name"] == "slack-radar"
    names = {t["name"] for t in mcp.handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})["result"]["tools"]}
    assert names == {"slack_radar_read", "slack_radar_record", "slack_radar_digest", "slack_radar_request_digest"}
    out = mcp.handle({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                      "params": {"name": "slack_radar_digest", "arguments": {"headline": "hello"}}})
    assert out["result"]["isError"] is False
    read = mcp.handle({"jsonrpc": "2.0", "id": 4, "method": "tools/call",
                       "params": {"name": "slack_radar_read", "arguments": {}}})
    body = json.loads(read["result"]["content"][0]["text"])
    assert body["digest"]["pending"]["headline"] == "hello" and body["slack_source"]["state"] == "ok"



# ── shipped agents ─────────────────────────────────────────────────────────


def _agent(name: str) -> dict:
    return json.loads((ROOT / "agents" / f"{name}.json").read_text(encoding="utf-8"))


def test_crew_agent_carries_and_auto_approves_the_ledger_tools() -> None:
    crew = _agent("slack-radar-crew")
    assert crew["name"] == store.CREW_AGENT
    ledger_refs = [t for t in crew["tools"] if t.startswith("@slack-radar:")]
    assert ledger_refs == ["@slack-radar:ledger"]
    manifest = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
    # the ref names the app's own server exactly as the gateway namespaces it
    assert {f"@slack-radar:{s}" for s in manifest["mcpServers"]} == set(ledger_refs)
    for ref in ledger_refs:
        assert ref in crew["allowedTools"], "an unattended turn must never prompt for the ledger"
    for banned in ("execute_bash", "fs_write", "@kirocrew-core/send_message"):
        assert banned not in crew["tools"] and banned not in crew["allowedTools"]
    assert "@kirocrew-core/spawn_run" in crew["allowedTools"]
    assert "agents/slack-radar-crew.json" in manifest["agents"]


def test_investigator_agent_is_still_shipped_and_uses_the_ledger() -> None:
    inv = _agent("slack-radar-investigator")
    assert "@slack-radar:ledger" in inv["tools"]
    assert "execute_bash" not in inv.get("allowedTools", [])  # never auto-approve a shell


def test_crew_defaults_to_the_shipped_agent(tmp_path: Path) -> None:
    from backend import crew_runtime  # noqa: F401  (imports cleanly without a gateway)

    assert store.read_crew(tmp_path)["agent"] == "slack-radar-crew"
    store.crew_path(tmp_path).write_text(json.dumps({"agent": "kirocrew"}), encoding="utf-8")
    assert store.read_crew(tmp_path)["agent"] == "slack-radar-crew"  # legacy default migrated
    store.update_crew(tmp_path, {"agent": ""})
    assert store.read_crew(tmp_path)["agent"] == "slack-radar-crew"
    store.update_crew(tmp_path, {"agent": "my-agent"})
    assert store.read_crew(tmp_path)["agent"] == "my-agent"  # explicit override kept



# ── crew slot vs agent ─────────────────────────────────────────────────────


class _FakeSlot:
    def __init__(self, key: str, agent: str) -> None:
        self.key = key
        self.agent = agent
        self.title = ""
        self._titled = False
        self._trust_scope = ""
        self._trust = False
        self.messages: list = []


class _FakeState:
    """The two host behaviours that matter: an existing key is RETURNED whatever
    agent is asked for, and nothing re-binds a slot's agent."""

    def __init__(self) -> None:
        self._slots: dict[str, _FakeSlot] = {}
        self.created: list[tuple[str, str]] = []

    def get_slot(self, key: str):
        return self._slots.get(key)

    def get_or_create_slot(self, *, name: str, agent: str, **_kw):
        if name in self._slots:
            return self._slots[name]
        self.created.append((name, agent))
        self._slots[name] = _FakeSlot(name, agent)
        return self._slots[name]


@pytest.fixture
def crew_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    from backend import crew_runtime

    state = _FakeState()
    closed: list[tuple[str, str]] = []
    rehydrated: dict[str, _FakeSlot] = {}

    async def fake_retire(st, slot, key):
        closed.append((key, slot.agent))
        st._slots.pop(key, None)

    async def fake_rehydrate(st, key):
        slot = rehydrated.pop(key, None)
        if slot is not None:
            st._slots[key] = slot
        return slot

    monkeypatch.setattr(crew_runtime, "_retire_slot", fake_retire)
    monkeypatch.setattr(crew_runtime, "_rehydrate", fake_rehydrate)
    return crew_runtime, state, closed, rehydrated, tmp_path


def test_live_slot_on_wrong_agent_is_retired_and_crew_moves(crew_env) -> None:
    import asyncio

    crew_runtime, state, closed, _, data = crew_env
    state._slots["crew-slack-radar"] = _FakeSlot("crew-slack-radar", "kirocrew")  # made under v0.2.0
    crew = store.read_crew(data)
    slot, crew = asyncio.run(crew_runtime.ensure_crew_session(state, data, crew))
    assert slot.agent == "slack-radar-crew" and slot.key == "crew-slack-radar-g2"
    assert closed == [("crew-slack-radar", "kirocrew")]
    assert store.read_crew(data)["slot_key"] == "crew-slack-radar-g2"  # persisted
    assert any("moved from agent kirocrew to slack-radar-crew" in e["text"] for e in store.read_events(data))
    # idempotent: a second resolve keeps the healthy slot
    slot2, _ = asyncio.run(crew_runtime.ensure_crew_session(state, data, store.read_crew(data)))
    assert slot2 is slot and len(closed) == 1


def test_rehydrated_slot_on_wrong_agent_is_never_used(crew_env) -> None:
    import asyncio

    crew_runtime, state, closed, rehydrated, data = crew_env
    rehydrated["crew-slack-radar"] = _FakeSlot("crew-slack-radar", "kirocrew")  # jsonl line 1 agent
    slot, _ = asyncio.run(crew_runtime.ensure_crew_session(state, data, store.read_crew(data)))
    assert slot.agent == "slack-radar-crew" and slot.key == "crew-slack-radar-g2"
    assert closed == [("crew-slack-radar", "kirocrew")]
    assert state.created == [("crew-slack-radar-g2", "slack-radar-crew")]


def test_after_poll_self_heals_without_a_wake(crew_env, monkeypatch: pytest.MonkeyPatch) -> None:
    import asyncio

    crew_runtime, state, closed, _, data = crew_env
    store.update_crew(data, {"enabled": True})
    state._slots["crew-slack-radar"] = _FakeSlot("crew-slack-radar", "kirocrew")
    monkeypatch.setattr(crew_runtime, "_gateway_state", lambda: state)
    assert asyncio.run(crew_runtime.after_poll(data, {}, reason="timer")) is False  # nothing moved
    assert closed == [("crew-slack-radar", "kirocrew")]
    assert store.read_crew(data)["slot_key"] == "crew-slack-radar-g2"


def test_matching_agent_slot_is_untouched(crew_env) -> None:
    import asyncio

    crew_runtime, state, closed, _, data = crew_env
    existing = _FakeSlot("crew-slack-radar", "slack-radar-crew")
    state._slots["crew-slack-radar"] = existing
    slot, crew = asyncio.run(crew_runtime.ensure_crew_session(state, data, store.read_crew(data)))
    assert slot is existing and closed == [] and state.created == []
    assert store.read_crew(data)["slot_key"] == "crew-slack-radar"


def test_slot_key_generations_and_validation(tmp_path: Path) -> None:
    assert store.next_slot_key("crew-slack-radar") == "crew-slack-radar-g2"
    assert store.next_slot_key("crew-slack-radar-g2") == "crew-slack-radar-g3"
    assert store.is_crew_slot_key("crew-slack-radar-g9") and not store.is_crew_slot_key("crew-notes")
    store.crew_path(tmp_path).write_text(json.dumps({"slot_key": "chat-1-evil"}), encoding="utf-8")
    assert store.read_crew(tmp_path)["slot_key"] == "crew-slack-radar"  # a foreign key is never adopted
    with pytest.raises(store.StoreError):
        store.update_crew(tmp_path, {"slot_key": "chat-1-evil"})
