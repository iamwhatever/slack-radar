"""Each member's last run on ``GET /now``, and the Thread Watcher dispatched once per poll.

Stdlib + pytest only; the route handlers run against the stubbed aiohttp from
``test_now.py``.
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

from backend import crew_runtime, org, store, watch  # noqa: E402
from tests.test_now import SLOT, _FakeSlot, _FakeState, _FakeSubagents, _Req, routes  # noqa: E402,F401


class _Spawn:
    """The app spawn SDK: ``run`` returns an id, ``is_done`` answers per id."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, str]] = []
        self.open: set[str] = set()

    async def run(self, task: str, agent: str, silent: bool = False) -> str:
        sid = f"sp-{len(self.calls) + 1}"
        self.calls.append((task, agent))
        self.open.add(sid)
        return sid

    def is_done(self, sid: str) -> bool:
        return sid not in self.open


def _flag(data: Path, key: str, *, status: str = "triaged", watcher_at: float = 0.0, ts: float = 1.0) -> None:
    def _put(led: dict[str, Any]) -> None:
        flag: dict[str, Any] = {"reason": "reply by another user says “fixed”", "at": 5.0}
        if watcher_at:
            flag["watcher_at"] = watcher_at
        led["items"][key] = {
            "key": key, "status": status, "ts_float": time.time() - 100 + ts, "text": "export is broken",
            "replies": [{"ts": "2.0", "user": "U2", "text": "fixed in 1.4"}],
            "possibly_resolved": flag,
        }

    store.mutate(data, _put)


@pytest.fixture
def live(tmp_path: Path) -> Path:
    store.update_crew(tmp_path, {"enabled": True})
    return tmp_path


def _member_lines(data: Path) -> list[str]:
    return [e["text"] for e in store.read_events(data) if e["kind"] == "member"]


# ── the Watcher dispatch guard ─────────────────────────────────────────────


def test_one_watcher_run_batches_every_new_flag(live: Path) -> None:
    _flag(live, "C0A:1.000001", ts=1)
    _flag(live, "C0A:1.000002", ts=2)
    _flag(live, "C0A:1.000003", ts=3)
    _flag(live, "C0A:1.000004", status="resolved")  # closed: not judged again
    _flag(live, "C0A:1.000005", watcher_at=9.0)  # already given to a Watcher
    spawn = _Spawn()

    sid = asyncio.run(crew_runtime.dispatch_watcher(live, spawn))

    assert sid == "sp-1" and len(spawn.calls) == 1
    task, agent = spawn.calls[0]
    assert agent == org.WATCHER_AGENT
    for key in ("C0A:1.000001", "C0A:1.000002", "C0A:1.000003"):
        assert key in task
    assert "C0A:1.000004" not in task and "C0A:1.000005" not in task
    assert "UNTRUSTED DATA" in task and "fixed in 1.4" in task
    items = store.read_ledger(live)["items"]
    assert all(items[k]["possibly_resolved"]["watcher_at"] > 0 for k in ("C0A:1.000001", "C0A:1.000003"))
    assert _member_lines(live) == ["watcher started: judging 3 possibly-resolved thread(s)"]
    row = store.read_member_last(live)["watcher"]
    assert row["spawn_id"] == "sp-1" and row["started_at"] > 0 and not row["finished_at"]


def test_no_second_watcher_while_one_is_in_flight(live: Path) -> None:
    spawn = _Spawn()
    _flag(live, "C0A:1.000001")
    asyncio.run(crew_runtime.dispatch_watcher(live, spawn))
    _flag(live, "C0A:1.000002")  # a new flag lands while the first run is going

    assert asyncio.run(crew_runtime.dispatch_watcher(live, spawn)) == ""
    assert len(spawn.calls) == 1

    spawn.open.clear()  # the host reports the run finished
    assert asyncio.run(crew_runtime.dispatch_watcher(live, spawn)) == "sp-2"
    assert "C0A:1.000002" in spawn.calls[1][0] and "C0A:1.000001" not in spawn.calls[1][0]
    assert _member_lines(live)[1] == "watcher finished"


def test_a_flag_the_watcher_left_is_not_dispatched_again(live: Path) -> None:
    spawn = _Spawn()
    _flag(live, "C0A:1.000001")
    asyncio.run(crew_runtime.dispatch_watcher(live, spawn))
    spawn.open.clear()
    assert asyncio.run(crew_runtime.dispatch_watcher(live, spawn)) == ""
    assert len(spawn.calls) == 1
    assert store.read_member_last(live)["watcher"]["finished_at"] > 0


