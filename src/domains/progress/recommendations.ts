/**
 * Deterministic recommendation engine.
 *
 * Rules over the analytics output — no model, no randomness, no fabricated
 * confidence. Every recommendation carries the evidence that triggered it, so
 * a teacher can disagree with the reasoning rather than with an oracle.
 *
 * This layer exists specifically so that AI, when it arrives, has structured
 * input to narrate instead of being asked to invent clinical judgements from
 * raw rows. The rules encode ordinary pedagogy (slow it down, isolate the hard
 * bar, revisit the prerequisite) and are intentionally conservative.
 *
 * Pure: no storage, no React, no clock beyond what is passed in.
 */
import type { EligibleContent } from "@/domains/learning/types";
import type { ProgressInsight } from "./analytics";
import type { Piece, PieceAssignment } from "./types";

/** What the teacher/student is being advised to do. */
export type RecommendationKind =
  | "reduce_tempo"
  | "isolate_range"
  | "shorten_practice"
  | "revisit_prerequisite"
  | "advance_range"
  | "raise_tempo_target"
  | "teacher_review"
  | "record_progress"
  | "consider_completion";

export const RECOMMENDATION_LABEL: Record<RecommendationKind, string> = {
  reduce_tempo: "کاهش موقت سرعت",
  isolate_range: "تمرکز روی محدودهٔ مشکل‌دار",
  shorten_practice: "تمرین کوتاه‌تر و منظم‌تر",
  revisit_prerequisite: "مرور محتوای پیش‌نیاز",
  advance_range: "گسترش محدودهٔ تمرین",
  raise_tempo_target: "افزایش سرعت هدف",
  teacher_review: "بازبینی توسط مدرس",
  record_progress: "ثبت پیشرفت",
  consider_completion: "بررسی برای اتمام قطعه",
};

/**
 * Urgency, used only for ordering and colour.
 *
 * Not a clinical severity: `attention` means "look at this next", not
 * "something is wrong".
 */
export type RecommendationPriority = "info" | "suggested" | "attention";

export interface Recommendation {
  kind: RecommendationKind;
  priority: RecommendationPriority;
  assignmentId: string;
  pieceId: string;
  /** Persian sentence stating WHY, built from the evidence — never generic. */
  reason: string;
  /** The insight that triggered this rule, for traceability. */
  evidence: ProgressInsight["evidence"];
  /**
   * Eligible library content supporting the advice. Always resolved through
   * the eligibility rules — a recommendation must never surface material the
   * student is not permitted to open (§21).
   */
  suggestedContentIds: string[];
}

/** Inputs the rules need, passed explicitly to keep the function pure. */
export interface RecommendationInput {
  insight: ProgressInsight;
  assignment: PieceAssignment;
  piece: Piece | undefined;
  /** Already filtered to what this student may open. */
  eligibleContent: readonly EligibleContent[];
  now?: Date;
}

/** Days without an event after which we nudge for a progress entry. */
const STALE_EVENT_DAYS = 21;

/** Mastery at or above which a piece is worth reviewing for completion. */
const COMPLETION_MASTERY = 90;

/**
 * Picks eligible content plausibly related to a piece.
 *
 * Matching is intentionally shallow — title/description token overlap — and
 * capped. It is a shortlist for a human, not a claim of relevance, so a weak
 * match is better than pretending no material exists. Content already attached
 * to the piece is preferred.
 */
function relatedContent(
  piece: Piece | undefined,
  eligible: readonly EligibleContent[],
  limit = 3,
): string[] {
  if (eligible.length === 0) return [];

  const attached = new Set(piece?.contentIds ?? []);
  const preferred = eligible.filter((e) => attached.has(e.content.id)).map((e) => e.content.id);
  if (preferred.length >= limit) return preferred.slice(0, limit);

  const needles = [piece?.title, piece?.composer]
    .filter((value): value is string => typeof value === "string" && value.length > 2)
    .map((value) => value.toLowerCase());

  const scored = eligible
    .filter((e) => !attached.has(e.content.id))
    .map((e) => {
      const haystack = `${e.content.title} ${e.content.description}`.toLowerCase();
      const score = needles.reduce((sum, needle) => (haystack.includes(needle) ? sum + 1 : sum), 0);
      return { id: e.content.id, score, order: e.levelOrder };
    })
    // Highest textual overlap first, then the most advanced level the student
    // has unlocked — closest to where they are actually working.
    .sort((a, b) => b.score - a.score || b.order - a.order);

  return [...preferred, ...scored.map((s) => s.id)].slice(0, limit);
}

/**
 * Produces recommendations for one assignment.
 *
 * Returns an empty array when nothing is worth saying. Silence is a valid
 * output; padding it with filler advice would train people to ignore the panel.
 */
