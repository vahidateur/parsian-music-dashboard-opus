# HANDOFF — Security architecture audit + implementation plan (sessions, passkeys, firewall), 2026-10-28

> Planning-only. No code, test, config, migration, lockfile or handoff was
> changed to produce this; no migrations run, no services stopped, no runtime
> settings altered. `PROJECT_STATE.md` untouched. Working tree preserved
> (204 uncommitted files, nothing staged — verified before and after).
> Branch `arena/01a10b63-parsian-music-dashboard-opus` @ `d354f00`.
> Latest implementation handoffs read: `HANDOFF-compensation-2026-10-28.md`,
> `HANDOFF-branding-2026-10-26.md`, `HANDOFF-chat-2026-10-26.md`,
> `HANDOFF-audit-final-2026-10-27.md`, `HANDOFF-plan-2026-10-27.md`,
> plus `docs/security.md`, `deploy/nginx.conf`, `deploy/Caddyfile`.

## 0. Baseline: what authentication actually is today (verified in source)

### 0.1 Transport and token lifecycle

- **Bearer-only Sanctum personal access tokens.** Login
  (`backend/app/Domain/Auth/AuthService.php:29-56`) issues
  `$user->createToken('api', ['*'], $expiresAt)` with
  `$expiresAt = now()->addMinutes(expirationMinutes())`; single wildcard
  ability `*`, no per-ability checks anywhere in `backend/app`.
  `AuthService.php:17-18` and `routes/api.php:32` both state Bearer is the
  only transport `src/api/client.ts` speaks (verified client-side:
  `src/api/client.ts:202-203` sets `Authorization: Bearer`, no cookies,
  no `credentials/withCredentials` anywhere in `src/`).
- **Absolute expiry (server-enforced, 12 h).** `backend/config/sanctum.php:53`
  `'expiration' => (int) env('SANCTUM_TOKEN_EXPIRATION', 720)`;
  `backend/.env.example:67` sets `720`. Enforcement is in vendor, read
  firsthand: `backend/vendor/laravel/sanctum/src/Guard.php:127-130` rejects
  when `created_at` is older than the config window **or** `expires_at` is
  past. Every `auth:sanctum` request is therefore absolute-expiry-checked
  today. `AuthService::me()` (`:71-81`) never re-issues (`token: ""`).
- **Server-side activity tracking exists but is unused for policy.**
  `Guard.php:20` defaults `trackLastUsedAt = true`; `:56-58` + `:162-172`
  write `last_used_at = now()` on **every** authenticated request.
  `personal_access_tokens.last_used_at` is therefore a usable idle signal
  with zero schema change (write-amplification cost: one UPDATE per
  request — acceptable at this scale, noted in §5).
- **No idle timeout server-side.** Nothing compares `last_used_at` (or any
  activity timestamp) to a limit. A token copied at minute 0 works until
  minute 720 regardless of activity.
- **Logout revokes one token only.** `AuthService.php:58-64` deletes
  `currentAccessToken`. No logout-all, no token list, no rotation/refresh
  endpoint (`POST /auth/refresh` exists only as a one-line sketch in
  `src/domains/auth/README.md:8`; no route, no code).
- **No expiry housekeeping.** `routes/console.php` contains only `inspire`;
  no scheduler, no `sanctum:prune-expired`, no reset-token cleanup.
- **Password rules.** `Hash::check` with dummy-hash timing flattening
  (`AuthService.php:33-35`); lockout is only the login throttle;
  `SetPasswordRequest` requires ≥ 6 chars and revokes **all** of the
  target's tokens (`UserService.php:119-130`); account creation carries no
  password (set separately); no password-reset routes, no current-password
  confirmation, no breach check. Bcrypt via framework default
  (`config/hashing.php` absent; `BCRYPT_ROUNDS=12` in `.env.example:16`).

### 0.2 Request perimeter today

- `bootstrap/app.php:36-40`: only the `tenant` alias + JSON-401-for-`api/*`;
  exception envelope (`:41-107`) maps 401/403/404/405/429/5xx to stable
  codes (`AUTH_UNAUTHENTICATED`, `FORBIDDEN`, `RATE_LIMITED`, …) with
  rate-limit headers preserved. `dontReport([ApiException::class])` —
  expected 401/403s never reach logs.
