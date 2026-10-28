---
inclusion: manual
---

# 12 — ROADMAP (product/design intent — NOT implementation authorization)

> The legacy `20_UI_ROADMAP.md` is normalized here as **product/design intent only**. Reading or
> citing this file does **not** authorize implementing anything. Authorization comes from the owner
> and from `docs/engineering/` (`PROJECT_STATE.md`, `PHASES.md`, `OPEN_ITEMS.md`,
> `GOVERNANCE_CHECKPOINT.md`). This file is `inclusion: manual` so it cannot act as an active rule.

## Legacy "Apple-inspired" phases — status against the current repo

| Legacy phase (20_UI_ROADMAP) | Status |
|---|---|
| P1 Dashboard polish (topbar/sidebar/KPI/chart/theme switch/notification center) | **PARTIAL / ADAPT** — a React shell (`TopBar`, `Sidebar`, overlays, Dashboard) exists; "polish" items are design intent, not authorized work. |
| P2 Teacher profile "Hero" (rating/experience/students/edit) | **SUPERSEDED / FUTURE** — public-site hero is HISTORICAL; a panel teacher profile is a FUTURE product decision. |
| P3 Student profile + Apple-Health timeline | **FUTURE** — not implemented; design intent only. |
| P4 Calendar (FullCalendar, drag/resize, resources, recurring) | **SUPERSEDED** — scheduling is implemented via the `scheduling` domain + shipped calendar (H1 closed); the FullCalendar prescription is not current architecture. |
| P5 unified Design System | **DONE differently** — the design system is `src/index.css` tokens (`02_...`), not the legacy spec. |
| P6 remaining modules (Teachers/Students/Finance/Reports/Attendance/Settings/…) | **MIXED** — many domains exist; see open items below. |

## Current open / deferred items (CURRENT — evidence in `docs/engineering/`)

- **O-03** — gallery/library visibility — **OPEN**.
- **O-07** — Tickets vs Chat ownership scope — **OPEN**.
- **I19** — frontend scheduling analogue — **OPEN/carried** (`SESSION_HANDOFF.md`).
- **Finance / Reports** — **DEFERRED (C, D6/I2)** — README-only, no fabricated numbers.
- **Gallery backend genuineness** — **PARTIAL/OPEN** (frontend exists; backend/media seam open).
- **Frontend CI / browser QA** — **NOT VERIFIED** — no formal browser-QA disposition.
- **Backend local verification** — **BLOCKED locally** (no PHP/Composer/MySQL); **PASS by inherited
  CI only**; backend not authorized by this roadmap.
- **O-01 DECIDED 2026-09-21** (per-program placement; `(student_id, program_id)`); **O-02 DECIDED
  2026-09-21** (library level = descriptive catalogue vocabulary, not an authorization field).
- **O-13 ACCEPTED** (student portal = separate guard, same `users`; credential factor still **OPEN**);
  **O-10/O-11 ACCEPTED** (`chat_id` —> `user_id` + `org_id`; uniqueness/linking UX still **OPEN**).
- **O-08, O-09, O-14** remain **OPEN / ACCEPT-WITH-CONDITIONS** and must precede the Laravel schema/API
  work they touch. (Authority: `docs/engineering/GOVERNANCE_CHECKPOINT.md` + `DECISIONS.md` §20;
  `docs/frontend-completion/13-open-decisions.md` — the 2026-09-19 F0 snapshot listing O-01..O-20 as
  open — is **HISTORICAL/superseded**.)
- Telegram / Bale / Mobile / Backup — **REQUIRED CAPABILITY, implementation DEFERRED** until a
  backend/integration layer exists and is authorized.

> **No product implementation is authorized by this document.** Treat every row above as intent or
> status, and confirm the exact next slice from `docs/engineering/PROJECT_STATE.md` with owner approval.
