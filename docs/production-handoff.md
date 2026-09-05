# Production hand-off checklist

Status of this build: **demo-complete, not production-deployable.** The blocking items are backend items.

## Blocking before any real deployment

- [ ] **Replace demo auth with server auth.** `src/domains/auth/demoAuthRepository.ts` is browser-only and provides no security. Point `registry.ts` at `ApiAuthRepository` and implement `POST auth/login`, `POST auth/logout`, `GET auth/me` → `{user, permissions, token, expires_at}`.
- [ ] **Enforce permissions server-side.** The client matrix in `permissions.ts` is UI affordance only and is fully bypassable.
- [ ] **Implement user CRUD endpoints** (`users`, `users/:id`) with password hashing. The client never handles passwords today.
- [ ] **Remove demo credentials** from any shipped build (`arena-demo`, `*@demo.local`).
- [ ] **Migrate remaining views off `@/data/records`** — 24 files, see `docs/architecture/auth.md`.
- [ ] **Set the API base URL** via Vite env config. No backend URL is hardcoded.

## Verified in this build

- [x] `npm run typecheck` clean.
- [x] `npm test` — 18 files, 162 tests passing.
- [x] `npm run build` clean; single-file `dist/index.html`, 2,059.91 kB (gzip 1,212.18 kB).
- [x] Dev server and built bundle both serve HTTP 200, including under a proxied preview `Host` header.
- [x] Session invalidation on demo reset/clear/import/restore.
- [x] Invalid restore leaves state unchanged; backups contain no credentials.
- [x] No duplicate `navigation` landmarks in the a11y tree.

## Not verified

- **Interactive browser QA did not run.** No browser engine could be installed in this environment (Playwright downloads blocked, no system Chromium). Verification was HTTP-level plus jsdom component tests that mount the real `App`. Manual browser QA is still required before hand-off — in particular the Messages attachment flow, library player, reports export, and notification interactions.

## Known non-blocking issues

- 1 low-severity `npm audit` advisory remains. Fixing it requires `vite@7.3.6`, outside the pinned dependency range; deliberately not upgraded.
- Static dashboard/report figures are fixtures, not computed from the demo dataset.
