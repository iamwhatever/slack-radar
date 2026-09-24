"""Unit tests for the deterministic parts: ledger, poll cycle, digest, MCP write path.

Run from the app root: ``python3 -m pytest tests -q`` (stdlib + pytest only; the
gateway is not needed).
"""

from __future__ import annotations

import importlib.util
import json
import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend import store, watch  # noqa: E402
from backend.secrets import DEFAULT_SETTINGS, validate_settings  # noqa: E402
from backend.slack_api import SlackApiError  # noqa: E402

C1 = "C0AAAAAAA"
C2 = "C0BBBBBBB"


def ts(n: float) -> str:
    return f"{n:.6f}"


class FakeSlack:
    def __init__(self) -> None:
        self.history_msgs: dict[str, list[dict]] = {}
        self.threads: dict[tuple[str, str], list[dict]] = {}
        self.history_calls: list[tuple[str, str]] = []
        self.posted: list[tuple[str, str]] = []
        self.fail_history: dict[str, str] = {}
        self.post_error = ""
        self.deleted: set[tuple[str, str]] = set()

    def auth_test(self) -> dict:
        return {"ok": True, "url": "https://acme.slack.com/", "user_id": "UBOT"}

    def history(self, channel, oldest, cursor="", limit=200):
        self.history_calls.append((channel, oldest))
        if channel in self.fail_history:
            raise SlackApiError(self.fail_history[channel], retry_after=30)
        msgs = [m for m in self.history_msgs.get(channel, []) if float(m["ts"]) > float(oldest)]
        return {"ok": True, "messages": sorted(msgs, key=lambda m: -float(m["ts"])), "has_more": False}

    def replies(self, channel, ts_, limit=50):
        if (channel, ts_) in self.deleted:
            raise SlackApiError("thread_not_found")
        msgs = self.threads.get((channel, ts_), [{"ts": ts_, "text": "parent"}])
        return {"ok": True, "messages": msgs}

    def post_message(self, channel, text):
        if self.post_error:
            raise SlackApiError(self.post_error)
        self.posted.append((channel, text))
        return {"ok": True}


def settings(**kw) -> dict:
    s = dict(DEFAULT_SETTINGS)
    s.update({"channels": [C1, C2], "digest_channel": "C0DIGEST1", "backfill_hours": 24})
    s.update(kw)
    return s


