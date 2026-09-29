"""Slack Radar — a dispatched conductor session rides the crew's scoped grant.

Under unattended mode the Dispatch fix click puts the new session on the crew's
``SafetyOverride`` scope before its seed runs; every poll holds it (and the workers
the gateway minted for it) in step, and pausing the crew or turning unattended off
takes it away. ``slot._trust`` (a human's click) is never written.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest

from test_dispatch import _post, _State, fixable
from test_needs import _Req, _ctx, _route, _seed, routes  # noqa: F401
from test_slack_radar import _FakeGrant

from backend import crew_runtime, store

SCOPE = crew_runtime.TRUST_SCOPE
LIVE = {"enabled": True, "paused_reason": "", "unattended": True}


@pytest.fixture
def grant(monkeypatch: pytest.MonkeyPatch) -> _FakeGrant:
    g = _FakeGrant()
    monkeypatch.setattr(crew_runtime, "_safety_override", lambda: g)
    monkeypatch.setattr(crew_runtime, "_scoped_keys", set())
    return g


class _TrustState(_State):
    """The dispatch fake plus the loop-owned slot map the sync walks."""

    @property
    def _slots(self) -> dict[str, Any]:
        return self.slots


def _worker(state: _TrustState, key: str, parent: str, *, minted: bool = True) -> Any:
    slot = type("W", (), {})()
    slot.key, slot._trust_scope, slot._trust = key, "", False
    slot._created_by, slot._lineage_minted = parent, minted
    state.slots[key] = slot
    return slot


def _dispatched(state: _TrustState, *keys: str) -> dict[str, Any]:
    items = {}
    for i, k in enumerate(keys):
        items[f"C0AAAAAAA:1727184000.00000{i}"] = {"fix_handoff": {"dispatch": {"session_key": k}}}
        if k not in state.slots:
            state.get_or_create_slot(None, agent="kirocrew-conductor")
    return {"items": items}


def test_dispatch_under_unattended_trusts_the_session_before_the_seed(routes, tmp_path: Path, grant) -> None:
    store.update_crew(tmp_path, {"enabled": True, "unattended": True})
    it = fixable(1)
    _seed(tmp_path, it)
    state = _TrustState()
    seen: list[str] = []
    real = state.get_or_create_slot

    def create(name: Any = None, **kw: Any) -> Any:
        slot = real(name, **kw)
        slot._trust_scope, slot._trust = "", False
        run = slot.enqueue_or_run_prompt
        slot.enqueue_or_run_prompt = lambda p, r, s: (seen.append(slot._trust_scope), run(p, r, s))[1]
        return slot

    state.get_or_create_slot = create
    resp = _post(routes, tmp_path, {"key": it["key"]}, state)
    assert resp.status == 200 and resp.body["trusted"] is True and "why" not in resp.body
    slot = state.slots[resp.body["session_key"]]
    assert seen == [SCOPE] and slot._trust_scope == SCOPE and slot._trust is False
    assert store.read_ledger(tmp_path)["items"][it["key"]]["fix_handoff"]["dispatch"]["trusted"] is True
    assert grant.calls == [f"activate {SCOPE} slack-radar-crew 900"]


def test_dispatch_with_unattended_off_stays_untrusted_and_says_why(routes, tmp_path: Path, grant) -> None:
    store.update_crew(tmp_path, {"enabled": True, "unattended": False})
    it = fixable(1)
    _seed(tmp_path, it)
    state = _TrustState()
    resp = _post(routes, tmp_path, {"key": it["key"]}, state)
    assert resp.status == 200 and resp.body["trusted"] is False and resp.body["why"] == "unattended mode is off"
    slot = state.slots[resp.body["session_key"]]
    assert getattr(slot, "_trust_scope", "") == "" and not getattr(slot, "_trust", False)
    assert store.read_ledger(tmp_path)["items"][it["key"]]["fix_handoff"]["dispatch"]["trusted"] is False
    assert grant.calls == []  # nothing touches the grant without unattended


def test_batch_dispatch_under_unattended_trusts_the_one_session(routes, tmp_path: Path, grant) -> None:
    store.update_crew(tmp_path, {"enabled": True, "unattended": True})
    a, b = fixable(1), fixable(2)
    _seed(tmp_path, a, b)
    state = _TrustState()
    req = _Req({"keys": [a["key"], b["key"]]}, app="slack-radar")
    req.app["state"] = state
    resp = asyncio.run(_route(routes, "POST", "/items/handoff/dispatch-batch")(req, _ctx(tmp_path)))
    assert resp.status == 200 and resp.body["trusted"] is True
    assert state.slots[resp.body["session_key"]]._trust_scope == SCOPE
    items = store.read_ledger(tmp_path)["items"]
    assert items[a["key"]]["fix_handoff"]["dispatch"]["trusted"] is True
    assert items[b["key"]]["fix_handoff"]["dispatch"]["trusted"] is True


def test_paused_crew_does_not_trust_a_dispatch() -> None:
    assert crew_runtime.dispatch_grant({**LIVE, "enabled": False}) == (False, "the crew is paused")
    assert crew_runtime.dispatch_grant({**LIVE, "unattended": False}) == (False, "unattended mode is off")


def test_poll_sync_holds_then_clears_the_scope(grant) -> None:
    state = _TrustState()
    led = _dispatched(state, "chat-1-1")
    slot = state.slots["chat-1-1"]
    slot._trust_scope, slot._trust = "", False
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE)) == ["chat-1-1"]
    assert slot._trust_scope == SCOPE and grant.calls == [f"activate {SCOPE} slack-radar-crew 900"]
    # The crew slot already renewed this cycle: no second grant write.
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE, True)) == ["chat-1-1"]
    assert len(grant.calls) == 1

    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, {**LIVE, "unattended": False})) == []
    assert slot._trust_scope == "" and slot._trust is False
    asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE))
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, {**LIVE, "paused_reason": "paused"})) == []
    assert slot._trust_scope == ""


def test_poll_sync_skips_closed_sessions_and_clears_one_that_left(grant) -> None:
    state = _TrustState()
    led = _dispatched(state, "chat-1-1", "chat-2-1")
    for s in state.slots.values():
        s._trust_scope = ""
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE)) == ["chat-1-1", "chat-2-1"]
    gone = state.slots.pop("chat-2-1")
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE)) == ["chat-1-1"]
    assert gone._trust_scope == SCOPE  # a closed slot is not read or written
    # A session no longer on the ledger comes off the grant.
    state.slots["chat-2-1"] = gone
    assert asyncio.run(crew_runtime.sync_dispatch_trust(state, _dispatched(state, "chat-1-1"), LIVE)) == ["chat-1-1"]
    assert gone._trust_scope == ""


def test_poll_sync_follows_minted_workers_only(grant) -> None:
    state = _TrustState()
    led = _dispatched(state, "chat-1-1")
    state.slots["chat-1-1"]._trust_scope = ""
    child = _worker(state, "chat-5-1", "chat-1-1")
    grandchild = _worker(state, "chat-6-1", "chat-5-1")
    restored = _worker(state, "chat-7-1", "chat-1-1", minted=False)
    stranger = _worker(state, "chat-8-1", "chat-9-9")
    keys = asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE))
    assert keys == ["chat-1-1", "chat-5-1", "chat-6-1"]
    assert child._trust_scope == grandchild._trust_scope == SCOPE
    assert restored._trust_scope == "" and stranger._trust_scope == ""
    assert child._trust is False


def test_revoke_clears_dispatched_sessions_and_workers(grant) -> None:
    state = _TrustState()
    led = _dispatched(state, "chat-1-1")
    conductor = state.slots["chat-1-1"]
    conductor._trust_scope, conductor._trust = "", True  # the owner clicked Trust on it
    child = _worker(state, "chat-5-1", "chat-1-1")
    asyncio.run(crew_runtime.sync_dispatch_trust(state, led, LIVE))
    assert conductor._trust_scope == child._trust_scope == SCOPE
    crew_runtime.revoke(state, LIVE)
    assert conductor._trust_scope == "" and child._trust_scope == ""
    assert conductor._trust is True  # the owner's own click stays theirs
    assert grant.calls[-1] == f"deactivate {SCOPE}"


def test_needs_row_shows_the_live_trust(routes, tmp_path: Path, grant) -> None:
    from test_dispatch import _get
    from test_needs import group

    store.update_crew(tmp_path, {"enabled": True, "unattended": True})
    it = fixable(1)
    _seed(tmp_path, it)
    state = _TrustState()
    key = _post(routes, tmp_path, {"key": it["key"]}, state).body["session_key"]
    [row] = group(_get(routes, tmp_path, "/needs", state).body, "decide")["entries"]
    assert row["dispatch"]["trusted"] is True
    state.slots[key]._trust_scope = ""
    [row] = group(_get(routes, tmp_path, "/needs", state).body, "decide")["entries"]
    assert row["dispatch"]["trusted"] is False


def test_every_poll_runs_the_dispatch_sync(tmp_path: Path, grant, monkeypatch: pytest.MonkeyPatch) -> None:
    state = _TrustState()
    store.update_crew(tmp_path, {"enabled": True, "unattended": True})
    conductor = state.get_or_create_slot(None, agent="kirocrew-conductor")
    conductor._trust_scope = ""
    it = fixable(1)
    it["fix_handoff"]["dispatch"] = {"session_key": conductor.key}
    _seed(tmp_path, it)
    monkeypatch.setattr(crew_runtime, "_gateway_state", lambda: state)
    monkeypatch.setattr(crew_runtime, "check_tool_version", lambda st, d, c: _done((False, c)))
    asyncio.run(crew_runtime.after_poll(tmp_path, {}, reason="timer"))
    assert conductor._trust_scope == SCOPE
    store.update_crew(tmp_path, {"unattended": False})
    asyncio.run(crew_runtime.after_poll(tmp_path, {}, reason="timer"))
    assert conductor._trust_scope == ""
    store.update_crew(tmp_path, {"unattended": True})
    asyncio.run(crew_runtime.after_poll(tmp_path, {}, reason="timer"))
    assert conductor._trust_scope == SCOPE
    store.update_crew(tmp_path, {"enabled": False, "paused_reason": "paused by owner"})
    asyncio.run(crew_runtime.after_poll(tmp_path, {}, reason="timer"))
    assert conductor._trust_scope == ""


async def _done(value: Any) -> Any:
    return value