- `ResolveTenant` (`app/Http/Middleware/ResolveTenant.php:1-49`, the only
  middleware file) re-checks disabled user / missing-or-suspended org on
  **every** request, fail-closed. No CORS config (`config/cors.php` absent),
  no trusted proxies/host validation, no global security-headers middleware
  (headers live in `deploy/*` only).
- Rate limiting: exactly one app limiter — `throttle:login` on
  `POST /auth/login` (`routes/api.php:37`), 5/min keyed on
  normalized-email + IP (`AppServiceProvider.php:31-35`). No other
  `throttle:` in `backend/`; `config/auth.php:98` throttle belongs to an
  unused reset broker. Edge adds `login_zone 5r/m` (burst 3),
  `app_zone 120r/m` (burst 20), `conn_zone 24`
  (`deploy/nginx.conf:105-107,202,232,239`; Caddy mirror needs the
  `mholt/caddy-ratelimit` plugin, `Caddyfile:77`). Effective login ceiling
  today is 5/min at **both** layers, keyed differently (edge: IP only;
  app: email+IP).
- Logging: default `stack→single`, `LOG_LEVEL=debug`
  (`config/logging.php:20,55-66`); **no security-event logging anywhere**
  in `backend/app` (no `Log::` calls); nothing logs tokens or passwords
  (verified absent), and `User.php:56-60` hides password/token fields.

### 0.3 Frontend session reality

- Token + expiry only, in **tab-scoped `sessionStorage`**
  (`src/domains/auth/tokenStore.ts:4-24,44-61`; strict parse, corrupt value
  deleted, unreadable expiry treated as expired). Never password/user/
  permissions (re-read via `GET /auth/me` on restore).
- **No cross-tab sync.** No `storage` event listener and no
  `BroadcastChannel` anywhere in `src/` (grep-verified). The comment in
  `src/security/useIdleTimeout.ts:19-20` claiming sharing "through a
  storage event" is **inaccurate**: tabs share the `localStorage` clock
  keys by 1-second polling only, and logout in one tab does not sign out
  others (missing keys read as "no ceiling"/"now").
- **401 handling has a gap.** `ApiClient` fires `onUnauthenticated` per
  failing request (no dedup): token store cleared, in-memory token nulled
  — but `AuthContext` status is not flipped and there is no redirect;
  the user stays on the shell with a dead token until reload/logout/idle
  fires. `restore()` correctly does zero requests without a stored token,
  discards on 401/403, and rethrows network errors without signing out.
- **Idle/absolute UX already exists, browser-only, with mismatched values.**
  `IDLE_TIMEOUT_MS = 20 min`, `IDLE_WARNING_MS = 2 min`,
  `ABSOLUTE_SESSION_MS = 10 h` (`useIdleTimeout.ts:25-35`); `SessionGuard`
  shows a live countdown with stay-active/logout. The file's own SCOPE
  comment (`:12-20`) states this is not a security boundary and the server
  must expire independently. Desired 15-min idle therefore means changing
  `20→15` here **plus** adding the missing server enforcement; the 10-h
  absolute clock is anchored to token expiry on restore
  (`anchorSessionClock`, DEMO-SIDE ONLY note `:186`) while the server
  enforces 12 h — a 2-hour window where the browser has signed out but the
  token is still valid (or vice versa after clock edits).
- Permissions are UX-only by documented design (`permissions.ts:1-8`);
  server policies are the boundary. Login throttle is UX-only
  (`loginThrottle.ts`: 3 free, backoff, 15-min lockout at 8 in
  `sessionStorage`); "remember me" does not exist.

### 0.4 Data, config, deployment facts

- Schema: `users` (global-unique email, nullable password = cannot sign
  in, `teacher_id` nullable indexed non-FK), `personal_access_tokens`
  (`expires_at` nullable indexed, `last_used_at`, `abilities`),
  `password_reset_tokens` (unused, `expire 60` in `config/auth.php:97`),
  `sessions` table (database driver configured but **unused by the API**),
  `roles` per-org JSON overrides, vocabulary 35 (`config/permissions.php`).
  No WebAuthn columns; no `email_verified_at`/2FA columns.
- Secrets: only `.env.example` files tracked; `backend/.env` present on
  disk (untracked, contents never read). `SESSION_SECURE_COOKIE` has no
  default and is absent from `.env.example` (irrelevant while cookies are
  unused; load-bearing the day cookie transport ships — see O-12 below).
