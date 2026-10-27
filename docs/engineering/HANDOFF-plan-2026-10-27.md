# HANDOFF — Post-audit stabilization & next-phase plan, 2026-10-27

> Planning and inspection only. No code, test, or doc changes except this
> file. No staging, commits, pushes, merges, resets, checkout, cleanup, or
> database operations. `PROJECT_STATE.md` untouched. All prior uncommitted
> work preserved (~181 files, nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 commits ahead of origin — see §3.4)
```

## 1. Starting point (verified read-only)

- Read: `HANDOFF-audit-final-2026-10-27.md` (primary), `-2026-10-24` audit,
  chat, gallery, rooms, learning, instruments handoffs. **There is no
  `HANDOFF-media-2026-10-23.md`** — the file was never written; media
  evidence lives in code + `MediaTest` + the audits. Do not assume it exists.
- Re-verified today, not re-assumed: backend suite **402/2792 green**;
  composition/parity/invalidation/chat/gallery api contracts **69/69
  green**; registry = 18 served getters + unavailable `{branding,
  compensation}`; every Api repository bumps on accepted writes only.
- The three load-flake files re-run green in isolation today (36/36,
  §3.1–3.3); the `projectState` failure reproduces (expected, §3.4).

## 2. The four triaged failures — exact record

Repro commands use the repo Node (`nvm use`, v22.22.3). Do not weaken
assertions or touch product code for any of these.

### 2.1–2.3 Load-sensitive (pass in isolation, fail under full-suite load)

| Test | Repro (isolation, green today) |
|---|---|
| `src/views/__tests__/deepLinkPagination.test.tsx` › I16 Students/Teachers › "existing entity beyond first 200 → detail loads" (2 tests) | `npx vitest run src/views/__tests__/deepLinkPagination.test.tsx --testTimeout=30000` → 11/11 |
| `src/views/__tests__/settingsHonesty.test.tsx` › "saving a session rule writes it through the repository" | same pattern → file 15/15 |
| `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` › "saving the academy's identity never calls it demo data" | same pattern → file 10/10 |

Likely cause: wall-clock timeouts under full-suite parallel load (observed
durations 5–10s in failing runs vs ~2s isolated). These tests build large
datasets and wait on real timers. Safest next diagnostics (no code changes):
re-run each file with `--testTimeout=30000` (done, green); then run the
pair `deepLinkPagination + settingsHonesty` together to see if contention
reproduces at smaller scale; inspect per-test durations for the slowest
setup step. Any fix (timeouts, sharding, worker count) is test-infra only.

### 2.4 Environmental (fails consistently, unrelated to code)

- `src/__tests__/projectState.test.ts` › "the recorded checkpoints are real
  Git objects" › "the recorded working branch is a durable branch, in step
  with its remote" — repro: `npx vitest run src/__tests__/projectState.test.ts`
  → 1 failed / 52. Local `d354f001` vs `origin/…@b8f06bf`: the branch is 4
  commits ahead. Push is forbidden, so this cannot go green by any allowed
  action, and the assertion must not be weakened. No action; owner decides
  when/how the branch syncs.

## 3. Prioritized backlog

### P0 — Test reliability & environment (no product risk, unblocks signal)

- **T1. Full-suite load flakes (§2.1–2.3).** Value: trustworthy `npm test`.
  Deps: none. Scope: diagnostics only for now (see above); any change is
  test-infra. Acceptance: 3 consecutive full runs with zero non-env
  failures. Risk: none to product if scoped to infra.
- **T2. Branch-ahead-of-origin (§2.4).** Value: `projectState` green.
  Requires owner-authorized push/sync — explicitly out of scope here.
- **T3. `MessagesChat.test.tsx` leaked-timer warning** (tests pass; teardown
  noise noted in prior audits). Value: clean output. Scope: cancel pending
  timers in that file's harness. Verification: warning gone, tests still green.

### P1 — Branding slice (recommended next, see §5)

- **Value:** removes a login-disclosure item (2→1 unavailable), makes
  Settings → appearance real in production; every viewer sees one identity.
- **Deps:** media read path + `MediaReferences`/`MediaPolicy` (logo/favicon
  already listed as NOT YET — same change, gallery pattern).
- **Scope:** `branding` table (singleton per org: name/tagline/logoMediaId/
  faviconMediaId/colors/font, cf. `BrandingSettings`), `BrandingPolicy`,
  service, 1–2 FormRequests, controller (`GET`/`PATCH`, organization-style),
  `ApiBrandingRepository` + bump, registry wiring, remove from unavailable,
  `useBranding` `visualsAvailable` now true in client, parity + contract +
  composition tests, browser verify.
- **Acceptance:** vocabulary decision recorded (§36-style or settings-reuse
  with rationale); accountant read rules pinned; logo bytes authorized per
  object; empty org shows honest defaults; client bundle carries no
  browser-only storage copy.
- **Verification:** backend matrix tests, frontend contract/invalidation
  tests, 3 typechecks, fresh build scan, live logo upload + cross-role read.
- **Risks:** permission-id choice (new `branding.*` vs `settings.*`) needs
  **explicit owner decision first** — §26.3 forbids silent borrowing;
  `BrandingPanel` currently gates on `settings.write`, which constrains but
  does not settle it.

### P2 — Compensation slice

- **Value:** "جبرانی" view becomes real (private make-up obligations).
- **Deps:** scheduling + attendance (served); no existing Api repo (by design).
- **Scope:** tables + service (register/schedule/complete per repository
  contract), policy, routes, `ApiCompensationRepository` + bump, wiring,
  unavailable −1, tests, browser verify. Permission ids need the same owner
  decision as P1 (new `compensation.*` vs `schedule.*`).
- **Acceptance/Risks:** same shape as P1; larger scope (lineage rules,
  `ALREADY_SCHEDULED`/completion guards) — hence second.

### P3 — Finance/Reports (spec-first, not next)

- Deferred since D6/I2 with no backend contract. Value is large but scope
  is unbounded without a product spec (invoices, payments, subscriptions,
  exports). Recommendation: spec + contract review before any code; do not
  fold into P1/P2.

### P4 — Open decisions inventory (owner input, no guessing)

Chat oversight reads (no admin bypass — upheld); add/remove-participant and
thread/message delete verbs; external provider delivery; first-class
`media.write`; `PROJECT_STATE.md §6` links from §36/§37; learning
eligibility locale tie-break; client-supplied instrument `sortOrder`; gallery
cover-need-not-belong + duplicate titles; name-duplicate collation
(sqlite vs MySQL); dev-DB port 3306 conflict (recipe: local mariadbd 3307).

## 4. Recommendation: Branding first

Smallest (singleton GET/PATCH mirroring organization, media parents already
stubbed as NOT YET), highest visible value (login disclosure 2→1, Settings
appearance functional), lowest risk (no lineage rules, no new UX surfaces —
panels already exist and gate correctly). Blocker before coding: the owner
must choose the permission ids (`branding.*` vs `settings.*`).

## 5. Explicit owner approvals required

1. Permission-id decisions for Branding (and later Compensation).
2. Any branch sync/push (resolves T2).
3. Any database reset/seed/cleanup beyond additive migrations and id-scoped
   probe cleanup.
4. Any merge (none recommended — stale branches hold only unrelated
   cosmetics: demo branding, login redesigns, old test hardening).
5. Any `PROJECT_STATE.md` edit.
