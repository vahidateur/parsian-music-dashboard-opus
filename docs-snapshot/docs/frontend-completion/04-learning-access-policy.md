# 04 — Learning Access Policy — Canonical

> Requirement: Level N => access 1..N locked N+1+ with canonical owner audit per-program/instrument scope

## Canonical Rule

**Owner:** `src/domains/learning/eligibility.ts` — pure function `resolveEligibleContent`

**Rule:**
- Input: placement (studentId, programId, levelId, assignedAt, history), levels of program, links, content, audience
- If no placement → [] (unplaced student not granted everything) — VERIFIED
- Locate current level by placement.levelId within placement.programId — if inconsistent (level outside program) → [] — VERIFIED
- Reachable levels = active levels of same program where:
  - if level.exclusive → level.id === current.id (exact only, overrides cumulative)
  - else → level.order <= current.order (cumulative 1..N)
- Eligible content = content linked to reachable levels via LevelContentLink where content.active, and if audience=students then visibility != teachers
- One content item linked to several reachable levels emitted once, attributed to LOWEST reachable level (where first unlocked) — VERIFIED
- Sort: levelOrder asc, sortOrder asc, title fa locale — VERIFIED

**Formal notation:**

```
eligible(student) = { c ∈ Content | ∃ link (link.contentId = c.id ∧ link.levelId ∈ reachable)
                      ∧ c.active ∧ (audience=teachers ∨ c.visibility=students) }
reachable = { l ∈ Levels | l.programId = placement.programId ∧ l.active
              ∧ (l.exclusive ? l.id = current.id : l.order <= current.order) }
```

## Named States

| State | Meaning | When | UI |
|---|---|---|---|
| eligible | Student may open now | level order <= current and active and visibility allows | Show with levelName, preview/download |
| locked | Future level content | level order > current | Show locked card with reason «در سطح X باز می‌شود» + lock icon, no preview, no download |
| not_visible | Teacher-only material | visibility=teachers and audience=students | Not rendered at all in student view, rendered in teacher view |
| not_found | Content or level missing | link points to deleted content/level | Honest missing state, not empty |
| not_applicable | No placement or inconsistent | placement undefined or level outside program | «هنوز در برنامه‌ای قرار نگرفته» empty state, not error |

## Per-Program / Instrument Scope — DECIDED O-01 (per-program, 2026-09-21)

> **Final product decision recorded 2026-09-21: scope is per-program.** Educational level is
> determined independently for each instrument/program; one student may hold different levels in
> different programs/instruments simultaneously (e.g. piano L3, vocals L1, violin L2). Global
> per-student and per-instrument options are formally excluded.

**Decided model (VERIFIED implementation now ratified):**
- Level order N is per program, never global — VERIFIED types.ts: order unique within program
- Program instrumentId scopes: instrument may have several programs (e.g. violin classic/irani)
- Eligibility scoped to programId, not instrumentId — so violin classic level 3 does not grant violin irani level 3 — VERIFIED current code `resolveEligibleContent` takes programId from placement
- InstrumentId on content optional (theory, ear training instrument-agnostic) — library can filter by it, but eligibility still via level link
- Placement one active per (student,program) — history records past levels for progression — **key: (student_id, program_id)**
- PrerequisiteLevelIds advisory not enforced — UI surfaces unmet as info, repo does not refuse — DOCUMENTED

**Scope options — decided:**

| Option | Meaning | Pros | Cons | Current code | Decision status |
|---|---|---|---|---|---|
| global | Level N global across all programs/instruments — Level 3 student sees all Level 1..3 content regardless of program | Simplest, no per-program table | Breaks multi-instrument academy — violin L3 grants piano L3 incorrectly | Not implemented — code is per-program | **REJECTED 2026-09-21** |
| per-program | Level N per program — student Level 3 in violin classic sees violin classic 1..3, not violin irani nor piano | Matches multi-program academy, placement per (student,program) already, prevents cross-program leak, D10 intent guard programId independent | — | **Current implementation** — VERIFIED types.ts order unique within program, placement programId, eligibility scoped to programId | **DECIDED 2026-09-21 — chosen model** |
| per-instrument | Level N per instrument — student Level 3 violin sees all violin programs 1..3, not piano | Groups by instrument family | Still cross-program within instrument — violin classic L3 grants violin irani L3 | Not implemented — code is per-program not per-instrument | **REJECTED 2026-09-21** |

**Placement:** One active placement per `(student, program)`. The per-program model allows independent
active placements for every (student, program) combination the student is enrolled in. For example,
a student can simultaneously be placed at piano L3, vocals L1, and violin L2.

