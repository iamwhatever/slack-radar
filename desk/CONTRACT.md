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
| Brief sentinel | `<!-- slack-radar-crew-brief v6 -->` | first line of `backend/crew_brief.md` |

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
<data>/member_runs.json     # crew-session child runs in flight at the last look (§3 Event log)
<data>/member_last.json     # each member's last run, for GET /now (§5)
<data>/kv/tool_version.json # written by each ledger MCP server on start (see §4)
<data>/kv/crew_session.json # written by the gateway: the version the crew session started under
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
| `possibly_resolved` | poller sets, crew clears | — | `{reason, at, watcher_at?}` — a QUESTION for the crew, never a verdict. `watcher_at` is set by the gateway when the flag is handed to a Thread Watcher run |
| `last_thread_check_at` | poller | — | re-check at most every 30 min |
| `status` | crew | — | `new` → `triaged` / `investigating` → `resolved` / `noise`. The poller writes only `new` |
| `category` | crew | public | `feature-request` · `bug-report` · `question` · `already-answered` · `noise` |
| `priority` | crew | public | `p0`–`p3` |
| `summary` | crew | public | ≤ 600 chars |
| `links` | crew / investigator | public | `https://` URLs only, ≤ 10 |
| `note` | crew / investigator | local | evidence, doubts, why a flag was cleared |
| `investigation` | crew / routes | local | spawn id of the investigator working it |
| `investigation_at` | crew / routes | local | epoch seconds when `investigation` last changed (set by `/investigate` and by the record tool on a changed value); the start `/now` shows for a run started from the Ledger tab |
| `fix_handoff` | crew (Lead) / owner clears | local | `{title ≤120, prompt ≤4000, repo owner/name, links [https ≤10], at}` or `null`. A fix task for a coding session the owner starts from the Board. Only on a `triaged`/`investigating` `bug-report`/`feature-request`; one per item, a new write replaces it. Title and prompt get the public check (`store.public_text_problem`: no path, host or secret). The prompt must contain the item key, every link, the word `coverage` (the verdict) and the line `Do not merge; open a PR for review`; `links` defaults to the item's `links`. Cleared only by `POST /items/handoff/dismiss`. After **Dispatch fix** it also carries `dispatch: {session_key, title, agent, at}` and `pr_url` (`""` until the session reports a PR), both written only by the app, never by the Lead; a Lead rewrite of the hand-off keeps them. A batch dispatch adds `batch: true` and `batch_keys` (every member, in seed order) to `dispatch`, the same record on every member, and `pr_urls` (≤20): the batch's PRs that name no single fix |
| `handled_at` | owner | local | epoch s the owner pressed **Done** or **Ignore**; `0` = not handled. Set only by `POST /items/handle`; `slack_radar_record` has no field for it |
| `handled_how` | owner | local | `done` · `ignored` · `""`. A handled item keeps its `status`; it only leaves the Needs-you list. `reopen` clears both fields |
| `reply_draft` | crew (Lead) / owner edits | local until sent | `{text ≤1500, at, by: lead\|owner}` or `null`/absent. A reply for the item's own thread that the owner sends. Only on an open item. The Lead's text gets the public check (`store.public_text_problem`) and is refused when it names another channel's id or carries a 40+ char line of another channel's message or replies. `POST /items/reply/draft` saves the owner's edit (`by: owner`, length and open-status checks only). Cleared by a successful send |
| `replied` | send route | local (the text is public in Slack) | `{ts, at, text, permalink}`: what the owner sent. Set only by `POST /items/reply/send`; `slack_radar_record` has no field for it |
| `reply_send_at` | send route | local | epoch s of the last send attempt; the minute-per-item limit. Cleared when a send certainly posted nothing |

Retention: closed items (`resolved`, `noise`) are dropped 30 days after their last update; the ledger holds at most 2000 items, closed-oldest evicted first.

#### The re-check window

Each cycle the poller re-reads up to `recheck_max_per_cycle` (default 20) open items from watched channels posted within `recheck_days` (default 7), least-recently-checked first, in one `batch_get_thread_replies` call. It stores the newest 5 replies on the item (`replies`) and flags `possibly_resolved` when:

