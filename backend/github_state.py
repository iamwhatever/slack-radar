"""Slack Radar — read a dispatched fix's PR state with the owner's own ``gh`` CLI.

Gateway-side and READ-ONLY: the only command this module runs is
``gh pr view <url> --json state,mergedAt,closedAt,isDraft``, through the owner's
local ``gh`` login. Nothing here writes to GitHub, posts to Slack, wakes the crew or
regenerates a draft. The poll cycle (``watch.poll_once``) calls :func:`refresh` once
per cycle; nothing else does.

Bounds, so a long list of fixes costs little:

* at most :data:`BATCH_MAX` URLs per cycle, the oldest-checked first;
* a URL is not read again within :data:`MIN_GAP_SECS`;
* a URL whose last known state is ``merged`` or ``closed`` is never read again;
* ``gh`` missing, not logged in, rate-limited or timing out stops the cycle's reads,
  stores ``unknown`` with a short ``why`` on the URLs it was due to read, and no URL
  is read again for :data:`UNKNOWN_BACKOFF_SECS`.

Per-URL readings live in ``pr_states.json`` beside the ledger. Each dispatched item
gets ``fix_handoff.pr_state = {state, at, checked_at[, merged_at][, why]}`` (``at`` is
when the state last changed), written only here; the record tool refuses it. The
first time an item's state becomes ``merged`` one ``dispatch`` event
``PR #N merged`` is logged. That is all a PR state change does: no flag, no wake, no
Watcher run. A merged fix reaches the Lead only when the owner presses Re-analyze
(``store.needs_reanalysis`` counts it for that button).
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import subprocess
from pathlib import Path
from typing import Any, Callable

from . import handoff, store

logger = logging.getLogger("kirocrew.app.slack-radar")

PR_STATES = ("open", "draft", "merged", "closed", "unknown")
TERMINAL = frozenset({"merged", "closed"})
BATCH_MAX = 10
MIN_GAP_SECS = 1800.0
UNKNOWN_BACKOFF_SECS = 3600.0
GH_TIMEOUT_SECS = 20
GH_FIELDS = "state,mergedAt,closedAt,isDraft"
MAX_WHY = 120

_PR_URL_RE = re.compile(r"^https://github\.com/[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9._-]+/pull/\d+$")
_ISO_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T[0-9:.]+Z?$")

#: ``argv -> (returncode, stdout, stderr)``. Raises ``FileNotFoundError`` when the
#: binary is missing and ``subprocess.TimeoutExpired`` on a timeout.
Runner = Callable[[list[str]], tuple[int, str, str]]


def run_gh(argv: list[str]) -> tuple[int, str, str]:
    proc = subprocess.run(argv, capture_output=True, text=True, timeout=GH_TIMEOUT_SECS, check=False)
    return proc.returncode, proc.stdout or "", proc.stderr or ""


#: The runner :func:`refresh` uses when none is passed. Tests replace it.
runner: Runner = run_gh


class GhUnavailable(Exception):
    """``gh`` cannot answer for any URL right now (missing, logged out, rate-limited)."""


def states_path(data_dir: Path) -> Path:
    return Path(data_dir) / "pr_states.json"


def read_states(data_dir: Path) -> dict[str, Any]:
    try:
        raw = store._read_json(states_path(data_dir))
    except store.StoreError:
        raw = None
    if not isinstance(raw, dict):
        return {"urls": {}, "gh_backoff_until": 0.0}
    urls = raw.get("urls") if isinstance(raw.get("urls"), dict) else {}
    return {"urls": {k: v for k, v in urls.items() if isinstance(v, dict)},
            "gh_backoff_until": store._ts(raw.get("gh_backoff_until"))}


def write_states(data_dir: Path, states: dict[str, Any]) -> None:
    store._atomic_write_text(states_path(data_dir), json.dumps(states, indent=1, sort_keys=True))


def item_urls(item: dict[str, Any]) -> list[str]:
    """The PR URLs an item's fix state is read from: its own PR, else the batch's unmatched ones."""
    h = item.get("fix_handoff")
    if not isinstance(h, dict) or not isinstance(h.get("dispatch"), dict):
        return []
    own = str(h.get("pr_url") or "")
    urls = [own] if own else [u for u in h.get("pr_urls") or [] if isinstance(u, str)]
    return [u for u in dict.fromkeys(urls) if _PR_URL_RE.match(u)]


def _watched(item: dict[str, Any]) -> bool:
    return item.get("status") in store.OPEN_STATUSES and not store._ts(item.get("handled_at"))


def parse(stdout: str) -> dict[str, Any]:
    """``gh pr view --json`` output -> ``{state[, merged_at]}``; ``unknown`` when unreadable."""
    try:
        raw = json.loads(stdout or "")
    except ValueError:
        return {"state": "unknown", "why": "gh answered something that is not JSON"}
    if not isinstance(raw, dict):
        return {"state": "unknown", "why": "gh answered something that is not an object"}
    gh_state = str(raw.get("state") or "").upper()
    merged_at = str(raw.get("mergedAt") or "")
    if gh_state == "MERGED":
        out: dict[str, Any] = {"state": "merged"}
        if _ISO_RE.match(merged_at):
            out["merged_at"] = merged_at
        return out
    if gh_state == "CLOSED":
        return {"state": "closed"}
    if gh_state == "OPEN":
        return {"state": "draft" if raw.get("isDraft") is True else "open"}
    return {"state": "unknown", "why": "gh reported no PR state"}


def _why(stderr: str) -> str:
    line = next((ln.strip() for ln in (stderr or "").splitlines() if ln.strip()), "")
    return store.clip(f"gh: {line}" if line else "gh failed", MAX_WHY)


def read_one(url: str, run: Runner) -> dict[str, Any]:
    """One URL's state. Raises :class:`GhUnavailable` when no URL can be read now."""
    try:
        rc, out, err = run(["gh", "pr", "view", url, "--json", GH_FIELDS])
    except FileNotFoundError:
        raise GhUnavailable("gh is not installed") from None
    except subprocess.TimeoutExpired:
        raise GhUnavailable("gh timed out") from None
    except OSError as exc:
        raise GhUnavailable(store.clip(f"gh could not start: {exc.strerror or exc}", MAX_WHY)) from None
    if rc != 0:
        low = (err or "").lower()
        if "rate limit" in low:
            raise GhUnavailable("gh is rate-limited")
        if "gh auth login" in low or "not logged" in low or "authentication" in low:
            raise GhUnavailable("gh is not logged in")
        return {"state": "unknown", "why": _why(err)}
    return parse(out)


