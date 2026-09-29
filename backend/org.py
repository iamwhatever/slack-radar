"""Slack Radar — the crew roster (``desk/members.json``) and its live view for ``GET /org``.

STDLIB ONLY, so the tests can drive it without a gateway. ``routes.py`` gathers the
live facts (crew record, slot, ledger, spawn SDK) and hands them to :func:`org_view`;
nothing here reads the host.

``members.json`` is data, not authority: it names who is on the crew and what each
member may touch, for the UI and for readers. The agents' real tool lists are in
``agents/*.json`` and the tests check the two agree on names.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

MEMBERS_PATH = Path(__file__).resolve().parents[1] / "desk" / "members.json"

MEMBER_IDS = ("lead", "investigator", "watcher", "poller")
KINDS = ("agent", "code")
RESIDENCIES = ("resident", "on-demand", "planned")
TOOLSETS = ("ledger+spawn", "ledger+shell", "ledger", "slack-read")
_LOCALES = ("en", "zh")


class MembersError(ValueError):
    """``members.json`` is missing or does not match the shape below."""


def validate_members(data: Any) -> list[str]:
    """Every problem with a parsed ``members.json``; empty when it is well formed.

    Shape: a list of objects, one per id in :data:`MEMBER_IDS`, each with
    ``id``, ``kind`` (agent|code), ``agent`` (str for an agent, null for code),
    ``display`` and ``role`` (``{"en": str, "zh": str}``), ``residency`` and ``tools``.
    """
    if not isinstance(data, list):
        return ["root must be a list of members"]
    errors: list[str] = []
    seen: list[str] = []
    for i, m in enumerate(data):
        where = f"members[{i}]"
        if not isinstance(m, dict):
            errors.append(f"{where} must be an object")
            continue
        mid = m.get("id")
        if mid not in MEMBER_IDS:
            errors.append(f"{where}.id must be one of {', '.join(MEMBER_IDS)}")
        elif mid in seen:
            errors.append(f"{where}.id {mid} is repeated")
        else:
            seen.append(mid)
        kind = m.get("kind")
        if kind not in KINDS:
            errors.append(f"{where}.kind must be agent or code")
        agent = m.get("agent")
        if kind == "agent" and not (isinstance(agent, str) and agent):
            errors.append(f"{where}.agent must name an agent")
        if kind == "code" and agent is not None:
            errors.append(f"{where}.agent must be null for code")
        for field in ("display", "role"):
            val = m.get(field)
            if not (isinstance(val, dict) and all(isinstance(val.get(loc), str) and val.get(loc) for loc in _LOCALES)):
                errors.append(f"{where}.{field} must carry non-empty en and zh strings")
        if m.get("residency") not in RESIDENCIES:
            errors.append(f"{where}.residency must be one of {', '.join(RESIDENCIES)}")
        if m.get("tools") not in TOOLSETS:
            errors.append(f"{where}.tools must be one of {', '.join(TOOLSETS)}")
        extra = set(m) - {"id", "kind", "agent", "display", "role", "residency", "tools"}
        if extra:
            errors.append(f"{where} has unknown fields: {', '.join(sorted(extra))}")
    missing = [mid for mid in MEMBER_IDS if mid not in seen]
    if missing:
        errors.append(f"missing members: {', '.join(missing)}")
    return errors


def load_members(path: Path = MEMBERS_PATH) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise MembersError(f"{path.name} unreadable: {exc}") from exc
    errors = validate_members(data)
    if errors:
        raise MembersError("; ".join(errors))
    return data


def org_view(
    members: list[dict[str, Any]],
    *,
    crew: dict[str, Any],
    investigations: dict[str, int],
    ledger: dict[str, Any],
    now: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """``members`` with a ``live`` block each.

    ``crew`` is the ``crew`` object ``GET /state`` returns (record plus ``live``,
    ``session_open``, ``running``); ``investigations`` is its ``investigations``;
    ``now`` is its ``now`` (:func:`now_view`), built here from the same facts when
    the caller passes none. Each ``live`` block carries that member's ``now`` row and
    takes its in-flight count from it, so the Team tab and the Board cannot disagree.
    """
    if now is None:
        now = now_view(crew=crew, ledger=ledger, investigations=investigations, members=members)
    rows = {r["id"]: r for r in now["members"]}
    out = []
    for m in members:
        mid = m["id"]
        row = rows.get(mid)
        if mid == "lead":
            live: dict[str, Any] = {
                "session_open": bool(crew.get("session_open")),
                "running": bool(crew.get("running")),
                "paused": not crew.get("live"),
                "paused_reason": str(crew.get("paused_reason") or ""),
                "slot_key": str(crew.get("slot_key") or ""),
            }
        elif mid == "investigator":
            live = {"in_flight": int((row or {}).get("count") or 0),
                    "items": int(investigations.get("items") or 0)}
        elif mid == "watcher":
            live = {"in_flight": int((row or {}).get("count") or 0), "planned": m["residency"] == "planned"}
        else:
            live = {"source_state": ledger.get("source_state") or "ok",
                    "last_poll_at": ledger.get("last_poll_at")}
        if row is not None:
            live["now"] = row
        out.append({**m, "live": live})
    return out


# ── live per-member status (``GET /now``) ──────────────────────────────────

INVESTIGATOR_AGENT = "slack-radar-investigator"
WATCHER_AGENT = "slack-radar-watcher"
DEFAULT_POLL_INTERVAL = 300
MIN_POLL_INTERVAL = 60
MAX_DOING = 80

#: A filesystem path inside a task line: ``/abs``, ``~/x``, ``./x``, ``../x``. The
#: lookbehind keeps a URL's ``//`` and a plain ``a/b`` word pair out of it.
_PATH_RE = re.compile(r"(?<![\w:/.~-])(?:~|\.{1,2})?/[^\s'\"`,;)]*")


def agent_matches(run_agent: str, name: str) -> bool:
    """A run's agent is ``name`` itself or the app's materialized ``<app>--<name>``."""
    return run_agent == name or run_agent.endswith(f"--{name}")


def task_line(task: Any) -> str:
    """One public line from a run's task: first line, paths cut, at most :data:`MAX_DOING` chars."""
    text = str(task or "").strip()
    text = text.splitlines()[0] if text else ""
    text = " ".join(_PATH_RE.sub("…", text).split())
    return text[:MAX_DOING].rstrip()


