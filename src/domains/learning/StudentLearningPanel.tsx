/**
 * A student's learning path: where they sit in a program and what that unlocks — F1 genuine.
 *
 * F1 scope:
 * - Student Level N eligible 1..N (via useEligibleContent)
 * - N+1+ locked with honest reason در سطح X باز می‌شود (via useLockedContent)
 * - locked no preview/download — UI enforces disabled buttons, no media
 * - not_visible hidden — eligibility.ts already filters visibility=teachers for students
 * - not_found honest — error states preserved
 * - not_applicable empty state — unplaced student empty message
 * - one content linked to several reachable levels emitted once lowest level — eligibility.ts
 * - sorting levelOrder ASC sortOrder ASC title fa locale — eligibility.ts
 * - canonical owner learning/eligibility.ts
 * - O-01 remains OPEN
 *
 * Previous hardcoded six-step ladder replaced by real levels + placement + derived eligibility.
 * Changing a placement is a real repository write, immediately changes unlocked content because
 * both read same derived source.
 */
import { useMemo, useState } from "react";
import { BookOpen, GraduationCap, Lock } from "lucide-react";
import { faNum } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { Field, Panel, inputCls } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getLearningRepository } from "@/domains/registry";
import { useEligibleContent, useLevels, useLockedContent, usePrograms, useStudentPlacement } from "./useLearning";
import { cn } from "@/utils/cn";

export function StudentLearningPanel({ studentId, studentName }: { studentId: string; studentName: string }) {
  const { notify } = useApp();
  const { data: placement, loading: placementLoading, error: placementError, reload } = useStudentPlacement(studentId);
  const { data: eligible, loading: contentLoading, error: contentError, reload: reloadContent } = useEligibleContent(studentId);
  const { data: locked, loading: lockedLoading, error: lockedError, reload: reloadLocked } = useLockedContent(studentId);
  const { items: programs, loading: programsLoading, error: programsError, reload: reloadPrograms } = usePrograms({ per_page: 200 });
  const [busy, setBusy] = useState(false);

  const programId = placement?.programId;
  const { items: levels, loading: levelsLoading, error: levelsError, reload: reloadLevels } = useLevels(
    programId ? { programId, per_page: 200 } : { per_page: 0 },
  );

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
      <Panel title="مسیر سطح" kicker="سطوح واقعی دورهٔ این هنرجو — F1 N eligible 1..N N+1+ locked">
        {!placement ? (
          <>
            <EmptyState
              title="این هنرجو هنوز روی سطحی قرار نگرفته"
              description="تا زمانی که سطح تعیین نشود، منبعی برای او باز نمی‌شود — not_applicable empty state per F1."
            />
            {programsError ? (
              <ErrorState
                title="بارگذاری دوره‌ها ناموفق بود"
                description={programsError.message}
                onRetry={reloadPrograms}
              />
            ) : programsLoading ? (
              <LoadingState label="در حال بارگذاری دوره‌ها…" />
            ) : (
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
            )}
          </>
        ) : levelsError ? (
          <ErrorState
            title="بارگذاری سطوح ناموفق بود"
            description={levelsError.message}
            onRetry={reloadLevels}
          />
        ) : levelsLoading ? (
          <LoadingState label="در حال بارگذاری سطوح این دوره…" />
        ) : (
          <>
            <ol className="relative space-y-3">
              {levels.map((level) => {
                const current = level.id === placement.levelId;
                const done = currentLevel !== undefined && level.order < currentLevel.order;
                const lockedLevel = currentLevel !== undefined && level.order > currentLevel.order;
                return (
                  <li key={level.id} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold",
                        done
                          ? "border-ok-500/40 bg-ok-500/15 text-ok-400"
                          : current
                            ? "border-gold-500/50 bg-gold-500/15 text-gold-300"
                            : lockedLevel
                              ? "border-warn-500/30 bg-warn-500/[0.06] text-warn-400"
                              : "border-white/[0.08] text-ink-500",
                      )}
                    >
                      {lockedLevel ? <Lock className="size-3" /> : faNum(level.order)}
                    </span>
                    <span
                      className={cn(
                        "flex-1 text-[13px]",
                        current ? "font-medium text-ink-50" : done ? "text-ink-200" : lockedLevel ? "text-ink-400" : "text-ink-500",
                      )}
                    >
                      {level.name} {lockedLevel && <span className="text-[11px] text-warn-400">— {`در سطح ${level.name} باز می‌شود`}</span>}
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
              سطح {currentLevel ? `«${currentLevel.name}»` : "نامشخص"} از {faNum(levels.length)} سطح این دوره — F1 N eligible 1..N
            </p>
          </>
        )}
      </Panel>

      <Panel title="منابع باز شده" kicker="بر اساس سطح فعلی هنرجو محاسبه می‌شود — F1 genuine">
        {contentError ? (
          <ErrorState
            title="بارگذاری منابع باز شده ناموفق بود — not_found honest per F1"
            description={contentError.message}
            onRetry={reloadContent}
          />
        ) : contentLoading ? (
          <LoadingState label="در حال محاسبهٔ منابع…" />
        ) : eligible.length === 0 ? (
          <EmptyState
            title="منبعی برای این هنرجو باز نشده"
            description={
              placement
                ? "به سطوح این دوره هنوز منبعی متصل نشده است — not_applicable per F1."
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
                    سطح {faNum(entry.levelOrder)} · {entry.levelName} — sortOrder {faNum(entry.sortOrder)} — عنوان مرتب‌سازی fa locale
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 border-t border-white/[0.05] pt-3 text-[11px] leading-relaxed text-ink-400">
          {faNum(eligible.length)} منبع در دسترس — F1 sorting levelOrder ASC sortOrder ASC title fa locale — canonical owner eligibility.ts — one content linked to several reachable levels emitted once lowest level.
        </p>

        {/* Locked N+1+ with honest reason */}
        {lockedError ? (
          <ErrorState
            className="mt-4"
            title="بارگذاری منابع قفل ناموفق بود"
            description={lockedError.message}
            onRetry={reloadLocked}
          />
        ) : lockedLoading ? (
          <LoadingState className="mt-4" label="در حال محاسبهٔ منابع قفل…" />
        ) : locked.length > 0 ? (
          <div className="mt-4">
            <h4 className="mb-2 text-[11px] font-medium text-ink-400">منابع قفل — N+1+ با دلیل صادقانه</h4>
            <ul className="space-y-2">
              {locked.map((entry) => (
                <li
                  key={entry.content.id}
                  className="flex items-start gap-2.5 rounded-xl border border-warn-500/20 bg-warn-500/[0.05] p-3 opacity-80"
                >
                  <Lock className="mt-0.5 size-3.5 shrink-0 text-warn-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-ink-300">{entry.content.title}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] text-warn-400">{entry.reason}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-500">بدون پیش‌نمایش و دانلود — locked no preview/download per F1</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-500">{faNum(locked.length)} منبع قفل — در سطح بالاتر باز می‌شود — not_visible hidden already applied</p>
          </div>
        ) : placement ? (
          <p className="mt-4 text-[11px] text-ink-500">منبع قفلی نیست — تمام سطوح بالاتر محتوایی ندارند یا already eligible</p>
        ) : null}
      </Panel>
    </div>
  );
}

/**
 * Level options for one program, rendered as an option group so a single
 * select can assign both program and level in one step.
 */
function ProgramLevelOptions({ programId, programName }: { programId: string; programName: string }) {
  const { items: levels, loading, error } = useLevels({ programId, per_page: 200 });
  // Failure is not an empty program: omit the group rather than claiming «۰ سطح».
  if (loading || error) return null;
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
