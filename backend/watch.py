"""Slack Radar — the zero-LLM poll cycle and the in-gateway scheduler.

Deterministic Python, same role as issue-radar's ``watch.py``: the only always-on loop in
this app, no credits spent, and it decides WHEN the crew gets a turn. Slack is read with
the USER's own identity through their Slack MCP server (``slack_mcp.py``), not a bot.

Per cycle:

1. One ``batch_get_conversation_history`` call for every configured channel, ``oldest`` =
   that channel's stored cursor converted to ISO-8601; channels with more pages are
   followed by cursor (bounded). New messages become ledger items and the cursor
   advances. The cursor is the app's own Slack ts string, independent of the user's
   Slack read marker, so reading a channel in Slack never hides a message from the radar.
2. One ``batch_get_thread_replies`` call for a BOUNDED window of open items, flagging
   "possibly resolved" candidates. A flag is a question for the crew, never a verdict.
3. The pending digest, if the crew submitted one: a self-DM (``self_dm``) or a dashboard
   notification, per the owner's setting. Nothing is ever posted to a channel.
4. Wake the crew when something moved (``crew_runtime.after_poll``).

**Login expiry is a state, never "no new messages".** The MCP authenticates with the
user's browser/Midway session. An auth error anywhere stops the cycle before any cursor
moves and persists ``source_state = "needs_login"``; the board shows it and the next
cycle retries with one cheap read before polling again.

Why an in-gateway loop and not a manifest cron for polling: an agent cron spends an LLM
turn per poll on pure I/O, and a script cron is sandboxed away from the vault that holds
the settings (including which MCP binary to spawn).
"""

from __future__ import annotations

import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from . import store
from .slack_mcp import (
    BinaryNotFound,
    McpTransportError,
    NeedsLogin,
    SlackMcpClient,
    SlackMcpError,
    ToolError,
    is_auth_error,
)

logger = logging.getLogger("kirocrew.app.slack-radar")

MAX_PAGES_PER_CHANNEL = 5
PAGE_LIMIT = 200
#: An item's thread is not re-read more often than this.
RECHECK_MIN_GAP_SECS = 1800
#: Floor between loop iterations regardless of settings (a bad value must not spin).
MIN_LOOP_SECS = 60

SOURCE_OK = "ok"
SOURCE_NEEDS_LOGIN = "needs_login"
SOURCE_NOT_FOUND = "binary_not_found"
SOURCE_ERROR = "error"

_RESOLVED_WORDS = re.compile(
    r"\b(fixed|resolved|done|merged|shipped|deployed|released|closing|closed|answered|"
    r"works now|working now|thanks|thank you|ty|solved)\b",
    re.IGNORECASE,
)
_RESOLVED_REACTIONS = frozenset(
    {"white_check_mark", "heavy_check_mark", "ballot_box_with_check", "done", "resolved", "merged"}
)


# ── Slack ts <-> ISO-8601 ──────────────────────────────────────────────────


def ts_to_iso(ts: str | float) -> str:
    """Slack ts → ISO-8601 UTC, floored to MILLISECONDS.

    The MCP converts ISO to a Slack ts at millisecond precision (verified:
    ``…00.123Z`` → ``….123000``). Flooring means the boundary can only move EARLIER, so
    a message is never skipped; a re-delivered one is dropped by its item key.
    """
    ms = int(float(ts) * 1000)
    dt = datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{ms % 1000:03d}Z"


def iso_to_ts(iso: str) -> str:
    """ISO-8601 (``Z`` or offset) → Slack ts string ``"<secs>.<6 digits>"``."""
    text = iso.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return f"{dt.timestamp():.6f}"


# ── reads over the MCP ─────────────────────────────────────────────────────


def _entry_error(entry: dict[str, Any]) -> str:
    err = entry.get("error")
    if not err and isinstance(entry.get("result"), dict) and entry["result"].get("ok") is False:
        err = entry["result"].get("error")
    return str(err or "")


def _short_error(text: str) -> str:
    """``bad response: {"ok":false,"error":"channel_not_found"}`` → ``channel_not_found``."""
    m = re.search(r'"error"\s*:\s*"([^"]{1,80})"', text)
    return m.group(1) if m else text[:120]


