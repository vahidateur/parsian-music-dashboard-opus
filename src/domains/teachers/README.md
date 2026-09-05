# teachers

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /teachers · GET|PATCH|DELETE /teachers/{id} · /teachers/{id}/availability|schedule|classes. Availability is its own aggregate, not a Teacher field.
