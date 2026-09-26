# Slack Radar × Travel Desk: restyle proposal

Reference: [chenmingwei23/kiro-crew-travel-desk](https://github.com/chenmingwei23/kiro-crew-travel-desk) v1.4.1, read at `README.md`, `app.json`, `desk/CHARTER.md`, `desk/CONTRACT.md` §0–§8, `desk/members.json`, `backend/slots.py`, `backend/routes.py` (`/org`, `/run`), `ui/parts.mjs`, `ui/theme.mjs`, `ui/i18n.mjs`, `agents/trip-tour-leader.json`, `agents/prompts/README.md`, `skills/travel-desk/SKILL.md`, `scripts/build_agents.py`.

Proposal only. No product code, `app.json` or README changes in this PR.

## (a) Gap table

| Dimension | Travel Desk | Slack Radar today | Gap / proposal |
|---|---|---|---|
| Crew shape / layers | 13 agents in 3 layers: leader → 3 resident managers → 9 leaves. Org tree is in the charter. | 2 agents: one conductor (`slack-radar-crew`) + one leaf (`slack-radar-investigator`). The zero-LLM poller does the I/O. | The work doesn't need 3 layers. Add one honest leaf (Thread Watcher), and name the layers in a roster. |
| Resident vs leaf members | Leader in a fixed app slot. Managers are resident sessions the leader opens with `@kirocrew-dashboard` `session_create`/`session_send`, filed in a "Travel Desk" folder. Leaves via `spawn_run`. | Conductor is a resident app-owned slot created by the backend (`ensure_crew_session`, agent-checked, generation key). Investigator is a leaf via SpawnSDK / `spawn_run`. | Keep the backend-owned resident. Don't give the lead `@kirocrew-dashboard`: no second resident is justified, and session tools are a wide surface for an agent reading untrusted text. |
| How the user talks to the crew | `ChatEmbed` card on the app page, with example chips. Clicking any roster member swaps the card to that member's slot. `onSend` steers a running turn. | No on-page chat. The user must find the `crew-slack-radar[-gN]` tab in the sidebar. The Board only shows phase/next. | **Biggest gap.** Add a lead chat card that embeds the current `slot_key` from `/state`. Leaves are read-only in the card (they have no slot). |
| Team page | `/org` joins `members.json` with live slots (`slots.py`). Rows are grouped by layer with a state badge. The workbench rail folds idle members into "N standing by". | None. Crew status is one line on the Board. | Add a Team tab fed by `/org`: `members.json` + `/state` + open spawns (`spawn_list`). |
| Charter / contract vs crew_brief | CHARTER (org, chain, sentinels, memory rules) and CONTRACT (fixed names, file formats, members.json schema, app API). Agents re-read the charter every session. | `crew_brief.md` (protocol), injected by presence check after compaction or restart, plus `crew_ledger_spec.md` (field-level contract). | Slack Radar's injection is stronger than "read it yourself". Keep it. Add a short CHARTER (roster, who spawns whom, public vs local fields). Fold `crew_ledger_spec.md` + the route list into a CONTRACT. |
| Skill hand-off | `skills/travel-desk` with EN/中文 triggers. The default assistant posts into the leader slot via `POST /api/chat`. | No skill (the scaffold sample was deleted). | Add `skills/slack-radar`. It points the user to the page, and can POST a question to the lead's current slot. It must not start triage itself. |
| i18n | `ui/i18n.mjs` (EN/中文, ~260 keys), bilingual `members.json`, EN + 中文 halves of the README. Content language follows the request. | English only. | Phase 1: bilingual README. Phase 3: UI strings. Digest language follows a setting, not the Slack text. |
| README shape | Pitch → "How a trip is made" → install → first run → usage → team table → config → background work → troubleshooting → layout → screenshots, then the same in 中文. | Pitch → architecture mermaid → screenshots → quick start → tabs → how it works → security → scope cuts → dev → structure. EN only. | Add a "The team" table and a "What runs in the background" section, then a 中文 mirror. Keep the mermaid and security sections (TD has neither). |
| Model pinning | Every agent pins `gpt-5.6-sol`. | `model: "auto"` on both agents, with a per-crew override in Settings. | Don't pin a vendor model in a public app. Add per-member model overrides on the Team tab later. |
| Unattended approval policy | Every agent has `allowedTools: ["*"]` with `execute_bash` (`autoAllowReadonly`), `fs_write`, `web_fetch`, `@kirocrew-dashboard`, and `includeMcpJson: false`. The traveller's own request is the only input. | Narrow allowlists: the lead auto-approves only the ledger and `spawn_*`; no shell, no file writes. The ceiling strips `fs_read`/`grep`/`glob`. Investigator `allowedTools: []`. Unattended mode is an opt-in, 15-min SEL-audited scoped grant. | Keep ours (see §d). TD has no background loop; Slack Radar has an event-driven poller with zero idle cost. Keep that too. |

What Slack Radar already does better, and should keep: brief re-injection by presence check, event-driven wakes (no idle turns), backend-owned resident slot with agent-mismatch healing, a vault-held settings authority, and read-only Slack access through an allowlisted MCP client.

## (b) Proposed roster (honest to the work)

| Member | Layer | Kind | Agent | New? | Why it exists |
|---|---|---|---|---|---|
| **Radar Lead** | lead | resident, app slot `crew-slack-radar[-gN]`, on-page chat card | `slack-radar-crew` | **renamed** (today's crew) | Triage, priority, cluster decisions, digest headline, talking to the owner. |
| **Thread Watcher** | review | **leaf** (`spawn_run`) | `slack-radar-watcher` | **new** | Judges `possibly_resolved` threads in a batch: reads each thread reason and recent replies, then proposes resolved / keep open with a reason. It keeps no state between runs (the ledger does), so a resident session would just idle. Spawned only when ≥5 flags are pending; below that the lead judges inline as it does now. |
| **Investigator** | research | leaf (`spawn_run` / SpawnSDK) | `slack-radar-investigator` | exists | Read-only `gh search` to link clusters to issues/PRs. |
| Poller | system | code, no model | none | exists (shown, not an agent) | Shown greyed on the Team tab so the user can see what runs without a model: cursor reads, thread re-checks, digest delivery. |

**Digest Writer: not a member.** The digest is one `slack_radar_digest` call (headline + top keys). The gateway renders and delivers it. A separate agent would add a spawn per day for a two-sentence judgement the lead already holds in context. It stays a lead duty and is shown as such in the lead's Team row.

No resident managers: nothing here runs long, multi-stage work that a second resident would own. Inventing Planner/Risk-style layers would be for show.

## (c) Changes by file group

- **`agents/`**:
  - `slack-radar-crew.json`: prompt names the member "Radar Lead".
  - New `slack-radar-watcher.json`: tools `@slack-radar:ledger`, `thinking`; allowedTools `@slack-radar:ledger`; no shell.
  - Optional: `agents/prompts/*.md` + `scripts/build_agents.py`, following TD's `.md` → JSON inline pattern with a drift test.
- **`desk/`** (new): `CHARTER.md` (roster, spawn rules, public/local fields, what never goes to Slack), `CONTRACT.md` (fixed names, ledger schema absorbed from `crew_ledger_spec.md`, routes), `members.json` (TD schema: `id`, `title[_en]`, `duty[_en]`, `layer`, `resident`, `slot_hint`, `agent`).
- **`backend/`**:
  - `routes.py`: `GET /org` joins `members.json` + `/state` + `spawn_list`.
  - `crew_brief.md`: the Thread Watcher spawn rule.
  - `crew_runtime.py` and `store.py`: unchanged.
- **`ui/`**:
  - Lead chat card via the SDK `ChatEmbed`, with `slotKey` from `/state.crew.slot_key` and `onSend` steering a running turn.
  - Team tab.
  - Roster strip on the card.
  - Later: `i18n` keys.
  - Stays React + Vite (we already ship `ui/dist`). TD's no-bundler ESM is not a goal in itself.
- **`skills/slack-radar/SKILL.md`** (new): triggers "slack triage", "what's new in #…", "Slack 汇总/分诊"; hand-off only.
- **`README.md`**: team table, "What runs in the background", 中文 half.
- **`app.json`**: add the watcher agent and the skill. Permissions unchanged (no `/api/chat` grant needed: the embed uses the host SDK).

## (d) What we deliberately do NOT copy

- **`allowedTools: ["*"]` and a shell on every agent.** TD's agents act on one trusted person's sentence. Slack Radar's lead reads text anyone in a channel can write. With `*` plus `execute_bash`/`fs_write`/`web_fetch`, one crafted Slack message can steer an unreviewed command or exfiltration. We keep a per-tool allowlist, no shell on the lead or the watcher, and the investigator's `execute_bash` always prompting unless the owner opts into the scoped, expiring unattended grant.
- **`includeMcpJson: false` + agent-created resident sessions (`@kirocrew-dashboard`).** Our resident slot is created and agent-checked by the backend. Giving the lead session-create/send tools would let an injected message open or drive other sessions.
- **Vendor model pins.** They break on installs without that model.
- **`setup.onInstall` shell scripts.** We have nothing to provision; a manifest shell hook widens the trust ask.
- **"Kitchen talk is hidden" as an absolute rule.** TD hides all machinery from a travel guest. Our user is the operator: showing phase, next step, spawn ids and "needs re-login" is the point of the board.

## (e) Phased plan

1. **Phase 1:**
   - On-page Radar Lead chat card with a roster strip.
   - Team tab (static roster from a constant + live `/state` + `spawn_list`).
   - Bilingual README with a team table.
   - No agent changes except the display name.
2. **Phase 2:**
   - `desk/CHARTER.md` + `CONTRACT.md` + `members.json`.
   - `GET /org`.
   - Thread Watcher leaf + brief spawn rule.
   - `skills/slack-radar`.
   - Agent-prompt `.md` sources with a drift test.
3. **Phase 3:**
   - i18n UI (EN/中文): digest-language setting, bilingual `members.json` duties, language toggle in the header.

## Mockups

`design/mockups/*.html` (self-contained, KiroCrew dark tokens, fake data) and PNGs at 1280×900 (`node design/mockups/shoot.mjs`). The language toggle reads "ZH" in the PNGs because the headless Chromium has no CJK font; the real toggle label is "中文".

- **A, board-first** (`a-board-first.png`): TD's default. Board on the left; sticky lead chat card on the right with a roster strip (RL / TW / IN / poller).
- **B, workbench-first** (`b-workbench-first.png`): the conversation fills the page. Crew rail on the left with "working now" and a "2 more standing by" fold; Board as a right drawer.
- **C, digest-first** (`c-digest-first.png`): today's digest as the hero, ledger table below, lead chat as a floating corner card.

## Recommendation: Option A (board-first)

Slack Radar's value is the triaged ledger the owner scans in seconds, so the board must stay the first thing on screen. A right-hand chat card adds the conversation without demoting it, and it is TD's proven layout.

B suits a crew you steer continuously, which a mostly unattended radar is not. C's hero is empty until the day's digest exists, so borrow its digest card as a Board section instead.
