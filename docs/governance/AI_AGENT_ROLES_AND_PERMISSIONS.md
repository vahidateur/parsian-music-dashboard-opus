# AI Agent Roles and Permissions

**Status:** ACCEPTED governance (OCG-05) · **Recorded:** 2026-10-30
**Applies to:** all AI-agent work in this repository.
**Default model per role:** logical roles from the [model routing policy](MODEL_ROUTING_POLICY.md)
(assignments are PROPOSED defaults; roles are fixed).

## Workflow

**Governance → Plan → Build → Verify → Review → Human Approval**

Every unit of work passes through these stages in order. Human approval is the terminal gate
and is defined in [Agent Workflow and Approval Gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md).

## Plan Agent — default model: Primary

**Responsibilities**

- Inspect relevant code and documentation.
- Identify scope and dependencies.
- Define acceptance criteria.
- Identify protected files and risks.
- Produce an implementation plan.

**Permissions**

- Read-only.
- No source modifications.
- No commits or Git mutations.

## Build Agent — default model: Primary

**Responsibilities**

- Implement only approved task scope.
- Respect acceptance criteria.
- Reuse existing architecture and components.
- Avoid unrelated refactoring.

**Permissions**

- Modify explicitly approved files only.
- No branch switching.
- No commit, merge, push, or deployment without approval.

## Verification Agent — default model: Fallback

**Responsibilities**

- Inspect Git diff.
- Run relevant tests.
- Check acceptance criteria.
- Identify regressions and security issues.
- Produce evidence-backed results.

(Read-only with respect to source; may run tests and commands but does not modify approved
scope.)

## Complex Coding Agent — default model: Complex Coding

**Activation**

- Only when the Primary model cannot adequately handle the task.
- Must have explicit task scope.
- Must not override Governance rules.

## Architecture Review Agent — default model: Architecture Review

**Responsibilities**

- Review architectural decisions.
- Evaluate security and maintainability.
- Inspect release risks.
- Provide recommendations, not autonomous approval.

## Interaction with existing agent surfaces

This policy is governance text. It does not alter existing agent definitions such as
`.opencode/agents/routine.md` or the skills under `.opencode/skills/` and `.kiro/skills/`;
those remain governed by their own documents and by `AGENTS.md`.

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-05
- [Model Routing Policy](MODEL_ROUTING_POLICY.md)
- [Agent Workflow and Approval Gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md)