def fetch_history(
    client: SlackMcpClient, oldest_by_channel: dict[str, str]
) -> dict[str, dict[str, Any]]:
    """Messages newer than each channel's cursor. ``{channel: {messages, truncated, error}}``.

    Raises :class:`NeedsLogin` if ANY channel's answer is an auth failure: an expired
    session must stop the whole cycle, not read as one quiet channel.
    """
    out: dict[str, dict[str, Any]] = {
        c: {"messages": [], "truncated": False, "error": ""} for c in oldest_by_channel
    }
    pending = {c: "" for c in oldest_by_channel}  # channel -> cursor
    for _page in range(MAX_PAGES_PER_CHANNEL):
        if not pending:
            break
        req = [
            {"channelId": c, "oldest": ts_to_iso(oldest_by_channel[c]), "limit": PAGE_LIMIT,
             **({"cursor": cur} if cur else {})}
            for c, cur in pending.items()
        ]
        payload = client.call("batch_get_conversation_history", {"channels": req})
        if not isinstance(payload, list):
            raise ToolError("unexpected batch_get_conversation_history payload")
        nxt: dict[str, str] = {}
        for entry in payload:
            if not isinstance(entry, dict):
                continue
            cid = str(entry.get("channelId") or "")
            if cid not in out:
                continue
            err = _entry_error(entry)
            if err:
                if is_auth_error(err):
                    raise NeedsLogin(_short_error(err))
                out[cid]["error"] = _short_error(err)
                continue
            result = entry.get("result") or {}
            out[cid]["messages"].extend(m for m in result.get("messages") or [] if isinstance(m, dict))
            cursor = str((result.get("response_metadata") or {}).get("next_cursor") or "")
            if result.get("has_more") and cursor:
                nxt[cid] = cursor
        pending = nxt
    for cid in pending:
        out[cid]["truncated"] = True
    return out


def fetch_replies(client: SlackMcpClient, threads: list[tuple[str, str]]) -> list[dict[str, Any]]:
    """``[{messages, error}]`` aligned with ``threads`` (channel, parent ts)."""
    if not threads:
        return []
    payload = client.call(
        "batch_get_thread_replies",
        {"threads": [{"channelId": c, "threadTs": t} for c, t in threads]},
    )
    entries = payload if isinstance(payload, list) else []
    out: list[dict[str, Any]] = []
    for i, (c, t) in enumerate(threads):
        entry = next(
            (e for e in entries if isinstance(e, dict) and e.get("threadTs") == t and e.get("channelId") == c),
            entries[i] if i < len(entries) and isinstance(entries[i], dict) else {},
        )
        err = _entry_error(entry)
        if err and is_auth_error(err):
            raise NeedsLogin(_short_error(err))
        result = entry.get("result") if isinstance(entry.get("result"), dict) else entry
        msgs = [m for m in (result or {}).get("messages") or [] if isinstance(m, dict)]
        out.append({"messages": msgs, "error": _short_error(err) if err else ("" if entry else "missing")})
    return out


def _resolution_signal(parent: dict[str, Any], replies: list[dict[str, Any]], since: str) -> str:
    """A human-readable reason this thread MAY be resolved, or ""."""
    names = {str(r.get("name")) for r in parent.get("reactions") or []}
    hit = names & _RESOLVED_REACTIONS
    if hit:
        return f"parent has :{sorted(hit)[0]}: reaction"
    for rep in reversed(replies):
        if since and str(rep.get("ts") or "") <= since:
            break
        m = _RESOLVED_WORDS.search(str(rep.get("text") or ""))
        if m:
            return f"reply says “{m.group(0)}”"
    return ""


def _set_source(data_dir: Path, state: str, error: str, t0: float) -> None:
    def _apply(led: dict[str, Any]) -> None:
        led["source_state"] = state
        led["source_error"] = error[:300]
        led["last_poll_at"] = t0
        led["last_poll_error"] = error[:300] if state != SOURCE_OK else led.get("last_poll_error", "")

    store.mutate(data_dir, _apply)


# ── cycle (sync, testable with a stubbed client) ───────────────────────────