def ago(secs: float) -> str:
    """``42s`` / ``5m`` / ``3h``."""
    secs = max(0, int(secs))
    if secs < 90:
        return f"{secs}s"
    if secs < 90 * 60:
        return f"{round(secs / 60)}m"
    return f"{round(secs / 3600)}h"


def _lead_row(crew: dict[str, Any], ledger: dict[str, Any], counts: dict[str, Any]) -> dict[str, Any]:
    mem = ledger.get("crew_memory") or {}
    digest = ledger.get("digest") or {}
    phase = str(mem.get("phase") or "idle")
    triage = int(counts.get("needs_triage") or 0)
    resolved = int(counts.get("possibly_resolved") or 0)
    investigating = int((counts.get("by_status") or {}).get("investigating") or 0)
    if not crew.get("live"):
        state, doing = "paused", str(crew.get("paused_reason") or "") or "paused"
    elif crew.get("running"):
        state = "working"
        by_phase = {
            "triaging": f"triaging {triage} new items",
            "rechecking": f"judging {resolved} possibly-resolved threads",
            "digest": "writing the digest",
            "investigating": f"following {investigating} investigations",
        }
        if phase in by_phase:
            doing = by_phase[phase]
        elif digest.get("requested_at") and not digest.get("pending"):
            doing = "writing the digest"
        elif triage:
            doing = f"triaging {triage} new items"
        elif resolved:
            doing = f"judging {resolved} possibly-resolved threads"
        else:
            doing = "working"
    else:
        state = "idle"
        doing = f"{triage} new items wait for the next turn" if triage else "idle"
    turn = crew.get("turn_started_at")
    if isinstance(turn, (int, float)) and not isinstance(turn, bool) and turn > 0:
        since: float | None = float(turn)
    else:
        since = float(mem.get("updated_at") or 0) or float(crew.get("updated_at") or 0) or None
    return {"id": "lead", "state": state, "doing": doing, "since": since,
            "count": 1 if state == "working" else 0,
            "source": "gateway" if crew.get("session_open") else "ledger"}


