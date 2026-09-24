# Slack Radar ledger + crew write path

Two kinds of state, stored in two places on purpose.

**Authority** — the watched channel list, the Slack MCP command the gateway spawns, the digest destination and the self-DM login — lives in the gateway's encrypted vault (`~/.kiro/crew/.vault/`, vault entry `slack-radar.settings`, already a `security._CREW_SECRET_LEAVES` entry). There is no credential: Slack is read through the owner's own Slack MCP. Agents can neither read nor write the entry. Only the owner-gated `PUT /settings` writes it; only the gateway process reads it. See `settings.py` for why each field counts as authority.

**The ledger** — cursors, triage items, crew memory, digest state — lives in the app data dir, which agents can read and write:

```
<data>/ledger.json          # everything below, one document, schema 1
<data>/ledger.json.lock     # sidecar lock (ledger.json is replaced by rename)
<data>/events.jsonl         # append-only work log, halved when it passes 2 MiB
<data>/crew.json            # the crew record
```

`<data>` is `~/.kiro/crew/apps/slack-radar/data/` (`AppContext.data_dir` in the gateway, `store.default_data_dir()` in the MCP server, `SLACK_RADAR_DATA_DIR` to override).

Every write is `store.mutate`: exclusive `flock` on the sidecar, read, edit, atomic replace. The gateway poller and the crew's MCP server are different processes and both go through it. A `ledger.json` whose root is not an object is refused, never replaced — rewriting from an empty base would delete every cursor.

Nothing in the ledger authorises anything. A prompt-injected crew that corrupts it can mis-triage, not change what is read or where anything is sent.

## Crew record (`crew.json`)

| Field | Type | Notes |
|---|---|---|
| `id` / `slot_key` | str | fixed: `slack-radar` / `crew-slack-radar`. One crew per install, for all channels |
| `name` | str | shown as the session title |
| `agent` / `model` / `workspace` | str | session config; `model: ""` = the agent's default |
| `enabled` / `paused_reason` | bool / str | live = enabled and no reason |
| `unattended` | bool | default **false**. When true the crew holds a `SafetyOverride` scoped grant (`crew:slack-radar:autoapprove`, 900 s TTL, renewed by every poll, SEL-audited) — never `slot._trust` |
| `created_at` / `updated_at` | epoch s | |

Written only by owner routes (`/crew/start`, `/crew/pause`, `PUT /crew`).

## Channels (`ledger.channels.<channel id>`)

| Field | Owner | Notes |
|---|---|---|
| `cursor_ts` | poller | newest message ts ingested, as a Slack ts string. Independent of the owner's Slack read marker. Sent to `batch_get_conversation_history` as ISO-8601 floored to milliseconds (the MCP's precision), so the boundary can only move earlier; re-delivered messages are dropped by item key. First poll starts at `now - backfill_hours` |
| `last_polled_at` / `last_error` | poller | `last_error` is the per-channel error the MCP returned (`channel_not_found`, …) |
| `truncated_at` | poller | more than 5 pages × 200 messages in one cycle; the cursor stops at the newest ingested message and the rest is read next cycle |

## Item (`ledger.items.<channel>:<ts>`)

One per top-level message. Thread replies are not items; they are signals on their parent.

| Field | Owner | Public? | Notes |
|---|---|---|---|
| `key`, `channel`, `ts`, `thread_ts`, `user`, `is_bot` | poller | — | identity |
| `text` | poller | local | credential-shaped strings redacted, ≤ 4000 chars. UNTRUSTED |
| `permalink` | poller | public | the message's own `permalink` when the MCP supplies one, else built from the `workspace_url` setting |
| `reply_count`, `latest_reply`, `reactions` | poller | — | refreshed by the thread re-check |
| `needs_triage` | poller sets, crew clears | — | true on ingest |
| `thread_changed` | poller sets, crew clears | — | a new reply since the crew last recorded this item |
| `possibly_resolved` | poller sets, crew clears | — | `{reason, at}` — a QUESTION for the crew, never a verdict |
| `last_thread_check_at` | poller | — | re-check at most every 30 min |
| `status` | crew | — | `new` → `triaged` / `investigating` → `resolved` / `noise`. The poller writes only `new` |
| `category` | crew | public | `feature-request` · `bug-report` · `question` · `already-answered` · `noise` |
| `priority` | crew | public | `p0`–`p3` |
| `summary` | crew | public | ≤ 600 chars |
| `links` | crew / investigator | public | `https://` URLs only, ≤ 10 |
| `note` | crew / investigator | local | evidence, doubts, why a flag was cleared |
| `investigation` | crew / routes | local | spawn id of the investigator working it |

