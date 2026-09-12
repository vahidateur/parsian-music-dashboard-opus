import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { TeacherRepository } from "./repository";
import type { CreateTeacherInput, Teacher, TeacherListParams, UpdateTeacherInput } from "./types";

const RESOURCE = "teachers";

/**
 * Implementation #2 — REST backend.
 *
 * Endpoints (contract; no server serves these yet):
 *   GET    /api/v1/teachers
 *   POST   /api/v1/teachers
 *   GET    /api/v1/teachers/{id}
 *   PATCH  /api/v1/teachers/{id}
 *   POST   /api/v1/teachers/{id}/deactivate
 *   DELETE /api/v1/teachers/{id}
 */
export class ApiTeacherRepository implements TeacherRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: TeacherListParams = {}, signal?: AbortSignal): Promise<Page<Teacher>> {
    return this.client.getPage<Teacher>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<Teacher> {
    return this.client.get<Teacher>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  create(input: CreateTeacherInput): Promise<Teacher> {
    return this.client.post<Teacher>(RESOURCE, input);
  }

  update(id: string, input: UpdateTeacherInput): Promise<Teacher> {
    return this.client.patch<Teacher>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
  }

  deactivate(id: string): Promise<Teacher> {
    return this.client.post<Teacher>(`${RESOURCE}/${encodeURIComponent(id)}/deactivate`, {});
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
  }
}

export function toQuery(params: TeacherListParams): QueryParams {
  return {
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    instrument: params.instrument,
    status: params.status,
    assignable: params.assignableOnly ? 1 : undefined,
    sort: params.sort,
    dir: params.dir,
  };
}
