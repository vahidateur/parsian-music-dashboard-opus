/**
 * Repertoire management (Settings → operations).
 *
 * Pieces are academy configuration like instruments and rooms, so they are
 * managed here rather than getting their own route. A piece that is already
 * assigned cannot be deleted — the repository refuses, and that refusal is
 * shown rather than swallowed.
 */
import { useState } from "react";
import { Music4 } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Chip, ListRow, Panel } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getProgressRepository } from "@/domains/registry";
import { useIsDemoEnvironment } from "@/domains/demo/useDataLifecycle";
import { instrumentName, useInstrumentCatalog } from "@/domains/instruments/catalog";
import { PieceFormDialog } from "./PieceFormDialog";
import { usePieces } from "./useProgress";
import { RANGE_UNIT_LABEL, type Piece } from "./types";

export function RepertoirePanel() {
  const { notify } = useApp();
  const demoEnvironment = useIsDemoEnvironment();
  const catalog = useInstrumentCatalog();
  const [instrumentId, setInstrumentId] = useState<string | "all">("all");
  const { items, loading, error, reload } = usePieces({
    per_page: 300,
    ...(instrumentId === "all" ? {} : { instrumentId }),
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Piece | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggleActive = async (piece: Piece) => {
    setBusyId(piece.id);
    try {
      await getProgressRepository().updatePiece(piece.id, { active: !piece.active });
      notify({
        tone: "success",
        title: piece.active ? `«${piece.title}» غیرفعال شد` : `«${piece.title}» فعال شد`,
        detail: piece.active
          ? "برای تخصیص جدید پیشنهاد نمی‌شود؛ تخصیص‌های موجود دست‌نخورده می‌مانند."
          : "اکنون قابل تخصیص است.",
      });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (piece: Piece) => {
    setBusyId(piece.id);
    try {
      await getProgressRepository().deletePiece(piece.id);
      notify({ tone: "success", title: `«${piece.title}» حذف شد` });
    } catch (cause) {
      // Typically PIECE_IN_USE — surfaced, not hidden.
      notify({ tone: "danger", title: "حذف انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      title="رپرتوار"
      kicker="قطعاتی که هنرجویان تمرین می‌کنند"
      action="افزودن قطعه"
      onAction={() => {
        setEditing(undefined);
        setFormOpen(true);
      }}
    >
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto">
        <Chip label="همه" active={instrumentId === "all"} onClick={() => setInstrumentId("all")} />
        {catalog
          .filter((i) => i.active)
          .map((instrument) => (
            <Chip
              key={instrument.id}
              tone="violet"
              label={instrument.name}
              active={instrumentId === instrument.id}
              onClick={() => setInstrumentId(instrumentId === instrument.id ? "all" : instrument.id)}
            />
          ))}
      </div>

      {loading ? (
        <LoadingState label="در حال بارگذاری رپرتوار…" />
      ) : error ? (
        <ErrorState title="بارگذاری رپرتوار ناموفق بود" description={error.message} onRetry={reload} />
      ) : items.length === 0 ? (
        <EmptyState
          title="قطعه‌ای ثبت نشده"
          description="برای تخصیص قطعه به هنرجویان، ابتدا رپرتوار را تعریف کنید."
          action="افزودن قطعه"
          onAction={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((piece) => (
            <li key={piece.id}>
              <ListRow
                lead={<Music4 className="size-3.5 text-gold-400" />}
                title={piece.title}
                meta={`${piece.composer} · ${instrumentName(piece.instrumentId)} · ${
                  RANGE_UNIT_LABEL[piece.rangeUnit]
                }${piece.totalRange ? ` (${faNum(piece.totalRange)})` : ""}`}
                end={
                  <span className="flex items-center gap-2">
                    <StatusBadge tone={piece.active ? "ok" : "neutral"} label={piece.active ? "فعال" : "غیرفعال"} />
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={() => {
                        setEditing(piece);
                        setFormOpen(true);
                      }}
                    >
                      ویرایش
                    </Button>
                    <Button size="sm" variant="subtle" disabled={busyId === piece.id} onClick={() => void toggleActive(piece)}>
                      {piece.active ? "غیرفعال‌سازی" : "فعال‌سازی"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busyId === piece.id} onClick={() => void remove(piece)}>
                      حذف
                    </Button>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        {faNum(items.length)} قطعه. قطعه‌ای که به هنرجویی تخصیص یافته حذف نمی‌شود تا سابقهٔ پیشرفت او خوانا بماند؛
        به‌جای حذف آن را غیرفعال کنید.
      </p>

      <PieceFormDialog
        open={formOpen}
        piece={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, mode) =>
          notify({
            tone: "success",
            title: mode === "create" ? `«${saved.title}» افزوده شد` : `«${saved.title}» به‌روزرسانی شد`,
            // The dialog awaited a real repository write, so the confirmation
            // may only call it demo data where it is demo data: in an EMPTY
            // environment this is the academy's own repertoire (H7 — the defect
            // M2 fixed in the five domain views, in Settings too).
            detail: demoEnvironment ? "تغییرات در دادهٔ دمو ذخیره شد." : "تغییرات در داده‌ها ذخیره شد.",
          })
        }
      />
    </Panel>
  );
}
