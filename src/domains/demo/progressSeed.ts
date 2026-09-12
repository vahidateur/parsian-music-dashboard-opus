/**
 * Seed builders for repertoire and student progress.
 *
 * Deterministic: the same `SEED_VERSION` always yields byte-identical rows, so
 * backups, exports and tests stay stable. All randomness is a pure function of
 * the row index.
 *
 * The seeded histories are shaped to exercise the analytics rather than to
 * look pretty. Specifically, the dataset deliberately contains at least one of
 * each: a clear plateau, a regression, rapid improvement, and an assignment
 * with too little data to classify. A demo where every student is quietly
 * improving would make the insight panel look broken.
 */
import { students } from "@/data/records";
import { SEEDED_INSTRUMENTS } from "@/domains/instruments/catalog";
import type { Piece, PieceAssignment, ProgressEvent, ProgressSource } from "@/domains/progress/types";

/** Fixed clock for seeded timestamps. */
const SEED_TIME = "2026-09-01T00:00:00.000Z";
const SEED_MS = Date.parse(SEED_TIME);
const DAY = 86_400_000;

/** ISO timestamp `daysAgo` before the seed instant. */
function daysBefore(daysAgo: number): string {
  return new Date(SEED_MS - daysAgo * DAY).toISOString();
}

/* ------------------------------------------------------------------ */
/* Repertoire                                                          */
/* ------------------------------------------------------------------ */

interface PieceSeed {
  slug: string;
  title: string;
  composer: string;
  instrumentId: string;
  level: number;
  rangeUnit: Piece["rangeUnit"];
  totalRange?: number;
  description: string;
}

/**
 * A small, real repertoire. Every instrument gets works at several levels so
 * the "recommended level" filter has something to do, and the range units vary
 * to prove the model is not measure-only.
 */
const PIECE_SEEDS: PieceSeed[] = [
  // Piano
  { slug: "canon_d", title: "کانن در ر ماژور", composer: "یوهان پاخلبل", instrumentId: "piano", level: 3, rangeUnit: "measure", totalRange: 56, description: "قطعهٔ کلاسیک با بافت تکرارشونده؛ مناسب تمرین یکنواختی ضرب." },
  { slug: "fur_elise", title: "برای الیزه", composer: "لودویگ فان بتهوون", instrumentId: "piano", level: 5, rangeUnit: "measure", totalRange: 103, description: "روندو با بخش میانی دشوار؛ تمرین استقلال انگشتان." },
  { slug: "gymnopedie", title: "ژیمنوپدی شمارهٔ ۱", composer: "اریک ساتی", instrumentId: "piano", level: 2, rangeUnit: "measure", totalRange: 39, description: "تمپوی آرام؛ تمرکز بر پدال و رنگ صدا." },
  { slug: "minuet_g", title: "منوئه در سل ماژور", composer: "یوهان سباستین باخ", instrumentId: "piano", level: 1, rangeUnit: "measure", totalRange: 32, description: "قطعهٔ پایه برای آشنایی با فرم رقص باروک." },
  // Violin
  { slug: "twinkle_var", title: "واریاسیون‌های ستارهٔ کوچک", composer: "سوزوکی", instrumentId: "violin", level: 1, rangeUnit: "measure", totalRange: 24, description: "نخستین قطعهٔ روش سوزوکی؛ تمرین آرشه‌کشی." },
  { slug: "meditation", title: "مدیتیشن از تائیس", composer: "ژول ماسنه", instrumentId: "violin", level: 8, rangeUnit: "measure", totalRange: 120, description: "قطعهٔ لیریک با کشش‌های بلند آرشه." },
  { slug: "spring_vivaldi", title: "بهار — چهار فصل", composer: "آنتونیو ویوالدی", instrumentId: "violin", level: 6, rangeUnit: "section", totalRange: 3, description: "کنسرتو باروک؛ پیشرفت بر اساس موومان." },
  { slug: "etude_kayser", title: "اتود کایزر شمارهٔ ۵", composer: "هاینریش کایزر", instrumentId: "violin", level: 4, rangeUnit: "measure", totalRange: 48, description: "اتود تکنیکی برای تعویض پوزیسیون." },
  // Guitar
  { slug: "romance", title: "رمانس گمنام", composer: "ناشناس", instrumentId: "guitar", level: 4, rangeUnit: "measure", totalRange: 60, description: "آرپژ پیوسته در دست راست." },
  { slug: "asturias", title: "آستوریاس", composer: "ایزاک آلبنیس", instrumentId: "guitar", level: 9, rangeUnit: "section", totalRange: 3, description: "قطعهٔ اسپانیایی با تکنیک ترمولو و راسگوئادو." },
  { slug: "malaguena", title: "مالاگنیا", composer: "سنتی", instrumentId: "guitar", level: 6, rangeUnit: "measure", totalRange: 72, description: "قطعهٔ فلامنکو با ریتم مشخص." },
  // Voice
  { slug: "vocalise_1", title: "وکالیز شمارهٔ ۱", composer: "کنکونه", instrumentId: "voice", level: 2, rangeUnit: "page", totalRange: 4, description: "تمرین آواز بدون کلام؛ کنترل نفس." },
  { slug: "ave_maria", title: "آوه ماریا", composer: "فرانتس شوبرت", instrumentId: "voice", level: 7, rangeUnit: "measure", totalRange: 68, description: "کنترل خط لگاتو در محدودهٔ میانی." },
  // Drums
  { slug: "rudiments", title: "روديمنت‌های پایه", composer: "تمرین استاندارد", instrumentId: "drums", level: 1, rangeUnit: "freeform", description: "پارادیدل و سینگل‌استروک؛ بدون تقسیم‌بندی میزانی." },
  { slug: "groove_funk", title: "گروو فانک", composer: "تمرین سبک", instrumentId: "drums", level: 4, rangeUnit: "timestamp", totalRange: 180, description: "حفظ گروو روی بستر ضبط‌شده؛ پیشرفت بر حسب ثانیه." },
  // Theory
  { slug: "solfege_1", title: "سلفژ — درس اول", composer: "متد آموزشگاه", instrumentId: "theory", level: 1, rangeUnit: "page", totalRange: 12, description: "خواندن نت در کلید سل." },
  { slug: "harmony_basics", title: "هارمونی مقدماتی", composer: "متد آموزشگاه", instrumentId: "theory", level: 3, rangeUnit: "page", totalRange: 24, description: "آکوردهای سه‌صدایی و معکوس‌ها." },
];