- the ORIGINAL POSTER put a ✅-family reaction (`white_check_mark`, `heavy_check_mark`, `ballot_box_with_check`, …) on the parent — a reaction by anyone else, or one without a user list, does not count; or
- a new reply by someone OTHER than the poster contains a resolution word: `fixed`, `resolved`, `solved`, `merged`, `shipped`, `deployed`, `released in`, `works now`, `working now`, `that did it`. A word right after a negation (`not fixed`, `isn't resolved`) does not count. Gratitude (`thanks`, `thank you`, `ty`) and `done` are not resolution words; or
- the parent was deleted.

The flag is a keyword hint. The poller never changes `status`.

The Thread Watcher judges it from `replies`, dispatched for the Lead by `crew_runtime.dispatch_watcher` once per `watch.poll_once`: every open flagged item with no `watcher_at` (oldest first, at most `MAX_WATCHER_BATCH` = 20) goes into ONE spawn-SDK run of `slack-radar-watcher`, and each gets `watcher_at`. Nothing is started while the crew is not live, while the last Watcher run has not finished (`member_last.json` `watcher.spawn_id` with no `finished_at`), or with no spawn SDK. The Lead judges a flag itself only when `watcher_at` is set and the flag is still there, or when the nudge says the Watcher is unavailable.

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

The gateway renders the text itself (`watch.render_digest`) from counts and PUBLIC item fields plus the crew's headline, and delivers it per `digest_destination`: `self_dm` (the app's only Slack write, `SlackMcpClient.send_self_dm`, reachable only from `watch.deliver_pending_digest`) or `dashboard` (a `notification` event plus `last_text`). The digest is never posted to a channel; the only channel write is the owner's one-click reply (§5, *One-click reply*).

### Event log (`events.jsonl`)

