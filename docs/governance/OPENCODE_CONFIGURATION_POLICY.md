# OpenCode Configuration Policy

**Status:** ACCEPTED governance (OCG-07) · **Recorded:** 2026-10-30
**Applies to:** any future change to `opencode.json` or other OpenCode configuration surfaces.

## Current state (verified 2026-10-30)

- Installed CLI: `opencode v2.1.2`.
- `opencode.json` exists (741 bytes) and is **live**: a working `permissions` list (deny
  destructive git commands, ask commit/add/merge) plus plugins
  `@dietrichgebert/ponytail`, `opencode-supermemory`, `oh-my-opencode`.
- **No model/provider configuration is present or verified.** The model IDs named in the
  [model routing policy](MODEL_ROUTING_POLICY.md) are PROPOSED logical defaults and are
  UNVERIFIED as provider identifiers.

## Rules for any executable configuration change

1. Use OpenCode's native configuration and agent permission mechanisms.
2. Validate against the currently installed OpenCode version and official documentation
   before writing any executable setting.
3. Do not fabricate configuration properties.
4. Do not assume model IDs are valid.
5. Do not overwrite the existing `opencode.json`.
6. Do not expose API keys.
7. Do not change provider settings automatically.
8. Document proposed settings separately when verification is incomplete — proposals are
   never activated silently.
9. Keep model assignments easy to change (roles, not hard-coded identities).
10. Any change to `opencode.json` touches live enforcement (see
    [approval gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md)) and therefore requires human
    approval (OCG-06).

## Proposed-but-unverified configuration

None has been drafted in executable form, because no model-availability verification was
performed in the recording session. Any future proposal must state, per setting: the exact
value, the OpenCode version it was validated against, and whether it is verified or
UNVERIFIED.

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-07
- [Model Routing Policy](MODEL_ROUTING_POLICY.md)
- `opencode.json` (unchanged)
