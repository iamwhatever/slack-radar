"""Tests for the crew roster (``desk/members.json``) and ``GET /org``.

Stdlib + pytest only, like the rest of the suite. ``routes.py`` imports aiohttp and
the host's route registry at module scope, neither of which CI installs, so both
are stubbed in ``sys.modules`` for the handler tests only.
"""

from __future__ import annotations

import asyncio
import copy
import json
import sys
import types
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import org, store  # noqa: E402


def _members() -> list[dict[str, Any]]:
    return json.loads((ROOT / "desk" / "members.json").read_text(encoding="utf-8"))


# ── members.json ───────────────────────────────────────────────────────────


def test_members_json_parses_and_validates() -> None:
    members = _members()
    assert org.validate_members(members) == []
    assert [m["id"] for m in members] == ["lead", "investigator", "watcher", "poller"]
    assert org.load_members() == members


def test_every_named_agent_ships_or_is_planned() -> None:
    shipped = {
        json.loads(p.read_text(encoding="utf-8"))["name"] for p in (ROOT / "agents").glob("*.json")
    }
    manifest = json.loads((ROOT / "app.json").read_text(encoding="utf-8"))
    for m in _members():
        if m["kind"] == "code":
            assert m["agent"] is None
            continue
        if m["residency"] != "planned":
            assert m["agent"] in shipped, f"{m['id']} names {m['agent']}, which agents/ does not ship"
            assert f"agents/{m['agent']}.json" in manifest["agents"]


def test_fixed_agent_names_match_the_code() -> None:
    by_id = {m["id"]: m for m in _members()}
    assert by_id["lead"]["agent"] == store.CREW_AGENT == "slack-radar-crew"
    assert by_id["investigator"]["agent"] == "slack-radar-investigator"
    assert by_id["watcher"]["agent"] == "slack-radar-watcher"


def test_toolsets_match_the_shipped_agents() -> None:
    # "ledger+shell" is the only member allowed execute_bash; the lead has spawn and no shell.
    for m in _members():
        path = ROOT / "agents" / f"{m['agent']}.json"
        if m["kind"] != "agent" or not path.exists():
            continue
        tools = json.loads(path.read_text(encoding="utf-8"))["tools"]
        assert "@slack-radar:ledger" in tools
        assert ("execute_bash" in tools) is (m["tools"] == "ledger+shell"), m["id"]
        assert ("@kirocrew-core/spawn_run" in tools) is (m["tools"] == "ledger+spawn"), m["id"]


@pytest.mark.parametrize(
    ("mutate", "needle"),
    [
        (lambda ms: ms.pop(), "missing members: poller"),
        (lambda ms: ms[0].update(residency="sometimes"), "residency"),
        (lambda ms: ms[0].update(tools="everything"), "tools"),
        (lambda ms: ms[0]["display"].pop("zh"), "display"),
        (lambda ms: ms[3].update(agent="slack-radar-poller"), "null for code"),
        (lambda ms: ms[1].update(agent=""), "must name an agent"),
        (lambda ms: ms[1].update(id="lead"), "repeated"),
        (lambda ms: ms[2].update(extra=1), "unknown fields"),
    ],
)
def test_validation_rejects_bad_shapes(mutate, needle: str) -> None:
    ms = copy.deepcopy(_members())
    mutate(ms)
    assert any(needle in e for e in org.validate_members(ms)), org.validate_members(ms)


def test_load_members_raises_on_bad_file(tmp_path: Path) -> None:
    bad = tmp_path / "members.json"
    bad.write_text("{not json", encoding="utf-8")
    with pytest.raises(org.MembersError):
        org.load_members(bad)
    bad.write_text("{}", encoding="utf-8")
    with pytest.raises(org.MembersError):
        org.load_members(bad)


# ── GET /org ───────────────────────────────────────────────────────────────


class _FakeSlot:
    def __init__(self, key: str, agent: str, running: bool = False) -> None:
        self.key = key
        self.agent = agent
        self.running = running
        self._trust_scope = ""


class _FakeState:
    def __init__(self) -> None:
        self._slots: dict[str, _FakeSlot] = {}

    def get_slot(self, key: str):
        return self._slots.get(key)


class _FakeSpawn:
    def __init__(self, done: set[str]) -> None:
        self.done = done

    def is_done(self, spawn_id: str) -> bool:
        return spawn_id in self.done


class _Resp:
    def __init__(self, body: Any, status: int = 200) -> None:
        self.body = body
        self.status = status


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
    import backend.routes as mod

    yield mod
    sys.modules.pop("backend.routes", None)