def test_no_watcher_when_paused_or_without_a_spawn_sdk(live: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _flag(live, "C0A:1.000001")
    monkeypatch.setattr(crew_runtime, "_spawn", None)
    assert asyncio.run(crew_runtime.dispatch_watcher(live, None)) == ""
    store.update_crew(live, {"paused_reason": "owner"})
    spawn = _Spawn()
    assert asyncio.run(crew_runtime.dispatch_watcher(live, spawn)) == ""
    assert spawn.calls == []


def test_poll_once_dispatches_the_watcher_once_per_cycle(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend import settings as settings_mod

    calls: list[Path] = []

    async def _dispatch(data_dir: Path, spawn: Any = None) -> str:
        calls.append(data_dir)
        return "sp-1"

    async def _after(*_a: Any, **_k: Any) -> bool:
        return False

    monkeypatch.setattr(settings_mod, "read_settings", settings_mod.defaults)
    monkeypatch.setattr(crew_runtime, "dispatch_watcher", _dispatch)
    monkeypatch.setattr(crew_runtime, "after_poll", _after)
    monkeypatch.setattr(watch, "_last_cycle_at", 0.0)
    summary = asyncio.run(watch.poll_once(tmp_path, client_factory=lambda s: None))
    assert calls == [tmp_path] and summary["watcher"] == "sp-1"
    # A cycle that found nothing (here: no channels) still counts as a run.
    assert summary["skipped"] == "no channels configured" and watch._last_cycle_at > 0


# ── last-run times on GET /now ─────────────────────────────────────────────


def _ctx(data: Path, spawn: Any = None) -> Any:
    return types.SimpleNamespace(data_dir=str(data), spawn=spawn)


def _rows(routes, data: Path, state: Any, spawn: Any = None) -> dict[str, dict[str, Any]]:
    body = asyncio.run(routes._handle_now(_Req(state), _ctx(data, spawn))).body
    return {r["id"]: r for r in body["members"]}


def test_every_row_says_when_it_last_ran(routes, live: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    state = _FakeState(_FakeSubagents([]))
    state._slots[SLOT] = _FakeSlot(SLOT, "slack-radar-crew")
    store.note_member_run(live, "lead", started_at=1000.0)
    store.note_member_run(live, "investigator", started_at=2000.0, spawn_id="")
    store.note_member_run(live, "investigator", finished_at=2300.0)
    monkeypatch.setattr(watch, "cycle_times", lambda: {"last_at": 3000.0, "next_at": 3300.0})

    rows = _rows(routes, live, state)

    assert (rows["lead"]["last"], rows["lead"]["ran"]) == ({"started_at": 1000.0, "finished_at": None}, "idle")
    assert (rows["investigator"]["last"], rows["investigator"]["ran"]) == (
        {"started_at": 2000.0, "finished_at": 2300.0}, "idle")
    assert (rows["watcher"]["last"], rows["watcher"]["ran"]) == ({"started_at": None, "finished_at": None}, "never")
    pol = rows["poller"]
    assert pol["last"]["started_at"] == 3000.0 and pol["next_at"] == 3300.0 and pol["ran"] == "idle"


def test_poller_falls_back_to_the_ledger_and_the_interval(routes, live: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    store.mutate(live, lambda led: led.update(last_poll_at=5000.0))
    monkeypatch.setattr(watch, "cycle_times", lambda: {"last_at": None, "next_at": None})
    pol = _rows(routes, live, _FakeState(None))["poller"]
    assert pol["last"]["started_at"] == 5000.0 and pol["next_at"] == 5300.0


def test_app_spawned_watcher_reads_running_then_finished(routes, live: Path) -> None:
    spawn = _Spawn()
    _flag(live, "C0A:1.000001")
    asyncio.run(crew_runtime.dispatch_watcher(live, spawn))
    state = _FakeState(_FakeSubagents([]))

    wat = _rows(routes, live, state, spawn)["watcher"]
    assert (wat["state"], wat["ran"], wat["count"]) == ("working", "running", 1)
    assert wat["since"] == wat["last"]["started_at"]

    spawn.open.clear()
    wat = _rows(routes, live, state, spawn)["watcher"]
    assert (wat["state"], wat["ran"]) == ("idle", "idle") and wat["last"]["finished_at"]
    assert _member_lines(live)[-1] == "watcher finished"


def test_child_runs_keep_a_last_run_and_skip_app_spawns(tmp_path: Path) -> None:
    run = {"id": "r1", "agent": "slack-radar-investigator", "task": "look", "startedAt": 700.0}
    crew_runtime.observe_member_runs(tmp_path, [run])
    assert store.read_member_last(tmp_path)["investigator"]["started_at"] == 700.0
    crew_runtime.observe_member_runs(tmp_path, [])
    assert store.read_member_last(tmp_path)["investigator"]["finished_at"] > 0

    store.note_member_run(tmp_path, "watcher", started_at=800.0, spawn_id="sp-9")
    assert crew_runtime.observe_member_runs(
        tmp_path, [{"id": "sp-9", "agent": "slack-radar-watcher", "task": "judge"}]) == []


def test_a_wake_records_the_leads_last_wake(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from tests.test_wake import _WakeState

    from backend import settings as settings_mod

    monkeypatch.setattr(settings_mod, "read_settings", settings_mod.defaults)
    store.update_crew(tmp_path, {"enabled": True})
    state = _WakeState()
    assert asyncio.run(crew_runtime.wake_crew(state, tmp_path, "1 new")) is True
    assert store.read_member_last(tmp_path)["lead"]["started_at"] > 0


# ── the nudge names the Watcher's mode ─────────────────────────────────────


def test_nudge_names_the_watcher_mode(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend import settings as settings_mod

    crew = store.read_crew(tmp_path)
    monkeypatch.setattr(crew_runtime, "_spawn", None)
    snap = crew_runtime.build_snapshot(tmp_path, settings_mod.defaults(), crew)
    assert "not available" in crew_runtime.compose_nudge(snap)

    monkeypatch.setattr(crew_runtime, "_spawn", _Spawn())
    snap = crew_runtime.build_snapshot(tmp_path, settings_mod.defaults(), crew)
    assert "watcher_at" in crew_runtime.compose_nudge(snap)

    store.note_member_run(tmp_path, "watcher", started_at=1.0, spawn_id="sp-1")
    snap = crew_runtime.build_snapshot(tmp_path, settings_mod.defaults(), crew)
    assert "judging the possibly-resolved threads now" in crew_runtime.compose_nudge(snap)
