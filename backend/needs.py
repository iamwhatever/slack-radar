"""Slack Radar — the "Needs you" list, built by fixed rules from the ledger.

STDLIB ONLY, and pure: every function takes a ledger dict (and the clock) and returns
plain data. No model call, no I/O. ``routes.py`` serves the result as ``GET /needs``.
The rules are written out for people in ``desk/CONTRACT.md`` §6; keep the two in step.

Three groups, in this order:

* ``decide``     — open items that want a call from the owner: a fix hand-off the Lead
  wrote (or one the owner dispatched whose PR is not known yet), priority p0/p1, an investigation that finished with links, or a thread the
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
#: Hand-offs listed in ``handoffs`` (every hand-off, dispatched or not).
HANDOFF_CAP = 50
#: The ``decide`` reason for an item carrying a ``reply_draft`` (below a hand-off).
REPLY_REASON = "Reply ready to send"
#: Sent replies listed in the "Replied" fold.
REPLIED_CAP = 50
#: The ``decide`` reason for a hand-off the owner dispatched, before its PR exists.
DISPATCHED_REASON = "Fix in progress"

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


def posted_at(item: dict[str, Any]) -> float:
    """The message's own Slack time (``ts_float``), 0 when unknown."""
    try:
        return float(item.get("ts_float") or 0)
    except (TypeError, ValueError):
        return 0.0


def _rank(item: dict[str, Any], now: float) -> tuple[int, float]:
    """Sort key: priority first (p0 … p3, then none), then newest first."""
    return (_PRIORITY_RANK.get(str(item.get("priority") or ""), 4), -posted_at(item))


def _entry(item: dict[str, Any], now: float, reason: str,
           fix_live: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
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
        **({"reply_draft": str(item["reply_draft"].get("text") or "")} if store.has_reply_draft(item) else {}),
        **({"dispatch": fix_view(item, fix_live)} if dispatch_of(item) else {}),
    }


def handoff_entry(item: dict[str, Any]) -> dict[str, Any]:
    """One row of ``handoffs``: the item plus its whole hand-off."""
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


def replied_entry(item: dict[str, Any]) -> dict[str, Any]:
    """One row of the "Replied" fold: what the owner sent, and where."""
    r = item["replied"]
    return {
        "key": item.get("key") or "",
        "channel": item.get("channel") or "",
        "summary": item.get("summary") or str(item.get("text") or "")[:200],
        "text": str(r.get("text") or ""),
        "at": float(r.get("at") or 0),
        "permalink": str(r.get("permalink") or item.get("permalink") or ""),
    }


