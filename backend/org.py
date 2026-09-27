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
) -> list[dict[str, Any]]:
    """``members`` with a ``live`` block each.

    ``crew`` is the ``crew`` object ``GET /state`` returns (record plus ``live``,
    ``session_open``, ``running``); ``investigations`` is its ``investigations``.
    """
    out = []
    for m in members:
        mid = m["id"]
        if mid == "lead":
            live: dict[str, Any] = {
                "session_open": bool(crew.get("session_open")),
                "running": bool(crew.get("running")),
                "paused": not crew.get("live"),
                "paused_reason": str(crew.get("paused_reason") or ""),
                "slot_key": str(crew.get("slot_key") or ""),
            }
        elif mid == "investigator":
            live = {"in_flight": int(investigations.get("running") or 0),
                    "items": int(investigations.get("items") or 0)}
        elif mid == "watcher":
            # No watcher spawns are tracked yet; the count is 0 until it ships.
            live = {"in_flight": 0, "planned": m["residency"] == "planned"}
        else:
            live = {"source_state": ledger.get("source_state") or "ok",
                    "last_poll_at": ledger.get("last_poll_at")}
        out.append({**m, "live": live})
    return out