export function derivePieces(): Piece[] {
  const known = new Set(SEEDED_INSTRUMENTS.map((i) => i.id));
  return PIECE_SEEDS.filter((seed) => known.has(seed.instrumentId)).map((seed) => ({
    id: `pc_${seed.slug}`,
    title: seed.title,
    composer: seed.composer,
    instrumentId: seed.instrumentId,
    programId: `pg_${seed.instrumentId}`,
    recommendedLevelId: `lv_${seed.instrumentId}_${seed.level}`,
    description: seed.description,
    rangeUnit: seed.rangeUnit,
    totalRange: seed.totalRange,
    // Seeded pieces reference no media: the demo ships zero binaries.
    contentIds: [],
    active: true,
    createdAt: SEED_TIME,
  }));
}

/* ------------------------------------------------------------------ */
/* Assignments and progress history                                    */
/* ------------------------------------------------------------------ */

/**
 * The narrative shapes seeded into the history.
 *
 * Each produces a different analytics verdict, so the insight and
 * recommendation panels demonstrate their full range on first load.
 */
type Shape = "plateau" | "improving" | "regression" | "steady" | "sparse" | "new";

const SHAPE_CYCLE: Shape[] = ["improving", "plateau", "steady", "sparse", "regression", "improving", "new", "steady"];

interface Built {
  assignments: PieceAssignment[];
  events: ProgressEvent[];
}

/**
 * Builds assignments and their event histories.
 *
 * Students are matched to pieces of their own instrument. A student with no
 * matching piece simply gets none — the demo never invents a violin assignment
 * for a drummer.
 */
export function deriveProgress(): Built {
  const pieces = derivePieces();
  const byInstrument = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const list = byInstrument.get(piece.instrumentId) ?? [];
    list.push(piece);
    byInstrument.set(piece.instrumentId, list);
  }

  const assignments: PieceAssignment[] = [];
  const events: ProgressEvent[] = [];

  students.forEach((student, studentIndex) => {
    const pool = byInstrument.get(student.instrument);
    if (!pool || pool.length === 0) return;

    // One or two pieces per student, deterministically chosen. A second piece
    // is only possible when the instrument actually has two, and the stride is
    // co-prime-safe by construction (offset 0 then 1) so the same piece is
    // never drawn twice for one student.
    const count = studentIndex % 3 === 0 && pool.length >= 2 ? 2 : 1;
    for (let n = 0; n < count; n += 1) {
      const piece = pool[(studentIndex + n) % pool.length];
      const shape = SHAPE_CYCLE[(studentIndex + n) % SHAPE_CYCLE.length];
      const assignmentId = `as_${student.id}_${piece.id.replace("pc_", "")}`;

      const history = buildEvents(assignmentId, student.id, piece, shape);
      events.push(...history);

      const newest = history[history.length - 1];
      assignments.push({
        id: assignmentId,
        studentId: student.id,
        pieceId: piece.id,
        teacherId: student.teacherId,
        status: statusFor(shape, newest?.mastery ?? 0),
        assignedAt: daysBefore(shape === "new" ? 3 : 60),
        targetDate: daysBefore(-30),
        notes: NOTE_FOR_SHAPE[shape],
        latest: newest
          ? {
              rangeStart: newest.rangeStart,
              rangeEnd: newest.rangeEnd,
              rangeLabel: newest.rangeLabel,
              tempoBpm: newest.tempoBpm,
              targetTempoBpm: newest.targetTempoBpm,
              mastery: newest.mastery,
              recordedAt: newest.recordedAt,
              eventId: newest.id,
            }
          : undefined,
      });
    }
  });

  return { assignments, events };
}

