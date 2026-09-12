# reports

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET /reports/dashboard|attendance|finance|students · POST /reports/attendance/export. Reports are authoritative server-side results, not client-side math.
