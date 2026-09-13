// @vitest-environment jsdom
/**
 * H6 — an edit form must open on the record it is editing.
 *
 * `useEntityForm` seeded its draft with `useState(initial)` and nothing ever
 * re-synced it. Entity dialogs stay mounted while closed (`if (!open) return
 * null` runs *after* the hooks) and no parent keys them by record, so the draft
 * belonged to whatever the form saw when it first mounted — the empty create
 * defaults — and then kept whatever was typed afterwards. Two consequences,
 * both silent and both durable:
 *
 *   1. Opening an edit showed blank or *default* fields under a title naming the
 *      record, and submitting wrote those defaults over the stored values.
 *      Defaults are the dangerous part: «piano», «active», «17:00», capacity 6
 *      all look like data, so nothing on screen suggests anything was lost.
 *      Because `demoStore`'s update is a spread merge and its `clone` is
 *      `structuredClone`, an explicit `undefined` in the payload *erases* the
 *      stored field — a student's photo and guardian, a teacher's bio, a piece's
 *      programme link.
 *   2. Cancelling an edit of record A and opening record B still showed A's
 *      typed values, so saving wrote A's data onto B's id.
 *
 * The fix sits at the hook boundary (`open` in `EntityFormOptions`): the draft is
 * rebuilt from `initial` whenever the surface opens. These cases therefore drive
 * the production sequence exactly — mount closed with no record, *then* open on a
 * record — which is also why no earlier test caught the defect: a dialog
 * rendered with its record already present is the one path that always worked.
 *
 * Three assertions per entity, as the fix requires:
 *   · the form opens on the record's own values, not on create defaults;
 *   · changing one field preserves every other field **in the store**;
 *   · A → cancel → B cannot carry A's draft into B.
 *
 * The records are real: each case patches two seeded rows through the real
 * repositories so that every editable field differs from the create default, and
 * reads them back through the same repositories. Nothing is asserted about the
 * draft object itself — only about what the operator sees and what gets stored.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import {
  getClassRepository,
  getInstrumentRepository,
  getProgressRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
} from "@/domains/registry";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { StudentFormDialog } from "@/domains/students/StudentFormDialog";
import { TeacherFormDialog } from "@/domains/teachers/TeacherFormDialog";
import { ClassFormDialog } from "@/domains/classes/ClassFormDialog";
import { InstrumentFormDialog } from "@/domains/instruments/InstrumentFormDialog";
import { RoomFormDialog } from "@/domains/rooms/RoomFormDialog";
import { PieceFormDialog } from "@/domains/progress/PieceFormDialog";
import type { AcademyClass, Student, Teacher } from "@/data/records";
import type { InstrumentRecord } from "@/domains/instruments/types";
import type { Room } from "@/domains/rooms/types";
import type { Piece } from "@/domains/progress/types";

/**
 * These cases drive a whole flow — seed, mount, edit, await the write, read the
 * record back — alongside ninety-odd other suites, which is the contention the
 * shared harness documents. A timeout is still a hard failure, never a hidden
 * one.
 */
const FLOW_TIMEOUT = 25_000;

/** Every dialog labels its edit submit and its cancel the same way. */
const SUBMIT = "ذخیرهٔ تغییرات";
const CANCEL = "انصراف";

type Selector = "input" | "select" | "textarea";

/** The dialog's own callbacks, counted so a case can tell a write from a no-op. */
interface Handlers {
  onClose: () => void;
  onSaved: () => void;
}

