# Governance Decision Register — OpenCode Go operating policy

**Recorded:** 2026-10-30
**Workspace branch:** `arena/01a10b63-parsian-music-dashboard-opus` (session-specific, not a
permanent repository-wide branch policy)
**Nature:** documentation-only governance for AI-agent operation (model routing, privacy,
token efficiency, agent roles, approval gates). **Does not authorize** application code,
backend implementation, configuration activation, Git commits, pushes, merges, or branch
changes.

> ## ⚠️ ID NAMESPACE — `OCG-XX` is its own namespace
>
> This register is the **fourth, independent decision namespace** in this repository. Its
> `OCG-XX` identifiers are **NOT** any of the other three:
>
> | Namespace | Canonical location | Owns |
> |---|---|---|
> | **`D1–D42`** (engineering) | [`docs/engineering/DECISIONS.md`](../engineering/DECISIONS.md) | Durable architecture decisions |
> | **`T-02` / `O-*` / `PERF` / `HELP`** | [`docs/engineering/GOVERNANCE_CHECKPOINT.md`](../engineering/GOVERNANCE_CHECKPOINT.md) | Laravel-bound backend governance |
> | **`D1` / `D2` / `B-*` / `O-01..O-20`** (frontend-completion) | [`docs/frontend-completion/12-decision-register.md`](../frontend-completion/12-decision-register.md) | Frontend-completion phase decisions |
> | **`OCG-XX`** (this file) | `docs/governance/GOVERNANCE_DECISION_REGISTER.md` | AI-agent / OpenCode Go operating governance |
>
> **Rules.** The four namespaces are **non-interchangeable**. No shared IDs, no implicit
> inheritance, no authority transfer between registers. Cross-references are informational
> pointers only. Where any two registers appear to disagree about a subject, the register that
> **owns the subject** governs — this register never amends a D-entry, a T-02/O-* status, or a
> frontend-completion decision. The pointer entries added to `DECISIONS.md` and
> `GOVERNANCE_CHECKPOINT.md` state this explicitly and transfer no authority.

---

## Index

| ID | Title | Status |
|---|---|---|
| OCG-01 | Fourth decision namespace for OpenCode Go governance | ACCEPTED |
| OCG-02 | Model routing policy — logical roles, configurable, unverified IDs | ACCEPTED (assignments: PROPOSED) |
| OCG-03 | Privacy and data classification policy for AI-agent traffic | ACCEPTED |
| OCG-04 | Low-consumption engineering policy (context / model / test efficiency) | ACCEPTED |
| OCG-05 | Agent operating model — Plan → Build → Verify → Review → Human Approval | ACCEPTED |
| OCG-06 | Mandatory human-approval gates | ACCEPTED |
| OCG-07 | OpenCode configuration policy | ACCEPTED |
| OCG-08 | Legacy governance reference mapping | ACCEPTED |

**Status vocabulary.** `ACCEPTED` = in force as governance text. `PROPOSED` = recommended
default, not verified, changeable without reopening an ACCEPTED decision. `UNVERIFIED` = a
claim whose evidence has not been established; must not be relied on. `OPEN` = awaiting a
future decision. A register entry may carry ACCEPTED governance together with PROPOSED or
UNVERIFIED sub-claims — each is labelled where it appears.

---

## OCG-01 — Fourth decision namespace for OpenCode Go governance

**Decision.** AI-agent operating governance for this repository is recorded in
`docs/governance/` with decisions registered here under the `OCG-XX` prefix, as an
independent fourth namespace alongside the three pre-existing registers.

**Rationale.** The governance task that created this register required a dedicated
`docs/governance/` location; the repository already documents three non-interchangeable
register namespaces and has previously had to repair namespace collisions. Creating the
fourth register explicitly namespaced — with pointer entries in the two canonical engineering
files — satisfies the requirement without merging, migrating, renumbering, or reinterpreting
any existing entry.

**Scope.** Governance documents under `docs/governance/` and pointer entries in
`DECISIONS.md` / `GOVERNANCE_CHECKPOINT.md`. No product or architecture decisions.

**Privacy implications.** None directly; see OCG-03.

**Operational impact.** None executable. `opencode.json` is unchanged; no permission or model
configuration was activated by this register.

**Related documents.** [Model routing](MODEL_ROUTING_POLICY.md) ·
[Agent roles](AI_AGENT_ROLES_AND_PERMISSIONS.md) ·
[Privacy](PRIVACY_AND_DATA_CLASSIFICATION_POLICY.md) ·
[Token efficiency](TOKEN_AND_CONTEXT_EFFICIENCY_POLICY.md) ·
[Workflow & approval gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md) ·
[OpenCode configuration](OPENCODE_CONFIGURATION_POLICY.md)

