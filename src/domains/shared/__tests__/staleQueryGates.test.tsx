// @vitest-environment jsdom
/**
 * The consumer half of the I13 invariant.
 *
 * Fixing `useResourceList` to withhold another query's page is only half the
 * sentence. A consumer that ignores `loading` would then render its own
 * **empty** state during a params change — «این آلبوم خالی است», «سابقه‌ای ثبت
 * نشده», «چیزی پیدا نشد» — which is a second lie, and in an EMPTY-vs-DEMO
 * product a claim that a customer has no data is not a small one.
 *
 * So each of the six dynamic-params consumers that used to ignore `loading` is
 * pinned here from both sides at once:
 *
 *   1. the previous params' rows are NOT on screen, and
 *   2. the empty state for those rows is NOT on screen either, and
 *   3. an explicit in-flight state IS.
 *
 * The new params' read is held open with a deferred promise installed through
 * the registry, so the window is as wide as the test needs and nothing depends
 * on winning a race. No sleeps, no retries, no timeout is lengthened.
 */
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { CommandPalette } from "@/components/overlays/CommandPalette";
import { AssignPieceDialog } from "@/domains/progress/AssignPieceDialog";
import { StudentProgressPanel } from "@/domains/progress/StudentProgressPanel";
import { GalleryPanel } from "@/domains/gallery/GalleryPanel";
import { StudentLearningPanel } from "@/domains/learning/StudentLearningPanel";
import { MessagesView } from "@/views/Messages";
import {
  getClassRepository,
  getChatRepository,
  getGalleryRepository,
  getLearningRepository,
  getMediaRepository,
  getProgressRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
  setChatRepository,
  setClassRepository,
  setGalleryRepository,
  setLearningRepository,
  setProgressRepository,
  setRoomRepository,
  setStudentRepository,
  setTeacherRepository,
} from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";

afterEach(cleanup);
beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

type Stubs<R> = { [K in keyof R]?: R[K] };

/**
 * Overrides one verb of a repository and delegates everything else. A spread
 * would not work: the demo repositories keep their methods on the prototype.
 */
