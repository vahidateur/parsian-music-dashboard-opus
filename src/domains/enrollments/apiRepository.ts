import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { EnrollmentRepository } from "./repository";
import type { CreateEnrollmentInput, Enrollment, EnrollmentListParams, UpdateEnrollmentInput } from "./types";

const RESOURCE = "enrollments";

/**
 * Implementation #2 — REST. Endpoints under /api/v1/enrollments; no server yet.
 * Capacity/duplicate rules are enforced server-side in production; this client
 * simply surfaces the 409 the backend returns.
 */
export class ApiEnrollmentRepository implements EnrollmentRepository {
  constructor(private readonly client: ApiClient) {}
  list(params: EnrollmentListParams = {}, signal?: AbortSignal): Promise<Page<Enrollment>> {
    return this.client.getPage<Enrollment>(RESOURCE, { query: toQuery(params), signal });
  }
  get(id: string, signal?: AbortSignal): Promise<Enrollment> {
    return this.client.get<Enrollment>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }
  async enroll(input: CreateEnrollmentInput): Promise<Enrollment> {
    const created = await this.client.post<Enrollment>(RESOURCE, input);
    bumpDataVersion();
    return created;
  }
  async update(id: string, input: UpdateEnrollmentInput): Promise<Enrollment> {
    const updated = await this.client.patch<Enrollment>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }
  async withdraw(id: string): Promise<Enrollment> {
    const result = await this.client.post<Enrollment>(`${RESOURCE}/${encodeURIComponent(id)}/withdraw`, {});
    bumpDataVersion();
    return result;
  }
  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }
}

export function toQuery(params: EnrollmentListParams): QueryParams {
  return {
    page: params.page,
    per_page: params.per_page,
    student_id: params.studentId,
    class_id: params.classId,
    status: params.status,
    active: params.activeOnly ? 1 : undefined,
  };
}
