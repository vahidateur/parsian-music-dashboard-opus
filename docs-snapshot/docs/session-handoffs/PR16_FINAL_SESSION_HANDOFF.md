# PR #16 FINAL SESSION HANDOFF — Library document preview + auth role-policy boundary

> This file is the durable closeout of the session that produced PR **#16**. Conversation memory is
> not durable; **this file, the Git history and the test suite are**. Every claim below is either a
> file:line a reader can open, a command a reader can re-run, or a number that suite produced in a
> named environment. Where something was *not* verified, it says so.
>
> Siblings: [../engineering/SESSION_HANDOFF.md](../engineering/SESSION_HANDOFF.md) (the rolling
> handoff) · [../engineering/PROJECT_STATE.md](../engineering/PROJECT_STATE.md) ·
> [../engineering/PHASES.md](../engineering/PHASES.md) · [../engineering/DECISIONS.md](../engineering/DECISIONS.md) ·
> [../engineering/OPEN_ITEMS.md](../engineering/OPEN_ITEMS.md)

**Recorded:** 2026-09-26 · **Nature:** documentation-only. Nothing in this file authorizes a product,
test, dependency, governance-law, backend or Git-history change.

---

## 1. Session State

| Field | Value |
|---|---|
| Repository | `vahidateur/parsian-music-dashboard-opus` |
| Working branch | `arena/01a0daeb-parsian-music-dashboard-opus` |
| Base | `main` @ `6c9aa4ccdc3e0a36d7bf3ff1d05d5c6e2149ccbc` |
| Head at closeout | `8fa81a19a03b315bd4edb368143c9b5069137876` (previous head `ac91864d8e6e9f38c7d915cd1765b803127b2dae`) |
| PR | **#16**, `state=open`, **`merged=false`**, `mergeable=true`, `draft=false`, 2 commits, 7 files, **+734/−1** |
| Merge status | **NOT MERGED, deliberately.** The owner reviews and merges; no agent in this session merged or was authorized to. |
| Lineage | `main` → `ac91864` → `8fa81a1`, linear, no merge commit, no rebase, no force-push. `compare main…head`: `status=ahead ahead_by=2 behind_by=0` → still a clean fast-forward. |
| Preserved WIP branch | `arena/01a0cefa-parsian-music-dashboard-opus` @ `eb973eb` — **untouched**, see §8 |
| Point where the next session starts | §11 |

**How to re-verify this table in one command:** `git ls-remote origin refs/heads/main
refs/heads/arena/01a0daeb-parsian-music-dashboard-opus
refs/heads/arena/01a0cefa-parsian-music-dashboard-opus` plus
`gh api repos/vahidateur/parsian-music-dashboard-opus/pulls/16`. The **remote is authoritative**; a
local clone's ancestry is not.

**Sandbox caveat that cost this session real time, recorded so the next one does not repeat it.** The
Arena checkout's `.git` is not a valid oracle for this work: its `HEAD` was pinned at the *other*
branch's tip (`eb973eb`), it is a **shallow** clone whose `remote.origin.fetch` was restricted to
`main`, and `git status` therefore reports ~107 phantom-dirty entries for files whose content matches
the PR head byte-for-byte. Nothing in this session repaired it, and nothing needed repairing: **all
verification and all mutation ran in throwaway full-history clones under `/tmp`,** and the sandbox
checkout was held read-only. Two further lessons, both measured:

1. `/tmp` is **not** durable across a sandbox recycle — a verified fix and its patch file were lost
   mid-session and had to be re-materialized. Persisted state lives in **Git**, so the durable fix is
   the pushed commit, not a scratch file.
2. A shallow clone makes `src/__tests__/projectState.test.ts` fail (9–10 cases) for environmental
   reasons. Those failures are **not** regressions and must never be reported as such; they vanish
   entirely on a full clone (§5).
