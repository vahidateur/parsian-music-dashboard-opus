# Phase B frontend gap matrix

**Recorded:** 2026-09-30  
**Audited and implemented on:** `cleanup/demo-migration-lineage`  
**Implementation commit:** `5e5fa35af30070fa08b1ad6004f2ab29dffc27b0`  
**Test commit:** `88fee2665434647f81b05b0f1560270ab56b86e3`  
**Accepted baseline:** `7ff23379bb846798cdabd96be1ba9344792c0e24`  
**Decision A record:** `c4e60d1475a90ca0fd93cf88d18c3053d42191f6`  
**Live tip:** parent `c4e60d1475a90ca0fd93cf88d18c3053d42191f6`, subject `docs(engineering): synchronize Phase B lineage pointers`. See [SESSION_HANDOFF.md](SESSION_HANDOFF.md). This file does not name that commit's own SHA.  
**Not a merge source:** `docs/demo-migration-plan`  
**Not rewritten:** `docs/gap-matrix.md` (Phase 0 snapshot; OPEN_ITEMS documentation drift)

Classifications used here: IMPLEMENTED, PARTIAL, MISSING, BACKEND-ONLY, CONTRACT MISSING, OWNER DECISION REQUIRED.

Frontend checks are UX. None of the IMPLEMENTED rows is server authorization.

| ID | Area | Status | Evidence | Remaining |
| --- | --- | --- | --- | --- |
| A | Authentication | PARTIAL | `src/domains/auth/AuthContext.tsx`, `src/App.tsx` `AuthGate`. Demo session is not security (`docs/architecture/auth.md`). | BACKEND-ONLY: hashing, expiry, revocation. |
| B | Roles | IMPLEMENTED | Five roles in `src/domains/auth/permissions.ts`. | Live policy can replace the matrix. Still client state. |
| C | Permissions | PARTIAL | `viewPermissions` plus `can` / `useCan`. Phase B hid finance payment, message writes, branding save, gallery writes, and pointed settings export at the session holder. | Rooms, instruments, learning, progress writes have no named permission. See PB-3. |
| D | Scope | PARTIAL | `src/domains/auth/scope.ts` assigned-only when a teacher has `teacherId`. Students view uses the helpers. | Teacher with no `teacherId` still falls through to org-wide. PB-1. |
| E | Tenant / organization | BACKEND-ONLY | O-14 in `docs/engineering/GOVERNANCE_CHECKPOINT.md`: tenant from the token, `users.organization_id` NOT NULL. | No `organization_id` on `Session`. Not added. |
| F | Resource ownership | BACKEND-ONLY | O-08: no personal `owner_id`; provenance is not ACL. | Server policy. Not invented here. |
| G | Users | PARTIAL | `src/components/settings/UsersPanel.tsx` gates create, role, status, delete, and new password on `users.write`. | Identity rules are PB-2. Server must authorize. |
| H | Administrators / managers | PARTIAL | Shipped matrix: only `administrator` has `users.write` and `roles.write`. Manager can read users. | PB-2. No administrator-to-administrator exception exists. |
| I | Students | PARTIAL | Repository CRUD. Writes use `students.write`. Teacher list/detail uses assigned helpers. | `useCan(...) \|\| !user` remains. PB-4. Server scope required. |
| J | Teachers | PARTIAL | `teachers.write` on the list write flag. Detail uses `useCan("teachers.write")` without the null idiom. | Server authorization. |
| K | Rooms | PARTIAL | `src/domains/rooms/RoomsPanel.tsx` writes with no `useCan`. Mounted from settings. | PB-3. No `rooms.write` exists; none was invented. |
| L | Classes | PARTIAL | `classes.write` hides edit, enroll, and archive when the flag is false. | Same `\|\| !user` idiom. PB-4. |
| M | Enrollments | PARTIAL | Enroll control is the class `mayWrite` flag (`classes.write`). | No separate enrollment permission. Server capacity check is BACKEND-ONLY. |
| N | Scheduling | PARTIAL | `schedule.write` gates generate, reschedule, and cancel. | Server must re-check conflicts. I19 untouched. |
| O | Attendance | PARTIAL | `attendance.write` and a non-null recorder. | Assigned-session enforcement is BACKEND-ONLY (T-03). |
| P | Progress | PARTIAL | Panels write. `StudentProgressPanel` shows some actions when `role === "teacher"`. | PB-3. No `progress.write` permission exists. |
| Q | Library | IMPLEMENTED | `src/views/Library.tsx` `useCan("library.write")`. | Server write check still BACKEND-ONLY. |
| R | Media | PARTIAL | Client blob store and `MediaRepository`. | CONTRACT MISSING for object storage. O-16 is backend policy, not an endpoint invented here. |
| S | Branding | IMPLEMENTED | `BrandingPanel` now requires `settings.write` to edit or save. | Server check BACKEND-ONLY. |
| T | Gallery | IMPLEMENTED | View and `GalleryPanel` use `library.write` for writes. Read remains `library.read`. | Server media ACL BACKEND-ONLY. |
| U | Learning | PARTIAL | `LearningPanel` writes with no permission symbol. Eligibility helpers exist. | PB-3. O-01 is decided per-program; that did not name a write permission. |
| V | Chat | PARTIAL | In-app send persists. Phase B hides send, create, templates, and management without `messages.write`. Export stays on read. | Telegram and Bale adapters return unavailable. No new path. |
| W | Notifications | CONTRACT MISSING | Settings toggles disclose that nothing is saved. O-17 says no notifications domain in v1. `10-integration-architecture.md` still calls notification delivery a required later capability. | PB-5. Push not started. |
| X | Reporting / export | PARTIAL | Settings export now uses the session holder (`I22` frontend half). Finance and Reports views are the deferred I2 surface. | Server export and finance domain BACKEND-ONLY. |
| Y | Student portal | MISSING | Contract is `docs/frontend-completion/15-student-portal-architecture.md`. D1: no student role in this panel, no portal UI. | O-13 credential factor remains OPEN. No fake portal backend. |
| Z | Academy management | PARTIAL | Settings shell, users, roles, branding, hours, and session rules exist. Rooms, instruments, and learning writes are ungated. | PB-2 and PB-3 before more settings writes are hidden. |

Phase B did not start Laravel, Telegram, or push. It did not merge to `main`. The SHA pointer above does not change any row and does not make Phase B complete.
