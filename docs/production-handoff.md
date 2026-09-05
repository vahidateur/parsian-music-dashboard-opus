# Production hand-off checklist

Status of this build: **demo-complete, not production-deployable.**
Every blocking item below is a backend item. The frontend is structured so that
each one is a repository swap, not a rewrite.

Status labels used throughout the docs:
**IMPLEMENTED** · **PARTIAL** · **DEMO ONLY** · **BACKEND REQUIRED** · **FUTURE**

---

## Blockers — must be done before any real deployment

### Authentication — BACKEND REQUIRED
- [ ] Replace `DemoAuthRepository` with server auth. It is browser-only and provides **no security**.
- [ ] Implement `POST auth/login`, `POST auth/logout`, `GET auth/me` → `{user, permissions, token, expires_at}`.
- [ ] Password hashing (argon2/bcrypt), password reset, account lockout, refresh-token rotation.
- [ ] Remove demo credentials (`arena-demo`, `*@demo.local`) from any shipped build.

### Authorization — BACKEND REQUIRED
- [ ] Enforce every permission server-side, per endpoint. The client matrix in
      `src/domains/auth/permissions.ts` is a **UI affordance and is fully bypassable**.
- [ ] Mirror the role matrix in the backend; treat the client copy as untrusted.

### Database & API — BACKEND REQUIRED
- [ ] Real datastore + migrations + seed strategy.
- [ ] Implement the REST contracts the `Api*Repository` classes already assume.
- [ ] Server-side validation for every write (the client validation is convenience only).
- [ ] Pagination/filtering/sorting server-side.

### Security — BACKEND REQUIRED
- [ ] HTTPS/HSTS, secure cookie flags or token storage policy.
- [ ] CSRF protection, CORS allowlist, rate limiting, brute-force protection.
- [ ] Secrets in a secret manager — never in the bundle or the repo.
- [ ] Audit logging for auth events, permission changes, financial mutations, deletions.

### Domain infrastructure — BACKEND REQUIRED
- [ ] **File storage** (object storage) for the library; uploads/downloads/sharing are inert today.
- [ ] **Messaging gateway** (SMS/email/push); nothing is delivered today.
- [ ] **Payments**: money precision, transactionality, idempotency keys, gateway verification, webhooks, refunds, audit trail.
- [ ] **Scheduling**: authoritative conflict detection, locking/optimistic concurrency, transactional writes.
- [ ] **Reports**: server-side aggregation and PDF/CSV generation.
- [ ] **Notifications**: real event stream.

### Operations — BACKEND REQUIRED
- [ ] Backups + tested restore, monitoring, error tracking, disaster recovery, deployment pipeline.
- [ ] Set the API base URL via Vite env config (`VITE_*`). No backend URL is hardcoded today.

---

## Frontend work still outstanding

- [ ] **PARTIAL — repository wiring.** `Students` is migrated and covered by tests.
      Teachers, Classes, Scheduling, Attendance, Finance, Messages, Library, Reports,
      Dashboard, Rooms and the Command Palette still read fixtures from `@/data/records`
      / `@/data/academy`. See `docs/architecture/data-layer.md` for the per-view list.
- [ ] **DEMO ONLY — inert forms.** The global ActionSheet ("افزودن هنرجو", "ثبت پرداخت", …)
      collects input but persists nothing. It now says so instead of showing a success toast.
- [ ] **DEMO ONLY — dashboard/report figures** are static fixtures, not aggregates.
- [ ] `useAsyncView` is a cosmetic 420 ms timer used by unmigrated views. Migrated views
      use real repository loading state; delete the helper as the migration completes.

---

## Verified in this build

Executed, with results reproduced below in the final report:

- [x] `npm run typecheck` — clean.
- [x] `npm test` — 20 files / 174 tests passing.
- [x] `npm run build` — clean single-file bundle.
- [x] Dev server + built bundle serve HTTP 200, including under a proxied preview `Host`.
- [x] Seed referential integrity — 0 orphans/duplicates across 13 collections (script-verified).
- [x] Prototype-pollution import defence (`__proto__`/`constructor`/`prototype`) — verified by execution and unit tests.
- [x] Backups reject credential-like fields; invalid restore leaves state unchanged.
- [x] Demo lifecycle (reset/clear/import/restore) invalidates an orphaned auth session.
- [x] No duplicate `navigation` landmarks; reduced-motion honoured via CSS + `data-motion`.

## NOT verified

- **Interactive browser QA did not run.** No browser engine could be installed in this
  environment — Playwright's CDN download fails and there is no system Chromium.
  Verification was HTTP-level plus jsdom tests that mount the real `App`.
  **Manual browser QA is still required**, in particular: mobile drawer/bottom-nav,
  command-palette keyboard flow, focus trapping in dialogs, chart rendering, and
  RTL layout at tablet/mobile breakpoints.

## Dependency audit

`npm audit`: **2 advisories (1 low, 1 high)** — all in the **dev toolchain only**.

| Advisory | Package | Assessment |
| --- | --- | --- |
| GHSA-g7r4-m6w7-qqqr | esbuild | Dev-server file read, **Windows only**. Not reachable in the production static build. |
| GHSA-fx2h-pf6j-xcff | vite | `server.fs.deny` bypass, **Windows only**, dev server only. |
| GHSA-v6wh-96g9-6wx3 | launch-editor (via vite) | NTLM hash disclosure, **Windows only**, dev server only. |

Remediation requires `vite@7.3.6`, which is outside the pinned dependency range.
Deliberately **not** upgraded (pinned versions are not changed just to silence an
advisory). None of the three ships in `dist/`. Correct remediation: bump Vite in a
dedicated dependency PR with its own regression run.
