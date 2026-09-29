"""Tests for live per-member status (``org.now_view``, ``GET /now``) and ``member`` events.

Stdlib + pytest only. aiohttp and the host's route registry are stubbed in
``sys.modules`` for the handler tests, as in ``test_org.py``.
"""

from __future__ import annotations

import asyncio
import sys
import time
import types
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import crew_runtime, org, store  # noqa: E402

SLOT = "crew-slack-radar"
INV_TASK = "Investigate this cluster of Slack reports; notes at /home/someone/work/x.md and ~/tmp/y"


class _FakeSlot:
    def __init__(self, key: str, agent: str, running: bool = False) -> None:
        self.key, self.agent, self.running, self._trust_scope = key, agent, running, ""


class _FakeSubagents:
    """The host's ``running_agents_for``: unfinished runs of one parent only."""

    def __init__(self, runs: list[dict[str, Any]]) -> None:
        self.runs = runs
        self.asked: list[str] = []

    def running_agents_for(self, parent_key: str) -> list[dict[str, Any]]:
        self.asked.append(parent_key)
        return [
            {k: r[k] for k in ("id", "agent", "task", "startedAt")}
            for r in self.runs
            if r["parent"] == parent_key and not r["done"]
        ]


class _FakeState:
    def __init__(self, subagents: Any = None) -> None:
        self._slots: dict[str, _FakeSlot] = {}
        self.subagents = subagents

    def get_slot(self, key: str):
        return self._slots.get(key)


def _runs() -> list[dict[str, Any]]:
    return [
        {"id": "r-inv", "agent": "slack-radar-investigator", "task": INV_TASK,
         "startedAt": 1000.0, "parent": f"dashboard:{SLOT}", "done": False},
        {"id": "r-wat", "agent": "slack-radar-watcher", "task": "Judge 6 threads",
         "startedAt": 900.0, "parent": f"dashboard:{SLOT}", "done": True},
        {"id": "r-other", "agent": "slack-radar-investigator", "task": "someone else's run",
         "startedAt": 800.0, "parent": "dashboard:chat-1", "done": False},
    ]


def _seed_new(data: Path, n: int) -> None:
    def _put(led: dict[str, Any]) -> None:
        for i in range(n):
            key = f"C0AAAAAAA:1727184000.{i:06d}"
            led["items"][key] = {"key": key, "status": "new", "needs_triage": True}
        led["crew_memory"]["phase"] = "triaging"
        led["last_poll_at"] = time.time() - 42
        led["channels"] = {"C0AAAAAAA": {}}

    store.mutate(data, _put)


class _Resp:
    def __init__(self, body: Any, status: int = 200) -> None:
        self.body, self.status = body, status


class _Req(dict):
    def __init__(self, state: Any) -> None:
        super().__init__()
        self.app = {"state": state}


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
    from backend import settings as settings_mod

    monkeypatch.setattr(settings_mod, "read_settings", settings_mod.defaults)
    import backend.routes as mod

    yield mod
    sys.modules.pop("backend.routes", None)


def _ctx(data: Path) -> Any:
    return types.SimpleNamespace(data_dir=str(data), spawn=None)


@pytest.fixture
def live_crew(tmp_path: Path):
    store.update_crew(tmp_path, {"enabled": True})
    _seed_new(tmp_path, 13)
    state = _FakeState(_FakeSubagents(_runs()))
    state._slots[SLOT] = _FakeSlot(SLOT, "slack-radar-crew", running=True)
    return tmp_path, state


# ── the builder ────────────────────────────────────────────────────────────


def test_four_member_rows_from_gateway_runs(routes, live_crew) -> None:
    data, state = live_crew
    body = asyncio.run(routes._handle_now(_Req(state), _ctx(data))).body
    assert body["ok"] is True
    rows = {r["id"]: r for r in body["members"]}
    assert list(rows) == ["lead", "investigator", "watcher", "poller"]

    lead = rows["lead"]
    assert (lead["state"], lead["doing"], lead["source"], lead["count"]) == (
        "working", "triaging 13 new items", "gateway", 1)
    assert lead["since"] and lead["since"] > 0

    inv = rows["investigator"]
    assert (inv["state"], inv["count"], inv["source"], inv["since"]) == ("working", 1, "gateway", 1000.0)
    assert inv["doing"].startswith("Investigate this cluster of Slack reports")
    assert "/home" not in inv["doing"] and "~/" not in inv["doing"] and len(inv["doing"]) <= 80

    wat = rows["watcher"]  # its only run is done
    assert (wat["state"], wat["count"], wat["source"]) == ("idle", 0, "gateway")

    pol = rows["poller"]
    assert pol["state"] == "idle" and pol["source"] == "ledger" and pol["count"] == 1
    assert pol["doing"].startswith("last poll 4") and "· next in 4m" in pol["doing"]

    assert state.subagents.asked and set(state.subagents.asked) == {f"dashboard:{SLOT}"}