- Edge (`deploy/nginx.conf`, verified): TLS 1.2+, HSTS preload, strict CSP
  (`script-src 'self'`), `Permissions-Policy` including
  `publickey-credentials-get=(self)` (line 184 — passkey-friendly as-is),
  `client_max_body_size 26m`, secret-path gating, bot-UA 404s, dot-file
  404s. Caddy mirrors it. Neither is observably deployed from this repo
  (no deploy automation; only `backend-tests.yml` CI). No Docker/Compose,
  no WAF beyond the above, no `TrustHosts`/`TrustProxies`.
- Governance links: **O-12 ACCEPTED / DUAL TRANSPORT** (cookie web
  primary + Bearer mobile fallback; `GOVERNANCE_CHECKPOINT.md:23,54`,
  `13-open-decisions.md:18`) — but **only the Bearer half is built**
  (`BACKEND_STATUS.md:276`, `FINAL_REPORT.md:348`). F9 mobile contract
  requires the same `/api/v1` + Bearer in OS secure storage, no second
  API. `docs/security.md` §§4/8/9 still describe the pre-backend world
  (no hashing, no server authz/throttle) and **contradict current code** —
  doc debt, see §7 slice 0.
- Dependencies (verified): `php ^8.2`, `laravel/framework ^12.0`
  (locked 12.69.3), `sanctum ^4.0` (locked 4.3.3); React 19, Vite 7,
  Vitest 3. **No WebAuthn library anywhere** (`webauthn|passkey|larage`
  grep over backend+frontend returns only the edge
  `publickey-credentials-get` line).

## 1. Session timeout (15-min idle): mismatch and recommended design

**Mismatch.** The product already promises expiry in the browser (20-min
idle warning/countdown, 10-h ceiling) that the server does not deliver:
any live token is valid for 720 min of wall time. Closing this needs
server state, not a timer: a browser timer, cleared storage, or cookie
expiry alone is explicitly **not** enforcement (attacker replays the
token; other tabs/devices keep working).

**Recommended smallest compatible change (no new transport, no migration).**

- Reuse `last_used_at` as the activity signal (Sanctum already maintains
  it). Add a dedicated middleware (after `auth:sanctum` + `tenant`) that,
  for the current access token, rejects with distinct codes when
  `now − last_used_at > AUTH_IDLE_TIMEOUT_MINUTES` (default **15**) or
  `now − created_at > AUTH_ABSOLUTE_LIFETIME_MINUTES` (default **720**,
  aligned with `sanctum.expiration`): e.g. `AUTH_SESSION_IDLE_EXPIRED`
  and `AUTH_SESSION_EXPIRED` (both HTTP 401 so existing `kindForStatus`
  treats them as authentication). On breach, **delete the token**
  server-side so the rejection is terminal, not advisory. Exempt nothing;
  every protected route inherits it through the existing group.
- Why this shape: zero schema change (nullable `last_used_at` on old
  tokens falls back to `created_at`); works with both expiry clocks Sanctum
  already enforces; distinct codes let the frontend show "signed out for
  inactivity" vs "session ended" and preserve the existing countdown UX
  with corrected constants (20→15 min; absolute aligned to the configured
  server value instead of hardcoded 10 h).
- Frontend companions (same slice): handle the two codes like 401 plus a
  reason flag surfaced to the login screen; fix the stale cross-tab comment;
  on 401-mid-session, flip auth status and route to login (closes the §0.3
  gap) rather than stranding the shell. Keep per-tab `sessionStorage` and
  the 1-s poll; add a real `storage`-event push for logout so all tabs exit
  together (cheap, no protocol change).
- Explicitly **not** proposed: silent refresh/rotation (widens the theft
  window and complicates the mobile contract), sliding absolute windows,
  per-tab server sessions (server tracks tokens, not tabs — a second tab
  is a second copy of the same token by design).
- Sensitive-action reauthentication: add opt-in step-up (current-password
  confirmation) starting with role-matrix edits, password set, and user
  disable — owner to confirm the list (§8). Unsaved work: the 2-min warning
  already preserves it by letting the user stay active; on expiry nothing
  is auto-submitted, drafts stay local, protected writes fail closed.

## 2. Passkeys (WebAuthn/FIDO2): design within current constraints

**Non-goals respected:** password login stays (fallback + recovery depend
on it; §8 recovery policy is an owner decision). No second API: passkey
ceremonies are new `/auth/webauthn/*` endpoints under the same envelope,
same tenant checks, same role/permission model afterwards — a passkey
authenticates **who**, permissions still authorize **what**.