interface EntitySpec<T extends { id: string }> {
  entity: string;
  /** Renders the dialog exactly as its production parent does. */
  dialog: (open: boolean, record: T | undefined, handlers: Handlers) => ReactElement;
  /** Two stored records whose editable fields all differ from the create defaults. */
  prepare: () => Promise<{ a: T; b: T }>;
  /** The name the dialog's title claims to be editing. */
  nameOf: (record: T) => string;
  /** label → the value the form must show for this record. */
  fields: (record: T) => ReadonlyArray<readonly [label: RegExp, expected: string, selector: Selector]>;
  /** role="switch" label → the state the form must show for this record. */
  toggles?: (record: T) => ReadonlyArray<readonly [label: RegExp, checked: boolean]>;
  /** The field typed into A, which must not survive into B. Must be in `preserved`. */
  contaminates: { label: RegExp; selector: Selector; typed: string; own: (record: T) => string };
  /** The single field a case edits. Must be absent from `preserved`. */
  edit: { label: RegExp; selector: Selector; value: string };
  read: (id: string) => Promise<T>;
  /** Asserts the stored fields that an edit touching only `edit` must not change. */
  preserved: (before: T) => (after: T) => void;
}

function makeHandlers() {
  const counts = { closed: 0, saved: 0 };
  const handlers: Handlers = {
    onClose: () => {
      counts.closed += 1;
    },
    onSaved: () => {
      counts.saved += 1;
    },
  };
  return { counts, handlers };
}

/**
 * Reads a field's current value.
 *
 * Pickers are populated from the repositories, so a `<select>` is waited on
 * before being read: until its options arrive, a select whose options do not
 * include the draft's id reports `""` — which would look exactly like the defect
 * these cases are here to detect.
 */
async function readField(label: RegExp, selector: Selector): Promise<string> {
  const field = await screen.findByLabelText(label, { selector });
  if (selector === "select") {
    await waitFor(() => expect(within(field).getAllByRole("option").length).toBeGreaterThan(1), {
      timeout: 8000,
    });
  }
  return (field as HTMLInputElement).value;
}

function describeEntity<T extends { id: string }>(spec: EntitySpec<T>): void {
  describe(`${spec.entity}: the draft belongs to the record being edited`, () => {
    /** The production sequence: mounted and closed with no record, then opened on one. */
    function mountClosed(handlers: Handlers) {
      return render(spec.dialog(false, undefined, handlers));
    }

    it(
      "opens on the record's own values, not on create defaults",
      async () => {
        const { a } = await spec.prepare();
        const { handlers } = makeHandlers();
        const { rerender } = mountClosed(handlers);

        rerender(spec.dialog(true, a, handlers));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent ?? "", "the dialog must say which record it is editing").toContain(
          spec.nameOf(a),
        );

        for (const [label, expected, selector] of spec.fields(a)) {
          expect(await readField(label, selector), `${spec.entity} · ${String(label)}`).toBe(expected);
        }
        for (const [label, checked] of spec.toggles?.(a) ?? []) {
          expect(
            within(dialog).getByRole("switch", { name: label }).getAttribute("aria-checked"),
            `${spec.entity} · ${String(label)}`,
          ).toBe(String(checked));
        }
      },
      FLOW_TIMEOUT,
    );

    it(
      "preserves every untouched field in the store when one field changes",
      async () => {
        const { a } = await spec.prepare();
        const { counts, handlers } = makeHandlers();
        const { rerender } = mountClosed(handlers);

        rerender(spec.dialog(true, a, handlers));
        const dialog = await screen.findByRole("dialog");

        fireEvent.change(await screen.findByLabelText(spec.edit.label, { selector: spec.edit.selector }), {
          target: { value: spec.edit.value },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: SUBMIT }));
        await waitFor(() => expect(counts.saved, "the edit never reached the repository").toBe(1), {
          timeout: 10_000,
        });

        spec.preserved(a)(await spec.read(a.id));
      },
      FLOW_TIMEOUT,
    );

    it(
      "cannot carry one record's draft into the next record",
      async () => {
        const { a, b } = await spec.prepare();
        const { counts, handlers } = makeHandlers();
        const { rerender } = mountClosed(handlers);
        const leak = spec.contaminates;

        // Type into A, then cancel. The parent closes the dialog but — like every
        // parent in this product — keeps it mounted.
        rerender(spec.dialog(true, a, handlers));
        await screen.findByRole("dialog");
        fireEvent.change(await screen.findByLabelText(leak.label, { selector: leak.selector }), {
          target: { value: leak.typed },
        });
        expect(await readField(leak.label, leak.selector), "the case must really have typed into A").toBe(
          leak.typed,
        );

        fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: CANCEL }));
        await waitFor(() => expect(counts.closed, "cancel must reach the parent").toBe(1));
        rerender(spec.dialog(false, a, handlers));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(counts.saved, "cancelling must not write anything").toBe(0);

        // Open B: nothing of A's draft may survive, and B's own values must show.
        rerender(spec.dialog(true, b, handlers));
        const dialog = await screen.findByRole("dialog");
        expect(dialog.textContent ?? "").toContain(spec.nameOf(b));
        expect(
          await readField(leak.label, leak.selector),
          "record A's typing leaked into record B's form",
        ).toBe(leak.own(b));

        // Saving B must write B's data — `preserved` includes the leaked field.
        fireEvent.change(await screen.findByLabelText(spec.edit.label, { selector: spec.edit.selector }), {
          target: { value: spec.edit.value },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: SUBMIT }));
        await waitFor(() => expect(counts.saved, "the edit never reached the repository").toBe(1), {
          timeout: 10_000,
        });
        spec.preserved(b)(await spec.read(b.id));
      },
      FLOW_TIMEOUT,
    );
  });
}

