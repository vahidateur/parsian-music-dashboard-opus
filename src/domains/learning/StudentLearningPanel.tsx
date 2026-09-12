/**
 * A student's learning path: where they sit in a program and what that unlocks.
 *
 * This replaces the previous hardcoded six-step ladder driven by a fixture
 * field. The ladder is now the program's real levels, the current step is the
 * student's stored placement, and the content list is derived by
 * `eligibility.ts` rather than being a curated fixture.
 *
 * Changing a placement is a real repository write, and it immediately changes
 * the unlocked content because both read the same derived source.
 */
import { useMemo, useState } from "react";
import { BookOpen, GraduationCap } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getLearningRepository } from "@/domains/registry";
import { useEligibleContent, useLevels, usePrograms, useStudentPlacement } from "./useLearning";
import { cn } from "@/utils/cn";

export function StudentLearningPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { notify } = useApp();
  const { data: placement, loading: placementLoading, error: placementError, reload } = useStudentPlacement(studentId);
  const { data: eligible, loading: contentLoading } = useEligibleContent(studentId);
  const { items: programs } = usePrograms({ per_page: 200 });
  const [busy, setBusy] = useState(false);

  const programId = placement?.programId;
  const { items: levels } = useLevels(programId ? { programId, per_page: 200 } : { per_page: 0 });

  const currentLevel = useMemo(
    () => levels.find((level) => level.id === placement?.levelId),
    [levels, placement],
  );

  const assign = async (nextProgramId: string, nextLevelId: string) => {
    setBusy(true);
    try {
      await getLearningRepository().assignPlacement({
        studentId,
        programId: nextProgramId,
        levelId: nextLevelId,
      });
      notify({
        tone: "success",
        title: "سطح هنرجو به‌روزرسانی شد",
        detail: `دسترسی ${studentName} به منابع بر اساس سطح جدید بازمحاسبه شد.`,
      });
    } catch (cause) {
      notify({ tone: "danger", title: "ثبت سطح انجام نشد", detail: apiErrorFromThrown(cause).message });
    } finally {
      setBusy(false);
    }
  };

  if (placementLoading) return <LoadingState className="py-16" label="در حال بارگذاری مسیر یادگیری…" />;
  if (placementError)
    return (
      <ErrorState
        className="py-16"
        title="بارگذاری مسیر یادگیری ناموفق بود"
        description={placementError.message}
        onRetry={reload}
      />
    );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="مسیر سطح" kicker="سطوح واقعی دورهٔ این هنرجو">
        {!placement ? (
          <>
            <EmptyState
              title="این هنرجو هنوز روی سطحی قرار نگرفته"
              description="تا زمانی که سطح تعیین نشود، منبعی برای او باز نمی‌شود."
            />
            <Field label="تعیین دوره و سطح" className="mt-3">
              {(control) => (
                <select
                  {...control}
                  className={inputCls}
                  defaultValue=""
                  disabled={busy || programs.length === 0}
                  onChange={(e) => {
                    const [nextProgram, nextLevel] = e.target.value.split("|");
                    if (nextProgram && nextLevel) void assign(nextProgram, nextLevel);
                  }}
                >
                  <option value="">— انتخاب کنید —</option>
                  {programs.map((program) => (
                    <ProgramLevelOptions key={program.id} programId={program.id} programName={program.name} />
                  ))}
                </select>
              )}
            </Field>
          </>
        ) : (
          <>
            <ol className="relative space-y-3">
              {levels.map((level) => {
                const current = level.id === placement.levelId;
                const done = currentLevel !== undefined && level.order < currentLevel.order;
                return (
                  <li key={level.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                        done
                          ? "border-ok-500/40 bg-ok-500/15 text-ok-400"
                          : current
                            ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                            : "border-white/[0.08] text-ink-500",
                      )}
                    >
                      {faNum(level.order)}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[13px]",
                        current ? "font-medium text-ink-50" : done ? "text-ink-200" : "text-ink-500",
                      )}
                    >
                      {level.name}
                    </span>
                    {current && <StatusBadge tone="gold" label="سطح فعلی" glyph={false} />}
                    {!current && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void assign(placement.programId, level.id)}
                      >
                        انتقال به این سطح
                      </Button>
                    )}
                  </li>
                );
              })}
            </ol>
            <p className="mt-4 flex items-center gap-1.5 border-t border-white/[0.05] pt-3 text-[11.5px] text-ink-300">
              <GraduationCap className="size-3.5 text-gold-400" aria-hidden />
              سطح {currentLevel ? `«${currentLevel.name}»` : "نامشخص"} از {faNum(levels.length)} سطح این دوره
            </p>
          </>
        )}
      </Panel>

      <Panel title="منابع باز شده" kicker="بر اساس سطح فعلی هنرجو محاسبه می‌شود">
        {contentLoading ? (
          <LoadingState label="در حال محاسبهٔ منابع…" />
        ) : eligible.length === 0 ? (
          <EmptyState
            title="منبعی برای این هنرجو باز نشده"
            description={
              placement
                ? "به سطوح این دوره هنوز منبعی متصل نشده است."
                : "پس از تعیین سطح، منابع مربوط به آن به‌صورت خودکار باز می‌شوند."
            }
          />
        ) : (
          <ul className="space-y-2">
            {eligible.map((entry) => (
              <li
                key={entry.content.id}
                className="flex items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <BookOpen className="mt-0.5 size-3.5 shrink-0 text-violet-300" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-ink-50">{entry.content.title}</span>
                  <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">
                    سطح {faNum(entry.levelOrder)} · {entry.levelName}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-ink-400">
          {faNum(eligible.length)} منبع در دسترس. منابع سطوح پیشین نیز باز می‌مانند، مگر سطحی که «اختصاصی» علامت خورده
          باشد.
        </p>
      </Panel>
    </div>
  );
}

/**
 * Level options for one program, rendered as an option group so a single
 * select can assign both program and level in one step.
 */
function ProgramLevelOptions({ programId, programName }: { programId: string; programName: string }) {
  const { items: levels } = useLevels({ programId, per_page: 200 });
  if (levels.length === 0) return null;
  return (
    <optgroup label={programName}>
      {levels.map((level) => (
        <option key={level.id} value={`${programId}|${level.id}`}>
          {`${programName} — ${level.name}`}
        </option>
      ))}
    </optgroup>
  );
}
