# OCG Enforcement — Phase 1 Report (Privacy & Protected WIP)

**Recorded:** 2026-10-30 · **Historical snapshot:** branch `arena/01a10b63-parsian-music-dashboard-opus`
@ `09c8e2c` at the time of the phase (that work has since merged; the branch label and SHA are
historical, not current project state). · **OpenCode:** v2.1.2 · **Mode:** controlled
remediation, configuration-only.
**Registers:** governance decisions OCG-03 (privacy), OCG-06 (approval gates), OCG-07
(configuration policy) in [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md).

## 1. Executive summary

Phase 1 closed the two P0 gaps identified by the enforcement audit with 17 appended
permission rules in `opencode.json` (0 existing rules modified, 0 weakened) plus a correction
to `.opencode/specs/git-safety.md` that had overstated tool-level protection. Seven
behavioural tests (T1–T7) against real OpenCode sessions verify secret-read denial, WIP
edit-denial, and governance ask-gating — with file-hash proof that no protected file changed.
`opencode-supermemory` is **loaded but inert** (no API key reachable), classified
**UNVERIFIED-RETENTION / DISCONNECTED**. Honest headline: this is **PARTIAL** protection, not
isolation — `bash` remains an open bypass for both secrets and WIP (§6).

## 2. Original risks (from the enforcement audit)

| # | Risk | Class |
|---|---|---|
| R1 | Any agent could read environment files, key material and locally stored provider credentials into model context (default `ask`, bypassable with a blanket approval) | High |
| R2 | The protected work items had **no** `edit` protection of any kind | High |
| R3 | The governance register was modifiable without approval | Medium |
| R4 | The agent git-safety specification claimed a set of git operations were "denied at the tool level" — false assurance in agent-instructed context | High (documentation defect) |
| R5 | A conversation-capture plugin's retention posture was unverified | Medium |

## 3. Applied changes — categorised rules

Seventeen permission rules were appended to the existing agent configuration; the eight
pre-existing shell rules are byte-identical, and plugins, schema line and everything else were
untouched. They are described here by effect, not reproduced verbatim (exact patterns live
with the configuration itself):

| Category | Effect |
|---|---|
| Environment files at any depth, except the public template | read **deny** |
| Key material (private keys / certificates, any depth) | read **deny** |
| Credential/config stores outside the workspace | read **deny** |
| The then-currently protected work items | edit **deny** |
| The governance register | edit **ask** |
| The public environment template | read **allow**, re-stated last |

The agent git-safety specification's "Standing rules" section was rewritten to label every
rule TOOL-ENFORCED / INSTRUCTION-ONLY / HUMAN APPROVAL (Phase E detail in §7).

### Rule semantics — verified against the installed agent runtime, not assumed

- **Wildcards cross directory separators**, so one pattern covers nested paths; `**` and `*`
  have the same reach.
- **Project rules are appended after built-in defaults and the last match wins**, so a project
  deny overrides a built-in ask, and a built-in allow placed earlier loses to it. That is why
  the public-template allow is stated last.
- **`edit` covers write and patch** as a single action, so one rule per path suffices.
- **Order in the configuration is load-bearing**: denies → governance ask → public-template
  allow last.
- Paths outside the workspace are gated first by the default external-directory prompt; the
  read-deny on them is defence-in-depth, and its live behaviour is **UNVERIFIED** (§9).

The public environment template was verified to be the only harmless env-shaped file; every
other variant in scope is denied.

## 4. Verification evidence (T1–T7)

Each test ran in a **fresh agent session** (`--auto` mode; prompts forbade shell use so only
the permission-gated tool was exercised). The service configuration was reloaded first and the
resolved rule set inspected.

