// @vitest-environment jsdom
/**
 * D8 — the api-mode disclosure contract.
 *
 * The notice exists because api mode is HYBRID: some domains call the backend,
 * twelve still read the local store (see `DEMO_SERVED_DOMAINS` in
 * `src/domains/registry.ts`). These tests pin the recorded decision:
 *
 *   1. present in api mode, absent in demo mode;
 *   2. persistent — no dismiss control anywhere in it;
 *   3. its wording derives from the registry's single enumeration, so the
 *      rendered set equals the registry set (no second list to drift);
 *   4. it names what IS true (local data) and asserts nothing about backend
 *      health — no fabricated "server answered" claims;
 *   5. the enumeration itself is still TRUE: every listed getter really
 *      resolves to a demo repository in api mode (the guard against a stale
 *      list after a domain graduates).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { resetRuntimeConfig, setRuntimeConfig } from "@/api/config";
import {
  DEMO_SERVED_DOMAINS,
  getAttendanceRepository,
  getBrandingRepository,
  getChatRepository,
  getCompensationRepository,
  getGalleryRepository,
  getInstrumentRepository,
  getLearningRepository,
  getLibraryRepository,
  getMediaRepository,
  getOrganizationRepository,
  getProgressRepository,
  getSchedulingRepository,
  resetRegistry,
} from "@/domains/registry";
import { DemoBackedNotice } from "../DemoBackedNotice";
import { LocalInstrumentRepository } from "@/domains/instruments/localRepository";
import { LocalLearningRepository } from "@/domains/learning/localRepository";
import { LocalChatRepository } from "@/domains/chat/localRepository";
import { LocalMediaRepository } from "@/domains/media/localRepository";
import { LocalLibraryRepository } from "@/domains/library/localRepository";
import { LocalBrandingRepository } from "@/domains/branding/localRepository";
import { LocalOrganizationRepository } from "@/domains/organization/localRepository";
import { LocalGalleryRepository } from "@/domains/gallery/localRepository";
import { LocalProgressRepository } from "@/domains/progress/localRepository";
import { LocalSchedulingRepository } from "@/domains/scheduling/localRepository";
import { LocalAttendanceRepository } from "@/domains/attendance/localRepository";
import { LocalCompensationRepository } from "@/domains/compensation/localRepository";

afterEach(() => {
  resetRuntimeConfig();
  resetRegistry();
  cleanup();
});

describe("D8 disclosure visibility", () => {
  it("renders in api mode", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://api.example.test", error: null });
    render(<DemoBackedNotice />);
    expect(screen.getByRole("note", { name: "اعلام منبع داده" })).toBeTruthy();
  });

  it("is absent in demo mode — the DemoNote family already labels prototype data", () => {
    setRuntimeConfig({ mode: "demo", error: null });
    render(<DemoBackedNotice />);
    expect(screen.queryByRole("note", { name: "اعلام منبع داده" })).toBeNull();
  });

  it("has no dismiss control — the disclosure is non-dismissable by design", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://api.example.test", error: null });
    render(<DemoBackedNotice />);
    expect(screen.queryByRole("button", { name: /بستن|رد کردن|close|dismiss/i })).toBeNull();
  });
});

describe("D8 wording derives from the registry's single enumeration", () => {
  it("names exactly the demo-served domains — the rendered set IS the registry set", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://api.example.test", error: null });
    render(<DemoBackedNotice />);
    const text = screen.getByRole("note", { name: "اعلام منبع داده" }).textContent ?? "";
    for (const domain of DEMO_SERVED_DOMAINS) {
      expect(text, `missing ${domain.id} (${domain.label})`).toContain(domain.label);
    }
    // D8-A: twelve, including organization. The count is the enumeration, not a banner copy.
    expect(DEMO_SERVED_DOMAINS.map((domain) => domain.id)).toEqual([
      "instruments",
      "learning",
      "chat",
      "media",
      "library",
      "branding",
      "organization",
      "gallery",
      "progress",
      "scheduling",
      "attendance",
      "compensation",
    ]);
  });

  it("claims nothing about backend health or a server response", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://api.example.test", error: null });
    render(<DemoBackedNotice />);
    const text = screen.getByRole("note", { name: "اعلام منبع داده" }).textContent ?? "";
    // No fabricated "the backend is online/answered/healthy" phrasing.
    expect(text).not.toMatch(/سرور (پاسخ|آنلاین|سالم)/);
    expect(text).not.toMatch(/متصل شد/);
    expect(text).not.toMatch(/در دسترس است/);
    // It DOES say what is true: these sections read local data.
    expect(text).toContain("دادهٔ محلی");
  });
});

describe("the D8 enumeration is still true", () => {
  it("every listed getter resolves to a demo repository even in api mode", () => {
    setRuntimeConfig({ mode: "api", apiBaseUrl: "https://api.example.test", error: null });
    const demoClasses = [
      LocalInstrumentRepository,
      LocalLearningRepository,
      LocalChatRepository,
      LocalMediaRepository,
      LocalLibraryRepository,
      LocalBrandingRepository,
      LocalOrganizationRepository,
      LocalGalleryRepository,
      LocalProgressRepository,
      LocalSchedulingRepository,
      LocalAttendanceRepository,
      LocalCompensationRepository,
    ];
    const repos = [
      getInstrumentRepository(),
      getLearningRepository(),
      getChatRepository(),
      getMediaRepository(),
      getLibraryRepository(),
      getBrandingRepository(),
      getOrganizationRepository(),
      getGalleryRepository(),
      getProgressRepository(),
      getSchedulingRepository(),
      getAttendanceRepository(),
      getCompensationRepository(),
    ];
    expect(repos).toHaveLength(DEMO_SERVED_DOMAINS.length);
    repos.forEach((repo, i) => {
      expect(
        repo instanceof demoClasses[i],
        `DEMO_SERVED_DOMAINS[${i}] ("${DEMO_SERVED_DOMAINS[i].id}") no longer resolves to the demo store — update the enumeration first, never the banner`,
      ).toBe(true);
    });
  });
});