beforeEach(() => {
  window.location.hash = "";
  localStorage.clear();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  // DEMO: the six entities all need seeded rows to edit, and the defect is
  // environment-independent (it lives in the form, not in the data source).
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  window.location.hash = "";
});

/* ------------------------------------------------------------------ */
/* Students                                                            */
/* ------------------------------------------------------------------ */
describeEntity<Student>({
  entity: "student",
  nameOf: (student) => student.name,
  dialog: (open, student, handlers) => (
    <AuthProvider>
      <AppProvider>
        <StudentFormDialog open={open} student={student} onClose={handlers.onClose} onSaved={handlers.onSaved} />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getStudentRepository();
    const { data } = await repository.list({ per_page: 5 });
    const a = await repository.update(data[0].id, {
      instrument: "violin",
      status: "paused",
      level: "سطح ۴ · پیشرفته",
      guardian: "ولی هنرجوی آ",
      sessionsTotal: 31,
      age: 24,
      phone: "09121110011",
    });
    const b = await repository.update(data[1].id, {
      instrument: "drums",
      status: "at-risk",
      level: "سطح ۲ · میانی",
      guardian: "ولی هنرجوی ب",
      sessionsTotal: 17,
      age: 19,
      phone: "09121110022",
    });
    return { a, b };
  },
  fields: (s) => [
    [/نام و نام خانوادگی/, s.name, "input"],
    [/کد ملی/, s.nationalId, "input"],
    [/شمارهٔ تماس/, s.phone, "input"],
    [/سن/, String(s.age), "input"],
    [/سطح/, s.level, "input"],
    [/کل جلسات دوره/, String(s.sessionsTotal), "input"],
    [/ولی \/ سرپرست/, s.guardian ?? "", "input"],
    [/ساز/, s.instrument, "select"],
    [/وضعیت/, s.status, "select"],
    [/مدرس/, s.teacherId, "select"],
  ],
  contaminates: { label: /نام و نام خانوادگی/, selector: "input", typed: "آلودگی هنرجوی آ", own: (s) => s.name },
  edit: { label: /شمارهٔ تماس/, selector: "input", value: "09129990111" },
  read: (id) => getStudentRepository().get(id),
  preserved: (before) => (after) => {
    expect(after.name, "name — the field typed into the other record").toBe(before.name);
    expect(after.nationalId, "nationalId").toBe(before.nationalId);
    expect(after.teacherId, "teacherId").toBe(before.teacherId);
    expect(after.instrument, "instrument — the create default is piano").toBe(before.instrument);
    expect(after.status, "status — the create default is active").toBe(before.status);
    expect(after.level, "level — the create default is «سطح ۱ · پایه»").toBe(before.level);
    expect(after.guardian, "guardian — the create default erases it").toBe(before.guardian);
    expect(after.photoMediaId, "photoMediaId — the create default erases it").toBe(before.photoMediaId);
    expect(after.age, "age").toBe(before.age);
    expect(after.sessionsTotal, "sessionsTotal — the create default is 12").toBe(before.sessionsTotal);
  },
});

