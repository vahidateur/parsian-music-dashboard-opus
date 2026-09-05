# finance

Planned domain — **not implemented in Phase A**.

When this domain is built it follows the Students pattern:
`types.ts` → `repository.ts` (interface) → `demoRepository.ts` → `apiRepository.ts`, wired in `src/domains/registry.ts`.

Contract sketch: GET|POST /invoices · GET|PATCH /invoices/{id} · POST /invoices/{id}/payments · POST /payments/{id}/refund. Balances are computed by Finance, never from session counters.
