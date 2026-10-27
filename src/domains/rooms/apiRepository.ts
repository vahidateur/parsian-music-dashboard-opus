import type { ApiClient } from "@/api/client";
import type { Page, QueryParams } from "@/api/types";
import type { RoomRepository } from "./repository";
import type { CreateRoomInput, Room, RoomListParams, UpdateRoomInput } from "./types";
import { bumpDataVersion } from "@/domains/shared/dataVersion";

const RESOURCE = "rooms";

/**
 * REST implementation of the rooms domain.
 *
 * Endpoints served by the server (DECISIONS.md §35 lifts the PB-3 block):
 *   GET    /api/v1/rooms
 *   POST   /api/v1/rooms
 *   GET    /api/v1/rooms/{id}
 *   PATCH  /api/v1/rooms/{id}
 *   DELETE /api/v1/rooms/{id}
 *   POST   /api/v1/rooms/{id}/deactivate
 *
 * Successful writes bump the shared data version, the same invalidation every
 * other list hook listens to, so pickers refresh without knowing who wrote.
 * A write the server refused changes nothing, so the version is bumped only
 * after the write has actually happened.
 */
export class ApiRoomRepository implements RoomRepository {
  constructor(private readonly client: ApiClient) {}

  list(params: RoomListParams = {}, signal?: AbortSignal): Promise<Page<Room>> {
    return this.client.getPage<Room>(RESOURCE, { query: toQuery(params), signal });
  }

  get(id: string, signal?: AbortSignal): Promise<Room> {
    return this.client.get<Room>(`${RESOURCE}/${encodeURIComponent(id)}`, { signal });
  }

  async create(input: CreateRoomInput): Promise<Room> {
    const created = await this.client.post<Room>(RESOURCE, input);
    bumpDataVersion();
    return created;
  }

  async update(id: string, input: UpdateRoomInput): Promise<Room> {
    const updated = await this.client.patch<Room>(`${RESOURCE}/${encodeURIComponent(id)}`, input);
    bumpDataVersion();
    return updated;
  }

  async deactivate(id: string): Promise<Room> {
    const updated = await this.client.post<Room>(`${RESOURCE}/${encodeURIComponent(id)}/deactivate`, {});
    bumpDataVersion();
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.client.delete(`${RESOURCE}/${encodeURIComponent(id)}`);
    bumpDataVersion();
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