/* ------------------------------------------------------------------ */
/* Teachers                                                            */
/* ------------------------------------------------------------------ */
describeEntity<Teacher>({
  entity: "teacher",
  nameOf: (teacher) => teacher.name,
  dialog: (open, teacher, handlers) => (
    <AuthProvider>
      <AppProvider>
        <TeacherFormDialog open={open} teacher={teacher} onClose={handlers.onClose} onSaved={handlers.onSaved} />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getTeacherRepository();
    const { data } = await repository.list({ per_page: 5 });
    const a = await repository.update(data[0].id, {
      instrument: "violin",
      status: "inactive",
      title: "تخصص آ",
      bio: "معرفی مدرس آ",
      contractHours: 9,
    });
    const b = await repository.update(data[1].id, {
      instrument: "drums",
      status: "inactive",
      title: "تخصص ب",
      bio: "معرفی مدرس ب",
      contractHours: 31,
    });
    return { a, b };
  },
  fields: (t) => [
    [/نام و نام خانوادگی/, t.name, "input"],
    // «عنوان» and not «تخصص»: the instrument picker is labelled «ساز تخصصی».
    [/عنوان/, t.title, "input"],
    [/شمارهٔ تماس/, t.phone, "input"],
    [/ساعت قرارداد/, String(t.contractHours), "input"],
    [/یادداشت \/ معرفی/, t.bio ?? "", "textarea"],
    [/ساز تخصصی/, t.instrument, "select"],
    [/وضعیت/, t.status, "select"],
  ],
  contaminates: { label: /نام و نام خانوادگی/, selector: "input", typed: "آلودگی مدرس آ", own: (t) => t.name },
  edit: { label: /شمارهٔ تماس/, selector: "input", value: "09129990222" },
  read: (id) => getTeacherRepository().get(id),
  preserved: (before) => (after) => {
    expect(after.name, "name — the field typed into the other record").toBe(before.name);
    expect(after.title, "title").toBe(before.title);
    expect(after.instrument, "instrument — the create default is piano").toBe(before.instrument);
    expect(after.status, "status — the create default is active").toBe(before.status);
    expect(after.bio, "bio — the create default erases it").toBe(before.bio);
    expect(after.contractHours, "contractHours — the create default is 20").toBe(before.contractHours);
    expect(after.photoMediaId, "photoMediaId — the create default erases it").toBe(before.photoMediaId);
  },
});

