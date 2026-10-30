# OpenCode Go Model Routing Policy

**Status:** ACCEPTED governance (OCG-02) · **Recorded:** 2026-10-30
**Applies to:** all AI-agent work in this repository.

## Logical roles (governance — fixed)

| Role | Responsibility |
|---|---|
| **Primary** | Routine coding, implementation, debugging |
| **Fallback** | Independent verification and fallback |
| **Complex Coding** | Complex multi-file implementation |
| **Architecture Review** | Architecture, security and release review |

Routing is expressed in **roles**, never in hard-coded model identities, so a provider or
model change never requires reopening a governance decision.

## Recommended default assignments (PROPOSED — configurable defaults)

| Role | Proposed model |
|---|---|
| Primary | MiMo-V2.6-Flash |
| Fallback | GLM-5.3-Flash |
| Complex Coding | Kimi K2.7 Code |
| Architecture Review | GLM-5.3 |

**These names are proposed logical defaults, not verified provider identifiers.** Exact model
IDs, availability, capabilities, pricing, quotas, and privacy guarantees are **UNVERIFIED** as
of 2026-10-30 (installed CLI: `opencode v2.1.2`; no provider/model verification was performed
in the session that recorded this policy). Verify against the official OpenCode
documentation and the installed version **before** configuring OpenCode (see
[OpenCode configuration policy](OPENCODE_CONFIGURATION_POLICY.md)).

## Rules

- Do not invent model IDs, provider capabilities, pricing, quotas, or privacy guarantees.
- Keep routing configurable; model assignments are easy to change.
- Avoid unnecessary model switching.
- Use the Primary model for the majority of routine work.
- Complex Coding activates only when the Primary model cannot adequately handle the task, and
  only with explicit task scope; it never overrides governance.
- Architecture Review is reserved for consequential decisions and produces recommendations,
  never autonomous approval.
- Fallback (verification) is used only when necessary — see
  [efficiency policy](TOKEN_AND_CONTEXT_EFFICIENCY_POLICY.md).

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-02
- [AI Agent Roles and Permissions](AI_AGENT_ROLES_AND_PERMISSIONS.md)
- [OpenCode Configuration Policy](OPENCODE_CONFIGURATION_POLICY.md)
