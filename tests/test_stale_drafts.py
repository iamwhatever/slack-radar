"""Pinned re-checks, stale reply drafts and the owner's Re-analyze button.

* the re-check window: an item with an unsent draft, an open dispatched fix or an
  investigation is re-read whatever its status and age, and keeps its replies;
* ``reply_draft.stale``: set by the re-check (and once at load), cleared by a rewrite
  or a send, never writable through the record tool;
* ``/needs``: the stale fields, the sort and the ``reanalyze`` summary;
* ``POST /items/reanalyze``: one Lead prompt for at most 20 items, refused while one
  is in flight.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from backend import crew_runtime, dispatch, needs, store, watch  # noqa: E402
from test_needs import _ctx, _Req, _route, _seed, routes  # noqa: E402,F401
from test_slack_radar import C1, FakeMcp, settings, ts  # noqa: E402
from tests.test_wake import _slot, env  # noqa: E402,F401

POSTER = "U1"


def _ingest(data: Path, fake: FakeMcp, age_secs: float = 5000) -> str:
    """One parent message in C1, ingested, its re-check due now. Returns its key."""
    parent_ts = ts(time.time() - age_secs)
    fake.history_msgs[C1] = [{"ts": parent_ts, "user": POSTER, "text": "export is broken"}]
    watch.run_cycle(data, fake, settings(channels=[C1], backfill_hours=24 * 30))
    key = store.item_key(C1, parent_ts)
    store.mutate(data, lambda led: led["items"][key].update(last_thread_check_at=0.0))
    return key


def _set(data: Path, key: str, **fields: Any) -> None:
    store.mutate(data, lambda led: led["items"][key].update(fields))


def _thread(fake: FakeMcp, key: str, *replies: dict) -> None:
    parent_ts = key.split(":", 1)[1]
    fake.threads[(C1, parent_ts)] = [{"ts": parent_ts, "user": POSTER, "text": "export is broken"}, *replies]


def _rechecked(fake: FakeMcp) -> list[str]:
    return [t["threadTs"] for name, args in fake.calls if name == "batch_get_thread_replies" for t in args["threads"]]


def _dispatch(at: float, **kw: Any) -> dict[str, Any]:
    return {"title": "Fix", "prompt": "p", "repo": "a/b", "links": [], "at": at,
            "dispatch": {"session_key": "chat-1-1", "title": "Fix", "agent": "kirocrew-conductor", "at": at, **kw}}


# ── the re-check window ────────────────────────────────────────────────────


def test_resolved_item_with_an_open_dispatch_is_rechecked(tmp_path: Path) -> None:
    fake = FakeMcp()
    key = _ingest(tmp_path, fake)
    _set(tmp_path, key, status="resolved", fix_handoff=_dispatch(time.time() - 100))
    fake.calls.clear()
    _thread(fake, key, {"ts": ts(time.time() - 10), "user": "U2", "text": "shipped in 1.4"})
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    item = store.read_ledger(tmp_path)["items"][key]
    assert _rechecked(fake) == [key.split(":", 1)[1]]
    assert item["thread_changed"] is True and item["replies"][0]["text"] == "shipped in 1.4"


def test_unpinned_resolved_item_is_not_rechecked(tmp_path: Path) -> None:
    fake = FakeMcp()
    key = _ingest(tmp_path, fake)
    _set(tmp_path, key, status="resolved")
    fake.calls.clear()
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    assert _rechecked(fake) == []


def test_closed_dispatch_no_longer_pins(tmp_path: Path) -> None:
    fake = FakeMcp()
    key = _ingest(tmp_path, fake)
    _set(tmp_path, key, status="resolved", fix_handoff=_dispatch(time.time() - 100, state="closed"))
    fake.calls.clear()
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    assert _rechecked(fake) == []


def test_draft_pins_an_item_past_the_recheck_horizon(tmp_path: Path) -> None:
    fake = FakeMcp()
    key = _ingest(tmp_path, fake, age_secs=20 * 86400)
    fake.calls.clear()
    watch.run_cycle(tmp_path, fake, settings(channels=[C1], recheck_days=7))
    assert _rechecked(fake) == []  # 20 days old, nothing pins it
    _set(tmp_path, key, last_thread_check_at=0.0, reply_draft={"text": "hi", "at": time.time() - 50, "by": "lead"})
    watch.run_cycle(tmp_path, fake, settings(channels=[C1], recheck_days=7))
    assert _rechecked(fake) == [key.split(":", 1)[1]]


def test_pinned_items_go_first_within_the_cycle_cap(tmp_path: Path) -> None:
    fake = FakeMcp()
    now = time.time()
    a, b = ts(now - 4000), ts(now - 3000)
    fake.history_msgs[C1] = [{"ts": a, "user": POSTER, "text": "a"}, {"ts": b, "user": POSTER, "text": "b"}]
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    ka, kb = store.item_key(C1, a), store.item_key(C1, b)
    _set(tmp_path, ka, last_thread_check_at=1.0)  # checked longest ago, not pinned
    _set(tmp_path, kb, last_thread_check_at=2.0, status="investigating")
    fake.calls.clear()
    watch.run_cycle(tmp_path, fake, settings(channels=[C1], recheck_max_per_cycle=1))
    assert _rechecked(fake) == [b]


def test_pinned_item_keeps_its_replies_when_closed_or_old() -> None:
    old = time.time() - (store.REPLIES_MAX_AGE_DAYS + 3) * 86400
    reply = [{"ts": "1.000001", "user": "U2", "text": "x"}]
    pinned = {"key": "C1:1.0", "status": "resolved", "ts_float": old, "replies": list(reply),
              "updated_at": time.time(), "fix_handoff": _dispatch(1.0)}
    loose = {"key": "C1:2.0", "status": "resolved", "ts_float": old, "replies": list(reply), "updated_at": time.time()}
    led = {"items": {"C1:1.0": pinned, "C1:2.0": loose}}
    store._prune(led)
    assert pinned["replies"] == reply and loose["replies"] == []


def test_dispatch_state_is_recorded_and_ends_the_pin(tmp_path: Path) -> None:
    it = {"key": "C0AAAAAAA:1800000000.000001", "status": "resolved", "updated_at": time.time(),
          "fix_handoff": _dispatch(1.0)}
    _seed(tmp_path, it)
    assert store.is_pinned(it)

    class _State:
        def get_slot(self, key: str) -> None:
            return None

    led = store.read_ledger(tmp_path)
    assert asyncio.run(dispatch.record_states(_State(), tmp_path, led)) == [it["key"]]
    stored = store.read_ledger(tmp_path)["items"][it["key"]]
    assert stored["fix_handoff"]["dispatch"]["state"] == "closed" and not store.is_pinned(stored)
    assert asyncio.run(dispatch.record_states(None, tmp_path, store.read_ledger(tmp_path))) == []  # unknown is not stored


# ── reply_draft.stale ──────────────────────────────────────────────────────


def test_recheck_marks_a_draft_stale_and_counts_newer_replies(tmp_path: Path) -> None:
    fake = FakeMcp()
    key = _ingest(tmp_path, fake)
    now = time.time()
    _set(tmp_path, key, status="triaged", reply_draft={"text": "try the admin page", "at": now - 300, "by": "lead", "stale": None})
    old_reply = {"ts": ts(now - 600), "user": "U2", "text": "before the draft"}
    r1 = {"ts": ts(now - 200), "user": "U2", "text": "still broken"}
    r2 = {"ts": ts(now - 100), "user": "U3", "text": "me too"}
    _thread(fake, key, old_reply, r1, r2)
    watch.run_cycle(tmp_path, fake, settings(channels=[C1]))
    item = store.read_ledger(tmp_path)["items"][key]
    assert item["reply_draft"]["stale"] == {"since": r1["ts"], "new_replies": 2}
    assert store.needs_reanalysis(item)


def test_rewrite_and_send_clear_stale() -> None:
    it = {"key": "C0AAAAAAA:1800000000.000001", "channel": C1, "status": "triaged", "text": "q", "replies": [],
          "reply_draft": {"text": "old", "at": 1.0, "by": "lead", "stale": {"since": "2.000000", "new_replies": 1}}}
    led = {"items": {it["key"]: it}, "crew_memory": store.empty_ledger()["crew_memory"]}
    out = store.apply_crew_record(led, {"items": [{"key": it["key"], "reply_draft": {"text": "new"}}]})
    assert out["refused"] == [] and it["reply_draft"]["stale"] is None and store.draft_stale(it) is None
    it["reply_draft"]["stale"] = {"since": "2.000000", "new_replies": 1}
    store.apply_reply_sent(led, it["key"], "new", "3.000000", "", keep_open=False)
    assert it["reply_draft"] is None and store.draft_stale(it) is None


def test_existing_drafts_are_judged_once_at_load(tmp_path: Path) -> None:
    newer = {"key": "C0AAAAAAA:1800000000.000001", "status": "triaged", "latest_reply": "1800000500.000000",
             "reply_draft": {"text": "hi", "at": 1800000100.0, "by": "lead"}}
    fresh = {"key": "C0AAAAAAA:1800000000.000002", "status": "triaged", "latest_reply": "1800000050.000000",
             "reply_draft": {"text": "hi", "at": 1800000100.0, "by": "lead"}}
    store.ledger_path(tmp_path).write_text(json.dumps({"items": {newer["key"]: newer, fresh["key"]: fresh}}), encoding="utf-8")
    items = store.read_ledger(tmp_path)["items"]
    assert items[newer["key"]]["reply_draft"]["stale"] == {"since": "1800000500.000000", "new_replies": 1}
    assert items[fresh["key"]]["reply_draft"]["stale"] is None


@pytest.mark.parametrize("row", [
    {"reply_draft": {"text": "hi", "stale": None}},
    {"reply_draft": {"text": "hi", "stale": {"since": "1.0", "new_replies": 0}}},
    {"reanalyze_requested_at": 0},
])
def test_record_tool_cannot_write_app_only_fields(row: dict) -> None:
    it = {"key": "C0AAAAAAA:1800000000.000001", "channel": C1, "status": "triaged", "text": "q",
          "reply_draft": {"text": "old", "at": 1.0, "by": "lead", "stale": {"since": "2.000000", "new_replies": 1}}}
    led = {"items": {it["key"]: it}, "crew_memory": store.empty_ledger()["crew_memory"]}
    out = store.apply_crew_record(led, {"items": [{"key": it["key"], **row}]})
    assert out["refused"] and it["reply_draft"]["text"] == "old" and it["reply_draft"]["stale"]["new_replies"] == 1


# ── /needs ─────────────────────────────────────────────────────────────────

NOW = 1_800_000_000.0


def _row(n: int, **kw: Any) -> dict[str, Any]:
    t = NOW - n * 60
    base = {"key": f"C0AAAAAAA:{int(t)}.{n:06d}", "channel": C1, "ts_float": t, "text": f"m{n}", "status": "triaged",
            "priority": "p2", "category": "question", "handled_at": 0.0, "last_thread_check_at": NOW - 1000 + n}
    base.update(kw)
    return base


def _draft(stale: bool) -> dict[str, Any]:
    return {"text": "d", "at": NOW - 900, "by": "lead",
            "stale": {"since": f"{NOW - 100:.6f}", "new_replies": 2} if stale else None}


def test_needs_exposes_stale_and_sorts_it_first_within_a_priority() -> None:
    fresh_new = _row(1, reply_draft=_draft(False))
    stale_old = _row(5, reply_draft=_draft(True))
    p1 = _row(9, priority="p1")
    moved_fix = _row(3, category="bug-report", thread_changed=True, latest_reply=f"{NOW - 50:.6f}",
                     fix_handoff=_dispatch(NOW - 500))
    quiet_fix = _row(4, category="bug-report", fix_handoff=_dispatch(NOW - 500))
    led = {"items": {r["key"]: r for r in (fresh_new, stale_old, p1, moved_fix, quiet_fix)}}
    out = needs.build_needs(led, NOW)
    decide = next(g for g in out["groups"] if g["id"] == "decide")["entries"]
    order = [e["key"] for e in decide]
    assert order.index(p1["key"]) == 0 and order.index(stale_old["key"]) < order.index(fresh_new["key"])
    rows = {e["key"]: e for e in decide}
    assert rows[stale_old["key"]]["reply_draft_stale"] == {"since": f"{NOW - 100:.6f}", "new_replies": 2}
    assert rows[fresh_new["key"]]["reply_draft_stale"] is None
    assert rows[moved_fix["key"]]["latest_reply"] == f"{NOW - 50:.6f}" and rows[moved_fix["key"]]["needs_reanalysis"]
    ra = out["reanalyze"]
    assert set(ra["keys"]) == {stale_old["key"], moved_fix["key"]} and ra["total"] == 2 and ra["in_flight"] is False
    assert ra["keys"][0] == moved_fix["key"]  # oldest-checked first


def test_reanalyze_keys_are_capped_and_handled_items_left_out() -> None:
    rows = [_row(i, reply_draft=_draft(True)) for i in range(25)]
    rows.append(_row(30, reply_draft=_draft(True), handled_at=NOW - 1))
    out = needs.build_needs({"items": {r["key"]: r for r in rows}}, NOW)
    assert out["reanalyze"]["total"] == 25 and len(out["reanalyze"]["keys"]) == store.REANALYZE_MAX_KEYS
    assert rows[-1]["key"] not in out["reanalyze"]["keys"]


def test_in_flight_lasts_until_the_item_moves_or_ten_minutes() -> None:
    it = _row(1, reply_draft=_draft(True), reanalyze_requested_at=NOW - 60, updated_at=NOW - 120)
    assert store.reanalyze_in_flight(it, NOW)
    assert needs.build_needs({"items": {it["key"]: it}}, NOW)["reanalyze"]["in_flight"] is True
    it["updated_at"] = NOW - 30
    assert not store.reanalyze_in_flight(it, NOW)
    it["updated_at"] = NOW - 120
    assert not store.reanalyze_in_flight(it, NOW - 60 + store.REANALYZE_INFLIGHT_SECS + 1)


# ── POST /items/reanalyze ──────────────────────────────────────────────────


def _owner(body: Any, state: Any) -> _Req:
    req = _Req(body, app="slack-radar")
    req.app = {"state": state}
    return req


def test_reanalyze_sends_one_prompt_and_stamps_the_items(env, routes, monkeypatch: pytest.MonkeyPatch) -> None:
    state, _handler, data = env
    reply_ts = f"{time.time() - 30:.6f}"
    rows = [_row(i, text=f"message {i}", reply_draft={"text": f"draft {i}", "at": time.time() - 100, "by": "lead"},
                 replies=[{"ts": reply_ts, "user": "U2", "text": f"new reply {i}"}]) for i in range(22)]
    _seed(data, *rows)
    handler = _route(routes, "POST", "/items/reanalyze")
    resp = asyncio.run(handler(_owner({"keys": [r["key"] for r in rows]}, state), _ctx(data)))
    assert resp.status == 200 and resp.body["ok"] is True and len(resp.body["keys"]) == store.REANALYZE_MAX_KEYS
    [prompt] = _slot(state).prompts
    body = prompt[prompt.index(crew_runtime.REANALYZE_HEADER):]
    assert body.count("- key=") == store.REANALYZE_MAX_KEYS and rows[21]["key"] not in body
    assert '"new reply 0"' in body and '"draft 0"' in body and "never post" in body.lower()
    led = store.read_ledger(data)["items"]
    assert all(led[r["key"]]["reanalyze_requested_at"] > 0 for r in rows[:20]) and not led[rows[21]["key"]].get("reanalyze_requested_at")
    events = [e["text"] for e in store.read_events(data)]
    assert "re-analyze requested (20 items)" in events
    # a second click while the first is in flight is refused, and sends nothing
    again = asyncio.run(handler(_owner({"keys": [rows[0]["key"]]}, state), _ctx(data)))
    assert (again.status, again.body["code"]) == (409, "reanalyze_in_flight") and len(_slot(state).prompts) == 1


def test_reanalyze_is_owner_only_and_refused_while_paused(env, routes) -> None:
    state, _handler, data = env
    it = _row(1, reply_draft=_draft(True))
    _seed(data, it)
    handler = _route(routes, "POST", "/items/reanalyze")
    req = _owner({"keys": [it["key"]]}, state)
    req["internal_auth"] = True
    assert asyncio.run(handler(req, _ctx(data))).status == 403
    store.update_crew(data, {"enabled": False})
    resp = asyncio.run(handler(_owner({"keys": [it["key"]]}, state), _ctx(data)))
    assert (resp.status, resp.body["code"]) == (409, "crew_paused") and _slot(state).prompts == []
    assert not store.read_ledger(data)["items"][it["key"]].get("reanalyze_requested_at")


@pytest.mark.parametrize("body,status", [({}, 400), ({"keys": "x"}, 400), ({"keys": ["nope"]}, 400),
                                         ({"keys": ["C0AAAAAAA:1700000000.000001"]}, 404)])
def test_reanalyze_rejects_bad_keys(env, routes, body: dict, status: int) -> None:
    state, _handler, data = env
    resp = asyncio.run(_route(routes, "POST", "/items/reanalyze")(_owner(body, state), _ctx(data)))
    assert resp.status == status and _slot(state).prompts == []


def test_nothing_but_the_route_sends_a_reanalyze() -> None:
    for rel in ("backend/watch.py", "backend/store.py", "backend/needs.py", "backend/dispatch.py"):
        assert "send_reanalyze" not in (ROOT / rel).read_text(encoding="utf-8"), rel
    src = (ROOT / "backend" / "crew_runtime.py").read_text(encoding="utf-8")
    assert src.count("reanalyze_prompt(") == 2  # its definition and send_reanalyze
