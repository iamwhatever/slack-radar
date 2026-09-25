"""Slack Radar — the local ledger: per-channel cursors, triage items, crew memory.

STDLIB ONLY, deliberately. This module is imported from two processes:

* the gateway (``routes.py`` / ``watch.py`` / ``crew_runtime.py``, loaded in-process
  through the app's hook loader), and
* the app's stdio MCP server (``mcp_server.py``), which kiro-cli spawns for the crew
  session and which may run on an interpreter that cannot import ``kiro_crew``.

Both write the same files, so every mutation is a locked read-modify-write through
:func:`mutate`, and every write is an atomic replace (temp file in the same
directory, then ``os.replace``), so a reader never sees a torn document.

Layout under the app data dir (``~/.kiro/crew/apps/slack-radar/data/``):

* ``ledger.json``   — channels (cursor state), items (triage entries), crew memory,
  digest state. See ``crew_ledger_spec.md`` for every field.
* ``ledger.json.lock`` — sidecar lock (the ledger itself is replaced by rename, so it
  cannot be the lock).
* ``events.jsonl``  — append-only work log, capped by :data:`MAX_EVENTS_BYTES`.
* ``crew.json``     — the crew record (enabled / paused / unattended / agent / model).

Nothing in these files carries authority. The settings that decide WHICH channels are
read, WHICH Slack MCP binary is spawned and WHETHER a digest is DMed live in the
keystone-floor vault (``settings.py``), because this directory is readable and writable
by agents.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

SCHEMA = 1

LEDGER_FILENAME = "ledger.json"
EVENTS_FILENAME = "events.jsonl"
CREW_FILENAME = "crew.json"

#: Classification vocabulary. The crew may only write these values.
CATEGORIES = ("feature-request", "bug-report", "question", "already-answered", "noise")
PRIORITIES = ("p0", "p1", "p2", "p3")
#: Item lifecycle. ``new`` is the only status the poller writes; everything else is
#: the crew's judgement. There is no code path that sets ``resolved`` on its own.
STATUSES = ("new", "triaged", "investigating", "resolved", "noise")
OPEN_STATUSES = frozenset({"new", "triaged", "investigating"})
#: Crew-level phases (the crew's resumable position across turns).
CREW_PHASES = ("idle", "triaging", "investigating", "rechecking", "digest")

MAX_TEXT = 4000
MAX_SUMMARY = 600
MAX_NOTE = 1000
MAX_NEXT = 500
MAX_LINKS = 10
MAX_TRIED = 30
MAX_ITEMS = 2000
MAX_EVENTS_BYTES = 2 * 1024 * 1024

_KEY_RE = re.compile(r"^[CGD][A-Z0-9]{2,20}:\d{9,11}\.\d{6}$")
_CHANNEL_RE = re.compile(r"^[CGD][A-Z0-9]{2,20}$")
_URL_RE = re.compile(r"^https://[^\s<>\"']{1,500}$")

# Credential-shaped strings in MESSAGE CONTENT are masked before anything is stored.
# This has nothing to do with how Slack Radar authenticates (it holds no credential):
# channel members paste secrets into channels, the ledger is readable by every agent
# on this box, and it feeds the digest, so it must never hold one.
_CREDENTIAL_PATTERNS = (
    re.compile(r"xox[abprs]-[A-Za-z0-9-]{10,}"),
    re.compile(r"xapp-[A-Za-z0-9-]{10,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    re.compile(r"sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
)
REDACTED = "[redacted]"


class StoreError(Exception):
    """A ledger read/write the caller must surface rather than paper over."""


# ── paths ──────────────────────────────────────────────────────────────────


def default_data_dir() -> Path:
    """The app data dir when no gateway context is available (the MCP server).

    ``SLACK_RADAR_DATA_DIR`` overrides it (tests, unusual installs). Otherwise it is
    ``<app root>/data`` — the same directory ``AppContext.data_dir`` names, because
    the gateway installs an app by copying its tree to ``apps/<name>/`` and keeps its
    data in ``apps/<name>/data``.
    """
    env = os.environ.get("SLACK_RADAR_DATA_DIR", "").strip()
    if env:
        return Path(env)
    return Path(__file__).resolve().parents[1] / "data"


def ledger_path(data_dir: Path) -> Path:
    return Path(data_dir) / LEDGER_FILENAME


def events_path(data_dir: Path) -> Path:
    return Path(data_dir) / EVENTS_FILENAME


def crew_path(data_dir: Path) -> Path:
    return Path(data_dir) / CREW_FILENAME


# ── primitives ─────────────────────────────────────────────────────────────


def now() -> float:
    return time.time()


def redact(text: str) -> str:
    out = text or ""
    for pat in _CREDENTIAL_PATTERNS:
        out = pat.sub(REDACTED, out)
    return out


def clip(text: Any, limit: int) -> str:
    s = redact(str(text or ""))
    return s if len(s) <= limit else s[: limit - 1] + "…"


def is_channel_id(value: Any) -> bool:
    return isinstance(value, str) and bool(_CHANNEL_RE.match(value))


def is_item_key(value: Any) -> bool:
    return isinstance(value, str) and bool(_KEY_RE.match(value))


def item_key(channel: str, ts: str) -> str:
    return f"{channel}:{ts}"


def _atomic_write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(text)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


@contextmanager
def _file_lock(path: Path) -> Iterator[None]:
    """Exclusive cross-process lock on a sidecar file (POSIX flock / Windows msvcrt)."""
    lock_path = path.with_name(path.name + ".lock")
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(str(lock_path), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        if os.name == "nt":  # pragma: no cover - exercised on Windows only
            import msvcrt

            while True:
                try:
                    msvcrt.locking(fd, msvcrt.LK_LOCK, 1)
                    break
                except OSError:
                    time.sleep(0.05)
            try:
                yield
            finally:
                os.lseek(fd, 0, 0)
                msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fd, fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise StoreError(f"{path.name} is corrupt: {exc}") from None


# ── ledger ─────────────────────────────────────────────────────────────────


def empty_ledger() -> dict[str, Any]:
    return {
        "schema": SCHEMA,
        "source_state": "ok",
        "source_error": "",
        "channels": {},
        "items": {},
        "crew_memory": {
            "phase": "idle",
            "next": "",
            "tried": [],
            "rejected": [],
            "updated_at": 0.0,
        },
        "digest": {
            "requested_at": 0.0,
            "pending": None,
            "last_posted_at": 0.0,
            "last_posted_date": "",
            "last_destination": "",
            "last_text": "",
            "last_error": "",
        },
        "last_poll_at": 0.0,
        "last_poll_error": "",
    }


def _coerce_ledger(raw: Any) -> dict[str, Any]:
    """Fill missing top-level keys so an older or partial file reads cleanly.

    A document whose ROOT is not an object is refused rather than replaced: a
    rewrite from an empty base would silently delete every cursor and item.
    """
    if raw is None:
        return empty_ledger()
    if not isinstance(raw, dict):
        raise StoreError("ledger.json root is not an object")
    base = empty_ledger()
    for key, default in base.items():
        value = raw.get(key, default)
        if isinstance(default, dict) and not isinstance(value, dict):
            value = default
        base[key] = value
    for key, default in empty_ledger()["crew_memory"].items():
        base["crew_memory"].setdefault(key, default)
    for key, default in empty_ledger()["digest"].items():
        base["digest"].setdefault(key, default)
    return base


def read_ledger(data_dir: Path) -> dict[str, Any]:
    return _coerce_ledger(_read_json(ledger_path(data_dir)))


def mutate(data_dir: Path, fn: Callable[[dict[str, Any]], Any]) -> Any:
    """Locked read-modify-write of the ledger. ``fn`` edits in place; its return is passed back."""
    path = ledger_path(data_dir)
    with _file_lock(path):
        ledger = _coerce_ledger(_read_json(path))
        result = fn(ledger)
        _prune(ledger)
        _atomic_write_text(path, json.dumps(ledger, indent=1, sort_keys=True))
    return result


def _prune(ledger: dict[str, Any], retention_days: int = 30) -> None:
    """Drop closed items past retention, then cap the total (oldest closed first)."""
    items: dict[str, dict[str, Any]] = ledger.get("items") or {}
    horizon = now() - retention_days * 86400
    for key in [k for k, it in items.items() if it.get("status") not in OPEN_STATUSES]:
        if float(items[key].get("updated_at") or 0) < horizon:
            del items[key]
    if len(items) > MAX_ITEMS:
        ranked = sorted(
            items.items(),
            key=lambda kv: (kv[1].get("status") in OPEN_STATUSES, float(kv[1].get("ts_float") or 0)),
        )
        for key, _ in ranked[: len(items) - MAX_ITEMS]:
            del items[key]


# ── normalization (poller side) ────────────────────────────────────────────

#: Message subtypes that are channel housekeeping, never a request.
SKIP_SUBTYPES = frozenset(
    {
        "channel_join",
        "channel_leave",
        "channel_topic",
        "channel_purpose",
        "channel_name",
        "channel_archive",
        "channel_unarchive",
        "group_join",
        "group_leave",
        "pinned_item",
        "unpinned_item",
        "reminder_add",
        "bot_add",
        "bot_remove",
        "message_deleted",
        "message_changed",
        "tombstone",
    }
)


def permalink(workspace_url: str, channel: str, ts: str, thread_ts: str = "") -> str:
    """Construct a message permalink without a ``chat.getPermalink`` call per message.

    Same shape Slack's own permalinks use: ``<workspace>/archives/<C>/p<ts no dot>``,
    plus ``thread_ts``/``cid`` query for a reply so it opens inside the thread.
    """
    base = (workspace_url or "https://slack.com").rstrip("/")
    link = f"{base}/archives/{channel}/p{ts.replace('.', '')}"
    if thread_ts and thread_ts != ts:
        link += f"?thread_ts={thread_ts}&cid={channel}"
    return link


def normalize_message(
    channel: str, msg: dict[str, Any], workspace_url: str = ""
) -> dict[str, Any] | None:
    """One Slack ``conversations.history`` message → a ledger item, or None to skip."""
    ts = str(msg.get("ts") or "")
    if not ts or msg.get("subtype") in SKIP_SUBTYPES:
        return None
    thread_ts = str(msg.get("thread_ts") or "")
    if thread_ts and thread_ts != ts:
        return None  # a reply: history only surfaces these when broadcast; the parent owns it
    key = item_key(channel, ts)
    if not is_item_key(key):
        return None
    t = now()
    return {
        "key": key,
        "channel": channel,
        "ts": ts,
        "ts_float": float(ts),
        "thread_ts": thread_ts or ts,
        "user": str(msg.get("user") or msg.get("bot_id") or ""),
        "is_bot": bool(msg.get("bot_id")),
        "text": clip(msg.get("text"), MAX_TEXT),
        "permalink": str(msg.get("permalink") or "") if _URL_RE.match(str(msg.get("permalink") or ""))
        else permalink(workspace_url, channel, ts),
        "reply_count": int(msg.get("reply_count") or 0),
        "latest_reply": str(msg.get("latest_reply") or ""),
        "reactions": sorted({str(r.get("name")) for r in msg.get("reactions") or [] if r.get("name")}),
        # crew-owned (public: may appear in the digest)
        "status": "new",
        "category": "",
        "priority": "",
        "summary": "",
        "links": [],
        # crew-owned (local: never rendered outside this machine)
        "note": "",
        "investigation": "",
        # poller-owned signals for the crew
        "needs_triage": True,
        "thread_changed": False,
        "possibly_resolved": None,
        # history already carried reply_count/latest_reply, so the first thread
        # re-check is due one RECHECK_MIN_GAP after ingest, not in the same cycle.
        "last_thread_check_at": t,
        "first_seen_at": t,
        "updated_at": t,
    }


# ── crew record ────────────────────────────────────────────────────────────

#: The crew's FIRST slot key. The live key lives in the crew record (``slot_key``) and
#: gains a generation suffix (``crew-slack-radar-g2`` …) each time the session has to be
#: moved to a different agent: the host never re-binds an existing slot's agent, and a
#: closed key's transcript/tombstone would follow a same-key recreate. Always read the
#: current key with :func:`slot_key` — never this constant — outside this module.
SLOT_KEY = "crew-slack-radar"
_SLOT_KEY_RE = re.compile(r"^crew-slack-radar(?:-g([1-9][0-9]{0,5}))?$")


def is_crew_slot_key(value: Any) -> bool:
    return isinstance(value, str) and bool(_SLOT_KEY_RE.match(value))


def next_slot_key(current: str) -> str:
    """``crew-slack-radar`` -> ``crew-slack-radar-g2`` -> ``…-g3``."""
    m = _SLOT_KEY_RE.match(current or "")
    gen = int(m.group(1)) if m and m.group(1) else 1
    return f"{SLOT_KEY}-g{gen + 1}"


def slot_key(crew: dict[str, Any]) -> str:
    key = crew.get("slot_key")
    return key if is_crew_slot_key(key) else SLOT_KEY
#: The crew agent this app ships (agents/slack-radar-crew.json). The gateway writes it
#: to ~/.kiro/agents/slack-radar--slack-radar-crew.json with the app's ledger MCP server
#: already mounted and auto-approved; kiro-cli dispatches it by this declared name. The
#: user's own agents are never modified to carry the ledger tools.
CREW_AGENT = "slack-radar-crew"
#: The pre-0.3 default. A crew record still holding it was never a user choice worth
#: keeping: that agent does not carry the ledger tools, so the crew could not work.
_LEGACY_DEFAULT_AGENT = "kirocrew"

DEFAULT_CREW: dict[str, Any] = {
    "id": "slack-radar",
    "name": "Slack Radar",
    "slot_key": SLOT_KEY,
    "agent": CREW_AGENT,
    "model": "",
    "workspace": "default",
    "enabled": False,
    "paused_reason": "",
    "unattended": False,
    "created_at": 0.0,
    "updated_at": 0.0,
}


def read_crew(data_dir: Path) -> dict[str, Any]:
    raw = _read_json(crew_path(data_dir))
    rec = dict(DEFAULT_CREW)
    if isinstance(raw, dict):
        for key in DEFAULT_CREW:
            if key in raw and key != "id":
                rec[key] = raw[key]
    if not is_crew_slot_key(rec.get("slot_key")):
        rec["slot_key"] = SLOT_KEY
    if not str(rec.get("agent") or "").strip() or rec.get("agent") == _LEGACY_DEFAULT_AGENT:
        rec["agent"] = CREW_AGENT
    rec["enabled"] = rec.get("enabled") is True
    rec["unattended"] = rec.get("unattended") is True
    return rec


def update_crew(data_dir: Path, patch: dict[str, Any]) -> dict[str, Any]:
    path = crew_path(data_dir)
    with _file_lock(path):
        rec = read_crew(data_dir)
        for key in ("agent", "model", "workspace", "name", "paused_reason"):
            if key in patch:
                rec[key] = clip(patch[key], 120)
        for key in ("enabled", "unattended"):
            if key in patch:
                rec[key] = patch[key] is True
        if "slot_key" in patch:
            if not is_crew_slot_key(patch["slot_key"]):
                raise StoreError("slot_key must be crew-slack-radar or crew-slack-radar-g<N>")
            rec["slot_key"] = patch["slot_key"]
        if not rec["created_at"]:
            rec["created_at"] = now()
        rec["updated_at"] = now()
        _atomic_write_text(path, json.dumps(rec, indent=1, sort_keys=True))
    return rec


# ── events (work log) ──────────────────────────────────────────────────────


def append_event(data_dir: Path, kind: str, text: str, key: str = "") -> None:
    path = events_path(data_dir)
    row = {"at": now(), "kind": clip(kind, 40), "text": clip(text, MAX_NOTE), "key": key}
    with _file_lock(path):
        try:
            if path.stat().st_size > MAX_EVENTS_BYTES:
                lines = path.read_text(encoding="utf-8").splitlines()
                _atomic_write_text(path, "\n".join(lines[len(lines) // 2 :]) + "\n")
        except FileNotFoundError:
            pass
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(row) + "\n")


def read_events(data_dir: Path, limit: int = 200) -> list[dict[str, Any]]:
    try:
        lines = events_path(data_dir).read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    out: list[dict[str, Any]] = []
    for line in lines[-limit:]:
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict):
            out.append(row)
    return out


# ── crew write path (used by the MCP server) ───────────────────────────────


def apply_crew_record(ledger: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Validate and apply one ``slack_radar_record`` call. Returns a result summary.

    Every enum is checked against the vocabulary above and every text field is
    clipped and redacted. Unknown item keys are reported, not created: the crew can
    only annotate items the poller recorded.
    """
    items = ledger["items"]
    applied: list[str] = []
    refused: list[dict[str, str]] = []
    for row in payload.get("items") or []:
        if not isinstance(row, dict):
            refused.append({"key": "?", "why": "item must be an object"})
            continue
        key = str(row.get("key") or "")
        item = items.get(key)
        if item is None:
            refused.append({"key": key, "why": "unknown item key"})
            continue
        problems: list[str] = []
        if "category" in row:
            if row["category"] in CATEGORIES:
                item["category"] = row["category"]
            else:
                problems.append(f"category must be one of {CATEGORIES}")
        if "priority" in row:
            if row["priority"] in PRIORITIES:
                item["priority"] = row["priority"]
            else:
                problems.append(f"priority must be one of {PRIORITIES}")
        if "status" in row:
            if row["status"] in STATUSES and row["status"] != "new":
                item["status"] = row["status"]
            else:
                problems.append("status must be triaged|investigating|resolved|noise")
        if "summary" in row:
            item["summary"] = clip(row["summary"], MAX_SUMMARY)
        if "note" in row:
            item["note"] = clip(row["note"], MAX_NOTE)
        if "investigation" in row:
            item["investigation"] = clip(row["investigation"], 200)
        if "links" in row:
            links = [str(u) for u in (row["links"] or []) if isinstance(u, str) and _URL_RE.match(u)]
            item["links"] = links[:MAX_LINKS]
        if problems:
            refused.append({"key": key, "why": "; ".join(problems)})
        # Reading an item and recording anything about it clears the poller's flags:
        # the crew has now seen the current state.
        item["needs_triage"] = False
        item["thread_changed"] = False
        if row.get("clear_possibly_resolved") or item["status"] in ("resolved", "noise"):
            item["possibly_resolved"] = None
        item["updated_at"] = now()
        applied.append(key)
    mem = ledger["crew_memory"]
    crew = payload.get("crew")
    if isinstance(crew, dict):
        if crew.get("phase") in CREW_PHASES:
            mem["phase"] = crew["phase"]
        if "next" in crew:
            mem["next"] = clip(crew["next"], MAX_NEXT)
        for field in ("tried", "rejected"):
            add = crew.get(f"{field}_add")
            if isinstance(add, list):
                mem[field] = (list(mem.get(field) or []) + [clip(x, 200) for x in add])[-MAX_TRIED:]
        mem["updated_at"] = now()
    return {"applied": applied, "refused": refused}