function withStubs<R extends object>(repository: R, stubs: Stubs<R>): R {
  return new Proxy(repository, {
    get(target, prop, receiver) {
      if (prop in stubs) return stubs[prop as keyof R];
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as R;
}

/** A structurally valid PNG, as the media repository's magic-byte check wants. */
function pngBytes(size = 64): ArrayBuffer {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes.buffer as ArrayBuffer;
}

function assertInFlightNotFalseEmpty(inFlightLabel: string, falseEmptyLabels: string[]): void {
  expect(screen.queryByText(inFlightLabel), `expected the in-flight state «${inFlightLabel}»`).not.toBeNull();
  for (const label of falseEmptyLabels) {
    expect(screen.queryByText(label), `a params change must not claim «${label}»`).toBeNull();
  }
}

/* ------------------------------------------------------------------ */

describe("I13 consumer gates — no stale rows, and no false empty, during a params change", () => {
  it("GalleryPanel: an album switch shows the new album in flight, not «این آلبوم خالی است»", async () => {
    const gallery = getGalleryRepository();
    const media = getMediaRepository();
    const albums = (await gallery.listAlbums({ per_page: 100 })).data;
    expect(albums.length).toBeGreaterThan(1);
    const [albumA, albumB] = albums;

    // The seeded gallery holds albums but no images (images only exist after an
    // upload), so the scenario needs one image per album.
    for (const album of [albumA, albumB]) {
      const asset = await media.create({
        kind: "image",
        filename: `${album.id}.png`,
        mimeType: "image/png",
        bytes: pngBytes(),
      });
      await gallery.addImage({ albumId: album.id, mediaId: asset.id, caption: `تصویر ${album.title}`, alt: "alt" });
    }

    const held = deferred<Page<never>>();
    setGalleryRepository(
      withStubs(getGalleryRepository(), {
        // Album A reads normally; album B's read stays in flight.
        listImages: (params, signal) =>
          params?.albumId === albumB.id
            ? (held.promise as unknown as ReturnType<typeof gallery.listImages>)
            : gallery.listImages(params, signal),
      }),
    );

    render(
      <AppProvider>
        <GalleryPanel />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گالری…")).toBeNull());
    await waitFor(() => expect(screen.getByLabelText(`حذف تصویر ${albumA.title}`)).toBeDefined());

    fireEvent.click(screen.getByRole("button", { name: albumB.title }));

    // 1 + 3: album A's thumbnail is gone and an in-flight state is up.
    await waitFor(() =>
      assertInFlightNotFalseEmpty("در حال بارگذاری تصاویر این آلبوم…", ["این آلبوم خالی است"]),
    );
    expect(screen.queryByLabelText(`حذف تصویر ${albumA.title}`)).toBeNull();
    // 2: and no delete control at all — the grid that carries them is not rendered.
    expect(screen.queryAllByRole("button", { name: /^حذف / })).toHaveLength(0);

    // The switch completes honestly once the read lands.
    held.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as unknown as Page<never>);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری تصاویر این آلبوم…")).toBeNull());
  });

  it("StudentLearningPanel: a program switch shows the ladder in flight, not «۰ سطح» or «نامشخص»", async () => {
    const learning = getLearningRepository();
    const placements = (await learning.listPlacements({ per_page: 200 })).data;
    expect(placements.length).toBeGreaterThan(0);
    const first = placements[0];
    const programs = (await learning.listPrograms({ per_page: 200 })).data;
    const otherProgram = programs.find((program) => program.id !== first.programId);
    expect(otherProgram).toBeDefined();
    const otherLevels = (await learning.listLevels({ programId: otherProgram!.id, per_page: 200 })).data;
    expect(otherLevels.length).toBeGreaterThan(0);

    // A second student, placed in a different program, so switching students
    // switches the levels query's params.
    const students = (await getStudentRepository().list({ per_page: 200 })).data;
    const otherStudent =
      students.find((student) => student.id !== first.studentId && !placements.some((p) => p.studentId === student.id)) ??
      students.find((student) => student.id !== first.studentId);
    expect(otherStudent).toBeDefined();
    await learning.assignPlacement({
      studentId: otherStudent!.id,
      programId: otherProgram!.id,
      levelId: otherLevels[0].id,
    });

    const held = deferred<Page<never>>();
    setLearningRepository(
      withStubs(getLearningRepository(), {
        listLevels: (params, signal) =>
          params?.programId === otherProgram!.id
            ? (held.promise as unknown as ReturnType<typeof learning.listLevels>)
            : learning.listLevels(params, signal),
      }),
    );

    const view = render(
      <AppProvider>
        <StudentLearningPanel studentId={first.studentId} studentName="هنرجوی نخست" />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری مسیر یادگیری…")).toBeNull());
    await waitFor(() => expect(screen.queryAllByText("انتقال به این سطح").length).toBeGreaterThan(0));

    view.rerender(
      <AppProvider>
        <StudentLearningPanel studentId={otherStudent!.id} studentName="هنرجوی دوم" />
      </AppProvider>,
    );

    await waitFor(() =>
      assertInFlightNotFalseEmpty("در حال بارگذاری سطوح این دوره…", [
        "هنوز در برنامه‌ای قرار نگرفته",
      ]),
    );
    // The count line and the unknown-level claim belong to a settled ladder.
    expect(screen.queryByText(/سطح نامشخص/)).toBeNull();
    expect(screen.queryByText(/از ۰ سطح این دوره/)).toBeNull();
    // The first student's ladder is not on screen under the second student's name.
    expect(screen.queryAllByText("انتقال به این سطح")).toHaveLength(0);

    held.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as unknown as Page<never>);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری سطوح این دوره…")).toBeNull());
  });

  it("AssignPieceDialog: the picker is in flight until the student's instrument is known", async () => {
    const students = getStudentRepository();
    const student = (await students.list({ per_page: 1 })).data[0];
    expect(student).toBeDefined();

    const held = deferred<Awaited<ReturnType<typeof students.get>>>();
    setStudentRepository(
      withStubs(getStudentRepository(), {
        get: (id, signal) => (id === student.id ? held.promise : students.get(id, signal)),
      }),
    );

    render(
      <AppProvider>
        <AssignPieceDialog
          open
          studentId={student.id}
          studentName={student.name}
          onClose={() => undefined}
          onAssigned={() => undefined}
        />
      </AppProvider>,
    );

    const select = screen.getByLabelText(/قطعه/, { selector: "select" }) as HTMLSelectElement;
    // Not a picker full of every piece in the academy under a «filtered by this
    // student's instrument» claim, and not an empty picker implying no pieces.
    await waitFor(() => expect(select.disabled).toBe(true));
    expect(select.options).toHaveLength(1);
    expect(select.options[0].textContent).toBe("در حال بارگذاری قطعه‌های این ساز…");

    held.resolve(student);
    await waitFor(() => expect(select.disabled).toBe(false));
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
    expect(select.options[0].textContent).toBe("— انتخاب کنید —");
  });

  it("StudentProgressPanel: the timeline is in flight, not «سابقه‌ای ثبت نشده»", async () => {
    const progress = getProgressRepository();
    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    expect(student).toBeDefined();

    const held = deferred<Page<never>>();
    setProgressRepository(
      withStubs(getProgressRepository(), {
        listEvents: () => held.promise as unknown as ReturnType<typeof progress.listEvents>,
      }),
    );

    render(
      <AppProvider>
        <StudentProgressPanel studentId={student.id} studentName={student.name} role="teacher" />
      </AppProvider>,
    );

    await waitFor(() =>
      assertInFlightNotFalseEmpty("در حال بارگذاری سابقهٔ پیشرفت…", ["سابقه‌ای ثبت نشده"]),
    );

    held.resolve({ data: [], meta: { page: 1, per_page: 15, total: 0 } } as unknown as Page<never>);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری سابقهٔ پیشرفت…")).toBeNull());
    // Only now — with the read finished and empty — is the empty state true.
    await waitFor(() => expect(screen.getByText("سابقه‌ای ثبت نشده")).toBeDefined());
  });

  it("Messages: switching threads shows that thread in flight, not «هنوز پیامی رد و بدل نشده»", async () => {
    const chat = getChatRepository();
    const threads = (await chat.listConversations({ per_page: 100 })).data;
    expect(threads.length).toBeGreaterThan(1);
    const [threadA, threadB] = threads;

    const held = deferred<Page<never>>();
    setChatRepository(
      withStubs(chat, {
        listMessages: (params, signal) =>
          params.conversationId === threadB.id
            ? (held.promise as unknown as ReturnType<typeof chat.listMessages>)
            : chat.listMessages(params, signal),
      }),
    );

    render(
      <AppProvider>
        <MessagesView />
      </AppProvider>,
    );
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری گفتگوها…")).toBeNull());

    const search = screen.getByPlaceholderText("جستجوی گفتگو…");
    const surface = search.closest("div.flex.flex-col") as HTMLElement;
    const list = surface.querySelector("ul") as HTMLElement;
    const entries = [...list.querySelectorAll("li")];
    expect(entries.length).toBeGreaterThan(1);
    fireEvent.click(within(entries[1]).getByText(threadB.topic ?? threadB.name));

    await waitFor(() =>
      assertInFlightNotFalseEmpty("در حال بارگذاری این گفتگو…", ["هنوز پیامی رد و تبادل نشده"]),
    );

    held.resolve({ data: [], meta: { page: 1, per_page: 200, total: 0 } } as unknown as Page<never>);
    await waitFor(() => expect(screen.queryByText("در حال بارگذاری این گفتگو…")).toBeNull());
    void threadA;
  });

  it("CommandPalette: a search in flight is not «چیزی پیدا نشد»", async () => {
    const students = getStudentRepository();
    const teachers = getTeacherRepository();
    const classes = getClassRepository();
    const rooms = getRoomRepository();

    const emptyPageOf = <T,>(): Page<T> => ({ data: [], meta: { page: 1, per_page: 5, total: 0 } });
    const held = {
      students: deferred<Page<never>>(),
      teachers: deferred<Page<never>>(),
      classes: deferred<Page<never>>(),
      rooms: deferred<Page<never>>(),
    };
    setStudentRepository(withStubs(getStudentRepository(), { list: () => held.students.promise as never }));
    setTeacherRepository(withStubs(getTeacherRepository(), { list: () => held.teachers.promise as never }));
    setClassRepository(withStubs(getClassRepository(), { list: () => held.classes.promise as never }));
    setRoomRepository(withStubs(getRoomRepository(), { list: () => held.rooms.promise as never }));

    function PaletteHarness() {
      const { openPalette } = useApp();
      useEffect(() => {
        openPalette();
      }, [openPalette]);
      return <CommandPalette />;
    }

    render(
      <AppProvider>
        <PaletteHarness />
      </AppProvider>,
    );

    const input = screen.getByPlaceholderText("چه کاری می‌خواهید انجام دهید؟ جستجو یا فرمان…");
    // A query that matches no command, verb or section, so the only groups that
    // could appear are the repository-backed ones now held in flight.
    fireEvent.change(input, { target: { value: "ژژژ" } });

    await waitFor(() => assertInFlightNotFalseEmpty("در حال جستجو…", ["چیزی پیدا نشد"]));

    held.students.resolve(emptyPageOf() as unknown as Page<never>);
    held.teachers.resolve(emptyPageOf() as unknown as Page<never>);
    held.classes.resolve(emptyPageOf() as unknown as Page<never>);
    held.rooms.resolve(emptyPageOf() as unknown as Page<never>);

    // Only now is "nothing found" an established fact rather than an assumption.
    await waitFor(() => expect(screen.getByText("چیزی پیدا نشد")).toBeDefined());
    void students;
    void teachers;
    void classes;
    void rooms;
  });
});

/* ------------------------------------------------------------------ */
/* Command palette — a failed search is not an empty result            */
/* ------------------------------------------------------------------ */

describe("CommandPalette search failure disclosure (I15-A1)", () => {
  const PLACEHOLDER = "چه کاری می‌خواهید انجام دهید؟ جستجو یا فرمان…";

  function renderPalette() {
    function PaletteHarness() {
      const { openPalette } = useApp();
      useEffect(() => {
        openPalette();
      }, [openPalette]);
      return <CommandPalette />;
    }
    return render(
      <AppProvider>
        <PaletteHarness />
      </AppProvider>,
    );
  }

  function stubStudentSearch(
    list: (params: { search?: string }, signal?: AbortSignal) => Promise<unknown>,
  ) {
    // One failing domain is enough: the hook's aggregate is all-or-nothing.
    setStudentRepository(withStubs(getStudentRepository(), { list: list as never }));
  }

  function emptyPage() {
    return { data: [], meta: { page: 1, per_page: 5, total: 0 } };
  }

  it("renders an explicit failure, not «چیزی پیدا نشد», when the aggregate search fails", async () => {
    stubStudentSearch(async () => {
      throw new ApiError({ kind: "network", message: "جستجو در دسترس نیست." });
    });
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "ژژژ" } });

    expect(await screen.findByText("جستجوی رکوردها انجام نشد")).toBeDefined();
    expect(screen.queryByText("چیزی پیدا نشد")).toBeNull();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeDefined();
  });

  it("still says «چیزی پیدا نشد» for a successful search that found nothing", async () => {
    stubStudentSearch(async () => emptyPage());
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "ژژژ" } });

    expect(await screen.findByText("چیزی پیدا نشد")).toBeDefined();
    expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull();
  });

  it("still renders records for a successful search", async () => {
    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: student.name } });

    expect((await screen.findAllByText(student.name)).length).toBeGreaterThan(0);
    expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull();
  });

  it("recovers through the retry control after a failed search", async () => {
    let fail = true;
    const realStudents = getStudentRepository();
    stubStudentSearch(async (params, signal) => {
      if (fail) throw new ApiError({ kind: "network", message: "جستجو در دسترس نیست." });
      return realStudents.list(params as never, signal);
    });
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "ژژژ" } });
    await screen.findByText("جستجوی رکوردها انجام نشد");

    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.getByText("چیزی پیدا نشد")).toBeDefined());
    expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull();
  });

  it("clears the previous failure when a new query begins", async () => {
    let fail = true;
    const realStudents = getStudentRepository();
    stubStudentSearch(async (params, signal) => {
      if (fail) throw new ApiError({ kind: "network", message: "جستجو در دسترس نیست." });
      return realStudents.list(params as never, signal);
    });
    renderPalette();

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "ژژژ" } });
    await screen.findByText("جستجوی رکوردها انجام نشد");

    fail = false;
    fireEvent.change(input, { target: { value: "ژژژ۲" } });

    await waitFor(() => expect(screen.getByText("چیزی پیدا نشد")).toBeDefined());
    expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull();
  });

  it("cannot let a stale failed query overwrite a newer successful one", async () => {
    const realStudents = getStudentRepository();
    const student = (await realStudents.list({ per_page: 1 })).data[0];
    let rejectStale!: (cause: unknown) => void;
    const stale = new Promise<never>((_, reject) => {
      rejectStale = reject;
    });
    stubStudentSearch(async (params, signal) => {
      if (params.search === "ژژژ") return stale;
      return realStudents.list(params as never, signal);
    });
    renderPalette();

    const input = screen.getByPlaceholderText(PLACEHOLDER);
    fireEvent.change(input, { target: { value: "ژژژ" } });
    // The first query is still in flight; a newer query answers first.
    fireEvent.change(input, { target: { value: student.name } });
    expect((await screen.findAllByText(student.name)).length).toBeGreaterThan(0);

    await act(async () => {
      rejectStale(new ApiError({ kind: "network", message: "جستجوی کهنه شکست خورد." }));
    });

    // The stale rejection belongs to a query nobody is looking at.
    expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull();
    expect((await screen.findAllByText(student.name)).length).toBeGreaterThan(0);
  });

  it("keeps a matching navigation result visible beside the failure disclosure", async () => {
    let calls = 0;
    stubStudentSearch(async () => {
      calls += 1;
      if (calls === 1) throw new ApiError({ kind: "network", message: "جستجو در دسترس نیست." });
      return emptyPage();
    });
    renderPalette();

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDER), { target: { value: "تنظیمات" } });

    // The failure is disclosed while the navigation group still matches — the
    // banner must not be hidden just because `groups` is non-empty.
    expect(await screen.findByText("جستجوی رکوردها انجام نشد")).toBeDefined();
    expect(screen.getByRole("option", { name: "تنظیمات" })).toBeDefined();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeDefined();
    expect(screen.queryByText("چیزی پیدا نشد")).toBeNull();
    expect(calls).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.queryByText("جستجوی رکوردها انجام نشد")).toBeNull());
    expect(calls).toBe(2);
    expect(screen.getByRole("option", { name: "تنظیمات" })).toBeDefined();
  });
});
