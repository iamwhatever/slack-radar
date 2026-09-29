"""Slack Radar lifecycle hooks (``backend.hooks.on_startup`` / ``on_shutdown``)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from . import crew_runtime, watch

logger = logging.getLogger("kirocrew.app.slack-radar")


async def on_startup(ctx: Any) -> None:
    """Start the poll loop. Returns immediately; the loop runs as a gateway task."""
    # The fallback state handle for a gateway with no Slack bot (see _gateway_state).
    crew_runtime.bind_http_app(getattr(ctx, "http_app", None))
    # The Thread Watcher is dispatched through the app spawn SDK after each poll.
    crew_runtime.bind_spawn(getattr(ctx, "spawn", None))
    # A crew session left over from before an app update still runs the old ledger
    # tool; replace it now rather than on the first poll.
    await crew_runtime.check_tool_version_on_startup(Path(ctx.data_dir))
    watch.start(ctx)
    logger.info("slack-radar: poll loop started (data dir %s)", ctx.data_dir)


async def on_shutdown(ctx: Any) -> None:
    """Stop the loop and revoke the crew's grant, so a disabled app cannot keep auto-approving."""
    await watch.stop()
    try:
        crew_runtime.revoke(crew_runtime._gateway_state())
    except Exception:  # noqa: BLE001 - teardown must complete
        logger.warning("slack-radar: grant revocation on shutdown failed", exc_info=True)
    crew_runtime.unbind_http_app()  # never pin the gateway's Application past its life
    crew_runtime.unbind_spawn()
