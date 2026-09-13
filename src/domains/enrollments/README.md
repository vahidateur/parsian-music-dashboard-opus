# enrollments

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /classes/{id}/enrollments · DELETE /classes/{id}/enrollments/{enrollmentId} · waitlist. Enrollment is the authoritative Student ↔ Class link (never `student.classId`).
