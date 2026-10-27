import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type {
  CreateInstrumentInput,
  InstrumentListParams,
  InstrumentRecord,
  UpdateInstrumentInput,
} from "./types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { InstrumentRepository } from "./repository";

const RESOURCE = "instruments";

/**
 * REST implementation of the instrument domain.
 *
 * Endpoints (served by the server now):
 *   GET    /api/v1/instruments              catalogue, optional activeOnly + search
 *   POST   /api/v1/instruments              create (slug is the id)
 *   GET    /api/v1/instruments/{id}        one record
 *   PATCH  /api/v1/instruments/{id}        rename / describe / activate / reorder
 *                                            (the slug is immutable server-side)
 *   POST   /api/v1/instruments/{id}/active  soft state change
 *   DELETE /api/v1/instruments/{id}        refused while referenced
 *
 * Reads are allowed to every authenticated role — the catalogue is a lookup
 * table, not personal data. Writes require `instruments.write`
 * (administrator + manager).
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so pickers refresh without knowing who wrote.
 * A write that the server refused changes nothing, so the version is bumped
 * only after the write has actually happened.
 */
export class ApiInstrumentRepository implements InstrumentRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: InstrumentListParams = {}, signal?: AbortSignal): Promise<Page<InstrumentRecord>> {
    return this.client.getPage<InstrumentRecord>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<InstrumentRecord> {
    return this.client.get<InstrumentRecord>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  async create(input: CreateInstrumentInput): Promise<InstrumentRecord> {
    const created = await this.client.post<InstrumentRecord>(RESOURCE, input);
    bumpDataVersion();
    return created;
  }

  async update(id: string, input: UpdateInstrumentInput): Promise<InstrumentRecord> {
    const updated = await this.client.patch<InstrumentRecord>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async setActive(id: string, active: boolean): Promise<InstrumentRecord> {
    const updated = await this.client.post<InstrumentRecord>(`${RESOURCE}/${encodeURIComponent(id)}/active`, {
      active,
    });
    bumpDataVersion();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }
}

/** Domain params → wire query params (snake_case, as per the API contract). */
export function toQuery(params: InstrumentListParams): QueryParams {
  return {
    search: params.search,
    activeOnly: params.activeOnly ? 1 : undefined,
    page: params.page,
    per_page: params.per_page,
  };
}
