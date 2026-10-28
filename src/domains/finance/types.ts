/**
 * Invoices — tuition billing with one accepted payment (v1, DECISIONS §40).
 *
 * The wire is snake_case on the query string (every Api repository's toQuery
 * sends it that way) and camelCase in bodies (the server validates the
 * camelCase keys the tests send). Amounts are integer toman. v1 has no
 * partial payments and paying never touches the student's own balance.
 */
import type { PaymentStatus } from "@/lib/financeVocabulary";

export type InvoiceStatus = Extract<PaymentStatus, "due" | "paid">;

/** How the single accepted payment arrived. */
export type PayMethod = "pos" | "transfer";

export const PAY_METHOD_LABEL: Record<PayMethod, string> = {
  pos: "کارت‌خوان",
  transfer: "کارت‌به‌کارت",
};

export interface Invoice {
  id: string;
  studentId: string;
  /** Denormalized by the server so the list renders without a second read. */
  studentName?: string;
  title: string;
  amount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  paidByUserId: string | null;
  paidMethod?: PayMethod | null;
  paidReference?: string | null;
}

export interface InvoiceListParams {
  studentId?: string;
  status?: InvoiceStatus;
  page?: number;
  per_page?: number;
}

export interface CreateInvoiceInput {
  studentId: string;
  title: string;
  amount: number;
  dueAt?: string;
}

export interface UpdateInvoiceInput {
  studentId?: string;
  title?: string;
  amount?: number;
  dueAt?: string | null;
}

export interface PayInvoiceInput {
  method: PayMethod;
  /** Transfer tracking code, when there is one. */
  reference?: string;
}