- **Storage:** new `webauthn_credentials` table
  (`id`, `user_id` FK→users cascade, `credential_id` unique,
  `public_key_cose`, `sign_count`, `transports` JSON, `name`,
  `last_used_at`, timestamps; revocation = row delete, audited).
  Challenges: single-use, 60–120 s TTL, bound to session/user + ceremony
  type — store in cache (DB cache table exists) or a minimal
  `webauthn_challenges` table; never accept a challenge twice, never across
  ceremonies. `sign_count` cloned-counter detection → revoke + alert.
- **Verification checklist (server, per ceremony):** challenge match +
  consume; origin exact-match against allowlist derived from `APP_URL` +
  configured web origins (no subdomain wildcards without owner approval);
  RP ID hash match with RP ID from config (default = effective host of
  `APP_URL`); signature valid; credential owned by the authenticating
  account and not revoked; `userPresent` true; `userVerified` per owner
  decision (§8: `required` recommended for shared front-desk machines,
  `preferred` if mobile convenience wins — cannot satisfy both); attestation
  `none` at v1 (privacy + compatibility; `direct` only if procurement
  needs it later).
- **Library (not pre-selected — verify at implementation):** candidates
  are `webauthn/webauthn-lib` (framework-agnostic, needs glue code) vs a
  Laravel adapter such as `asbiin/laravel-webauthn` /
  `larage/webauthn-lib` (convention over configuration, Eloquent-bound).
  Selection criteria: PHP 8.2/8.3 + Laravel 12 compatibility, release
  activity within the last 12 months, attestation-format coverage,
  counter/UV enforcement, test suite. Frontend: `@simplewebauthn/browser`
  (thin, pairs with any server). Re-verify maintenance status and version
  pins at implementation time; do not vendor crypto by hand, ever.
- **Endpoints and abuse control:** `POST /auth/webauthn/register/options`
  + `/register/verify` (authenticated), `POST
  /auth/webauthn/login/options` + `/login/verify` (public, email +
  challenge), plus self-service credential list/name/revoke under the
  caller's own id. Rate-limit all four ceremony endpoints at least as
  strictly as login (edge `login_zone`-class + app `throttle:` per
  account/IP); ceremonies must not become user-enumeration oracles
  (identical error shape for unknown vs known user at options time).
  Registration is **self-service for one's own account** — a new
  authorization shape (today only admins set credentials); owner approval
  required. HTTPS: production terminates TLS at the edge (configs ready);
  local dev stays `localhost` (secure context — WebAuthn works over plain
  `localhost`, must be asserted by test, never assumed for LAN IPs).
- **Recovery:** password login remains the fallback; credential loss =
  staff-assisted revoke/re-register (mirrors today's staff-created
  accounts, §6 of `docs/security.md`). Owner decides: minimum-credential
  rule, whether admins may revoke another user's credential (recommend yes,
  audited, same shape as password-set revocation), and whether passkey-only
  accounts are ever allowed (recommend no at v1).

## 3. Layered firewall: what "internal firewall" means here

No WAF, reverse-proxy platform, or container orchestrator exists **in
this repo** — only reference edge configs (`deploy/*`) and the app. So
"internal firewall" = edge reference config (deploy-time) + application
perimeter in Laravel + abuse controls + authz + detection. No custom WAF
and no userspace packet filter are proposed; that would duplicate
nginx/Caddy and Laravel without justification.

