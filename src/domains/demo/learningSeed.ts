/**
 * Seed builders for the instruments / learning / chat / gallery / branding
 * collections.
 *
 * Kept out of `seed.ts` so that file stays a readable index of the dataset.
 * Everything here is pure and deterministic: the same `SEED_VERSION` always
 * yields the same ids, so tests and backups stay stable.
 *
 * The learning data is derived from the existing academy fixtures rather than
 * invented twice — instruments come from the instrument catalogue, and the
 * library programme is built around the instruments that actually have
 * students.
 */
import { SEEDED_INSTRUMENTS } from "@/domains/instruments/catalog";
import { conversations, resources, students } from "@/data/records";
import type { InstrumentRecord } from "@/domains/instruments/types";
import type {
  LearningContent,
  LearningContentType,
  LearningLevel,
  LearningProgram,
  LevelContentLink,
  StudentPlacement,
} from "@/domains/learning/types";
import type { ChatConversation, ChatMessage } from "@/domains/chat/types";
import type { GalleryAlbum, GalleryImage } from "@/domains/gallery/types";
import { DEFAULT_BRANDING, type BrandingSettings } from "@/domains/branding/types";

/** Fixed clock for seeded timestamps, so the dataset is byte-stable. */
const SEED_TIME = "2026-09-01T00:00:00.000Z";

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */

/**
 * The seeded instruments.
 *
 * `catalog.ts` owns these definitions so that the synchronous label lookup and
 * the seeded dataset can never disagree. Seeding simply copies them.
 */
export function deriveInstruments(): InstrumentRecord[] {
  return SEEDED_INSTRUMENTS.map((instrument) => ({ ...instrument }));
}

/* ------------------------------------------------------------------ */
/* Programs and levels                                                 */
/* ------------------------------------------------------------------ */

/**
 * How many levels each seeded program has.
 *
 * Deliberately NOT uniform: the product requirement is that each instrument
 * defines its own ladder (violin's 15 is an example, not a global constant).
 * Seeding different depths proves the model does not assume a fixed N.
 */
const PROGRAM_DEPTH: Record<string, number> = {
  violin: 15,
  piano: 12,
  guitar: 10,
  voice: 8,
  drums: 8,
  theory: 6,
};

const PROGRAM_NAME: Record<string, string> = {
  violin: "ویولن کلاسیک",
  piano: "پیانو کلاسیک",
  guitar: "گیتار پایه تا پیشرفته",
  voice: "آواز و تربیت شنوایی",
  drums: "درامز و ریتم",
  theory: "تئوری موسیقی",
};

/** Persian name of a seeded instrument, for building seed copy. */
function seededName(id: string): string {
  return SEEDED_INSTRUMENTS.find((i) => i.id === id)?.name ?? id;
}

/** Persian ordinal-ish level names; falls back to a numeric label. */
function levelName(order: number): string {
  return `سطح ${order}`;
}

export function derivePrograms(): LearningProgram[] {
  return Object.keys(PROGRAM_DEPTH).map((slug) => ({
    id: `pg_${slug}`,
    instrumentId: slug,
    name: PROGRAM_NAME[slug],
    description: `برنامهٔ آموزشی ${seededName(slug)} با ${PROGRAM_DEPTH[slug]} سطح.`,
    active: true,
  }));
}

