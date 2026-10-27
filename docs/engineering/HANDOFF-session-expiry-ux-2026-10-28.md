# HANDOFF — Session expiry UX finale (boot-restore notice + security-docs truth), 2026-10-28

> Follow-up of `HANDOFF-session-expiry-2026-10-28.md`. Approved policy:
> idle 30 min, absolute 10 h, boot-restore shows an appropriate notice and
> redirects through the existing login flow, server authoritative,
> Bearer-only. No Passkey work in this slice. No migration (none needed).
> No staging/commit/push/merge/reset/checkout. `PROJECT_STATE.md` untouched.
> Working tree holds this slice plus all prior uncommitted work (nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 ahead of origin)
```

## 1. Changes (scope-limited)

**Boot-restore expiry UX.**
- `AuthRepository` gains required `restoreDetailed(): Promise<{session, expiredReason}>`
  (`repository.ts`); `expiredReason` is set **only** for a provable ceiling
  breach — locally outlived token expiry or the server's own idle/absolute
  401 codes ("absolute"/"idle"). Revoked, malformed, missing, disabled-user
  and transport-failure paths stay exactly as silent (or rethrowing) as
  `restore()` was: boot cannot distinguish those states, by design.
- `ApiAuthRepository.restoreDetailed()` implements the mapping;
  `restore()` delegates (contract unchanged for all existing callers).
  `LocalAuthRepository` maps its TTL expiry to "absolute", disabled-user
  to silent — demo boot behavior otherwise unchanged.
- `AuthContext` boot effect consumes it: expired boot restore sets the
  same login-screen notice mid-session expiry uses; any other boot failure
  stays silent; next login attempt clears the notice. No new navigation:
  `AuthGate` already renders login for `unauthenticated`, so status flip
  IS the redirect (no loop — no retry-on-401 exists anywhere).
- **Race fix found live (see §2).** Concurrent `restoreDetailed()` flights
  now share one promise in `ApiAuthRepository`: React StrictMode
  double-mounts the boot effect in dev, and without sharing, the second
  flight reads a store the first is discarding and its silent outcome
  clobbers the reason. Covered by a dedicated test asserting one `/auth/me`
  call and identical outcomes for both flights.

**Security documentation (`docs/security.md` only — statements contradicting
verified code).** Password hashing: frontend holds none / server bcrypts
(with remaining gaps listed); password policy now "partially implemented"
(6-char floor exists; NIST-12/HIBP/context missing); sessions rewritten to
the enforced 30/10 + codes + revocation + frontend-responsibilities truth;
§8 items 1–4,6,7,9,11 and the §9 table updated to DONE/PARTIAL/MISSING per
code evidence. Upload pipeline, backups, and append-only-log rows left
untouched (not verified in this slice — claimed as-is, not as verified).

**Tests (additive only).** `restoreDetailed` reason matrix incl. storage
hygiene (unrelated keys survive; only the session key is dropped);
concurrent-restore single-flight test; AuthContext boot tests (idle notice,
absolute notice, silent revoked, notice cleared on next login, no-notice
on success); real-`LoginView` notice render test; `roleTransition` fake
extended with the new method (contract compile, zero assertion changes).

## 2. Defect found live and fixed: StrictMode double-restore clobbers the reason

Symptom: aged token + full reload → login screen, token revoked
server-side, but **no notice**. Debug showed the boot effect resolving
`{session: null, expiredReason: null}` despite a server-side IDLE revoke.
Cause: dev StrictMode mounts the boot effect twice; flight 1 revokes and
reports "idle" (ignored — unmounted), flight 2 replays against the now-dead
token, gets legacy `AUTH_UNAUTHENTICATED`, reports silence — and wins.
This is not dev-only in principle (any concurrent-restore race), so the
fix is structural (shared flight), not a StrictMode workaround. Verified
after fix by live reload: notice shown; second reload silent; no loop.

## 3. Verification (commands + results, this session)

- `npx vitest run src/domains/auth src/security src/api src/domains/compensation src/views/__tests__/Login.test.tsx src/views/__tests__/loginDemoIsolation.test.tsx src/views/__tests__/loginEmptyEnvironment.test.tsx` → **444 passed**.
- `npm run typecheck`, `tsconfig.client`, `tsconfig.demo` → **all exit 0**.
- `vendor/bin/phpunit` full backend → **OK (439 tests, 3026 assertions)** (no
  backend changes this slice; Compensation/Auth/SessionExpiry suites green).
- Fresh `build:client` + `bundleBoundary` → 6 pass / 2 skipped (demo absent).
- Live (pre-existing dev stack, left running): login → age token 31 min →
  **full reload** → login screen **with the idle notice**, stale token
  cleared from storage, unrelated `localStorage` keys intact, token row
  revoked server-side; second reload → silent login, no duplicate notice,
  no loop. Earlier mid-session path (SPA nav → notice) re-confirmed
  unchanged. Baselines after cleanup: tokens back to pre-slice count,
  compensations 0, sessions 137, rooms 4, students 15.
- Pre-existing failures untouched: `projectState` branch-drift
  (environmental), known load-flaky frontend files (pass in isolation;
  full frontend suite not re-run — standing rule).

## 4. Remaining limitations / explicit non-goals

- Silent boot only distinguishes *proven* expiry; a token revoked between
  loads still lands silently (documented contract, not a gap).
- No security-event audit log, no lockout counter/alerting, no upload
  re-validation evidence, no backup verification — all still MISSING and
  queued, not claimed.
- `docs/security.md` upload/backups/append-only rows describe intent, not
  verified state — left verbatim deliberately.
- Per-tab `sessionStorage` sessions remain: tabs do not share tokens, only
  end-of-session broadcasts and the shared idle clock.
- No Passkey work begun (out of scope for this task).
