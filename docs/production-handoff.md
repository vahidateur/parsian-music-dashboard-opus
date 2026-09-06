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
- [ ] Implement the REST contracts the `Api*Repository` classes already assume:
      `/api/v1/{students,teachers,rooms,classes,enrollments}` with `GET|POST` on the
      collection, `GET|PATCH|DELETE /{id}`, `POST /{id}/deactivate` (teachers, rooms),
      `POST /{id}/archive` (classes), `POST /{id}/withdraw` (enrollments).
      **No server serves these today.**
- [ ] Server-side validation for every write (the client validation is convenience only).
- [ ] Pagination/filtering/sorting server-side.
- [ ] `UNIQUE(organization_id, national_id)`. The demo uniqueness check is a store scan
      and is **not** a constraint.
- [ ] Partial `UNIQUE(student_id, class_id)` over open enrollment statuses, plus a
      **transactional** capacity check — the demo enforces capacity in application code,
      which cannot survive concurrency.
- [ ] Transactional **bulk import**. The importer is atomic by policy (nothing is written
      until validation completes) but has no database transaction behind it.
- [ ] Server-side `GET /search?q=` and `GET /dashboard/metrics`. The palette and dashboard
      currently fan out to N `list()` calls, which is fine at demo scale only.
- [ ] Server-authoritative time. `src/domains/shared/clock.ts` is a UI clock; any
      time-sensitive authorization or billing must not trust it.
- [ ] Normalized E.164 phone storage with render-time masking.

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

- [x] **IMPLEMENTED — interactive core.** Students, Teachers, Rooms, Classes and
      Enrollments are full CRUD through repositories, with cross-domain invalidation,
      derived dashboard metrics, a repository-backed command palette, and an
      Import/Export Center (CSV + XLSX). Covered by tests that drive the real dialogs
      against the real demo repositories.
- [x] **IMPLEMENTED — no cosmetic loading.** `useAsyncView` (a 420 ms fake timer) has been
      deleted outright; every remaining spinner reflects real repository state.
- [ ] **PARTIAL — repository wiring.** Scheduling, Attendance, Finance, Messages, Library
      and Reports still read fixtures from `@/data/records` / `@/data/academy`.
      See `docs/architecture/data-layer.md` for the per-view list.
- [ ] **DEMO ONLY — inert forms.** The global ActionSheet ("ثبت پرداخت", …) collects input
      but persists nothing outside the five wired domains. It says so instead of showing a
      success toast.
- [ ] **DEMO ONLY — report figures** are static fixtures, not aggregates. Dashboard tiles
      are individually labelled DOMAIN-DERIVED / CURATED / BACKEND-REQUIRED so a viewer can
      tell which number is real.

---

## Verified in this build

Executed, with results reproduced below in the final report:

- [x] `npm run typecheck` — clean.
- [x] `npm test` — 38 files / 340 tests passing.
- [x] `npm run build` — clean single-file bundle.
- [x] Dev server + built bundle serve HTTP 200, including under a proxied preview `Host`.
- [x] Seed referential integrity — 0 orphans/duplicates across 13 collections (script-verified).
- [x] Prototype-pollution import defence (`__proto__`/`constructor`/`prototype`) — verified by execution and unit tests.
- [x] Backups reject credential-like fields; invalid restore leaves state unchanged.
- [x] Demo lifecycle (reset/clear/import/restore) invalidates an orphaned auth session.
- [x] No duplicate `navigation` landmarks; reduced-motion honoured via CSS + `data-motion`.
- [x] Layering enforced by test: no view or component touches `localStorage`, `demoStore`,
      `fetch`, a hardcoded HTTP URL, or the frozen `ACADEMY_NOW` clock constant.
- [x] Import safety: size/row/column/cell caps, zip-bomb caps, formula-injection rejection,
      duplicate and invalid national IDs rejected per row, no store write before validation.
- [x] Export safety: explicit column lists (no secret can leak by accident), formula
      escaping, UTF-8 BOM for Persian CSV, current-state reflection.

## NOT verified

- **Interactive browser QA did not run.** No browser engine could be installed in this
  environment — Playwright's CDN download fails and there is no system Chromium.
  Verification was HTTP-level plus jsdom tests that mount the real `App`.
  **Manual browser QA is still required**, in particular: mobile drawer/bottom-nav,
  command-palette keyboard flow, focus trapping in dialogs, chart rendering,
  RTL layout at tablet/mobile breakpoints, and the real file-picker / file-download
  paths of the Import/Export Center (the parsers and serializers are unit-tested,
  but no actual browser download was exercised).

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

## Profiles, learning and media — backend requirements

Added this phase: `instruments`, `learning`, `chat`, `media`, `branding`,
`gallery`. All six run on the Demo adapter in **both** modes because no server
implements them yet; this is deliberate and documented at the registry getters
rather than being a silent production fallback.

### Schema

