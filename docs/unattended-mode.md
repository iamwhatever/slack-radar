# Unattended mode: what it covers

Unattended mode is a `SafetyOverride` scoped grant (`crew:slack-radar:autoapprove`, 900 s, SEL-audited) that the app puts on the crew's own dashboard slot, and on the conductor sessions the owner dispatches, as `slot._trust_scope`. It never sets the interactive `slot._trust` flag. This page traces where that grant is read by Kiro Crew, and so what it does and does not approve.

Risk: Slack text that anyone in a watched channel can write reaches an agent with a shell. While unattended mode is on, a crafted message could steer an Investigator command nobody reviews. Turn it on only when every watched channel is trusted.

## The chain

| Step | Where | What happens |
|---|---|---|
| Toggle | `backend/routes.py` `_handle_crew_update` | `PUT /crew {"unattended": bool}` writes `crew.json`, then calls `sync_trust` |
| Grant | `backend/crew_runtime.py` `sync_trust` | `unattended AND live` activates or renews the scoped grant and sets `slot._trust_scope`; anything else deactivates it and clears the slot field. Called on every poll (`after_poll`), before and after every wake (`wake_crew`), and revoked on shutdown (`backend/hooks.py`). Because every poll renews it, the grant is continuous while the toggle is on, not a one-off window |
| Crew's own tools | Kiro Crew `dashboard/chat_runner.py` `_slot_is_trusted` | A permission request in the crew's own session is approved when `slot._trust_scope` names a live scope. Re-checked per request, never renewed there, so a lapsed grant makes the next request prompt |
| Stored session policy | Kiro Crew `dashboard/chat_runner.py` `_persistable_session_policy` | Writes `"auto"` for `_trust` or YOLO only. A scoped grant is excluded on purpose, because a cached `"auto"` would outlive it |
| Crew spawns the Investigator | Kiro Crew `subagent_manager/admission/gate.py`, then `slack/gateway.py` `_interactive_approval` | The stored policy is not `"auto"`, so the spawn goes to the gateway's approval callback. Since core kirodotdev/KiroCrew#14497 that callback checks the parent slot's live scoped grant per request, so the spawn is auto-approved while the grant is live and prompts once it lapses |
| Investigator's commands | Kiro Crew `subagent_manager/run.py` (`parent_policy`) and `slack/gateway.py` `_interactive_approval` | The same callback: each child command is auto-approved while the parent slot's scoped grant is live, and logged as `subagent.trust_scope_auto_approve` in SEL. A child request the gateway cannot verify still needs a human. With the grant off, prompts are rejected after `_APPROVAL_TIMEOUT` (7200 s) |
| Chat trust menu | Kiro Crew dashboard chat header | The header shows the slot as trusted while the grant is live. Picking **Normal** ends the grant, but the next poll arms it again while the app's toggle is on |
| Thread Watcher after a poll | `backend/crew_runtime.py` `dispatch_watcher` and Kiro Crew `apps/spawn_sdk.py` | The gateway spawns one Watcher run per poll through the app spawn SDK (`approval_mode="auto"`) in either mode. Its only tool is the ledger, already in its own `allowedTools`, so nothing beyond ledger writes is approved |
| Dispatch fix | `backend/routes.py` `_handle_handoff_dispatch*`, `backend/dispatch.py` `open_session`, `backend/crew_runtime.py` `dispatch_grant` | The owner's click is the consent. When `unattended AND live`, the grant is activated or renewed and the new conductor slot gets `slot._trust_scope` before its seed is queued, so its first tool call is covered. Otherwise the slot stays untrusted and the reply says `trusted: false, why` |
| Dispatched sessions every poll | `backend/crew_runtime.py` `sync_dispatch_trust`, called from `after_poll` and `_handle_crew_update` | Every open session named by a `fix_handoff.dispatch.session_key`, plus the workers the gateway minted for it in this process (`_lineage_minted` with `_created_by` naming it, three generations deep), gets `slot._trust_scope` while `unattended AND live`, and loses it otherwise. Closed sessions are skipped. `revoke` (pause, disable, shutdown) clears it on all of them |
| Board Investigate button | `backend/routes.py` `_handle_investigate` and Kiro Crew `apps/spawn_sdk.py` | The app spawn SDK always spawns with `approval_mode="auto"`, so every command of that run is approved. The route therefore refuses unless `unattended` is on |

The LLM-facing `spawn_run` tool cannot ask for `approval_mode`: the internal spawn route (`dashboard/handlers/messaging.py`) takes it only as a transport parameter from the SDK.

## Claim vs real

| Claim | Real (unattended on) | Real (unattended off) |
|---|---|---|
| The Radar Lead never prompts | True: its tools are all in `allowedTools`; the grant adds nothing there | True, same reason |
| An Investigator the crew spawns asks for the spawn and each command | False: the spawn and every shell command are auto-approved and SEL-audited (about 68 auto-approved Investigator commands on 2026-09-28) | True: the owner approves the spawn and each command |
| A Thread Watcher asks for nothing | True: the gateway starts it through the spawn SDK; its one tool, the ledger, is in its own `allowedTools` | True, same reason |
| An Investigator started from the board runs fully auto-approved | True | Refused (`unattended_required`) |
| A dispatched conductor asks for each tool | False: it rides the grant from its first message, and every tool call is auto-approved while the grant is live | True: it asks for each tool, and the row says so |
| Workers the conductor opens ask for each tool | False from the next poll after they open (until then they ask); a worker opened before a gateway restart still asks, because its parent link then comes from an agent-editable transcript | True |
| Picking Normal in the chat turns unattended mode off | Only until the next poll re-arms the grant; the app's toggle is the durable off switch | Nothing to turn off |
