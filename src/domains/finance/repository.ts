/**
 * Invoices — the repository contract (v1, DECISIONS §40).
 *
 * Issue due, discharge by one accepted payment (`pay`), read back the
 * receipt. Update is due-only. No partial payments, no balance sync —
 * those are later, owner-approved steps, not silent v1 side effects.
 */
import type { Page } from "@/api/types";
import type { CreateInvoiceInput, Invoice, InvoiceListParams, PayInvoiceInput, UpdateInvoiceInput } from "./types";

export interface FinanceRepository {
  list(params?: InvoiceListParams, signal?: AbortSignal): Promise<Page<Invoice>>;
  get(id: string, signal?: AbortSignal): Promise<Invoice>;
  create(input: CreateInvoiceInput): Promise<Invoice>;
  update(id: string, input: UpdateInvoiceInput): Promise<Invoice>;
  /** Discharge by the one accepted payment. Terminal: a paid invoice refuses. */
  pay(id: string, input: PayInvoiceInput): Promise<Invoice>;
}
