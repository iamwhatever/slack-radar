"""Slack Radar — Dispatch fix: open a ``kirocrew-conductor`` session and track it.

Gateway-side glue for ``POST /items/handoff/dispatch`` and the tracking reads. The
seed itself is built by the pure ``handoff.build_seed``; this module only touches the
host: it creates ONE ordinary dashboard session (the owner's, not the crew's: no app
tag, user origin, no trust posture), titles it, files it under
``Slack Radar/fixes``, and sends the seed as its first message. Afterwards it reads
that session's slot to say running / idle / closed and to spot the PR URL the
conductor reports.

The host surfaces used here (``get_or_create_slot``, ``enqueue_or_run_prompt``, the
folder store) are the ones ``crew_runtime`` already drives for the crew session;
they are not a published app API, so every import is guarded and a missing piece
degrades (an unfiled session, an unknown state) instead of failing the click.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any

from . import crew_runtime, handoff, store

logger = logging.getLogger("kirocrew.app.slack-radar")

#: Keys with a dispatch in progress in this process; a second click is refused.
_in_flight: set[str] = set()


class DispatchUnavailable(RuntimeError):
    """The gateway gave this route no way to create a session."""


def can_create(state: Any) -> bool:
    return state is not None and callable(getattr(state, "get_or_create_slot", None))


def claim(key: str) -> bool:
    if key in _in_flight:
        return False
    _in_flight.add(key)
    return True


def release(key: str) -> None:
    _in_flight.discard(key)


def _user_origin() -> str:
    try:
        from kiro_crew.dashboard.state import SlotOrigin

        return str(SlotOrigin.USER)
    except Exception:  # noqa: BLE001 - host without the enum
        return "user"


async def _set_title(state: Any, slot: Any, title: str) -> None:
    slot.title = title
    slot._titled = True
    log = getattr(state, "conversation_log", None)
    if log is not None:
        try:
            from kiro_crew.dashboard.chat_utils import slot_history_key

            await asyncio.to_thread(log.set_title, slot_history_key(slot), title)
        except Exception:  # noqa: BLE001 - persistence is best-effort
            logger.debug("slack-radar: could not persist dispatch title", exc_info=True)
    crew_runtime._call_if_present(state, "push_slot_title", slot.key, title)


async def _folder_id(state: Any) -> str:
    """The id of ``Slack Radar/fixes``, created on the way. ``""`` when unavailable."""
    from kiro_crew.dashboard.chat_folders import create_folder_record

    parent = ""
    for name in handoff.FOLDER_PATH:
        def _find(folders: list[dict[str, Any]], name: str = name, parent: str = parent) -> str:
            for f in folders:
                if str(f.get("name") or "") == name and str(f.get("parent_id") or "") == parent:
                    return str(f.get("id") or "")
            return ""

        found = await state.read_folders(_find)
        if not found:
            made = await create_folder_record(state, name=name, parent_id=parent)
            found = str(made.get("id") or "")
        if not found:
            return ""
        parent = found
    return parent


async def _file(state: Any, slot: Any) -> bool:
    """File ``slot`` under ``Slack Radar/fixes``. Best-effort; False when it did not land."""
    try:
        from kiro_crew.dashboard.chat_folders import _unhide_folder, note_folder_filed
        from kiro_crew.dashboard.chat_persistence import save_slot_off_loop

        fid = await _folder_id(state)
        if not fid:
            return False
        slot.folder_id = fid
        if not await _unhide_folder(state, fid):
            slot.folder_id = ""
            return False
        if not await save_slot_off_loop(state, slot, force=True):
            return False
        note_folder_filed(state, fid)
        crew_runtime._call_if_present(state, "push_slot_patch", slot.key, ("folder_id",))
        return True
    except Exception:  # noqa: BLE001 - an unfiled session is still a session
        logger.info("slack-radar: dispatched session left unfiled", exc_info=True)
        return False


async def open_session(state: Any, *, title: str, seed: str, workspace: str = "default") -> dict[str, Any]:
    """Create the conductor session and send ``seed`` once. Returns ``{session_key, title, filed}``."""
    if not can_create(state):
        raise DispatchUnavailable("the dashboard gave this app no session create")
    slot = state.get_or_create_slot(
        None, agent=handoff.CONDUCTOR_AGENT, workspace=workspace or "default", origin=_user_origin()
    )
    await _set_title(state, slot, title)
    filed = await _file(state, slot)
    slot.enqueue_or_run_prompt(seed, crew_runtime._owner_run_chat, state)
    crew_runtime._call_if_present(state, "push_slots_update")
    return {"session_key": str(slot.key), "title": title, "filed": filed}


# ── tracking ───────────────────────────────────────────────────────────────


def slot_state(state: Any, session_key: str) -> tuple[str, Any]:
    """``("running"|"idle"|"closed"|"unknown", slot or None)`` for a dispatched session."""
    if state is None or not hasattr(state, "get_slot"):
        return "unknown", None
    try:
        slot = state.get_slot(session_key)
    except Exception:  # noqa: BLE001
        return "unknown", None
    if slot is None:
        return "closed", None
    return ("running" if getattr(slot, "running", False) else "idle"), slot


def _batch_scan(ledger: dict[str, Any], batches: dict[str, list[str]], slots: dict[str, Any]
                ) -> tuple[dict[str, str], dict[str, list[str]]]:
    """Per batch session: ``({key: pr_url}, {key: [unmatched pr urls]})`` read from its messages."""
    one: dict[str, str] = {}
    many: dict[str, list[str]] = {}
    items = ledger.get("items") or {}
    for session_key, members in batches.items():
        slot = slots.get(session_key)
        if slot is None:
            continue
        d = items[members[0]]["fix_handoff"]["dispatch"]
        order = [k for k in d.get("batch_keys") or [] if k in items] or members
        titles = {k: " ".join(str(items[k]["fix_handoff"].get("title") or "").split()) for k in order}
        exclude: set[str] = set()
        for k in order:
            exclude |= set(items[k]["fix_handoff"].get("links") or []) | set(items[k].get("links") or [])
        matched, unmatched = handoff.find_batch_prs(
            list(getattr(slot, "messages", None) or [])[-80:], order, titles, exclude=exclude
        )
        for k in members:
            h = items[k]["fix_handoff"]
            if matched.get(k) and not h.get("pr_url"):
                one[k] = matched[k]
            extra = [u for u in unmatched if u not in (h.get("pr_urls") or [])]
            if extra:
                many[k] = extra
    return one, many


async def observe(state: Any, data_dir: Path, ledger: dict[str, Any]) -> dict[str, dict[str, Any]]:
    """Live facts per dispatched item: ``{key: {state, pr_url, pr_urls}}``.

    Reads each dispatched session's slot on the event loop (slots are loop-owned). A
    single dispatch's PR URL found in its assistant messages is stored on
    ``fix_handoff.pr_url`` (once) with a ``dispatch`` event. A batch session is read
    once for all its members: each ``PR: <url>`` line goes to the fix it names, and
    the ones naming none go to every member's ``pr_urls``. Stored values are written
    into ``ledger`` too so the caller's view already shows them.
    """
    out: dict[str, dict[str, Any]] = {}
    found: dict[str, str] = {}
    batches: dict[str, list[str]] = {}
    slots: dict[str, Any] = {}
    for key, it in (ledger.get("items") or {}).items():
        h = it.get("fix_handoff") if isinstance(it, dict) else None
        d = h.get("dispatch") if isinstance(h, dict) else None
        if not isinstance(d, dict) or not d.get("session_key"):
            continue
        live, slot = slot_state(state, str(d["session_key"]))
        pr = str(h.get("pr_url") or "")
        if d.get("batch"):
            batches.setdefault(str(d["session_key"]), []).append(key)
            if slot is not None:
                slots[str(d["session_key"])] = slot
        elif not pr and slot is not None:
            pr = handoff.find_pr_url(
                list(getattr(slot, "messages", None) or [])[-40:],
                exclude=set(h.get("links") or []) | set(it.get("links") or []),
                repo=str(h.get("repo") or ""),
            )
            if pr:
                found[key] = pr
        out[key] = {"state": live, "pr_url": pr, "pr_urls": [u for u in h.get("pr_urls") or [] if isinstance(u, str)]}
    many: dict[str, list[str]] = {}
    if batches:
        one, many = _batch_scan(ledger, batches, slots)
        found.update(one)
        for k, url in one.items():
            out[k]["pr_url"] = url
    if found or many:
        def _store(led: dict[str, Any]) -> tuple[list[str], dict[str, list[str]]]:
            singles = [k for k, url in found.items() if store.apply_fix_pr(led, k, url)]
            added = {k: store.apply_fix_pr_urls(led, k, urls) for k, urls in many.items()}
            return singles, {k: v for k, v in added.items() if v}

        try:
            new, added = await asyncio.to_thread(store.mutate, data_dir, _store)
        except (OSError, store.StoreError):
            logger.debug("slack-radar: could not store a fix PR", exc_info=True)
            new, added = [], {}
        for k in new:
            ledger["items"][k]["fix_handoff"]["pr_url"] = found[k]
            out[k]["pr_url"] = found[k]
            await asyncio.to_thread(store.append_event, data_dir, "dispatch", f"fix PR opened: {found[k]}", k)
        logged: set[str] = set()
        for k, urls in added.items():
            h = ledger["items"][k]["fix_handoff"]
            h["pr_urls"] = [*(h.get("pr_urls") or []), *urls]
            out[k]["pr_urls"] = list(h["pr_urls"])
            for u in urls:
                if u not in logged:
                    logged.add(u)
                    await asyncio.to_thread(store.append_event, data_dir, "dispatch", f"fix batch PR opened: {u}", k)
    return out
