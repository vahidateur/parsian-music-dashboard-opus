# RECORD — Kiro skills and `.opencode/specs` cleanup (2026-10-29)

> Documentation and tooling only. No application code, backend code, branch, worktree, tag or
> stash was touched. A document never carries its own SHA: read the tip with `git log -1 --format=%H`.

## 1. Files changed (tracked)

| File | Why |
|---|---|
| `.opencode/specs/api-capability-errors.md` | "unserved" list, Rooms, Finance, file-bytes claims contradicted by source |
| `.opencode/specs/architecture-targets.md` | Rooms "blocked for everyone" contradicted by DECISIONS §35; `UNAVAILABLE_DOMAINS` now empty |
| `.opencode/specs/git-safety.md` | CRLF description and remote `main` SHA no longer true |
| `.opencode/specs/testing-acceptance.md` | "no PHP/Composer" is machine-specific; backend suite ran here |
| `.kiro/steering/11_DECISION_LOG.md` | "25-permission RBAC" — vocabulary is 37; D6 partly lifted for the client |
| `docs/engineering/SESSION_HANDOFF.md` | tooling note pointing here (no work-order change) |
| `docs/engineering/SKILLS_SPECS_CLEANUP_2026-10-29.md` | this record |

Untracked and deliberately **not** staged: `.kiro/skills/` (70 third-party skill copies; whether
to track them is an owner decision). `auth-rbac.md` was checked and left unchanged (37 ids match).
Pre-existing, unrelated, left alone: modified `backend/tests/Feature/MediaTest.php` (two `use` lines).
Not edited, by rule: `PROJECT_STATE.md`, `OPEN_ITEMS.md`, `PHASES.md`, `DECISIONS.md`.

## 2. Documentation corrections and their evidence

| Claim corrected | Evidence |
|---|---|
| Permission vocabulary 25 (steering) | `backend/config/permissions.php` and `src/domains/auth/permissions.ts` each define 37 ids; `permissionParity.test.ts` passes. 25 + 12 added by §33 to §42 = 37 |
| `UNAVAILABLE_DOMAINS` lists 7 domains | `src/domains/shared/unavailableDomains.ts` exports `[]`; `registry.client.ts` returns `Api*` repositories for every domain; `registryClient.test.ts` passes |
| Rooms blocked for every actor (PB-3) | `RoomPolicy` authorizes `rooms.read` / `rooms.write` through `PermissionGate`; `RoomsTest` 9 passed; DECISIONS §35 |
| Finance has no contract | `Route::*('invoices…')` in `backend/routes/api.php`; `InvoicePolicy` checks `finance.read/write/pay`; `InvoiceService` uses `TenantContext`; `InvoiceTest` 11 passed. Reports: no route, `src/domains/reports/` is README-only. Demo registry still returns `createUnavailableRepository("finance")` |
| Library file bytes not served | Bytes are served by `media`: `POST /media`, `GET /media/{id}/bytes` (`MediaController::bytes` calls `MediaPolicy::authorizeReadAsset`); `Library.tsx` and `GalleryUploader.tsx` use `MediaRepository`; `MediaTest` + `LearningMediaTest` 18 passed. `POST /uploads` and `/resources/{id}/download` stay unrouted: `ResourceTest::test_the_file_endpoints_are_not_part_of_this_slice` expects 404 |
| Gallery | `GalleryPolicy` (`gallery.read/write`), `GalleryService` tenant-scoped, `GalleryTest` 13 passed (incl. `test_gallery_bytes_follow_gallery_read`) |
| Checkout is CRLF, blobs LF, "hundreds" modified | `git ls-files --eol`: dataset 37 files `i/lf w/lf`; 32 tracked files are `i/crlf w/crlf` (index and worktree agree), incl. `.kiro/settings/cli.json`; no root `.gitattributes`; `core.autocrlf` unset. Nothing was normalized |
| Remote `main` = 15775ea | `git ls-remote --heads origin` returned a different tip; local `main` / `local/main-sync` unchanged and every commit on them is reachable from a remote ref or tag |
| No PHP / Composer / MySQL | PHP 8.4.23, Composer 2.10.3, `backend/vendor` present; `phpunit.xml` uses sqlite `:memory:`; `backend/.env` points at MySQL, so runs were pinned with `DB_CONNECTION=sqlite DB_DATABASE=:memory:`; MySQL was not contacted |

Left as found because the evidence did not contradict them: restrictions and owner-decision text in
`auth-rbac.md`, the "no frontend CI" note (only `backend-tests.yml`, `backend/**` paths), Node pin.

