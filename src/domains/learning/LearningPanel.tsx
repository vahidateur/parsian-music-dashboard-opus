/**
 * Learning programs and levels (Settings → operations).
 *
 * A program belongs to an instrument and owns an ordered list of levels; a
 * student is placed on exactly one level, and that placement drives which
 * library content they can see (`eligibility.ts`).
 *
 * The panel is a master/detail: pick a program on the right, manage its levels
 * on the left. All writes go through `LearningRepository`, which owns the
 * invariants (contiguous ordering, refusing to delete a level that still has
 * students or content).
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, GraduationCap } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, ListRow, Panel, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getLearningRepository } from "@/domains/registry";
import { useInstruments } from "@/domains/instruments/useInstruments";
import { LevelContentPanel } from "./LevelContentPanel";
import { useLevels, usePrograms } from "./useLearning";
import type { LearningLevel, LearningProgram } from "./types";
import { cn } from "@/utils/cn";

function partialNote(name: string, shown: number, total: number): string | null {
  return total > shown ? `${name}: ${shown} ردیف از ${total} — برای بارگذاری کامل نیاز به سرور است.` : null;
}

/** Inline "add" row shared by the program and level lists. */
function QuickAdd({
  label,
  placeholder,
  busy,
  onAdd,
}: {
  label: string;
  placeholder: string;
  busy: boolean;
  onAdd: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const name = value.trim();
    if (!name || busy) return;
    await onAdd(name);
    setValue("");
  };

  return (
    <form
      className="mt-3 flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Field label={label} className="flex-1">
        {(control) => (
          <input
            {...control}
            className={inputCls}
            placeholder={placeholder}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
      </Field>
      <Button
        type="submit"
        size="sm"
        variant="subtle"
        className="mb-[2px]"
        disabled={busy || !value.trim()}
      >
        افزودن
      </Button>
    </form>
  );
}

export function LearningPanel() {
  const { notify } = useApp();
  const { items: instruments, loading: instrumentsLoading, error: instrumentsError, reload: reloadInstruments } = useInstruments({ per_page: 200 });
  const {
    items: programs,
    total: programsTotal,
    loading,
    error,
    reload,
  } = usePrograms({ per_page: 200 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected: LearningProgram | undefined = useMemo(
    () => programs.find((p) => p.id === selectedId) ?? programs[0],
    [programs, selectedId],
  );

  // Keep a valid selection when the list changes (e.g. after a delete).
  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  const { items: levels, total: levelsTotal, loading: levelsLoading, error: levelsError, reload: reloadLevels } = useLevels(
    selected ? { programId: selected.id, per_page: 200 } : { per_page: 0 },
  );

  /**
   * Which level's content is being assigned (M3). The id is stored, but the
   * level is *derived* from the current query's rows, so a selection made under
   * another program resolves to nothing here instead of rendering a row that no
   * longer belongs to the selection — and the assignment surface below is
   * rendered only from that derived value.
   */
  const [contentLevelId, setContentLevelId] = useState<string | null>(null);
  const contentLevel = useMemo(
    () => levels.find((level) => level.id === contentLevelId),
    [levels, contentLevelId],
  );

  /**
   * The assignment surface belongs to the selected program, so its level
   * selection is dropped when the program changes instead of being carried
   * over: a level of the previous program is not a valid target under the new
   * one.
   *
   * This is selection semantics, not a stale-read workaround — it suppresses
   * and fabricates nothing, and it is not what makes a crossing impossible.
   * `LevelContentPanel` takes `programId` from the programs query while
   * `levelId` comes from the rendered row, and `attachContent` refuses an intent
   * that does not own the level (I13 Checkpoint 2); that is the invariant. This
   * only stops the surface from naming one program while listing another's
   * level during the frame in which the levels query still holds the previous
   * program's page.
   */
  useEffect(() => {
    setContentLevelId(null);
  }, [selected?.id]);

  const instrumentName = (id: string) =>
    instruments.find((i) => i.id === id)?.name ?? id;

  /** Wraps a repository call with busy state and honest reporting. */
  const run = async (
    action: () => Promise<void>,
    success: { title: string; detail?: string },
  ) => {
    setBusy(true);
    try {
      await action();
      notify({ tone: "success", ...success });
    } catch (cause) {
      notify({
        tone: "danger",
        title: "عملیات انجام نشد",
        detail: apiErrorFromThrown(cause).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const addProgram = async (name: string) => {
    const instrument = instruments.find((i) => i.active) ?? instruments[0];
    if (!instrument) {
      notify({
        tone: "danger",
        title: "ابتدا یک ساز تعریف کنید",
        detail: "هر دوره باید به یک ساز متصل باشد.",
      });
      return;
    }
    await run(
      async () => {
        const created = await getLearningRepository().createProgram({
          instrumentId: instrument.id,
          name,
          description: "",
          active: true,
        });
        setSelectedId(created.id);
      },
      {
        title: `دورهٔ «${name}» ساخته شد`,
        detail: `به ساز ${instrument.name} متصل شد؛ می‌توانید آن را تغییر دهید.`,
      },
    );
  };

  const addLevel = async (name: string) => {
    if (!selected) return;
    await run(
      async () => {
        await getLearningRepository().createLevel({
          programId: selected.id,
          name,
          description: "",
          objectives: [],
          active: true,
        });
      },
      {
        title: `سطح «${name}» افزوده شد`,
        detail: "در انتهای مسیر یادگیری این دوره قرار گرفت.",
      },
    );
  };

  const moveLevel = async (level: LearningLevel, direction: -1 | 1) => {
    await run(
      () =>
        getLearningRepository()
          .reorderLevel(level.id, level.order + direction)
          .then(() => undefined),
      { title: "ترتیب سطح تغییر کرد" },
    );
  };

  const removeLevel = async (level: LearningLevel) => {
    await run(() => getLearningRepository().deleteLevel(level.id), {
      title: `سطح «${level.name}» حذف شد`,
    });
  };

  if (loading || instrumentsLoading)
    return <LoadingState className="py-16" label="در حال بارگذاری دوره‌ها…" />;
  if (error)
    return (
      <ErrorState
        className="py-16"
        title="بارگذاری دوره‌ها ناموفق بود"
        description={error.message}
        onRetry={reload}
      />
    );
  if (instrumentsError)
    return (
      <ErrorState
        className="py-16"
        title="بارگذاری سازها ناموفق بود"
        description={instrumentsError.message}
        onRetry={reloadInstruments}
      />
    );

  return (
    <Panel
      title="دوره‌ها و سطوح"
      kicker="مسیر یادگیری هر ساز و سطوحی که هنرجو طی می‌کند"
    >
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Programs */}
        <div>
          <h3 className="mb-2 text-[11px] font-medium text-ink-400">دوره‌ها</h3>
          {programs.length === 0 ? (
            <EmptyState
              title="هنوز دوره‌ای تعریف نشده"
              description="برای هر ساز یک مسیر یادگیری بسازید."
            />
          ) : (
            <ul className="space-y-1.5">
              {programs.map((program) => (
                <li key={program.id}>
                  <button
                    type="button"
                    aria-current={program.id === selected?.id}
                    onClick={() => setSelectedId(program.id)}
                    className={cn(
                      "w-full rounded-xl border p-2.5 text-right transition-colors",
                      program.id === selected?.id
                        ? "border-gold-500/30 bg-gold-500/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                    )}
                  >
                    <span className="block truncate text-[12.5px] font-medium text-ink-50">
                      {program.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">
                      {instrumentName(program.instrumentId)}
                      {!program.active && " · غیرفعال"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {programsTotal > programs.length && (
            <p className="mt-2 text-[11px] text-ink-400">{partialNote("دوره‌ها", programs.length, programsTotal)}</p>
          )}
          <QuickAdd
            label="دورهٔ جدید"
            placeholder="مثلاً دورهٔ مقدماتی سنتور"
            busy={busy}
            onAdd={addProgram}
          />
        </div>

        {/* Levels of the selected program */}
        <div>
          {selected ? (
            <>
              <div className="mb-2 flex items-center gap-2">
                <GraduationCap className="size-3.5 text-gold-400" aria-hidden />
                <h3 className="text-[11px] font-medium text-ink-400">
                  {/*
                    The count is withheld while the levels read is in flight.
                    `levels` is the *current query's* page (I13), so mid-switch it
                    is legitimately empty — and «۰ سطح» for a program that has
                    twelve is the same false count, in a new shape, as the
                    «۱ سطح» heading that made I11's harness lie.
                  */}
                  سطوح «{selected.name}»{levelsLoading ? "" : ` — ${faNum(levels.length)} سطح`}
                </h3>
              </div>

              {levelsError ? (
                <ErrorState
                  title="بارگذاری سطوح ناموفق بود"
                  description={levelsError.message}
                  onRetry={reloadLevels}
                />
              ) : levelsLoading ? (
                <LoadingState label="در حال بارگذاری سطوح…" />
              ) : levels.length === 0 ? (
                <EmptyState
                  title="این دوره هنوز سطحی ندارد"
                  description="سطوح، ترتیب پیشرفت هنرجو و دسترسی او به منابع را تعیین می‌کنند."
                />
              ) : (
                <ul className="space-y-2">
                  {levels.map((level, index) => (
                    <li key={level.id}>
                      <ListRow
                        active={contentLevelId === level.id}
                        title={`${faNum(level.order)}. ${level.name}`}
                        meta={
                          level.objectives.length > 0
                            ? `${faNum(level.objectives.length)} هدف یادگیری`
                            : level.description || "بدون توضیح"
                        }
                        end={
                          <span className="flex items-center gap-1.5">
                            {level.exclusive && (
                              <StatusBadge
                                tone="violet"
                                label="اختصاصی"
                                glyph={false}
                              />
                            )}
                            <StatusBadge
                              tone={level.active ? "ok" : "neutral"}
                              label={level.active ? "فعال" : "غیرفعال"}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-pressed={contentLevelId === level.id}
                              disabled={busy}
                              onClick={() =>
                                setContentLevelId(
                                  contentLevelId === level.id ? null : level.id,
                                )
                              }
                            >
                              منابع
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`انتقال ${level.name} به بالا`}
                              disabled={busy || index === 0}
                              onClick={() => void moveLevel(level, -1)}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`انتقال ${level.name} به پایین`}
                              disabled={busy || index === levels.length - 1}
                              onClick={() => void moveLevel(level, 1)}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => void removeLevel(level)}
                            >
                              حذف
                            </Button>
                          </span>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
              {selected && levelsTotal > levels.length && (
                <p className="mt-2 text-[11px] text-ink-400">{partialNote("سطوح", levels.length, levelsTotal)}</p>
              )}

              <QuickAdd
                label="سطح جدید"
                placeholder="مثلاً سطح ۳ — آرپژ"
                busy={busy}
                onAdd={addLevel}
              />

              <Surface className="mt-4 border-white/[0.05] p-3.5 text-[11.5px] leading-relaxed text-ink-300">
                هنرجو روی یکی از این سطوح قرار می‌گیرد و به منابع همان سطح و
                سطوح پیش از آن دسترسی پیدا می‌کند. سطحی که هنرجو یا منبع متصل
                داشته باشد حذف نمی‌شود.
              </Surface>
            </>
          ) : (
            <EmptyState
              title="دوره‌ای انتخاب نشده"
              description="از فهرست کنار، یک دوره را انتخاب کنید."
            />
          )}
        </div>
      </div>

      {/*
        M3's assignment surface, rendered OUTSIDE the levels column on purpose:
        the rows it lists are content, not levels, and mixing them into that
        column would make the level list claim rows it does not own.

        `programId` is the program this panel selected — resolved from the
        programs query — while `levelId` comes from the rendered level row. The
        two are independent, which is the only reason `attachContent`'s intent
        check can mean anything (I13 Checkpoint 2).
      */}
      {selected && contentLevel && (
        <LevelContentPanel
          levelId={contentLevel.id}
          levelName={contentLevel.name}
          programId={selected.id}
          programName={selected.name}
        />
      )}
    </Panel>
  );
}