def test_running_watcher_reads_working(routes, live_crew) -> None:
    data, state = live_crew
    for r in state.subagents.runs:
        if r["id"] == "r-wat":
            r["done"] = False
    rows = {r["id"]: r for r in asyncio.run(routes._handle_now(_Req(state), _ctx(data))).body["members"]}
    wat = rows["watcher"]
    assert (wat["state"], wat["count"], wat["doing"], wat["since"]) == ("working", 1, "Judge 6 threads", 900.0)


def test_ledger_fallback_without_a_run_list(routes, live_crew) -> None:
    data, state = live_crew
    state.subagents = None
    rows = {r["id"]: r for r in asyncio.run(routes._handle_now(_Req(state), _ctx(data))).body["members"]}
    assert rows["investigator"]["source"] == "ledger" and rows["investigator"]["count"] == 0
    assert rows["watcher"]["source"] == "ledger"


def test_paused_and_idle_lead() -> None:
    led = store.empty_ledger()
    row = org.now_view(crew={"live": False, "paused_reason": "paused by owner"}, ledger=led,
                       investigations={})["members"][0]
    assert (row["state"], row["doing"], row["source"]) == ("paused", "paused by owner", "ledger")
    row = org.now_view(crew={"live": True, "session_open": True}, ledger=led, investigations={})["members"][0]
    assert (row["state"], row["doing"]) == ("idle", "idle")


def test_lead_digest_and_rechecking_lines() -> None:
    led = store.empty_ledger()
    led["digest"]["requested_at"] = 5.0
    crew = {"live": True, "running": True}
    assert org.now_view(crew=crew, ledger=led, investigations={})["members"][0]["doing"] == "writing the digest"
    led["crew_memory"]["phase"] = "rechecking"
    led["items"] = {"k": {"possibly_resolved": "reply says fixed"}, "j": {"possibly_resolved": "x"}}
    assert org.now_view(crew=crew, ledger=led, investigations={})["members"][0]["doing"] == (
        "judging 2 possibly-resolved threads")


def test_open_spawn_ids_add_once() -> None:
    runs = [{"id": "a", "agent": "slack-radar--slack-radar-investigator", "task": "t", "startedAt": 1}]
    view = org.now_view(crew={}, ledger=store.empty_ledger(), investigations={}, runs=runs,
                        open_spawn_ids=frozenset({"a", "b"}))
    inv = view["members"][1]
    assert inv["count"] == 2 and inv["doing"] == "t (+1 more)"


def test_task_line_keeps_urls_and_cuts_paths() -> None:
    assert org.task_line("see https://github.com/o/r/issues/1 and /etc/x") == (
        "see https://github.com/o/r/issues/1 and …")
    assert org.task_line("first\nsecond") == "first"


# ── one builder, two consumers ─────────────────────────────────────────────


def test_org_view_reuses_the_now_rows(routes, live_crew, monkeypatch: pytest.MonkeyPatch) -> None:
    data, state = live_crew
    built: list[dict[str, Any]] = []
    real = org.now_view

    def spy(**kw):
        built.append(real(**kw))
        return built[-1]

    monkeypatch.setattr(org, "now_view", spy)
    members = asyncio.run(routes._handle_org(_Req(state), _ctx(data))).body["members"]
    assert len(built) == 1
    assert [m["live"]["now"] for m in members] == built[0]["members"]
    by_id = {m["id"]: m for m in members}
    assert by_id["investigator"]["live"]["in_flight"] == 1 and by_id["watcher"]["live"]["in_flight"] == 0

    st = asyncio.run(routes._handle_state(_Req(state), _ctx(data))).body
    assert len(built) == 2
    assert st["now"] == built[1]


def test_now_route_is_registered_as_a_read(routes) -> None:
    handlers = {(r.method, r.path): r.handler for r in routes.register_routes(None)}
    assert handlers[("GET", "/now")] is routes._handle_now


# ── member events ──────────────────────────────────────────────────────────