export function recommendForAssignment(input: RecommendationInput): Recommendation[] {
  const { insight, assignment, piece, eligibleContent } = input;
  const out: Recommendation[] = [];
  const base = {
    assignmentId: assignment.id,
    pieceId: assignment.pieceId,
    evidence: insight.evidence,
  };

  const rangeText = insight.evidence.rangeLabel ?? "محدودهٔ فعلی";
  const content = relatedContent(piece, eligibleContent);
  const tempo = assignment.latest?.tempoBpm;
  const mastery = assignment.latest?.mastery;

  switch (insight.status) {
    case "possible_plateau": {
      // Classic remediation, ordered from least to most disruptive.
      if (typeof tempo === "number") {
        out.push({
          ...base,
          kind: "reduce_tempo",
          priority: "attention",
          reason: `${insight.evidence.rangeRepeats} جلسهٔ متوالی روی ${rangeText} بدون تغییر محسوس در تسلط. کاهش موقت سرعت از ${tempo} به حدود ${Math.max(
            20,
            Math.round(tempo * 0.85),
          )} ضرب می‌تواند گره را باز کند.`,
          suggestedContentIds: content,
        });
      }
      out.push({
        ...base,
        kind: "isolate_range",
        priority: "attention",
        reason: `تمرین ${rangeText} به‌صورت جداگانه و کوتاه، به‌جای اجرای کامل قطعه.`,
        suggestedContentIds: content,
      });
      out.push({
        ...base,
        kind: "revisit_prerequisite",
        priority: "suggested",
        reason: "مرور محتوای سطوح پیشین که همین مهارت را پوشش می‌دهد.",
        suggestedContentIds: content,
      });
      break;
    }

    case "regression": {
      out.push({
        ...base,
        kind: "teacher_review",
        priority: "attention",
        reason: `تسلط ${Math.abs(insight.evidence.masteryChange ?? 0)} واحد کاهش یافته است. بازبینی مدرس پیش از ادامه توصیه می‌شود.`,
        suggestedContentIds: content,
      });
      out.push({
        ...base,
        kind: "shorten_practice",
        priority: "suggested",
        reason: "جلسات کوتاه‌تر و منظم‌تر معمولاً از افت ناشی از خستگی جلوگیری می‌کند.",
        suggestedContentIds: [],
      });
      break;
    }

    case "improving": {
      out.push({
        ...base,
        kind: "advance_range",
        priority: "suggested",
        reason: `تسلط ${insight.evidence.masteryChange} واحد بهبود یافته است؛ گسترش محدوده فراتر از ${rangeText} منطقی به نظر می‌رسد.`,
        suggestedContentIds: content,
      });
      if (typeof tempo === "number") {
        out.push({
          ...base,
          kind: "raise_tempo_target",
          priority: "info",
          reason: `سرعت هدف را می‌توان از ${tempo} به حدود ${Math.min(400, Math.round(tempo * 1.1))} ضرب افزایش داد.`,
          suggestedContentIds: [],
        });
      }
      break;
    }

    case "slowing": {
      out.push({
        ...base,
        kind: "shorten_practice",
        priority: "suggested",
        reason: `پیشرفت در ${insight.evidence.windowDays} روز گذشته کند شده است. تمرین کوتاه‌تر اما منظم‌تر پیشنهاد می‌شود.`,
        suggestedContentIds: content,
      });
      break;
    }

    case "insufficient_data": {
      out.push({
        ...base,
        kind: "record_progress",
        priority: "info",
        reason:
          insight.evidence.events === 0
            ? "هنوز پیشرفتی برای این قطعه ثبت نشده است؛ بدون داده تحلیلی ممکن نیست."
            : "برای تحلیل روند دست‌کم دو ثبت پیشرفت لازم است.",
        suggestedContentIds: [],
      });
      break;
    }

    case "stable":
    default:
      break;
  }

  // Independent of trend: a high-mastery piece deserves a completion decision.
  if (typeof mastery === "number" && mastery >= COMPLETION_MASTERY && assignment.status !== "polishing") {
    out.push({
      ...base,
      kind: "consider_completion",
      priority: "info",
      reason: `تسلط به ${mastery} رسیده است؛ بررسی کنید که قطعه به مرحلهٔ صیقل‌دهی یا اتمام رسیده باشد.`,
      suggestedContentIds: [],
    });
  }

  // Independent of trend: a stale assignment needs an entry before any
  // analysis can be trusted.
  const stale = insight.evidence.daysSinceLastEvent;
  if (typeof stale === "number" && stale >= STALE_EVENT_DAYS && insight.status !== "insufficient_data") {
    out.push({
      ...base,
      kind: "record_progress",
      priority: "suggested",
      reason: `${stale} روز از آخرین ثبت پیشرفت گذشته است؛ تحلیل‌ها ممکن است قدیمی باشند.`,
      suggestedContentIds: [],
    });
  }

  return out;
}

const PRIORITY_RANK: Record<RecommendationPriority, number> = {
  attention: 0,
  suggested: 1,
  info: 2,
};

/** Highest-urgency first; stable within a priority. */
export function sortRecommendations(recommendations: readonly Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
