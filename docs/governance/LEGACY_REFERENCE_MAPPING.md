# Legacy Governance Reference Mapping

**Status:** ACCEPTED governance (OCG-08) · **Recorded:** 2026-10-30
**Purpose:** traceability between legacy references in the originating governance brief and
verified repository artifacts. Evidence was gathered 2026-10-30 on branch
`arena/01a10b63-parsian-music-dashboard-opus` @ `09c8e2c` — a **historical snapshot** (that
work has since merged). Branch names and SHAs here describe the state at record time, not
current project state.

## Mapping table

| Legacy reference | Verified current equivalent | Evidence | Treatment |
|---|---|---|---|
| WP_002 | Four current protected uncommitted work items (listed below) | `git status --short` | Replace |
| Task 4.3 Scheduling / Recurrence (claimed BLOCKED + RELEASE-BLOCKED) | Verified scheduling/recurrence entries: `OPEN_ITEMS.md` H1 (✅ CLOSED 2026-09-14, H1a by M4) whose closure caveats record the un-reimplemented recurrence-scoped controls («فقط این جلسه» / «این و جلسات بعدی» — no domain contract exists for a recurrence write), and `PROJECT_STATE.md` (M4/M5 sections) recording the same recurrence gap plus five unconsumed scheduling repository verbs (`get`, `create`, `update`, `delete`, `sessionRoster`) | `OPEN_ITEMS.md` lines ~66–118; `PROJECT_STATE.md` recurrence entries | Replace; **no BLOCKED/RELEASE-BLOCKED status assigned** |
| F1–F6 completion documentation | No verified equivalent | Repository + ref-wide search; only the historical frontend-completion F0/F1 phase text in `docs/frontend-completion/12-decision-register.md` exists | Omit from active constraints; recorded here for traceability only; never claimed as completed or verified |
| Previous branch reference (`arena/frontend-completion-spec`) | Current verified branch `arena/01a10b63-parsian-music-dashboard-opus` | `git branch --show-current` | Replace; session-specific, not a permanent repository-wide policy |

## WP_002 → Protected WIP (historical snapshot at record time)

Four uncommitted work items were protected at record time: a backend feature test, a branding
panel component, a pagination test and a branding regression test. Their exact paths are held
in the internal register rather than reproduced in this public copy.

Local agent tooling was additionally present as untracked content at record time; it was not
part of the protected items and was not touched.

Protection requirements were **not** assumed identical across the four items; each was to be
preserved as-is — staged, modified, or overwritten only with explicit human approval (OCG-06).
None of these items was staged, modified, or discarded while recording this policy. Those
items have since been merged; this section is retained for traceability only.

## Task 4.3 → Verified scheduling/recurrence status

- No task or item numbered "4.3" exists anywhere in the repository or its ref history.
- The label **BLOCKED** / **RELEASE-BLOCKED** appears **nowhere** in `docs/`, `.kiro/`, or
  `AGENTS.md` — repository-wide grep returned no matches. No such status is assigned or
  implied by this mapping.
- The recurrence gap (no domain contract for a recurrence write; recurrence-scoped controls
  not reimplemented after fixture dissolution) is recorded as an open closure caveat of the
  **CLOSED** H1 item, consistently in `OPEN_ITEMS.md` and `PROJECT_STATE.md` — the two files
  **agree**; no inconsistency to flag.

## F1–F6 → No verified equivalent

Searched all local and remote refs for completion-evidence artifacts matching F1–F6 as
active phases. None found. Historical F0/F1 phase language inside the frontend-completion
decision register is a phase label, not the F1–F6 documentation series the brief referenced.
This mapping omits F1–F6 from active project constraints and makes no completion claim.

## Branch constraint

Branch verified at record time: `arena/01a10b63-parsian-music-dashboard-opus` @ `09c8e2c`
(historical). The "preserve the currently authorized branch" constraint is preserved as a
**session-specific** restriction and must not be interpreted as a permanent repository-wide
branch policy.

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-08
- [Agent Workflow and Approval Gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md) — protected WIP gate
