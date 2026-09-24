"""Slack Radar settings, kept in the gateway's encrypted vault (keystone floor).

There is no credential any more — Slack is read through the user's own Slack MCP — but
the settings still carry AUTHORITY, which is why they are not in ``data/config.json``
(served over ``/api/apps/<name>/config`` without session auth, and writable by any
auto-approved agent shell):

* ``slack_mcp_command`` is an EXECUTION selector: the gateway spawns it.
* ``channels`` decides what the user's identity reads into an agent-readable ledger.
* ``digest_destination`` + ``slack_login`` decide whether, and to whom, a DM is sent.

The vault's ``.vault`` directory is already a ``security._CREW_SECRET_LEAVES`` entry, so
agent file tools and shell forms can neither read nor write it. The only writer is the
owner-gated ``PUT /settings`` route; the only readers are the gateway-side modules.
"""

from __future__ import annotations

import getpass
import json
import logging
import re
from typing import Any

from .slack_mcp import DEFAULT_COMMAND, validate_command

logger = logging.getLogger("kirocrew.app.slack-radar")

SETTINGS_NAME = "slack-radar.settings"
MAX_CHANNELS = 50
DIGEST_DESTINATIONS = ("self_dm", "dashboard")
_LOGIN_RE = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
#: Used only to build message permalinks (the MCP exposes no auth.test). A Slack host only.
_WORKSPACE_RE = re.compile(r"^https://[a-z0-9-]{1,63}(?:\.enterprise)?\.slack\.com$")


def _default_login() -> str:
    try:
        login = getpass.getuser()
    except Exception:  # noqa: BLE001
        return ""
    return login if _LOGIN_RE.match(login or "") else ""


DEFAULT_SETTINGS: dict[str, Any] = {
    "channels": [],
    "digest_destination": "dashboard",
    "slack_login": "",
    "slack_mcp_command": DEFAULT_COMMAND,
    "workspace_url": "",
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


class SettingsUnavailable(RuntimeError):
    """The gateway vault cannot be imported or read. Callers fail CLOSED."""


def _vault() -> Any:
    try:
        from kiro_crew.config.loader import config_dir
        from kiro_crew.secrets import SecretVault
    except ImportError as exc:  # pragma: no cover - only outside a gateway
        raise SettingsUnavailable("kiro_crew vault is not importable") from exc
    return SecretVault(config_dir())


def defaults() -> dict[str, Any]:
    out = dict(DEFAULT_SETTINGS)
    out["slack_login"] = _default_login()
    return out


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
    if "digest_destination" in patch:
        dest = patch["digest_destination"]
        if dest in DIGEST_DESTINATIONS:
            out["digest_destination"] = dest
        else:
            errors.append("digest_destination must be self_dm or dashboard")
    if "slack_login" in patch:
        login = str(patch["slack_login"] or "").strip().lower()
        if login and not _LOGIN_RE.match(login):
            errors.append("slack_login must be a login like 'jdoe'")
        out["slack_login"] = login
    if "slack_mcp_command" in patch:
        cmd = str(patch["slack_mcp_command"] or "").strip() or DEFAULT_COMMAND
        err = validate_command(cmd)
        if err:
            errors.append(err)
        else:
            out["slack_mcp_command"] = cmd
    if "workspace_url" in patch:
        url = str(patch["workspace_url"] or "").strip().rstrip("/").lower()
        if url and not _WORKSPACE_RE.match(url):
            errors.append("workspace_url must look like https://yourteam.slack.com")
        else:
            out["workspace_url"] = url
    for key in _BOUNDS:
        if key in patch:
            out[key] = _coerce_int(patch[key], key)
    if out.get("digest_destination") == "self_dm" and not out.get("slack_login"):
        errors.append("a self-DM digest needs slack_login")
    return out, errors


def read_settings() -> dict[str, Any]:
    """Current settings; defaults when unset. Raises SettingsUnavailable if unreadable."""
    try:
        value = _vault().get(SETTINGS_NAME)
    except SettingsUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - a corrupt vault must not read as "no channels"
        raise SettingsUnavailable("vault entry unreadable") from exc
    base = defaults()
    if value is None:
        return base
    try:
        raw = json.loads(value.reveal())
    except json.JSONDecodeError:
        logger.warning("slack-radar: settings entry is not JSON; using defaults")
        return base
    if not isinstance(raw, dict):
        return base
    known = {k: v for k, v in raw.items() if k in DEFAULT_SETTINGS}
    merged, errors = validate_settings(known, base)
    if errors:
        logger.warning("slack-radar: stored settings partly invalid: %s", "; ".join(errors))
    return merged


def write_settings(settings: dict[str, Any]) -> None:
    clean = {k: settings[k] for k in DEFAULT_SETTINGS if k in settings}
    _vault().set_sync(SETTINGS_NAME, json.dumps(clean, sort_keys=True))
    _audit("settings_put", f"channels={len(clean.get('channels') or [])}")


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
