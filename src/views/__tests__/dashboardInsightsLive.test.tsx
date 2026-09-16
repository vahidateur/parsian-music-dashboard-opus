// @vitest-environment jsdom
/**
 * The dashboard's insight panels over the REAL record set — DEMO and EMPTY.
 *
 * WHY THIS FILE EXISTS
 *
 * H4's defect was that `Signals`, `Intelligence`, `AttentionAndFlow` and
 * `BusinessIntelligence` printed `src/data/academy.ts` constants: a 1,248-student
 * roster, a 92٪ attendance rate, a 125.4-million revenue month, an install count
 * for an app that does not exist. Those figures were identical in an EMPTY
 * academy, because nothing tied them to a record.
 *
 * So the acceptance question is asked of the real component tree: render
 * `Dashboard`, and check that every figure inside those four panels is one the
 * stored records support, and that none of the retired fixture values or
 * sentences is on screen — not in DEMO, and not in EMPTY.
 *
 * SCOPE OF THE ASSERTIONS
 *
 * Each panel is queried by its own landmark attribute (`aria-label` /
 * `aria-labelledby`), so this file measures the four panels H4 names. The hero's
 * own fixture leakage is a separate, recorded item and is deliberately NOT
 * asserted on here — a case that failed on it would be measuring a different
 * defect than the one this milestone closed.
 *
 * THE CLOCK IS PINNED. `academyNow()` freezes the TIME of day in demo mode but
 * keeps the real date, while the seeded schedule is anchored to `SEED_DATE`
 * (2026-09-01). Pinning the date makes "today has a calendar" a property of the
 * fixture rather than of the day the suite happens to run.
 */