def due_urls(ledger: dict[str, Any], states: dict[str, Any], now_: float) -> list[str]:
    """URLs to read this cycle: watched, not terminal, past their gap; oldest-checked first."""
    if states.get("gh_backoff_until", 0.0) > now_:
        return []
    urls: set[str] = set()
    for it in (ledger.get("items") or {}).values():
        if isinstance(it, dict) and _watched(it):
            urls.update(item_urls(it))
    due: list[tuple[float, str]] = []
    for u in urls:
        s = states["urls"].get(u) or {}
        if s.get("state") in TERMINAL:
            continue
        gap = UNKNOWN_BACKOFF_SECS if s.get("state") == "unknown" else MIN_GAP_SECS
        checked = store._ts(s.get("checked_at"))
        if checked and now_ - checked < gap:
            continue
        due.append((checked, u))
    due.sort()
    return [u for _c, u in due[:BATCH_MAX]]


def combine(readings: list[dict[str, Any]]) -> dict[str, Any] | None:
    """One item's state from its URLs' readings (one URL in the common case)."""
    got = [r for r in readings if r.get("state") in PR_STATES]
    if not got:
        return None
    states = [r["state"] for r in got]
    for live in ("open", "draft"):
        if live in states:
            return {"state": live}
    if "unknown" in states:
        return next(r for r in got if r["state"] == "unknown")
    if "merged" in states:
        dates = sorted(str(r.get("merged_at") or "") for r in got if r.get("merged_at"))
        return {"state": "merged", **({"merged_at": dates[-1]} if dates else {})}
    return {"state": "closed"}