def replied_rows(ledger: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Sent replies, newest first, capped at :data:`REPLIED_CAP`, and their total."""
    rows = sorted(
        (it for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and isinstance(it.get("replied"), dict)),
        key=lambda it: -float(it["replied"].get("at") or 0),
    )
    return [replied_entry(it) for it in rows[:REPLIED_CAP]], len(rows)


def has_handoff(item: dict[str, Any]) -> bool:
    h = item.get("fix_handoff")
    return isinstance(h, dict) and bool(h.get("prompt"))


# ── dispatched fixes ───────────────────────────────────────────────────────

#: Dispatched fixes listed in the "Fixes in flight" fold.
FIXES_CAP = 50


def dispatch_of(item: dict[str, Any]) -> dict[str, Any] | None:
    """The owner's dispatch on an item's hand-off (``fix_handoff.dispatch``), or None."""
    h = item.get("fix_handoff")
    d = h.get("dispatch") if isinstance(h, dict) else None
    return d if isinstance(d, dict) and d.get("session_key") else None


def fix_pr(item: dict[str, Any]) -> str:
    h = item.get("fix_handoff")
    return str(h.get("pr_url") or "") if isinstance(h, dict) and dispatch_of(item) else ""


def fix_pr_urls(item: dict[str, Any], fix_live: dict[str, dict[str, Any]] | None = None) -> list[str]:
    """Batch PRs not matched to one fix (``fix_handoff.pr_urls`` plus any just found)."""
    h = item.get("fix_handoff")
    if not isinstance(h, dict) or not dispatch_of(item):
        return []
    live = ((fix_live or {}).get(item.get("key") or "") or {}).get("pr_urls") or []
    out: list[str] = []
    for u in [*(h.get("pr_urls") or []), *live]:
        if isinstance(u, str) and u and u not in out:
            out.append(u)
    return out


def has_fix_pr(item: dict[str, Any], fix_live: dict[str, dict[str, Any]] | None = None) -> bool:
    """A dispatched fix whose PR is known: its own, or a batch PR not matched to one fix."""
    if not dispatch_of(item):
        return False
    live = ((fix_live or {}).get(item.get("key") or "") or {}).get("pr_url")
    return bool(fix_pr(item) or live or fix_pr_urls(item, fix_live))


def fix_view(item: dict[str, Any], fix_live: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """``{session_key, title, agent, at, state, pr_url, pr_number, batch, batch_keys, pr_urls}``.

    ``state`` comes from ``fix_live`` (the route reads the session's slot):
    running / idle / closed, or ``unknown`` when nobody asked the gateway.
    """
    from .handoff import pr_number

    d = dispatch_of(item) or {}
    pr = fix_pr(item) or str(((fix_live or {}).get(item.get("key") or "") or {}).get("pr_url") or "")
    live = ((fix_live or {}).get(item.get("key") or "") or {}).get("state") or "unknown"
    return {
        "session_key": str(d.get("session_key") or ""),
        "title": str(d.get("title") or ""),
        "agent": str(d.get("agent") or ""),
        "at": float(d.get("at") or 0),
        "state": str(live),
        "pr_url": pr,
        "pr_number": pr_number(pr),
        "batch": bool(d.get("batch")),
        "batch_keys": [str(k) for k in d.get("batch_keys") or []] if d.get("batch") else [],
        "pr_urls": fix_pr_urls(item, fix_live),
    }


def fix_batches(fixes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The "Fixes in flight" headers: one per batch session, from ``fix_entry`` rows.

    ``prs_found`` counts distinct PRs across the members; ``total`` is the member count.
    """
    groups: dict[str, dict[str, Any]] = {}
    for f in fixes:
        d = f["dispatch"]
        if not d.get("batch"):
            continue
        g = groups.setdefault(d["session_key"], {
            "session_key": d["session_key"], "title": d["title"], "state": d["state"], "at": d["at"],
            "repo": f.get("repo") or "", "keys": [], "prs": [],
        })
        g["keys"].append(f["key"])
        for u in [d.get("pr_url") or "", *(d.get("pr_urls") or [])]:
            if u and u not in g["prs"]:
                g["prs"].append(u)
    return [{**g, "total": len(g["keys"]), "prs_found": len(g["prs"])} for g in groups.values()]


def fix_entry(item: dict[str, Any], fix_live: dict[str, dict[str, Any]] | None = None) -> dict[str, Any]:
    """One row of the "Fixes in flight" fold."""
    return {
        "key": item.get("key") or "",
        "channel": item.get("channel") or "",
        "permalink": item.get("permalink") or "",
        "summary": item.get("summary") or str(item.get("text") or "")[:200],
        "status": item.get("status") or "",
        "handled_how": item.get("handled_how") or "",
        "handoff_title": item["fix_handoff"].get("title") or "",
        "repo": item["fix_handoff"].get("repo") or "",
        "dispatch": fix_view(item, fix_live),
    }


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
        d = dispatch_of(item)
        if d:
            return f"{DISPATCHED_REASON} · {d.get('title') or ''}".rstrip(" ·")[:160]
        return HANDOFF_REASON
    if store.has_reply_draft(item):
        return REPLY_REASON
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
    fix_live: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """The three groups, each ``{id, total, entries}``; entries capped at ``cap``.

    A dispatched fix whose PR is known (``fix_handoff.pr_url``, or one ``fix_live``
    just found) is in neither ``decide`` nor ``unanswered``: it lives in ``fixes``.
    """
    t = time.time() if now is None else now
    pool = [
        it for it in (ledger.get("items") or {}).values()
        if isinstance(it, dict) and is_open(it) and not is_handled(it)
    ]
    decide: list[tuple[dict[str, Any], str]] = []
    unanswered: list[dict[str, Any]] = []
    for it in pool:
        if has_fix_pr(it, fix_live):
            continue
        why = decide_reason(it, spawn_done)
        if why:
            decide.append((it, why))
        elif is_unanswered(it, t):
            unanswered.append(it)
    decide.sort(key=lambda pair: _rank(pair[0], t))
    unanswered.sort(key=lambda it: _rank(it, t))
    # Clusters: best member priority, then size, then the newest member first.
    ranked = sorted(
        find_clusters(pool),
        key=lambda c: (min(_rank(m, t)[0] for m in c), -len(c), -max(posted_at(m) for m in c)),
    )
    clusters = [_cluster_entry(c, t) for c in ranked]

    def hours(it: dict[str, Any]) -> str:
        return f"No reply for {int(age_hours(it, t) // 24)} days"

    groups = [
        ("decide", [_entry(it, t, why, fix_live) for it, why in decide]),
        ("unanswered", [_entry(it, t, hours(it)) for it in unanswered]),
        ("clusters", clusters),
    ]
    handled = sum(1 for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and is_handled(it))
    handoffs = sorted(
        (it for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and has_handoff(it)),
        key=lambda it: -float(it["fix_handoff"].get("at") or 0),
    )
    fixes = sorted(
        (it for it in (ledger.get("items") or {}).values() if isinstance(it, dict) and dispatch_of(it)),
        # Batch members share one ``at``; the session key keeps them adjacent.
        key=lambda it: (-float((dispatch_of(it) or {}).get("at") or 0), str((dispatch_of(it) or {}).get("session_key"))),
    )
    replied, replied_total = replied_rows(ledger)
    fix_rows = [fix_entry(it, fix_live) for it in fixes[:FIXES_CAP]]
    return {
        "replied": replied,
        "replied_total": replied_total,
        "groups": [{"id": gid, "total": len(rows), "entries": rows[:cap]} for gid, rows in groups],
        "fixes": fix_rows,
        "fix_batches": fix_batches(fix_rows),
        "fixes_total": len(fixes),
        "handled_total": handled,
        "handoffs": [handoff_entry(it) for it in handoffs[:HANDOFF_CAP]],
        "handoffs_total": len(handoffs),
    }
