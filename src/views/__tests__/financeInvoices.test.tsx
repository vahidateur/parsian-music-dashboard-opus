// @vitest-environment jsdom
/**
 * Finance invoices (v1, §40) — the served surface.
 *
 * With a real-shaped fake repository: the list renders due and paid rows,
 * the status filter narrows them, issuing validates locally before the
 * write and reports the server's record afterwards, and paying a due
 * invoice discharges it (terminally — the button is gone for paid rows).
 * The demo composition's deferral is pinned separately by
 * `noSuccessWithoutWrite` (the unavailable stub rejects every verb there).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetRegistry, setAuthRepository, setFinanceRepository, setStudentRepository, setUserRepository } from "@/domains/registry";
import type { FinanceRepository } from "@/domains/finance/repository";
import type { Invoice, InvoiceListParams } from "@/domains/finance/types";
import type { StudentRepository } from "@/domains/students/repository";
import type { StudentListParams } from "@/domains/students/types";
import { FinanceView } from "@/views/Finance";

const ACCOUNTANT = "finance@demo.local";

function makeRepo(seed: Invoice[]): FinanceRepository & { calls: string[]; lastPay: unknown; lastCreate: unknown } {
  const rows = [...seed];
  let seq = 100;
  const calls: string[] = [];
  const repo: FinanceRepository & { calls: string[]; lastPay: unknown; lastCreate: unknown } = {
    calls,
    lastPay: undefined as unknown,
    lastCreate: undefined as unknown,
    async list(params: InvoiceListParams = {}) {
      const filtered = rows.filter((row) => !params.status || row.status === params.status);
      return { data: filtered, meta: { page: 1, per_page: 100, total: filtered.length } };
    },
    async get(id) {
      const found = rows.find((row) => row.id === id);
      if (!found) throw Object.assign(new Error("missing"), { code: "INVOICE_NOT_FOUND" });
      return found;
    },
    async create(input) {
      calls.push("create");
      repo.lastCreate = input;
      const created: Invoice = {
        id: `inv_test_${seq++}`,
        studentId: input.studentId,
        studentName: "هنرجو تست",
        title: input.title,
        amount: input.amount,
        status: "due",
        issuedAt: new Date().toISOString(),
        dueAt: input.dueAt ?? null,
        paidAt: null,
        paidByUserId: null,
      };
      rows.unshift(created);
      return created;
    },
    async update(id, input) {
      calls.push("update");
      const row = rows.find((r) => r.id === id);
      if (!row) throw Object.assign(new Error("missing"), { code: "INVOICE_NOT_FOUND" });
      if (row.status !== "due") throw Object.assign(new Error("paid"), { code: "INVOICE_ALREADY_PAID" });
      return { ...row, ...input };
    },
    async pay(id, input) {
      calls.push("pay");
      repo.lastPay = input;
      const row = rows.find((r) => r.id === id);
      if (!row) throw Object.assign(new Error("missing"), { code: "INVOICE_NOT_FOUND" });
      if (row.status !== "due") throw Object.assign(new Error("paid"), { code: "INVOICE_ALREADY_PAID" });
      row.status = "paid";
      row.paidAt = new Date().toISOString();
      row.paidByUserId = "u_accountant";
      row.paidMethod = input.method;
      row.paidReference = input.reference ?? null;
      return { ...row };
    },
  };
  return repo;
}

const seed: Invoice[] = [
  { id: "inv_due", studentId: "st_1", studentName: "هنرجو یک", title: "شهریه مهر", amount: 3000000, status: "due", issuedAt: "2026-10-01T00:00:00.000Z", dueAt: null, paidAt: null, paidByUserId: null },
  { id: "inv_paid", studentId: "st_2", studentName: "هنرجو دو", title: "شهریه شهریور", amount: 2500000, status: "paid", issuedAt: "2026-09-01T00:00:00.000Z", dueAt: null, paidAt: "2026-09-05T00:00:00.000Z", paidByUserId: "u_accountant" },
];

async function renderAsAccountant(repo: FinanceRepository, students?: StudentRepository): Promise<void> {
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  setFinanceRepository(repo);
  if (students) setStudentRepository(students);
  await auth.login({ email: ACCOUNTANT, password: DEMO_PASSPHRASE });
  render(
    <AuthProvider>
      <AppProvider>
        <FinanceView />
      </AppProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  resetToDemoEnvironment();
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("FinanceView with a served backend", () => {
  it("lists due and paid invoices with their receipt state", async () => {
    await renderAsAccountant(makeRepo(seed));
    await screen.findByRole("table", { name: "فهرست فاکتورها" });
    expect(screen.getByText("شهریه مهر")).toBeDefined();
    expect(screen.getByText("شهریه شهریور")).toBeDefined();
    // Receipt state per row: paid rows name no pay control.
    expect(screen.getAllByRole("button", { name: "ثبت پرداخت" })).toHaveLength(1);
  });

  it("filters by settlement status", async () => {
    await renderAsAccountant(makeRepo(seed));
    await screen.findByRole("table", { name: "فهرست فاکتورها" });
    fireEvent.click(screen.getByRole("button", { name: "تسویه" }));
    await waitFor(() => expect(screen.queryByText("شهریه مهر")).toBeNull());
    expect(screen.getByText("شهریه شهریور")).toBeDefined();
  });

  it("issues an invoice and reports the server's record", async () => {
    const repo = makeRepo(seed);
    await renderAsAccountant(repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });

    fireEvent.click(screen.getByRole("button", { name: "فاکتور جدید" }));
    const studentSelect = document.querySelector("select") as HTMLSelectElement;
    const firstStudent = Array.from(studentSelect.options).find((option) => option.value !== "");
    expect(firstStudent, "the demo seed provides students to bill").toBeDefined();
    fireEvent.change(studentSelect, { target: { value: firstStudent!.value } });
    fireEvent.change(screen.getByPlaceholderText("مثلاً شهریهٔ ترم پاییز"), { target: { value: "شهریه آبان" } });
    // Persian digits, as an operator types them — parsed, not rejected.
    fireEvent.change(screen.getByPlaceholderText("مثلاً ۳۰۰۰۰۰۰"), { target: { value: "۳۰۰۰۰۰۰" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت فاکتور" }));

    await waitFor(() => expect(repo.calls).toContain("create"));
    await screen.findByText("شهریه آبان");
  });

  it("pays a due invoice with method and reference, and the control is gone afterwards", async () => {
    const repo = makeRepo(seed);
    await renderAsAccountant(repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });

    fireEvent.click(screen.getAllByRole("button", { name: "ثبت پرداخت" })[0]);
    expect(await screen.findByText(/ثبت پرداخت «شهریه مهر»/)).toBeDefined();

    const methodSelect = await screen.findByLabelText(/روش پرداخت/);
    fireEvent.change(methodSelect, { target: { value: "transfer" } });
    fireEvent.change(await screen.findByPlaceholderText("مثلاً ۱۲۳۴۵۶"), { target: { value: "TT-999" } });
    fireEvent.click(screen.getByRole("button", { name: "تأیید و تسویه" }));

    await waitFor(() => expect(repo.calls).toContain("pay"));
    expect(repo.lastPay).toEqual({ method: "transfer", reference: "TT-999" });
    await waitFor(() => expect(screen.queryAllByRole("button", { name: "ثبت پرداخت" })).toHaveLength(0));
  });

  it("flags a past-due unpaid invoice as overdue without touching the server", async () => {
    const overdue: Invoice = {
      id: "inv_over",
      studentId: "st_9",
      studentName: "هنرجو نه",
      title: "شهریه قدیم",
      amount: 1000000,
      status: "due",
      issuedAt: "2026-01-01T00:00:00.000Z",
      dueAt: "2026-02-01",
      paidAt: null,
      paidByUserId: null,
    };
    await renderAsAccountant(makeRepo([...seed, overdue]));
    await screen.findByRole("table", { name: "فهرست فاکتورها" });
    // The badge is derived client-side from dueAt; no new status id exists.
    expect(screen.getByText("سررسید گذشته")).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* I16 — the student picker is a server-side search, not a capped list  */
