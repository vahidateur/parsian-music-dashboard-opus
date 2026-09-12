# messaging

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /conversations · GET|POST /conversations/{id}/messages. Delivery status (queued/sent/delivered/read/failed) comes later.