3. That same gate reads the four `docs/engineering/` registers and checks that **every backticked
   repository path resolves as a real file**: it strips a single `:123` line suffix, but **not** a
   `:123-456` range, so a range inside backticks fails the suite. Write "lines 123–456" outside the
   backticks. This bit the document you are reading, was caught before commit, and is why a
   documentation-only change here re-runs the gate rather than assuming prose is free.

---

## 2. What Landed in PR #16

**Commit 1 — `ac91864` · `feat(library): preview stored documents; reset role policy at session boundaries`**
7 files, +644/−1. Two independently scoped items the owner selected after a review of `main`; both are
additive on top of `main` and neither re-implements anything that had already landed via PR #15
(`8ec766c2d53a…`, merged as `6c9aa4c`).

- *Library document preview.* The media contract stores real bytes for exactly two document types
  (`ALLOWED_DOCUMENT_TYPES = ["application/pdf", "text/plain"]`, `src/domains/media/types.ts:103`), yet
  the detail drawer offered only a download. Download is the honest floor for a file held in this
  browser, not the ceiling: the drawer can now also open what it already has.
- *Role policy at session boundaries.* The role-policy projection is **module-scoped** so that
  synchronous gates can read it, which means it outlives a session unless someone clears it. Between
  "a new session is known" and "its policy has been read", gates were answered from the **previous
  user's** role edits. `clearRolePolicies()` now runs at all three boundaries (§4).

**Commit 2 — `8fa81a1` · `fix(library): report a broken text read; make preview focusable`**
2 files, +103/−13. Two defects found while reviewing commit 1, both confined to `ResourcePreview.tsx`
and its test — no view change, no new surface, no governance edit:

- *Failed text read.* `blob.text()` rejection reset the read result to the same value the pending state
  renders, so a file whose decode failed displayed «در حال خواندن متن فایل…» **forever** while the
  comment beside it claimed a failure was reported as no-preview. The read now has explicit
  `idle | reading | failed | ready` states (`TextRead`), a rejection renders a failure, and an
  outstanding read can never render as an empty document.
- *Keyboard access to the clipped text.* `Drawer` keeps focus inside itself while it is open, so a
  `max-h-[360px] overflow-auto` `<pre>` with no tab stop left the remainder of a long note unreachable
  without a pointer. The block is now a focusable, labelled region.
- *Bonus, same code path:* returning to `reading` when the blob changes also stopped the drawer from
  showing the **previous** file's text while the next file was unread (§3, measured in §6).

---

## 3. Library Preview Architecture — decisions a later session must not silently undo

All of this is in `src/domains/library/ResourcePreview.tsx` (193 lines) and is enforced by
`src/domains/library/__tests__/resourcePreview.test.tsx` (15 cases) plus
`src/views/__tests__/libraryDocumentPreview.test.tsx` (3 cases).

1. **One surface, no route.** The preview lives inside the existing detail drawer
   (`src/views/Library.tsx:639`, `<ResourcePreview file={file} previewUrl={previewUrl} kind={open.kind} />`).
   No new page, no new hash route, no new modal.
2. **The component never owns an object URL.** `src/domains/media/useMedia.ts`'s `useMediaObjectUrl` is
   the sole creator/revoker; `ResourcePreview` receives `previewUrl` as a prop and
   `URL.createObjectURL` appears nowhere in it (documented at `:24`). The view asks for the URL only
   where one is used — `needsPreviewObjectUrl` (`:73`) — so a text note never allocates one. Revocation
   on drawer close and on row switch was probed at runtime, not just asserted (1 create + 1 revoke;
   then 2 creates with the previous URL revoked once).
3. **Nothing is ever embedded.** No `<iframe>`/`<embed>`/`<object>`, for any type. The production CSP
   ships `object-src 'none'` **and** `frame-src 'none'`, and `vite.config.ts` sends
   `X-Frame-Options: DENY`, so a `blob:` frame would render an empty box that merely *looks* like a
   preview. The only legitimate embed-free affordance is
   `<a href={blobUrl} target="_blank" rel="noreferrer">`, matching the shipped `MessageAttachment`.
   `navigate-to` is not part of the policy, so that link works.
