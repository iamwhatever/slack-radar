# Slack Radar desk — machine contract

What the code, the agents and the UI agree on. The people-level rules are in [CHARTER.md](CHARTER.md). If this file and the code disagree, the code is right and this file is the bug.

## 1. Fixed names

| What | Value | Where it is fixed |
|---|---|---|
| App | `slack-radar` | `app.json` `name`; API root `/api/apps/slack-radar` |
| Radar Lead agent | `slack-radar-crew` | `agents/slack-radar-crew.json`, `store.CREW_AGENT` |
| Investigator agent | `slack-radar-investigator` | `agents/slack-radar-investigator.json`, `routes.INVESTIGATOR_AGENT` |
| Thread Watcher agent | `slack-radar-watcher` | `agents/slack-radar-watcher.json`, `org.WATCHER_AGENT` |
| Crew record id | `slack-radar` | `crew.json` `id` |
| Crew slot | `crew-slack-radar`, then `crew-slack-radar-g<N>` | `store.SLOT_KEY`, `store.next_slot_key` |
| Ledger MCP server | `@slack-radar:ledger` | `app.json` `mcpServers.ledger` |
| Unattended grant scope | `crew:slack-radar:autoapprove` (900 s) | `crew_runtime.TRUST_SCOPE` |
| Brief sentinel | `<!-- slack-radar-crew-brief v4 -->` | first line of `backend/crew_brief.md` |

These names are part of the install: renaming one orphans a session, a spec or a grant.

## 2. Roster (`desk/members.json`)

A list with exactly one object per id `lead`, `investigator`, `watcher`, `poller`. Validated by `backend/org.py` `validate_members` and by `tests/test_org.py`.

| Field | Type | Values |
|---|---|---|
| `id` | str | `lead` · `investigator` · `watcher` · `poller` |
| `kind` | str | `agent` · `code` |
| `agent` | str / null | the agent name for `kind: agent`; `null` for code |
| `display` / `role` | `{en, zh}` | non-empty strings in both languages |
| `residency` | str | `resident` · `on-demand` · `planned` |
| `tools` | str | `ledger+spawn` (lead) · `ledger+shell` (investigator) · `ledger` (watcher) · `slack-read` (poller) |

Every `agent` of a non-planned member must exist in `agents/*.json` and in `app.json` `agents`. `tools` is a label for readers; the agent specs are what the host enforces, and the test checks the two agree on shell and spawn.

## 3. Ledger record format

The ledger reference below is the one moved here from `backend/crew_ledger_spec.md`, which is now a pointer. No code reads either file at runtime; only `backend/crew_brief.md` is injected into the crew's prompt.

Two kinds of state, stored in two places on purpose.

**Authority** — the watched channel list, the Slack MCP command the gateway spawns, the digest destination and the self-DM login — lives in the gateway's encrypted vault (`~/.kiro/crew/.vault/`, vault entry `slack-radar.settings`, already a `security._CREW_SECRET_LEAVES` entry). There is no credential: Slack is read through the owner's own Slack MCP. Agents can neither read nor write the entry. Only the owner-gated `PUT /settings` writes it; only the gateway process reads it. See `backend/settings.py` for why each field counts as authority.

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

### Crew record (`crew.json`)

