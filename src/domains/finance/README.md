# Finance: invoice v1 boundary

The finance domain currently serves **invoices and full-payment confirmation** in the client/API composition. It is not a full accounting, billing-ledger, or reporting system.

## Shipped invoice contract

- `types.ts`, `repository.ts`, `apiRepository.ts`, and `useInvoices.ts` define the frontend boundary.
- `ApiFinanceRepository` uses the backend endpoints `GET|POST /api/v1/invoices`, `GET|PATCH /api/v1/invoices/{id}`, and `POST /api/v1/invoices/{id}/pay`.
- The API composition wires `ApiFinanceRepository` from `src/domains/registry.client.ts`. The demo composition deliberately resolves the finance repository to `DOMAIN_UNAVAILABLE`; it does not maintain a second fake invoice/payment ledger.
- Backend policy and persistence are implemented by `backend/app/Domain/Finance/InvoicePolicy.php`, `InvoiceService.php`, and `InvoiceController.php`, with tests in `backend/tests/Feature/InvoiceTest.php`.
- Authorization is governed by [`DECISIONS.md` §§40–41](../../../docs/engineering/DECISIONS.md): `finance.read`, `finance.write` (issue/update), and `finance.pay` (payment confirmation) have distinct roles. The API owns tenant filtering and payment state transitions.

## Explicit limits

Invoice v1 supports issue/update and **one full payment** per invoice. Partial payments, student-balance synchronization, payment gateways, and computed revenue/finance analytics are not part of this contract. The overdue badge is display-only; it is not an authorization or payment rule.

**Reports remains deferred** under D6/I2. There is no reports repository or reports API. `src/views/Reports.tsx` renders the explicit deferred state and dashboard insights remain their own record-derived surface. See `src/domains/reports/README.md` and `src/lib/financeReportsDeferral.ts` for that separate boundary.
