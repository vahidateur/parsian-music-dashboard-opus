// @vitest-environment jsdom
/**
 * Role-matrix Reset button wiring.
 *
 * The dialog's «بازنشانی به پیش‌فرض» must invoke the existing server reset
 * (`roles.reset` → POST roles/{id}/reset, which deletes the stored override)
 * — not merely overwrite the local form with shipped defaults (which, on
 * save, would persist the defaults AS an override and keep the «edited»
 * badge). The shipped matrix itself defines reset as override deletion
 * (rolePolicy.test.ts §1), and the backend round-trips it (RolesTest).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import { AppProvider } from "@/context/AppContext";
import { resetRegistry, setRoleRepository } from "@/domains/registry";
import type { RoleRepository } from "@/domains/auth/roleRepository";
import type { RolePolicyRecord } from "@/domains/auth/permissions";
import { RoleMatrixDialog } from "@/components/settings/UsersPanel";

const customizedTeacher: RolePolicyRecord = {
  id: "teacher",
  label: "مدرس ویژه",
  scope: "کلاس‌های خود",
  permissions: ["attendance.write"],
  customized: true,
};

const shippedTeacher: RolePolicyRecord = {
  id: "teacher",
  label: "مدرس",
  scope: "کلاس‌های خود",
  permissions: ["attendance.read", "attendance.write", "messages.read", "messages.write"],
  customized: false,
};

type FakeRoleRepo = RoleRepository & {
  reset: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function fakeRoles(override: Partial<Pick<FakeRoleRepo, "list" | "get" | "update" | "reset">> = {}) {
  const base: FakeRoleRepo = {
    list: vi.fn(async () => ({ data: [customizedTeacher], meta: { page: 1, per_page: 25, total: 1 } })),
    get: vi.fn(async () => customizedTeacher),
    update: vi.fn(async () => customizedTeacher),
    reset: vi.fn(async () => shippedTeacher),
    ...override,
  } as unknown as FakeRoleRepo;
  return base;
}

function renderDialog(repo: RoleRepository, onClose: () => void = () => undefined) {
  setRoleRepository(repo);
  return render(
    <AppProvider>
      <RoleMatrixDialog role="teacher" onClose={onClose} />
    </AppProvider>,
  );
}

afterEach(() => {
  cleanup();
  resetRegistry();
});

describe("RoleMatrixDialog reset button", () => {
  it("invokes the server reset and closes on success", async () => {
    const repo = fakeRoles();
    const onClose = vi.fn();
    renderDialog(repo, onClose);

    await waitFor(() => expect(screen.getByText("بازنشانی به پیش‌فرض")).toBeTruthy());
    fireEvent.click(screen.getByText("بازنشانی به پیش‌فرض"));

    await waitFor(() => expect(repo.reset).toHaveBeenCalledTimes(1));
    expect(repo.reset).toHaveBeenCalledWith("teacher");
    // The override is gone server-side, so the dialog closes instead of
    // staging defaults for a save that would re-persist them as an override.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("shows the server error and stays open when reset is refused", async () => {
    const repo = fakeRoles({
      reset: vi.fn(async (): Promise<never> => {
        throw new ApiError({ kind: "authorization", message: "دسترسی لازم برای این عملیات را ندارید." });
      }),
    });
    const onClose = vi.fn();
    renderDialog(repo, onClose);

    await waitFor(() => expect(screen.getByText("بازنشانی به پیش‌فرض")).toBeTruthy());
    fireEvent.click(screen.getByText("بازنشانی به پیش‌فرض"));

    await waitFor(() => expect(screen.getByText("دسترسی لازم برای این عملیات را ندارید.")).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });
});