| Field | Type | Notes |
|---|---|---|
| `id` / `slot_key` | str | `id` is fixed (`slack-radar`); `slot_key` starts as `crew-slack-radar` and becomes `crew-slack-radar-g<N>` each time the session moves to a different agent (the host never re-binds a slot's agent; the old slot is archived). One crew per install, for all channels |
| `name` | str | shown as the session title |
| `agent` / `model` / `workspace` | str | session config; `model: ""` = the agent's default |
| `enabled` / `paused_reason` | bool / str | live = enabled and no reason |
| `unattended` | bool | default **false**. When true the crew holds a `SafetyOverride` scoped grant (`crew:slack-radar:autoapprove`, 900 s TTL, renewed by every poll, SEL-audited) — never `slot._trust` |
| `created_at` / `updated_at` | epoch s | |

Written only by owner routes (`/crew/start`, `/crew/pause`, `PUT /crew`).

### Channels (`ledger.channels.<channel id>`)

| Field | Owner | Notes |
|---|---|---|
| `cursor_ts` | poller | newest message ts ingested, as a Slack ts string. Independent of the owner's Slack read marker. Sent to `batch_get_conversation_history` as ISO-8601 floored to milliseconds (the MCP's precision), so the boundary can only move earlier; re-delivered messages are dropped by item key. First poll starts at `now - backfill_hours` |
| `last_polled_at` / `last_error` | poller | `last_error` is the per-channel error the MCP returned (`channel_not_found`, …) |
| `truncated_at` | poller | more than 5 pages × 200 messages in one cycle; the cursor stops at the newest ingested message and the rest is read next cycle |

### Item (`ledger.items.<channel>:<ts>`)

One per top-level message. Thread replies are not items; they are signals on their parent.

| Field | Owner | Public? | Notes |
|---|---|---|---|
| `key`, `channel`, `ts`, `thread_ts`, `user`, `is_bot` | poller | — | identity |
| `text` | poller | local | credential-shaped strings redacted, ≤ 4000 chars. UNTRUSTED |
| `permalink` | poller | public | the message's own `permalink` when the MCP supplies one, else built from the `workspace_url` setting |
| `reply_count`, `latest_reply`, `reactions` | poller | — | refreshed by the thread re-check |
| `replies` | poller | local | `[{ts, user, text}]`, the newest 5 thread replies, text redacted and ≤ 400 chars, oldest first. Refreshed by every thread re-check; `[]` at ingest. Emptied when the item leaves `new`/`triaged`/`investigating` or is older than 7 days, so reply text is bounded to 5 × 400 chars per open, recent item. UNTRUSTED. Never in `summary`, the digest, `crew.today` or any other public output; `slack_radar_record` has no field for it. `slack_radar_read` returns it on `thread_updates` items |
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
| `handled_at` | owner | local | epoch s the owner pressed **Done** or **Ignore**; `0` = not handled. Set only by `POST /items/handle`; `slack_radar_record` has no field for it |
| `handled_how` | owner | local | `done` · `ignored` · `""`. A handled item keeps its `status`; it only leaves the Needs-you list. `reopen` clears both fields |

Retention: closed items (`resolved`, `noise`) are dropped 30 days after their last update; the ledger holds at most 2000 items, closed-oldest evicted first.

#### The re-check window

Each cycle the poller re-reads up to `recheck_max_per_cycle` (default 20) open items from watched channels posted within `recheck_days` (default 7), least-recently-checked first, in one `batch_get_thread_replies` call. It stores the newest 5 replies on the item (`replies`) and flags `possibly_resolved` when:

- the ORIGINAL POSTER put a ✅-family reaction (`white_check_mark`, `heavy_check_mark`, `ballot_box_with_check`, …) on the parent — a reaction by anyone else, or one without a user list, does not count; or
- a new reply by someone OTHER than the poster contains a resolution word: `fixed`, `resolved`, `solved`, `merged`, `shipped`, `deployed`, `released in`, `works now`, `working now`, `that did it`. A word right after a negation (`not fixed`, `isn't resolved`) does not count. Gratitude (`thanks`, `thank you`, `ty`) and `done` are not resolution words; or
- the parent was deleted.

The flag is a keyword hint. The Lead or the Thread Watcher judges it from `replies`. The poller never changes `status`.

### Source state (`ledger.source_state`, `ledger.source_error`)

