# library

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /resources · GET|PATCH|DELETE /resources/{id}. Files go through POST /uploads and GET /resources/{id}/download so storage stays out of the domain.
