import { BookOpen, Library, Music } from "lucide-react";
import { Button, SectionHeader, StatusBadge, Surface } from "@/components/ds/primitives";
import { EmptyState, LoadingState } from "@/components/ds/states";
import { Chip } from "@/components/ds/patterns";
import type { DeskStudent, LessonFocus } from "@/domains/shared/teacherDesk";
import type { LearningContent, LearningContentType } from "@/domains/learning/types";
import { resourceKindLabel, type LibraryItem } from "@/domains/library/types";
import { faNum } from "@/lib/format";
import { cn } from "@/utils/cn";

const CONTENT_TYPE_LABEL: Record<LearningContentType, string> = {
  pdf: "نت PDF",
  image: "تصویر",
  audio: "صوت",
  voice: "روایت صوتی",
  video: "ویدیو",
  document: "جزوه",
};

/**
 * What each of the teacher's classes is meant to teach.
 *
 * The rung comes from the class's own `levelId` — the one link the academy
 * actually stores — and the objectives/notes are the level's stored fields. A
 * class that is not tied to a rung says so instead of having one guessed from
 * its title: a curriculum nobody chose must not appear on a desk.
 */
export function LessonFocusPanel({
  lessons,
  selectedClassId,
  onSelectClass,
  hasSessionToday,
  className,
}: {
  lessons: LessonFocus[];
  selectedClassId: string | null;
  onSelectClass: (classId: string) => void;
  /** Classes that still have a session on today's calendar, for the quiet mark. */
  hasSessionToday: ReadonlySet<string>;
  className?: string;
}) {
  const selected = lessons.find((row) => row.classId === selectedClassId) ?? lessons[0] ?? null;
  const bound = lessons.filter((row) => row.levelId !== null).length;

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader
        title="تمرکز درس"
        kicker={
          lessons.length === 0
            ? "کلاسی به شما سپرده نشده"
            : `${faNum(bound)} از ${faNum(lessons.length)} کلاس به سطح برنامهٔ درسی بسته است`
        }
      />

      {lessons.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="کلاسی برای تمرکز درس نیست"
          description="کلاس‌ها از راه پروندهٔ استاد و ثبت‌نام‌ها به شما نسبت داده می‌شوند."
        />
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {lessons.map((row) => (
              <Chip
                key={row.classId}
                label={hasSessionToday.has(row.classId) ? `${row.className} · امروز` : row.className}
                active={selected?.classId === row.classId}
                onClick={() => onSelectClass(row.classId)}
              />
            ))}
          </div>

          {selected && (
            <div className="mt-5 min-h-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-50">{selected.className}</span>
                {selected.levelId === null ? (
                  <StatusBadge tone="neutral" label="بدون سطح ثبت‌شده" />
                ) : (
                  <StatusBadge
                    tone="gold"
                    label={
                      selected.levelName
                        ? `سطح ${faNum(selected.levelOrder ?? 0)} · ${selected.levelName}`
                        : "سطح ثبت‌شده"
                    }
                  />
                )}
              </div>

              {selected.levelId === null ? (
                <p className="mt-3 text-xs leading-relaxed text-ink-400">
                  برای این کلاس سطحی از برنامهٔ درسی ثبت نشده است؛ سرفصل از عنوان کلاس حدس زده نمی‌شود. سطح در «کلاس‌ها» تعیین
                  می‌شود.
                </p>
              ) : (
                <>
                  <p className="mt-4 text-[11px] tracking-wide text-ink-400">هدف‌های آموزشی این سطح</p>
                  {selected.objectives.length > 0 ? (
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {selected.objectives.map((objective) => (
                        <li key={objective} className="flex items-start gap-2 text-xs leading-relaxed text-ink-200">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold-500/70" aria-hidden />
                          {objective}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-ink-400">برای این سطح هدف آموزشی ثبت نشده است.</p>
                  )}
                  {selected.levelNotes && (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[11px] text-ink-400">یادداشت سطح</p>
                      <p className="mt-1 text-xs leading-relaxed text-ink-200">{selected.levelNotes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </Surface>
  );
}

interface RepertoireRow {
  title: string;
  students: { id: string; name: string; progressLabel: string }[];
  overdue: number;
}

/** Pieces across the teacher's own students, grouped by the piece itself. */
function groupRepertoire(students: DeskStudent[]): RepertoireRow[] {
  const byPiece = new Map<string, RepertoireRow>();
  for (const student of students) {
    for (const piece of student.pieces) {
      const row = byPiece.get(piece.pieceTitle) ?? { title: piece.pieceTitle, students: [], overdue: 0 };
      row.students.push({ id: student.id, name: student.name, progressLabel: piece.progressLabel });
      if (piece.overdue) row.overdue += 1;
      byPiece.set(piece.pieceTitle, row);
    }
  }
  return [...byPiece.values()].sort((a, b) => b.students.length - a.students.length || a.title.localeCompare(b.title, "fa"));
}

/**
 * The studio's working repertoire: which pieces are in play, and who is playing
 * them. It is a projection of the assignments and their progress records — the
 * piece rows the academy already stores — not a new repertoire entity.
 */
export function RepertoireBoard({
  students,
  onOpenStudent,
  className,
}: {
  students: DeskStudent[];
  onOpenStudent: (studentId: string) => void;
  className?: string;
}) {
  const rows = groupRepertoire(students);
  const totalPieces = students.reduce((sum, row) => sum + row.pieces.length, 0);

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader
        title="رپرتوار"
        kicker={
          rows.length === 0
            ? "قطعه‌ای در جریان نیست"
            : `${faNum(rows.length)} قطعه · ${faNum(totalPieces)} تکلیف فعال`
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="قطعه‌ای روی میز نیست"
          description="قطعه‌ها از راه تکلیف‌های هنرجویان شما وارد این تخته می‌شوند."
        />
      ) : (
        <ul className="mt-2 flex max-h-[26rem] flex-col divide-y divide-white/[0.05] overflow-y-auto">
          {rows.map((row) => (
            <li key={row.title} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Music className="size-4 shrink-0 text-gold-400" strokeWidth={1.9} />
                  <span className="truncate text-sm font-medium text-ink-50">{row.title}</span>
                </span>
                <span className="flex items-center gap-2">
                  {row.overdue > 0 && <StatusBadge tone="warn" label={`${faNum(row.overdue)} تاریخ هدف گذشته`} />}
                  <span className="text-[11px] text-ink-400">{faNum(row.students.length)} هنرجو</span>
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {row.students.map((student) => (
                  <button
                    key={`${row.title}-${student.id}`}
                    type="button"
                    onClick={() => onOpenStudent(student.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.02] px-2 py-0.5 text-[10.5px] leading-5 text-ink-300 transition-colors hover:border-gold-500/35 hover:text-gold-200"
                  >
                    {student.name}
                    <span className="text-ink-500">·</span>
                    {student.progressLabel}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/**
 * The material the focused class's rung points at, matched against the library
 * rows that carry its file.
 *
 * Read-only by design: the shelf opens what the academy already stores and never
 * uploads, rewrites or re-files anything. A content row whose media id has no
 * library row says exactly that rather than pretending a file exists.
 */
export function ResourceShelf({
  levelName,
  content,
  loading,
  error,
  complete,
  libraryRows,
  libraryTotal,
  onOpenLibrary,
  className,
}: {
  levelName: string | null;
  content: LearningContent[];
  loading: boolean;
  error: boolean;
  complete: boolean;
  libraryRows: LibraryItem[];
  libraryTotal: number;
  onOpenLibrary: () => void;
  className?: string;
}) {
  const byMediaId = new Map(libraryRows.filter((row) => row.mediaId).map((row) => [row.mediaId as string, row]));

  return (
    <Surface className={cn("flex h-full flex-col p-5", className)}>
      <SectionHeader
        title="قفسهٔ منابع"
        kicker={
          levelName
            ? loading
              ? `در حال خواندن منابع «${levelName}»…`
              : `${faNum(content.length)} منبع برای سطح ${levelName}`
            : "هنوز سطحی برای این قفسه انتخاب نشده"
        }
        action="کتابخانه"
        onAction={onOpenLibrary}
      />
      {!levelName ? (
        <EmptyState
          className="mt-2"
          title="منابع سطح نمایش داده نمی‌شود"
          description="کلاس انتخاب‌شده به سطحی از برنامهٔ درسی بسته نیست، و منابع بدون سطح فهرست نمی‌شوند."
        />
      ) : loading ? (
        <LoadingState label="در حال خواندن منابع…" />
      ) : error ? (
        <EmptyState
          className="mt-2"
          title="منابع این سطح خوانده نشد"
          description="خواندن پیوندهای سطح کامل نشد؛ فهرست ناقص را به‌جای کل منابع نشان نمی‌دهیم."
        />
      ) : content.length === 0 ? (
        <EmptyState
          className="mt-2"
          title="منبعی به این سطح پیوند نشده"
          description="پیوند محتوا به سطح در «کتابخانه» و برنامهٔ درسی ثبت می‌شود."
        />
      ) : (
        <ul className="mt-2 flex max-h-[22rem] flex-col divide-y divide-white/[0.05] overflow-y-auto">
          {content.map((item) => {
            const libraryRow = item.mediaId ? byMediaId.get(item.mediaId) : undefined;
            return (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.02] text-gold-300">
                  <BookOpen className="size-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-50">{item.title}</p>
                  <p className="mt-0.5 text-xs text-ink-300">
                    {CONTENT_TYPE_LABEL[item.type]}
                    {item.author ? ` · ${item.author}` : ""}
                    {item.visibility === "teachers" ? " · ویژهٔ استادان" : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-ink-400">
                    {libraryRow
                      ? `در کتابخانه: ${libraryRow.title} (${resourceKindLabel[libraryRow.kind]}${libraryRow.size ? ` · ${libraryRow.size}` : ""})`
                      : item.mediaId
                        ? "فرادادهٔ رسانه ثبت شده؛ ردیف کتابخانه در صفحهٔ خوانده‌شده نیست"
                        : "بدون فایل — فقط فراداده"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {levelName && !loading && !error && libraryTotal > libraryRows.length && (
        <p className="mt-3 flex items-center gap-2 text-[11px] text-ink-400">
          <Library className="size-3.5" strokeWidth={1.8} />
          قفسه از {faNum(libraryRows.length)} ردیف کتابخانهٔ خوانده‌شده ساخته شده است.
        </p>
      )}
      {levelName && !loading && !error && content.length > 0 && !complete && (
        <p className="mt-2 text-[11px] text-ink-400">
          پیوندهای این سطح کامل خوانده نشد؛ فقط ردیف‌های خوانده‌شده نمایش داده می‌شوند.
        </p>
      )}
      {levelName && !loading && !error && content.length > 0 && complete && (
        <div className="mt-auto pt-4">
          <Button variant="subtle" size="sm" onClick={onOpenLibrary}>
            گشودن کتابخانه
          </Button>
          <span className="ms-3 text-[11px] text-ink-400">فقط خواندنی — بارگذاری از این قفسه انجام نمی‌شود</span>
        </div>
      )}
    </Surface>
  );
}
