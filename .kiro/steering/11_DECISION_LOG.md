---
inclusion: always
---

# 11 — DECISION LOG (index + classification)

> **`docs/engineering/DECISIONS.md` + `GOVERNANCE_CHECKPOINT.md` are the authoritative decision
> record.** This steering file does **not** invent competing decisions — it classifies legacy
> steering decisions and points to current ones. If this file and `docs/engineering/` disagree,
> `docs/engineering/` wins.

## Legacy steering decisions (from `17_DECISION_LOG.md`) — classification

| Legacy decision (2026-07/08) | Status |
|---|---|
| 3-layer tokens `--teacher-color-*` / `--nav-*` | **SUPERSEDED** by `src/index.css` tokens (`02_...`). |
| Teacher Hero architecture (`.hero-left/.hero-right`, `teacher-theme.css`) | **HISTORICAL** (public-site/Blade). |
| "No presentation logic in Blade", state in Alpine | **SUPERSEDED** — React/no-Alpine; logic in domain hooks (`01_...`). |
| Global Navbar / Breadcrumb, `@alpinejs/focus` | **HISTORICAL** — Blade/Alpine public site. |
| Split CSS modular (`site-theme.css`, `components/*.css`) | **OBSOLETE** — current CSS is Tailwind v4 + `src/index.css`. |
| Hero composition blueprint / artwork pipeline / AI scene library | **HISTORICAL** — public-site visual product. |
| Compact Admin dashboard density; Admin Glass(day)/Dark(night) via `dashboard.blade.php` cookie | **HISTORICAL mechanics** (Blade); the *density/day-night intent* is **ADAPT** for the React panel's appearance presets. |
| Run Ownership Boundary (Registry vs OrchestrationRunStore) | **OUT OF SCOPE / HISTORICAL** here — not part of the current `src/` frontend architecture. |

## Current decisions (CURRENT — authority = `docs/engineering/DECISIONS.md`)

Reference, do not restate in full:

- **§1–§2** View→Hook→Repository→Local|Api layering; demo is implementation #1, not a fake backend.
- **§22** D9 bundle budget baseline/cap; `mergeClassNames` replaces `tailwind-merge`.
- **§25** demo→local vocabulary; never silently selected in `api` mode.
- **§29/I24** 25-permission RBAC when recorded, incl. `progress.read`/`progress.write`, parity
  test vs `backend/config/permissions.php`. **§33–§42** have since added 12 ids (PB-3 lifted per
  domain: instruments, learning, rooms, gallery, branding; verb-scoped `finance.pay`; display-only
  `gallery.details`), so the vocabulary is now **37**. `permissions.php` is the authority
  (`.opencode/specs/auth-rbac.md`).
- **§31** demo no longer production-facing (role-editor presentation leak closed).
- **§32** two-line reconciliation; both lines preserved; `main` untouched.
- **D6** Finance/Reports deferred, no fabricated numbers (Reports still deferred; invoices v1 are
  served in the client composition by §40–§41, and the demo composition keeps Finance deferred).
  **D7** nav hints without numbers. **D12** failed secondary read reported as failure.
- **§20** pointer to `GOVERNANCE_CHECKPOINT.md` (live law for `T-02`, `O-*`, `PERF`, `HELP`).
  `T-02` is **ACCEPTED / ASSIGNED-ONLY**, not open.

> Note: the F0 snapshot `docs/frontend-completion/13-open-decisions.md` is **HISTORICAL/superseded**
> and must not be treated as current law.
