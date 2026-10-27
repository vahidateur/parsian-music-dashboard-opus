# HANDOFF — Server-enforced session expiry (idle 30 min, absolute 10 h), 2026-10-28

> Implements slice 1 of `HANDOFF-plan-security-2026-10-28.md` (approved
> policy: **idle 30 min, absolute 10 h**, warning 2 min — the 15-minute
> figures in the task's requirements/test bullets contradict the approved
> policy and were NOT followed; 30/600 are the enforced values everywhere).
> No Passkey/WebAuthn in this slice. No migration (reused `last_used_at`;
> no owner approval needed). No staging/commit/push/merge/reset/checkout.
> `PROJECT_STATE.md` untouched. Working tree holds this slice plus all
> prior uncommitted work (220 files, nothing staged).

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 ahead of origin)
```

## 1. What was built

**Backend.** New `app/Http/Middleware/EnforceSessionExpiry.php`, registered
as `session.expiry` in `bootstrap/app.php` and placed first in the
protected group (`routes/api.php`). On every protected request with a
bearer token it: absolute-checks `created_at` vs 600 min
(`AUTH_SESSION_ABSOLUTE_EXPIRED`, priority), then idle-checks
`last_used_at ?? created_at` vs 30 min (`AUTH_SESSION_IDLE_EXPIRED`);
on breach it deletes the single token row (idempotent under concurrency)
and throws 401 in the unchanged `{error:{code,message}}` envelope with no
token/account detail. Passing requests touch `last_used_at` here — the
sole writer (Sanctum's own touch disabled via
`config/sanctum.php: 'last_used_at' => false`, documented in-file).
Missing/invalid/revoked tokens fall through to `auth:sanctum`'s existing
`AUTH_UNAUTHENTICATED`. Config: new `config/sanctum.php` flag +
`config/session-expiry.php` (`AUTH_IDLE_TIMEOUT_MINUTES=30`,
`AUTH_ABSOLUTE_LIFETIME_MINUTES=600`, documented in `.env.example`).

**Frontend.** `IDLE_TIMEOUT_MS` 20→30 min (warning stays 2 min, absolute
stays 10 h = server value); `ApiClient.onUnauthenticated` now receives the
`ApiError`; registry notifies a single subscriber; `AuthProvider` flips to
unauthenticated exactly once per death (re-entrancy guard — concurrent
401s and the follow-up logout 401 collapse, no loop), leaves a reason
notice rendered on the login screen, and broadcasts ends cross-tab via a
real `storage` event (`ava:session:ended`, reason-tagged; the old
"shared through a storage event" comment described polling only and is
fixed). `SessionGuard` uses the new expiring path; manual logout stays
silent. No polling of the API exists anywhere, so every authenticated
request legitimately counts as activity (verified by grep).

## 2. Load-bearing findings (each demonstrated, not assumed)

- **Middleware priority beats group order.** Laravel sorts `Authenticate`
  ahead of custom route middleware, so `auth:sanctum` runs before
  `session.expiry` regardless of listing. First instrumented run proved it:
  with Sanctum's touch enabled, the check observed an already-fresh
  timestamp and idle could never fire. The real invariant is therefore
  touch-disabled + this middleware as sole writer — order is now
  defense-in-depth only. Re-enabling Sanctum's touch would silently break
  idle expiry (stated in both the middleware and sanctum.php comments).
- **Sanctum's own 720-min expiry still owns the far tail.** Past 720 min
  with no intervening request, the guard rejects first with legacy
  `AUTH_UNAUTHENTICATED` (its priority position). Our 600-min absolute
  fires first on any request inside Sanctum's window — the realistic path.
  `AuthTest::test_expired_token_is_401` documents exactly this boundary
  (updated comment, code expectation unchanged).
- **DB-server clock skew is irrelevant.** Live mariadbd runs ~3.5 h ahead
  of app time (caught during verification: a `NOW()-31min` probe landed in
  the future). All comparisons use app-side `Carbon::now()` for both write
  and read, and live probes used explicit app-time literals. Noted as
  environment quirk, not product issue.

## 3. Verification (commands + results, this session)

- `vendor/bin/phpunit --filter "SessionExpiryTest|AuthTest"` → 26 OK (new
  `SessionExpiryTest`: 11 tests — inside/at/beyond idle, absolute-despite-
  activity, absolute-priority, missing/invalid/revoked, envelope leak scan,
  cross-route, logout-twice documents one-shot server logout, stale-row
  expiry, activity-extends-window).
- `vendor/bin/phpunit` full backend → **OK (439 tests, 3026 assertions)**,
  incl. Compensation + Auth suites.
- Frontend: new `sessionExpiry` suites (auth shell 6 incl. real-`LoginView`
  notice render + logout-failure resilience; `security` constants/broadcast
  4) + `client.test.ts` code-propagation cases → targeted files green;
  `src/domains/auth + src/security + src/api + src/domains/compensation` →
  **32 files / 402 tests pass**; `typecheck` + client + demo `tsc` exit 0;
  fresh `build:client` + `bundleBoundary` 6 pass / 2 skipped (demo absent).
- Live (pre-existing stack, left running): probe-token aging (scoped
  single-row UPDATEs on volatile column, rows deleted after) → 401
  `AUTH_SESSION_IDLE_EXPIRED` + row gone; 401
  `AUTH_SESSION_ABSOLUTE_EXPIRED` + row gone; invalid token unchanged;
  browser: login → view renders → aged token → SPA navigation → concurrent
  401s collapse to one sign-out → **login screen with the idle notice**;
  boot-restore on a dead token lands silently on login (documented §4).
  Baselines restored exactly: tokens 90, compensations 0, sessions 137,
  rooms 4, students 15.
- Pre-existing failures untouched: `projectState` branch-drift (environmental),
  known load-flaky frontend files (pass in isolation; full frontend suite
  not re-run — 7+ min — same standing rule as prior slices).

## 4. Known limitations / follow-ups (not blockers)

- Boot-restore on an expired token signs out silently (no reason shown);
  only mid-session expiry carries the notice. Acceptable, recorded.
- `expireSession` logout POST on a dead token 401s (expected); swallowed
  locally after the live run exposed the unhandled-rejection noise.
- Frontend absolute clock (10 h) is still computed from token `expiresAt`
  (12 h) minus TTL — consistent, but if the server absolute ever changes,
  `ABSOLUTE_SESSION_MS` must follow manually. No endpoint exposes it.
- `docs/security.md` §§4/8/9 still describe the pre-backend world
  (contradicts current code) — queued for the hygiene slice, not touched
  here per scope constraints.
- True parallel-request races are asserted by sequential tests + idempotent
  single-row delete reasoning, not by concurrent load.

## 5. Remaining owner decisions (from the planning handoff, still open)

Absolute/idle value changes, monitor-vs-enforce rollout (enforced
directly here per task), O-12 cookie transport, passkey library/RP ID/UV/
recovery policy, step-up action list, IP-based blocking (not implemented),
alerting destinations. No new permission ids were added.