def pending_view(ledger: dict[str, Any], limit: int = 40) -> dict[str, Any]:
    """What the crew must look at this turn, oldest first, bounded."""
    items = list((ledger.get("items") or {}).values())
    items.sort(key=lambda it: float(it.get("ts_float") or 0))

    def brief(it: dict[str, Any], with_text: bool) -> dict[str, Any]:
        out = {
            k: it.get(k)
            for k in (
                "key",
                "channel",
                "user",
                "permalink",
                "reply_count",
                "status",
                "category",
                "priority",
                "summary",
                "links",
                "note",
                "possibly_resolved",
            )
        }
        if with_text:
            out["text"] = it.get("text")
        return out

    triage = [brief(it, True) for it in items if it.get("needs_triage")][:limit]
    changed = [
        brief(it, True)
        for it in items
        if not it.get("needs_triage") and (it.get("thread_changed") or it.get("possibly_resolved"))
    ][:limit]
    return {"needs_triage": triage, "thread_updates": changed}


def counts(ledger: dict[str, Any]) -> dict[str, Any]:
    items = (ledger.get("items") or {}).values()
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    by_priority: dict[str, int] = {}
    needs_triage = possibly_resolved = 0
    for it in items:
        by_status[it.get("status") or "new"] = by_status.get(it.get("status") or "new", 0) + 1
        if it.get("category"):
            by_category[it["category"]] = by_category.get(it["category"], 0) + 1
        if it.get("priority") and it.get("status") in OPEN_STATUSES:
            by_priority[it["priority"]] = by_priority.get(it["priority"], 0) + 1
        needs_triage += 1 if it.get("needs_triage") else 0
        possibly_resolved += 1 if it.get("possibly_resolved") else 0
    return {
        "total": sum(by_status.values()),
        "by_status": by_status,
        "by_category": by_category,
        "open_by_priority": by_priority,
        "needs_triage": needs_triage,
        "possibly_resolved": possibly_resolved,
    }