const NOTE_FOR_SHAPE: Record<Shape, string> = {
  plateau: "روی همان بخش مانده‌ایم؛ نیاز به تغییر روش تمرین.",
  improving: "پیشرفت خوب و پیوسته.",
  regression: "افت نسبت به جلسات قبل؛ احتمالاً تمرین نامنظم.",
  steady: "روند عادی و بدون مشکل خاص.",
  sparse: "تازه شروع شده؛ داده برای تحلیل کافی نیست.",
  new: "به‌تازگی تخصیص داده شده است.",
};

function statusFor(shape: Shape, mastery: number): PieceAssignment["status"] {
  if (shape === "new") return "planned";
  if (mastery >= 90) return "polishing";
  return "learning";
}

/**
 * Generates the event sequence for one narrative shape.
 *
 * Values are chosen so the analytics thresholds fire unambiguously — a plateau
 * that only just crosses the line would make the demo fragile.
 */
function buildEvents(assignmentId: string, studentId: string, piece: Piece, shape: Shape): ProgressEvent[] {
  const common = {
    studentId,
    pieceId: piece.id,
    assignmentId,
    source: "teacher" as ProgressSource,
  };

  const usesNumericRange = piece.rangeUnit !== "freeform";
  const rangeOf = (start: number, end: number) =>
    usesNumericRange
      ? { rangeStart: start, rangeEnd: end }
      : { rangeLabel: `تمرین ${start}` };

  const make = (
    index: number,
    daysAgo: number,
    mastery: number,
    tempo: number | undefined,
    range: { rangeStart?: number; rangeEnd?: number; rangeLabel?: string },
    note: string,
    minutes: number,
  ): ProgressEvent => ({
    id: `pe_${assignmentId}_${index}`,
    ...common,
    ...range,
    recordedAt: daysBefore(daysAgo),
    tempoBpm: tempo,
    targetTempoBpm: tempo ? Math.round(tempo * 1.4) : undefined,
    mastery,
    practiceMinutes: minutes,
    teacherNote: note,
  });

  switch (shape) {
    case "plateau":
      // Same range, flat mastery and tempo, across 24 days → possible plateau.
      return [
        // Mastery and tempo stay inside DEFAULT_THRESHOLDS' "flat" bands
        // (±2 points, ±2 BPM) across 32 days, so the detector fires
        // unambiguously rather than sitting on the boundary.
        make(1, 36, 64, 80, rangeOf(37, 42), "شروع کار روی بخش دشوار.", 30),
        make(2, 24, 65, 80, rangeOf(37, 42), "هنوز همان بخش؛ ریتم ناهموار است.", 25),
        make(3, 12, 65, 81, rangeOf(37, 42), "تغییر محسوسی دیده نمی‌شود.", 30),
        make(4, 4, 66, 81, rangeOf(37, 42), "ریتم بخش ب نیاز به کار دارد.", 20),
      ];

    case "improving":
      return [
        make(1, 40, 38, 60, rangeOf(1, 12), "شروع قطعه.", 30),
        make(2, 26, 52, 72, rangeOf(1, 20), "پیشرفت خوب در دست راست.", 40),
        make(3, 12, 68, 84, rangeOf(1, 32), "سرعت افزایش یافت.", 45),
        make(4, 3, 79, 96, rangeOf(1, 44), "آمادهٔ اجرای کامل.", 40),
      ];

    case "regression":
      return [
        make(1, 30, 71, 88, rangeOf(1, 24), "اجرای روان.", 35),
        make(2, 16, 66, 84, rangeOf(1, 24), "افت نسبت به جلسهٔ قبل.", 20),
        make(3, 5, 59, 78, rangeOf(1, 24), "دقت کاهش یافته؛ تمرین نامنظم بوده.", 15),
      ];

    case "steady":
      return [
        make(1, 28, 55, 76, rangeOf(1, 16), "روند عادی.", 30),
        make(2, 14, 58, 78, rangeOf(9, 24), "کمی بهتر.", 30),
        make(3, 2, 60, 80, rangeOf(17, 32), "ثابت و بدون مشکل.", 30),
      ];

    case "sparse":
      // One event only → insufficient_data.
      return [make(1, 9, 44, 66, rangeOf(1, 8), "نخستین ارزیابی.", 25)];

    case "new":
    default:
      // Assigned but never practised → the panel must handle an empty history.
      return [];
  }
}