`{at, kind, text, key}` per line. Kinds: `poll`, `source`, `settings`, `crew`, `digest`, `investigate`, `backlog`, `handled`, `member`, `handoff`, `dispatch`. A `dispatch` line is written when the owner dispatches a fix and once when its PR is found. A batch writes one line (`fix batch dispatched: N problems -> <title>`, no key) and one per PR found. A `member` line (`investigator started: <task line>`, `watcher finished`) is written when a child run of the crew session appears in or leaves the gateway's run list; the runs in flight at the last look are kept in `<data>/member_runs.json` (so it reads `{}` whenever nothing runs), and the comparison runs on every poll and every `/now`, `/state`, `/org` read. A run the app started through the spawn SDK (the Thread Watcher after a poll, the Board's Investigate button) writes `watcher started: judging N possibly-resolved thread(s)` when it starts and `<member> finished` once the SDK reports it done (checked on the same reads); such a run id is skipped in the child-run comparison. Every start and finish also updates `<data>/member_last.json`: `{lead|investigator|watcher: {started_at, finished_at, spawn_id}}` (the Lead's `started_at` is its last wake). The crew adds one via `slack_radar_record.event`. Rendered in the dashboard's Activity tab only — local, but still keep paths and hosts out of it.

### Waking the crew

There is no idle nudge loop. `watch.poll_once` → `crew_runtime.after_poll` wakes the crew when a poll ingested new items, saw a thread change or a new flag, or a digest is due; leftover `needs_triage` is re-offered at most every 30 minutes. A crew that is mid-turn is not woken (the wake is dropped, not queued: the next poll re-offers everything).
With no Slack bot on the gateway the poller reads the http app's `state` (the one the routes read), so every poll wakes, renews the grant and observes member runs; leftover `thread_updates` are re-offered like `needs_triage`, and a wake dropped mid-turn is retried on the next poll.

#### Brief injection — presence check

The brief (`crew_brief.md`, first line `<!-- slack-radar-crew-brief v7 -->`) is prepended to the nudge whenever no message in the session both contains the sentinel and is at least as long as the brief. Session start, compaction and restart are all the same case.

## 4. MCP tools (`backend/mcp_server.py`)

One stdio server, declared in `app.json` `mcpServers.ledger`, reached by agents as `@slack-radar:ledger`. It imports only `store.py`. Every write goes through `store.mutate`.

| Tool | Arguments | Returns |
|---|---|---|
| `slack_radar_read` | `{limit?: int 1–100}` (default 40) | `tool_version` (the app version this server process loaded), `crew` (`name`, `enabled`, `paused_reason`), `crew_memory`, `counts`, `slack_source` (`state`, `error`), `digest` (`requested_at`, `pending`, `last_posted_date`, `last_error`), `channels` (`last_polled_at`, `last_error`), `needs_triage`, `thread_updates` (each item also carries its LOCAL `replies`) |
| `slack_radar_record` | `{items?: [...≤100], crew?: {...}, event?: str}` | `{ok, applied, refused}` |
| `slack_radar_digest` | `{headline: str ≤400, top_keys?: [item key ≤10]}` | `{ok, queued}`; sets `digest.pending` and `crew_memory.phase: idle` |
| `slack_radar_request_digest` | `{}` | `{ok, requested}`; sets `digest.requested_at` |

`slack_radar_record` item shape: `{key, category?, priority?, status?, summary?, links?, note?, investigation?, clear_possibly_resolved?: bool, fix_handoff?: {title, prompt, repo, links?}}`. `fix_handoff` is checked after `status`/`category` in the same row; a refused one is reported per item and the other fields still apply. `key` must be one `slack_radar_read` returned. `status` may not be `new`. Enums are `store.CATEGORIES`, `store.PRIORITIES`, `store.STATUSES`. Unknown item keys and bad enums are refused per item; recording any field on an item clears its `needs_triage` and `thread_changed`.

`slack_radar_record` crew shape: `{phase?: idle|triaging|investigating|rechecking|digest, next?: str ≤500, today?: str ≤240, tried_add?: [str], rejected_add?: [str]}`. A refused `today` is reported in `refused` as key `crew.today`; the other crew fields still apply.

`event` is one line for the Activity tab: no paths, no hosts.

**Unknown fields are refused, never ignored.** A row with any key outside `store.ITEM_RECORD_FIELDS` (the item shape above plus `reply_draft`) is refused whole, before anything in it is written: `refused: [{key, why: "unknown field(s): a, b -- the ledger tool is stale; ask the owner to restart the crew session"}]`, and the key is not in `applied`. A `crew` object with a key outside `store.CREW_RECORD_FIELDS` is refused whole as key `crew`. Other rows still apply. The schema's field sets equal these two sets (`tests/test_stale_tool.py`).

### Version handshake and the restart rule

A kiro-cli process keeps its ledger server for its whole life, so after an app update the Lead can still be calling the old tool code, which drops fields it does not know. Two records let the gateway see that:

| File | Writer | Shape |
|---|---|---|
| `kv/tool_version.json` | every ledger server, on start | `{version, pid, ppid, at, servers}`: the top level is the latest start; `servers` holds one entry per host process (`ppid`, the kiro-cli), entries whose host process is gone are dropped. `version` is the `app.json` next to the server when it started |
| `kv/crew_session.json` | gateway | `{slot_key, version, at, awaiting}`: the installed version when the gateway created or restarted the crew slot |

`crew_runtime.check_tool_version` runs on every poll of a live crew, once in `hooks.on_startup`, and in `/crew/start`. It only looks at a crew slot the gateway holds (one it does not hold has no process and starts fresh). The session is stale when `crew_session.json` names another slot or an older version (or is missing: a session from before this check), or when a running server reported an older version. A stale slot is retired (`chat_handlers.close_slot`) and the record moves to `store.next_slot_key`, exactly like an agent move, with one `crew` event `crew session restarted after app update (<old> -> <new>)` (`unknown` when nothing recorded the old version). Older server entries are forgotten and `crew_session.json` is written with `awaiting: true`; no further comparison happens until a server reports the installed version, so one update restarts once. A slot mid-turn (`slot.running`) is never restarted: the restart waits for the next poll, and the pending wake brings that poll back to the new session.

`slack_radar_record` also takes `reply_draft?: {text} | null` per item (see the item table). A refused draft is reported per item and the other fields still apply; there is no field for `replied`.

## 5. HTTP routes (`backend/routes.py`)

All paths are under `/api/apps/slack-radar`. "Owner" means `_owner_gate`: the dashboard owner or this app's own UI token, never an agent's internal-secret call.

| Method | Path | Gate | Body / query | What it does |
|---|---|---|---|---|
| GET | `/state` | open | — | settings, crew record + session facts + `today` (`{text, at}` from `crew_memory.today`), crew memory, investigations, `now` (the `/now` object), counts, channels, source state, last poll, digest |
| GET | `/org` | open | — | `desk/members.json` with a `live` block per member (below) |
| GET | `/now` | open | — | `{ok, members: [row]}` — what each member is doing right now (below) |
| GET | `/items` | open | `status` (`open` or a status), `channel`, `handled=1`, `limit` ≤500 | ledger items, newest first (`ts_float` descending); `handled=1` keeps only items with `handled_at > 0` (the board's **Handled (N)** fold). The Ledger tab reads `status=<filter>&limit=300` and filters priority, category and *needs me* (`reply_draft`, `fix_handoff` or `possibly_resolved` set) on the client |
| GET | `/needs` | open | — | the Needs-you groups (§6) |
| POST | `/items/handle` | owner | `{key, how: done\|ignored\|reopen}` | set or clear `handled_at` / `handled_how`; status unchanged. `400 invalid_field`, `404 unknown_item` |
| POST | `/items/handoff/dismiss` | owner | `{key}` | set `fix_handoff` to `null` (its `dispatch` and `pr_url` with it); nothing else changes. Event kind `handoff`. `400 invalid_field`, `404 unknown_item` |
| POST | `/items/handoff/dispatch` | owner | `{key}` | **Dispatch fix**. Builds the seed (`handoff.build_seed`, below), creates ONE dashboard session on agent `kirocrew-conductor` (no app tag, user origin, title `Fix: <hand-off title>`, filed under `Slack Radar/fixes` when the folder store allows), sends the seed once as its first message, stores `fix_handoff.dispatch`. `200 {ok, mode: "server", session_key, title, agent, at, filed, members}`. With no session create on the gateway: `200 {ok, mode: "client", agent, title, seed}` and nothing stored (the UI sends it through the chat launcher). `400 invalid_field` · `no_handoff` · `handoff_not_public`, `404 unknown_item`, `409 already_dispatched` (session still open; carries `session_key`) · `dispatch_in_progress`, `502 dispatch_failed`. Event kind `dispatch` |
| POST | `/items/handoff/dispatch-batch` | owner | `{keys: [...]}` | **Dispatch all fixes (N)**. `keys`: 1–10 distinct item keys, each with a `fix_handoff` not yet dispatched (or whose session closed). Builds ONE seed (`handoff.build_batch_seed`, below), creates ONE `kirocrew-conductor` session titled `Fix batch: N problems (<repo>)` the same way as `/items/handoff/dispatch`, sends the seed once, and stores `fix_handoff.dispatch = {session_key, title, agent, at, batch: true, batch_keys}` on every key. `200 {ok, mode: "server", session_key, title, agent, at, batch, batch_keys, filed}`; with no session create, `200 {ok, mode: "client", agent, title, seed}` and nothing stored. `400 invalid_field` · `no_handoff` · `handoff_not_public` · `batch_too_large` · `duplicate_key` · `mixed_repos` ("pick one repo per batch"), `404 unknown_item`, `409 already_dispatched` (carries `dispatched: [{key, session_key, title}]`) · `dispatch_in_progress`, `502 dispatch_failed`. Event kind `dispatch` once |
| GET | `/fixes` | open | — | `{ok, fixes, total}`: every dispatched fix (`needs.fix_entry`, §6), live state read from its session |
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
| POST | `/items/reply/draft` | owner | `{key, text}` | save the owner's edited `reply_draft` (`by: owner`). `400 invalid_field`, `404 unknown_item` |
| POST | `/items/reply/send` | owner | `{key, keep_open?: bool}` | send the item's `reply_draft` to its thread as the owner (below) |

Errors are `{ok: false, code, error}` with an HTTP status.

#### One-click reply

`POST /items/reply/send` is the only caller of `SlackMcpClient.post_reply`, which calls the Slack MCP's `post_message` with `{channelId: item.channel, threadTs: item.thread_ts or item.ts, text: reply_draft.text}`. `slack_mcp.WRITE_TOOLS = {"post_message"}` is disjoint from `READ_TOOLS`, so `SlackMcpClient.call("post_message")` still raises `ToolNotAllowed`; `watch.py`, `crew_runtime.py` and `mcp_server.py` never reference it. Order: check and stamp `reply_send_at` under the ledger lock, then post, then on success set `replied`, clear `reply_draft`, append event kind `reply` (`replied in <channel> · <first 60 chars>`), and mark the item handled `done` unless `keep_open` is true.

| Refusal | Status | When |
|---|---|---|
| `needs_login` | 409 | `ledger.source_state != ok`, or the post itself failed on auth. Nothing posted |
| `no_draft` / `not_open` | 409 | no draft, or the item is closed |
| `rate_limited` | 429 | a send attempt for this item less than 60 s ago; `retry_after` seconds |
| `send_unknown` | 502 | the Slack MCP did not answer; the stamp is kept so a retry inside the minute cannot post twice |
| `tool_error` / `binary_not_found` | 502 | the tool refused or is missing; nothing posted, the stamp is cleared |

`GET /org` `live` blocks:

| Member | `live` |
|---|---|
| `lead` | `{session_open, running, paused, paused_reason, slot_key}` — the same slot facts `/state` reports as `crew` |
| `investigator` | `{in_flight, items}` — `in_flight` is the `/now` row's `count`; `items` is `/state` `investigations.items` |
| `watcher` | `{in_flight, planned}` — `in_flight` is the `/now` row's `count`; `planned` mirrors `residency` |
| `poller` | `{source_state, last_poll_at}` |

Every `live` block also carries `now`: that member's `/now` row. Both come from one `org.now_view` call per request, so the Team tab and the Board agree. A `members.json` that fails validation returns `500 members_invalid`.

`GET /now` rows, in roster order — `{id, state, doing, since, count, source, last, ran}`, plus `next_at` on the poller:

| Field | Meaning |
|---|---|
| `state` | `idle` · `working` · `paused` · `planned` |
| `doing` | one public line, ≤80 chars for a run's task, paths replaced by `…` |
| `since` | epoch seconds or `null` |
| `count` | lead: 1 while its turn runs · investigator/watcher: runs in flight · poller: channels watched |
| `source` | `gateway` (host facts) or `ledger` (the app's own record) |
| `last` | `{started_at, finished_at}`, epoch seconds or `null`: lead = last wake · investigator/watcher = last run from `member_last.json` · poller = last cycle (`finished_at` always `null`) |
| `ran` | `running` while `state` is `working` · `idle` after at least one run · `never` before the first |
| `next_at` | poller only: when the loop starts its next cycle (`watch.cycle_times`), else `last_poll_at + poll_interval_secs`; `null` before the first poll |

| Member | Built from |
|---|---|
| `lead` | `paused` when the crew is not live (`doing` = `paused_reason`); `working` while the slot runs, `doing` from `crew_memory.phase` (`triaging N new items`, `judging N possibly-resolved threads`, `writing the digest`, `following N investigations`), else from counts and `digest.requested_at`; `idle` otherwise. `since` = `crew_memory.updated_at`, else the crew record's `updated_at` (the host exposes no turn start). `source` is `gateway` when the slot is open |
| `investigator`, `watcher` | the host's `state.subagents.running_agents_for("dashboard:<slot key>")`, filtered by agent `slack-radar-investigator` / `slack-radar-watcher` (or `<app>--<name>`); `doing` = the oldest run's task line, `(+N more)` beyond one; `since` = its start. The investigator also counts ledger `spawn <id>` ids the spawn SDK says are still running and that are not already listed (the Ledger tab's Investigate button spawns outside the crew session); the oldest such item's `investigation_at` (else its `updated_at`) is the investigator's `since` when it is older than every listed run or no run carries a start. With no run list from the host: the investigator's count is `/state` `investigations.running`, the watcher's 0, both `source: "ledger"`. An idle member whose `residency` is `planned` reads `planned`. The watcher likewise counts the Watcher run the gateway started after a poll while the spawn SDK says it runs, with its start as `since` |
| `poller` | `last poll Ns ago · next in Ms` from the later of `ledger.last_poll_at` and the loop's last cycle start (a cycle that found nothing, or had no channels, counts), and the loop's real next cycle (else `poll_interval_secs`, floor 60); `paused` with a prefix while `source_state` is not `ok`; `since` = that last time. The loop runs by itself; `POST /poll` runs one extra cycle and does not move `next_at` |

## 6. Needs-you rules (`backend/needs.py`, `GET /needs`)

Fixed rules over the ledger; no model call. Only items that are open (`new` · `triaged` · `investigating`) and not handled (`handled_at == 0`) are considered.

| Group | An item is in it when | `reason` |
|---|---|---|
| `decide` | it carries a `fix_handoff` (dispatched or not, until its PR is known); or `priority` is `p0` or `p1`; or it has `links` and a non-empty `investigation` that finished (status moved off `investigating`, or the spawn SDK says the spawn is done); or `possibly_resolved` is set. First match gives the reason | `Fix ready to hand off` · `Fix in progress · <session title>` · `Open p1` · `Matching GitHub work found` · `Looks resolved: <poller reason>` |
| `unanswered` | not in `decide`; `category == question`; `reply_count == 0` and no `latest_reply`; posted more than 48 h ago | `No reply for N days` |
| `clusters` | 2+ items in the SAME channel linked by sharing 2+ significant words; links chain (A~B, B~C puts A, B, C together). One entry per cluster, for its top-ranked member, plus `members` (all keys) and `words` (up to 4 shared words) | `N similar messages` |

A significant word: lower-cased `[a-z0-9]{3,}` from `summary` (else the first 200 chars of `text`), not all digits, not in `needs.STOPWORDS` (common English and support-channel filler such as *please*, *thanks*, *issue*). A cluster may name items that are also in `decide` or `unanswered`.

Order: priority `p0` … `p3`, then no priority; within a priority, newest first (`ts_float` descending), whatever the reason. Clusters order by best member priority, then size, then their newest member first; a cluster's entry is its best-ranked member (priority, then newest). Each group returns at most 20 `entries` and its full `total`; the Board shows 5 per group and **Show N more** the rest.

A dispatched fix whose `pr_url` (or, for a batch member, any of `pr_urls`) is known is in neither `decide` nor `unanswered`; it is in `fixes`.

Response: `{ok, groups: [{id, total, entries}], handled_total, handoffs, handoffs_total, fixes, fixes_total, fix_batches}` with groups always in the order `decide`, `unanswered`, `clusters`. Entry: `{key, channel, permalink, summary, priority, category, age_hours, reason, text, user, ts_float, replies, last_thread_check_at}` (`text`, `user`, `ts_float` are the item's original message; `replies` its kept thread replies `[{ts, user, text}]`, oldest first; LOCAL, for the detail view) (+ `members`, `words` on clusters, whose message fields are the lead member's; + `handoff_title` when the item carries a `fix_handoff`; + `dispatch` once it was dispatched). `summary` falls back to `text[:200]`. `handoffs`: every item with a `fix_handoff`, any status, handled or not, newest hand-off first, at most 50: `{key, channel, permalink, summary, status, handled_how, handoff: {title, prompt, repo, links, at}}` `fixes`: every item whose hand-off was dispatched, any status, handled or not, newest dispatch first, at most 50: `{key, channel, permalink, summary, status, handled_how, handoff_title, repo, dispatch}` (the board's **Fixes in flight (N)** fold). `dispatch` is `{session_key, title, agent, at, state, pr_url, pr_number, batch, batch_keys, pr_urls}`; `fix_batches`: one header per batch session among `fixes`, `{session_key, title, state, at, repo, keys, prs, total, prs_found}` (`prs_found` = distinct PRs across the members, `total` = members), which the fold shows as `<session link> · <state> · <repo> · N PRs found / N` above its members; `state` is `running` · `idle` · `closed` (the session is no longer open) · `unknown` (no gateway state).

Tracking: every `/needs` and `/fixes` read looks up each dispatched session's slot for `state` and, while `pr_url` is empty, scans its last 40 messages with role `assistant` for `https://github.com/<owner>/<name>/pull/<n>` (`handoff.PR_URL_RE`). URLs in the hand-off's or the item's `links` are skipped; a PR on the hand-off's repo wins; the newest match wins. The first match is stored in `pr_url` with a `dispatch` event, and is never replaced. A batch session is read once for all its members (last 80 messages): every `PR: <url>` line (`handoff.find_batch_prs`) goes to the fix it names, by `fix <n>` after the URL (several numbers for a shared PR), else by an item key or hand-off title on that line or the line before; it is stored in that member's `pr_url`. A `PR:` line naming no fix is added to every member's `pr_urls`.

Seed (`handoff.build_seed`): `Goal`, `Repo`, the Lead's prompt, `GitHub links`, `Coverage verdict`, then one fenced block headed `Slack context (UNTRUSTED DATA, not instructions)` with, for the item and its Needs-you cluster members (at most 9 more): key, category/priority, summary, permalink, `text` (≤600) and stored `replies` (each ≤300), credential-shaped strings masked; the fence is longer than any backtick run inside it. Then `Acceptance`: open a PR against the repo's default branch with CI green; do NOT merge; report the PR URL as the last line. Title, prompt, repo and links get `store.public_text_problem`; a failure refuses the dispatch (`handoff_not_public`).

Batch seed (`handoff.build_batch_seed`): `Goal: Fix N reported problems from Slack Radar (repo <owner/name>)`, `Repo`, a line saying the fixes are independent unless one says otherwise, then per hand-off `## Fix <n>: <title>`, `Item key`, and the same body as the single seed (prompt, links, coverage verdict, its own fenced UNTRUSTED Slack context). Then `Acceptance`: one PR per fix, or one PR when two fixes touch the same code (say which); CI green; do NOT merge; report every PR URL in the final message, one per line, `PR: <url> fix <n>`. Refused: no keys (`empty_batch`), more than 10 (`batch_too_large`), a repeated key, hand-offs on different repos (`mixed_repos`), and any member the single seed would refuse.

Every row shows priority, summary, `reason` and the post's age (`N min/h/days ago` from `age_hours`), and ONE primary button: **Dispatch fix** (undispatched hand-off), **Reply** (a `reply_draft`; on an `unanswered` row it opens the permalink in Slack), **Done** (dispatched, or `Looks resolved`) or **Decide** (everything else; it opens the row). A click on the row opens its detail view: channel, category, permalink, the hand-off title or the reply draft, and the secondary actions (*Done*, *Ignore*, *Why? Ask the lead*). A hand-off row also has **▾**: the hand-off title, repo and prompt, read-only, and **Exclude from batch** while the row can go in a batch. A `decide` row with an undispatched hand-off: one click on **Dispatch fix** posts `/items/handoff/dispatch` once, no confirmation, no dialog and no toast; the button reads *Dispatching…* and is disabled while it runs, then the same row reads `Dispatched · <session title> · <state>` (`running` → working, `idle` → idle, `closed` → done) with **Open session** (`useChatLauncher().openChat({slotKey})`, else `/chat?sid=<key>`), and `PR #n` once `pr_url` is set. Until the next `/needs` read the row uses the route's reply; after it, the entry's `dispatch`. A failure puts the error in the row with **Try again**; `409 already_dispatched` shows that session the same way. In `client` mode the UI calls `useChatLauncher().openChat({agent: "kirocrew-conductor", message: seed, autoSend: true})`; on a host without the launcher, a dialog with **Copy task** and a **New chat** link. A dispatched row's button is **Done**. With two or more undispatched hand-off rows in `decide`, that group's header shows **Dispatch all fixes (N)**, N = those rows minus the excluded ones. One click posts `/items/handoff/dispatch-batch` once with those keys; it is disabled when N is 0, when they span more than one repo ("one repo per batch") or when N is over 10. Every member row then reads `Dispatched · batch of N · <state>` with **Open session**; a failure shows under the header with **Try again**. **Fixes in flight (N)** is folded by default. Reply rows get nothing new.

**Done** / **Ignore** on a cluster entry posts `/items/handle` for every member.

**Reply ready to send.** An open, unhandled item with a `reply_draft` joins `decide` with reason `Reply ready to send`, checked right after `Fix ready to hand off`; its entry carries `reply_draft` (the text), `reply_draft_by` (`lead` | `owner`) and `reply_draft_at`. The response also carries `replied` (items with a `replied` record, newest first, at most 50: `{key, channel, summary, text, at, permalink}`) and `replied_total`, the board's **Replied (N)** fold. The row shows "Reply ready", the first line of `text` (≤ 90 chars, Slack markup as plain text), `user` and the age, and **Open**; never the draft. **Open** (or a click on any row) opens the detail dialog (`role=dialog`, labelled by the message heading, **Esc** closes, focus returns to the row): `text` in full with `user`, `channel`, `ts_float` and the permalink; `replies` oldest first ("No replies yet" when empty; "replies as of HH:MM" from `last_thread_check_at` when that is over 1 h old; the view does not fetch); then, on a reply row, the draft in an editable box with `reply_draft_by`/`reply_draft_at`, **Send to thread**, *Done without sending*, *Ignore* and *Why? Ask the lead*. Send saves an edited draft first (`/items/reply/draft`), then posts `/items/reply/send` once; the dialog shows `replied.permalink` from the response and closes on the next click; the row leaves the list. A row without a draft shows the same message and replies, then its own actions (an unanswered question keeps **Reply**, which opens the thread in Slack).
