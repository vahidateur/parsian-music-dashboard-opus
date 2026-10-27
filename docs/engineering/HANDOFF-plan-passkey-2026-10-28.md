# HANDOFF — Passkey (WebAuthn/FIDO2) planning, 2026-10-28

> Planning-only. No code, test, config, migration, lockfile, or handoff was
> changed; no dependencies installed; no database touched; no services
> touched. `PROJECT_STATE.md` untouched. No staging/commit/push/merge/rebase/
> reset/checkout. Working tree preserved (229 uncommitted files, nothing
> staged). Branch `arena/01a10b63-parsian-music-dashboard-opus` @ `d354f00`.
>
> Baseline: `HANDOFF-session-expiry-ux-2026-10-28.md` (Bearer-only Sanctum
> PATs; 30-min server idle + 10-h absolute; distinct 401 codes;
> boot-restore notices; shared concurrent-restore handling). Prior sketch:
> `HANDOFF-plan-security-2026-10-28.md` §2 (this handoff is the dedicated
> elaboration it called for; nothing there is revised).

## 1. Verified current-state findings (evidence, not assumption)

- **Auth model.** `POST /auth/login {email, password}` → `{user, permissions,
  token, expires_at}` (`backend/app/Domain/Auth/AuthService.php:29-56`;
  `LoginRequest` requires both as strings). Bearer-only; no cookies, no
  refresh endpoint, no reset flow (`backend/routes/api.php:37-41` — only
  login/logout/me). Logout deletes the current token only.
- **Sessions after any login are uniform.** Any login path that ends in
  `$user->createToken('api', ['*'], $expiresAt)` inherits, with zero extra
  work: 30-min idle + 10-h absolute enforcement, revocation, distinct codes
  (`backend/app/Http/Middleware/EnforceSessionExpiry.php`), tenant checks,
  boot-restore notices, and the 35-id permission matrix. A passkey login
  **must** reuse this exact issuance path — no second session machinery.
- **Sessions are token-agnostic downstream.** The expiry middleware reads any
  bearer token via `PersonalAccessToken::findToken` (timing-safe); it does
  not know or care how the token was minted.
- **Users.** String PKs (`usr_*`, opaque — suitable as WebAuthn `userHandle`;
  never use email as userHandle), globally unique email, nullable password
  (null = cannot sign in), `role`, `status`, no 2FA/WebAuthn columns
  (`backend/app/Models/User.php:18-51`; users migration). No mail-based
  recovery exists (no reset routes; `mail.php` is stock config) — recovery
  cannot be email-based without new infrastructure.
- **Abuse controls to reuse.** `throttle:login` (5/min, email+IP,
  `AppServiceProvider.php:31-35`, 429 envelope in `bootstrap/app.php:62-67`);
  edge `login_zone 5r/m` + `app_zone 120r/m` (`deploy/nginx.conf:105-107,
  232,239`; Caddy mirror). No other per-endpoint throttles exist.
- **Transport.** Bearer-only; no CORS config; no cookies → no CSRF surface
  today. F9/O-12 contract pins Bearer-in-OS-secure-storage for mobile, same
  `/api/v1`, no second API (`GOVERNANCE_CHECKPOINT.md:56`;
  `docs/frontend-completion/17-mobile-client-contract.md`). Cookie transport
  remains unbuilt — passkeys must not assume it.
- **Platform facts.** PHP `^8.2` / Laravel `^12` / Sanctum `^4`
  (`backend/composer.json`); CLI runs PHP 8.4 with openssl+mbstring+json
  present (read-only `php -m`; nothing installed). Frontend React 19 /
  Vite 7 / Vitest 3; **zero WebAuthn code or dependencies** anywhere
  (`PublicKeyCredential|navigator.credentials|webauthn|passkey` → no hits
  in `src/`; `webauthn|passkey|larage` → no hits in `backend/` except the
  edge `publickey-credentials-get=(self)` line, which is already
  passkey-friendly). Cache default is `database`
  (`backend/.env.example:40`), and a cache table migration exists — a
  challenge store needs no new infrastructure if cache-backed.
- **Deploy reality.** Production hostname is a placeholder in both edge
  configs (`panel.example.com`; `deploy/nginx.conf:113,121`;
  `deploy/Caddyfile:11`); `APP_URL=http://localhost`
  (`backend/.env.example:5`). TLS/HSTS/CSP terminate at the edge; local dev
  is plain HTTP on `localhost` (a secure context, so WebAuthn works there;
  LAN-IP testing would not).
- **Vocabulary governance.** 35 ids; every addition since §33 went through
  an owner decision (`backend/config/permissions.php:7`; DECISIONS
  §§33–39). Credential management is a **new authorization shape**
  (self-service for one's own account; today even password-set is
  admin-only) — it needs an explicit decision, not an assumption.