`ok` · `needs_login` · `binary_not_found` · `error`. Set by the poller. An auth error from the Slack MCP (the owner's browser/Midway session expired) anywhere in a cycle stops the cycle before any cursor moves and sets `needs_login`. While in that state, each cycle first makes one cheap read (`batch_get_channel_info`); only when it succeeds does polling resume. Shown on the board and in `slack_radar_read` as `slack_source`. It is never reported as "no new messages".

### Crew memory (`ledger.crew_memory`)

The crew's resumable position across turns, compaction and restarts.

| Field | Notes |
|---|---|
| `phase` | `idle` · `triaging` · `investigating` · `rechecking` · `digest` |
| `next` | **the resumable intent**, ≤ 500 chars. "next: re-check C0ABC:1727… once its thread moves" — not "triaging" |
| `tried` / `rejected` | append-only, newest 30 kept |
| `today` | `{text, at}`. **PUBLIC**: the Lead's standing one-line note for the Board, ≤ 240 chars, set whenever a turn changed anything — what changed and what needs the owner, or "nothing needs you". Refused (not clipped) when longer, empty, or carrying a path, host name/address or credential (`store.public_text_problem`). `at` is when it was written. `GET /state` returns it as `crew.today` |
| `updated_at` | epoch s |

### Digest (`ledger.digest`)

| Field | Owner | Notes |
|---|---|---|
| `requested_at` | cron tool / owner route | the daily cron (`daily-digest`, on by default, 16:00 UTC Mon–Fri) calls `slack_radar_request_digest`; the next poll wakes the crew |
| `pending` | crew | `{headline, top_keys, submitted_at}` from `slack_radar_digest` |
| `last_posted_at` / `last_posted_date` | poller | a digest is "due" when requested and not yet posted today (UTC) |
| `last_destination` / `last_text` | poller | `self_dm` or `dashboard`, and the rendered text (shown on the board) |
| `last_error` | poller | a `needs_login` or transport failure keeps the digest pending for the next cycle; any other error drops it rather than retrying forever |

The gateway renders the text itself (`watch.render_digest`) from counts and PUBLIC item fields plus the crew's headline, and delivers it per `digest_destination`: `self_dm` (the app's only Slack write, `SlackMcpClient.send_self_dm`, reachable only from `watch.deliver_pending_digest`) or `dashboard` (a `notification` event plus `last_text`). Nothing is ever posted to a channel.

### Event log (`events.jsonl`)

`{at, kind, text, key}` per line. Kinds: `poll`, `source`, `settings`, `crew`, `digest`, `investigate`, `backlog`, `handled`, `member`. A `member` line (`investigator started: <task line>`, `watcher finished`) is written when a child run of the crew session appears in or leaves the gateway's run list; the last list seen is kept in `<data>/member_runs.json`, and the comparison runs on every poll and every `/now`, `/state`, `/org` read. The crew adds one via `slack_radar_record.event`. Rendered in the dashboard's Activity tab only — local, but still keep paths and hosts out of it.

### Waking the crew

There is no idle nudge loop. `watch.poll_once` → `crew_runtime.after_poll` wakes the crew when a poll ingested new items, saw a thread change or a new flag, or a digest is due; leftover `needs_triage` is re-offered at most every 30 minutes. A crew that is mid-turn is not woken (the wake is dropped, not queued: the next poll re-offers everything).
With no Slack bot on the gateway the poller reads the http app's `state` (the one the routes read), so every poll wakes, renews the grant and observes member runs; leftover `thread_updates` are re-offered like `needs_triage`, and a wake dropped mid-turn is retried on the next poll.

#### Brief injection — presence check

The brief (`crew_brief.md`, first line `<!-- slack-radar-crew-brief v4 -->`) is prepended to the nudge whenever no message in the session both contains the sentinel and is at least as long as the brief. Session start, compaction and restart are all the same case.

## 4. MCP tools (`backend/mcp_server.py`)

One stdio server, declared in `app.json` `mcpServers.ledger`, reached by agents as `@slack-radar:ledger`. It imports only `store.py`. Every write goes through `store.mutate`.

