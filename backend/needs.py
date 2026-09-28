"""Slack Radar — the "Needs you" list, built by fixed rules from the ledger.

STDLIB ONLY, and pure: every function takes a ledger dict (and the clock) and returns
plain data. No model call, no I/O. ``routes.py`` serves the result as ``GET /needs``.
The rules are written out for people in ``desk/CONTRACT.md`` §6; keep the two in step.

Three groups, in this order:

* ``decide``     — open items that want a call from the owner: a fix hand-off the Lead
  wrote, priority p0/p1, an investigation that finished with links, or a thread the
  poller thinks is resolved.
* ``unanswered`` — open questions nobody in the thread has replied to for over 48 hours.
* ``clusters``   — two or more open items in one channel that share at least two
  significant summary words, one entry per cluster.

An item the owner marked handled (``handled_at > 0``) is in none of them. An item lands
in at most one of ``decide`` / ``unanswered`` (``decide`` wins); a cluster may name
items that also appear above, because it answers a different question.
"""

from __future__ import annotations

import re
import time
from typing import Any, Callable

from . import store

GROUP_IDS = ("decide", "unanswered", "clusters")
GROUP_CAP = 20
UNANSWERED_AFTER_HOURS = 48.0
URGENT_PRIORITIES = frozenset({"p0", "p1"})
#: Clusters: items must share at least this many significant words.
CLUSTER_MIN_SHARED = 2
#: A significant word: 3+ letters/digits, not all digits, not in :data:`STOPWORDS`.
_WORD_RE = re.compile(r"[a-z0-9]{3,}")
#: Too common in support channels to say two messages are about the same thing.
STOPWORDS = frozenset(
    """
    all and any are but can did for get got had has her him his how its let may not now
    off one our out own see she the too try two use via was way who why yes yet you
    about after again also anyone anything asked asks been before being could does doing
    done dont from getting good have having help hello here into issue just know like
    looks make many more most much need needs only other please question really report
    reports request same seems should some still than thank thanks that their them then
    there these they thing this those through using very want wants was were what when
    where which while will with without work working would your yours user users
    doesn isn wasn aren didn can't won
    """.split()
)

#: The ``decide`` reason for an item carrying a ``fix_handoff``.
HANDOFF_REASON = "Fix ready to hand off"
#: Hand-offs listed in the "Fixes handed off" fold.
HANDOFF_CAP = 50

_PRIORITY_RANK = {"p0": 0, "p1": 1, "p2": 2, "p3": 3}


def is_handled(item: dict[str, Any]) -> bool:
    try:
        return float(item.get("handled_at") or 0) > 0
    except (TypeError, ValueError):
        return False


def is_open(item: dict[str, Any]) -> bool:
    return item.get("status") in store.OPEN_STATUSES


def age_hours(item: dict[str, Any], now: float) -> float:
    try:
        posted = float(item.get("ts_float") or 0)
    except (TypeError, ValueError):
        posted = 0.0
    return round(max(0.0, now - posted) / 3600.0, 1) if posted else 0.0


def _rank(item: dict[str, Any], now: float) -> tuple[int, float]:
    """Sort key: priority first (p0 … p3, then none), then oldest first."""
    return (_PRIORITY_RANK.get(str(item.get("priority") or ""), 4), -age_hours(item, now))


def _entry(item: dict[str, Any], now: float, reason: str) -> dict[str, Any]:
    return {
        "key": item.get("key") or "",
        "channel": item.get("channel") or "",
        "permalink": item.get("permalink") or "",
        "summary": item.get("summary") or str(item.get("text") or "")[:200],
        "priority": item.get("priority") or "",
        "category": item.get("category") or "",
        "age_hours": age_hours(item, now),
        "reason": reason,
        **({"handoff_title": item["fix_handoff"].get("title") or ""} if has_handoff(item) else {}),
    }


def handoff_entry(item: dict[str, Any]) -> dict[str, Any]:
    """One row of the "Fixes handed off" fold: the item plus its whole hand-off."""
    h = item["fix_handoff"]
    return {
        "key": item.get("key") or "",
        "channel": item.get("channel") or "",
        "permalink": item.get("permalink") or "",
        "summary": item.get("summary") or str(item.get("text") or "")[:200],
        "status": item.get("status") or "",
        "handled_how": item.get("handled_how") or "",
        "handoff": {k: h.get(k) for k in ("title", "prompt", "repo", "links", "at")},
    }


def has_handoff(item: dict[str, Any]) -> bool:
    h = item.get("fix_handoff")
    return isinstance(h, dict) and bool(h.get("prompt"))


def _investigation_done(item: dict[str, Any], spawn_done: Callable[[str], bool] | None) -> bool:
    """An investigation ran and left links, and is no longer running.

    ``investigation`` holds ``spawn <id>`` while the Investigator works. It counts as
    finished once the crew moved the item off ``investigating`` or, when the host can
    say, the spawn itself is done.
    """
    inv = str(item.get("investigation") or "")
    if not inv or not item.get("links"):
        return False
    if item.get("status") != "investigating":
        return True
    if spawn_done is not None and inv.startswith("spawn "):
        try:
            return bool(spawn_done(inv[len("spawn "):]))
        except Exception:  # noqa: BLE001 - an unanswerable host question is "not yet"
            return False
    return False


