/**
 * Implementation — REST backend.
 *
 * Endpoints (served; see backend/routes/api.php):
 *   GET    /api/v1/invoices
 *   POST   /api/v1/invoices
 *   GET    /api/v1/invoices/{id}
 *   PATCH  /api/v1/invoices/{id}
 *   POST   /api/v1/invoices/{id}/pay
 */
import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { FinanceRepository } from "./repository";
import type { CreateInvoiceInput, Invoice, InvoiceListParams, PayInvoiceInput, UpdateInvoiceInput } from "./types";

const RESOURCE = "invoices";

export class ApiFinanceRepository implements FinanceRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: InvoiceListParams = {}, signal?: AbortSignal): Promise<Page<Invoice>> {
    return this.client.getPage<Invoice>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<Invoice> {
    return this.client.get<Invoice>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  async create(input: CreateInvoiceInput): Promise<Invoice> {
    const created = await this.client.post<Invoice>(RESOURCE, input);
    bumpDataVersion();
    return created;
  }

  async update(id: string, input: UpdateInvoiceInput): Promise<Invoice> {
    const updated = await this.client.patch<Invoice>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async pay(id: string, input: PayInvoiceInput): Promise<Invoice> {
    const paid = await this.client.post<Invoice>(`${RESOURCE}/${encodeURIComponent(id)}/pay`, input);
    bumpDataVersion();
    return paid;
  }
}

export function toQuery(params: InvoiceListParams): QueryParams {
  return {
    student_id: params.studentId,
    status: params.status,
    page: params.page,
    per_page: params.per_page,
  };
}