4. **Availability is derived, never duplicated.** `isPreviewableMimeType` (`:64`) reads
   `ALLOWED_DOCUMENT_TYPES` from the media contract, so preview and storage cannot drift apart. A
   private MIME list here is the failure mode this avoids.
5. **Text preview reads real bytes.** `text/plain` renders from the same `Blob` the download uses —
   no second read, no cache, no synthesized content — with `whitespace-pre-wrap` so newline fidelity
   survives (a fingering note is not a paragraph).
6. **Three honest non-preview states, and only these.**
   - *bytes not there* (`file.status === "missing"`, e.g. a restore that returned metadata only): the
     component returns `null` and the drawer's existing explanation carries the state. Nothing is
     invented, including no fabricated `href`.
   - *URL not landed yet*: an explicit «در حال آماده‌سازی پیش‌نمایش…» line, never a link to a URL
     built locally.
   - *decode failed*: a failure sentence that also states the stored bytes are intact and that
     «دریافت» returns them. A failure is never rendered as an empty document, and never as progress.
7. **`video` has no preview and says so.** No video MIME type passes the media allow-list, so there can
   never be stored bytes to play; the component states the absence instead of mounting dead controls.
   (The pre-existing ordering nit — the `video` branch at `:91` is checked before readiness — is
   harmless: the component returns `null` while unresolved, so nothing lies. Recorded, not fixed.)
8. **Keyboard-accessible scroll region.** `<pre>` carries `role="region"`, `tabIndex={0}` and a
   filename-bearing `aria-label`. `role="region"` is load-bearing, not decoration: `aria-label` on an
   unnamed generic element is ignored by assistive tech, so without a namerole the label would not be
   announced. The visible focus ring comes from the global `:focus-visible` rule
   (`src/index.css:463`) — no new style, no invented token. Precedent for the `role`+`tabIndex`+
   `aria-label` triple in this very domain: the seek control in `src/domains/library/AudioMessagePlayer.tsx:261`.
9. **The drawer focus trap is the reason, and it is tested.** `src/__tests__/a11yGate.test.tsx` proves
   `Drawer` traps focus; `a11yGate` stays green with this change.
10. **Size ceiling.** Documents are capped at `MAX_DOCUMENT_BYTES = 20 MiB` (`src/domains/media/types.ts:108`),
    which is why reading the whole text blob into memory here is acceptable; a PDF row costs two
    `getBlob` reads (accepted, detail view only) to keep single-owner revocation.

---

## 4. Auth Hardening — role-policy projection at session boundaries

In `src/domains/auth/permissions.ts` (lines 176–192) and its three call sites in `AuthContext.tsx`:

- `clearRolePolicies()` replaces **only** the module-scoped projection `Map<RoleId, RolePolicyRecord>`
  and calls `emitPolicy()`. It early-returns when `policy.size === 0`, so a clear on a cold cache costs
  nothing and emits nothing.
- `session.permissions` — the issued set — is **not** touched. After a clear, gates fall back
  deterministically to the current session's own issued permissions rather than to another user's role
  edit. That fallback is the whole point: it must not be "fixed" by caching the previous matrix.
- `policyVersion` (`permissions.ts:132`, bumped in `emitPolicy` at `:135-136`) is the identity
  `useSyncExternalStore` watches; `getRolePolicyVersion()` (`:200`) feeds
  `useRolePolicyVersion()` in `AuthContext.tsx:138`, and the session effect re-runs on it (`:148`).
  A clear therefore propagates instead of leaving subscribed UI on the stale value.
- **Ordering is load-bearing.** On restore, `clearRolePolicies()` runs **immediately before**
  `setSession(restored)` (`:71-73`) — clearing after would let one render answer gates from the old
  matrix. Login clears after the clock reset and before `setSession(next)` (`:96-97`). Logout clears
  **inside `finally`** (`:116-118`), so a failing `repo.logout()` cannot leave the previous user's
  matrix published.
