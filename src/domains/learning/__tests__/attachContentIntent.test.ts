/**
 * I13 Checkpoint 2 — `attachContent` must be handed the caller's intent.
 *
 * THE DEFECT THIS PINS. `attachContent(levelId, contentId)` checked only that
 * both ids existed. A surface renders level rows from a list query; when that
 * query's params changed, the row on screen could belong to a program the user
 * had navigated away from (I13). Both ids still existed, so the write succeeded
 * — content landed on a ladder nobody was looking at, and because eligibility is
 * *derived* from links, it silently changed what every placed student of that
 * other program could open. Nothing downstream could catch it: unlike
 * `assignPlacement`, `attachContent` was never told which program the caller
 * meant, so it had nothing to compare the level against.
 *
 * THE CONTRACT UNDER TEST. A required third argument, `AttachContentIntent`,
 * carrying the program the caller resolved independently. The repository
 * compares it to `level.programId` and refuses the pair when they disagree.
 *
 * WHAT THESE TESTS DELIBERATELY DO NOT DO:
 *  - they never pass `level.programId` as the intent. That would be a tautology
 *    — the check would compare a value with itself and prove nothing. Every
 *    intent here is a program the test resolved separately from the level, which
 *    is the only shape a real caller can honestly produce.
 *  - they do not re-assert the pre-existing behaviour from `demoRepository.test.ts`
 *    as their own proof; that file keeps its 24 tests and they still pass
 *    unchanged, which is the regression evidence. What is added here is the
 *    adversarial half: that a wrong intent is refused *and writes nothing*.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { DemoLearningRepository } from "../demoRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";

let repo: DemoLearningRepository;

beforeEach(() => {
  resetToDemoEnvironment();
  repo = new DemoLearningRepository();
});

/** Resolves an ApiError instead of letting a rejection escape the test. */
async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (cause) {
    if (cause instanceof ApiError) return cause;
    throw cause;
  }
  throw new Error("expected the call to be refused, but it resolved");
}

async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (cause) {
    return cause instanceof ApiError ? cause.code : "NOT_API_ERROR";
  }
}

/** Content ids the seed provides, resolved rather than hardcoded. */
async function someContent(count: number): Promise<string[]> {
  const rows = (await repo.listContent({ per_page: count + 5 })).data;
  return rows.slice(0, count).map((row) => row.id);
}

describe("attachContent with a matching intent — the valid path is untouched", () => {
  it("links the content when the caller's program is the level's program", async () => {
    const [contentId] = await someContent(1);
    const before = (await repo.listLinks("lv_theory_1")).length;
    const contentTotalBefore = (await repo.listContent({ per_page: 500 })).meta.total;

    const link = await repo.attachContent("lv_theory_1", contentId, { programId: "pg_theory" });

    expect(link.levelId).toBe("lv_theory_1");
    expect(link.contentId).toBe(contentId);
    // Appended after the level's existing content, not inserted over it.
    expect(link.sortOrder).toBe(before);
    expect((await repo.listLinks("lv_theory_1")).length).toBe(before + 1);
    // Linked, never copied: the requirement this repository has always had.
    expect((await repo.listContent({ per_page: 500 })).meta.total).toBe(contentTotalBefore);
  });

  it("still lets one content item serve levels of two different programs, each call stating its own intent", async () => {
    // The link table is many-to-many by design — one item may serve several
    // levels AND several programs. The guard must refuse a *wrong* intent, not
    // make cross-program sharing impossible, or it would regress the model.
    const [contentId] = await someContent(1);

    await repo.attachContent("lv_theory_2", contentId, { programId: "pg_theory" });
    await repo.attachContent("lv_violin_2", contentId, { programId: "pg_violin" });

    const links = (await repo.listLinks()).filter((row) => row.contentId === contentId);
    expect(links.map((row) => row.levelId)).toEqual(
      expect.arrayContaining(["lv_theory_2", "lv_violin_2"]),
    );
  });

  it("adds exactly one check: an inactive level is still attachable, as before", async () => {
    // assignPlacement refuses an inactive level; attachContent never did, and
    // Checkpoint 2 was authorized to add the program-intent comparison and
    // nothing else. Pinning this stops the guard quietly growing a second rule.
    const [contentId] = await someContent(1);
    await repo.updateLevel("lv_theory_3", { active: false });
    expect((await repo.getLevel("lv_theory_3")).active).toBe(false);

    await expect(
      repo.attachContent("lv_theory_3", contentId, { programId: "pg_theory" }),
    ).resolves.toMatchObject({ levelId: "lv_theory_3", contentId });
  });
});

