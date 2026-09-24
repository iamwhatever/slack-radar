# Slack Radar ledger + crew write path

Two kinds of state, stored in two places on purpose.

**Authority** — the bot token, the watched channel list and the digest destination — lives in the gateway's encrypted vault (`~/.kiro/crew/.vault/`, already a `security._CREW_SECRET_LEAVES` entry). Agents can neither read nor write it. Only the owner-gated routes in `routes.py` write it; only the gateway process reads it. See `secrets.py` for why the channel list counts as authority.

**The ledger** — cursors, triage items, crew memory, digest state — lives in the app data dir, which agents can read and write:

```
<data>/ledger.json          # everything below, one document, schema 1
<data>/ledger.json.lock     # sidecar lock (ledger.json is replaced by rename)
<data>/events.jsonl         # append-only work log, halved when it passes 2 MiB
<data>/crew.json            # the crew record
```

`<data>` is `~/.kiro/crew/apps/slack-radar/data/` (`AppContext.data_dir` in the gateway, `store.default_data_dir()` in the MCP server, `SLACK_RADAR_DATA_DIR` to override).

Every write is `store.mutate`: exclusive `flock` on the sidecar, read, edit, atomic replace. The gateway poller and the crew's MCP server are different processes and both go through it. A `ledger.json` whose root is not an object is refused, never replaced — rewriting from an empty base would delete every cursor.

Nothing in the ledger authorises anything. A prompt-injected crew that corrupts it can mis-triage, not repoint the bot.

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
| `cursor_ts` | poller | newest message ts ingested. Independent of Slack's own read cursor. First poll starts at `now - backfill_hours` |
| `last_polled_at` / `last_error` | poller | `last_error` is Slack's error string (`not_in_channel`, `ratelimited`, …) |
| `backoff_until` | poller | set from `Retry-After` on a 429 |
| `truncated_at` | poller | a burst larger than 5 × 200 messages in one cycle; the older part of that burst was skipped |

## Item (`ledger.items.<channel>:<ts>`)

One per top-level message. Thread replies are not items; they are signals on their parent.

| Field | Owner | Public? | Notes |
|---|---|---|---|
| `key`, `channel`, `ts`, `thread_ts`, `user`, `is_bot` | poller | — | identity |
| `text` | poller | local | token-redacted, ≤ 4000 chars. UNTRUSTED |
| `permalink` | poller | public | built from `auth.test`'s workspace URL |
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

Each cycle the poller re-reads up to `recheck_max_per_cycle` (default 20) open items from watched channels posted within `recheck_days` (default 7), least-recently-checked first, via `conversations.replies`. It flags `possibly_resolved` when the parent has a ✅-family reaction, a new reply matches a resolution word (`fixed`, `resolved`, `merged`, `shipped`, `thanks`, …), or the parent was deleted. It never changes `status`.

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
| `last_error` | poller | Slack's error on the post; a permanent error drops the pending digest rather than retrying forever |

The gateway renders the Slack text itself (`watch.render_digest`) from counts and PUBLIC item fields plus the crew's headline, and posts only to the owner-configured `digest_channel`.

## Event log (`events.jsonl`)

`{at, kind, text, key}` per line. Kinds: `poll`, `settings`, `crew`, `digest`, `investigate`, `backlog`. The crew adds one via `slack_radar_record.event`. Rendered in the dashboard's Activity tab only — local, but still keep paths and hosts out of it.

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
