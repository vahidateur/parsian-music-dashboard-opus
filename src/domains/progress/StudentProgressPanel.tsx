/**
 * Student progress: active pieces, insights, recommendations and the timeline.
 *
 * Serves both the teacher and student workflows from one component, switched
 * by `role`. The difference is deliberately about *capability*, not layout —
 * a student sees the same evidence about their own playing, but records
 * practice rather than assessments, and does not see teacher-only notes.
 *
 * SECURITY: `role` is a UX affordance only. Hiding a control is not access
 * control; the server must enforce who may write what (§31).
 */
import { useMemo, useState } from "react";
import { Activity, ArrowLeft, BookOpen, MessageSquare, Music4, Plus, TrendingUp } from "lucide-react";
import { faNum, toFa } from "@/lib/format";
import { useApp } from "@/context/AppContext";
import { Button, StatusBadge, Surface, type Tone } from "@/components/ds/primitives";
import { EmptyState, ErrorState, LoadingState } from "@/components/ds/states";
import { ListRow, Meter, Panel } from "@/components/ds/patterns";
import { apiErrorFromThrown } from "@/api/errors";
import { getProgressRepository } from "@/domains/registry";
import { instrumentName } from "@/domains/instruments/catalog";
import { PROGRESS_STATUS_LABEL, analyzePiece, describeRange, type ProgressStatus } from "./analytics";
import { RECOMMENDATION_LABEL, type Recommendation } from "./recommendations";
import { RecordProgressDialog } from "./RecordProgressDialog";
import { AssignPieceDialog } from "./AssignPieceDialog";
import { useProgressEvents, useStudentProgress } from "./useProgress";
import {
  ACTIVE_ASSIGNMENT_STATUSES,
  ASSIGNMENT_STATUS_LABEL,
  PROGRESS_SOURCE_LABEL,
  type PieceAssignment,
  type Piece,
} from "./types";
import { cn } from "@/utils/cn";

/** Colour per trend. `possible_plateau` is amber, not red: it is a hint. */
const STATUS_TONE: Record<ProgressStatus, Tone> = {
  improving: "ok",
  stable: "neutral",
  slowing: "warn",
  possible_plateau: "warn",
  regression: "danger",
  insufficient_data: "neutral",
};

const PRIORITY_TONE: Record<Recommendation["priority"], Tone> = {
  attention: "warn",
  suggested: "info",
  info: "neutral",
};

/** Short Persian date-time for a timeline row. */
function stamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("fa-IR", { month: "short", day: "numeric" }).format(date);
}

