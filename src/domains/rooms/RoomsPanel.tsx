/**
 * Rooms management panel (Settings → operations).
 *
 * Rooms are academy configuration rather than a top-level workspace, so they
 * are managed here rather than getting their own route. All writes go through
 * `RoomRepository`; the panel never touches persistence directly.
 */
import { useState } from "react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { ListRow, Panel } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getRoomRepository } from "@/domains/registry";
import { RoomFormDialog } from "./RoomFormDialog";
import { useRooms } from "./useRooms";
import type { Room } from "./types";

export function RoomsPanel() {
  const { notify } = useApp();
  // Include inactive rooms: this is the screen where they are managed.
  const { items: rooms, loading, error, reload } = useRooms({ per_page: 200 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (room: Room) => {
    const inactive = room.active === false;
    setBusyId(room.id);
    try {
      const repository = getRoomRepository();
      if (inactive) await repository.update(room.id, { active: true });
      else await repository.deactivate(room.id);
      notify({
        tone: "success",
        title: inactive ? `${room.name} فعال شد` : `${room.name} غیرفعال شد`,
        detail: inactive
          ? "برای کلاس‌های جدید قابل انتخاب است."
          : "از تخصیص کلاس‌های جدید کنار گذاشته شد؛ کلاس‌های موجود تغییری نمی‌کنند.",
      });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="اتاق‌ها"
      kicker="فضاهای قابل رزرو در تقویم"
      action="افزودن اتاق"
      onAction={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      {loading ? (
        <LoadingState label="در حال بارگذاری اتاق‌ها…" />
      ) : error ? (
        <ErrorState title="بارگذاری اتاق‌ها ناموفق بود" description={error.message} onRetry={reload} />
      ) : rooms.length === 0 ? (
        <EmptyState
          title="هنوز اتاقی ثبت نشده"
          description="برای زمان‌بندی کلاس‌ها حداقل یک اتاق لازم است."
          action="افزودن اتاق"
          onAction={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="space-y-2">
          {rooms.map((room) => {
            const inactive = room.active === false;
            return (
              <ListRow
                key={room.id}
                title={room.name}
                meta={`${room.kind} · ظرفیت ${faNum(room.capacity)} نفر`}
                end={
                  <span className="flex items-center gap-2">
                    <StatusBadge
                      tone={inactive ? "neutral" : room.occupancy > 90 ? "warn" : "ok"}
                      label={inactive ? "غیرفعال" : room.occupancy > 90 ? "نزدیک اشباع" : "فعال"}
                    />
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setEditing(room);
                        setFormOpen(true);
                      }}
                    >
                      ویرایش
                    </Button>
                    <Button size="sm" variant="subtle" disabled={busyId === room.id} onClick={() => void toggleActive(room)}>
                      {inactive ? "فعال‌سازی" : "غیرفعال‌سازی"}
                    </Button>
                  </span>
                }
              />
            );
          })}
        </ul>
      )}

      <RoomFormDialog
        open={formOpen}
        room={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `${saved.name} افزوده شد` : `${saved.name} به‌روزرسانی شد`,
            detail: "تغییرات در دادهٔ دمو ذخیره شد.",
          })
        }
      />
    </Panel>
  );
}