def run_cycle(
    data_dir: Path, client: SlackMcpClient, settings: dict[str, Any], *, clock: Callable[[], float] = time.time
) -> dict[str, Any]:
    """One full poll cycle. Blocking. Returns a summary the async layer acts on."""
    summary: dict[str, Any] = {"new": 0, "thread_changed": 0, "possibly_resolved": 0, "errors": {}}
    t0 = clock()
    try:
        _run_cycle_body(data_dir, client, settings, summary, t0)
    except NeedsLogin as exc:
        summary["source_state"] = SOURCE_NEEDS_LOGIN
        _set_source(data_dir, SOURCE_NEEDS_LOGIN, f"Slack MCP login expired: {exc}", t0)
        store.append_event(data_dir, "source", "Slack MCP needs re-login; polling paused until it answers")
        return summary
    except BinaryNotFound as exc:
        summary["source_state"] = SOURCE_NOT_FOUND
        _set_source(data_dir, SOURCE_NOT_FOUND, str(exc), t0)
        return summary
    except (McpTransportError, ToolError) as exc:
        summary["source_state"] = SOURCE_ERROR
        _set_source(data_dir, SOURCE_ERROR, f"{exc.code}: {exc}", t0)
        return summary
    summary["source_state"] = SOURCE_OK
    return summary


def _run_cycle_body(
    data_dir: Path, client: SlackMcpClient, settings: dict[str, Any], summary: dict[str, Any], t0: float
) -> None:
    ledger = store.read_ledger(data_dir)
    channels = list(settings.get("channels") or [])
    workspace_url = str(settings.get("workspace_url") or "")

    # 0. After a login failure, one cheap read decides whether the session is back.
    if ledger.get("source_state") == SOURCE_NEEDS_LOGIN and channels:
        client.call("batch_get_channel_info", {"channelIds": channels[:1]})
        store.append_event(data_dir, "source", "Slack MCP login restored")

    # 1. new messages, all channels in one batched call
    backfill = float(settings.get("backfill_hours") or 0) * 3600
    oldest: dict[str, str] = {}
    for channel in channels:
        state = (ledger.get("channels") or {}).get(channel) or {}
        oldest[channel] = str(state.get("cursor_ts") or "") or f"{t0 - backfill:.6f}"
    fetched = fetch_history(client, oldest) if oldest else {}

    for channel, res in fetched.items():
        def _apply(led: dict[str, Any], channel: str = channel, res: dict = res) -> int:
            ch = led["channels"].setdefault(channel, {})
            ch["last_polled_at"] = t0
            ch["last_error"] = res["error"]
            if res["error"]:
                return 0
            added = 0
            max_ts = str(ch.get("cursor_ts") or oldest[channel])
            for m in sorted(res["messages"], key=lambda m: float(m.get("ts") or 0)):
                ts = str(m.get("ts") or "")
                if ts and float(ts) > float(max_ts or 0):
                    max_ts = ts
                item = store.normalize_message(channel, m, workspace_url)
                if item is None or item["key"] in led["items"]:
                    continue
                led["items"][item["key"]] = item
                added += 1
            ch["cursor_ts"] = max_ts
            if res["truncated"]:
                ch["truncated_at"] = t0
            return added

        summary["new"] += store.mutate(data_dir, _apply)
        if res["error"]:
            summary["errors"][channel] = res["error"]
        if res["truncated"]:
            store.append_event(
                data_dir, "backlog",
                f"{channel}: more than {MAX_PAGES_PER_CHANNEL * PAGE_LIMIT} new messages in one cycle; "
                "the rest are read on the next cycle",
            )

    # 2. bounded thread re-check of open items, one batched call
    ledger = store.read_ledger(data_dir)
    horizon = t0 - float(settings.get("recheck_days") or 7) * 86400
    watched = set(channels)
    due = [
        it
        for it in (ledger.get("items") or {}).values()
        if it.get("status") in store.OPEN_STATUSES
        and it.get("channel") in watched
        and float(it.get("ts_float") or 0) >= horizon
        and t0 - float(it.get("last_thread_check_at") or 0) >= RECHECK_MIN_GAP_SECS
    ]
    due.sort(key=lambda it: float(it.get("last_thread_check_at") or 0))
    due = due[: int(settings.get("recheck_max_per_cycle") or 0)]
    answers = fetch_replies(client, [(it["channel"], it["ts"]) for it in due])

    for it, ans in zip(due, answers):
        msgs = ans["messages"]
        parent = msgs[0] if msgs and str(msgs[0].get("ts")) == it["ts"] else {}
        replies = msgs[1:] if parent else msgs

        def _recheck(led: dict[str, Any], key: str = it["key"], parent: dict = parent,
                     replies: list = replies, error: str = ans["error"]) -> tuple[bool, bool]:
            item = led["items"].get(key)
            if item is None:
                return False, False
            item["last_thread_check_at"] = t0
            changed = False
            if error in ("thread_not_found", "message_not_found"):
                reason = "parent message was deleted"
            elif error:
                return False, False
            else:
                latest = str(replies[-1].get("ts") or "") if replies else ""
                if latest and latest != item.get("latest_reply"):
                    changed = True
                    item["thread_changed"] = True
                reason = _resolution_signal(parent, replies, item.get("latest_reply") or "")
                item["reply_count"] = len(replies)
                item["latest_reply"] = latest or item.get("latest_reply", "")
                if parent:
                    item["reactions"] = sorted(
                        {str(r.get("name")) for r in parent.get("reactions") or [] if r.get("name")}
                    )
            flagged = False
            if reason and not item.get("possibly_resolved"):
                item["possibly_resolved"] = {"reason": reason, "at": t0}
                flagged = True
            if changed or flagged:
                item["updated_at"] = t0
            return changed, flagged

        changed, flagged = store.mutate(data_dir, _recheck)
        summary["thread_changed"] += int(changed)
        summary["possibly_resolved"] += int(flagged)

    def _finish(led: dict[str, Any]) -> None:
        led["last_poll_at"] = t0
        led["last_poll_error"] = "; ".join(f"{k}: {v}" for k, v in summary["errors"].items())
        led["source_state"] = SOURCE_OK
        led["source_error"] = ""

    store.mutate(data_dir, _finish)


