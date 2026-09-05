# scheduling

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /sessions · GET|PATCH|DELETE /sessions/{id} · POST /sessions/{id}/move. Move is atomic and version-checked; a stale write returns 409 SCHEDULE_VERSION_CONFLICT (already representable by ApiError).