/* ------------------------------------------------------------------ */

/**
 * A student repository with `count` rows that honours `search` and `per_page`
 * exactly as the API does (name match, page slice, `total` of the match). The
 * old picker asked for 200 rows once, so a 201st student was invisible; these
 * cases fail against that behaviour and pass only with a real search.
 */
function makeStudentRepo(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `st_${index + 1}`,
    name: `هنرجوی شماره ${index + 1}`,
  }));
  const calls: StudentListParams[] = [];
  const state = { fail: false };
  const list = vi.fn(async (params: StudentListParams) => {
    calls.push(params);
    if (state.fail) throw Object.assign(new Error("students down"), { code: "SERVER_ERROR" });
    const query = params.search?.trim();
    const matched = query ? rows.filter((row) => row.name.includes(query)) : rows;
    const perPage = params.per_page ?? 20;
    const page = params.page ?? 1;
    return {
      data: matched.slice((page - 1) * perPage, page * perPage),
      meta: { page, per_page: perPage, total: matched.length },
    };
  });
  const repo = {
    list,
    get: async () => { throw new Error("unused in this case"); },
    create: async () => { throw new Error("unused in this case"); },
    update: async () => { throw new Error("unused in this case"); },
    delete: async () => { throw new Error("unused in this case"); },
  } as unknown as StudentRepository;
  return { repo, calls, state };
}