import { cleanup, render, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { getStudentRepository, resetRegistry } from "@/domains/registry";
import { demoStore } from "@/services/demoStore";
import { SEEDED_CONFLICT } from "@/domains/demo/schedulingSeed";
import { resetToDemoEnvironment, resetToEmptyEnvironment } from "@/test/demoEnvironment";
import { Dashboard } from "@/views/Dashboard";
import { faNum, faToman, NO_DATA } from "@/lib/format";

/** Text that can only reach the DOM through an arithmetic or lookup mistake. */
const ARTEFACTS = ["NaN", "Infinity", "undefined", "[object Object]"] as const;

/**
 * Sentences the four panels used to print from fixtures.
 *
 * Each one is verbatim from a retired fixture (`signals`, `intelligenceCards`,
 * `attentionItems`/`attentionQueue` and the panels' own copy), so a case that
 * finds one on screen has found a fixture read. They are quoted whole rather
 * than paraphrased: the live copy deliberately says different things
 * («۵ هنرجو در وضعیت «در معرض ریزش»» against the fixture's «۵ هنرجو در معرض
 * ریزش»), and matching on the claim — not on a word — is what makes the check
 * evidence.
 */
const RETIRED_SENTENCES = [
  // panels' own copy
  "الگوی مفهومی با دادهٔ نمایشی",
  "دادهٔ نمایشی",
  "پایهٔ تحلیل: ۳۰ روز گذشته",
  "به‌روزرسانی ۲ دقیقه پیش",
  "اولویت‌بندی خودکار",
  "هم‌زمان با «پیانو پیشرفته»",
  "۹۸۷ نصب فعال",
  "۱۸ مدرس · ۷ آنلاین",
  "همگام‌سازی: ۲ دقیقه پیش",
  "نرخ ماندگاری",
  // the view's own mobile pulse kicker
  "فعالیت امروز · اوج ۱۴:۰۰ تا ۱۵:۰۰ · ۱ نقطهٔ توجه",
  // `signals` fixture contexts
  "شتاب رشد در حال افزایش است",
  "۸۸٪ از هدف ماهانه محقق شده",
  "وضعیت مطلوب · بالاتر از میانگین ۸۹٪",
  "۴ مدرس زیر ۶۰٪ ظرفیت هستند",
  // `intelligenceCards` fixture signals
  "نرخ ماندگاری هنرجویان ۴٫۲٪ افزایش یافته است.",
  "۸ هنرجو جلسات استفاده‌نشده دارند که تا پایان دوره منقضی می‌شوند.",
  "ظرفیت کلاس‌های پیانو در سه‌شنبه‌ها به ۹۱٪ رسیده است.",
  // `attentionItems` / `attentionQueue` fixture rows
  "۳ فاکتور سررسید گذشته",
  "بیش از دو هفته غیبت متوالی",
  "تعارض اتاق در ساعت ۱۴:۰۰",
  "غیبت ۲ مدرس در فردا",
  "۳ کلاس امروز حضور و غیاب ثبت‌نشده",
  "۲ نفر در لیست انتظار بدون تماس",
] as const;

/** Figures only the retired fixtures carried. */
const RETIRED_FIGURES = ["۱٬۲۴۸", "۱۲۵٫۴", "۱۲۵٬۴۳۰٬۰۰۰", "۹۸۷", "۱۴۲"] as const;

function renderDashboard() {
  return render(
    <AppProvider>
      <Dashboard />
    </AppProvider>,
  );
}

/** The four H4 panels, each by the landmark it already carries. */
function panels() {
  return {
    signals: document.querySelector('[aria-label="سیگنال‌های اصلی"]') as HTMLElement | null,
    attention: document.querySelector('[aria-labelledby="attention-title"]') as HTMLElement | null,
    flow: document.querySelector('[aria-labelledby="flow-title"]') as HTMLElement | null,
    intelligence: document.querySelector('[aria-labelledby="intel-title"]') as HTMLElement | null,
    business: document.querySelector('[aria-labelledby="bi-title"]') as HTMLElement | null,
  };
}

function panelText(): string {
  const found = panels();
  for (const [name, node] of Object.entries(found)) {
    expect(node, `panel ${name} must render`).not.toBeNull();
  }
  return Object.values(found)
    .map((node) => node!.textContent ?? "")
    .join(" ␟ ");
}

/** Waits until every panel has finished its repository read. */
async function settle() {
  await waitFor(() => expect(document.querySelector('[aria-labelledby="bi-title"]')).not.toBeNull());
  await waitFor(
    () => {
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("در حال خواندن");
    },
    { timeout: 5000 },
  );
}

beforeEach(() => {
  localStorage.clear();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
  vi.useRealTimers();
});

describe("DEMO — the four panels over the seeded records", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 1, 12, 0, 0));
    resetToDemoEnvironment();
    resetRegistry();
  });

  it("reports the figures its own records support, and none of the retired ones", async () => {
    const { container } = renderDashboard();
    await settle();

    const students = demoStore.snapshot().students;
    const atRisk = students.filter((student) => student.status === "at-risk").length;
    const owing = students.filter((student) => student.balance > 0);
    const total = owing.reduce((sum, student) => sum + student.balance, 0);
    const top = [...owing].sort((a, b) => b.balance - a.balance)[0];

    const text = panelText();

    // A derived count, not a fixture: the number on screen is the number of rows
    // whose stored status is «at-risk».
    expect(atRisk).toBeGreaterThan(0);
    expect(text).toContain(faNum(atRisk));
    expect(text).toContain("هنرجویان نیازمند توجه");

    // Money the records carry: the sum of the stored balances, and the largest
    // one named.
    expect(total).toBeGreaterThan(0);
    expect(text).toContain(faToman(total, true));
    expect(text).toContain(top.name);

    // The instrument mix is built from the instrument stored on each student row.
    expect(text).toContain(faNum(students.length));

    // And none of the constants this panel used to print.
    for (const figure of RETIRED_FIGURES) {
      expect(text, `the retired figure ${figure} survived`).not.toContain(figure);
    }
    for (const sentence of RETIRED_SENTENCES) {
      expect(text, `the retired sentence «${sentence}» survived`).not.toContain(sentence);
    }
    expect(container.textContent).not.toMatch(/NaN|Infinity|\[object Object\]/);
  });

  it("derives today's rows from the stored calendar, labels and all", async () => {
    renderDashboard();
    await settle();

    const sessions = demoStore.scheduledSessions.all();
    const today = sessions.filter((session) => session.date === "2026-09-01");
    expect(today.length, "the seed must hold sessions for the pinned day").toBeGreaterThan(0);

    // The view's own mobile pulse card states the same stored figure, so the one
    // sentence that used to carry a hand-written peak and attention count is
    // derived from the read set too.
    expect(document.body.textContent).toContain(`${faNum(today.length)} جلسه روی تقویم`);

    const flow = panels().flow!;
    const flowText = flow.textContent ?? "";
    // Every class that meets today is stored, so its title must come from the
    // class record rather than from the retired `schedule` fixture.
    expect(within(flow).getByText("برنامه امروز")).toBeTruthy();
    expect(flowText).toContain(faNum(today.length));
    // The fixture's own labels must not appear anywhere in the panel.
    for (const fixtureTitle of ["کلاس پیانو", "پیانو کودکان", "سلفژ", "کلاس درامز"]) {
      expect(flowText, `the fixture row «${fixtureTitle}» survived`).not.toContain(fixtureTitle);
    }
  });

  it("flags the stored room clash instead of a fixture sentence about one", async () => {
    renderDashboard();
    await settle();

    // The seed records which clash it plants (`SEEDED_CONFLICT`) so a case can
    // assert it rather than hope: cl2 and cl7 both meet at 14:00 in r1 on
    // weekday 3, which the pinned date is.
    const clash = demoStore
      .scheduledSessions.all()
      .filter(
        (session) =>
          session.date === "2026-09-01" &&
          session.roomId === SEEDED_CONFLICT.roomId &&
          session.startTime === SEEDED_CONFLICT.time &&
          (SEEDED_CONFLICT.classIds as readonly string[]).includes(session.classId),
      );
    expect(clash.map((session) => session.classId).sort()).toEqual([...SEEDED_CONFLICT.classIds].sort());

    const flow = panels().flow!;
    // The clash reaches the panel as a derived status...
    expect(flow.textContent).toContain("نیازمند توجه");
    // ...with a label that names only the room this row knows about. The retired
    // copy named the other class by hand, which was true for exactly this pair.
    // Two conflicting rows, so the label renders twice.
    expect(within(flow).getAllByText(/تعارض در/).length).toBe(SEEDED_CONFLICT.classIds.length);
    expect(flow.textContent).not.toContain("پیانو پیشرفته");
  });

  it("follows a write to the store (liveness)", async () => {
    renderDashboard();
    await settle();

    const before = demoStore.snapshot().students;
    const settledStudent = before.find((student) => student.balance === 0)!;
    const totalBefore = before.filter((s) => s.balance > 0).reduce((sum, s) => sum + s.balance, 0);
    expect(panels().business!.textContent).toContain(faToman(totalBefore, true));

    // A real write through the repository, not a local edit.
    await getStudentRepository().update(settledStudent.id, { payment: "overdue", balance: 900_000_000 });

    await waitFor(() => expect(panels().business!.textContent).toContain(faToman(totalBefore + 900_000_000, true)));
    // The retired figure has not come back, and the named top balance is the new one.
    expect(panels().business!.textContent).toContain(settledStudent.name);
  });
});

