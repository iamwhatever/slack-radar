"""Slack Radar — bot token and authority-bearing settings, kept on the keystone floor.

WHY NOT A NEW ``_CREW_SECRET_LEAVES`` ENTRY (the ops-mission-control pattern)?
Ops Mission Control is a builtin: it adds ``ops_mission_control_secrets.json`` to
``kiro_crew/security/paths.py``. A third-party app cannot edit that list, so a
``slack_radar_secrets.json`` in the crew home would sit OFF the floor — readable by
every agent's file tools. The equivalent placement available to an installed app is
the gateway's encrypted vault (``kiro_crew.secrets.SecretVault``): its whole
``.vault`` directory is already a ``_CREW_SECRET_LEAVES`` entry, so agent file tools
and shell forms can neither read nor write it, and each entry is AES-256-GCM with
the entry name as AAD. Same guarantee, reached through an existing leaf.

WHAT LIVES HERE (and why each one):

* ``slack-radar.bot-token`` — the ``xoxb-`` bot token. A live bearer credential for
  the workspace; never returned by any route (write-only, like ops).
* ``slack-radar.settings`` — the watched channel list and the digest destination.
  These are AUTHORITY, not preferences: the channel list decides what the bot
  READS into an agent-readable ledger, and the digest channel decides where the bot
  POSTS text an agent composed. In ``data/config.json`` (served over
  ``/api/apps/<name>/config`` without session auth, and writable by any
  auto-approved agent shell) a prompt-injected crew could point the bot at a
  private channel or redirect the digest anywhere the bot is a member. So they are
  stored beside the token and written only by the owner-gated settings route.

The only writer is ``routes.py``; the only readers are ``routes.py`` (settings, and
the token's *presence*) and ``watch.py`` (the token, in-gateway, to call Slack).
The stdio MCP server the crew uses never imports this module.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("kirocrew.app.slack-radar")

TOKEN_NAME = "slack-radar.bot-token"
SETTINGS_NAME = "slack-radar.settings"
REDACTED_PLACEHOLDER = "••••••••"
MAX_CHANNELS = 50
MAX_TOKEN_LEN = 512

DEFAULT_SETTINGS: dict[str, Any] = {
    "channels": [],
    "digest_channel": "",
    "digest_send_message": True,
    "poll_interval_secs": 300,
    "backfill_hours": 24,
    "recheck_days": 7,
    "recheck_max_per_cycle": 20,
}

_BOUNDS = {
    "poll_interval_secs": (60, 3600),
    "backfill_hours": (0, 168),
    "recheck_days": (1, 30),
    "recheck_max_per_cycle": (0, 50),
}


class SecretStoreUnavailable(RuntimeError):
    """The gateway vault cannot be imported or read. Callers fail CLOSED."""


def _vault() -> Any:
    try:
        from kiro_crew.config.loader import config_dir
        from kiro_crew.secrets import SecretVault
    except ImportError as exc:  # pragma: no cover - only outside a gateway
        raise SecretStoreUnavailable("kiro_crew vault is not importable") from exc
    return SecretVault(config_dir())


# ── token ──────────────────────────────────────────────────────────────────


def get_token() -> str:
    """The bot token, or "" when unset. Never log, echo or return this over HTTP."""
    value = _vault().get(TOKEN_NAME)
    return value.reveal() if value is not None else ""


def has_token() -> bool:
    try:
        return TOKEN_NAME in set(_vault().list_names())
    except Exception:  # noqa: BLE001 - presence probe must not 500 a status route
        logger.warning("slack-radar: vault unreadable; token reads as unset")  # nosemgrep
        return False


def put_token(value: str) -> None:
    _vault().set_sync(TOKEN_NAME, value)
    _audit("secret_put", "field=bot_token")


def delete_token() -> None:
    _vault().delete_sync(TOKEN_NAME)
    _audit("secret_delete", "field=bot_token")


def describe_token() -> dict[str, str]:
    """Write-only view: whether the token is SET, never what it is."""
    return {"bot_token": REDACTED_PLACEHOLDER if has_token() else ""}


# ── settings ───────────────────────────────────────────────────────────────


def _coerce_int(value: Any, key: str) -> int:
    lo, hi = _BOUNDS[key]
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = int(DEFAULT_SETTINGS[key])
    return max(lo, min(hi, n))


def validate_settings(patch: dict[str, Any], current: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """Merge ``patch`` over ``current``; return (settings, errors). Errors refuse the write."""
    from .store import is_channel_id

    out = dict(current)
    errors: list[str] = []
    if "channels" in patch:
        raw = patch["channels"]
        if not isinstance(raw, list):
            errors.append("channels must be a list of Slack channel IDs")
        else:
            seen: list[str] = []
            for cid in raw:
                cid = str(cid).strip().upper()
                if not is_channel_id(cid):
                    errors.append(f"not a Slack channel ID: {cid[:24]!r} (expected e.g. C0123ABCD)")
                elif cid not in seen:
                    seen.append(cid)
            if len(seen) > MAX_CHANNELS:
                errors.append(f"at most {MAX_CHANNELS} channels")
            out["channels"] = seen[:MAX_CHANNELS]
    if "digest_channel" in patch:
        cid = str(patch["digest_channel"] or "").strip().upper()
        if cid and not is_channel_id(cid):
            errors.append("digest_channel must be a Slack channel ID or empty")
        out["digest_channel"] = cid
    if "digest_send_message" in patch:
        out["digest_send_message"] = patch["digest_send_message"] is True
    for key in _BOUNDS:
        if key in patch:
            out[key] = _coerce_int(patch[key], key)
    return out, errors


def read_settings() -> dict[str, Any]:
    """Current settings; defaults when unset. Raises SecretStoreUnavailable if unreadable."""
    try:
        value = _vault().get(SETTINGS_NAME)
    except SecretStoreUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - a corrupt vault must not read as "no channels"
        raise SecretStoreUnavailable("vault entry unreadable") from exc
    base = dict(DEFAULT_SETTINGS)
    if value is None:
        return base
    try:
        raw = json.loads(value.reveal())
    except json.JSONDecodeError:
        logger.warning("slack-radar: settings entry is not JSON; using defaults")
        return base
    if isinstance(raw, dict):
        merged, _ = validate_settings(raw, base)
        return merged
    return base


def write_settings(settings: dict[str, Any]) -> None:
    _vault().set_sync(SETTINGS_NAME, json.dumps(settings, sort_keys=True))
    _audit("settings_put", f"channels={len(settings.get('channels') or [])}")


def _audit(operation: str, resources: str) -> None:
    try:
        from kiro_crew.sel import sel

        sel().log_api_access(
            caller="app:slack-radar",
            operation=operation,
            outcome="success",
            resources=resources,
        )
    except Exception:  # noqa: BLE001 - audit is best-effort outside a gateway
        logger.debug("slack-radar: SEL audit unavailable", exc_info=True)