| Tool | Arguments | Returns |
|---|---|---|
| `slack_radar_read` | `{limit?: int 1–100}` (default 40) | `crew` (`name`, `enabled`, `paused_reason`), `crew_memory`, `counts`, `slack_source` (`state`, `error`), `digest` (`requested_at`, `pending`, `last_posted_date`, `last_error`), `channels` (`last_polled_at`, `last_error`), `needs_triage`, `thread_updates` (each item also carries its LOCAL `replies`) |
| `slack_radar_record` | `{items?: [...≤100], crew?: {...}, event?: str}` | `{ok, applied, refused}` |
| `slack_radar_digest` | `{headline: str ≤400, top_keys?: [item key ≤10]}` | `{ok, queued}`; sets `digest.pending` and `crew_memory.phase: idle` |
| `slack_radar_request_digest` | `{}` | `{ok, requested}`; sets `digest.requested_at` |

`slack_radar_record` item shape: `{key, category?, priority?, status?, summary?, links?, note?, investigation?, clear_possibly_resolved?: bool}`. `key` must be one `slack_radar_read` returned. `status` may not be `new`. Enums are `store.CATEGORIES`, `store.PRIORITIES`, `store.STATUSES`. Unknown keys and bad enums are refused per item; recording any field on an item clears its `needs_triage` and `thread_changed`.

`slack_radar_record` crew shape: `{phase?: idle|triaging|investigating|rechecking|digest, next?: str ≤500, today?: str ≤240, tried_add?: [str], rejected_add?: [str]}`. A refused `today` is reported in `refused` as key `crew.today`; the other crew fields still apply.

`event` is one line for the Activity tab: no paths, no hosts.

## 5. HTTP routes (`backend/routes.py`)

All paths are under `/api/apps/slack-radar`. "Owner" means `_owner_gate`: the dashboard owner or this app's own UI token, never an agent's internal-secret call.

