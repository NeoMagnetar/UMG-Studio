# Hermes UMG Runtime Skill Pack

Status: app-local runtime knowledge pack. This file is not a global Hermes skill install and does not require writes to ~/.hermes/config.yaml or ~/.hermes/skills.

## UMG hierarchy

- Sleeve: the compiled cognitive operating package for the current user goal.
- NeoStack: a domain/workflow layer inside the Sleeve.
- NeoBlock: a focused runtime cognition unit inside a NeoStack.
- MOLT block: role-bound cognitive guidance for a NeoBlock. Supported runtime roles include Directive, Instruction, Subject, Primary, Philosophy, and Blueprint.
- Gate/control record: a routing, approval, risk, or safety control. Gates are not prompt MOLT blocks.
- Tool capability: a declared need for a possible tool/skill boundary. A capability is not automatically an executable tool.
- Runtime trace event: a real Hermes runtime event used by UMG Studio to update timeline, hierarchy, and geometry state.

## Runtime behavior

1. Load the compiled Sleeve as the cognitive operating structure.
2. Choose active NeoStacks and NeoBlocks from the user goal, manifest, current route, and previous trace.
3. Use MOLT roles as local cognitive guidance for the active NeoBlock.
4. Evaluate Gates before tool/capability execution.
5. Keep unused blocks inactive/off. Do not emit activation events for unused blocks.
6. Route dynamically based on trace/results.
7. Do not invent Sleeve, NeoStack, NeoBlock, MOLT, Gate, tool, or approval IDs.
8. If a relevant ID is unknown, emit the event in `unmappedEvents` without fabricated visual IDs.
9. Compiler trace is not Hermes runtime trace.

## Trace event contract

Hermes should emit structured runtime events when possible:

- run_started
- sleeve_loaded
- neostack_started
- neostack_completed
- neoblock_started
- neoblock_completed
- molt_role_used
- gate_evaluated
- gate_opened
- gate_blocked
- tool_call_prepared
- tool_call_requires_approval
- approval_granted
- approval_denied
- tool_call_executed
- tool_call_blocked
- tool_result_received
- neoblock_rerouted
- run_completed
- run_error

## Tool/capability behavior

- Capabilities are declarations, not assumed tools.
- Resolve a capability to an available Hermes skill/tool if the request registry marks it available.
- If unavailable or unknown, emit `tool_call_blocked` with a structured reason.
- If approval is required, emit `tool_call_requires_approval` and stop until continuation.
- If approved or safe auto-allowed, continue and emit tool_call_executed / tool_result_received.
- Safe configured customer_message_draft returns a local draft artifact only; it never sends email or contacts external systems.
- Irreversible actions require explicit confirmation and must not be executed from this app-local proof path.
- Local dev fallback must be labeled `local_dev_proof`, `non_destructive`, and `not_external_tool`.

## Required JSON envelope

Return only JSON with this shape:

```json
{
  "traceId": "string",
  "status": "ok | blocked | needsApproval | error",
  "finalOutput": "string",
  "events": [
    {
      "eventId": "string",
      "timestamp": 0,
      "eventType": "run_started",
      "message": "string",
      "scopeKind": "sleeve | neostack | neoblock | molt | gate | tool | approval",
      "sleeveId": "optional supplied ID",
      "neoStackId": "optional supplied ID",
      "neoBlockId": "optional supplied ID",
      "moltBlockId": "optional supplied ID",
      "gateId": "optional supplied ID",
      "toolId": "optional supplied capability/tool ID",
      "approvalId": "optional supplied approval ID",
      "sourceId": "optional supplied source ID",
      "metadataAliases": ["optional supplied aliases"],
      "status": "idle | queued | active | processing | attention | complete | skipped | blocked | error"
    }
  ],
  "toolCalls": [],
  "blockedCalls": [],
  "approvalRequests": [],
  "errors": [],
  "artifacts": [],
  "unmappedEvents": []
}
```
