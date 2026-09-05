# Students, teachers, rooms, classes and enrollments

Status labels used here: **IMPLEMENTED**, **DEMO ONLY**, **BACKEND REQUIRED**, **NOT IMPLEMENTED**.

This document covers the core academy domain added in phase 1. It complements
`data-layer.md` (repository/adapter mechanics) and does not repeat it.

## Domain map

```
Student ──< Enrollment >── Class ──> Teacher
                             └────> Room
```

- **Enrollment is the authoritative Student↔Class edge.** `Student` has no
  `classId`, and `AcademyClass.studentIds` / `enrolled` / `waitlist` are a
  *derived projection* that the enrollment repository recomputes on every write
  (`syncClassProjection`). Never write those three fields directly.
- **Archive, don't delete.** Classes support `archive()`; teachers and rooms
  support `deactivate()`. Hard `delete()` exists but refuses to run when
  dependent records remain (`TEACHER_HAS_CLASSES`, `ROOM_IN_USE`,
  `CLASS_HAS_ENROLLMENTS`).
- Archived classes are hidden from `list()` unless the caller passes
  `includeArchived` or an explicit `status`.

## `national_id` — a hard domain invariant (§9)

`Student.nationalId` is **required**, normalized, checksum-validated and unique.

- Single source of truth: `src/lib/nationalId.ts`. Do not re-implement the
  algorithm anywhere else.
- Normalization converts Persian/Arabic digits to ASCII, strips separators, and
  left-pads 8–9 digit input to 10. Shorter input is **not** padded — padding a
  typo can fabricate a checksum-valid code.
- Checksum: `sum = Σ digit[i]×(10−i)` for `i∈0..8`; `r = sum % 11`; valid iff
  `r < 2 ? check === r : check === 11 − r`. Codes made of a single repeated
  digit satisfy the arithmetic and are rejected explicitly.
- Uniqueness is enforced on create **and** update (excluding the edited row) by
  `DemoStudentRepository.assertNationalId`.
- Backup import re-validates every student's national ID and rejects missing,
  invalid or duplicated values.

**Privacy (§30).** The full value is never rendered in list or header chrome —
`Students.tsx` shows only the last four digits. Keep it out of telemetry, debug
logs, analytics and URLs.

**BACKEND REQUIRED.** All of the above are in-process client checks and are racy
by construction. Production must additionally enforce:

| Invariant | Mechanism |
| --- | --- |
| National ID uniqueness | `UNIQUE (organization_id, national_id)` + normalize before insert |
| One open enrollment per student per class | partial `UNIQUE (student_id, class_id)` over open statuses |
| Class capacity | transactional check (`SELECT … FOR UPDATE`) inside the enroll transaction |
| Class capacity ≤ room capacity | CHECK constraint or trigger |
| Teacher phone uniqueness | `UNIQUE (organization_id, phone)` on a normalized E.164 column |

## Error codes

Demo repositories throw `ApiError` with codes the API adapter is expected to
mirror: `STUDENT_INVALID`, `STUDENT_NATIONAL_ID_TAKEN`, `TEACHER_NOT_FOUND`,
`TEACHER_PHONE_TAKEN`, `TEACHER_HAS_CLASSES`, `TEACHER_INVALID`,
`ROOM_NOT_FOUND`, `ROOM_NAME_TAKEN`, `ROOM_IN_USE`, `ROOM_INVALID`,
`CLASS_NOT_FOUND`, `CLASS_INVALID`, `CLASS_ARCHIVED`, `CLASS_FULL`,
`CLASS_HAS_ENROLLMENTS`, `CLASS_CAPACITY_BELOW_ENROLLED`,
`ENROLLMENT_NOT_FOUND`, `ENROLLMENT_INVALID`, `ENROLLMENT_DUPLICATE`.

## REST contract — **BACKEND REQUIRED** (no server implements this yet)

`/api/v1/{teachers,rooms,classes,enrollments}`

| Method | Path | Notes |
| --- | --- | --- |
| `GET` / `POST` | `/{resource}` | list (paginated) / create |
| `GET` / `PATCH` / `DELETE` | `/{resource}/{id}` | fetch / partial update / guarded delete |
| `POST` | `/teachers/{id}/deactivate`, `/rooms/{id}/deactivate` | reversible soft state |
| `POST` | `/classes/{id}/archive` | non-destructive retire |
| `POST` | `/enrollments/{id}/withdraw` | frees a seat |

Query parameters are snake_case: `per_page`, `teacher_id`, `room_id`,
`student_id`, `min_capacity`, `assignable`.

## Status

| Capability | Demo | Production |
| --- | --- | --- |
| Teacher/room/class/enrollment CRUD | IMPLEMENTED | BACKEND REQUIRED |
| National-ID validation + uniqueness | IMPLEMENTED | BACKEND REQUIRED (DB constraint) |
| Capacity & waitlist | IMPLEMENTED (racy) | BACKEND REQUIRED (transactional) |
| Student create/edit form | NOT IMPLEMENTED | NOT IMPLEMENTED |
| Scheduling conflict detection | NOT IMPLEMENTED | BACKEND REQUIRED (phase 5) |
