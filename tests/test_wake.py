"""The poller wakes the Lead on a gateway with no Slack bot, and never swallows a wake.

``after_poll`` resolves the gateway state through the Slack bot's published handle
first and the http app's ``state`` second. These tests pin both handles, then check
who gets a turn: the fake slot records every prompt handed to it.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import types
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import crew_runtime, hooks, settings as settings_mod, store  # noqa: E402
from tests.test_slack_radar import _FakeSlot, _FakeState  # noqa: E402


class _WakeSlot(_FakeSlot):
    def __init__(self, key: str, agent: str) -> None:
        super().__init__(key, agent)
        self.running = False
        self.prompts: list[str] = []

    def enqueue_or_run_prompt(self, prompt: str, fn: Any, st: Any) -> bool:
        self.prompts.append(prompt)
        return True


class _WakeState(_FakeState):
    def get_or_create_slot(self, *, name: str, agent: str, **_kw):
        if name not in self._slots:
            self.created.append((name, agent))
            self._slots[name] = _WakeSlot(name, agent)
        return self._slots[name]


class _HttpApp(dict):
    """aiohttp's Application is a mapping; ``app["state"]`` is what routes read."""


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    handler = types.ModuleType("kiro_crew.slack.handler")
    handler.get_dashboard_state = lambda: None  # type: ignore[attr-defined]  # no Slack bot
    for name in ("kiro_crew", "kiro_crew.slack"):
        monkeypatch.setitem(sys.modules, name, types.ModuleType(name))
    monkeypatch.setitem(sys.modules, "kiro_crew.slack.handler", handler)
    monkeypatch.setattr(settings_mod, "read_settings", lambda: settings_mod.defaults())
    monkeypatch.setattr(crew_runtime, "_safety_override", lambda: None)
    monkeypatch.setattr(crew_runtime, "_pending_wake", "")
    monkeypatch.setattr(crew_runtime, "_last_backlog_wake", 0.0)
    monkeypatch.setattr(crew_runtime, "_warned_no_state", False)
    monkeypatch.setattr(crew_runtime, "_http_app", None)
    store.update_crew(tmp_path, {"enabled": True})
    # The slot below was started under the installed version (what creating it records).
    store.write_crew_session(tmp_path, "crew-slack-radar", store.installed_version(), awaiting=False)
    state = _WakeState()
    state._slots["crew-slack-radar"] = _WakeSlot("crew-slack-radar", "slack-radar-crew")
    return state, handler, tmp_path


def _poll(data: Path, summary: dict[str, Any]) -> bool:
    return asyncio.run(crew_runtime.after_poll(data, summary, reason="timer"))


def _slot(state: _WakeState) -> _WakeSlot:
    return state._slots["crew-slack-radar"]


def test_no_slack_bot_wakes_the_lead_from_the_http_app_state(env) -> None:
    state, _handler, data = env
    source = crew_runtime.bind_http_app(_HttpApp(state=state))
    assert source == "http-app"
    assert _poll(data, {"new": 2}) is True
    [prompt] = _slot(state).prompts
    assert prompt.startswith("[crew wake: 2 new, 0 thread updates, 0 possibly resolved]")


def test_slack_handler_state_stays_the_first_choice(env) -> None:
    state, handler, data = env
    bot_state = _WakeState()
    bot_state._slots["crew-slack-radar"] = _WakeSlot("crew-slack-radar", "slack-radar-crew")
    handler.get_dashboard_state = lambda: bot_state  # type: ignore[attr-defined]
    assert crew_runtime.bind_http_app(_HttpApp(state=state)) == "slack-handler"
    assert _poll(data, {"new": 1}) is True
    assert _slot(bot_state).prompts and not _slot(state).prompts


def test_no_state_anywhere_means_no_wake_and_one_warning(env, caplog: pytest.LogCaptureFixture) -> None:
    state, _handler, data = env
    crew_runtime.bind_http_app(_HttpApp())  # an http app with no state set
    caplog.clear()
    with caplog.at_level(logging.WARNING, logger="kirocrew.app.slack-radar"):
        assert _poll(data, {"new": 1}) is False
        assert _poll(data, {"new": 1}) is False
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert len(warnings) == 1 and "no gateway state" in warnings[0].getMessage()
    assert not _slot(state).prompts


def test_thread_updates_only_poll_wakes(env) -> None:
    state, _handler, data = env
    crew_runtime.bind_http_app(_HttpApp(state=state))
    assert _poll(data, {"thread_changed": 1}) is True
    assert _slot(state).prompts[0].startswith("[crew wake: 0 new, 1 thread updates")


def test_leftover_thread_updates_are_re_offered_on_the_backlog_timer(env) -> None:
    state, _handler, data = env
    crew_runtime.bind_http_app(_HttpApp(state=state))
    store.mutate(data, lambda led: led.setdefault("items", {}).update(
        {"C1:1.0": {"key": "C1:1.0", "ts_float": 1.0, "status": "triaged", "updated_at": 9e9, "thread_changed": True}}
    ))
    assert _poll(data, {}) is True
    assert _slot(state).prompts[-1].startswith("[crew wake: backlog]")
    assert _poll(data, {}) is False  # throttled until BACKLOG_REWAKE_SECS pass


def test_digest_due_wakes(env) -> None:
    state, _handler, data = env
    crew_runtime.bind_http_app(_HttpApp(state=state))
    store.mutate(data, lambda led: led.__setitem__("digest", {"requested_at": "2026-01-01T00:00:00Z"}))
    assert _poll(data, {}) is True
    assert _slot(state).prompts[-1].startswith("[crew wake: digest due]")


def test_a_wake_dropped_mid_turn_is_retried_on_the_next_poll(env) -> None:
    state, _handler, data = env
    crew_runtime.bind_http_app(_HttpApp(state=state))
    slot = _slot(state)
    slot.running = True
    assert _poll(data, {"new": 1}) is False  # the Lead is mid-turn
    assert slot.prompts == [] and crew_runtime._pending_wake
    slot.running = False
    assert _poll(data, {}) is True  # nothing moved, but the dropped wake is owed
    assert slot.prompts[-1].startswith("[crew wake: retry: 1 new")
    assert crew_runtime._pending_wake == ""
    assert _poll(data, {}) is False  # retried once, not forever


def test_hooks_bind_the_http_app_and_release_it_on_shutdown(env, monkeypatch: pytest.MonkeyPatch) -> None:
    state, _handler, data = env
    monkeypatch.setattr(hooks.watch, "start", lambda ctx: None)

    async def _stop() -> None:
        return None

    monkeypatch.setattr(hooks.watch, "stop", _stop)
    ctx = types.SimpleNamespace(http_app=_HttpApp(state=state), data_dir=data)
    asyncio.run(hooks.on_startup(ctx))
    assert crew_runtime._gateway_state() is state
    asyncio.run(hooks.on_shutdown(ctx))
    assert crew_runtime._gateway_state() is None
