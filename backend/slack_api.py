"""Minimal Slack Web API client (stdlib only, bot-token auth).

Why not ``kiro_crew.slack.client``: that module wraps ``slack_sdk`` for the gateway's
own Slack CHANNEL (Socket Mode, the operator's messaging connection) and is not a
published app API. Slack Radar needs five read-mostly Web API methods with a
separate bot token the user installs for this app, so a 100-line urllib client keeps
the app free of a private-core dependency and of ``slack_sdk`` being installed.

Blocking by design — callers run it in ``asyncio.to_thread``.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Protocol

API_BASE = "https://slack.com/api/"
TIMEOUT_SECS = 20


class SlackApiError(Exception):
    """Slack answered ``ok: false`` (``code`` is Slack's error string) or HTTP failed."""

    def __init__(self, code: str, retry_after: float = 0.0) -> None:
        super().__init__(code)
        self.code = code
        self.retry_after = retry_after


class SlackOps(Protocol):
    """The surface ``watch.py`` uses. Tests substitute a fake."""

    def auth_test(self) -> dict[str, Any]: ...

    def history(self, channel: str, oldest: str, cursor: str = "", limit: int = 200) -> dict[str, Any]: ...

    def replies(self, channel: str, ts: str, limit: int = 50) -> dict[str, Any]: ...

    def post_message(self, channel: str, text: str) -> dict[str, Any]: ...


class SlackWebClient:
    def __init__(self, token: str) -> None:
        if not token:
            raise SlackApiError("not_authed")
        self._token = token

    def __repr__(self) -> str:  # never render the token
        return "SlackWebClient(****)"

    def _call(self, method: str, params: dict[str, Any], *, post: bool = False) -> dict[str, Any]:
        clean = {k: v for k, v in params.items() if v not in (None, "")}
        headers = {"Authorization": f"Bearer {self._token}"}
        url = API_BASE + method
        data = None
        if post:
            data = json.dumps(clean).encode("utf-8")
            headers["Content-Type"] = "application/json; charset=utf-8"
        else:
            url += "?" + urllib.parse.urlencode(clean)
        req = urllib.request.Request(url, data=data, headers=headers, method="POST" if post else "GET")
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT_SECS) as resp:  # noqa: S310 - fixed https host
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                raise SlackApiError("ratelimited", float(exc.headers.get("Retry-After") or 30)) from None
            raise SlackApiError(f"http_{exc.code}") from None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise SlackApiError(f"transport: {type(exc).__name__}") from None
        if not isinstance(body, dict) or not body.get("ok"):
            raise SlackApiError(str((body or {}).get("error") or "unknown_error"))
        return body

    def auth_test(self) -> dict[str, Any]:
        return self._call("auth.test", {})

    def history(self, channel: str, oldest: str, cursor: str = "", limit: int = 200) -> dict[str, Any]:
        return self._call(
            "conversations.history",
            {"channel": channel, "oldest": oldest, "cursor": cursor, "limit": limit, "inclusive": "false"},
        )

    def replies(self, channel: str, ts: str, limit: int = 50) -> dict[str, Any]:
        return self._call("conversations.replies", {"channel": channel, "ts": ts, "limit": limit})

    def post_message(self, channel: str, text: str) -> dict[str, Any]:
        return self._call(
            "chat.postMessage",
            {"channel": channel, "text": text, "unfurl_links": False, "unfurl_media": False},
            post=True,
        )


def sleep_for_rate_limit(err: SlackApiError, cap: float = 60.0) -> None:
    time.sleep(min(cap, max(1.0, err.retry_after)))
