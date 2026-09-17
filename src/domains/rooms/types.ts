/**
 * Room domain types.
 *
 * MULTI-TENANCY (§21): production `rooms` needs `organization_id`, with room
 * name unique per organization rather than globally.
 */
import type { ListParams } from "@/api/types";
import type { DemoRoom } from "@/domains/demo/types";

/** Reuses the dataset shape; `active` gates new class/session assignment. */
export type Room = DemoRoom;

export interface RoomListParams extends ListParams {
  search?: string;
  /** Only rooms assignable to new classes/sessions. */
  assignableOnly?: boolean;
  minCapacity?: number;
}

export type CreateRoomInput = Omit<Room, "id" | "occupancy"> & Partial<Pick<Room, "occupancy">>;
export type UpdateRoomInput = Partial<Omit<Room, "id">>;
