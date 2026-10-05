"""The Board's batch **Ask lead** button: which items each click sends, and its guard.

* ``needs.ask_lead`` names the oldest-posted ``ASK_LEAD_BATCH`` items that wait for the
  Lead (investigated bug/feature, no draft, no hand-off, never asked), and how many wait;
* once sent (``reanalyze_requested_at``), an item never comes back into the batch, so
  each click sends the next ones and ``total`` goes down;
* while a batch is in flight the view says so and ``/items/reanalyze`` refuses a
  second send.
"""

from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))

from backend import needs, store  # noqa: E402
from test_needs import _ctx, _Req, _route, _seed, routes  # noqa: E402,F401
from tests.test_wake import _slot, env  # noqa: E402,F401

NOW = 1_800_000_000.0
C1 = "C0AAAAAAA"


def _item(n: int, now: float = NOW, **kw: Any) -> dict[str, Any]:
    """Item ``n`` was posted ``n`` hours ago: a larger ``n`` is older."""
    t = now - n * 3600
    base = {"key": f"{C1}:{int(t)}.{n:06d}", "channel": C1, "ts_float": t, "text": f"export breaks {n}",
            "summary": f"export breaks {n}", "status": "triaged", "priority": "p2", "category": "bug-report",
            "handled_at": 0.0, "links": [f"https://github.com/acme/app/issues/{n}"]}
    base.update(kw)
    return base


def _view(items: list[dict[str, Any]], now: float = NOW) -> dict[str, Any]:
    return needs.build_needs({"items": {it["key"]: it for it in items}}, now)["ask_lead"]


def test_batch_is_the_oldest_n_of_the_waiting_items() -> None:
    items = [_item(n) for n in range(1, 13)]
    view = _view(items)
    oldest = sorted(items, key=lambda it: it["ts_float"])[: needs.ASK_LEAD_BATCH]
    assert view["keys"] == [it["key"] for it in oldest]
    assert view["total"] == 12 and view["in_flight"] is False


def test_only_items_that_wait_for_the_lead_count() -> None:
    waiting = _item(1)
    left_out = [
        _item(2, category="question"),
        _item(3, links=[]),  # not investigated yet
        _item(4, links=[], investigation="spawn sp-1", status="investigating"),  # still running
        _item(5, reply_draft={"text": "try 1.4", "at": NOW - 5, "by": "lead"}),
        _item(6, fix_handoff={"title": "Fix", "prompt": "p", "repo": "acme/app", "links": [], "at": NOW}),
        _item(7, handled_at=NOW - 1),
        _item(8, status="resolved"),
        _item(9, reanalyze_requested_at=NOW - 3 * 3600, updated_at=NOW - 3600),  # asked before
    ]
    finished = _item(10, links=[], investigation="spawn sp-2", status="triaged")
    view = _view([waiting, finished, *left_out])
    assert view["keys"] == [finished["key"], waiting["key"]] and view["total"] == 2


def test_each_click_sends_the_next_items_and_none_twice() -> None:
    items = [_item(n) for n in range(1, 13)]
    led = {"items": {it["key"]: it for it in items}}
    sent: list[str] = []
    totals: list[int] = []
    t = NOW
    while True:
        view = needs.build_needs(led, t)["ask_lead"]
        totals.append(view["total"])
        if not view["keys"]:
            break
        assert len(view["keys"]) <= needs.ASK_LEAD_BATCH and not set(view["keys"]) & set(sent)
        store.apply_reanalyze_requested(led, view["keys"], t)
        assert needs.build_needs(led, t)["ask_lead"]["in_flight"] is True
        sent += view["keys"]
        t += store.REANALYZE_INFLIGHT_SECS + 1  # the Lead never answered: the window ran out
    assert totals == [12, 7, 2, 0]
    assert sent == [it["key"] for it in sorted(items, key=lambda it: it["ts_float"])]


def test_the_batch_is_held_while_the_lead_has_not_moved() -> None:
    items = [_item(n) for n in range(1, 4)]
    led = {"items": {it["key"]: it for it in items}}
    store.apply_reanalyze_requested(led, [items[0]["key"]], NOW - 30)
    items[0]["updated_at"] = NOW - 60
    assert needs.build_needs(led, NOW)["ask_lead"]["in_flight"] is True
    items[0]["updated_at"] = NOW - 10  # the Lead recorded it
    view = needs.build_needs(led, NOW)["ask_lead"]
    assert view["in_flight"] is False and items[0]["key"] not in view["keys"] and view["total"] == 2


def _owner(body: Any, state: Any) -> _Req:
    req = _Req(body, app="slack-radar")
    req.app = {"state": state}
    return req


def test_route_sends_one_batch_and_refuses_a_second_while_in_flight(env, routes) -> None:
    state, _handler, data = env
    now = time.time()
    items = [_item(n, now) for n in range(1, 8)]
    _seed(data, *items)
    first = needs.build_needs(store.read_ledger(data), now)["ask_lead"]
    assert len(first["keys"]) == needs.ASK_LEAD_BATCH and first["total"] == 7
    handler = _route(routes, "POST", "/items/reanalyze")
    resp = asyncio.run(handler(_owner({"keys": first["keys"]}, state), _ctx(data)))
    assert resp.status == 200 and resp.body["keys"] == first["keys"] and len(_slot(state).prompts) == 1
    after = needs.build_needs(store.read_ledger(data), time.time())["ask_lead"]
    assert after["in_flight"] is True and after["total"] == 2 and not set(after["keys"]) & set(first["keys"])
    again = asyncio.run(handler(_owner({"keys": after["keys"]}, state), _ctx(data)))
    assert (again.status, again.body["code"]) == (409, "reanalyze_in_flight") and len(_slot(state).prompts) == 1
