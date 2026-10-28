# Reports — deferred

Reports is not implemented. `src/views/Reports.tsx` is an explicit deferred-state surface; there is no Reports repository, backend controller, or endpoint contract in the shipped system. Do not treat earlier sketches as an accepted API.

This deferral is distinct from invoice v1: the client/API composition has an invoice repository and backend under `src/domains/finance/` (DECISIONS.md §§40–41), but invoice records do not authorize report catalogs, aggregate analytics, revenue claims, or export endpoints. The demo composition continues to disclose finance as unavailable; Reports remains unavailable in both compositions.

Any future Reports capability requires its own domain contract, server-authoritative calculations, authorization, and an explicit decision. Until then, do not fabricate report rows or derive financial analytics client-side. The current boundary is asserted in `src/lib/financeReportsDeferral.ts` and `src/__tests__/m10Boundary.test.ts`.
