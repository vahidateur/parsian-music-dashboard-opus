// @vitest-environment jsdom
/**
 * §7 cross-domain live consistency.
 *
 * A write in one domain must be visible to every other reader without any
 * view-to-view coupling. These tests exercise the data-version bus through the
 * real hooks, which is the mechanism the UI depends on.
 */
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { demoStore } from "@/services/demoStore";
import {
  getClassRepository,
  getEnrollmentRepository,
  getRoomRepository,
  getStudentRepository,
  getTeacherRepository,
  resetRegistry,
} from "@/domains/registry";
import { useTeachers } from "@/domains/teachers/useTeachers";
import { useRooms } from "@/domains/rooms/useRooms";
import { useClasses } from "@/domains/classes/useClasses";
import { useAcademyMetrics } from "@/domains/shared/useAcademyMetrics";
import { useDomainSearch } from "@/domains/shared/useDomainSearch";

beforeEach(() => {
  demoStore.reset();
  resetRegistry();
});

describe("cross-domain propagation", () => {
  it("a newly created teacher appears in the assignable teacher list", async () => {
    const { result } = renderHook(() => useTeachers({ assignableOnly: true, per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.items.length;

    await getTeacherRepository().create({
      name: "مدرس تازه",
      instrument: "guitar",
      title: "مدرس گیتار",
      phone: "09121112222",
      status: "active",
      students: 0,
      utilization: 0,
      weeklyHours: 0,
      contractHours: 20,
      attendanceRate: 100,
      retention: 100,
      since: "امسال",
      bio: "",
    });

    await waitFor(() => expect(result.current.items.length).toBe(before + 1));
    expect(result.current.items.some((t) => t.name === "مدرس تازه")).toBe(true);
  });

  it("a deactivated teacher disappears from the assignable list but not from history", async () => {
    const { result } = renderHook(() => useTeachers({ assignableOnly: true, per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await getTeacherRepository().deactivate("t1");
    await waitFor(() => expect(result.current.items.some((t) => t.id === "t1")).toBe(false));

    // The record itself is preserved.
    const still = await getTeacherRepository().get("t1");
    expect(still.status).toBe("inactive");
  });

  it("a newly created room becomes available to class assignment", async () => {
    const { result } = renderHook(() => useRooms({ assignableOnly: true, per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.items.length;

    await getRoomRepository().create({ name: "اتاق تازه", kind: "گروهی", capacity: 8, occupancy: 0, active: true });
    await waitFor(() => expect(result.current.items.length).toBe(before + 1));
  });

  it("enrolling a student increases the class's seat count for other readers", async () => {
    const { result } = renderHook(() => useClasses({ per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const target = result.current.items.find((c) => c.enrolled < c.capacity);
    expect(target).toBeDefined();
    const before = target!.enrolled;

    // Pick a student who is not already enrolled in that class.
    const students = await getStudentRepository().list({ per_page: 500 });
    const candidate = students.data.find((s) => !target!.studentIds.includes(s.id));
    expect(candidate).toBeDefined();

    await getEnrollmentRepository().enroll({ studentId: candidate!.id, classId: target!.id });

    await waitFor(() => {
      const updated = result.current.items.find((c) => c.id === target!.id);
      expect(updated?.enrolled).toBe(before + 1);
    });
  });

  it("archiving a class removes it from the default class list", async () => {
    const { result } = renderHook(() => useClasses({ per_page: 200 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items.some((c) => c.id === "cl10")).toBe(true);

    await getClassRepository().archive("cl10");
    await waitFor(() => expect(result.current.items.some((c) => c.id === "cl10")).toBe(false));
  });
});

describe("dashboard metrics derive from domain state", () => {
  it("student counts change after a create", async () => {
    const { result } = renderHook(() => useAcademyMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.metrics.students;

    await getStudentRepository().create({
      nationalId: "2000535658",
      name: "هنرجوی متریک",
      instrument: "piano",
      teacherId: "t1",
      level: "سطح ۱",
      levelStep: 1,
      status: "active",
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal: 12,
      attendance: 100,
      progress: 0,
      since: "امروز",
      age: 20,
      phone: "۰۹۱۲۳۳۳۴۴۴۴",
      lastSeen: "امروز",
      balance: 0,
    });

    await waitFor(() => expect(result.current.metrics.students).toBe(before + 1));
  });

  it("capacity usage recomputes after an enrollment", async () => {
    const { result } = renderHook(() => useAcademyMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const before = result.current.metrics.takenSeats;

    const classes = await getClassRepository().list({ per_page: 200 });
    const target = classes.data.find((c) => c.enrolled < c.capacity)!;
    const students = await getStudentRepository().list({ per_page: 500 });
    const candidate = students.data.find((s) => !target.studentIds.includes(s.id))!;

    await getEnrollmentRepository().enroll({ studentId: candidate.id, classId: target.id });
    await waitFor(() => expect(result.current.metrics.takenSeats).toBe(before + 1));
  });
});

describe("command palette search is repository-backed", () => {
  it("finds a student created during the session", async () => {
    await getStudentRepository().create({
      nationalId: "2000535658",
      name: "جستجوپذیر",
      instrument: "voice",
      teacherId: "t4",
      level: "سطح ۱",
      levelStep: 1,
      status: "active",
      payment: "paid",
      sessionsUsed: 0,
      sessionsTotal: 12,
      attendance: 100,
      progress: 0,
      since: "امروز",
      age: 30,
      phone: "۰۹۱۲۵۵۵۶۶۶۶",
      lastSeen: "امروز",
      balance: 0,
    });

    const { result } = renderHook(() => useDomainSearch("جستجوپذیر"));
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));
    expect(result.current.results[0].title).toBe("جستجوپذیر");
    expect(result.current.results[0].kind).toBe("student");
  });

  it("never exposes a national ID in a result subtitle", async () => {
    const student = (await getStudentRepository().list({ per_page: 1 })).data[0];
    const { result } = renderHook(() => useDomainSearch(student.name));
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));

    for (const entry of result.current.results) {
      expect(entry.subtitle).not.toContain(student.nationalId);
    }
  });

  it("returns nothing for an empty query", async () => {
    const { result } = renderHook(() => useDomainSearch("   "));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.results).toHaveLength(0);
  });
});