- **Tests to extend, not weaken.** `AuthTest` (matrix + expiry boundary),
  `SessionExpiryTest` (11), `apiAuthPersistence`/`apiAuthReload`
  (restore contract), `AuthContext`/`sessionExpiry` suites (notice paths),
  permission parity (35 ids), Compensation regressions. Ceremony tests will
  follow the `actingAsRole` + `postJson` + `assertJsonPath` conventions.

## 2. Assumptions and unresolved questions

- Assumed: single production host behind nginx **or** Caddy per `deploy/*`;
  front-desk machines are shared; no native mobile app in repo (F9 contract
  only); outbound network for any metadata/HIBP use is not approved.
- Unresolved (all owner-owned, §9): exact production RP ID + allowed
  origins; account-recovery policy; fallback login behavior; user-
  verification requirement. Plus: library choice, permission-id vs
  self-ownership for credential management, attestation level, ceremony
  rate limits, alerting, minimum-credential rule, admin-revoke rights,
  passkey-only accounts (recommend no at v1), step-up list interaction.

## 3. Proposed target architecture

- **Registration** (authenticated): `POST /auth/webauthn/register/options`
  → `POST /auth/webauthn/register/verify`. Server binds the credential to
  the token's user id (never a client-supplied id), stores one row in a new
  `webauthn_credentials` table (`user_id` FK cascade, `credential_id`
  unique, `public_key_cose`, `sign_count`, `transports` JSON, `name`,
  `last_used_at`), and returns the updated credential list — never a token.
- **Authentication** (public, rate-limited): `POST
  /auth/webauthn/login/options` (email → challenge; identical error shape
  for unknown vs known user — no oracle) → `POST
  /auth/webauthn/login/verify`. On success the server runs the **existing**
  issuance path and returns the **existing** session shape
  (`{user, permissions, token, expires_at}`), so `restoreDetailed`,
  boot notices, idle/absolute enforcement, and the frontend change not at
  all for the token half.
- **Management** (authenticated): list/name/revoke own credentials;
  admin revoke of another user's credential (audited, mirroring the
  password-set revocation precedent in `UserService`).
- **Challenges:** cache-backed (database store, prefixed keys), 60–120 s
  TTL, single-use delete-on-verify, bound to ceremony type (+ user for
  registration); never accept a challenge twice or across ceremonies.
- **Verification checklist per ceremony:** challenge match + consume;
  origin exact-match against an allowlist derived from `APP_URL` plus
  configured web origins; RP ID hash match against configured RP ID
  (RP ID = origin host or a registrable-domain suffix — never invented);
  signature valid; credential owned by the account and not revoked;
  `userPresent` true; `userVerified` per §9 decision; `signCount`
  strictly increasing (clone → revoke + alert).
- **Frontend:** `@simplewebauthn/browser`-style thin client (candidate,
  not installed) behind capability detection (`PublicKeyCredential`
  + `isUserVerifyingPlatformAuthenticatorAvailable` /
  `isConditionalMediationAvailable`); graceful absence (password form
  unchanged); passkey button beside — never instead of — password login.

## 4. Phased implementation plan (dependencies, acceptance)

- **P0 — decisions + evaluation (no code).** Freeze RP ID/origins (§9.1),
  recovery/fallback/UV (§9.2–9.4), library choice against the criteria in
  §7 (compat check only — no `composer`/`npm` commands in this task), and
  the credential-management authorization shape. Acceptance: decisions
  logged in DECISIONS.md; nothing else changes.
- **P1 — backend ceremonies + storage + tests.** Migration (additive,
  `webauthn_credentials` only if cache-backed challenges hold up),
  FormRequests (policy-first, same pattern as auth/scheduling slices),
  4 ceremony endpoints + self-service CRUD + admin revoke, per-endpoint
  throttles (edge + app, login-class strictness), security-event log hooks
  (no secrets — reuse the planned channel, never tokens/keys/challenges).
  Acceptance: matrix rows W-1…W-8 green; password login untouched and
  regression-tested; 35-id parity holds unless an owner decision adds ids.
- **P2 — frontend UX + fallback.** Registration flow (naming), login
  button + platform detection, fallback remains the default path,
  notices reuse the existing session notice slot. Acceptance: unit tests
  for absence/presence/error mapping; no behavior change when WebAuthn is
  unavailable; virtual-authenticator browser tests.
- **P3 — recovery + hardening.** Staff-assisted revoke/re-register flow,
  minimum-credential rule, clone-detection alert path, deploy checklist
  (TLS, RP ID, headers, throttle verification). Acceptance: recovery
  exercised end-to-end on staging; rollback tags cut per slice.

## 5. Risks

- **Security:** recovery is the weakest link (staff-assisted = social-
  engineering surface — require in-person + audit); overly strict UV
  locks out shared-device staff, overly loose UV weakens the factor;
  ceremony endpoints are new public surface (enumeration, replay,
  challenge fixation — each has a named control above); a wrong RP ID
  orphans every credential (sticky — decide once, §9.1).
