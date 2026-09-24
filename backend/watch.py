"""Slack Radar — the zero-LLM poll cycle and the in-gateway scheduler.

Deterministic Python, same role as issue-radar's ``watch.py``: it is the only
always-on loop in this app, it spends no credits, and it decides WHEN the crew gets
a turn. Per cycle:

1. For every configured channel, fetch messages newer than that channel's cursor
   (``conversations.history``), normalize them into ledger items, advance the
   cursor. The cursor is the app's own (``ledger.channels.<id>.cursor_ts``) and is
   independent of Slack's per-user read marker, so reading a channel in Slack never
   hides a message from the radar and vice versa.
2. Re-check a BOUNDED window of open items for thread activity
   (``conversations.replies``) and flag "possibly resolved" candidates. A flag is a
   question for the crew, never a verdict: no code path here sets ``resolved``.
3. Post a digest the crew has submitted (``chat.postMessage`` to the owner-set
   digest channel), rendered from the ledger's public fields.
4. Wake the crew when something moved — new items, thread changes, a flag, or a
   digest request — and re-derive its auto-approve grant (``crew_runtime``).

Why an in-gateway loop and not a manifest ``crons`` entry for polling: a manifest
cron runs either as an agent turn (an LLM call every five minutes for work that is
pure I/O) or as a sandboxed subprocess (``cron_script.run_script_sandboxed``), which
by design cannot read the keystone-floor vault holding the bot token. The daily
digest IS judgement work, so that one is a manifest cron (see ``app.json``).
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
from .slack_api import SlackApiError, SlackOps

logger = logging.getLogger("kirocrew.app.slack-radar")

MAX_PAGES_PER_CHANNEL = 5
PAGE_LIMIT = 200
#: An item's thread is not re-read more often than this.
RECHECK_MIN_GAP_SECS = 1800
#: Floor between loop iterations regardless of settings (a bad value must not spin).
MIN_LOOP_SECS = 60

_RESOLVED_WORDS = re.compile(
    r"\b(fixed|resolved|done|merged|shipped|deployed|released|closing|closed|answered|"
    r"works now|working now|thanks|thank you|ty|solved)\b",
    re.IGNORECASE,
)
_RESOLVED_REACTIONS = frozenset(
    {"white_check_mark", "heavy_check_mark", "ballot_box_with_check", "done", "resolved", "merged"}
)


def _fmt_ts(t: float) -> str:
    return f"{t:.6f}"


# ── cycle (sync, testable with a fake client) ──────────────────────────────


def _fetch_channel(client: SlackOps, channel: str, oldest: str) -> tuple[list[dict[str, Any]], bool]:
    """All messages newer than ``oldest``, bounded; returns (messages, truncated)."""
    msgs: list[dict[str, Any]] = []
    cursor = ""
    for _ in range(MAX_PAGES_PER_CHANNEL):
        page = client.history(channel, oldest=oldest, cursor=cursor, limit=PAGE_LIMIT)
        msgs.extend(m for m in page.get("messages") or [] if isinstance(m, dict))
        cursor = str(((page.get("response_metadata") or {}).get("next_cursor")) or "")
        if not page.get("has_more") or not cursor:
            return msgs, False
    return msgs, True


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


def run_cycle(
    data_dir: Path, client: SlackOps, settings: dict[str, Any], *, clock: Callable[[], float] = time.time
) -> dict[str, Any]:
    """One full poll cycle. Blocking. Returns a summary the async layer acts on."""
    summary: dict[str, Any] = {"new": 0, "thread_changed": 0, "possibly_resolved": 0, "errors": {}}
    t0 = clock()
    ledger = store.read_ledger(data_dir)

    if not ledger.get("workspace_url"):
        try:
            info = client.auth_test()
        except SlackApiError as exc:
            summary["errors"]["auth.test"] = exc.code

            def _auth_err(led: dict[str, Any]) -> None:
                led["last_poll_at"] = t0
                led["last_poll_error"] = f"auth.test: {exc.code}"

            store.mutate(data_dir, _auth_err)
            return summary

        def _auth(led: dict[str, Any]) -> None:
            led["workspace_url"] = str(info.get("url") or "")
            led["bot_user_id"] = str(info.get("user_id") or "")

        store.mutate(data_dir, _auth)
        ledger = store.read_ledger(data_dir)

    workspace_url = ledger.get("workspace_url") or ""
    bot_user = ledger.get("bot_user_id") or ""
    backfill = float(settings.get("backfill_hours") or 0) * 3600
    rate_limited = False

    # 1. new messages per channel
    for channel in settings.get("channels") or []:
        if rate_limited:
            break
        state = (ledger.get("channels") or {}).get(channel) or {}
        if float(state.get("backoff_until") or 0) > t0:
            continue
        oldest = str(state.get("cursor_ts") or "") or _fmt_ts(t0 - backfill)
        try:
            msgs, truncated = _fetch_channel(client, channel, oldest)
            error, retry = "", 0.0
        except SlackApiError as exc:
            msgs, truncated, error, retry = [], False, exc.code, exc.retry_after
            summary["errors"][channel] = exc.code
            rate_limited = exc.code == "ratelimited"

        def _apply(led: dict[str, Any], channel: str = channel, msgs: list = msgs,
                   truncated: bool = truncated, error: str = error, retry: float = retry,
                   oldest: str = oldest) -> int:
            ch = led["channels"].setdefault(channel, {})
            ch["last_polled_at"] = t0
            ch["last_error"] = error
            ch["backoff_until"] = t0 + retry if retry else 0.0
            if error:
                return 0
            added = 0
            max_ts = str(ch.get("cursor_ts") or oldest)
            for m in sorted(msgs, key=lambda m: float(m.get("ts") or 0)):
                ts = str(m.get("ts") or "")
                if ts and float(ts) > float(max_ts or 0):
                    max_ts = ts
                item = store.normalize_message(channel, m, workspace_url, bot_user)
                if item is None:
                    continue
                if item["key"] in led["items"]:
                    continue
                led["items"][item["key"]] = item
                added += 1
            ch["cursor_ts"] = max_ts
            ch["truncated_at"] = t0 if truncated else ch.get("truncated_at", 0.0)
            return added

        added = store.mutate(data_dir, _apply)
        summary["new"] += added
        if truncated:
            store.append_event(
                data_dir, "backlog", f"{channel}: more than {MAX_PAGES_PER_CHANNEL * PAGE_LIMIT} "
                "new messages in one cycle; older ones in that burst were skipped"
            )

    # 2. bounded thread re-check of open items
    ledger = store.read_ledger(data_dir)
    horizon = t0 - float(settings.get("recheck_days") or 7) * 86400
    watched = set(settings.get("channels") or [])
    due = [
        it
        for it in (ledger.get("items") or {}).values()
        if it.get("status") in store.OPEN_STATUSES
        and it.get("channel") in watched
        and float(it.get("ts_float") or 0) >= horizon
        and t0 - float(it.get("last_thread_check_at") or 0) >= RECHECK_MIN_GAP_SECS
    ]
    due.sort(key=lambda it: float(it.get("last_thread_check_at") or 0))
    for it in due[: int(settings.get("recheck_max_per_cycle") or 0)]:
        if rate_limited:
            break
        try:
            page = client.replies(it["channel"], it["ts"], limit=100)
            msgs = [m for m in page.get("messages") or [] if isinstance(m, dict)]
            error = ""
        except SlackApiError as exc:
            msgs, error = [], exc.code
            rate_limited = exc.code == "ratelimited"
            if rate_limited:
                break
        parent = msgs[0] if msgs else {}
        replies = msgs[1:]

        def _recheck(led: dict[str, Any], key: str = it["key"], parent: dict = parent,
                     replies: list = replies, error: str = error) -> tuple[bool, bool]:
            item = led["items"].get(key)
            if item is None:
                return False, False
            item["last_thread_check_at"] = t0
            changed = flagged = False
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
                item["reactions"] = sorted(
                    {str(r.get("name")) for r in parent.get("reactions") or [] if r.get("name")}
                )
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

    store.mutate(data_dir, _finish)
    return summary


# ── digest rendering + posting ─────────────────────────────────────────────

_PRIORITY_ORDER = {p: i for i, p in enumerate(store.PRIORITIES)}


def render_digest(ledger: dict[str, Any], headline: str, top_keys: list[str], limit: int = 10) -> str:
    """The digest text, built only from PUBLIC fields (see crew_ledger_spec.md).

    ``note``/``investigation``/raw ``text`` never appear: they are local-only fields
    and may hold another channel's content or investigation detail.
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


