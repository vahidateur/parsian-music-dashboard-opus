# attendance

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET /attendance · POST /attendance/bulk · PATCH /attendance/{id}. Attendance hangs off a Session, never off a Class.
