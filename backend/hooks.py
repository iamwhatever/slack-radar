"""Slack Radar lifecycle hooks (``backend.hooks.on_startup`` / ``on_shutdown``)."""

from __future__ import annotations

import logging
from typing import Any

from . import crew_runtime, watch

logger = logging.getLogger("kirocrew.app.slack-radar")


async def on_startup(ctx: Any) -> None:
    """Start the poll loop. Returns immediately; the loop runs as a gateway task."""
    watch.start(ctx)
    logger.info("slack-radar: poll loop started (data dir %s)", ctx.data_dir)


async def on_shutdown(ctx: Any) -> None:
    """Stop the loop and revoke the crew's grant, so a disabled app cannot keep auto-approving."""
    await watch.stop()
    try:
        crew_runtime.revoke(crew_runtime._gateway_state())
    except Exception:  # noqa: BLE001 - teardown must complete
        logger.warning("slack-radar: grant revocation on shutdown failed", exc_info=True)
