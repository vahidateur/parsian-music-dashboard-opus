import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { RoomRepository } from "./repository";
import type { CreateRoomInput, Room, RoomListParams, UpdateRoomInput } from "./types";

const RESOURCE = "rooms";

/** Implementation #2 — REST. Endpoints under /api/v1/rooms; no server yet. */
export class ApiRoomRepository implements RoomRepository {
  constructor(private readonly client: ApiClient) {}
  list(params: RoomListParams = {}, signal?: AbortSignal): Promise<Page<Room>> {
    return this.client.getPage<Room>(RESOURCE, { query: toQuery(params), signal });
  }
  get(id: string, signal?: AbortSignal): Promise<Room> {
    return this.client.get<Room>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }
  create(input: CreateRoomInput): Promise<Room> {
    return this.client.post<Room>(RESOURCE, input);
  }
  update(id: string, input: UpdateRoomInput): Promise<Room> {
    return this.client.patch<Room>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
  }
  deactivate(id: string): Promise<Room> {
    return this.client.post<Room>(`${RESOURCE}/${encodeURIComponent(id)}/deactivate`, {});
  }
  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
  }
}

export function toQuery(params: RoomListParams): QueryParams {
  return {
    page: params.page,
    per_page: params.per_page,
    search: params.search,
    assignable: params.assignableOnly ? 1 : undefined,
    min_capacity: params.minCapacity,
  };
}