# ── digest rendering + delivery ────────────────────────────────────────────

_PRIORITY_ORDER = {p: i for i, p in enumerate(store.PRIORITIES)}


def render_digest(ledger: dict[str, Any], headline: str, top_keys: list[str], limit: int = 10) -> str:
    """The digest text, built only from PUBLIC fields (see crew_ledger_spec.md).

    ``note``/``investigation``/raw ``text`` never appear: they are local-only fields.
    """
    items = ledger.get("items") or {}
    c = store.counts(ledger)
    open_items = [it for it in items.values() if it.get("status") in store.OPEN_STATUSES]
    picked = [items[k] for k in top_keys if k in items][:limit]
    if len(picked) < limit:
        rest = sorted(
            (it for it in open_items if it not in picked and it.get("priority")),
            key=lambda it: (_PRIORITY_ORDER.get(it.get("priority"), 9), -float(it.get("ts_float") or 0)),
        )
        picked += rest[: limit - len(picked)]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    lines = [f"*Slack Radar digest — {today}*"]
    if headline:
        lines.append(store.clip(headline, 400))
    by_cat = ", ".join(f"{k} {v}" for k, v in sorted(c["by_category"].items())) or "none yet"
    by_pri = ", ".join(f"{k} {v}" for k, v in sorted(c["open_by_priority"].items())) or "none"
    lines.append(f"Open: {len(open_items)} · awaiting triage: {c['needs_triage']} · "
                 f"possibly resolved: {c['possibly_resolved']}")
    lines.append(f"By category: {by_cat}")
    lines.append(f"Open by priority: {by_pri}")
    if picked:
        lines.append("")
        lines.append("*Top items*")
        for it in picked:
            summary = store.clip(it.get("summary") or "(no summary yet)", 200)
            tag = "/".join(x for x in (it.get("priority"), it.get("category")) if x) or "untriaged"
            link = it.get("permalink") or ""
            extra = f" · {it['links'][0]}" if it.get("links") else ""
            lines.append(f"• [{tag}] <{link}|{summary}>{extra}")
    return store.redact("\n".join(lines))[:3900]