export function deriveLevels(): LearningLevel[] {
  const out: LearningLevel[] = [];
  for (const slug of Object.keys(PROGRAM_DEPTH)) {
    const depth = PROGRAM_DEPTH[slug];
    for (let order = 1; order <= depth; order += 1) {
      out.push({
        id: `lv_${slug}_${order}`,
        programId: `pg_${slug}`,
        order,
        name: levelName(order),
        description:
          order === 1
            ? `آشنایی مقدماتی با ${seededName(slug)}، وضعیت بدن و تولید صدا.`
            : `تمرین‌ها و رپرتوار سطح ${order} برای ${seededName(slug)}.`,
        objectives:
          order === 1
            ? ["نگه‌داری صحیح ساز", "تولید صدای پایدار", "خواندن نت‌های پایه"]
            : [`تسلط بر تمرین‌های سطح ${order}`, "اجرای یک قطعهٔ کامل"],
        active: true,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Learning content                                                    */
/* ------------------------------------------------------------------ */

/** Maps the legacy library `kind` onto a learning content type. */
const KIND_TO_TYPE: Record<string, LearningContentType> = {
  sheet: "pdf",
  audio: "audio",
  video: "video",
  doc: "document",
};

/**
 * Learning content is derived from the existing library `resources` so the
 * library and the learning domain describe the SAME material rather than two
 * disconnected catalogues.
 */
export function deriveLearningContent(): LearningContent[] {
  return resources.map((resource) => ({
    id: `lc_${resource.id}`,
    title: resource.title,
    description: `${resource.composer} · ${resource.level}`,
    type: KIND_TO_TYPE[resource.kind] ?? "document",
    author: resource.composer,
    instrumentId: resource.instrument,
    // Seeded library material is student-facing.
    visibility: "students",
    createdAt: SEED_TIME,
    active: true,
  }));
}

/**
 * Attaches each library item to a level of its own instrument's program.
 *
 * The legacy `Resource.level` is a free-text Persian label ("مقدماتی"،
 * "متوسط"…), so it is mapped onto a band of the ladder rather than parsed as a
 * number. Content therefore lands at a plausible depth for its difficulty.
 */
const LEVEL_BAND: Record<string, number> = {
  مقدماتی: 1,
  "سطح ۱": 1,
  "سطح ۲": 2,
  متوسط: 3,
  "متوسط رو به بالا": 5,
  پیشرفته: 7,
};

export function deriveLevelContent(): LevelContentLink[] {
  const out: LevelContentLink[] = [];
  const perLevel = new Map<string, number>();

  for (const resource of resources) {
    const slug = resource.instrument;
    const depth = PROGRAM_DEPTH[slug];
    if (!depth) continue;

    // Clamp the mapped band into the program's real range.
    const band = LEVEL_BAND[resource.level.trim()] ?? 2;
    const order = Math.min(Math.max(1, band), depth);
    const levelId = `lv_${slug}_${order}`;

    const seen = perLevel.get(levelId) ?? 0;
    perLevel.set(levelId, seen + 1);

    out.push({
      id: `lcl_${resource.id}`,
      levelId,
      contentId: `lc_${resource.id}`,
      sortOrder: seen,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Student placements                                                  */
/* ------------------------------------------------------------------ */

/**
 * Places every seeded student on the ladder for their instrument.
 *
 * The chosen level is derived deterministically from the student's index and
 * their program depth, so the demo shows a realistic spread (beginners through
 * advanced) without random data that would change between runs.
 */
export function derivePlacements(): StudentPlacement[] {
  const out: StudentPlacement[] = [];
  students.forEach((student, index) => {
    const slug = student.instrument;
    const depth = PROGRAM_DEPTH[slug];
    if (!depth) return;

    // Spread students across the lower two-thirds of each ladder.
    const order = ((index * 3) % Math.max(1, Math.ceil(depth * 0.66))) + 1;
    out.push({
      id: `pl_${student.id}`,
      studentId: student.id,
      programId: `pg_${slug}`,
      levelId: `lv_${slug}_${order}`,
      assignedAt: SEED_TIME,
      history:
        order > 1
          ? [{ levelId: `lv_${slug}_${order - 1}`, changedAt: SEED_TIME, note: "ارتقا پس از ارزیابی دوره" }]
          : [],
    });
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* Chat                                                                */
/* ------------------------------------------------------------------ */

/**
 * Converts the legacy nested-message fixture into the normalized two-table
 * shape. The fixture stays the single source of the demo conversation content;
 * only its structure changes.
 */
export function deriveChat(): { conversations: ChatConversation[]; messages: ChatMessage[] } {
  const threads: ChatConversation[] = [];
  const messages: ChatMessage[] = [];

  conversations.forEach((legacy, threadIndex) => {
    // Synthesize ISO timestamps: the fixture only has Persian clock strings,
    // and ordering needs a real sortable value.
    const baseMinutes = threadIndex * 37;

    legacy.messages.forEach((message, messageIndex) => {
      const offset = baseMinutes + messageIndex;
      messages.push({
        id: `msg_${legacy.id}_${messageIndex + 1}`,
        conversationId: `cv_${legacy.id}`,
        from: message.from,
        body: message.text,
        sentAt: new Date(Date.parse(SEED_TIME) + offset * 60_000).toISOString(),
        provider: "in_app",
        status: "sent",
      });
    });

    const last = legacy.messages[legacy.messages.length - 1];
    threads.push({
      id: `cv_${legacy.id}`,
      name: legacy.name,
      role: legacy.role,
      topic: legacy.topic,
      pinned: legacy.pinned,
      unread: legacy.unread,
      lastMessagePreview: last?.text ?? "",
      lastMessageAt: new Date(
        Date.parse(SEED_TIME) + (baseMinutes + Math.max(0, legacy.messages.length - 1)) * 60_000,
      ).toISOString(),
    });
  });

  return { conversations: threads, messages };
}

/* ------------------------------------------------------------------ */
/* Gallery and branding                                                */
/* ------------------------------------------------------------------ */

/**
 * Seeded albums carry no images: the demo ships no binaries, and inventing
 * `mediaId`s that resolve to nothing would produce broken thumbnails. Albums
 * start empty and the operator fills them through the real upload flow.
 */
export function deriveGalleryAlbums(): GalleryAlbum[] {
  return [
    {
      id: "alb_recital",
      title: "کنسرت پایان ترم",
      description: "تصاویر اجرای هنرجویان در تالار اصلی.",
      createdAt: SEED_TIME,
      sortOrder: 1,
    },
    {
      id: "alb_rooms",
      title: "فضای آموزشگاه",
      description: "اتاق‌های تمرین، استودیو و کتابخانه.",
      createdAt: SEED_TIME,
      sortOrder: 2,
    },
  ];
}

export function deriveGalleryImages(): GalleryImage[] {
  return [];
}

export function deriveBranding(): BrandingSettings {
  return { ...DEFAULT_BRANDING };
}
