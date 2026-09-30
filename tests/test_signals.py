"""The read-only signal export (``backend.signals``, ``GET /signals``). Fake data only.

``tests/fixtures/signal.schema.json`` is vendored from iamwhatever/harness-rsi commit
7fdaf74d7dd8322dc4f148e4b28f8986cadebf98; CI has pytest only, so ``_errors`` applies it.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import settings as settings_mod, signals, slack_mcp, store  # noqa: E402
from tests.test_now import _ctx, _FakeState, _Req, routes  # noqa: E402,F401

SCHEMA = json.loads((ROOT / "tests" / "fixtures" / "signal.schema.json").read_text())
ALLOWED = "C0AGA4Y4NP7"
OTHER = "C0OTHER0001"
BASE = 1790640000.0  # 2026-09-29 UTC
LONG_TEXT = "The export button spins forever and nothing downloads. " * 10


def _errors(value: Any, schema: dict[str, Any], path: str = "$") -> list[str]:
    if "$ref" in schema:
        schema = SCHEMA["$defs"][schema["$ref"].rsplit("/", 1)[1]]
    errs: list[str] = []
    kinds = schema.get("type")
    if kinds is not None:
        kinds = kinds if isinstance(kinds, list) else [kinds]
        py = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}
        ok = any((k == "integer" and isinstance(value, int) and not isinstance(value, bool))
                 or (k in py and isinstance(value, py[k])) for k in kinds)
        if not ok:
            return [f"{path}: not {kinds}"]
    if "enum" in schema and value not in schema["enum"]:
        errs.append(f"{path}: not in enum")
    if "const" in schema and value != schema["const"]:
        errs.append(f"{path}: not const")
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", 10**9):
            errs.append(f"{path}: length")
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errs.append(f"{path}: pattern")
    if isinstance(value, int) and "minimum" in schema and value < schema["minimum"]:
        errs.append(f"{path}: minimum")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errs.append(f"{path}: minItems")
        if schema.get("uniqueItems") and len({json.dumps(v) for v in value}) != len(value):
            errs.append(f"{path}: uniqueItems")
        for i, v in enumerate(value):
            errs += _errors(v, schema.get("items", {}), f"{path}[{i}]")
    if isinstance(value, dict):
        props = schema.get("properties", {})
        errs += [f"{path}: missing {k}" for k in schema.get("required", []) if k not in value]
        if schema.get("additionalProperties") is False:
            errs += [f"{path}: extra {k}" for k in value if k not in props]
        for k, sub in props.items():
            if k in value:
                errs += _errors(value[k], sub, f"{path}.{k}")
    if "anyOf" in schema and all(_errors(value, s, path) for s in schema["anyOf"]):
        errs.append(f"{path}: anyOf")
    if "if" in schema and not _errors(value, schema["if"], path):
        errs += _errors(value, schema.get("then", {}), path)
    return errs


def _item(n: int, channel: str = ALLOWED, **kw: Any) -> dict[str, Any]:
    t = f"{BASE + n * 3600:.6f}"
    item = {
        "key": f"{channel}:{t}", "channel": channel, "ts": t, "ts_float": float(t),
        "user": f"UFAKE{n:06d}", "is_bot": False, "text": LONG_TEXT,
        "permalink": store.permalink("https://fake.slack.com", channel, t),
        "status": "triaged", "category": "bug-report", "summary": f"Export hangs on case {n}",
    }
    item.update(kw)
    return item


def _ledger(*items: dict[str, Any]) -> dict[str, Any]:
    return {"items": {i["key"]: i for i in items}}


def test_the_default_allowlist_is_the_builders_channel_only() -> None:
    assert settings_mod.defaults()["signal_channels"] == [ALLOWED]
    _, errs = settings_mod.validate_settings({"signal_channels": ["#general"]}, settings_mod.defaults())
    assert errs


def test_every_row_validates_against_the_signal_schema() -> None:
    led = _ledger(
        _item(1), _item(2, category="feature-request", summary="Export hangs on case 1."),
        _item(3, category="question", summary="<@UFAKE000003> asks why WFAKE0000009 cannot log in"),
        _item(4, user="UFAKE000001", summary="export  HANGS on case 1"),
    )
    rows = signals.build_signals(led, [ALLOWED])
    assert len(rows) == 4
    for row in rows:
        assert _errors(row, SCHEMA) == [], row


def test_same_pain_is_merged_with_dedup_of() -> None:
    led = _ledger(_item(1), _item(2, summary="Export hangs on case 1."),
                  _item(30, user="UFAKE000001", summary="export  HANGS on case 1"), _item(5))
    rows = signals.build_signals(led, [ALLOWED])
    head = rows[0]
    dups = [r for r in rows if r["dedup_of"] == head["id"]]
    assert head["dedup_of"] is None and len(dups) == 2
    assert head["mentions"] == {"count": 3, "people": 2, "window_days": 2}
    assert len(head["links"]) == 3 and all(ln.startswith("https://fake.slack.com/archives/") for ln in head["links"])
    assert [r for r in rows if r["pain"] == "Export hangs on case 5"][0]["dedup_of"] is None


def test_non_allowlisted_channel_yields_nothing() -> None:
    led = _ledger(_item(1, channel=OTHER), _item(2, channel=OTHER))
    assert signals.build_signals(led, [ALLOWED]) == []
    assert signals.build_signals(_ledger(_item(1)), []) == []


def test_rows_carry_no_message_text_and_no_user_ids() -> None:
    copied = LONG_TEXT[:150]
    led = _ledger(_item(1, summary=copied), _item(2, summary=LONG_TEXT), _item(3, summary=""),
                  _item(4, summary="<@UFAKE000004> says WFAKE0000009 sees a blank page"),
                  _item(5, status="noise"), _item(6, category="noise"), _item(7, is_bot=True))
    rows = signals.build_signals(led, [ALLOWED])
    assert [r["pain"] for r in rows] == ["says sees a blank page"]
    blob = json.dumps(rows)
    assert "UFAKE" not in blob and "WFAKE" not in blob
    for row in rows:
        assert len(row["pain"]) <= signals.MAX_PAIN
    for n in range(0, len(LONG_TEXT) - signals.MAX_PAIN, 25):
        assert LONG_TEXT[n:n + signals.MAX_PAIN] not in blob


def test_route_is_a_read_and_makes_no_slack_call(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def _no_slack(*_a: Any, **_k: Any) -> Any:
        raise AssertionError("the signal export must not call Slack")
    for name in ("_call_tool", "call", "send_self_dm", "post_thread_reply"):
        if hasattr(slack_mcp.SlackMcpClient, name):
            monkeypatch.setattr(slack_mcp.SlackMcpClient, name, _no_slack)
    store.mutate(tmp_path, lambda led: led["items"].update(_ledger(_item(1), _item(2, channel=OTHER))["items"]))
    before = store.ledger_path(tmp_path).read_bytes()
    resp = asyncio.run(routes._handle_signals(_Req(_FakeState()), _ctx(tmp_path)))
    assert resp.status == 200 and [r["source"] for r in resp.body["signals"]] == [f"slack:{ALLOWED}"]
    assert store.ledger_path(tmp_path).read_bytes() == before
    handlers = {(r.method, r.path): r.handler for r in routes.register_routes(None)}
    assert handlers[("GET", "/signals")] is routes._handle_signals


def test_route_fails_closed_when_settings_are_unreadable(routes, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def _broken() -> Any:
        raise settings_mod.SettingsUnavailable("no vault")

    monkeypatch.setattr(settings_mod, "read_settings", _broken)
    resp = asyncio.run(routes._handle_signals(_Req(_FakeState()), _ctx(tmp_path)))
    assert resp.status == 503 and "signals" not in resp.body