def post_pending_digest(data_dir: Path, client: SlackOps, settings: dict[str, Any]) -> str:
    """Post a crew-submitted digest if one is pending. Returns "posted", "" or an error."""
    ledger = store.read_ledger(data_dir)
    pending = (ledger.get("digest") or {}).get("pending")
    if not pending:
        return ""
    channel = settings.get("digest_channel") or ""
    if not channel:
        def _no_dest(led: dict[str, Any]) -> None:
            led["digest"]["pending"] = None
            led["digest"]["last_posted_at"] = time.time()
            led["digest"]["last_posted_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            led["digest"]["last_error"] = "no digest channel configured; Slack post skipped"

        store.mutate(data_dir, _no_dest)
        return "skipped"
    text = render_digest(ledger, str(pending.get("headline") or ""), list(pending.get("top_keys") or []))
    try:
        client.post_message(channel, text)
        err = ""
    except SlackApiError as exc:
        err = exc.code

    def _done(led: dict[str, Any]) -> None:
        d = led["digest"]
        d["last_error"] = err
        retryable = err == "ratelimited" or err.startswith(("transport", "http_5"))
        if not retryable:
            d["pending"] = None  # success, or a permanent error (not_in_channel…) that must not retry forever
        if not err:
            d["last_posted_at"] = time.time()
            d["last_posted_date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    store.mutate(data_dir, _done)
    store.append_event(data_dir, "digest", "digest posted" if not err else f"digest post failed: {err}")
    return "posted" if not err else err


# ── async layer: the loop ──────────────────────────────────────────────────

_task: asyncio.Task | None = None
_poll_lock = asyncio.Lock()
_ctx: Any = None


def _default_client_factory() -> SlackOps | None:
    from . import secrets
    from .slack_api import SlackWebClient

    token = secrets.get_token()
    return SlackWebClient(token) if token else None


async def poll_once(data_dir: Path, *, reason: str = "timer",
                    client_factory: Callable[[], SlackOps | None] | None = None) -> dict[str, Any]:
    """One cycle end to end: poll, post digest, reconcile + wake the crew."""
    from . import crew_runtime, secrets

    async with _poll_lock:
        try:
            settings = await asyncio.to_thread(secrets.read_settings)
            client = await asyncio.to_thread(client_factory or _default_client_factory)
        except secrets.SecretStoreUnavailable as exc:
            logger.warning("slack-radar: vault unavailable, poll skipped (%s)", exc)
            return {"skipped": "vault unavailable"}
        if client is None:
            return {"skipped": "no bot token configured"}
        if not settings.get("channels"):
            summary: dict[str, Any] = {"skipped": "no channels configured"}
        else:
            summary = await asyncio.to_thread(run_cycle, data_dir, client, settings)
        summary["digest"] = await asyncio.to_thread(post_pending_digest, data_dir, client, settings)
        if summary.get("new") or summary.get("thread_changed") or summary.get("possibly_resolved"):
            store.append_event(
                data_dir, "poll",
                f"{summary.get('new', 0)} new, {summary.get('thread_changed', 0)} thread updates, "
                f"{summary.get('possibly_resolved', 0)} possibly resolved",
            )
        summary["woke"] = await crew_runtime.after_poll(data_dir, summary, reason=reason)
        return summary


async def _loop(data_dir: Path) -> None:
    from . import secrets

    while True:
        interval = MIN_LOOP_SECS
        try:
            settings = await asyncio.to_thread(secrets.read_settings)
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
