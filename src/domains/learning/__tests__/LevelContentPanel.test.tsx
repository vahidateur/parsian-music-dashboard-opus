// @vitest-environment jsdom
/**
 * M3 — the learning-content assignment surface (`LevelContentPanel`).
 *
 * WHAT IS UNDER TEST. I3's gap was a UI and workflow gap, not a schema one: the
 * link contract (`listLinks` / `attachContent` / `detachContent`, link ordering,
 * the `CONTENT_ALREADY_LINKED` conflict) already existed and was already tested,
 * and only tests called it. These cases prove the surface writes through that
 * contract and reports what really happened.
 *
 * THE WRITE INVARIANT (I13 Checkpoint 2). The level id comes from a rendered row;
 * the program id passed as `AttachContentIntent` must come from the *programs*
 * selection — an independent query — and never from `level.programId` read back
 * off the row. Two values from one row cannot contradict each other, so a guard
 * built on them proves nothing. The adversarial case below crosses them on
 * purpose and asserts both halves: that the repository was handed the
 * independent value, and that it refused the write.
 *
 * TEST DISCIPLINE. Waits are data-derived — the rows on screen are the rows the
 * repository holds for the level the heading names — never "wait until
 * `loading === false`", which is the flag under test in every in-flight case.
 * No sleep, no retry budget, no increased timeout, no skipped case.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { AppProvider } from "@/context/AppContext";
import { Toasts } from "@/components/overlays/ActionSheet";
import { getLearningRepository, resetRegistry, setLearningRepository } from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { withStubs, type Stubs } from "@/test/repositoryStubs";
import { DemoLearningRepository } from "../demoRepository";
import { LevelContentPanel } from "../LevelContentPanel";
import type { LearningRepository } from "../repository";
import type { LearningContent, LearningLevel } from "../types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const PROGRAM = { id: "pg_theory", name: "تئوری موسیقی" };

function panelRoot(): HTMLElement {
  const root = document.querySelector<HTMLElement>(
    'section[aria-labelledby="level-content-heading"]',
  );
  if (!root) throw new Error("the assignment surface is not rendered");
  return root;
}

function headingText(): string {
  return panelRoot().querySelector("h3")?.textContent ?? "";
}

/** The linked-content rows, and only those: the picker is a <select>. */
function rows(): HTMLElement[] {
  return [...panelRoot().querySelectorAll("li")] as HTMLElement[];
}

function rowTitles(): string[] {
  return rows().map((row) => row.textContent ?? "");
}

function picker(): HTMLSelectElement {
  return screen.getByRole("combobox") as HTMLSelectElement;
}

function pickerLabels(): string[] {
  return [...picker().options].map((option) => option.textContent ?? "");
}

function attachButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: /اتصال|در حال ثبت/ }) as HTMLButtonElement;
}

function toast(): string {
  return document.querySelector('[aria-live="polite"]')?.textContent ?? "";
}

/** Text that can only reach the DOM through a lookup or arithmetic mistake. */
const ARTEFACTS = ["NaN", "Infinity", "undefined", "[object Object]"];

function expectNoArtefacts(): void {
  const text = panelRoot().textContent ?? "";
  for (const artefact of ARTEFACTS) {
    expect(text, `the surface rendered "${artefact}"`).not.toContain(artefact);
  }
}

interface MountOptions {
  levelId?: string;
  levelName?: string;
  programId?: string;
  programName?: string;
}

function mountPanel(options: MountOptions = {}) {
  const props = {
    levelId: options.levelId ?? "lv_theory_1",
    levelName: options.levelName ?? "سطح ۱",
    programId: options.programId ?? PROGRAM.id,
    programName: options.programName ?? PROGRAM.name,
  };
  const view = render(
    <AppProvider>
      <LevelContentPanel {...props} />
      {/* The shell mounts the toast region (App.tsx); a panel on its own would
          announce nothing, and honest reporting is part of what is tested. */}
      <Toasts />
    </AppProvider>,
  );
  return {
    ...view,
    props,
    /** Re-renders the same surface for a different level, as a row switch does. */
    switchTo: (next: MountOptions) =>
      view.rerender(
        <AppProvider>
          <LevelContentPanel {...{ ...props, ...next }} />
          <Toasts />
        </AppProvider>,
      ),
  };
}