def decide_reason(item: dict[str, Any], spawn_done: Callable[[str], bool] | None = None) -> str:
    """Why an open, unhandled item needs a call, or ``""``. First match wins."""
    if has_handoff(item):
        return HANDOFF_REASON
    if item.get("priority") in URGENT_PRIORITIES:
        return f"Open {item['priority']}"
    if _investigation_done(item, spawn_done):
        return "Matching GitHub work found"
    pr = item.get("possibly_resolved")
    if pr:
        why = str(pr.get("reason") or "") if isinstance(pr, dict) else ""
        return f"Looks resolved: {why}"[:120] if why else "Looks resolved"
    return ""


def is_unanswered(item: dict[str, Any], now: float) -> bool:
    return (
        item.get("category") == "question"
        and int(item.get("reply_count") or 0) == 0
        and not item.get("latest_reply")
        and age_hours(item, now) > UNANSWERED_AFTER_HOURS
    )


def words(item: dict[str, Any]) -> frozenset[str]:
    """Significant words of the summary (else the first 200 chars of the text)."""
    source = str(item.get("summary") or str(item.get("text") or "")[:200]).lower()
    return frozenset(w for w in _WORD_RE.findall(source) if w not in STOPWORDS and not w.isdigit())


def find_clusters(items: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    """Group items that share ``CLUSTER_MIN_SHARED``+ words within one channel.

    Two items are linked when their word sets overlap by at least the minimum; a
    cluster is a connected group of 2+ linked items (so A~B and B~C put A, B, C
    together even if A and C share fewer words).
    """
    by_channel: dict[str, list[dict[str, Any]]] = {}
    for it in items:
        by_channel.setdefault(str(it.get("channel") or ""), []).append(it)
    clusters: list[list[dict[str, Any]]] = []
    for rows in by_channel.values():
        sets = [words(r) for r in rows]
        parent = list(range(len(rows)))

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        for i in range(len(rows)):
            for j in range(i + 1, len(rows)):
                if len(sets[i] & sets[j]) >= CLUSTER_MIN_SHARED:
                    parent[find(i)] = find(j)
        groups: dict[int, list[dict[str, Any]]] = {}
        for i, r in enumerate(rows):
            groups.setdefault(find(i), []).append(r)
        clusters.extend(g for g in groups.values() if len(g) >= 2)
    return clusters


def _cluster_entry(members: list[dict[str, Any]], now: float) -> dict[str, Any]:
    members = sorted(members, key=lambda it: _rank(it, now))
    lead = members[0]
    counts: dict[str, int] = {}
    for m in members:
        for w in words(m):
            counts[w] = counts.get(w, 0) + 1
    shared = sorted((w for w, n in counts.items() if n >= 2), key=lambda w: (-counts[w], w))[:4]
    entry = _entry(lead, now, f"{len(members)} similar messages")
    entry["age_hours"] = max(age_hours(m, now) for m in members)
    entry["members"] = [m.get("key") or "" for m in members]
    entry["words"] = shared
    return entry


def build_needs(
    ledger: dict[str, Any],
    now: float | None = None,
    spawn_done: Callable[[str], bool] | None = None,
    cap: int = GROUP_CAP,
) -> dict[str, Any]:
    """The three groups, each ``{id, total, entries}``; entries capped at ``cap``."""
    t = time.time() if now is None else now
    pool = [
        it for it in (ledger.get("items") or {}).values()
        if isinstance(it, dict) and is_open(it) and not is_handled(it)
    ]
    decide: list[tuple[dict[str, Any], str]] = []
    unanswered: list[dict[str, Any]] = []
    for it in pool:
        why = decide_reason(it, spawn_done)
        if why:
            decide.append((it, why))
        elif is_unanswered(it, t):
            unanswered.append(it)
    decide.sort(key=lambda pair: _rank(pair[0], t))
    unanswered.sort(key=lambda it: _rank(it, t))
    clusters = [_cluster_entry(c, t) for c in find_clusters(pool)]
    clusters.sort(key=lambda e: (_PRIORITY_RANK.get(e["priority"], 4), -len(e["members"]), -e["age_hours"]))

    def hours(it: dict[str, Any]) -> str:
        return f"No reply for {int(age_hours(it, t) // 24)} days"

    groups = [
        ("decide", [_entry(it, t, why) for it, why in decide]),
        ("unanswered", [_entry(it, t, hours(it)) for it in unanswered]),
        ("clusters", clusters),
    ]
    handled = sum(1 for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and is_handled(it))
    handoffs = sorted(
        (it for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and has_handoff(it)),
        key=lambda it: -float(it["fix_handoff"].get("at") or 0),
    )
    return {
        "groups": [{"id": gid, "total": len(rows), "entries": rows[:cap]} for gid, rows in groups],
        "handled_total": handled,
        "handoffs": [handoff_entry(it) for it in handoffs[:HANDOFF_CAP]],
        "handoffs_total": len(handoffs),
    }
