import type { Page } from "@/api/types";
import type { CreateRoomInput, Room, RoomListParams, UpdateRoomInput } from "./types";

export interface RoomRepository {
  list(params?: RoomListParams, signal?: AbortSignal): Promise<Page<Room>>;
  get(id: string, signal?: AbortSignal): Promise<Room>;
  create(input: CreateRoomInput): Promise<Room>;
  update(id: string, input: UpdateRoomInput): Promise<Room>;
  deactivate(id: string): Promise<Room>;
  delete(id: string): Promise<void>;
}
