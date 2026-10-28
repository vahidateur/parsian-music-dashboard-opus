# HANDOFF — Branding slice (end-to-end), 2026-10-26

> Follow-up of `HANDOFF-plan-2026-10-27.md` and `HANDOFF-audit-final-2026-10-26.md`.
> No commit/push/reset/staging/merging. No DB resets or seeds; one additive
> migration on the dev DB (table only; probe row removed afterwards).
> `PROJECT_STATE.md` untouched. All prior uncommitted work preserved.

```text
BRANCH:  arena/01a10b63-parsian-music-dashboard-opus
TIP:     d354f001e730d05563ce5601a0485c99d9eb027a (4 commits ahead of origin)
```

## 1. Baseline (verified read-only before editing)

Same branch/commit/ahead-count as reported; ~180 uncommitted files, nothing
staged. Pre-existing overlapping work inspected and preserved:
`BrandingPanel.tsx`, `useBranding.ts`,
`brandingPanelUnavailable.test.tsx` (org-fallback identity work from prior
slices — kept intact; the fallback now only triggers on explicit stub).
No `HANDOFF-media-*.md` exists (plan task's list names one that was never
written). New `branding.read`/`branding.write` ids absent everywhere pre-slice
(verified by grep); the `registryClient.test.ts` length-1 expectation was
already red against the 2-entry source — kept as the failing-first proof and
fixed by this slice.

## 2. Architecture and contract

`GET|PATCH /api/v1/branding` → `BrandingController` (policy-first) →
`UpdateBrandingRequest` (validates, `BRANDING_INVALID` + fields) →
`BrandingService` (tenant-keyed singleton row; `GET` returns shipped defaults
when no row exists; `PATCH` upserts partial patches, trims, clears media on
`''`) → `branding` table (`organization_id` PK + FK cascade). Wire =
`BrandingSettings` camelCase + server `updatedAt`. Frontend
`ApiBrandingRepository` (+ bump on accepted write only) → `useBranding`
(data-version re-read; DOMAIN_UNAVAILABLE fallback retained as safety net).

## 3. Permissions (approved ids, enforced matrix)

`branding.read` (universal, incl. explicit accountant grant — identity renders
app-wide, incl. public login), `branding.write` **administrator only**
(mirrors `settings.write`; manager opens Settings read-only and gains no new
write). Verified live: accountant GET 200 / manager PATCH 403
`branding.write` / unauth 401 / admin round trip. Parity tests pin all five
roles; vocabulary 33 → **35**.

## 4. Changes

**Backend (new):** migration `2026_10_27…_create_branding_table`; `Branding`
model (PK = `organization_id`); `BrandingPolicy`; `BrandingService`;
`BrandingRules`; `UpdateBrandingRequest`; `BrandingResource`;
`BrandingController`; 2 routes; `BrandingTest` (8).
**Backend (edited):** `permissions.php` (+2 ids, read in core + accountant,
no manager write); `MediaReferences` + `MediaPolicy` (logo/favicon parents,
per-object bytes under `branding.read`, upload-gate entry);
`routes/api.php`; `ProgressTest`/`ProgressEventTest` (35).
**Frontend (new):** `ApiBrandingRepository` + `apiRepository.test.ts` (6).
**Frontend (edited):** `permissions.ts`, `useRoles.ts` (group + labels),
`registry.client.ts` (real Api repo), `unavailableDomains.ts` (branding
removed → **1 left: جبرانی**), `BrandingPanel.tsx` (gate
`settings.write`→`branding.write`, X-06 note → §38), `registryClient.test.ts`
(contradiction fixed: length 1, compensation only, + instance check),
`permissionParity.test.ts` (+§38 table), `apiAuthPersistence.test.ts` (35),
`cacheInvalidationAudit.test.ts` (+ update bump).
**Docs:** `DECISIONS.md §38`, `.opencode/specs/auth-rbac.md` (35 ids).
**Untouched:** demo composition/seed, Organization domain, `useBranding`
fallback, unrelated slices, `PROJECT_STATE.md`.

## 5. Tests & verification (all actually run)

- Red first: `BrandingTest` 8/8 failed (no routes/ids); vocab tests failed
  33-vs-35; composition test failed (length mismatch). Green after.
- **Backend: 410 tests, 2851 assertions — OK** (402 + 8 new).
- **Frontend focused: 77 + 76 — all green** (composition, parity, audit,
  branding incl. preserved fallback tests, settingsHonesty,
  DemoBackedNotice, clientAvailability, bundleBoundary 8+2-skipped).
- **Typechecks:** default + client + demo — exit 0. **Fresh
  `build:client`:** success; 0 demo markers; login disclosure dynamic.
- **Browser (live mariadbd 3307 + API + vite; servers stopped, ports clean):**
  disclosure names exactly جبرانی; Settings panel reads defaults; admin
  rename saves (toast) and shell name updates without reload (bump);
  invalid name refused with danger toast and no persistence; reload keeps
  server value (persistence, not demo store); manager reads identity with
  zero save buttons + explicit inactive-role note; accountant/manager
  matrix confirmed via API.
- **Baselines restored and verified:** branding table 0 rows (probe row
  removed; GET still returns defaults), rooms 4, students 15,
  instruments/media/gallery/chat 0.

## 6. Remaining risks / decisions

- Logo/favicon have no upload UI: media refs validate + bytes authorize,
  but end-to-end upload is unverifiable until a picker exists (follow-up,
  not a gap in this slice).
- No thread/message-style delete for branding (not applicable — singleton).
- `PROJECT_STATE.md §6` link from §38 intentionally not added.
- Accountant sees academy name everywhere by design (§38 matrix).
- Pre-existing, untouched: full-suite load flakes (3 files, pass isolated),
  `projectState` branch-drift failure (push forbidden), 2 skipped
  bundle probes (need `dist/demo`), MessagesChat timer warning.
- Next slice: **compensation** (needs owner permission-id decision first).
