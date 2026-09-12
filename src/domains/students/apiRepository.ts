import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { StudentRepository } from "./repository";
import type { CreateStudentInput, Student, StudentListParams, UpdateStudentInput } from "./types";

const RESOURCE = "students";

/**
 * Implementation #2 — REST backend.
 *
 * Endpoints (contract, not yet served by any server):
 *   GET    /api/v1/students
 *   POST   /api/v1/students
 *   GET    /api/v1/students/{id}
 *   PATCH  /api/v1/students/{id}
 *   DELETE /api/v1/students/{id}
 *
 * Field mapping between the wire DTO and the UI entity is intentionally
 * deferred (see `toQuery`): the backend contract will be finalised with the
 * Students vertical slice.
 */
export class ApiStudentRepository implements StudentRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: StudentListParams = {}, signal?: AbortSignal): Promise<Page<Student>> {
    return this.client.getPage<Student>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<Student> {
    return this.client.get<Student>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  create(input: CreateStudentInput): Promise<Student> {
    return this.client.post<Student>(RESOURCE, input);
  }

  update(id: string, input: UpdateStudentInput): Promise<Student> {
    return this.client.patch<Student>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
  }
}

/** Domain params -> wire query params (snake_case, as per the API contract). */
export function toQuery(params: StudentListParams): QueryParams {
  return {
    search: params.search,
    status: params.status,
    instrument: params.instrument,
    payment: params.payment,
    teacher_id: params.teacherId,
    sort: params.sort,
    page: params.page,
    per_page: params.per_page,
  };
}