/* ------------------------------------------------------------------ */
/* Classes                                                             */
/* ------------------------------------------------------------------ */
describeEntity<AcademyClass>({
  entity: "class",
  nameOf: (academyClass) => academyClass.title,
  dialog: (open, academyClass, handlers) => (
    <AuthProvider>
      <AppProvider>
        <ClassFormDialog
          open={open}
          academyClass={academyClass}
          onClose={handlers.onClose}
          onSaved={handlers.onSaved}
        />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getClassRepository();
    const { data } = await repository.list({ per_page: 5 });
    /*
      `capacity` is deliberately not patched: the repository rejects a capacity
      above the room's and below the current enrollment, so a distinctive value
      here would be a fight with two other entities. `duration` is the edited
      field instead — it has no relational constraint — and capacity is still
      asserted as preserved below (for a row whose seeded capacity happens to
      equal the create default that one assertion is weaker than the rest).
    */
    const a = await repository.update(data[0].id, {
      instrument: "violin",
      // Archived on purpose: the dialog has no control for it, so a stale draft
      // silently un-archives the class through `status`.
      status: "archived",
      kind: "private",
      level: "سطح ۷",
      time: "19:30",
      duration: 75,
      tuition: 5_100_000,
    });
    const b = await repository.update(data[1].id, {
      instrument: "drums",
      status: "active",
      kind: "group",
      level: "سطح ۲",
      time: "08:15",
      duration: 45,
      tuition: 2_400_000,
    });
    return { a, b };
  },
  fields: (c) => [
    [/عنوان کلاس/, c.title, "input"],
    [/ساعت شروع/, c.time, "input"],
    [/مدت/, String(c.duration), "input"],
    [/ظرفیت/, String(c.capacity), "input"],
    [/شهریه/, String(c.tuition), "input"],
    [/سطح/, c.level, "input"],
    [/ساز/, c.instrument, "select"],
    [/نوع کلاس/, c.kind, "select"],
    [/مدرس/, c.teacherId, "select"],
    [/اتاق/, c.roomId, "select"],
  ],
  contaminates: { label: /عنوان کلاس/, selector: "input", typed: "آلودگی کلاس آ", own: (c) => c.title },
  edit: { label: /مدت/, selector: "input", value: "105" },
  read: (id) => getClassRepository().get(id),
  preserved: (before) => (after) => {
    expect(after.title, "title — the field typed into the other record").toBe(before.title);
    expect(after.instrument, "instrument — the create default is piano").toBe(before.instrument);
    expect(after.teacherId, "teacherId").toBe(before.teacherId);
    expect(after.roomId, "roomId").toBe(before.roomId);
    expect(after.kind, "kind — the create default is group").toBe(before.kind);
    expect(after.level, "level — the create default is «سطح ۱»").toBe(before.level);
    expect(after.days, "days").toEqual(before.days);
    expect(after.time, "time — the create default is 17:00").toBe(before.time);
    expect(after.capacity, "capacity — the create default is 6").toBe(before.capacity);
    expect(after.tuition, "tuition — the create default is 3000000").toBe(before.tuition);
    expect(after.status, "status — a stale draft un-archives the class").toBe(before.status);
  },
});

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */
describeEntity<InstrumentRecord>({
  entity: "instrument",
  nameOf: (instrument) => instrument.name,
  dialog: (open, instrument, handlers) => (
    <AuthProvider>
      <AppProvider>
        <InstrumentFormDialog
          open={open}
          instrument={instrument}
          onClose={handlers.onClose}
          onSaved={handlers.onSaved}
        />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getInstrumentRepository();
    const { data } = await repository.list({ per_page: 6 });
    // Deactivated on purpose: the panels tell the operator to deactivate rather
    // than delete, so a stale draft silently reversing that is the worst shape
    // of this defect.
    const a = await repository.update(data[0].id, { description: "توضیح ساز آ", active: false });
    const b = await repository.update(data[1].id, { description: "توضیح ساز ب", active: false });
    return { a, b };
  },
  fields: (i) => [
    [/نام ساز/, i.name, "input"],
    [/شناسه/, i.slug, "input"],
    [/توضیح کوتاه/, i.description ?? "", "textarea"],
  ],
  toggles: (i) => [[/وضعیت ساز/, i.active]],
  contaminates: { label: /نام ساز/, selector: "input", typed: "آلودگی ساز آ", own: (i) => i.name },
  edit: { label: /توضیح کوتاه/, selector: "textarea", value: "توضیح ویرایش‌شده" },
  read: async (id) => {
    const { data } = await getInstrumentRepository().list({ per_page: 50 });
    const found = data.find((instrument) => instrument.id === id);
    expect(found, "the instrument must still be readable").toBeDefined();
    return found!;
  },
  preserved: (before) => (after) => {
    expect(after.name, "name — the field typed into the other record").toBe(before.name);
    expect(after.slug, "slug — immutable, and never sent on edit").toBe(before.slug);
    expect(after.active, "active — a stale draft re-activates a deactivated instrument").toBe(before.active);
  },
});