- **Known residual race (recorded, not hidden):** `useRolePolicySync` deliberately keeps the previous
  projection when a policy *read* fails, so an outage of the role service makes a stale matrix persist
  for the session rather than flicker. The boundary clears close the cross-user case; they do not turn
  a failed read into a guaranteed-fresh one. Anything further belongs to the backend/governance track,
  not to a UI patch.
- **Regression coverage:** `src/domains/auth/__tests__/roleTransition.test.tsx` (3 cases, +191 lines)
  asserts restore/login/logout coverage and the ordering. Case 3 guards the *opposite* regression
  (clearing so aggressively that a legitimately loaded policy is discarded).

---

## 5. Verification Record — what was actually run, and where

Two environments, because the sandbox checkout cannot be trusted for git-derived output (§1):
**E1** = `/tmp/prqa`, `--depth=3 --single-branch` clone of `ac91864` (final review of commit 1);
**E2** = fresh **full-history** clones of the PR branch (188 commits, `is-shallow-repository=false`),
used for the fix at `ac91864` and re-run byte-identically at `8fa81a1` before commit/push.

| Check | Result | Environment |
|---|---|---|
| `npm ci` | exit 0 (never `npm install` — a docs gate asserts the `npm ci` wording) | E1, E2 |
| `npm run typecheck` (`tsc --noEmit`) | **exit 0** | E1, E2 |
| `npm run build` | exit 0 — `index 445.65 kB│127.58`, `academicViews 251.65│61.17`, `operationsViews 195.07→**195.64**│52.39`, `vendor 192.35│60.29`, CSS `140.70│19.54` | E1, E2 |
| bundle budget | **green, no re-baseline needed** (the D9-A-lite anchor/cap of DECISIONS §22 stands; only the `operationsViews` chunk moved, +0.57 kB) | E2 |
| targeted Library (domain + view) | **8 files / 92 tests passed**, incl. `resourcePreview` 15 and `libraryDocumentPreview` 3 | E2 @ `8fa81a1` |
| auth | `roleTransition` **3/3 passed** | E1, E2 |
| **full suite, final** | **2495 total / 2495 pass / 0 fail / 0 pending**, `vitest exit 0` | E2 @ `8fa81a1` |
| full suite, re-run at this documentation-only commit | **2495 total / 2482 pass / 0 fail / 13 pending** — the pending set is hour-conditional, both runs are failure-free | E2 (`/tmp/handoff`) @ `8fa81a1` + these docs |
| `projectState.test.ts` alone, after the doc edit | **52 passed / 52** | E2 |
| **full suite, baseline** | **2492 total / 0 fail** (2479 pass + 13 pending) at `ac91864` on a full clone ⇒ the fix adds exactly **+3 tests and no failure** | E2 @ `ac91864` |
| same suite in the shallow env | 2492 / 2482 pass / 10 fail, all in `projectState.test.ts`; after creating `refs/remotes/origin/main` **inside the throwaway clone only**, 10 → 9 == pristine-`main` baseline ⇒ **0 new failures**, proven not asserted | E1 |
| date-dependent tests (scheduling/teacher fixtures) | pass on the full clone; their intermittent reds are environmental (S4/Friday class), out of scope, **not** fixed | E1, E2 |
| `git diff --check` and `git diff --cached --check` | **exit 0**; added-line hygiene: trailing space/tab 0, space-before-tab 0, CRLF 0, conflict markers 0 | E1, E2 |
| scope audit | PR = exactly 7 files; the fix commit = exactly 2; 0 files touched outside the two allowed; 0 governance docs; no untracked non-ignored additions | E1, E2 |
| `gh pr checks 16` | **no checks reported** — the repo has no CI; local gates are the only automated signal | E1, GitHub |

**Not verified:** Browser QA (§9). No claim of visual or real-viewer verification is made anywhere in
this file, and none should be inferred from the numbers above.