describe("attachContent with a mismatched intent — refused, and nothing written", () => {
  it("refuses a level that belongs to another program", async () => {
    const [contentId] = await someContent(1);

    const error = await errorOf(
      repo.attachContent("lv_piano_2", contentId, { programId: "pg_violin" }),
    );

    expect(error.code).toBe("LINK_INVALID");
    expect(error.kind).toBe("validation");
    // Persian-first, and pointed at the field a form would highlight — the same
    // shape assignPlacement has always reported for the same mismatch.
    expect(error.message).toMatch(/تعلق ندارد/);
    expect(error.fields?.levelId).toEqual(["با برنامه هم‌خوان نیست"]);
  });

  it("writes no link at all when it refuses — the rejection is not partial", async () => {
    const [contentId] = await someContent(1);
    const linksBefore = await repo.listLinks();

    await expect(
      codeOf(repo.attachContent("lv_piano_2", contentId, { programId: "pg_violin" })),
    ).resolves.toBe("LINK_INVALID");

    const linksAfter = await repo.listLinks();
    expect(linksAfter).toHaveLength(linksBefore.length);
    expect(linksAfter.some((row) => row.levelId === "lv_piano_2" && row.contentId === contentId)).toBe(
      false,
    );
  });

  it("refuses the exact I13 window: a row left over from the program the user navigated away from", async () => {
    // The caller's selection moved from piano to violin. The level row it still
    // holds came from the piano query; the program it independently resolved is
    // now violin. Before Checkpoint 2 this write succeeded.
    const staleRows = (await repo.listLevels({ programId: "pg_piano", per_page: 100 })).data;
    const staleLevel = staleRows[2];
    const selectedProgram = "pg_violin";
    const [contentId] = await someContent(1);

    expect(staleLevel.programId).toBe("pg_piano");
    expect(
      await codeOf(repo.attachContent(staleLevel.id, contentId, { programId: selectedProgram })),
    ).toBe("LINK_INVALID");
    expect((await repo.listLinks(staleLevel.id)).some((row) => row.contentId === contentId)).toBe(
      false,
    );
  });

  it("changes no placed student's eligible content when it refuses", async () => {
    // Eligibility is derived from links, so the harm was never the stray row —
    // it was what the stray row silently did to students of the other program.
    await repo.assignPlacement({
      studentId: "st1",
      programId: "pg_violin",
      levelId: "lv_violin_6",
    });
    const [contentId] = await someContent(1);
    const before = (await repo.eligibleContent("st1")).map((row) => row.content.id).sort();

    // A piano level, with a violin intent: refused.
    await expect(
      codeOf(repo.attachContent("lv_piano_1", contentId, { programId: "pg_violin" })),
    ).resolves.toBe("LINK_INVALID");

    expect((await repo.eligibleContent("st1")).map((row) => row.content.id).sort()).toEqual(before);
    // And the piano ladder the caller was not looking at is untouched too.
    expect((await repo.listLinks("lv_piano_1")).some((row) => row.contentId === contentId)).toBe(
      false,
    );
  });

  it("reports the mismatch before the duplicate, so a write the caller did not mean is refused rather than excused", async () => {
    // Ordering is a decision, not an accident: if the duplicate check ran first,
    // a stale row that happened to be already linked would answer
    // CONTENT_ALREADY_LINKED and the caller would learn nothing about the fact
    // that it was pointing at the wrong program.
    const [contentId] = await someContent(1);
    await repo.attachContent("lv_theory_1", contentId, { programId: "pg_theory" });

    expect(
      await codeOf(repo.attachContent("lv_theory_1", contentId, { programId: "pg_violin" })),
    ).toBe("LINK_INVALID");
    // The honest duplicate answer is still there for the caller that means it.
    expect(
      await codeOf(repo.attachContent("lv_theory_1", contentId, { programId: "pg_theory" })),
    ).toBe("CONTENT_ALREADY_LINKED");
  });
});