## 3. Kiro skills removed from `.kiro/skills/` (reversible)

Sources are untouched: `.agents/skills/` (104 skills) and `.opencode/skills/` (6 project skills).
Every copy was verified byte-identical to `.agents/skills/` right after copying (`diff -rq`), and batch 2
was compared again immediately before removal.

Batch 1 — removed earlier today because activation would break a repo rule, depend on missing
infrastructure, send data to a third party, or cannot run in Kiro. Not restored.

```text
using-superpowers|forces skill invocation before every response
brainstorming|writes docs/superpowers specs and commits
using-git-worktrees|git worktree add, .gitignore commit
finishing-a-development-branch|merge, branch delete, discard
writing-plans|commit steps
executing-plans|commit steps
subagent-driven-development|implementer commits, worktrees
setup-matt-pocock-skills|writes AGENTS.md, GLOSSARY.md, docs/adr, tracker config
ask-matt|routes to removed skills
to-spec|publishes to an issue tracker
to-tickets|publishes to an issue tracker
triage|issue tracker, gh
wayfinder|issue tracker
implement-spec|integration branch, PR, tracker
implement|tracker
domain-modeling|competing GLOSSARY/ADR record
grill-with-docs|competing GLOSSARY/ADR record
caveman-setup|routes LLM traffic through a cloud gateway
caveman-compress|sends file text to a provider, overwrites originals
caveman-discover|cloud
caveman-evidence-review|cloud
caveman-learn|cloud, edits agent files
caveman-manage|cloud
caveman-optimize|cloud
caveman-stats|cloud
cavecrew|needs subagents that do not exist
claude-handoff|needs a Claude background agent
git-guardrails-claude-code|writes .claude/settings.json
claude-api|description 1068 chars (limit 1024), unrelated
deploy-to-vercel|deploys to a third party
vercel-cli-with-tokens|deploys to a third party
vercel-optimize|needs Vercel
vercel-react-native-skills|React Native, not this project
brand-guidelines|applies Anthropic colors and fonts over the project's tokens
```

Batch 2 — duplicated workflows (name|canonical replacement):

```text
surgical-patch|focused-fix
systematic-debugging|diagnosing-bugs
investigate-first|diagnosing-bugs
tdd|test-driven-development
caveman-explore|repo-explore
grill-me|grilling
```

Reasons: `surgical-patch` is a strict subset of `focused-fix` (narrowest layer, regression proof, focused
gate) and `focused-fix` adds this repo's commands, stop conditions and report format.
`systematic-debugging` and `investigate-first` share the "any bug or failing test" trigger and the
root-cause-first workflow of `diagnosing-bugs` (feedback loop, minimise, hypothesise, instrument, fix,
cleanup, with a redaction step); `focused-fix` stays the entry for a confirmed defect.
`tdd` and `test-driven-development` both enforce red-green on features and bugfixes;
`test-driven-development` is kept because it needs no user confirmation per seam and is the background
skill `writing-skills` names. `caveman-explore` is a subagent prompt that demands an evidence-only reply, which
would replace the main agent's answer when loaded as a skill, and `repo-explore` covers the same
question with this repo's layout. `grill-me` is a one-line redirect to `grilling`.

Restore one skill: `cp -r .agents/skills/<name> .kiro/skills/<name>` (the six project skills come from
`.opencode/skills/` and need `name:` set to the folder name, as in the current `.kiro/skills/` copies).
Restore all batch 2:

```bash
for n in surgical-patch systematic-debugging investigate-first tdd caveman-explore grill-me; do
  cp -r ".agents/skills/$n" ".kiro/skills/$n"
done
```

The six project skills in `.kiro/skills/` differ from `.opencode/skills/` by one line each: `name:` was
changed from e.g. `Session Start` to `session-start` (the Agent Skills name format).

## 4. Skills: inspected vs executed

- **Inspected** (full text of the SKILL.md): focused-fix, systematic-debugging, diagnosing-bugs,
  investigate-first, surgical-patch, tdd, test-driven-development, repo-explore, caveman-explore, grill-me,
  grilling. Key directives of the batch 1 skills were read by `grep` with context, not end to end.
- **Metadata validated by script** for all 70 remaining skills: YAML frontmatter parses, `name` equals the
  folder and matches `[a-z0-9-]+`, `description` present, longest 993 characters (limit 1024).
- **Activated** through Kiro's skill loader: `session-start`, `repo-explore` (loaded and read), and `tdd`
  (confirmed gone: "no skill found"). The loader's available list equals the 70 folders on disk.
- **Not executed**: no skill's workflow was run. Behaviour of the remaining skills is unverified.