| # | Layer | Control | Status |
|---|---|---|---|
| 1 | Edge: TLS/HSTS/CSP/bot-refusal/secret-path | nginx + Caddy reference configs | Implemented in config, **deployment-dependent** (not observably deployed) |
| 1 | Edge: `login 5r/m`, `app 120r/m`, `conn 24`, 26 m body cap, method handling | same files | Implemented in config, deployment-dependent; body cap must match PHP `upload_max_filesize/post_max_size` at deploy |
| 2 | Central middleware, route grouping, trusted proxies, host validation, app-level secure headers | `tenant` group + JSON envelope only | **Partially implemented** — missing: trusted-proxy/host validation, any app-emitted security headers (edge-only by design; acceptable **iff** edge deploy is verified) |
| 3 | Per-endpoint limits: login | email+IP 5/min app + IP 5/min edge | Implemented and verified |
| 3 | Limits for passkey ceremonies, password set, sensitive reads/writes | — | **Missing** (plan in §4) |
| 4 | Role/permission + tenant + resource-level checks, 404-vs-403 discipline | policies, `PermissionGate`, participation scoping, tenant middleware | Implemented and verified across 13 slices (extend, don't rebuild) |
| 5 | Validation, uploads, CORS/CSRF, injection, mass assignment | FormRequests everywhere; `$fillable`; no CORS config; no cookies→no CSRF today | **Partially implemented** — CORS absent (safe for Bearer same-origin/dev-proxy, **required before any cross-origin web client**); upload re-validation unconfirmed in this audit (mark to verify, do not claim); CSRF becomes mandatory the day O-12 cookie transport ships |
| 6 | Revocation/expiry/replay, token hygiene | one-token logout; 12-h expiry; no replay surface (no refresh) | **Partially implemented** — missing: idle expiry (§1), logout-all, pruning, challenge single-use (with passkeys) |
| 7 | Structured security events, anomaly detection, alerting, retention | — | **Missing** (no `Log::` calls in `backend/app`; 401/403s explicitly not reported) |

Cross-cutting rules: never block solely by IP (academy NAT/campus egress
share addresses — false positives lock out whole buildings); every new
detection ships in **monitor mode first** (log-but-allow) with thresholds
in config; enforcement flips only after owner review of false-positive
logs. Safe testing: new limits get dedicated feature tests asserting exact
429 codes + headers; load/penetration behavior is **not verifiable without
production or a staging twin** (say so in reports).

## 4. Phased plan (dependencies, acceptance)

- **Slice 0 — hygiene + decisions (no behavior change).** Fix the stale
  `docs/security.md` §§4/8/9 contradictions; record owner decisions from
  §8. Acceptance: docs match code; decisions logged in DECISIONS.md.
- **Slice 1 — server-side session expiry (recommended first).** Idle 15 +
  absolute middleware (§1), distinct 401 codes + token deletion, frontend
  constants/redirect/storage-event logout, `sanctum:prune-expired` on
  schedule + deploy cron. No migration (reuse `last_used_at`). Acceptance:
  matrix rows B-1…B-4 green; old 20-min/10-h constants gone; monitor logs
  reviewed before enforce flip.
- **Slice 2 — detection + hygiene.** `security` log channel (no secrets/
  tokens/national IDs — assert by test), login/passkey ceremony
  success-failure events, throttle-denial events, logout-all endpoint +
  "revoke all sessions" on password set already exists (extend to a user
  control), per-endpoint throttles for password-set and ceremony routes.
  Acceptance: events asserted in tests via fakes; payload-scan test proves
  no secret leakage.
- **Slice 3 — passkeys.** Tables + challenge store, library integration
  (per §2 criteria), 4 ceremony endpoints + self-service credential CRUD,
  registration-naming/revoke UX, fallback + recovery flows. Acceptance:
  full matrix rows P-1…P-9; virtual-authenticator browser tests; real-device
  (Android/iOS) manual verification recorded; password login untouched and
  regression-tested.
- **Slice 4 — perimeter hardening.** Trusted hosts/proxies from env,
  app-emitted minimal headers only where edge cannot cover, CORS policy
  only if a cross-origin client is approved, upload-pipeline verification,
  deploy-time header/TLS checklist automation (`curl -sI` assertions).
  Acceptance: new middleware covered by tests; deploy checklist executed
  against staging; nothing here changes auth behavior.

## 5. Risks

- **Security:** 15-min idle changes lived experience on shared reception
  machines (warning UX mitigates); token theft window shrinks 12 h→15 min
  idle but absolute stays 720 min — an active attacker still holds up to
  12 h (shorten absolute only with owner approval); `last_used_at` write
  per request adds DB load (fine now, revisit with read replicas);
  passkey account-recovery is the weakest link (staff-assisted = social
  engineering surface — require in-person + audit).
- **Compatibility:** mobile F9 contract pins Bearer + same envelope —
  slices 1–3 must not break it (no cookie requirement, no new required
  headers); older browsers/devices without WebAuthn keep password login;
  RP ID choice is sticky (changing it later orphans credentials —
  decide once, §8); `updateLastUsedAt` behavior varies if Sanctum is ever
  reconfigured (`trackLastUsedAt`, custom Guard).
- **DB/config/deploy:** slice 1 needs no migration; slice 3 adds two
  tables (additive, reversible); new env keys
  (`AUTH_IDLE_TIMEOUT_MINUTES`, `AUTH_ABSOLUTE_LIFETIME_MINUTES`,
  `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGINS`, ceremony TTLs) with safe defaults
  so old envs boot; production cron required for pruning; edge configs
  must be actually deployed and header-checked (checklist, not assumption).

## 6. Test matrix (automated vs browser vs deploy vs non-verifiable)

Backend (phpunit): B-1 idle rejection at 15 min (time-travel
`last_used_at`); B-2 absolute rejection with continued activity; B-3
logout then replay → 401; B-4 logout-all revokes others; B-5 distinct
codes + token deleted; B-6 throttle exact 429 + headers on login and
ceremony routes; P-1…P-6 ceremony success/failure (bad challenge, reused
challenge, expired challenge, wrong origin, wrong RP ID hash, bad
signature, unknown credential, cloned counter); P-7 credential CRUD scoped
to self (cross-user → 404/403); P-8 rate limits; P-9 role/tenant isolation
after passkey login (teacher scope, PB-1, accountant denial); R-1 no
secret/token/national-ID in any security log (payload scan); R-2 existing
domain suites incl. Compensation stay green.
Frontend (vitest): constants (15 min, warning, absolute from server);
countdown + stay-active; 401-reason routing to login with reason message;
cross-tab logout via storage event; restore/401/403 semantics unchanged;
no WebAuthn code path without platform support (graceful absence).
Browser/device (owner env): virtual-authenticator registration + login +
  failure cases; real Android/iOS passkey round trip; idle countdown then
  protected write rejected; reload persistence rules; CSP console clean.
Deploy (staging/prod): header/TLS checklist from `docs/security.md` §10;
  throttle behavior over the edge; pruning cron evidence; HSTS preload
  submission only with owner approval.
Cannot verify without production: volumetric/DDoS behavior, IP-reputation
  efficacy, HIBP latency at set-password time, real-world false-positive
  rates for any blocking rule, hardware-key attestation variance.

## 7. Rollback per slice

Slice 1: `AUTH_SESSION_ENFORCEMENT=monitor|enforce` (default monitor in
first deploy; monitor logs-but-allows); constants revertible in one
commit; no migration to roll back. Slice 2: log channel + events are
additive; throttles keep prior limits as floor. Slice 3: feature flag
hides passkey UX; tables stay (empty) or drop in a later window; password
login never touched. Slice 4: edge/app header changes revert to the
reference configs pinned in git.

## 8. Assumptions and unresolved questions

Assumptions: single production host behind nginx **or** Caddy per
`deploy/*`; outbound network available for HIBP only if approved;
front-desk machines are shared (drives UV `required` recommendation and
15-min idle); no native mobile client in repo (F9 contract only).
Unresolved (all need owner answers, none assumed): §8 list; plus whether
`docs/security.md` may be rewritten in slice 0 (it contradicts code); the
production hostname (fixes RP ID + origins + TrustedHosts); whether mail
delivery exists (no reset-by-email without it — recovery stays
staff-assisted).

## 9. Decisions requiring explicit owner approval (stop lines)

1. Idle 15 min + absolute 720 min values (and aligning the frontend 10-h
   clock to the server value).
2. `monitor`-then-`enforce` rollout for session expiry (or enforce at once).
3. Bearer stays mandatory for mobile; whether web may move toward O-12
   cookie transport later (out of scope for these slices either way).
4. Passkey library choice at implementation time (criteria §2; no
   pre-selection here).
5. RP ID + exact origin allowlist (sticky; changing orphans credentials).
6. User verification `required` vs `preferred`; attestation `none` at v1.
7. Self-service credential management for one's own account (new
   authorization shape) + admin revoke rights.
8. Account-recovery policy (staff-assisted baseline; minimum-credential
   rule; passkey-only accounts: no at v1).
9. Step-up reauthentication action list.
10. Any IP-based blocking (recommend never as sole signal) and alerting
   destinations/thresholds.
11. No new permission ids without a governance decision (slices reuse
  `users.write`/`settings.*` patterns or justify additions).

**Recommended first implementation slice: slice 1 (server-side session
expiry).** Smallest compatible change, no migration, closes the largest
verified gap (12-hour replay window the UI already claims to close),
reuses Sanctum-maintained timestamps, and unblocks honest passkey session
lifetimes later. Second: slice 0 + 2 (docs truth + detection), then
passkeys, then perimeter.
