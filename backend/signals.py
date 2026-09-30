"""Read-only signal export: triaged ledger items in allowlisted channels → harness-rsi rows.

Reads the ledger only: no Slack call, no write, no message text. ``pain`` is the crew's
summary with mentions and user ids stripped; a summary copied from the message is dropped.
Same-pain rows merge: the earliest keeps ``dedup_of: null`` plus the group's totals and links.
"""

from __future__ import annotations

import math
import re
import time
from typing import Any, Iterable

from . import store

MAX_PAIN = 200
MAX_LINKS = 10
#: Only report-shaped categories are pain; noise and already-answered are not.
PAIN_CATEGORIES = frozenset({"bug-report", "feature-request", "question"})
_MENTION_RE = re.compile(r"<[@!#][^>]*>")
_USER_ID_RE = re.compile(r"\b[UW][A-Z0-9]{8,}\b")
_SPACE_RE = re.compile(r"\s+")
_WORD_RE = re.compile(r"[\W_]+")
#: A pain this long that also appears inside the message text is a copy, not a summary.
_COPY_MIN = 20


def _norm(text: str) -> str:
    return _WORD_RE.sub(" ", text.casefold()).strip()


def pain_of(item: dict[str, Any]) -> str:
    """The item's pain line, or "" when it has none that may leave this machine."""
    raw = _USER_ID_RE.sub("", _MENTION_RE.sub("", str(item.get("summary") or "")))
    pain = _SPACE_RE.sub(" ", raw).strip()
    if not pain or store.public_text_problem(pain):
        return ""
    pain = store.clip(pain, MAX_PAIN)
    key = _norm(pain.rstrip("…"))
    if len(key) >= _COPY_MIN and key in _norm(str(item.get("text") or "")):
        return ""
    return pain


def _eligible(item: dict[str, Any], allow: frozenset[str]) -> bool:
    return (
        item.get("channel") in allow
        and not item.get("is_bot")
        and item.get("status") != "noise"
        and item.get("category") in PAIN_CATEGORIES
        and bool(store._URL_RE.match(str(item.get("permalink") or "")))
    )


def _window_days(stamps: list[float]) -> int:
    return max(1, math.ceil((max(stamps) - min(stamps)) / 86400))


def build_signals(ledger: dict[str, Any], channels: Iterable[str]) -> list[dict[str, Any]]:
    """Signal rows for every eligible item, oldest first. Pure: reads ``ledger`` only."""
    allow = frozenset(c for c in channels if store.is_channel_id(c))
    picked: list[tuple[float, dict[str, Any], str]] = []
    for item in (ledger.get("items") or {}).values():
        if not isinstance(item, dict) or not _eligible(item, allow):
            continue
        pain = pain_of(item)
        if pain:
            picked.append((float(item.get("ts_float") or 0), item, pain))
    picked.sort(key=lambda p: (p[0], str(p[1].get("key") or "")))

    rows: list[dict[str, Any]] = []
    per_day: dict[str, int] = {}
    groups: dict[str, list[tuple[dict[str, Any], float, str]]] = {}
    for stamp, item, pain in picked:
        day = time.strftime("%Y%m%d", time.gmtime(stamp))
        per_day[day] = per_day.get(day, 0) + 1
        if per_day[day] > 9999:
            continue
        row = {
            "id": f"sig_{day}_{per_day[day]:04d}",
            "source": f"slack:{item['channel']}",
            "links": [item["permalink"]],
            "pain": pain,
            "mentions": {"count": 1, "people": 1, "window_days": 1},
            "layer": "real",
            "testable": {"ok": False, "task": None},
            "dedup_of": None,
        }
        group = groups.setdefault(_norm(pain), [])
        if group:
            row["dedup_of"] = group[0][0]["id"]
        group.append((row, stamp, str(item.get("user") or "")))
        rows.append(row)

    for group in groups.values():
        if len(group) < 2:
            continue
        head = group[0][0]
        links: list[str] = []
        for row, _, _ in group:
            if row["links"][0] not in links:
                links.append(row["links"][0])
        people = {user or f"?{i}" for i, (_, _, user) in enumerate(group)}
        head["links"] = links[:MAX_LINKS]
        head["mentions"] = {
            "count": len(group),
            "people": len(people),
            "window_days": _window_days([stamp for _, stamp, _ in group]),
        }
    return rows