/** A level with no links at all, created through the real repository. */
async function freshLevel(programId = PROGRAM.id, name = "سطح آزمایشی"): Promise<LearningLevel> {
  return getLearningRepository().createLevel({
    programId,
    name,
    description: "",
    objectives: [],
    active: true,
  });
}

async function someContent(count = 3): Promise<LearningContent[]> {
  return (await getLearningRepository().listContent({ per_page: 200 })).data.slice(0, count);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Records what the repository was actually asked to write. */
interface RecordedAttach {
  levelId: string;
  contentId: string;
  intent: { programId: string };
}

/**
 * Holds the panel's own content reads open, so an in-flight window can be
 * asserted instead of raced. Everything else delegates to the real repository,
 * so the writes under test are the real ones.
 */
function controlledContent() {
  const pending = new Map<string, Deferred<Page<LearningContent>>>();
  const real = getLearningRepository();
  setLearningRepository(
    withStubs(real, {
      listContent: (params: { levelId?: string; per_page?: number } = {}) => {
        const key = params.levelId ?? "*";
        const entry = deferred<Page<LearningContent>>();
        pending.set(key, entry);
        return entry.promise;
      },
    } satisfies Stubs<LearningRepository>),
  );

  return {
    /** Answers one held read from the real store, so the page is the truth. */
    settle: async (key: string) => {
      const truth = await real.listContent(
        key === "*" ? { per_page: 200 } : { levelId: key, per_page: 200 },
      );
      pending.get(key)?.resolve(truth);
    },
    fail: (key: string, cause: unknown) => pending.get(key)?.reject(cause),
    asked: (key: string) => pending.has(key),
  };
}

/** Wraps the real repository and records every attachContent call. */
function recordingRepository() {
  const calls: RecordedAttach[] = [];
  const real = getLearningRepository();
  setLearningRepository(
    withStubs(real, {
      attachContent: (levelId: string, contentId: string, intent: { programId: string }) => {
        calls.push({ levelId, contentId, intent });
        return real.attachContent(levelId, contentId, intent);
      },
    } satisfies Stubs<LearningRepository>),
  );
  return { calls };
}

/**
 * The store's own view of a level's content, read through a fresh repository so
 * that a stub installed by the case under test cannot answer for the truth. A
 * data-derived wait is only a wait if the expectation comes from somewhere other
 * than the thing being stubbed.
 */
function truth(): LearningRepository {
  return new DemoLearningRepository();
}

/** Waits for the surface to show the repository's own rows for this level. */
async function waitForRows(levelId: string): Promise<LearningContent[]> {
  const repository = truth();
  return waitFor(async () => {
    const linked = await repository.listContent({ levelId, per_page: 200 });
    expect(rows()).toHaveLength(linked.data.length);
    for (const content of linked.data) {
      expect(rowTitles().some((title) => title.includes(content.title))).toBe(true);
    }
    return linked.data;
  });
}

/* ------------------------------------------------------------------ */

describe("M3 assignment surface — states", () => {
  it("shows an in-flight state while the level's content is being read, and no false empty", async () => {
    const level = await freshLevel();
    const controlled = controlledContent();
    mountPanel({ levelId: level.id, levelName: level.name });

    expect(controlled.asked(level.id)).toBe(true);
    expect(controlled.asked("*")).toBe(true);

    // The honest in-flight state, and nothing that claims a settled answer.
    expect(screen.getByText("در حال بارگذاری منابع این سطح…")).toBeTruthy();
    expect(screen.queryByText("منبعی به این سطح متصل نیست")).toBeNull();
    // The count is withheld rather than announcing «۰ منبع» for a level whose
    // read has not answered — the same false count I13 was about.
    expect(headingText()).not.toContain("منبع");
    expect(headingText()).toContain(level.name);
    // The picker is disabled and says it is loading instead of offering rows.
    expect(picker().disabled).toBe(true);
    expect(pickerLabels()).toEqual(["در حال بارگذاری منابع…"]);
    expect(attachButton().disabled).toBe(true);
    expect(rows()).toHaveLength(0);

    await controlled.settle(level.id);
    await controlled.settle("*");
    await waitFor(() =>
      expect(screen.queryByText("در حال بارگذاری منابع این سطح…")).toBeNull(),
    );
    expectNoArtefacts();
  });

  it("renders an honest empty state for a level that has no content linked", async () => {
    const level = await freshLevel();
    mountPanel({ levelId: level.id, levelName: level.name });

    await waitFor(() =>
      expect(screen.getByText("منبعی به این سطح متصل نیست")).toBeTruthy(),
    );
    expect(rows()).toHaveLength(0);
    expect(headingText()).toContain("— ۰ منبع");
    // Empty is a state, not an absence of the surface: the picker still offers
    // the catalogue, because there is something to attach.
    const catalogue = await someContent(3);
    expect(picker().disabled).toBe(false);
    for (const content of catalogue) {
      expect(pickerLabels().some((label) => label.includes(content.title))).toBe(true);
    }
    expectNoArtefacts();
  });

  it("lists exactly the content the repository holds for this level", async () => {
    // A seeded level that already has links, chosen from the link table rather
    // than guessed: the rows must match the repository, not merely be non-empty.
    const links = await getLearningRepository().listLinks();
    expect(links.length).toBeGreaterThan(0);
    const levelId = links[0].levelId;
    const level = await getLearningRepository().getLevel(levelId);
    const program = await getLearningRepository().getProgram(level.programId);
    const linked = await getLearningRepository().listContent({ levelId, per_page: 200 });
    expect(linked.data.length).toBeGreaterThan(0);

    mountPanel({
      levelId,
      levelName: level.name,
      programId: program.id,
      programName: program.name,
    });
    await waitForRows(levelId);

    expect(headingText()).toContain(program.name);
    expect(headingText()).toContain(level.name);
    // Content already linked is not offered again — presentation, while the
    // repository still owns the duplicate refusal.
    for (const content of linked.data) {
      expect(pickerLabels().some((label) => label.includes(content.title))).toBe(false);
    }
    expectNoArtefacts();
  });

  it("reports a failed read as an error with a retry, not as an empty level", async () => {
    const level = await freshLevel();
    const controlled = controlledContent();
    mountPanel({ levelId: level.id, levelName: level.name });

    await controlled.settle("*");
    controlled.fail(
      level.id,
      new ApiError({ kind: "server", code: "SERVER", message: "خواندن منابع ممکن نشد." }),
    );

    await waitFor(() =>
      expect(screen.getByText("بارگذاری منابع این سطح ناموفق بود")).toBeTruthy(),
    );
    expect(screen.getByText("خواندن منابع ممکن نشد.")).toBeTruthy();
    expect(screen.queryByText("منبعی به این سطح متصل نیست")).toBeNull();
    expect(rows()).toHaveLength(0);
    expect(screen.getByRole("button", { name: /تلاش دوباره|بازیابی/ })).toBeTruthy();
  });

  it("reports a failed catalogue read as unreadable, never as nothing left to attach", async () => {
    const level = await freshLevel();
    const [linked, spare] = await someContent(2);
    await getLearningRepository().attachContent(level.id, linked.id, {
      programId: PROGRAM.id,
    });

    const real = getLearningRepository();
    const cause = new ApiError({
      kind: "server",
      code: "SERVER",
      message: "فهرست منابع خوانده نشد.",
    });
    let catalogueFails = true;
    setLearningRepository(
      withStubs(real, {
        // Only the catalogue read fails — the one without a `levelId`. The
        // level's own links keep answering, so the two reads' states can be told
        // apart instead of collapsing into one "the surface failed".
        listContent: (params: { levelId?: string; per_page?: number } = {}) =>
          params.levelId === undefined && catalogueFails
            ? Promise.reject(cause)
            : real.listContent(params),
      } satisfies Stubs<LearningRepository>),
    );

    mountPanel({ levelId: level.id, levelName: level.name });

    // The level's links are unaffected by the catalogue's failure.
    await waitForRows(level.id);
    expect(rowTitles().some((title) => title.includes(linked.title))).toBe(true);

    // The defect this case exists for, asserted first so that a reversion names
    // it: the copy claiming "nothing is left to attach" must be absent, because
    // a read that failed is not a read that found nothing.
    expect(screen.queryByText("منبعی برای اتصال باقی نمانده")).toBeNull();
    // No offer exists and no submit exists — not merely disabled. A write cannot
    // be attempted against a read that has not answered.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /اتصال/ })).toHaveLength(0);
    expect(await truth().listLinks(level.id)).toHaveLength(1);

    // What is shown instead: the failure, in its own words.
    expect(screen.getByText("فهرست منابع قابل اتصال خوانده نشد")).toBeTruthy();
    expect(screen.getByText("فهرست منابع خوانده نشد.")).toBeTruthy();
    expectNoArtefacts();

    // Retry is offered, and it is real: once the read answers, the offers come
    // back from the repository — the unlinked item, and not the linked one.
    catalogueFails = false;
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    await waitFor(() =>
      expect(pickerLabels().some((label) => label.includes(spare.title))).toBe(true),
    );
    expect(pickerLabels().some((label) => label.includes(linked.title))).toBe(false);
    expect(screen.queryByText("فهرست منابع قابل اتصال خوانده نشد")).toBeNull();
    // Restored, and still honest: nothing is picked, so nothing can be written.
    expect(picker().value).toBe("");
    expect(attachButton().disabled).toBe(true);
  });
});

describe("M3 assignment surface — writes", () => {
  it("attaches the picked content through the repository and shows the link it really created", async () => {
    const level = await freshLevel();
    const [content] = await someContent(1);
    mountPanel({ levelId: level.id, levelName: level.name });
    await waitForRows(level.id);

    fireEvent.change(picker(), { target: { value: content.id } });
    expect(attachButton().disabled).toBe(false);
    fireEvent.click(attachButton());

    // Success is reported only because the write resolved, and the row appears
    // because the repository re-read — nothing here keeps a private copy.
    await waitFor(() => expect(toast()).toContain("به این سطح متصل شد"));
    expect(toast()).toContain(content.title);
    expect(toast()).not.toContain("انجام نشد");

    const links = await getLearningRepository().listLinks(level.id);
    expect(links.some((link) => link.contentId === content.id)).toBe(true);
    await waitForRows(level.id);
    expect(rowTitles().some((title) => title.includes(content.title))).toBe(true);
    // The picker resets, and the item just linked is no longer offered.
    expect(picker().value).toBe("");
    expect(pickerLabels().some((label) => label.includes(content.title))).toBe(false);
    expectNoArtefacts();
  });

  it("surfaces the repository's own duplicate refusal, with no false success", async () => {
    const level = await freshLevel();
    const [content] = await someContent(1);

    // A read that lags the link table, so the picker still offers an item that
    // is already linked. This is the race the repository's conflict exists for:
    // the surface must report the refusal, not invent a second link or claim
    // success.
    const lagging = await getLearningRepository().listContent({ levelId: level.id, per_page: 200 });
    const real = getLearningRepository();
    setLearningRepository(
      withStubs(real, {
        listContent: (params: { levelId?: string; per_page?: number } = {}) =>
          params.levelId === level.id
            ? Promise.resolve(lagging)
            : real.listContent(params),
      } satisfies Stubs<LearningRepository>),
    );

    mountPanel({ levelId: level.id, levelName: level.name });
    await waitFor(() => expect(picker().disabled).toBe(false));

    // First attach really happens; the lagging read keeps offering it after.
    fireEvent.change(picker(), { target: { value: content.id } });
    fireEvent.click(attachButton());
    await waitFor(() => expect(toast()).toContain("به این سطح متصل شد"));

    fireEvent.change(picker(), { target: { value: content.id } });
    fireEvent.click(attachButton());

    await waitFor(() => expect(toast()).toContain("اتصال منبع انجام نشد"));
    // The repository's own Persian message, unedited.
    expect(toast()).toContain("این محتوا از قبل به این سطح متصل است.");
    const links = await getLearningRepository().listLinks(level.id);
    expect(links.filter((link) => link.contentId === content.id)).toHaveLength(1);
  });

  it("reports a failed attach honestly and leaves the list as the repository holds it", async () => {
    const level = await freshLevel();
    const [content] = await someContent(1);
    const real = getLearningRepository();
    setLearningRepository(
      withStubs(real, {
        attachContent: () =>
          Promise.reject(
            new ApiError({ kind: "server", code: "SERVER", message: "ذخیرهٔ پیوند ممکن نشد." }),
          ),
      } satisfies Stubs<LearningRepository>),
    );

    mountPanel({ levelId: level.id, levelName: level.name });
    await waitForRows(level.id);
    const before = rows().length;

    fireEvent.change(picker(), { target: { value: content.id } });
    fireEvent.click(attachButton());

    await waitFor(() => expect(toast()).toContain("اتصال منبع انجام نشد"));
    expect(toast()).toContain("ذخیرهٔ پیوند ممکن نشد.");
    // No false success, and no optimistic row: the list is the repository's.
    expect(toast()).not.toContain("متصل شد");
    expect(rows()).toHaveLength(before);
    expect(await real.listLinks(level.id)).toHaveLength(0);
    expect(attachButton().disabled).toBe(false);
  });

  it("detaches a link without deleting the content", async () => {
    const level = await freshLevel();
    const [content] = await someContent(1);
    await getLearningRepository().attachContent(level.id, content.id, {
      programId: PROGRAM.id,
    });

    mountPanel({ levelId: level.id, levelName: level.name });
    await waitForRows(level.id);

    fireEvent.click(within(rows()[0]).getByRole("button", { name: "جدا کردن" }));

    await waitFor(() => expect(toast()).toContain("از این سطح جدا شد"));
    expect(await getLearningRepository().listLinks(level.id)).toHaveLength(0);
    // The content itself survives — detaching removes the edge, not the record.
    expect(await getLearningRepository().getContent(content.id)).toBeDefined();
    await waitFor(() => expect(screen.getByText("منبعی به این سطح متصل نیست")).toBeTruthy());
  });
});

describe("M3 assignment surface — the write invariant", () => {
  it("hands the repository the independently selected program, not the row's own programId", async () => {
    const level = await freshLevel("pg_violin", "سطح آزمایشی ویولن");
    const [content] = await someContent(1);
    const { calls } = recordingRepository();

    mountPanel({
      levelId: level.id,
      levelName: level.name,
      programId: "pg_violin",
      programName: "ویولن کلاسیک",
    });
    await waitForRows(level.id);

    fireEvent.change(picker(), { target: { value: content.id } });
    fireEvent.click(attachButton());
    await waitFor(() => expect(calls).toHaveLength(1));

    expect(calls[0].levelId).toBe(level.id);
    expect(calls[0].contentId).toBe(content.id);
    expect(calls[0].intent).toEqual({ programId: "pg_violin" });
    // The level really does belong to that program, so this is the honest case;
    // the value is asserted to have come from the prop, which the crossing case
    // below proves is not the row's own field.
    expect((await getLearningRepository().getLevel(level.id)).programId).toBe("pg_violin");
    await waitFor(() => expect(toast()).toContain("به این سطح متصل شد"));
  });

  it("ADVERSARIAL: a rendered target and a crossing program intent cannot silently write", async () => {
    // The level belongs to piano; the program the UI selected is violin. This is
    // exactly the pairing a stale row would produce — a level rendered from one
    // program's query under another program's selection.
    const pianoLevel = await getLearningRepository().getLevel("lv_piano_2");
    expect(pianoLevel.programId).toBe("pg_piano");
    const [content] = await someContent(1);
    // This level already carries seeded links, so "nothing was written" has to
    // mean UNCHANGED rather than empty.
    const linksBefore = await getLearningRepository().listLinks(pianoLevel.id);
    const { calls } = recordingRepository();

    mountPanel({
      levelId: pianoLevel.id,
      levelName: pianoLevel.name,
      programId: "pg_violin",
      programName: "ویولن کلاسیک",
    });
    await waitForRows(pianoLevel.id);

    fireEvent.change(picker(), { target: { value: content.id } });
    fireEvent.click(attachButton());

    await waitFor(() => expect(calls).toHaveLength(1));
    // The intent that reached the repository is the independent selection, NOT
    // the row's own programId. Passing level.programId here would have made the
    // guard a tautology and the write would have succeeded.
    expect(calls[0].intent.programId).toBe("pg_violin");
    expect(calls[0].intent.programId).not.toBe(pianoLevel.programId);

    // And the guard refused it: the repository's own message, no success, no link.
    await waitFor(() => expect(toast()).toContain("اتصال منبع انجام نشد"));
    expect(toast()).toContain("سطح انتخاب‌شده به این برنامه تعلق ندارد.");
    expect(toast()).not.toContain("متصل شد");
    const linksAfter = await getLearningRepository().listLinks(pianoLevel.id);
    expect(linksAfter.map((link) => link.id)).toEqual(linksBefore.map((link) => link.id));
    expect(linksAfter.some((link) => link.contentId === content.id)).toBe(false);
    // And the rows on screen are still the level's own, unchanged by the attempt.
    expect(rows()).toHaveLength(linksBefore.length);
  });

  it("never lets a level switch expose the previous level's rows or become its write target", async () => {
    const first = await freshLevel(PROGRAM.id, "سطح نخست");
    const second = await freshLevel(PROGRAM.id, "سطح دوم");
    const [content] = await someContent(1);
    // Linked to the SECOND level: after the switch it is already linked there,
    // so a pick of it made under the first level must not survive as this
    // level's write target.
    await getLearningRepository().attachContent(second.id, content.id, {
      programId: PROGRAM.id,
    });
    const { calls } = recordingRepository();

    const panel = mountPanel({ levelId: first.id, levelName: first.name });
    await waitForRows(first.id);
    expect(screen.getByText("منبعی به این سطح متصل نیست")).toBeTruthy();

    // The pick is legitimate here: the content is unlinked for THIS level.
    await waitFor(() => expect(picker().disabled).toBe(false));
    fireEvent.change(picker(), { target: { value: content.id } });
    expect(picker().value).toBe(content.id);
    expect(attachButton().disabled).toBe(false);

    // Hold the new level's read open: this is the window in which a stale row
    // would otherwise still be on screen, still armed.
    const controlled = controlledContent();
    panel.switchTo({ levelId: second.id, levelName: second.name });

    expect(controlled.asked(second.id)).toBe(true);
    expect(screen.getByText("در حال بارگذاری منابع این سطح…")).toBeTruthy();
    expect(headingText()).toContain(second.name);
    // No settled claim of any kind mid-switch: no rows, no count, no false empty.
    expect(rows()).toHaveLength(0);
    expect(headingText()).not.toContain("— ");
    expect(screen.queryByText("منبعی به این سطح متصل نیست")).toBeNull();
    // Nothing can be written mid-switch: the picker is empty and disabled.
    expect(picker().disabled).toBe(true);
    expect(picker().value).toBe("");
    expect(attachButton().disabled).toBe(true);

    await controlled.settle(second.id);
    await controlled.settle("*");
    await waitForRows(second.id);
    expect(rowTitles().some((title) => title.includes(content.title))).toBe(true);

    // The pick made under the first level did not survive: the value the attach
    // button uses is DERIVED from this level's available rows, and this content
    // is already linked here, so it collapses to nothing instead of becoming a
    // write target for a level it was not chosen for.
    expect(pickerLabels().some((label) => label.includes(content.title))).toBe(false);
    expect(picker().value).toBe("");
    expect(attachButton().disabled).toBe(true);
    fireEvent.click(attachButton());
    expect(calls).toHaveLength(0);
    expect(await truth().listLinks(second.id)).toHaveLength(1);
  });
});
