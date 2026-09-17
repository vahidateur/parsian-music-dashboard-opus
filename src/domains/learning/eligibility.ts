/**
 * Content-eligibility rules.
 *
 * Pure functions over already-loaded rows: no storage, no repository, no React.
 * Keeping the rule here (rather than inside a repository method) means the demo
 * repository and a future API repository can both apply it, and it can be unit
 * tested without any environment at all.
 *
 * COMPLEXITY
 *
 * The naive shape of this question — "for each content item, is any of its
 * levels reachable by this student?" — is O(content × links × levels). Instead
 * we build three hash indexes in one pass each and then do constant-time
 * lookups, giving O(L + K + C) time and O(L + K) extra space, where L = levels,
 * K = links and C = eligible content.
 *
 * That matters because this runs on every render of a student's library view.
 */
import type {
  EligibleContent,
  LearningContent,
  LearningLevel,
  LevelContentLink,
  StudentPlacement,
} from "./types";

/** Inputs the rule needs. Passed explicitly so the function stays pure. */
export interface EligibilityInput {
  placement: StudentPlacement | undefined;
  levels: readonly LearningLevel[];
  links: readonly LevelContentLink[];
  content: readonly LearningContent[];
  /**
   * Audience resolving the list. Defaults to `students`, the safer of the two:
   * a caller that forgets to pass it cannot accidentally expose teacher-only
   * material. Teacher-facing screens opt in explicitly.
   */
  audience?: "students" | "teachers";
}

/**
 * Resolves the content a student may currently open.
 *
 * Rule: content linked to any *active* level of the student's program whose
 * `order` is at or below the student's current level. A level marked
 * `exclusive` only grants access when it is exactly the student's level.
 *
 * Returns an empty list when the student has no placement — an unplaced
 * student is not silently granted everything.
 */
export function resolveEligibleContent(input: EligibilityInput): EligibleContent[] {
  const { placement, levels, links, content, audience = "students" } = input;
  if (!placement) return [];

  // Index 1: levels of this program, by id. Also locates the current level.
  const programLevels = new Map<string, LearningLevel>();
  let current: LearningLevel | undefined;
  for (const level of levels) {
    if (level.programId !== placement.programId) continue;
    programLevels.set(level.id, level);
    if (level.id === placement.levelId) current = level;
  }
  // A placement pointing at a level outside its program is inconsistent data,
  // not a reason to leak content.
  if (!current) return [];

  // Index 2: which levels are reachable, resolved once instead of per link.
  const reachable = new Map<string, LearningLevel>();
  for (const level of programLevels.values()) {
    if (!level.active) continue;
    const ok = level.exclusive ? level.id === current.id : level.order <= current.order;
    if (ok) reachable.set(level.id, level);
  }

  // Index 3: content by id, so link resolution is O(1).
  const byId = new Map<string, LearningContent>();
  for (const item of content) byId.set(item.id, item);

  // Single pass over the links. A content item linked to several reachable
  // levels is emitted once, attributed to its LOWEST reachable level so the
  // student sees where the material was first unlocked.
  const chosen = new Map<string, EligibleContent>();
  for (const link of links) {
    const level = reachable.get(link.levelId);
    if (!level) continue;
    const item = byId.get(link.contentId);
    if (!item || !item.active) continue;
    // Teacher-only material is never eligible for a student, regardless of
    // level. This is a UX filter; the server must enforce the same rule (§31).
    if (audience === "students" && item.visibility === "teachers") continue;

    const existing = chosen.get(item.id);
    if (existing && existing.levelOrder <= level.order) continue;
    chosen.set(item.id, {
      content: item,
      levelId: level.id,
      levelOrder: level.order,
      levelName: level.name,
      sortOrder: link.sortOrder,
    });
  }

  return [...chosen.values()].sort(
    (a, b) => a.levelOrder - b.levelOrder || a.sortOrder - b.sortOrder || a.content.title.localeCompare(b.content.title, "fa"),
  );
}

/**
 * Inverse rule: which students can currently open a given content item.
 * Used by the content editor to answer "who does this reach?" honestly.
 *
 * O(L + K + P) via the same indexing approach.
 */
export function resolveEligibleStudentIds(
  contentId: string,
  levels: readonly LearningLevel[],
  links: readonly LevelContentLink[],
  placements: readonly StudentPlacement[],
): string[] {
  // Levels this content is attached to.
  const attached = new Set<string>();
  for (const link of links) {
    if (link.contentId === contentId) attached.add(link.levelId);
  }
  if (attached.size === 0) return [];

  const levelById = new Map<string, LearningLevel>();
  for (const level of levels) levelById.set(level.id, level);

  // Lowest reachable order per program, so each placement is one comparison.
  const minOrderByProgram = new Map<string, number>();
  const exclusiveLevels = new Set<string>();
  for (const levelId of attached) {
    const level = levelById.get(levelId);
    if (!level || !level.active) continue;
    if (level.exclusive) {
      exclusiveLevels.add(level.id);
      continue;
    }
    const seen = minOrderByProgram.get(level.programId);
    if (seen === undefined || level.order < seen) minOrderByProgram.set(level.programId, level.order);
  }

  const out: string[] = [];
  for (const placement of placements) {
    if (exclusiveLevels.has(placement.levelId)) {
      out.push(placement.studentId);
      continue;
    }
    const threshold = minOrderByProgram.get(placement.programId);
    if (threshold === undefined) continue;
    const level = levelById.get(placement.levelId);
    if (level && level.order >= threshold) out.push(placement.studentId);
  }
  return out;
}
