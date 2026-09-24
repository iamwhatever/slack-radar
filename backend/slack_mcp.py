"""Minimal stdio MCP client for the user's own Slack MCP server (default ``ai-community-slack-mcp``).

Slack Radar reads Slack with the USER's identity through their already-installed Slack
MCP server instead of a bot token: a bot has to be invited into every channel and is
visible to everyone there, while the MCP already reads what the user can read.

Zero LLM: the gateway spawns the server as a subprocess and speaks JSON-RPC 2.0, one
message per line, exactly as an MCP host would (``initialize`` →
``notifications/initialized`` → ``tools/call``).

Least privilege is enforced HERE, before anything reaches the process:

* :meth:`SlackMcpClient.call` accepts only :data:`READ_TOOLS`. Any other name raises
  :class:`ToolNotAllowed` without writing a byte to the subprocess.
* The ONE write is :meth:`SlackMcpClient.send_self_dm` (``self_dm``: a DM from the user to
  the user). It is a separate method, used only by the daily-digest path in ``watch.py``,
  and the tool name is a literal inside it rather than a parameter. ``post_message``,
  ``create_draft``, ``reaction_tool`` and every other write tool are unreachable.

Blocking by design; callers run it in ``asyncio.to_thread``. One lock serializes calls.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import threading
import time
from typing import Any

PROTOCOL_VERSION = "2024-11-05"
DEFAULT_COMMAND = "ai-community-slack-mcp"
CALL_TIMEOUT_SECS = 60.0
INIT_TIMEOUT_SECS = 30.0

#: The only tools :meth:`SlackMcpClient.call` will send. All read-only.
READ_TOOLS: frozenset[str] = frozenset(
    {
        "list_channels",
        "batch_get_conversation_history",
        "batch_get_thread_replies",
        "batch_get_channel_info",
        "batch_get_user_info",
    }
)
#: The single write, reachable only through :meth:`SlackMcpClient.send_self_dm`.
SELF_DM_TOOL = "self_dm"

#: Env vars never handed to the Slack MCP subprocess: gateway-internal credentials it has
#: no use for. The MCP authenticates with the user's own browser/Midway session.
_CHILD_ENV_DENY = frozenset({"KIROCREW_INTERNAL_SECRET", "KIROCREW_OWNER_ID"})

#: Error text that means "the MCP's login expired", as opposed to "no messages" or a
#: per-channel problem. Matched case-insensitively against a tool's error text.
_AUTH_ERROR_RE = re.compile(
    r"invalid_auth|not_authed|token_expired|token_revoked|account_inactive|"
    r"unauthori[sz]ed|\b401\b|\b403\b|midway|mwinit|re-?auth|log ?in again|"
    r"login (?:required|expired)|session (?:expired|invalid)|cookie|authenticat",
    re.IGNORECASE,
)

_COMMAND_RE = re.compile(r"^[A-Za-z0-9._/~+-]{1,256}$")


class SlackMcpError(Exception):
    """Base failure. ``code`` is a stable machine-readable reason."""

    code = "error"

    def __init__(self, message: str = "") -> None:
        super().__init__(message or self.code)


class BinaryNotFound(SlackMcpError):
    code = "binary_not_found"


class NeedsLogin(SlackMcpError):
    code = "needs_login"


class ToolNotAllowed(SlackMcpError):
    code = "tool_not_allowed"


class McpTransportError(SlackMcpError):
    code = "transport"


class ToolError(SlackMcpError):
    """The tool ran and reported an error that is NOT an auth failure."""

    code = "tool_error"


def is_auth_error(text: str) -> bool:
    return bool(_AUTH_ERROR_RE.search(text or ""))


def validate_command(command: str) -> str | None:
    """An error message for an unusable ``slack_mcp_command``, or None.

    A single executable (bare name on PATH, or a path) with no arguments and no shell
    syntax. It is spawned directly (no shell), but it is still an execution selector,
    which is why settings live on the keystone vault rather than agent-writable data.
    """
    if not isinstance(command, str) or not _COMMAND_RE.match(command):
        return "slack_mcp_command must be a single executable name or path (no spaces or arguments)"
    return None


def resolve_command(command: str) -> str:
    err = validate_command(command)
    if err:
        raise BinaryNotFound(err)
    path = shutil.which(os.path.expanduser(command))
    if not path:
        raise BinaryNotFound(f"{command!r} was not found on PATH")
    return path


def _child_env() -> dict[str, str]:
    return {k: v for k, v in os.environ.items() if k not in _CHILD_ENV_DENY}


def parse_tool_text(result: dict[str, Any]) -> Any:
    """The JSON payload of a ``tools/call`` result, or raise on ``isError``.

    The Slack MCP returns one text block holding JSON. An ``isError`` result, or a
    payload whose top level carries ``ok: false`` / ``error``, is classified: auth
    failures become :class:`NeedsLogin`, anything else :class:`ToolError`.
    """
    blocks = result.get("content") or []
    text = "".join(b.get("text", "") for b in blocks if isinstance(b, dict) and b.get("type") == "text")
    if result.get("isError"):
        raise (NeedsLogin if is_auth_error(text) else ToolError)(text[:300])
    try:
        payload = json.loads(text) if text else None
    except json.JSONDecodeError:
        # Non-JSON text from a read tool is an error message, never "no data".
        raise (NeedsLogin if is_auth_error(text) else ToolError)(text[:300]) from None
    if isinstance(payload, dict) and payload.get("ok") is False:
        err = str(payload.get("error") or "")
        raise (NeedsLogin if is_auth_error(err) else ToolError)(err[:300])
    return payload


class SlackMcpClient:
    """One long-lived Slack MCP subprocess, respawned transparently after a crash."""

    def __init__(self, command: str = DEFAULT_COMMAND, *, timeout: float = CALL_TIMEOUT_SECS) -> None:
        self._command = command
        self._timeout = timeout
        self._proc: subprocess.Popen[str] | None = None
        self._next_id = 0
        self._lock = threading.Lock()
        self._tools: list[str] = []

    @property
    def command(self) -> str:
        return self._command

    # ── process lifecycle ──────────────────────────────────────────────

    def _alive(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def _spawn(self) -> None:
        path = resolve_command(self._command)
        self._proc = subprocess.Popen(  # noqa: S603 - fixed argv, no shell
            [path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            env=_child_env(),
        )
        init = self._rpc(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "slack-radar", "version": "0.2.0"},
            },
            timeout=INIT_TIMEOUT_SECS,
        )
        if "error" in init:
            self.close()
            raise McpTransportError(f"initialize failed: {init['error']}")
        self._notify("notifications/initialized")

    def _ensure(self) -> None:
        if not self._alive():
            self.close()
            self._spawn()

    def close(self) -> None:
        proc, self._proc = self._proc, None
        if proc is None:
            return
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:  # noqa: BLE001
            try:
                proc.kill()
            except Exception:  # noqa: BLE001
                pass

    # ── JSON-RPC framing ───────────────────────────────────────────────

    def _write(self, msg: dict[str, Any]) -> None:
        assert self._proc is not None and self._proc.stdin is not None
        self._proc.stdin.write(json.dumps(msg) + "\n")
        self._proc.stdin.flush()

    def _notify(self, method: str) -> None:
        self._write({"jsonrpc": "2.0", "method": method})

    def _rpc(self, method: str, params: dict[str, Any], *, timeout: float | None = None) -> dict[str, Any]:
        """Send one request; read lines until the matching id or the deadline."""
        self._next_id += 1
        mid = self._next_id
        try:
            self._write({"jsonrpc": "2.0", "id": mid, "method": method, "params": params})
        except (BrokenPipeError, OSError) as exc:
            self.close()
            raise McpTransportError(f"write failed: {type(exc).__name__}") from None
        deadline = time.monotonic() + (timeout or self._timeout)
        box: dict[str, Any] = {}

        def _reader() -> None:
            assert self._proc is not None and self._proc.stdout is not None
            for line in self._proc.stdout:
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                except json.JSONDecodeError:
                    continue  # stray log line on stdout
                if isinstance(msg, dict) and msg.get("id") == mid:
                    box["reply"] = msg
                    return
            box["eof"] = True

        t = threading.Thread(target=_reader, daemon=True, name="slack-radar-mcp-read")
        t.start()
        t.join(max(0.0, deadline - time.monotonic()))
        if "reply" in box:
            return box["reply"]
        # Timeout or EOF: the stream position is now unknown, so the process is discarded
        # and the next call respawns it.
        self.close()
        raise McpTransportError("server exited" if box.get("eof") else f"{method} timed out")

    def _call_tool(self, name: str, args: dict[str, Any]) -> Any:
        with self._lock:
            for attempt in (1, 2):
                self._ensure()
                try:
                    reply = self._rpc("tools/call", {"name": name, "arguments": args})
                    break
                except McpTransportError:
                    if attempt == 2:
                        raise
            if "error" in reply:
                err = json.dumps(reply["error"])[:300]
                raise (NeedsLogin if is_auth_error(err) else ToolError)(err)
            return parse_tool_text(reply.get("result") or {})

    # ── public surface ─────────────────────────────────────────────────

    def call(self, name: str, args: dict[str, Any]) -> Any:
        """Call a READ-ONLY tool. Anything outside :data:`READ_TOOLS` raises first."""
        if name not in READ_TOOLS:
            raise ToolNotAllowed(f"slack-radar never calls {name!r}")
        return self._call_tool(name, args)

    def send_self_dm(self, login: str, text: str) -> Any:
        """The digest's only Slack write: a DM from the user to themselves."""
        return self._call_tool(SELF_DM_TOOL, {"login": login, "text": text})

    def probe(self) -> dict[str, Any]:
        """initialize + tools/list only. Never calls a tool."""
        with self._lock:
            self._ensure()
            reply = self._rpc("tools/list", {})
        tools = [t.get("name") for t in (reply.get("result") or {}).get("tools") or [] if isinstance(t, dict)]
        self._tools = [t for t in tools if isinstance(t, str)]
        missing = sorted(READ_TOOLS - set(self._tools))
        return {"tools": len(self._tools), "missing_read_tools": missing, "has_self_dm": SELF_DM_TOOL in self._tools}


# ── process-wide client (the gateway keeps one subprocess) ─────────────────

_client: SlackMcpClient | None = None
_client_lock = threading.Lock()


def get_client(command: str) -> SlackMcpClient:
    """The shared client for ``command``; a changed command replaces the process."""
    global _client
    with _client_lock:
        if _client is None or _client.command != command:
            if _client is not None:
                _client.close()
            _client = SlackMcpClient(command)
        return _client


def shutdown() -> None:
    global _client
    with _client_lock:
        if _client is not None:
            _client.close()
        _client = None
