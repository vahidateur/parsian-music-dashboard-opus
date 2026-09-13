import { useCallback, useMemo, useState } from "react";
import { getRoomRepository } from "../registry";
import { useResourceList } from "../shared/useResource";
import type { CreateRoomInput, Room, RoomListParams, UpdateRoomInput } from "./types";

/**
 * Room list + mutations, adapter-agnostic: the active repository is resolved
 * from the registry so the view works identically in demo and API mode.
 */
export function useRooms(params: RoomListParams = {}) {
  const [revision, setRevision] = useState(0);
  const repository = useMemo(() => getRoomRepository(), []);
  const list = useResourceList<Room, RoomListParams>(
    (p, signal) => repository.list(p, signal),
    params,
    revision,
  );
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const create = useCallback(
    async (input: CreateRoomInput) => {
      const created = await repository.create(input);
      refresh();
      return created;
    },
    [repository, refresh],
  );
  const update = useCallback(
    async (id: string, input: UpdateRoomInput) => {
      const updated = await repository.update(id, input);
      refresh();
      return updated;
    },
    [repository, refresh],
  );

  return { ...list, create, update, refresh, repository };
}
