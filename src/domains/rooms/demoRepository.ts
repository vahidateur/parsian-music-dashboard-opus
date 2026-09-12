import { demoStore, type DemoStore } from "@/services/demoStore";
import { conflict, matchesQuery, notFound, paginate, sortRows, validationError } from "@/domains/shared/demoCollection";
import type { Page } from "@/api/types";
import type { RoomRepository } from "./repository";
import type { CreateRoomInput, Room, RoomListParams, UpdateRoomInput } from "./types";

/** A room is assignable unless explicitly deactivated (`active === false`). */
export const isRoomAssignable = (room: Room): boolean => room.active !== false;

export class DemoRoomRepository implements RoomRepository {
  constructor(private readonly store: DemoStore = demoStore) {}

  async list(params: RoomListParams = {}): Promise<Page<Room>> {
    const filtered = (this.store.rooms.all() as Room[]).filter((r) => {
      if (params.assignableOnly && !isRoomAssignable(r)) return false;
      if (params.minCapacity !== undefined && r.capacity < params.minCapacity) return false;
      return matchesQuery([r.name, r.kind], params.search);
    });
    return paginate(sortRows(filtered, (r) => r.name), params);
  }

  async get(id: string): Promise<Room> {
    const found = this.store.rooms.find(id) as Room | undefined;
    if (!found) throw roomNotFound(id);
    return found;
  }

  async create(input: CreateRoomInput): Promise<Room> {
    validate(input);
    this.assertNameFree(input.name);
    return this.store.rooms.create({ occupancy: 0, active: true, ...input }) as Room;
  }

  async update(id: string, input: UpdateRoomInput): Promise<Room> {
    validate(input, true);
    if (input.name !== undefined) this.assertNameFree(input.name, id);
    const updated = this.store.rooms.update(id, input) as Room | undefined;
    if (!updated) throw roomNotFound(id);
    return updated;
  }

  async deactivate(id: string): Promise<Room> {
    const updated = this.store.rooms.update(id, { active: false }) as Room | undefined;
    if (!updated) throw roomNotFound(id);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const used = this.store.classes.all().filter((c) => c.roomId === id);
    if (used.length > 0) {
      throw conflict(
        "ROOM_IN_USE",
        `این اتاق در ${used.length} کلاس استفاده می‌شود. ابتدا کلاس‌ها را جابه‌جا کنید یا اتاق را غیرفعال کنید.`,
      );
    }
    if (!this.store.rooms.remove(id)) throw roomNotFound(id);
  }

  private assertNameFree(name: string, exceptId?: string): void {
    const taken = (this.store.rooms.all() as Room[]).some(
      (r) => r.name.trim() === name.trim() && r.id !== exceptId,
    );
    if (taken) throw conflict("ROOM_NAME_TAKEN", "اتاقی با این نام وجود دارد.", { name: ["تکراری است"] });
  }
}

function roomNotFound(id: string) {
  return notFound("ROOM_NOT_FOUND", `اتاق با شناسهٔ ${id} یافت نشد.`);
}

function validate(input: Partial<CreateRoomInput>, partial = false): void {
  const fields: Record<string, string[]> = {};
  const has = (k: keyof CreateRoomInput) => !partial || input[k] !== undefined;
  if (has("name") && (input.name ?? "").trim().length < 1) fields.name = ["نام اتاق الزامی است."];
  if (has("capacity")) {
    const c = input.capacity;
    if (typeof c !== "number" || !Number.isInteger(c) || c < 1) fields.capacity = ["ظرفیت باید عددی صحیح و حداقل ۱ باشد."];
    else if (c > 500) fields.capacity = ["ظرفیت غیرواقعی است."];
  }
  if (Object.keys(fields).length > 0) throw validationError("ROOM_INVALID", "اطلاعات اتاق معتبر نیست.", fields);
}