Retention: closed items (`resolved`, `noise`) are dropped 30 days after their last update; the ledger holds at most 2000 items, closed-oldest evicted first.

### The re-check window

Each cycle the poller re-reads up to `recheck_max_per_cycle` (default 20) open items from watched channels posted within `recheck_days` (default 7), least-recently-checked first, in one `batch_get_thread_replies` call. It flags `possibly_resolved` when the parent has a ✅-family reaction, a new reply matches a resolution word (`fixed`, `resolved`, `merged`, `shipped`, `thanks`, …), or the parent was deleted. It never changes `status`.

## Source state (`ledger.source_state`, `ledger.source_error`)

`ok` · `needs_login` · `binary_not_found` · `error`. Set by the poller. An auth error from the Slack MCP (the owner's browser/Midway session expired) anywhere in a cycle stops the cycle before any cursor moves and sets `needs_login`. While in that state, each cycle first makes one cheap read (`batch_get_channel_info`); only when it succeeds does polling resume. Shown on the board and in `slack_radar_read` as `slack_source`. It is never reported as "no new messages".

## Crew memory (`ledger.crew_memory`)

The crew's resumable position across turns, compaction and restarts.

| Field | Notes |
|---|---|
| `phase` | `idle` · `triaging` · `investigating` · `rechecking` · `digest` |
| `next` | **the resumable intent**, ≤ 500 chars. "next: re-check C0ABC:1727… once its thread moves" — not "triaging" |
| `tried` / `rejected` | append-only, newest 30 kept |
| `updated_at` | epoch s |

## Digest (`ledger.digest`)

| Field | Owner | Notes |
|---|---|---|
| `requested_at` | cron tool / owner route | the daily cron calls `slack_radar_request_digest`; the next poll wakes the crew |
| `pending` | crew | `{headline, top_keys, submitted_at}` from `slack_radar_digest` |
| `last_posted_at` / `last_posted_date` | poller | a digest is "due" when requested and not yet posted today (UTC) |
| `last_destination` / `last_text` | poller | `self_dm` or `dashboard`, and the rendered text (shown on the board) |
| `last_error` | poller | a `needs_login` or transport failure keeps the digest pending for the next cycle; any other error drops it rather than retrying forever |

The gateway renders the text itself (`watch.render_digest`) from counts and PUBLIC item fields plus the crew's headline, and delivers it per `digest_destination`: `self_dm` (the app's only Slack write, `SlackMcpClient.send_self_dm`, reachable only from `watch.deliver_pending_digest`) or `dashboard` (a `notification` event plus `last_text`). Nothing is ever posted to a channel.

## Event log (`events.jsonl`)

`{at, kind, text, key}` per line. Kinds: `poll`, `source`, `settings`, `crew`, `digest`, `investigate`, `backlog`. The crew adds one via `slack_radar_record.event`. Rendered in the dashboard's Activity tab only — local, but still keep paths and hosts out of it.

## Waking the crew

There is no idle nudge loop. `watch.poll_once` → `crew_runtime.after_poll` wakes the crew when a poll ingested new items, saw a thread change or a new flag, or a digest is due; leftover `needs_triage` is re-offered at most every 30 minutes. A crew that is mid-turn is not woken (the wake is dropped, not queued: the next poll re-offers everything).

### Brief injection — presence check

The brief (`crew_brief.md`, first line `<!-- slack-radar-crew-brief v1 -->`) is prepended to the nudge whenever no message in the session both contains the sentinel and is at least as long as the brief. Session start, compaction and restart are all the same case.

## Crew write path — one stdio MCP server, four tools

`backend/mcp_server.py`, declared in `app.json` `mcpServers`. It imports only `store.py`.

- `slack_radar_read` — memory, counts, digest state, `needs_triage`, `thread_updates` (≤ 100 each).
- `slack_radar_record` — `{items: [{key, category?, priority?, status?, summary?, links?, note?, investigation?, clear_possibly_resolved?}], crew?: {phase?, next?, tried_add?, rejected_add?}, event?}`. Unknown keys and bad enums are refused per item; recording any field on an item clears its `needs_triage` and `thread_changed`.
- `slack_radar_digest` — `{headline, top_keys?}`.
- `slack_radar_request_digest` — `{}`; for the daily cron.
