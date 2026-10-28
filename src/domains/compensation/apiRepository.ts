import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { CompensationRepository } from "./repository";
import type {
  CompleteCompensationInput,
  CompensationListParams,
  RegisterCompensationInput,
  ScheduleCompensationInput,
  SessionCompensation,
} from "./types";

const RESOURCE = "compensations";

/**
 * REST implementation of the compensation domain.
 *
 * Endpoints served by the server (§38 of the planning handoff, authorized
 * under the existing `schedule.read` / `schedule.write` ids):
 *   GET    /compensations
 *   POST   /compensations
 *   GET    /compensations/{id}
 *   POST   /compensations/{id}/schedule
 *   POST   /compensations/{id}/complete
 *
 * Reads require `schedule.read`; the three writes require `schedule.write`
 * (a make-up IS a session; no compensation-specific id exists and none is
 * invented). A teacher is read-scoped to their own classes server-side.
 *
 * The wire carries no actor: the repository receives the demo-era
 * `CompensationActor` (`userId`, `permissions`) because the interface still
 * names it, but a client-supplied actor would be an unverified claim, so it
 * is stripped here and the server records the authenticated user instead —
 * the same rule as chat's `from`.
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so the ledger re-reads without knowing who
 * wrote. A write the server refused changes nothing, so the version is bumped
 * only after the write has actually happened. Reads bump nothing.
 */
export class ApiCompensationRepository implements CompensationRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: CompensationListParams = {}, signal?: AbortSignal): Promise<Page<SessionCompensation>> {
    return this.client.getPage<SessionCompensation>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<SessionCompensation> {
    return this.client.get<SessionCompensation>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  async register(input: RegisterCompensationInput): Promise<SessionCompensation> {
    const { actor: _actor, ...body } = input;
    const created = await this.client.post<SessionCompensation>(RESOURCE, body);
    bumpDataVersion();
    return created;
  }

  async schedule(id: string, input: ScheduleCompensationInput): Promise<SessionCompensation> {
    const { actor: _actor, ...body } = input;
    const updated = await this.client.post<SessionCompensation>(`${RESOURCE}/${encodeURIComponent(id)}/schedule`, body);
    bumpDataVersion();
    return updated;
  }

  async complete(id: string, input: CompleteCompensationInput): Promise<SessionCompensation> {
    const { actor: _actor, ...body } = input;
    const updated = await this.client.post<SessionCompensation>(`${RESOURCE}/${encodeURIComponent(id)}/complete`, body);
    bumpDataVersion();
    return updated;
  }
}

/** Domain params → wire query params (snake_case, per the API contract). */
export function toQuery(params: CompensationListParams): QueryParams {
  return {
    original_session_id: params.originalSessionId,
    student_id: params.studentId,
    class_id: params.classId,
    status: params.status,
    open_only: params.openOnly ? 1 : undefined,
    compensation_session_id: params.compensationSessionId,
    needs_attention: params.needsAttention ? 1 : undefined,
    page: params.page,
    per_page: params.per_page,
  };
}
