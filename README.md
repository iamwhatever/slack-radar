# Slack Radar

A Slack triage crew that remembers. Slack Radar watches the channels you choose, and one crew classifies every new message as a bug report, feature request, question, already-answered or noise with a priority, links clusters to existing GitHub issues and PRs through a read-only investigator, notices when a thread looks resolved, and posts a daily digest. Everything it learns lives in a local ledger, so nothing is triaged twice. Modeled on the built-in Issue Radar app.

## Quick start

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps) with a bot user. Bot token scopes: `channels:history`, `groups:history` (private channels), `channels:read`, `chat:write`. Install it to your workspace.
2. Invite the bot to every channel you want watched (`/invite @your-bot`), and to the digest channel.
3. Install and enable:

   ```bash
   kirocrew app install /path/to/slack-radar
   kirocrew app enable slack-radar
   ```

4. Open **Slack Radar → Settings**. Paste the Bot User OAuth Token (`xoxb-…`), list the channel IDs (right-click a channel → *Copy link*, the `C…` segment), and optionally a digest channel ID.
5. **Board → Start crew.** The first poll backfills the last 24 hours (configurable).
6. To get a digest on a schedule, resume the paused `daily-digest` cron (weekdays 16:00 UTC) in the Schedule view, or press **Request digest** on the Board.

Nothing is polled until both a token and at least one channel are set, and the crew never runs until you start it.

## Tabs

| Tab | What it shows |
|---|---|
| Board | Counts, crew status (phase, next step, mid-turn, auto-approve), per-channel poll health, and the ledger filtered by status. Select items and press **Investigate** to spawn the read-only GitHub investigator on them |
| Activity | The work log: polls that moved something, crew notes, digests, settings changes |
| Settings | Bot token (write-only), watched channels, digest channel, poll interval, backfill, crew agent/model, and the auto-approve toggle |

## How it works

- **Poller** (`backend/watch.py`): an in-gateway loop, zero LLM. Per channel it reads `conversations.history` from the app's own cursor (independent of your Slack read state), normalizes messages into ledger items, and re-checks a bounded window of open threads via `conversations.replies`, flagging *possibly resolved* candidates (✅ reaction, "fixed"/"merged"/"thanks" replies, deleted parent). Code never marks an item resolved.
- **Crew** (`backend/crew_runtime.py`): one dashboard session, slot `crew-slack-radar`, for all channels. Woken only when a poll moved something or a digest is due, so an idle workspace costs no turns. It carries `backend/crew_brief.md` (re-injected by presence check after compaction or restart) and records through the app's MCP tools.
- **Ledger** (`data/ledger.json`, spec in `backend/crew_ledger_spec.md`): cursors, items, the crew's resumable memory (`phase`, `next`, `tried`, `rejected`) and digest state. Both the gateway and the crew's MCP server write it under one file lock.
- **Digest**: the crew picks top items and a headline; the gateway renders the Slack text from the ledger's public fields and posts it to the configured channel. The crew can also `send_message` it to you.

## Autonomy and security

- **The bot token and the channel/digest settings live in the gateway's encrypted vault** (`~/.kiro/crew/.vault/`, already on the keystone floor `security._CREW_SECRET_LEAVES`). An installed app cannot add its own leaf the way the builtin Ops Mission Control does, so the vault is the equivalent placement. Agents can neither read nor write it. The channel list and digest destination are kept there too, because they decide what the bot reads and where it posts.
- Settings, token, start/pause, poll, digest and investigate routes are owner-only: the dashboard owner or this app's own UI, never an internal-secret caller, so the crew session cannot repoint the bot or grant itself auto-approval.
- **Auto-approve is off by default.** The crew reads text anyone in your channels can write. Turn it on only when every watched channel is trusted. When on, it is a scoped, 15-minute, SEL-audited `SafetyOverride` grant renewed by each poll, never the interactive trust flag.
- Token-shaped strings in messages are redacted before they are stored. Only `xoxb-` bot tokens are accepted.

## Scope cuts

- No OAuth install flow: you create the Slack app and paste the bot token.
- No per-message Slack write-back: the only Slack write is the digest post.
- One workspace and one token per install.
- No Socket Mode or Events API: polling only (default every 5 minutes).

## Development

```bash
python3 -m pytest tests -q          # ledger, poll cycle, digest, MCP server
cd ui && npm install --legacy-peer-deps && npx vite build   # rebuilds ui/dist/index.mjs
```

The UI bundle `ui/dist/index.mjs` is committed so a plain install works without a Node toolchain.

## Structure

```
slack-radar/
├── app.json                    manifest
├── agents/slack-radar-investigator.json   read-only GitHub investigator
├── backend/
│   ├── routes.py               HTTP API (backend.hooks.routes)
│   ├── hooks.py                on_startup / on_shutdown: poll loop, grant revoke
│   ├── watch.py                poll cycle, thread re-check, digest render/post
│   ├── crew_runtime.py         crew session, brief injection, nudge, grant
│   ├── store.py                ledger (stdlib only, shared with the MCP server)
│   ├── secrets.py              vault-backed token + settings
│   ├── slack_api.py            minimal Slack Web API client
│   ├── mcp_server.py           crew tools: slack_radar_read/record/digest/request_digest
│   ├── crew_brief.md           the crew's standing instructions
│   └── crew_ledger_spec.md     every ledger field, who owns it, public vs local
├── ui/                         React page (Board / Activity / Settings)
└── tests/test_slack_radar.py
```