def test_member_events_on_start_and_finish(routes, live_crew) -> None:
    data, state = live_crew
    asyncio.run(routes._handle_now(_Req(state), _ctx(data)))
    asyncio.run(routes._handle_now(_Req(state), _ctx(data)))  # no change: no second event
    rows = [e for e in store.read_events(data) if e["kind"] == "member"]
    assert [e["text"][:34] for e in rows] == ["investigator started: Investigate "]
    assert "/home" not in rows[0]["text"]

    state.subagents.runs[0]["done"] = True
    asyncio.run(routes._handle_now(_Req(state), _ctx(data)))
    rows = [e["text"] for e in store.read_events(data) if e["kind"] == "member"]
    assert rows[-1] == "investigator finished"


def test_no_run_list_never_reads_as_everything_finished(tmp_path: Path) -> None:
    crew_runtime.observe_member_runs(tmp_path, [{"id": "w", "agent": "slack-radar-watcher", "task": "judge"}])
    assert crew_runtime.observe_member_runs(tmp_path, None) == []
    assert crew_runtime.observe_member_runs(tmp_path, []) == ["watcher finished"]


def test_after_poll_observes_runs_even_when_paused(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = _FakeState(_FakeSubagents(_runs()))
    monkeypatch.setattr(crew_runtime, "_gateway_state", lambda: state)
    monkeypatch.setattr(crew_runtime, "revoke", lambda *a, **k: None)
    assert asyncio.run(crew_runtime.after_poll(tmp_path, {})) is False
    assert [e["text"][:21] for e in store.read_events(tmp_path)] == ["investigator started:"]


# ── since for runs the Board started ───────────────────────────────────────


class _Spawn:
    def __init__(self, open_ids: set[str]) -> None:
        self.open_ids = open_ids

    def is_done(self, sid: str) -> bool:
        return sid not in self.open_ids


def _investigating(data: Path, key: str, spawn: str, at: float) -> None:
    def _put(led: dict[str, Any]) -> None:
        led["items"][key] = {"key": key, "status": "investigating", "investigation": f"spawn {spawn}",
                             "investigation_at": at, "updated_at": at + 500}

    store.mutate(data, _put)


def test_board_spawn_fills_since_when_no_listed_run(routes, live_crew) -> None:
    data, state = live_crew
    state.subagents.runs = []
    _investigating(data, "C0AAAAAAA:1727184100.000001", "s-1", 700.0)
    ctx = types.SimpleNamespace(data_dir=str(data), spawn=_Spawn({"s-1"}))
    inv = asyncio.run(routes._handle_now(_Req(state), ctx)).body["members"][1]
    assert (inv["state"], inv["count"], inv["since"], inv["doing"]) == ("working", 1, 700.0, "1 run in flight")


def test_older_board_spawn_moves_since_back(routes, live_crew) -> None:
    data, state = live_crew
    _investigating(data, "C0AAAAAAA:1727184100.000001", "s-1", 700.0)
    ctx = types.SimpleNamespace(data_dir=str(data), spawn=_Spawn({"s-1"}))
    inv = asyncio.run(routes._handle_now(_Req(state), ctx)).body["members"][1]
    assert (inv["count"], inv["since"]) == (2, 700.0)


def test_finished_board_spawn_gives_no_since(routes, live_crew) -> None:
    data, state = live_crew
    state.subagents.runs = []
    _investigating(data, "C0AAAAAAA:1727184100.000001", "s-1", 700.0)
    ctx = types.SimpleNamespace(data_dir=str(data), spawn=_Spawn(set()))
    inv = asyncio.run(routes._handle_now(_Req(state), ctx)).body["members"][1]
    assert (inv["state"], inv["count"], inv["since"]) == ("idle", 0, None)


def test_record_stamps_investigation_at_only_on_change(monkeypatch: pytest.MonkeyPatch) -> None:
    key = "C0AAAAAAA:1727184100.000001"
    led = store.empty_ledger()
    led["items"][key] = {"key": key, "status": "triaged", "investigation": ""}
    monkeypatch.setattr(store, "now", lambda: 1234.0)
    assert key in store.apply_crew_record(led, {"items": [{"key": key, "investigation": "spawn s-9"}]})["applied"]
    assert led["items"][key]["investigation_at"] == 1234.0
    monkeypatch.setattr(store, "now", lambda: 9999.0)
    store.apply_crew_record(led, {"items": [{"key": key, "investigation": "spawn s-9", "note": "same"}]})
    assert led["items"][key]["investigation_at"] == 1234.0