def deliver_pending_digest(
    data_dir: Path,
    client: SlackMcpClient | None,
    settings: dict[str, Any],
    notify: Callable[[str, str], None] | None = None,
) -> str:
    """Deliver a crew-submitted digest. Returns "", "sent", "dashboard" or an error code.

    ``self_dm`` is the ONLY Slack write in the app and this is its only caller.
    """
    ledger = store.read_ledger(data_dir)
    pending = (ledger.get("digest") or {}).get("pending")
    if not pending:
        return ""
    text = render_digest(ledger, str(pending.get("headline") or ""), list(pending.get("top_keys") or []))
    dest = settings.get("digest_destination") or "dashboard"
    err, outcome = "", "dashboard"
    retryable = False
    if dest == "self_dm":
        login = str(settings.get("slack_login") or "")
        if client is None or not login:
            err = "self_dm needs a Slack MCP and slack_login"
        else:
            try:
                client.send_self_dm(login, text)
                outcome = "sent"
            except NeedsLogin:
                err, retryable = SOURCE_NEEDS_LOGIN, True
            except McpTransportError as exc:
                err, retryable = exc.code, True
            except SlackMcpError as exc:
                err = f"{exc.code}: {str(exc)[:120]}"
    if not err and notify is not None:
        try:
            notify("Slack Radar digest", text)
        except Exception:  # noqa: BLE001 - the ledger copy is the record
            logger.debug("slack-radar: dashboard notification failed", exc_info=True)

    def _done(led: dict[str, Any]) -> None:
        d = led["digest"]
        d["last_error"] = err
        if not retryable:
            d["pending"] = None
        if not err:
            d["last_text"] = text
            d["last_posted_at"] = time.time()
            d["last_posted_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            d["last_destination"] = dest

    store.mutate(data_dir, _done)
    store.append_event(data_dir, "digest", f"digest delivered ({dest})" if not err else f"digest delivery failed: {err}")
    return outcome if not err else err


# ── async layer: the loop ──────────────────────────────────────────────────

_task: asyncio.Task | None = None
_poll_lock = asyncio.Lock()
_ctx: Any = None


def _notify_dashboard(title: str, body: str) -> None:
    events = getattr(_ctx, "events", None)
    if events is not None:
        events.publish("notification", {"title": title, "body": body[:1500], "app": "slack-radar"})


async def poll_once(data_dir: Path, *, reason: str = "timer",
                    client_factory: Callable[[dict[str, Any]], SlackMcpClient] | None = None) -> dict[str, Any]:
    """One cycle end to end: poll, deliver digest, reconcile + wake the crew."""
    from . import crew_runtime, settings as settings_mod, slack_mcp

    async with _poll_lock:
        try:
            settings = await asyncio.to_thread(settings_mod.read_settings)
        except settings_mod.SettingsUnavailable as exc:
            logger.warning("slack-radar: vault unavailable, poll skipped (%s)", exc)
            return {"skipped": "vault unavailable"}
        factory = client_factory or (lambda s: slack_mcp.get_client(s["slack_mcp_command"]))
        client = factory(settings)
        if not settings.get("channels"):
            summary: dict[str, Any] = {"skipped": "no channels configured"}
        else:
            summary = await asyncio.to_thread(run_cycle, data_dir, client, settings)
        summary["digest"] = await asyncio.to_thread(
            deliver_pending_digest, data_dir, client, settings, _notify_dashboard
        )
        if summary.get("new") or summary.get("thread_changed") or summary.get("possibly_resolved"):
            store.append_event(
                data_dir, "poll",
                f"{summary.get('new', 0)} new, {summary.get('thread_changed', 0)} thread updates, "
                f"{summary.get('possibly_resolved', 0)} possibly resolved",
            )
        summary["woke"] = await crew_runtime.after_poll(data_dir, summary, reason=reason)
        return summary


async def _loop(data_dir: Path) -> None:
    from . import settings as settings_mod

    while True:
        interval = MIN_LOOP_SECS
        try:
            settings = await asyncio.to_thread(settings_mod.read_settings)
            interval = max(MIN_LOOP_SECS, int(settings.get("poll_interval_secs") or 300))
            await poll_once(data_dir)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001 - the loop must outlive one bad cycle
            logger.exception("slack-radar: poll cycle failed")
        await asyncio.sleep(interval)


def start(ctx: Any) -> None:
    global _task, _ctx
    _ctx = ctx
    if _task is not None and not _task.done():
        return
    _task = asyncio.get_running_loop().create_task(_loop(Path(ctx.data_dir)), name="slack-radar-poll")


async def stop() -> None:
    global _task
    task, _task = _task, None
    if task is not None:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):  # noqa: BLE001
            pass
    from . import slack_mcp

    await asyncio.to_thread(slack_mcp.shutdown)