| Table | Notes |
|---|---|
| `instruments` | `organization_id`, `UNIQUE(organization_id, slug)`. Slug immutable after create. |
| `learning_programs` | FK → `instruments`. `organization_id`. |
| `learning_levels` | FK → programs, `UNIQUE(program_id, order)`, contiguous ordering enforced in a transaction. |
| `learning_content` | FK → `media` (nullable). |
| `level_content_links` | `UNIQUE(level_id, content_id)`. |
| `student_placements` | `UNIQUE(student_id)` — one active placement per student; keep an append-only history table. |
| `chat_conversations` / `chat_messages` | FK conversation → messages; index `(conversation_id, sent_at)`. |
| `media_assets` | Metadata only. Bytes belong in object storage, never in the database. |
| `gallery_albums` / `gallery_images` | `UNIQUE(album_id, sort_order)` or renumber transactionally. |
| `organization_branding` | One row per organization. |

### Must be enforced server-side

- **Level reordering** must be transactional. Two concurrent reorders through
  the client-side renumbering used in the demo would corrupt the sequence.
- **Placement validity**: the level must belong to the stated program, and be
  active. The client checks this, but the client is not trusted.
- **Eligibility must be recomputed on the server** for any endpoint that
  returns content to a student. The demo's derivation is a UI convenience; a
  student must not be able to request another level's material by changing a
  request parameter (IDOR).
- **Deletion guards** (`INSTRUMENT_IN_USE`, `LEVEL_HAS_STUDENTS`,
  `PROGRAM_HAS_LEVELS`) must be foreign-key constraints, not just app checks.

### Media

- Signed, short-lived upload URLs; never let the browser write directly to a
  public bucket.
- **Re-validate MIME type and magic bytes server-side.** The client's
  allow-list and signature sniffing are a UX filter only.
- Virus/malware scanning before an asset becomes readable.
- Strip EXIF (including GPS) from uploaded images.
- Serve user content from a separate origin with
  `Content-Disposition: attachment` and a restrictive CSP, so an uploaded file
  cannot execute in the app's origin.
- Enforce per-organization storage quotas.

### Chat

- Telegram/Bale/SMS/email require a **server-side relay**. Bot tokens and API
  keys must never appear in `VITE_*` variables — Vite inlines those into the
  public bundle.
- Verify webhook signatures; rate-limit outbound sends per the provider's
  documented limits (not yet researched — do that before implementing).
- Authorize every conversation read against the requesting user; conversation
  ids must not be guessable authorization.
- Persist delivery receipts server-side; the demo's `sent` / `unavailable`
  status is local-only.

### Not implemented

- Audio waveform peaks are computed at upload time in a real system; the demo
  falls back to a deterministic placeholder shape.
- Gallery images and any uploaded media are **per-browser** in the demo and are
  excluded from backup/restore.

## Learning progress — backend requirements

Added: `pieces`, `piece_assignments`, `progress_events`, plus `visibility` on
learning content and richer placement history.

### Schema

| Table | Notes |
|---|---|
| `pieces` | FK → instruments; `organization_id`. `range_unit` enum, `total_range` nullable. |
| `piece_assignments` | FK → students, pieces. Partial `UNIQUE(student_id, piece_id)` over OPEN statuses only, so a completed piece can be re-assigned. |
| `progress_events` | FK → assignment, student. **Append-only**: grant INSERT/SELECT, not UPDATE/DELETE. Index `(student_id, recorded_at DESC)` and `(assignment_id, recorded_at DESC)`. |
| `placement_history` | Separate table, not a JSON column, once volume matters. Records from-level, to-level, effective date. |
| `learning_content.visibility` | Enum `students`/`teachers`. |

### Must be enforced server-side

- **Analytics and plateau detection must be recomputed on the server** over the
  full history. The client's copy is a convenience for the demo; with thousands
  of events, shipping the log to a browser to compute an average will not scale.
- **Eligibility filtering for recommended content must be re-applied
  server-side.** The client filter is UX, not an authorization boundary — a
  student must not be able to reach another level's material by changing a
  request parameter (IDOR).
- **`visibility = teachers` must be enforced in the query**, not by hiding it in
  the UI.
- **The event log must be immutable at the database level.** An append-only
  grant is the enforcement; application discipline is not enough.
- **Mastery, tempo, practice minutes and range bounds must be re-validated.**
  Client bounds catch typos, nothing more.
- **`source` (`teacher`/`student`) is provenance, not authorization.** The
  server decides who may write a teacher-sourced event; the client claim must
  never be trusted.
- Partial-unique constraint on open assignments must be a DB constraint, not an
  application check, or a double-submit will create two.

### Privacy

Progress notes and practice history are **behavioural data about a minor** in
many cases. Treat them at the same sensitivity as the national ID:

- never include them in telemetry, debug logs or URLs;
- a guardian's access must be scoped to their own child;
- exports containing progress notes need the same permission gate as student
  exports;
- retention policy should be explicit — practice logs need not be kept forever.

### Not implemented

- **AI narration.** This phase built the deterministic data model on purpose so
  a model can later summarise real numbers. Any future AI layer must consume
  `ProgressInsight`/`Recommendation`, not invent statistics.
- `ApiProgressRepository` exists and compiles against the shared `ApiClient`,
  but no server serves those endpoints and it is deliberately **not registered**
  — wiring it now would produce failing requests presented as a feature.
- Profile photos and all media remain per-browser in the demo and are excluded
  from backup/restore; production needs object storage with signed URLs.