describe("the checks that existed before are unchanged", () => {
  it("still refuses a level that does not exist, whatever the intent", async () => {
    const [contentId] = await someContent(1);

    expect(
      await codeOf(repo.attachContent("lv_nope", contentId, { programId: "pg_theory" })),
    ).toBe("LEVEL_NOT_FOUND");
  });

  it("still refuses content that does not exist, whatever the intent", async () => {
    expect(
      await codeOf(repo.attachContent("lv_theory_1", "lc_nope", { programId: "pg_theory" })),
    ).toBe("CONTENT_NOT_FOUND");
  });

  it("refuses an intent naming a program that does not exist, rather than letting it pass as a mismatch", async () => {
    // A caller that cannot name its own program has a bug of its own; answering
    // LINK_INVALID would hide it behind a message about the level.
    const [contentId] = await someContent(1);

    expect(
      await codeOf(repo.attachContent("lv_theory_1", contentId, { programId: "pg_nope" })),
    ).toBe("PROGRAM_NOT_FOUND");
    expect((await repo.listLinks("lv_theory_1")).some((row) => row.contentId === contentId)).toBe(
      false,
    );
  });

  it("still refuses to attach the same content to a level twice", async () => {
    const [contentId] = await someContent(1);
    await repo.attachContent("lv_theory_4", contentId, { programId: "pg_theory" });

    expect(
      await codeOf(repo.attachContent("lv_theory_4", contentId, { programId: "pg_theory" })),
    ).toBe("CONTENT_ALREADY_LINKED");
    expect((await repo.listLinks("lv_theory_4")).filter((row) => row.contentId === contentId)).toHaveLength(1);
  });

  it("still detaches by level and content, which needs no intent because it removes nothing", async () => {
    const [contentId] = await someContent(1);
    await repo.attachContent("lv_theory_5", contentId, { programId: "pg_theory" });

    await repo.detachContent("lv_theory_5", contentId);

    expect((await repo.listLinks("lv_theory_5")).some((row) => row.contentId === contentId)).toBe(
      false,
    );
    expect(await repo.getContent(contentId)).toBeDefined();
  });
});

describe("the contract cannot be opted out of", () => {
  it("makes omission a compile error rather than a runtime default", () => {
    // An optional parameter would leave the hole open for any caller that simply
    // does not pass one — which is every caller written before the guard
    // existed, and the first one M3 writes in a hurry. This is checked by
    // `npm run typecheck`, not at runtime: if a future signature change made the
    // two-argument call legal again, the directive below would itself become an
    // error and fail the build.
    const legacyTwoArgumentCall = (): unknown =>
      // @ts-expect-error I13 Checkpoint 2 — attachContent requires the caller's intent
      repo.attachContent("lv_theory_1", "lc_whatever");

    expect(typeof legacyTwoArgumentCall).toBe("function");
  });

  it("cannot be satisfied by reading the intent back off the target, which is what a lazy caller would do", async () => {
    // Documented here because it is the one way to make the guard pass while
    // meaning nothing: resolve the level, then hand its own program back as the
    // "intent". The repository cannot detect that — only a review can — so the
    // tautology is written down as a failure mode with its own test showing that
    // it does still attach, i.e. that the protection lives in the caller's
    // honesty about where the value came from.
    const level = await repo.getLevel("lv_piano_2");
    const [contentId] = await someContent(1);

    const link = await repo.attachContent(level.id, contentId, { programId: level.programId });

    expect(link.levelId).toBe("lv_piano_2");
    // The guard's real value is against a *different* resolution, proven above.
    expect(
      await codeOf(repo.attachContent("lv_piano_3", contentId, { programId: "pg_violin" })),
    ).toBe("LINK_INVALID");
  });
});