---

## OCG-02 — Model routing policy (logical roles; assignments PROPOSED, IDs UNVERIFIED)

**Decision.** Agent work is routed by **logical role** — Primary, Fallback, Complex Coding,
Architecture Review — not by hard-coded model identity. The four logical roles and their
responsibilities are fixed governance; the concrete model assigned to each role is a
configurable, changeable default.

**Recommended default assignments (PROPOSED — not verified provider identifiers):**

| Role | Proposed model | Responsibility |
|---|---|---|
| Primary | MiMo-V2.6-Flash | Routine coding, implementation, debugging |
| Fallback | GLM-5.3-Flash | Independent verification and fallback |
| Complex Coding | Kimi K2.7 Code | Complex multi-file implementation |
| Architecture Review | GLM-5.3 | Architecture, security and release review |

**Rationale.** Role-based routing keeps the policy stable when a provider or model ID changes;
assignments must never be load-bearing for a governance rule.

**Rules.** Verify actual availability and exact model IDs before configuring OpenCode; do not
invent model IDs, capabilities, pricing, quotas, or privacy guarantees; keep routing
configurable; avoid unnecessary model switching; use the Primary model for the majority of
routine work. Exact model IDs, provider capabilities, pricing and quotas are **UNVERIFIED**
as of this recording (installed CLI: `opencode v2.1.2`) — see
[OpenCode configuration policy](OPENCODE_CONFIGURATION_POLICY.md).

**Status.** ACCEPTED as governance; model assignments PROPOSED; provider identifiers
UNVERIFIED.

**Privacy implications.** Model choice does not change OCG-03 rules; a route to an unverified
provider inherits OCG-03 §9 (explicit approval required).

**Operational impact.** None executable until a configuration is verified against the
installed OpenCode version and approved.

**Related documents.** [Model routing policy](MODEL_ROUTING_POLICY.md) ·
[OpenCode configuration policy](OPENCODE_CONFIGURATION_POLICY.md)

---

## OCG-03 — Privacy and data classification policy

**Decision.** AI-agent traffic follows the three-tier classification (Public / Internal /
Confidential) and the ten data rules recorded in the
[privacy policy](PRIVACY_AND_DATA_CLASSIFICATION_POLICY.md): never send secrets to external
models; never expose `.env`, private keys, tokens, production credentials or user records;
least-context by default; prefer verified ZDR/no-training providers; treat privacy claims as
provider-specific and verifiable; never assume ZDR means no operational logs; unknown
retention ⇒ route is UNVERIFIED; explicit approval required before unverified providers see
Internal/Confidential data; secrets stay outside version control.

**Rationale.** `DECISIONS.md` §17 already makes privacy a *product* property (enforced in
source/tests); this decision extends the same posture to *agent traffic* without altering §17
— §17 continues to govern product privacy and is untouched.

**Scope.** What agents may read, include in prompts, and send to external providers.

**Privacy implications.** This IS the privacy decision. It governs agent-context composition,
not product behavior.

**Operational impact.** None executable; enforced by review gates in OCG-05/OCG-06.

**Related documents.** [Privacy and data classification](PRIVACY_AND_DATA_CLASSIFICATION_POLICY.md) ·
`docs/engineering/DECISIONS.md` §17 (product privacy, unchanged)

---

## OCG-04 — Low-consumption engineering policy

**Decision.** Context, model, and test efficiency rules are mandatory operating rules for all
agent work, recorded in the
[token and context efficiency policy](TOKEN_AND_CONTEXT_EFFICIENCY_POLICY.md):
Evidence-Reuse-First; narrow reads over repository-wide dumps; targeted tests before full
suites; Primary model for routine work with reserved roles for Complex Coding and
Architecture Review; no multi-model work on simple tasks without justification; no parallel
agents modifying shared files; never claim a test passed without execution evidence.

**Rationale.** Reuses principles already practiced in this repository's working rules
(`AGENTS.md`: narrow reads, reuse verified command results, focused tests first) and
formalizes them as governance with an explicit ID.

**Scope.** How agents consume context, models, and compute for any task.

**Privacy implications.** Least-context composition (OCG-03) and efficiency reinforce each
other; efficiency never justifies including unnecessary files.

**Operational impact.** None executable; enforced by review gates.

**Related documents.** [Token and context efficiency](TOKEN_AND_CONTEXT_EFFICIENCY_POLICY.md)