/* ------------------------------------------------------------------ */
/* Rooms                                                               */
/* ------------------------------------------------------------------ */
describeEntity<Room>({
  entity: "room",
  nameOf: (room) => room.name,
  dialog: (open, room, handlers) => (
    <AuthProvider>
      <AppProvider>
        <RoomFormDialog open={open} room={room} onClose={handlers.onClose} onSaved={handlers.onSaved} />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getRoomRepository();
    const { data } = await repository.list({ per_page: 6 });
    const a = await repository.update(data[0].id, { kind: "استودیو", capacity: 40, active: false });
    const b = await repository.update(data[1].id, { kind: "تئوری", capacity: 25, active: false });
    return { a, b };
  },
  fields: (r) => [
    [/نام اتاق/, r.name, "input"],
    [/نوع/, r.kind, "input"],
    [/ظرفیت/, String(r.capacity), "input"],
  ],
  toggles: (r) => [[/وضعیت فعال بودن اتاق/, r.active !== false]],
  contaminates: { label: /نام اتاق/, selector: "input", typed: "آلودگی اتاق آ", own: (r) => r.name },
  // `kind` rather than `capacity`, so that capacity stays in `preserved` — it is
  // patched to a value far from the create default and is the stronger witness.
  edit: { label: /نوع/, selector: "input", value: "سالن تمرین" },
  read: async (id) => {
    const { data } = await getRoomRepository().list({ per_page: 50 });
    const found = data.find((room) => room.id === id);
    expect(found, "the room must still be readable").toBeDefined();
    return found!;
  },
  preserved: (before) => (after) => {
    expect(after.name, "name — the field typed into the other record").toBe(before.name);
    expect(after.capacity, "capacity — the create default is 6").toBe(before.capacity);
    expect(after.active, "active — a stale draft re-activates a deactivated room").toBe(before.active);
  },
});

/* ------------------------------------------------------------------ */
/* Pieces (repertoire)                                                 */
/* ------------------------------------------------------------------ */
describeEntity<Piece>({
  entity: "piece",
  nameOf: (piece) => piece.title,
  dialog: (open, piece, handlers) => (
    <AuthProvider>
      <AppProvider>
        <PieceFormDialog open={open} piece={piece} onClose={handlers.onClose} onSaved={handlers.onSaved} />
      </AppProvider>
    </AuthProvider>
  ),
  prepare: async () => {
    const repository = getProgressRepository();
    const { data } = await repository.listPieces({ per_page: 6 });
    // A free-form piece with no total range: exactly the shape a stale draft
    // converts back to «measure», while dropping the programme link that the
    // learning surface (M3) reads.
    const a = await repository.updatePiece(data[0].id, {
      composer: "آهنگساز آ",
      description: "توضیح قطعهٔ آ",
      rangeUnit: "freeform",
      totalRange: undefined,
      active: false,
    });
    const b = await repository.updatePiece(data[1].id, {
      composer: "آهنگساز ب",
      description: "توضیح قطعهٔ ب",
      rangeUnit: "section",
      totalRange: 40,
      active: false,
    });
    return { a, b };
  },
  fields: (p) => [
    [/عنوان/, p.title, "input"],
    [/آهنگساز/, p.composer, "input"],
    [/توضیح/, p.description ?? "", "textarea"],
    [/ساز/, p.instrumentId, "select"],
    [/دوره/, p.programId ?? "", "select"],
    [/واحد پیشرفت/, p.rangeUnit, "select"],
  ],
  toggles: (p) => [[/وضعیت قطعه/, p.active]],
  contaminates: { label: /عنوان/, selector: "input", typed: "آلودگی قطعهٔ آ", own: (p) => p.title },
  edit: { label: /آهنگساز/, selector: "input", value: "آهنگساز ویرایش‌شده" },
  read: (id) => getProgressRepository().getPiece(id),
  preserved: (before) => (after) => {
    expect(after.title, "title — the field typed into the other record").toBe(before.title);
    expect(after.description, "description — the create default erases it").toBe(before.description);
    expect(after.instrumentId, "instrumentId").toBe(before.instrumentId);
    expect(after.programId, "programId — the create default detaches the programme").toBe(before.programId);
    expect(after.rangeUnit, "rangeUnit — the create default is measure").toBe(before.rangeUnit);
    expect(after.totalRange, "totalRange").toBe(before.totalRange);
    expect(after.active, "active — a stale draft re-activates a deactivated piece").toBe(before.active);
    expect(after.contentIds, "contentIds — never in the payload, must not be touched").toEqual(before.contentIds);
  },
});