const SEARCH_PLACEHOLDER = "جست‌وجوی نام، تلفن یا کد ملی هنرجو…";

async function openCreateForm(): Promise<HTMLSelectElement> {
  fireEvent.click(screen.getByRole("button", { name: "فاکتور جدید" }));
  await screen.findByPlaceholderText(SEARCH_PLACEHOLDER);
  return document.querySelector("select") as HTMLSelectElement;
}

describe("FinanceView student picker (I16)", () => {
  it("finds a student past the first page and issues the invoice for that id", async () => {
    const finance = makeRepo(seed);
    const students = makeStudentRepo(250);
    await renderAsAccountant(finance, students.repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });

    const select = await openCreateForm();
    await waitFor(() => expect(select.options.length).toBeGreaterThan(1));
    // The first page is a slice: student 201 is not in it.
    expect(Array.from(select.options).some((option) => option.value === "st_201")).toBe(false);

    fireEvent.change(screen.getByPlaceholderText(SEARCH_PLACEHOLDER), {
      target: { value: "هنرجوی شماره 201" },
    });
    await waitFor(() => expect(students.calls.some((call) => call.search === "هنرجوی شماره 201")).toBe(true));
    await waitFor(() =>
      expect(Array.from(select.options).some((option) => option.value === "st_201")).toBe(true),
    );

    fireEvent.change(select, { target: { value: "st_201" } });
    fireEvent.change(screen.getByPlaceholderText("مثلاً شهریهٔ ترم پاییز"), { target: { value: "شهریه آبان" } });
    fireEvent.change(screen.getByPlaceholderText("مثلاً ۳۰۰۰۰۰۰"), { target: { value: "۳۰۰۰۰۰۰" } });
    fireEvent.click(screen.getByRole("button", { name: "ثبت فاکتور" }));

    await waitFor(() => expect(finance.calls).toContain("create"));
    expect(finance.lastCreate).toMatchObject({ studentId: "st_201" });
  });

  it("keeps the chosen student when the query changes", async () => {
    const finance = makeRepo(seed);
    const students = makeStudentRepo(250);
    await renderAsAccountant(finance, students.repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });

    const select = await openCreateForm();
    const search = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    fireEvent.change(search, { target: { value: "هنرجوی شماره 9" } });
    await waitFor(() =>
      expect(Array.from(select.options).some((option) => option.value === "st_9")).toBe(true),
    );
    fireEvent.change(select, { target: { value: "st_9" } });

    // A new query replaces the page; the choice must not disappear with it.
    fireEvent.change(search, { target: { value: "چیزی که وجود ندارد" } });
    await waitFor(() =>
      expect(screen.getByText("هنرجویی با این جست‌وجو پیدا نشد.")).toBeDefined(),
    );
    expect(select.value).toBe("st_9");
    expect(Array.from(select.options).some((option) => option.value === "st_9")).toBe(true);
  });

  it("says the page is a slice when the total exceeds it", async () => {
    const finance = makeRepo(seed);
    const students = makeStudentRepo(250);
    await renderAsAccountant(finance, students.repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });
    await openCreateForm();

    await waitFor(() =>
      expect(screen.getByText(/برای دیدن بقیه، جست‌وجو را محدود کنید/)).toBeDefined(),
    );
    expect(students.calls[0]?.per_page).toBe(50);
  });

  it("reports a failed student read with a retry instead of an empty picker", async () => {
    const finance = makeRepo(seed);
    const students = makeStudentRepo(10);
    students.state.fail = true;
    await renderAsAccountant(finance, students.repo);
    await screen.findByRole("table", { name: "فهرست فاکتورها" });
    await openCreateForm();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("خواندن فهرست هنرجویان ناموفق بود");

    students.state.fail = false;
    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));
    await waitFor(() =>
      expect(screen.queryByText(/خواندن فهرست هنرجویان ناموفق بود/)).toBeNull(),
    );
  });
});