describe("EMPTY — the four panels in a customer's own empty academy", () => {
  beforeEach(() => {
    resetToEmptyEnvironment();
    resetRegistry();
  });

  it("states «داده‌ای نیست» where a figure would have to be invented", async () => {
    renderDashboard();
    await settle();

    const found = panels();
    for (const [name, node] of Object.entries(found)) {
      expect(node, `panel ${name} must render`).not.toBeNull();
    }

    for (const name of ["attention", "flow", "intelligence", "business"] as const) {
      expect(found[name]!.textContent, `${name} must state that there is no data`).toContain("داده‌ای نیست");
    }
    // The tiles still render, with absent values rather than zeros.
    expect(found.signals!.textContent).toContain(NO_DATA);
    // And the source lines count the rows that really exist: none.
    expect(found.intelligence!.textContent).toContain("۰ رکورد ذخیره‌شده");
    // The mobile pulse card names no peak hour it cannot see.
    expect(document.body.textContent).toContain("هنوز رکوردی ثبت نشده");
    expect(document.body.textContent).not.toContain("اوج");
  });

  it("survives an empty academy without a single fabricated figure or sentence", async () => {
    const { container } = renderDashboard();
    await settle();

    const text = panelText();
    for (const figure of RETIRED_FIGURES) {
      expect(text, `the retired figure ${figure} reached an EMPTY academy`).not.toContain(figure);
    }
    for (const sentence of RETIRED_SENTENCES) {
      expect(text, `the retired sentence «${sentence}» reached an EMPTY academy`).not.toContain(sentence);
    }
    for (const artefact of ARTEFACTS) {
      expect(container.textContent, `the dashboard rendered "${artefact}"`).not.toContain(artefact);
    }
    // The empty-series failure mode lands in SVG *attributes* (coordinates built
    // from ±Infinity), not in text, so sweep those too.
    for (const node of container.querySelectorAll("svg *")) {
      for (const attribute of node.getAttributeNames()) {
        const value = node.getAttribute(attribute) ?? "";
        expect(value, `${node.tagName}.${attribute} carried "${value}"`).not.toMatch(/NaN|Infinity/);
      }
    }

    // The environment really is empty while these panels render.
    const snapshot = demoStore.snapshot();
    expect(snapshot.students).toHaveLength(0);
    expect(snapshot.classes).toHaveLength(0);
  });

  it("draws no trend and names no class, room or teacher it does not have", async () => {
    renderDashboard();
    await settle();

    const found = panels();
    const text = Object.values(found)
      .map((node) => node!.textContent ?? "")
      .join(" ␟ ");

    // The two measures with no history at all (the at-risk roster and the
    // per-student attendance field) render the empty-series glyph inside their
    // chart slot; the two weekly counts are measured zeros and draw a flat line
    // — thirteen weeks of nothing IS a measurement.
    const emptyGlyphs = [...found.signals!.querySelectorAll("svg text")].filter(
      (node) => node.textContent === NO_DATA,
    );
    expect(emptyGlyphs).toHaveLength(2);

    // Nothing stored means nothing to name.
    expect(text).not.toContain("اتاق ۱");
    expect(text).not.toContain("پیانو گروهی");
  });
});