def test_poll_ingests_advances_cursor_and_skips_noise(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeSlack()
    fake.history_msgs[C1] = [
        {"ts": ts(now - 100), "user": "U1", "text": "Login is broken since v2"},
        {"ts": ts(now - 90), "subtype": "channel_join", "user": "U2", "text": "joined"},
        {"ts": ts(now - 80), "user": "UBOT", "text": "our own digest"},
        {"ts": ts(now - 70), "user": "U3", "text": "token xoxb-1234567890-abcdefghij leaked"},
    ]
    summary = watch.run_cycle(tmp_path, fake, settings())
    assert summary["new"] == 2
    led = store.read_ledger(tmp_path)
    assert led["workspace_url"] == "https://acme.slack.com/"
    assert led["channels"][C1]["cursor_ts"] == ts(now - 70)
    texts = sorted(it["text"] for it in led["items"].values())
    assert "xoxb-" not in "".join(texts) and store.REDACTED in "".join(texts)
    key = store.item_key(C1, ts(now - 100))
    assert led["items"][key]["permalink"] == f"https://acme.slack.com/archives/{C1}/p{ts(now - 100).replace('.', '')}"
    assert led["items"][key]["needs_triage"] is True

    # second cycle: cursor used, nothing re-ingested
    fake.history_calls.clear()
    assert watch.run_cycle(tmp_path, fake, settings())["new"] == 0
    assert (C1, ts(now - 70)) in fake.history_calls


def test_ratelimit_records_backoff_and_stops_cycle(tmp_path: Path) -> None:
    fake = FakeSlack()
    fake.fail_history[C1] = "ratelimited"
    summary = watch.run_cycle(tmp_path, fake, settings())
    assert summary["errors"] == {C1: "ratelimited"}
    led = store.read_ledger(tmp_path)
    assert led["channels"][C1]["backoff_until"] > time.time()
    assert C2 not in led["channels"]  # cycle stopped after the 429


def test_thread_recheck_flags_possibly_resolved_never_resolves(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeSlack()
    parent_ts = ts(now - 5000)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": "U1", "text": "CI is red on main"}]
    # ingest cycle does not re-read the thread (first re-check is one gap later)
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
    assert item["possibly_resolved"]["reason"]
    assert item["status"] == "new"  # code never resolves
    # the 30-minute gap means an immediate third cycle does not re-read the thread
    fake.threads[(C1, parent_ts)].append({"ts": ts(now - 5), "text": "another"})
    assert watch.run_cycle(tmp_path, fake, settings(channels=[C1]))["thread_changed"] == 0


def test_deleted_parent_is_flagged(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeSlack()
    parent_ts = ts(now - 5000)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": "U1", "text": "question"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, parent_ts)
    store.mutate(tmp_path, lambda led: led["items"][key].update(last_thread_check_at=0.0))
    fake.deleted.add((C1, parent_ts))
    assert watch.run_cycle(tmp_path, fake, settings(channels=[C1]))["possibly_resolved"] == 1
    assert "deleted" in store.read_ledger(tmp_path)["items"][key]["possibly_resolved"]["reason"]


def test_crew_record_validates_and_clears_flags(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeSlack()
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
                "crew": {"phase": "triaging", "next": "check dark mode dupes", "tried_add": ["gh search dark mode"]},
            },
        ),
    )
    assert result["applied"] == [key, key]
    assert {r["key"] for r in result["refused"]} == {key, "C0NOPE:1.000001"}
    led = store.read_ledger(tmp_path)
    it = led["items"][key]
    assert (it["category"], it["priority"], it["status"]) == ("feature-request", "p2", "triaged")
    assert it["links"] == ["https://github.com/o/r/issues/1"]
    assert it["needs_triage"] is False
    assert led["crew_memory"]["next"] == "check dark mode dupes"


def test_digest_renders_public_fields_only_and_posts_to_configured_channel(tmp_path: Path) -> None:
    now = time.time()
    fake = FakeSlack()
    fake.history_msgs[C1] = [{"ts": ts(now - 10), "user": "U1", "text": "SECRET-RAW-TEXT crash on save"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    key = store.item_key(C1, ts(now - 10))

    def _crew(led):
        store.apply_crew_record(led, {"items": [{"key": key, "category": "bug-report", "priority": "p1",
                                                  "summary": "Crash on save", "note": "LOCAL-NOTE"}]})
        led["digest"]["pending"] = {"headline": "One p1 bug today", "top_keys": [key]}

    store.mutate(tmp_path, _crew)
    assert watch.post_pending_digest(tmp_path, fake, settings()) == "posted"
    channel, text = fake.posted[0]
    assert channel == "C0DIGEST1"
    assert "Crash on save" in text and "One p1 bug today" in text
    assert "SECRET-RAW-TEXT" not in text and "LOCAL-NOTE" not in text
    led = store.read_ledger(tmp_path)
    assert led["digest"]["pending"] is None and led["digest"]["last_posted_date"]


def test_digest_permanent_error_drops_pending(tmp_path: Path) -> None:
    fake = FakeSlack()
    fake.post_error = "not_in_channel"
    store.mutate(tmp_path, lambda led: led["digest"].update(pending={"headline": "x", "top_keys": []}))
    assert watch.post_pending_digest(tmp_path, fake, settings()) == "not_in_channel"
    assert store.read_ledger(tmp_path)["digest"]["pending"] is None


def test_corrupt_ledger_is_refused_not_replaced(tmp_path: Path) -> None:
    store.ledger_path(tmp_path).write_text("[1, 2]", encoding="utf-8")
    with pytest.raises(store.StoreError):
        store.mutate(tmp_path, lambda led: None)
    assert store.ledger_path(tmp_path).read_text(encoding="utf-8") == "[1, 2]"


def test_settings_validation() -> None:
    merged, errors = validate_settings({"channels": ["c0aaaaaaa", "C0AAAAAAA", "#general"]}, dict(DEFAULT_SETTINGS))
    assert merged["channels"] == ["C0AAAAAAA"]
    assert errors and "GENERAL" in errors[0]
    merged, errors = validate_settings({"poll_interval_secs": 5, "digest_channel": "x"}, dict(DEFAULT_SETTINGS))
    assert merged["poll_interval_secs"] == 60 and errors


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
    assert body["digest"]["pending"]["headline"] == "hello"
    assert mcp.handle({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