def _ctx(data: Path, spawn: Any = None) -> Any:
    return types.SimpleNamespace(data_dir=str(data), spawn=spawn)


def _seed_items(data: Path, items: dict[str, dict[str, Any]]) -> None:
    def _put(led: dict[str, Any]) -> None:
        for key, fields in items.items():
            led["items"][key] = {"key": key, **fields}

    store.mutate(data, _put)


def test_org_is_registered_next_to_state(routes) -> None:
    paths = [(r.method, r.path) for r in routes.register_routes(None)]
    assert paths[:2] == [("GET", "/state"), ("GET", "/org")]
    handler = {r.path: r.handler for r in routes.register_routes(None)}["/org"]
    assert handler is routes._handle_org  # a read: no owner gate, like /state


def test_org_paused_crew_with_no_session(routes, tmp_path: Path) -> None:
    resp = asyncio.run(routes._handle_org(_Req(_FakeState()), _ctx(tmp_path)))
    assert resp.status == 200 and resp.body["ok"] is True
    by_id = {m["id"]: m for m in resp.body["members"]}
    assert list(by_id) == ["lead", "investigator", "watcher", "poller"]
    assert by_id["lead"]["live"] == {
        "session_open": False, "running": False, "paused": True,
        "paused_reason": "", "slot_key": "crew-slack-radar",
    }
    assert by_id["investigator"]["live"] == {"in_flight": 0, "items": 0}
    assert by_id["watcher"]["live"] == {"in_flight": 0, "planned": True}
    assert by_id["poller"]["live"]["source_state"] == "ok"
    assert by_id["lead"]["display"] == {"en": "Radar Lead", "zh": "雷达组长"}  # members.json passed through


def test_org_live_running_crew_and_in_flight_investigations(routes, tmp_path: Path) -> None:
    store.update_crew(tmp_path, {"enabled": True})
    state = _FakeState()
    state._slots["crew-slack-radar"] = _FakeSlot("crew-slack-radar", "slack-radar-crew", running=True)
    _seed_items(tmp_path, {
        "C0AAAAAAA:1727184000.000001": {"status": "investigating", "investigation": "spawn s-1"},
        "C0AAAAAAA:1727184000.000002": {"status": "investigating", "investigation": "spawn s-1"},
        "C0AAAAAAA:1727184000.000003": {"status": "investigating", "investigation": "spawn s-2"},
        "C0AAAAAAA:1727184000.000004": {"status": "triaged", "investigation": "spawn s-3"},
    })
    resp = asyncio.run(routes._handle_org(_Req(state), _ctx(tmp_path, _FakeSpawn(done={"s-2"}))))
    by_id = {m["id"]: m for m in resp.body["members"]}
    assert by_id["lead"]["live"]["session_open"] is True
    assert by_id["lead"]["live"]["running"] is True and by_id["lead"]["live"]["paused"] is False
    # s-1 still running (two items share it); s-2 done; s-3 is on a triaged item, so not counted
    assert by_id["investigator"]["live"] == {"in_flight": 1, "items": 3}


def test_org_agrees_with_state(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend import settings as settings_mod

    monkeypatch.setattr(settings_mod, "read_settings", settings_mod.defaults)
    store.update_crew(tmp_path, {"enabled": True, "paused_reason": ""})
    state = _FakeState()
    state._slots["crew-slack-radar"] = _FakeSlot("crew-slack-radar", "slack-radar-crew")
    _seed_items(tmp_path, {"C0AAAAAAA:1727184000.000001": {"status": "investigating", "investigation": "spawn s-1"}})
    ctx = _ctx(tmp_path, _FakeSpawn(done=set()))
    st = asyncio.run(routes._handle_state(_Req(state), ctx)).body
    lead, inv = asyncio.run(routes._handle_org(_Req(state), ctx)).body["members"][:2]
    assert lead["live"]["session_open"] == st["crew"]["session_open"]
    assert lead["live"]["running"] == st["crew"]["running"]
    assert lead["live"]["paused"] is (not st["crew"]["live"])
    assert inv["live"] == {"in_flight": st["investigations"]["running"], "items": st["investigations"]["items"]}


def test_org_reports_a_broken_roster(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    bad = tmp_path / "members.json"
    bad.write_text("[]", encoding="utf-8")
    monkeypatch.setattr(org, "MEMBERS_PATH", bad)
    monkeypatch.setattr(org.load_members, "__defaults__", (bad,))
    resp = asyncio.run(routes._handle_org(_Req(_FakeState()), _ctx(tmp_path / "data")))
    assert resp.status == 500 and resp.body["code"] == "members_invalid"