## 5. Remaining duplication and uncertainty

- Still overlapping, left alone (out of the requested scope): `verification-before-completion`,
  `verify-and-stop`, `target-verify`, `runtime-verify`; `code-review`, `requesting-code-review`,
  `caveman-review`; `skill-creator`, `writing-skills`, `writing-for-agents`; `handoff`.
- Dangling mentions of removed skills inside third-party copies (not rewritten): `code-review` tells the
  user to run `/setup-matt-pocock-skills` for tracker config; `improve-codebase-architecture` calls
  `domain-modeling`; `caveman*` mention `/caveman-compress` and `/caveman-stats`; `writing-skills` uses
  `systematic-debugging` as a formatting example. Harmless unless that branch of the skill is followed.
- opencode still loads all 104 skills from `.agents/skills/`, including the batch 1 set.
- Code comments out of scope but stale: `src/domains/registry.client.ts` keeps an "Unavailable domains" banner
  above Api-backed getters; the `backend/routes/api.php` media comment says learning and branding bytes
  are unserved while `MediaPolicy` already authorizes them; `src/domains/library/apiRepository.ts` header says
  `mediaId` names a file the server does not hold.
- `git-safety.md` suggests `git add --refresh .`; `git update-index --refresh` avoids the `git add` prompt.
- Environment failure, not a defect: the `projectState` case above is within a few seconds of its fixed 30 s timeout on this machine and flips with load. Nothing in this change feeds it (the four required docs and HEAD are unchanged).
- Not verified: browser QA; the full frontend suite (not run: no application code changed); the CI result.

## 6. Git inventory — preserved, nothing deleted

Measured 2026-10-29, read-only (`git ls-remote` does not change local refs).

- HEAD: `arena/01a10b63-parsian-music-dashboard-opus`, level with its remote. Staged: 0.
- Local `arena/*` branches: 9, not 8. Six have an upstream that is gone from the remote:
  `01a07116` (292b8b8), `01a07c61` (f8c3472), `01a0b059` (d6430df), `01a0c8a7` (7180082, also tag
  `archive/project-state-gate-7180082`), `01a0c8b5` (bb275d6, also tag `archive/mountain-sanctuary-bb275d6`),
  `01a0e27f` (455fc1f). `01a0e3c0` is level with its remote, `01a0f73f` is 15 behind it.
- Unique commits: for every local `arena/*`, `fix/browser-qa-2e375f3f`, `main` and `local/main-sync`,
  `git rev-list --count <branch> --not --remotes --tags` is 0. Nothing exists only on a gone branch.
- Remote heads (`ls-remote`): `arena/01a0e3c0`, `arena/01a0f73f`, `arena/01a10b63`, `arena/18b97e50`,
  `arena/2e375f3f`, `backup/pre-f2-2026-09-29`, `cleanup/demo-migration-lineage`,
  `docs/demo-migration-plan`, `main`.
- Worktrees besides this one: `../qa-fix-2e375f3f` (branch `fix/browser-qa-2e375f3f`, 44a4f3f, **19 uncommitted
  entries**) and `../qa-candidate-44a4f3f` (detached, **8 uncommitted entries**). Their changes exist nowhere else.
  Not touched.
- Stash: `stash@{0}` "local fflate range change before arena sync" (one-line `package.json` change). Not touched.
- Tags: six `archive/*`. Untouched.

## 7. Checks run

| Check | Result |
|---|---|
| `php artisan test --filter='RoomsTest\|InvoiceTest\|GalleryTest\|ResourceTest'` (sqlite memory) | 66 passed, 607 assertions |
| `php artisan test --filter='MediaTest\|LearningMediaTest'` (sqlite memory) | 18 passed, 69 assertions |
| `vitest`: permissionParity, registryClient, targetCopy, architectureBoundaries | 4 files, 55 tests passed |
| Skill metadata script, dangling-reference scan | 0 problems; 7 skills mention removed names |
| `vitest run src/__tests__/projectState.test.ts` (whole file) | 51 passed, **1 timed out**: "no document quotes a commit that does not already exist" took 31.8 s against its own 30 s budget (machine load average about 5.5) |
| same case alone (`-t`) | passed in 25.5 s, 5 s under the budget |
| batched re-implementation of that case's assertion | 102 unique 40-hex SHAs in the four required docs; all are commits, all reachable from HEAD except `251af96…` and `94d32de…`, the two preserved tips the test exempts (`PRESERVED_BRANCH_TIPS`). The four docs have no diff |

Backend runs used the working tree, which includes the pre-existing `MediaTest.php` edit.
