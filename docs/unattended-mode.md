# Unattended mode: what it covers

Unattended mode is a `SafetyOverride` scoped grant (`crew:slack-radar:autoapprove`, 900 s, SEL-audited) that the app puts on the crew's own dashboard slot as `slot._trust_scope`. It never sets the interactive `slot._trust` flag. This page traces where that grant is read by Kiro Crew, and so what it does and does not approve.

Risk: Slack text that anyone in a watched channel can write reaches an agent with a shell. While unattended mode is on, a crafted message could steer an Investigator command nobody reviews. Turn it on only when every watched channel is trusted.

## The chain

| Step | Where | What happens |
|---|---|---|
| Toggle | `backend/routes.py` `_handle_crew_update` | `PUT /crew {"unattended": bool}` writes `crew.json`, then calls `sync_trust` |
| Grant | `backend/crew_runtime.py` `sync_trust` | `unattended AND live` activates or renews the scoped grant and sets `slot._trust_scope`; anything else deactivates it and clears the slot field. Called on every poll (`after_poll`), before and after every wake (`wake_crew`), and revoked on shutdown (`backend/hooks.py`). Because every poll renews it, the grant is continuous while the toggle is on, not a one-off window |
| Crew's own tools | Kiro Crew `dashboard/chat_runner.py` `_slot_is_trusted` | A permission request in the crew's own session is approved when `slot._trust_scope` names a live scope. Re-checked per request, never renewed there, so a lapsed grant makes the next request prompt |
| Stored session policy | Kiro Crew `dashboard/chat_runner.py` `_persistable_session_policy` | Writes `"auto"` for `_trust` or YOLO only. A scoped grant is excluded on purpose, because a cached `"auto"` would outlive it |
| Crew spawns the Investigator or Watcher | Kiro Crew `subagent_manager/admission/gate.py`, then `slack/gateway.py` `_interactive_approval` | The stored policy is not `"auto"`, so the spawn goes to the gateway's approval callback. Since core kirodotdev/KiroCrew#14497 that callback checks the parent slot's live scoped grant per request, so the spawn is auto-approved while the grant is live and prompts once it lapses |
| Investigator's commands | Kiro Crew `subagent_manager/run.py` (`parent_policy`) and `slack/gateway.py` `_interactive_approval` | The same callback: each child command is auto-approved while the parent slot's scoped grant is live, and logged as `subagent.trust_scope_auto_approve` in SEL. A child request the gateway cannot verify still needs a human. With the grant off, prompts are rejected after `_APPROVAL_TIMEOUT` (7200 s) |
| Chat trust menu | Kiro Crew dashboard chat header | The header shows the slot as trusted while the grant is live. Picking **Normal** ends the grant, but the next poll arms it again while the app's toggle is on |
| Board Investigate button | `backend/routes.py` `_handle_investigate` and Kiro Crew `apps/spawn_sdk.py` | The app spawn SDK always spawns with `approval_mode="auto"`, so every command of that run is approved. The route therefore refuses unless `unattended` is on |

The LLM-facing `spawn_run` tool cannot ask for `approval_mode`: the internal spawn route (`dashboard/handlers/messaging.py`) takes it only as a transport parameter from the SDK.

## Claim vs real

| Claim | Real (unattended on) | Real (unattended off) |
|---|---|---|
| The Radar Lead never prompts | True: its tools are all in `allowedTools`; the grant adds nothing there | True, same reason |
| An Investigator the crew spawns asks for the spawn and each command | False: the spawn and every shell command are auto-approved and SEL-audited (about 68 auto-approved Investigator commands on 2026-09-28) | True: the owner approves the spawn and each command |
| A Thread Watcher the crew spawns asks only for the spawn | False: the spawn is auto-approved; its one tool, the ledger, is in its own `allowedTools` | True |
| An Investigator started from the board runs fully auto-approved | True | Refused (`unattended_required`) |
| Picking Normal in the chat turns unattended mode off | Only until the next poll re-arms the grant; the app's toggle is the durable off switch | Nothing to turn off |