| Test | Action | Expected | Result |
|---|---|---|---|
| T1 | read a managed environment file | deny | **DENIED** — even under `--auto` ✅ ENFORCED |
| T2 | read the root environment file (disposable placeholder, deleted afterwards; no real secret read) | deny | **DENIED** ✅ ENFORCED |
| T3 | read the public environment template | allow | **READ-OK** ✅ ENFORCED (no false positive) |
| T4 | read an ordinary tracked file | allow | **READ-OK** ✅ ENFORCED |
| T5 | edit a protected work item | deny | **DENIED**; `sha256sum -c` against the pre-test baseline: **all protected items byte-identical** ✅ ENFORCED |
| T6 | edit a governance document | ask → auto-approved under `--auto` | edit permitted (probe text landed, then **reverted; hash identical to baseline**) ✅ ENFORCED (ask semantics; `--auto` bypass is documented agent behaviour, see §6) |
| T7 | read the same governance document | allow | **READ-OK** ✅ ENFORCED (read access preserved) |

Baselines: hashes of the protected items were recorded before testing in scratch space; all
were re-verified unchanged after T5, and the T6 probe file was restored to its exact pre-test
hash. No secret content was read, printed, or copied at any point.

## 5. Before / after permission behaviour

| Scenario | Before | After |
|---|---|---|
| Agent reads a managed environment file | `ask` — one "always" click approved it for the session | **denied**, cannot be approval-bypassed (explicit deny survives `--auto`) |
| Agent edits a protected work item | permitted silently | **denied** |
| Agent edits the governance register | permitted silently | **ask** (human gate; `--auto` auto-approves — see §6) |
| Agent reads the public environment template | allow (built-in) | allow (preserved by explicit last rule) |
| Agent reads ordinary files | allow | allow (unchanged) |
| git push / reset --hard / clean -f / rebase / filter-branch | deny | deny (unchanged) |
| git commit / add / merge | ask | ask (unchanged) |
| git checkout -- ., amend, branch switch, stash, tag | unprotected | **unprotected** (now *documented* as such in git-safety.md; no rules added this phase by design) |

## 6. Remaining bypass paths (explicit — not complete isolation)

1. **`bash` is the primary bypass.** Permission `read`/`edit` rules gate the dedicated tools;
   shell commands are matched as **command strings**, not by target path, so an equivalent
   shell command is not covered by those rules. Specific commands are deliberately not
   enumerated here. The only shell rules are the 8 pre-existing git ones (Phase E forbade
   adding more). **No secret isolation and no immutable-WIP claim is made.**
2. **`--auto` mode auto-approves `ask` rules** (governance edits, the external-directory
   prompt, environment-file asks elsewhere). Explicit `deny` is unaffected (proven by T1/T2 under
   `--auto`), but the governance gate and the `~/*` external gates are approval-strength only
   in normal (non-auto) sessions.
3. **Paths outside the workspace (credential/config directories) are double-gated** by the
   default external-directory prompt first; their read-deny is defence-in-depth but its live
   behaviour is UNVERIFIED (§9). The OpenCode auth store (outside the workspace) has **no**
   read-deny rule — deliberate: adding it was outside the approved rule set; flagged for
   Phase 2.
4. **Indirect modification paths**: formatters (`formatter` config), LSP actions, plugins
   (oh-my-opencode bundles MCP/skill surfaces), and subagents (`routine` has its own
   `edit: deny` but inherits global rules otherwise). Not covered by edit rules.
5. **`.env`-like files whose names fall outside the patterns** are unprotected — patterns
   were kept narrow per the "no broad denies" requirement; the exact gaps are not enumerated
   here.
6. **Config self-modification**: the agent configuration file itself is editable by any agent
   (an `ask` rule on it was **not** in the approved scope; noted for Phase 2 — a
   governance-gate candidate).

## 7. Git-safety documentation correction (Phase E)

The agent git-safety specification's "Standing rules" section now classifies every rule as
**TOOL-ENFORCED / INSTRUCTION-ONLY / HUMAN APPROVAL**:

- Corrected: the previously mislabelled git operations are **INSTRUCTION-ONLY**. The earlier
  text claiming tool-level denial was false and is now explicitly marked as a 2026-10-30
  correction.
- Tool-level facts restated exactly: destructive git operations (force-push, hard reset,
  force-clean, rebase, history rewrite) are deny; commit/add/merge are ask; every other git
  operation is not tool-gated.
