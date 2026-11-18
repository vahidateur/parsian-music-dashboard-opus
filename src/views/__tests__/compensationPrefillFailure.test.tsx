// @vitest-environment jsdom
/**
 * The make-up prefill is a claim about the academy's lesson length.
 *
 * `useOrganization` keeps its defaults when the organization read fails, so the
 * booking dialog used to prefill a 60-minute make-up even though the real rule
 * was unknown. These cases pin the A2 rule at this dialog: no duration from a
 * default, an explicit failure disclosure with retry, and the academy's own
 * 90-minute rule when the read succeeds.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import type { SessionCompensation } from "@/domains/compensation/types";
import type { OrganizationRepository } from "@/domains/organization/repository";
import { DEFAULT_ORGANIZATION_SETTINGS } from "@/domains/organization/types";
import { resetRegistry, setOrganizationRepository } from "@/domains/registry";
import type { Session } from "@/domains/scheduling/types";
import { ScheduleCompensationDialog } from "@/views/compensation/CompensationDialogs";

const FAILURE = "مدت پیش‌فرض جلسه خوانده نشد";

const original: Session = {
  id: "sess_original",
  classId: "class_1",
  date: "2026-09-01",
  startTime: "10:00",
  endTime: "11:00",
  teacherId: "t1",
  roomId: "r1",
  status: "cancelled",
  origin: "manual",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const compensation: SessionCompensation = {
  id: "comp_1",
  originalSessionId: original.id,
  classId: original.classId,
  studentId: "st1",
  reason: "جلسه لغو شد",
  requiredAt: "2026-09-01T00:00:00.000Z",
  requiredByUserId: "u1",
  attempts: [],
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  status: "required",
  attemptBroken: false,
  originalMissing: false,
};

beforeEach(() => {
  resetRegistry();
});

afterEach(() => {
  cleanup();
  resetRegistry();
});

function renderDialog() {
  return render(
    <ScheduleCompensationDialog
      open
      compensation={compensation}
      original={original}
      frozenStudentName="آیدا شریفی"
      classTitle="پیانو کلاسیک"
      rooms={[]}
      teachers={[]}
      roomsUnavailable={false}
      teachersUnavailable={false}
      onSubmit={async () => compensation}
      onRejected={() => undefined}
      onClose={() => undefined}
      onWritten={() => undefined}
    />,
  );
}

function organizationWith(minutes: number): OrganizationRepository {
  return {
    get: async () => ({ ...DEFAULT_ORGANIZATION_SETTINGS, defaultSessionMinutes: minutes }),
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as OrganizationRepository;
}

function rejectingOrganization(): OrganizationRepository {
  return {
    get: async () => {
      throw new ApiError({ kind: "network", message: "قواعد آموزشگاه در دسترس نیست." });
    },
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as OrganizationRepository;
}

function failThenOrganization(minutes: number) {
  let calls = 0;
  const repo: OrganizationRepository = {
    get: async () => {
      calls += 1;
      if (calls === 1) throw new ApiError({ kind: "network", message: "قواعد آموزشگاه در دسترس نیست." });
      return { ...DEFAULT_ORGANIZATION_SETTINGS, defaultSessionMinutes: minutes };
    },
    update: async () => {
      throw new Error("not used");
    },
  } as unknown as OrganizationRepository;
  return { repo, calls: () => calls };
}

const endTime = () => screen.getByPlaceholderText("۱۷:۰۰") as HTMLInputElement;

describe("the compensation dialog's duration prefill", () => {
  it("does not fabricate a 60-minute prefill when the organization read fails", async () => {
    setOrganizationRepository(rejectingOrganization());
    renderDialog();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(endTime().value).toBe("");
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeTruthy();
  });

  it("reloads the organization rules through retry and recovers the prefill", async () => {
    const organization = failThenOrganization(90);
    setOrganizationRepository(organization.repo);
    renderDialog();

    expect(await screen.findByText(FAILURE)).toBeTruthy();
    expect(endTime().value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "تلاش دوباره" }));

    await waitFor(() => expect(screen.queryByText(FAILURE)).toBeNull());
    await waitFor(() => expect(endTime().value).toBe("11:30"));
    expect(organization.calls()).toBe(2);
  });

  it("uses the academy's loaded 90-minute rule for the prefill", async () => {
    setOrganizationRepository(organizationWith(90));
    renderDialog();

    await waitFor(() => expect(endTime().value).toBe("11:30"));
    expect(screen.queryByText(FAILURE)).toBeNull();
  });
});