def apply_pr_state(ledger: dict[str, Any], key: str, reading: dict[str, Any], at: float) -> str:
    """Store ``reading`` on ``fix_handoff.pr_state``. Returns the previous state ('' if none)."""
    item = (ledger.get("items") or {}).get(key)
    h = item.get("fix_handoff") if isinstance(item, dict) else None
    if not isinstance(h, dict) or not isinstance(h.get("dispatch"), dict):
        return ""
    prev = h.get("pr_state") if isinstance(h.get("pr_state"), dict) else {}
    before = str(prev.get("state") or "")
    record: dict[str, Any] = {
        "state": reading["state"],
        "at": store._ts(prev.get("at")) if before == reading["state"] and prev.get("at") else at,
        "checked_at": at,
    }
    for k in ("merged_at", "why"):
        if reading.get(k):
            record[k] = reading[k]
    h["pr_state"] = record
    return before


async def refresh(data_dir: Path, *, run: Runner | None = None, now_: float | None = None) -> dict[str, Any]:
    """Read the due PRs and store their state. Returns ``{checked, changed, merged, unavailable}``."""
    run = run or runner
    t = store.now() if now_ is None else now_
    try:
        ledger = await asyncio.to_thread(store.read_ledger, data_dir)
    except store.StoreError:
        return {"checked": 0, "changed": [], "merged": [], "unavailable": ""}
    states = await asyncio.to_thread(read_states, data_dir)
    urls = due_urls(ledger, states, t)
    unavailable = ""
    checked = 0
    for u in urls:
        if unavailable:
            states["urls"][u] = {"state": "unknown", "why": unavailable, "checked_at": t}
            continue
        try:
            reading = await asyncio.to_thread(read_one, u, run)
        except GhUnavailable as exc:
            unavailable = str(exc)
            states["gh_backoff_until"] = t + UNKNOWN_BACKOFF_SECS
            states["urls"][u] = {"state": "unknown", "why": unavailable, "checked_at": t}
            continue
        checked += 1
        states["urls"][u] = {**reading, "checked_at": t}
    if not urls:
        return {"checked": 0, "changed": [], "merged": [], "unavailable": ""}
    referenced = {u for it in (ledger.get("items") or {}).values() if isinstance(it, dict) for u in item_urls(it)}
    states["urls"] = {u: s for u, s in states["urls"].items() if u in referenced}
    await asyncio.to_thread(write_states, data_dir, states)

    read_now = set(urls)

    def _store(led: dict[str, Any]) -> tuple[list[str], list[str]]:
        changed: list[str] = []
        merged: list[str] = []
        for key, it in (led.get("items") or {}).items():
            mine = item_urls(it) if isinstance(it, dict) else []
            if not mine or not read_now.intersection(mine):
                continue
            reading = combine([states["urls"].get(u) or {} for u in mine])
            if reading is None:
                continue
            before = apply_pr_state(led, key, reading, t)
            if before != reading["state"]:
                changed.append(key)
                if reading["state"] == "merged":
                    merged.append(key)
        return changed, merged

    try:
        changed, merged = await asyncio.to_thread(store.mutate, data_dir, _store)
    except (OSError, store.StoreError):
        logger.debug("slack-radar: could not store a PR state", exc_info=True)
        return {"checked": checked, "changed": [], "merged": [], "unavailable": unavailable}
    if merged:
        fresh = await asyncio.to_thread(store.read_ledger, data_dir)
        logged: set[str] = set()
        for k in merged:
            url = (item_urls(fresh["items"].get(k) or {}) or [""])[0]
            if url in logged:
                continue
            logged.add(url)
            await asyncio.to_thread(store.append_event, data_dir, "dispatch", f"PR #{handoff.pr_number(url)} merged", k)
    if unavailable:
        logger.info("slack-radar: PR state not read (%s); next try in an hour", unavailable)
    return {"checked": checked, "changed": changed, "merged": merged, "unavailable": unavailable}