def _leaf_row(mid: str, agent: str, runs: list[dict[str, Any]] | None, fallback: int,
              planned: bool, extra_ids: frozenset[str] = frozenset(),
              extra_since: float | None = None) -> dict[str, Any]:
    if runs is None:
        mine: list[dict[str, Any]] = []
        count, source = fallback, "ledger"
    else:
        mine = [r for r in runs if agent_matches(str(r.get("agent") or ""), agent)]
        seen = {str(r.get("id") or "") for r in mine}
        count, source = len(mine) + len(extra_ids - seen), "gateway"
    mine.sort(key=lambda r: float(r.get("startedAt") or 0))
    if count:
        state = "working"
        first = task_line(mine[0].get("task")) if mine else ""
        doing = first or ("1 run in flight" if count == 1 else f"{count} runs in flight")
        if first and count > 1:
            doing = f"{doing} (+{count - 1} more)"
    else:
        state, doing = ("planned", "not started yet") if planned else ("idle", "idle")
    since = (float(mine[0].get("startedAt") or 0) or None) if mine else None
    if count and extra_since and (since is None or extra_since < since):
        since = extra_since
    return {"id": mid, "state": state, "doing": doing, "since": since, "count": count, "source": source}


def _poller_row(ledger: dict[str, Any], interval: int, t: float) -> dict[str, Any]:
    last = float(ledger.get("last_poll_at") or 0)
    source_state = ledger.get("source_state") or "ok"
    if last:
        doing = f"last poll {ago(t - last)} ago · next in {ago(last + interval - t)}"
    else:
        doing = "has not polled yet"
    state = "idle"
    if source_state == "needs_login":
        state, doing = "paused", f"Slack login expired · {doing}"
    elif source_state != "ok":
        state, doing = "paused", f"Slack MCP unavailable · {doing}"
    return {"id": "poller", "state": state, "doing": doing, "since": last or None,
            "count": len(ledger.get("channels") or {}), "source": "ledger"}


def now_view(
    *,
    crew: dict[str, Any],
    ledger: dict[str, Any],
    investigations: dict[str, int],
    runs: list[dict[str, Any]] | None = None,
    open_spawn_ids: frozenset[str] = frozenset(),
    open_spawn_since: float | None = None,
    poll_interval: int = DEFAULT_POLL_INTERVAL,
    members: list[dict[str, Any]] | None = None,
    at: float | None = None,
) -> dict[str, Any]:
    """What each member is doing right now: ``{"members": [row, ...]}`` in roster order.

    ``runs`` is the gateway's list of the crew session's unfinished child runs
    (``id``, ``agent``, ``task``, ``startedAt``); ``None`` means the gateway gave no
    run list, and the investigator's count falls back to ``investigations["running"]``
    with ``source: "ledger"``. ``open_spawn_ids`` are ledger-recorded spawns the host
    says are still running (the Board's Investigate button spawns outside the crew
    session); each one not already in ``runs`` adds one to the investigator's count.
    ``open_spawn_since`` is when the oldest of those was started (the ledger's
    ``investigation_at``); it becomes the investigator's ``since`` when it is older
    than every listed run, or when no run carries a start.
    """
    from . import store

    t = time.time() if at is None else at
    c = store.counts(ledger)
    planned = {m["id"]: m.get("residency") == "planned" for m in (members or [])}
    interval = max(MIN_POLL_INTERVAL, int(poll_interval or DEFAULT_POLL_INTERVAL))
    return {"members": [
        _lead_row(crew, ledger, c),
        _leaf_row("investigator", INVESTIGATOR_AGENT, runs, int(investigations.get("running") or 0),
                  planned.get("investigator", False), open_spawn_ids, open_spawn_since),
        _leaf_row("watcher", WATCHER_AGENT, runs, 0, planned.get("watcher", False)),
        _poller_row(ledger, interval, t),
    ]}
