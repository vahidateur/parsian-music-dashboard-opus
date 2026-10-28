// @vitest-environment jsdom
/**
 * A created teacher appears in the list on screen without a manual refresh.
 *
 * The form writes straight through the repository, and only the DEMO store
 * announces writes (it bumps the global data version). An API-backed repository
 * announces nothing, so the list the view holds stayed stale until a reload.
 * This drives that shape: an in-memory repository that, like the API one, tells
 * nobody about its writes.
 */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AppProvider } from "@/context/AppContext";
import { AuthProvider } from "@/domains/auth/AuthContext";
import { DEMO_PASSPHRASE, LocalAuthRepository } from "@/domains/auth/localAuthRepository";
import { LocalUserRepository } from "@/domains/auth/localUserRepository";
import { createMemoryBlobStore, setBlobStore } from "@/domains/media/blobStore";
import { getTeacherRepository, resetRegistry, setAuthRepository, setTeacherRepository, setUserRepository } from "@/domains/registry";
import type { Teacher } from "@/domains/teachers/types";
import type { TeacherRepository } from "@/domains/teachers/repository";
import { demoStore, memoryStorage } from "@/services/demoStore";
import { resetToDemoEnvironment } from "@/test/demoEnvironment";
import { TeachersView } from "@/views/Teachers";

const NEW_NAME = "مدرس تازه ایجاد شده";

/** Serves a copy of the seeded teachers and records writes silently, like the API repository. */
async function silentRepository(): Promise<{ repo: TeacherRepository; rows: Teacher[] }> {
  const real = getTeacherRepository();
  const rows: Teacher[] = [...(await real.list({ per_page: 200 })).data];
  const page = (data: Teacher[]) => ({ data, meta: { page: 1, per_page: 200, total: data.length } });
  const repo = {
    ...Object.fromEntries(["get", "update", "delete", "deactivate"].map((k) => [k, (...a: unknown[]) => (real as never as Record<string, (...x: unknown[]) => unknown>)[k](...a)])),
    list: async () => page([...rows]),
    get: async (id: string) => rows.find((r) => r.id === id) as Teacher,
    create: async (input: Omit<Teacher, "id">) => {
      const created = { ...rows[0], ...input, id: `t-new-${rows.length}` } as Teacher;
      rows.push(created);
      return created;
    },
  } as unknown as TeacherRepository;
  return { repo, rows };
}

beforeEach(async () => {
  window.location.hash = "";
  localStorage.clear();
  resetRegistry();
  setBlobStore(createMemoryBlobStore());
  resetToDemoEnvironment();
  resetRegistry();
  const auth = new LocalAuthRepository(demoStore, memoryStorage());
  setAuthRepository(auth);
  setUserRepository(new LocalUserRepository(demoStore));
  const admin = demoStore.snapshot().users.find((u) => u.role === "administrator" && u.status === "active");
  await auth.login({ email: admin!.email, password: DEMO_PASSPHRASE });
});
afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("creating a teacher", () => {
  it("shows the new teacher in the current list immediately, with no reload", async () => {
    const { repo } = await silentRepository();
    setTeacherRepository(repo);
    render(
      <AuthProvider>
        <AppProvider>
          <TeachersView />
        </AppProvider>
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.queryAllByRole("status")).toHaveLength(0), { timeout: 8000 });
    expect(document.body.textContent).not.toContain(NEW_NAME);

    fireEvent.click(screen.getAllByRole("button", { name: /افزودن مدرس/ })[0]);
    fireEvent.change(await screen.findByLabelText(/نام و نام خانوادگی/), { target: { value: NEW_NAME } });
    fireEvent.change(screen.getByLabelText(/عنوان \/ تخصص/), { target: { value: "مدرس پیانو" } });
    fireEvent.change(screen.getByLabelText(/شمارهٔ تماس/), { target: { value: "09129990001" } });
    fireEvent.change(screen.getByLabelText(/ساعت قرارداد/), { target: { value: "20" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "افزودن مدرس" }));

    await waitFor(() => expect(document.body.textContent).toContain(NEW_NAME), { timeout: 8000 });
  }, 30_000);
});