---

## OCG-05 — Agent operating model

**Decision.** All agent work follows the workflow **Governance → Plan → Build → Verify →
Review → Human Approval** with the five roles and permission boundaries recorded in the
[agent roles policy](AI_AGENT_ROLES_AND_PERMISSIONS.md): Plan (read-only), Build (approved
scope only), Verify (evidence-backed), Complex Coding (escalation only), Architecture Review
(recommendations only, never autonomous approval). Default model per role follows OCG-02
logical roles.

**Rationale.** Separates proposal, implementation, and verification so no single agent both
changes code and approves it; verification stays evidence-based per the repository's honesty
rules.

**Scope.** Agent role boundaries and the mandatory workflow order.

**Privacy implications.** Plan/Verify read-only roles must still obey OCG-03 file-selection
rules when gathering context.

**Operational impact.** None executable.

**Related documents.** [Agent roles and permissions](AI_AGENT_ROLES_AND_PERMISSIONS.md) ·
[Workflow and approval gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md)

---

## OCG-06 — Mandatory human-approval gates

**Decision.** Human approval is required before: Git commit, merge, push, branch switching,
deployment, database migrations, backend scope expansion, changes to protected WIP, changes
to governance rules, and changes to release-blocked task statuses. No agent may bypass a gate
by splitting a prohibited operation into smaller tasks.

**Rationale.** This formalizes and extends what is already enforced at the tool level by
`opencode.json` (deny `git push*` / `reset --hard*` / `clean -f*` / `rebase*` /
`filter-branch*`; ask `git commit*` / `git add*` / `merge*`) and by
`.opencode/specs/git-safety.md`. This decision does **not** replace or weaken those — they
remain the enforcing layer; this register names the same gates as governance and adds the
non-Git gates (deploy, migrations, backend expansion, governance edits, status changes).

**Scope.** All agent-initiated consequential operations.

**Privacy implications.** Changes touching secrets or provider configuration additionally
require approval per OCG-03.

**Operational impact.** Existing `opencode.json` permissions already enforce the Git subset;
no configuration change was made.

**Related documents.** [Workflow and approval gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md) ·
`.opencode/specs/git-safety.md` · `opencode.json`

---

## OCG-07 — OpenCode configuration policy

**Decision.** Any future OpenCode configuration change must use native configuration and
permission mechanisms, must be validated against the installed OpenCode version and official
documentation, must not fabricate configuration properties or model IDs, must not overwrite
the existing `opencode.json`, must not expose API keys, must not change provider settings
automatically, and must keep model assignments easy to change. Until model IDs are verified,
proposed settings are documented separately as proposals — never activated silently.

**Rationale.** The current `opencode.json` (permissions + plugins) is live, working
infrastructure; the installed CLI is `opencode v2.1.2` but no model-availability verification
has been performed in this session.

**Scope.** Future edits to `opencode.json` or any OpenCode configuration surface.

**Privacy implications.** API keys and provider credentials never enter the repository.

**Operational impact.** Prevents unverified configuration from being committed or activated
without approval (OCG-06).

**Related documents.** [OpenCode configuration policy](OPENCODE_CONFIGURATION_POLICY.md)

---

## OCG-08 — Legacy governance reference mapping

**Decision.** The legacy references in the originating governance brief — `WP_002`,
"Task 4.3 Scheduling/Recurrence BLOCKED & RELEASE-BLOCKED", "F1–F6 documentation", and a
previous-branch reference — are mapped to verified repository artifacts in the
[legacy reference mapping](LEGACY_REFERENCE_MAPPING.md): WP_002 → the four current protected
uncommitted work items; Task 4.3 → the verified scheduling/recurrence entries in
`OPEN_ITEMS.md` / `PROJECT_STATE.md` (no BLOCKED/RELEASE-BLOCKED label exists anywhere in the
repository — none is assigned); F1–F6 → no verified equivalent (omitted, recorded for
traceability only); previous branch reference → current verified branch `arena/01a10b63`
(session-specific).

**Rationale.** The stale identifiers do not exist in the repository or its ref history; the
brief's intent (preserve protected WIP, preserve the scheduling/recurrence open gap, preserve
the current branch, don't fabricate phase completions) is preserved by mapping to real,
evidenced artifacts rather than inventing IDs or statuses.

**Scope.** Traceability of legacy brief references to current repository state.

**Privacy implications.** None.

**Operational impact.** None; no task status was changed, upgraded, or downgraded.

**Related documents.** [Legacy reference mapping](LEGACY_REFERENCE_MAPPING.md)