- **Compatibility:** older browsers/devices without WebAuthn keep password
  login (must stay first-class, not a deprecated path); `@simplewebauthn`
  + React 19 + Vite 7 need version-pin verification at implementation;
  server-lib needs PHP 8.2/8.3 (CI pins 8.3) + Laravel 12 compat;
  mobile browsers use the same endpoints (F9: no second API), but OS-level
  passkey UX (iCloud/Google password manager, hybrid transport) must be
  verified on real devices, not assumed from desktop tests. No silent
  migration of existing sessions; no change to token lifetimes.

## 6. DB / configuration / deployment implications

- DB: one additive table (`webauthn_credentials`); challenges in cache
  (existing DB store) — no other schema change; users table untouched.
- Config: `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS` (exact allowlist),
  ceremony TTLs, attestation/UV/conveyance preferences, throttle knobs —
  all with fail-closed defaults (refuse when RP ID/origins unresolved);
  document in `.env.example` at implementation time.
- Deploy: production hostname must be real before P1 (RP ID + origins +
  TrustedHosts derive from it); edge TLS already terminates correctly;
  cron for any new pruning only if a table-backed challenge store is
  chosen (cache TTLs need none).

## 7. Library decision (criteria, not a selection)

Server candidates: `webauthn/webauthn-lib` (framework-agnostic, needs glue
for Eloquent/routes) vs a Laravel adapter (`asbiin/laravel-webauthn`,
`larage/webauthn-lib` — convention over configuration). Frontend
candidate: `@simplewebauthn/browser`. Selection criteria: PHP 8.2/8.3 +
Laravel 12 compatibility, releases within the last 12 months, attestation
coverage, counter/UV enforcement, test suite, license. Verification steps
at implementation (not now): compatibility matrix read, issue tracker
scan, dry-run resolve against the locked set, CI 8.3 leg. **Never**
hand-roll ceremony crypto. This handoff pre-selects nothing — installing
anything was explicitly out of scope.

## 8. Required tests + rollback strategy

Automated (phpunit): W-1 registration success + duplicate-credential
refusal; W-2 login success issues a standard session (same shape, same
expiry enforcement — assert idle/absolute apply to passkey-minted tokens);
W-3 expired/reused/cross-ceremony challenge rejected; W-4 wrong origin,
wrong RP ID hash, bad signature, unknown credential, non-incrementing
counter rejected; W-5 credential ownership (cross-user use → 404/403) +
teacher scope/PB-1/accountant isolation after passkey login; W-6 ceremony
rate limits (exact 429 + headers); W-7 no secret/key/challenge/token in any
security log (payload scan); W-8 existing suites green incl. Compensation.
Automated (vitest): platform-absent → password-only UI; registration/login
error mapping; fallback login untouched; notice-slot reuse.
Browser/device (owner env): virtual-authenticator registration + login +
all W-3/W-4 failures; real Android/iOS round trip; idle countdown then
protected write refused on a passkey session; reload persistence.
Deploy: TLS/RP ID/header/throttle checklist on staging. Non-verifiable
without production: volumetric behavior, HSM-backed keys, attestation
variance across vendors.
Rollback: feature-flagged UX; endpoints return 404 when disabled; tables
stay (empty) or drop in a later window; password login never touched, so
rollback is a flag flip.

## 9. Decisions requiring explicit owner approval (stop lines)

1. **Exact production RP ID + allowed origins.** Unknown in-repo
   (placeholder `panel.example.com`; `APP_URL=http://localhost`). RP ID is
   sticky — changing it orphans credentials. Required before P1.
2. **Account-recovery policy.** Staff-assisted revoke/re-register is the
   only in-repo-consistent baseline (no email reset infra). Confirm it,
   plus minimum-credential rule, admin-revoke rights, and whether
   passkey-only accounts are ever allowed (recommendation: no at v1).
3. **Fallback login behavior.** Password login stays first-class and
   untouched (recommendation); confirm it is never demoted to "legacy".
4. **User verification.** `required` (recommended for shared front-desk
   machines) vs `preferred` (mobile convenience). Cannot satisfy both.
5. Library choice (criteria §7; decide at implementation from live data).
6. Credential-management authorization: self-ownership checks with no new
   ids (recommendation) vs new permission ids (governance decision).
7. Attestation conveyance (`none` at v1 recommended; `direct` only if
   procurement requires).
8. Ceremony rate limits + alerting destinations (block solely on account/IP
   signals, never IP alone — NAT/shared egress).
9. Step-up interplay: whether passkey login satisfies future step-up
   requirements or password re-entry is still required for sensitive acts.

**Recommended first slice: P0 (decisions + evaluation).** Zero code,
unblocks everything, and the four named decisions (§9.1–9.4) must precede
any schema or endpoint work. Second: P1 backend ceremonies behind the
existing envelope, then P2 frontend, then P3 recovery.
