import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";
import type { ClassRepository } from "./repository";
import type { AcademyClass, ClassListParams, CreateClassInput, UpdateClassInput } from "./types";

const RESOURCE = "classes";

/** Implementation #2 — REST. Endpoints under /api/v1/classes; no server yet. */
export class ApiClassRepository implements ClassRepository {
  constructor(private readonly client: ApiClient) {}
  list(params: ClassListParams = {}, signal?: AbortSignal): Promise<Page<AcademyClass>> {
    return this.client.getPage<AcademyClass>(RESOURCE, { query: toQuery(params), signal });
  }
  get(id: string, signal?: AbortSignal): Promise<AcademyClass> {
    return this.client.get<AcademyClass>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }
  async create(input: CreateClassInput): Promise<AcademyClass> {
    const created = await this.client.post<AcademyClass>(RESOURCE, input);
    bumpDataVersion();
    return created;
  }
  async update(id: string, input: UpdateClassInput): Promise<AcademyClass> {
    const updated = await this.client.patch<AcademyClass>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }
  async archive(id: string): Promise<AcademyClass> {
    const archived = await this.client.post<AcademyClass>(`${RESOURCE}/${encodeURIComponent(id)}/archive`, {});
    bumpDataVersion();
    return archived;
  }
  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
    bumpDataVersion();
  }
}

export function toQuery(params: ClassListParams): QueryParams {
  return {
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    instrument: params.instrument,
    teacher_id: params.teacherId,
    room_id: params.roomId,
    status: params.status,
    sort: params.sort,
    dir: params.dir,
  };
}