**Class consistency rule:** If a class is defined for a student, it must be tied to a specific
program/instrument and its corresponding level; the class level must be consistent with the learning
path for that program/instrument.

**Library/resource access:** Resources must be categorizable by program/instrument and level so that
they are offered only to students who meet the per-program level eligibility — enforcing the
controlled learning path. Higher-level resources must not be offered without authorization.

**Teacher exceptional access:** A teacher may manually authorize a specific resource/file for a
specific student even outside that student's normal per-program level access. This exception does
not change the student's level, does not change the program/instrument level, grants access only to
that specific resource, and must be enforceable via backend authorization (policy-level) in the
future. The persistence model for this exception is a future decision and is not designed here —
no schema is invented.

**Impact:**
- Frontend: current per-program implementation is ratified; no source change required by this decision.
- Backend: table `student_placements` keyed `(student_id, program_id)` carrying `level_id, assigned_at,
  history JSON` — one active placement per (student, program). Do **not** use the `UNIQUE(student_id)`
  sketch in `production-handoff.md:155` (already marked NOT AUTHORITATIVE inline). A separate
  resource-exception mechanism will be designed later as its own backend decision.
- The canonical rule `student Level N → access to levels 1..N` (owner `learning/eligibility.ts`) is
  preserved; scope is now fixed as per-program.

**Canonical rule preserved:** student Level N → access to levels 1..N — owner learning/eligibility.ts — scope DECIDED per-program.

## Owner Audit

| Concept | Canonical Owner | File:Line |
|---|---|---|
| Program/Level/Content/Link/Placement types | learning domain | learning/types.ts |
| Eligibility derivation | learning/eligibility.ts | eligibility.ts:resolveEligibleContent |
| Inverse eligible students | same | eligibility.ts:resolveEligibleStudentIds |
| Attach intent guard | learning/demoRepository | demoRepository.ts LINK_INVALID before duplicate |
| Level order uniqueness | learning/demoRepository | demoRepository validation |
| Student placement assignment | learning/repository | assignPlacement refuses cross-program |
| Content visibility UX filter | eligibility.ts + view | audience param defaults students safe |
| SortOrder within level | learning/types.ts + demoRepository | LevelContentLink.sortOrder, eligibility sort |
| Progress pieces vs content distinction | progress/types.ts | progress/types header comment |

## Workflows

- **Assign content to level:** LearningPanel → LevelContentPanel → programs query independent + levels query → available = active catalogue minus already linked → attachContent(levelId, contentId, {programId}) with programId from selected program, not from level.programId (D10) → repository refuses mismatch LINK_INVALID → no placed student's eligible set changed for wrong program — VERIFIED D10 + contentAssignmentFlow test
- **Detach:** detachContent(levelId, contentId) — both ids from rows on screen, no intent guard (gap recorded I13) — could remove link of program navigated away from — OPEN, needs intent or hook fix
- **Student opens library:** StudentLearningPanel → useStudentPlacement + useEligibleContent → resolveEligibleContent → renders eligible + locked (future levels) — needs spec for locked UI (see 06)
- **Teacher views:** audience=teachers, includes teacher-only material
- **Empty/loading/error:** in-flight no false empty (count withheld), empty honest «منبعی نیست», error with retry ErrorState, success only after mutation resolved — VERIFIED LevelContentPanel

## Gaps / Frontend Completable NOW

- Detach stale-context guard (AttachContentIntent for detach) — A NOW (contract change small, but M3 prohibition said no domain change; now reopen allowed — classify B? Actually frontend can mitigate by deriving selection same as attach — but canonical fix is intent param — so B CONTRACT NOW BACKEND LATER)
- SortOrder UI invisible in assignment surface — A NOW (show sortOrder, allow reorder via updateLink sortOrder)
- per_page 200 ceiling — A mitigation NOW (state ceiling, counts from total, truncation disclosed) already partially, but needs pagination or 500 like dashboard
- Level string in Library (level: string) vs relation to LearningLevel — OPEN decision (keep as vocabulary D or link?)

## Acceptance

- Level 3 student sees levels 1,2,3 content, not 4+
- Exclusive level content visible only at exact level
- Inactive level content not eligible even if order <=
- Teacher-only content not visible to students even if linked to reachable level
- Unplaced student sees 0, not all
- Placement pointing outside program sees 0, not leak
- One content linked to multiple reachable levels appears once, attributed lowest
- Attach with mismatched programId refused LINK_INVALID, writes nothing, no eligibility change
- Detach guarded (future) or mitigated by derived selection
- SortOrder honored student-side and visible to operator

## Security

- Frontend UX filter only, server must enforce same rule — DOCUMENTED §31
- No credential leakage, no fabricated eligibility