| Method | Path | Gate | Body / query | What it does |
|---|---|---|---|---|
| GET | `/state` | open | — | settings, crew record + session facts + `today` (`{text, at}` from `crew_memory.today`), crew memory, investigations, `now` (the `/now` object), counts, channels, source state, last poll, digest |
| GET | `/org` | open | — | `desk/members.json` with a `live` block per member (below) |
| GET | `/now` | open | — | `{ok, members: [row]}` — what each member is doing right now (below) |
| GET | `/items` | open | `status` (`open` or a status), `channel`, `handled=1`, `limit` ≤500 | ledger items, newest first; `handled=1` keeps only items with `handled_at > 0` (the board's **Handled (N)** fold) |
| GET | `/needs` | open | — | the Needs-you groups (§6) |
| POST | `/items/handle` | owner | `{key, how: done\|ignored\|reopen}` | set or clear `handled_at` / `handled_how`; status unchanged. `400 invalid_field`, `404 unknown_item` |
| GET | `/events` | open | `limit` ≤500 | the event log |
| PUT | `/settings` | owner | settings patch | validates and writes the vault entry |
| GET | `/mcp/status` | owner | — | handshake with the Slack MCP: connected · needs_login · incompatible · binary_not_found · error |
| POST | `/poll` | owner | — | one poll now |
| POST | `/crew/start` | owner | — | enable the crew and open its session |
| POST | `/crew/pause` | owner | `{reason?}` | pause the crew |
| PUT | `/crew` | owner | `{agent?, model?, workspace?, name?, unattended?: bool}` | crew settings; re-derives the grant |
| POST | `/crew/message` | owner | `{message}` | send the owner's chat-card message to the lead |
| POST | `/digest/request` | owner | — | request a digest and wake the crew |
| POST | `/investigate` | owner | `{keys: [≤10], repo?}` | spawn the Investigator via the spawn SDK; refused `unattended_required` unless unattended is on |

Errors are `{ok: false, code, error}` with an HTTP status.

`GET /org` `live` blocks:

| Member | `live` |
|---|---|
| `lead` | `{session_open, running, paused, paused_reason, slot_key}` — the same slot facts `/state` reports as `crew` |
| `investigator` | `{in_flight, items}` — `in_flight` is the `/now` row's `count`; `items` is `/state` `investigations.items` |
| `watcher` | `{in_flight, planned}` — `in_flight` is the `/now` row's `count`; `planned` mirrors `residency` |
| `poller` | `{source_state, last_poll_at}` |

Every `live` block also carries `now`: that member's `/now` row. Both come from one `org.now_view` call per request, so the Team tab and the Board agree. A `members.json` that fails validation returns `500 members_invalid`.

`GET /now` rows, in roster order — `{id, state, doing, since, count, source}`:

| Field | Meaning |
|---|---|
| `state` | `idle` · `working` · `paused` · `planned` |
| `doing` | one public line, ≤80 chars for a run's task, paths replaced by `…` |
| `since` | epoch seconds or `null` |
| `count` | lead: 1 while its turn runs · investigator/watcher: runs in flight · poller: channels watched |
| `source` | `gateway` (host facts) or `ledger` (the app's own record) |

| Member | Built from |
|---|---|
| `lead` | `paused` when the crew is not live (`doing` = `paused_reason`); `working` while the slot runs, `doing` from `crew_memory.phase` (`triaging N new items`, `judging N possibly-resolved threads`, `writing the digest`, `following N investigations`), else from counts and `digest.requested_at`; `idle` otherwise. `since` = `crew_memory.updated_at`, else the crew record's `updated_at` (the host exposes no turn start). `source` is `gateway` when the slot is open |
| `investigator`, `watcher` | the host's `state.subagents.running_agents_for("dashboard:<slot key>")`, filtered by agent `slack-radar-investigator` / `slack-radar-watcher` (or `<app>--<name>`); `doing` = the oldest run's task line, `(+N more)` beyond one; `since` = its start. The investigator also counts ledger `spawn <id>` ids the spawn SDK says are still running and that are not already listed (the Board's Investigate button spawns outside the crew session). With no run list from the host: the investigator's count is `/state` `investigations.running`, the watcher's 0, both `source: "ledger"`. An idle member whose `residency` is `planned` reads `planned` |
| `poller` | `last poll Ns ago · next in Ms` from `ledger.last_poll_at` and `poll_interval_secs` (floor 60); `paused` with a prefix while `source_state` is not `ok`; `since` = `last_poll_at` |

## 6. Needs-you rules (`backend/needs.py`, `GET /needs`)

Fixed rules over the ledger; no model call. Only items that are open (`new` · `triaged` · `investigating`) and not handled (`handled_at == 0`) are considered.

| Group | An item is in it when | `reason` |
|---|---|---|
| `decide` | `priority` is `p0` or `p1`; or it has `links` and a non-empty `investigation` that finished (status moved off `investigating`, or the spawn SDK says the spawn is done); or `possibly_resolved` is set. First match gives the reason | `Open p1` · `Matching GitHub work found` · `Looks resolved: <poller reason>` |
| `unanswered` | not in `decide`; `category == question`; `reply_count == 0` and no `latest_reply`; posted more than 48 h ago | `No reply for N days` |
| `clusters` | 2+ items in the SAME channel linked by sharing 2+ significant words; links chain (A~B, B~C puts A, B, C together). One entry per cluster, for its top-ranked member, plus `members` (all keys) and `words` (up to 4 shared words) | `N similar messages` |

A significant word: lower-cased `[a-z0-9]{3,}` from `summary` (else the first 200 chars of `text`), not all digits, not in `needs.STOPWORDS` (common English and support-channel filler such as *please*, *thanks*, *issue*). A cluster may name items that are also in `decide` or `unanswered`.

Order: priority `p0` … `p3`, then no priority; within a priority, oldest first. Clusters order by best member priority, then size, then age. Each group returns at most 20 `entries` and its full `total`.

Response: `{ok, groups: [{id, total, entries}], handled_total}` with groups always in the order `decide`, `unanswered`, `clusters`. Entry: `{key, channel, permalink, summary, priority, category, age_hours, reason}` (+ `members`, `words` on clusters). `summary` falls back to `text[:200]`.

**Done** / **Ignore** on a cluster entry posts `/items/handle` for every member.