export function StudentProgressPanel({
  studentId,
  studentName,
  role,
}: {
  studentId: string;
  studentName: string;
  /** `teacher` may assign pieces and record assessments. */
  role: "teacher" | "student";
}) {
  const { notify, navigate } = useApp();
  const { overview, loading, error, reload } = useStudentProgress(studentId);
  const [recording, setRecording] = useState<{ assignment: PieceAssignment; piece?: Piece } | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  // The timeline is a bounded, paginated read — never the whole log.
  const { items: timeline } = useProgressEvents({ studentId, per_page: 15 });

  const insightByAssignment = useMemo(
    () => new Map((overview?.insights ?? []).map((i) => [i.assignmentId, i])),
    [overview],
  );

  const active = (overview?.assignments ?? []).filter((a) =>
    ACTIVE_ASSIGNMENT_STATUSES.includes(a.assignment.status),
  );
  const closed = (overview?.assignments ?? []).filter(
    (a) => !ACTIVE_ASSIGNMENT_STATUSES.includes(a.assignment.status),
  );

  if (loading) return <LoadingState className="py-20" label="در حال بارگذاری پیشرفت…" />;
  if (error)
    return (
      <ErrorState className="py-20" title="بارگذاری پیشرفت ناموفق بود" description={error.message} onRetry={reload} />
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Active pieces */}
        <Panel
          className="lg:col-span-2"
          title="قطعات در دست کار"
          kicker="آنچه هنرجو هم‌اکنون تمرین می‌کند"
          action={role === "teacher" ? "افزودن قطعه" : undefined}
          onAction={role === "teacher" ? () => setAssignOpen(true) : undefined}
        >
          {active.length === 0 ? (
            <EmptyState
              title="قطعه‌ای در دست کار نیست"
              description={
                role === "teacher"
                  ? "یک قطعه از رپرتوار به این هنرجو تخصیص دهید."
                  : "هنوز قطعه‌ای برای شما تعیین نشده است."
              }
              action={role === "teacher" ? "افزودن قطعه" : undefined}
              onAction={role === "teacher" ? () => setAssignOpen(true) : undefined}
            />
          ) : (
            <ul className="space-y-3">
              {active.map(({ assignment, piece }) => {
                const insight = insightByAssignment.get(assignment.id);
                const latest = assignment.latest;
                const range = latest ? describeRange({ ...latest, id: "", studentId: "", pieceId: "", assignmentId: "", source: "teacher" }) : null;

                return (
                  <li
                    key={assignment.id}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex flex-wrap items-start gap-2">
                      <Music4 className="mt-0.5 size-4 shrink-0 text-gold-400" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium text-ink-50">
                          {piece?.title ?? "قطعهٔ حذف‌شده"}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-ink-400">
                          {piece?.composer}
                          {piece ? ` · ${instrumentName(piece.instrumentId)}` : ""}
                        </div>
                      </div>
                      <StatusBadge
                        tone="neutral"
                        glyph={false}
                        label={ASSIGNMENT_STATUS_LABEL[assignment.status]}
                      />
                      {insight && (
                        <StatusBadge
                          tone={STATUS_TONE[insight.status]}
                          glyph={false}
                          label={PROGRESS_STATUS_LABEL[insight.status]}
                        />
                      )}
                    </div>

                    {latest ? (
                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        <Stat label="تسلط" value={`${faNum(latest.mastery)}٪`} />
                        <Stat label="محدوده" value={range ? toFa(range) : "—"} />
                        <Stat
                          label="سرعت"
                          value={latest.tempoBpm ? `${faNum(latest.tempoBpm)} BPM` : "—"}
                        />
                        <Stat
                          label="هدف"
                          value={latest.targetTempoBpm ? `${faNum(latest.targetTempoBpm)} BPM` : "—"}
                        />
                      </div>
                    ) : (
                      <p className="mt-3 text-[11.5px] text-ink-400">هنوز پیشرفتی برای این قطعه ثبت نشده است.</p>
                    )}

                    {latest && <Meter className="mt-3" value={latest.mastery} tone="violet" />}

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="subtle" onClick={() => setRecording({ assignment, piece })}>
                        <Plus className="size-3.5" /> ثبت پیشرفت
                      </Button>
                      {role === "teacher" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void closeAssignment(assignment, "completed")}
                          >
                            تکمیل شد
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate({ view: "messages" })}
                            title="گفتگوی موجود با هنرجو را باز می‌کند"
                          >
                            <MessageSquare className="size-3.5" /> پیگیری با هنرجو
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {closed.length > 0 && (
            <details className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <summary className="cursor-pointer text-[12px] text-ink-300">
                {faNum(closed.length)} قطعهٔ بسته‌شده
              </summary>
              <ul className="mt-2 space-y-1.5">
                {closed.map(({ assignment, piece }) => (
                  <li key={assignment.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-ink-200">{piece?.title ?? "—"}</span>
                    <span className="shrink-0 text-ink-500">{ASSIGNMENT_STATUS_LABEL[assignment.status]}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Panel>

        {/* Recommendations */}
        <Panel title="پیشنهادهای سامانه" kicker="بر پایهٔ داده‌های ثبت‌شده، نه حدس">
          {(overview?.recommendations.length ?? 0) === 0 ? (
            <EmptyState
              title="پیشنهادی وجود ندارد"
              description="روند فعلی نیازی به مداخله نشان نمی‌دهد."
            />
          ) : (
            <ul className="space-y-2.5">
              {overview!.recommendations.slice(0, 6).map((rec, index) => (
                <li
                  key={`${rec.assignmentId}-${rec.kind}-${index}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <div className="flex items-center gap-1.5">
                    <StatusBadge tone={PRIORITY_TONE[rec.priority]} glyph={false} label={RECOMMENDATION_LABEL[rec.kind]} />
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-200">{rec.reason}</p>
                  {rec.suggestedContentIds.length > 0 && (
                    <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-violet-300">
                      <BookOpen className="size-3" aria-hidden />
                      {faNum(rec.suggestedContentIds.length)} منبع مرتبط در دسترس هنرجو
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-white/[0.05] pt-2.5 text-[10.5px] leading-relaxed text-ink-400">
            این پیشنهادها با قواعد مشخص و از روی داده‌های ثبت‌شده تولید می‌شوند و جای قضاوت مدرس را نمی‌گیرند.
          </p>
        </Panel>
      </div>

      {/* Timeline */}
      <Panel title="سابقهٔ پیشرفت" kicker="رویدادها به ترتیب زمان، بدون بازنویسی">
        {timeline.length === 0 ? (
          <EmptyState title="سابقه‌ای ثبت نشده" description="پس از نخستین ثبت پیشرفت، تاریخچه اینجا دیده می‌شود." />
        ) : (
          <ul className="space-y-2">
            {timeline.map((event) => {
              const piece = overview?.assignments.find((a) => a.assignment.id === event.assignmentId)?.piece;
              const range = describeRange(event);
              const note = role === "teacher" ? event.teacherNote ?? event.studentNote : event.studentNote;
              return (
                <li key={event.id}>
                  <ListRow
                    lead={<Activity className="size-3.5 text-violet-300" />}
                    title={
                      <span className="text-[12.5px]">
                        {piece?.title ?? "—"}
                        <span className="mr-2 text-ink-400">
                          {range ? `· ${toFa(range)}` : ""} · تسلط {faNum(event.mastery)}٪
                          {event.tempoBpm ? ` · ${faNum(event.tempoBpm)} BPM` : ""}
                        </span>
                      </span>
                    }
                    meta={
                      <span className="text-[10.5px]">
                        {stamp(event.recordedAt)} · {PROGRESS_SOURCE_LABEL[event.source]}
                        {note ? ` · ${note}` : ""}
                      </span>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {recording && (
        <RecordProgressDialog
          open
          assignment={recording.assignment}
          piece={recording.piece}
          source={role === "teacher" ? "teacher" : "student"}
          onClose={() => setRecording(null)}
          onRecorded={() =>
            notify({ tone: "success", title: "پیشرفت ثبت شد", detail: "به سابقهٔ هنرجو اضافه شد." })
          }
        />
      )}

      {assignOpen && (
        <AssignPieceDialog
          open
          studentId={studentId}
          studentName={studentName}
          onClose={() => setAssignOpen(false)}
          onAssigned={(piece) =>
            notify({ tone: "success", title: `«${piece.title}» تخصیص یافت`, detail: "در فهرست قطعات فعال قرار گرفت." })
          }
        />
      )}
    </div>
  );

  async function closeAssignment(assignment: PieceAssignment, status: "completed") {
    try {
      await getProgressRepository().updateAssignment(assignment.id, { status });
      notify({ tone: "success", title: "قطعه تکمیل شد", detail: "سابقهٔ پیشرفت آن حفظ می‌شود." });
    } catch (cause) {
      notify({ tone: "danger", title: "تغییر وضعیت انجام نشد", detail: apiErrorFromThrown(cause).message });
    }
  }
}

/** One compact metric cell. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <div className="text-[10px] text-ink-400">{label}</div>
      <div className={cn("nums mt-0.5 truncate text-[12.5px] text-ink-50")}>{value}</div>
    </div>
  );
}

/**
 * Compact analytics strip. Exported for the teacher view, which shows it
 * above the fold; the numbers come straight from `analyzePiece`.
 */
export function PieceAnalyticsStrip({ events }: { events: Parameters<typeof analyzePiece>[0] }) {
  const stats = analyzePiece(events);
  if (stats.events === 0) return null;
  return (
    <Surface className="flex flex-wrap gap-4 p-3 text-[11.5px]">
      <span className="flex items-center gap-1.5 text-ink-300">
        <TrendingUp className="size-3.5 text-ok-400" aria-hidden />
        سرعت یادگیری: {stats.masteryPerWeek === null ? "—" : `${faNum(stats.masteryPerWeek)} واحد در هفته`}
      </span>
      <span className="text-ink-300">
        جلسات: {faNum(stats.distinctPracticeDays)} روز
      </span>
      <span className="text-ink-300">
        <ArrowLeft className="ml-1 inline size-3" aria-hidden />
        تغییر تسلط: {stats.masteryChange === null ? "—" : faNum(stats.masteryChange)}
      </span>
    </Surface>
  );
}