---

## 6. Mutation / Regression Evidence — the tests were proven to bite

A green suite only proves the tests pass; it does not prove they *can* fail. Each mutation below was
applied, the suite re-run, and the file restored and hash-verified against its `HEAD` blob.

| # | Mutation (deliberate break) | Where | Caught by |
|---|---|---|---|
| M1 | remove the `ResourcePreview` wiring (unmount it from the drawer) | E1 @ `ac91864` | 2/3 `libraryDocumentPreview` cases fail |
| M2 | add an `<iframe src={previewUrl}>` | E1 | 1/12 `resourcePreview` cases fail («embeds nothing…») |
| M3 | fabricate an `href` when no object URL has landed | E1 | 1/12 fail («waits instead of inventing a URL…») |
| M4 | drop the `ALLOWED_DOCUMENT_TYPES` gate for a private MIME list | E1 | 1/12 fail (allow-list drift case) |
| M5 | remove **all three** `clearRolePolicies()` calls | E1 | 2/3 `roleTransition` cases fail |
| M6 | remove only the restore + login clears, keep logout (a *partial* fix) | E1 | 2/3 fail — the suite catches a half-done boundary reset |
| M7 | revert `ResourcePreview.tsx` to its pre-fix `ac91864` blob, keep only the new tests | E2 | the failed-decode case **and** the keyboard case both fail (13/15 pass) — each reported defect has a test that bites; the third new case passes pre-fix by design, since it guards the `idle` state the fix introduced |
| M8 | render a text file whose `blob.text()` never resolves, then switch rows on the pre-fix component | E2, scratch test | **pre-fix: fail** (`expected <pre …> to be null` = the previous file's text was still on screen); **post-fix: pass**; scratch test then deleted, so it is not in the delivered diff |

Two further integrity controls, both worth repeating:

- **Object-URL ownership at runtime**, not by reading code: two throwaway tests inside E1 proved one
  create + revoke of exactly that URL on drawer close, and 2 creates with the previous URL revoked once
  on row switch. Scratch files removed; tree verified clean afterwards.
- **Byte-identity after a sandbox recycle**: when `/tmp` was wiped, the fix was re-applied and accepted
  only because both files hashed to the recorded post-fix blobs (`7ff3640`, `439cb0a`) and the pre-fix
  blobs had matched (`5dcf68d`, `0c92f14`). A single doubled `\\n` in one inserted test line was caught
  by exactly that check. **Hash the content, never the narrative.**

---

## 7. Scope — what is in PR #16, and what was left out on purpose

The PR touches exactly these 7 paths (GitHub per-file numbers at head `8fa81a1`):

| File | Change |
|---|---|
| `src/domains/library/ResourcePreview.tsx` | added, +193/−0 (159 lines at `ac91864`, 193 at `8fa81a1`) |
| `src/domains/library/__tests__/resourcePreview.test.tsx` | added, +201/−0 (12 cases → 15) |
| `src/views/Library.tsx` | modified, +15/−0 |
| `src/views/__tests__/libraryDocumentPreview.test.tsx` | added, +112/−0 |
| `src/domains/auth/permissions.ts` | modified, +14/−0 |
| `src/domains/auth/AuthContext.tsx` | modified, +8/−1 (the PR's **only** deleted line: the import rewrite) |
| `src/domains/auth/__tests__/roleTransition.test.tsx` | added, +191/−0 |

Intentionally **not** in scope, and not touched by any commit: `src/domains/library/useLibrary.ts`,
`useMedia.ts`, `Drawer`/`a11yGate`, `AccessGate.tsx`, `MessageAttachment`, `src/domains/media/**`,
`src/domains/gallery/**`, every view other than `Library.tsx`, and every document under
`docs/engineering/**` except the three files this closeout writes. The PR introduces no new route,
store, dependency, or storage semantics.

---

## 8. Explicit Exclusions

Recorded as **intentional**, each one a decision the owner made — not an oversight, and not licence for
a later session to "finish" them quietly:

- **`main`** — never changed by this session. Still `6c9aa4ccdc3e0a36d7bf3ff1d05d5c6e2149ccbc`.
- **`arena/01a0cefa-parsian-music-dashboard-opus`** — still `eb973eb`, untouched.
- **`eb973eb` ("feat: complete gallery library resource architecture") is protected WIP.** It was
  reviewed, then **explicitly excluded** from PR #16 and must not be merged, cherry-picked, or
  re-implemented from this file. Its architecture (a parallel `domains/resources/*` surface plus
  `media/storage.ts` / `storageEstimate.ts`) overlaps the frozen Gallery work and was not accepted.
  Its auth-context insertion was also *not* copied: it orphans `getRolePolicy`'s doc comment, so the
  committed version inserts before that comment.
- **`vite.config.ts`** — untouchable. Blob-identical to `main` at both heads (`72f80d0a…`), i.e. the
  `X-Frame-Options: DENY` header and CSP are exactly as `main` ships them; no header was removed to
  make a preview "work".
- **`src/domains/media/storage.ts`, `storageEstimate.ts`, `src/domains/resources/**`** — absent from this
  branch's tree (verified 404 against the head tree). Do not resurrect them.
- **Gallery** — out of scope; its honesty work landed separately in PR #15 and must not be re-opened here.
- **Governance documents** — `PROJECT_STATE.md`, `PHASES.md`, `OPEN_ITEMS.md`, `GOVERNANCE_CHECKPOINT.md`
  are **not** edited by PR #16; see §10 for the deliberate follow-ups.
- **Unrelated architecture WIP** — I22, I23, I14, and the S4/Friday date-dependent reds were explicitly
  out of scope and remain so. Nothing was deleted or "fixed" to make a suite green.
- **`2f4675f9…` is not a real commit.** GitHub returns 422 *No commit found for SHA*. It appears in
  earlier session lore as a hardening commit; it is **unusable as a source** and must not be recreated
  from memory.
- **Browser QA** — not performed (§9).
- The **`text-right` vs `dir="auto"`** bidi nit, the second `getBlob` read for PDF rows, and the
  element-coupled `expect(preview.tagName).toBe("PRE")` were all noted in review and **deliberately
  not changed** in PR #16.

---

## 9. Browser QA — **NOT VERIFIED**

**Disposition: `NOT VERIFIED`.** No browser engine existed in the sandbox (`node v22.22.3`, `npm 10.9.8`,
**no chromium / playwright / puppeteer**), so no visual, real-file-picker, real-download or
real-PDF-viewer check was performed. This matches `PROJECT_STATE.md` §5, which already records Browser
QA as not verified. **Do not report any of the following as passed** until a human does it.

A dev-server smoke check *was* possible and *was* done at `ac91864` (HTTP 200 for `/` and for the three
changed modules, empty server error log, emitted `ResourcePreview` module contains
`ALLOWED_DOCUMENT_TYPES` ×2 and `target="_blank"` and **no** `iframe`; response headers carried the
CSP and `X-Frame-Options: DENY`). That is a module-graph smoke test, **not** Browser QA, and it is not
counted as such here.

Checklist for the human pass — the demo seed stores a `text/plain` file only
(`DEMO_LIBRARY_MIME_TYPE`), so the PDF rows must be created by uploading one (the upload accept-list
does allow `application/pdf`, 20 MiB cap):

1. text preview renders the stored note's actual content in the drawer;
2. newlines preserved in the rendered note (no paragraph collapse);
3. row switching: select another file, confirm no flash of the previous file's text;
4. PDF row: «باز کردن پیش‌نمایش» opens the stored file in a new tab from the object URL;
5. missing-bytes state (restore metadata-only) shows the explanation and **no** preview area;
6. unsupported/video state shows the stated absence, not dead controls;
7. drawer open/close, including focus return to the triggering row;
8. keyboard: `Tab` reaches the text region, arrows/space/PgDn scroll it, focus ring visible;
9. visual overflow at 360 px cap, RTL layout, long filenames in the `aria-label`;
10. console and network clean during all of the above.

---

## 10. Documentation Debt / Follow-ups (deliberately NOT in PR #16)

Each of these was found, confirmed real, and left undone because the PR's scope was locked to the two
approved items and then to the two fixes. They are **documentation-only** follow-ups for a separate
commit after merge; none of them is test-enforced, which is exactly why they need recording here:

1. `PROJECT_STATE.md` test inventory does not list `resourcePreview.test.tsx`,
   `libraryDocumentPreview.test.tsx` or `roleTransition.test.tsx` (verified: no occurrence in
   `PROJECT_STATE.md`/`OPEN_ITEMS.md` at this head).
2. `PROJECT_STATE.md` §5 Browser QA has no row for the new preview surface — it should inherit the
   NOT VERIFIED disposition and the §9 checklist above.
3. `OPEN_ITEMS.md` carries no item for the Library preview surface or the decode-failure state.
4. **Pre-existing on `main`, not caused by PR #16:** `src/domains/library/README.md` and
   `src/domains/auth/README.md` both still read «Planned domain — **not implemented in Phase A**»,
   byte-identical to `main`, while both domains are implemented. Retiring this class of contradiction
   was registered for scheduling/attendance only; no gate covers the library/auth READMEs.
5. `docs/engineering/SESSION_HANDOFF.md`'s §1 «Canonical state» rows (SHAs, working branch
   `arena/01a0cef8` @ `046771d`, "D1 not yet pushed") are **stale**; they describe 2026-09-21. This
   file is linked from that document as the live pointer rather than rewriting those rows.
6. `DECISIONS.md` §23 records the durable decisions of this work. Its own convention asks a
   test-protected decision to be linked from `PROJECT_STATE.md` §6; that link is **deferred with the
   rest of this list**, because `PROJECT_STATE.md` is excluded from PR #16.

---

## 11. Next Session Start Point

Authoritative state assumed: PR **#16 OPEN**, **unmerged**, head `8fa81a19a03b…`, base `main`
`6c9aa4ccdc3e…`, `mergeable=true`, **no CI configured**, so local gates are the only signal.

```
NEXT SESSION START
1. Re-verify, read-only, before anything else:
   git ls-remote origin refs/heads/main refs/heads/arena/01a0daeb-parsian-music-dashboard-opus \
     refs/heads/arena/01a0cefa-parsian-music-dashboard-opus
   gh api repos/vahidateur/parsian-music-dashboard-opus/pulls/16
   If main has moved past 6c9aa4ccdc3e…, STOP and reconcile before touching anything.
2. Build a FULL-history clone of the PR branch (never a shallow one, never the sandbox checkout's
   .git) and re-run the gates there: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`.
   Expect 2495/2495 pass, 0 fail. Treat any projectState/date-dependent red as environmental until
   proven otherwise in that same clone.
3. Perform Browser QA using the §9 checklist (upload a real .pdf; the demo seed has none). Record the
   result honestly in PROJECT_STATE.md §5 — pass or fail, never "assumed".
4. If QA passes: the owner reviews PR #16 and merges. Agents do not merge, rebase or force-push; the
   PR is a clean fast-forward (ahead_by=2, behind_by=0) if main has not moved.
5. After merge, in a separate documentation commit on a fresh branch: apply every item in §10
   (test inventory, §5 QA row, OPEN_ITEMS entry, README reconciliation, SESSION_HANDOFF §1 refresh,
   the deferred DECISIONS §23 ↔ PROJECT_STATE §6 link).
6. Do NOT resurrect eb973eb's Gallery/resources/storage architecture, do NOT touch vite.config.ts,
   do NOT re-open PR #15's landed work, do NOT chase 2f4675f9 (it does not exist).
7. Reproduce any of this session's claims from code + git + GitHub API only. This document is the map;
   the repository is the territory.
```
