---
name: slack-radar-handoff
description: "Hand Slack triage questions to the Slack Radar crew instead of answering them yourself. Use when the user asks about Slack triage, today's Slack digest, what is hot or new in the watched Slack channels, open Slack bug reports or questions, or possibly-resolved Slack threads. Triggers: 'Slack triage', 'Slack digest', 'Slack summary', 'what's hot in Slack', 'what happened in the channels today', 'Slack 汇总', 'Slack 摘要', 'Slack 今日汇总', '频道里有什么新消息', 'Slack 上有什么热点', 'Slack 分诊'."
---

# Slack Radar hand-off

Slack Radar already watches the owner's Slack channels and keeps the triage in its own ledger. The Radar Lead (agent `slack-radar-crew`) owns that work. Your job is to route the question to it, not to redo it.

## Do

1. Point the user to the Slack Radar page: route `/apps/slack-radar`. Its chat card talks to the Radar Lead directly.
2. If you have session tools (for example `session_send`), send the user's question into the Radar Lead's session. Its key starts with `crew-slack-radar` (`crew-slack-radar`, or `crew-slack-radar-g<N>` after a move; use the newest one that exists). Tell the user you did, and that the answer appears in that chat card.
3. If you have no session tools, say in one line: "Slack Radar's crew owns this; ask it in the chat card on the Slack Radar page (/apps/slack-radar)."

Answer in the user's language.

## Do not

- Do not read Slack yourself, with any Slack MCP or tool.
- Do not read or edit the Slack Radar ledger or its files, and do not call the `slack_radar_*` tools.
- Do not summarise Slack channels from memory or guess what is in them.
- Do not start, pause or reconfigure the crew; those are the owner's settings on the Slack Radar page.
