# auth

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: POST /auth/login · POST /auth/logout · GET /auth/me · POST /auth/refresh. Owns the session token handed to `setAuthToken()` and the permission list used for permission-aware UI (the backend stays the enforcement authority).
