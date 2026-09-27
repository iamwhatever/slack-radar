# Unattended mode: what it covers

Unattended mode is a `SafetyOverride` scoped grant (`crew:slack-radar:autoapprove`, 900 s, SEL-audited) that the app puts on the crew's own dashboard slot as `slot._trust_scope`. It never sets the interactive `slot._trust` flag. This page traces where that grant is read by Kiro Crew, and so what it does and does not approve.

## The chain

| Step | Where | What happens |
|---|---|---|
| Toggle | `backend/routes.py` `_handle_crew_update` | `PUT /crew {"unattended": bool}` writes `crew.json`, then calls `sync_trust` |
| Grant | `backend/crew_runtime.py` `sync_trust` | `unattended AND live` activates or renews the scoped grant and sets `slot._trust_scope`; anything else deactivates it and clears the slot field. Called on every poll (`after_poll`), before and after every wake (`wake_crew`), and revoked on shutdown (`backend/hooks.py`) |
| Crew's own tools | Kiro Crew `dashboard/chat_runner.py` `_slot_is_trusted` | A permission request in the crew's own session is approved when `slot._trust_scope` names a live scope. Re-checked per request, never renewed there, so a lapsed grant makes the next request prompt |
| Stored session policy | Kiro Crew `dashboard/chat_runner.py` `_persistable_session_policy` | Writes `"auto"` for `_trust` or YOLO only. A scoped grant is excluded on purpose, because a cached `"auto"` would outlive it |
| Crew spawns the Investigator | Kiro Crew `subagent_manager/admission/gate.py` (`parent_trusted`) | The spawn is auto-approved only when the parent's stored policy is `"auto"` (or YOLO, or the `auto_approve_subagent_spawn` hook). Otherwise it goes to the interactive spawn prompt |
| Investigator's commands | Kiro Crew `subagent_manager/run.py` (`parent_policy`) and `slack/gateway.py` `_interactive_approval` | The child is auto-approved only by the parent's stored `"auto"` policy, YOLO, the `auto_approve_subagent_tools` hook, or the parent slot's `_trust` flag. `_trust_scope` is never read on this path. Unanswered prompts are rejected after `_APPROVAL_TIMEOUT` (7200 s) |
| Board Investigate button | `backend/routes.py` `_handle_investigate` and Kiro Crew `apps/spawn_sdk.py` | The app spawn SDK always spawns with `approval_mode="auto"`, so every command of that run is approved. The route therefore refuses unless `unattended` is on |

The LLM-facing `spawn_run` tool cannot ask for `approval_mode`: the internal spawn route (`dashboard/handlers/messaging.py`) takes it only as a transport parameter from the SDK.

## Result

- The Radar Lead's tools are all in `allowedTools`, so its session never prompts and the grant adds nothing there.
- An Investigator the crew spawns prompts for the spawn and for each command, with or without unattended mode.
- A Thread Watcher the crew spawns prompts for the spawn only: its one tool, the ledger, is in its own `allowedTools`, so its session never asks again.
- An Investigator started from the board runs fully auto-approved, and only while unattended mode is on.

## What would make the grant reach the Investigator

Either of these, both outside this app today:

1. **Core: let a spawn_run child consult the parent slot's scoped grant per request.** In `slack/gateway.py` `_interactive_approval`, the parent-slot check reads `_ps._trust` only; reading the same predicate as `chat_runner._slot_is_trusted` (which re-checks `is_scope_active` on every call) would let a live scope approve the child's request and a lapsed one fall through to the prompt. The spawn gate in `admission/gate.py` would need the same per-request check instead of the stored policy. The stored policy must stay scope-free, for the reason `_persistable_session_policy` gives.
2. **App: run the Investigator as a native kiro-cli sub-agent (`use_subagent`) instead of `spawn_run`.** Native children's permission requests arrive in the parent's own session, where `_native_crew_should_auto_approve` and `_slot_is_trusted` apply the scoped grant per request. This needs `toolsSettings.subagent.availableAgents: ["slack-radar-investigator"]` and must not list it in `trustedAgents`, which would approve its commands unconditionally. It changes the investigation protocol: a native child runs inside the crew's turn, so the brief's "at most two in flight" background model and the spawn-id bookkeeping in the ledger and roster would have to change, and it has not been probed on a live gateway.