- The database-protection hook is labelled instruction-grade (an agent prompt, not a
  configuration rule), and the specification now states that no read/edit rule stops an
  equivalent shell command.

No git permission behaviour changed this phase (per Phase E scope).

## 8. Supermemory investigation (Phase D) — classification

| Question | Finding (evidence) |
|---|---|
| Installation/activation | Distributed as an npm plugin package, listed in the tracked agent configuration and resolved from the local plugin cache; the agent reports it as **loaded** |
| What it stores | Conversation capture when a session goes idle: assistant turns and transcripts, plus memory scopes (project-config, architecture, error-solution, preference, learned-pattern, conversation) |
| External transmission | Yes — `https://api.supermemory.ai` (the only external endpoint in the package). Content wrapped in `<private>…</private>` is redacted per its README |
| Disable persistence | No in-plugin kill switch found; the **activation gate is the API key** — capture does not run without it |
| Is it active here? | **No.** `SUPERMEMORY_API_KEY` is not in the environment, not in the local OpenCode configuration, not in the project config → **inert** (zero data leaves this machine via this plugin today) |
| Retention / deletion | Plugin-side `forget` tool deletes a memory by id; flush on session delete/shutdown. **Server-side retention policy: NOT documented in the plugin; provider policy not verified this session** |
| ZDR documented/verifiable? | **No — UNVERIFIED** |

**Classification: UNVERIFIED-RETENTION / DISCONNECTED.** Recommendation (not applied —
modifying the plugin list is approval-gated per OCG-07): keep it disabled for any session
handling Internal/Confidential data; if retention guarantees are ever needed, verify
supermemory's policy first or remove the plugin from `plugins` with owner approval. No
credentials were exposed during this investigation.

## 9. Unverified assumptions

- Live behaviour of the read-denies on credential/config paths outside the workspace:
  **UNVERIFIED**
  (external-directory gate intercepts first; testing would require approving external access,
  which was out of safe scope). Schema resolution of the rules is verified; behaviour is not.
- Whether all subagent/plugin tool surfaces route through the same permission service: the
  restricted helper agent's own edit-deny was verified in its definition, but plugin-provided
  tool surfaces were not behaviourally tested.
- Whether a configuration reload propagates to an already-running interactive session's
  permission service (fresh sessions definitely get it — all T1–T7 evidence comes from fresh
  sessions).
- Key-material patterns: semantics verified; no behavioural test (no safe dummy key file was
  needed — the same matcher code path proven by T1–T4 applies).

## 10. Updated OCG compliance (Phase 1 scope only)

| Decision | Before | After | Basis |
|---|---|---|---|
| OCG-03 (privacy — agent-traffic secret exclusion) | PARTIAL | **PARTIAL (strong)** — tool-layer ENFORCED for read; bash bypass remains | T1–T4 + §6.1 |
| OCG-06 (approval gates — protected WIP + governance) | DOCUMENTED ONLY for these gates | **PARTIAL** — WIP edit ENFORCED at tool layer; governance edit ENFORCED as ask; branch/deploy/config gates still ungated | T5–T7 + §6 |
| OCG-07 (configuration policy) | DOCUMENTED ONLY | DOCUMENTED ONLY (unchanged — this phase *was* an OCG-07-governed change, executed under human conditional approval, minimal diff, schema-validated) | §3 |
| OCG-01/-02/-04/-05/-08 | — | unchanged this phase | — |

## 11. Safety confirmation

At the time of this phase, branch `arena/01a10b63-parsian-music-dashboard-opus` @ `09c8e2c`
was unchanged (historical: that work has since merged). No commit, push, merge, rebase, branch
switch, or staging. The four protected WIP files are byte-identical
(sha256-verified before/after T5; the T6 governance probe fully reverted to its original
hash). No application source, no Laravel code, no model-routing, no new agents, no secrets
disclosed. Files changed this phase: the agent configuration (appended permission rules),
the agent git-safety specification (accuracy correction), and this report.
