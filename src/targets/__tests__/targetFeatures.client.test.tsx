// @vitest-environment jsdom
/**
 * The client login disclosure when every domain is served.
 *
 * `UNAVAILABLE_DOMAINS` is empty while no capability lacks a server. The
 * login page must then show NO disclosure rather than a sentence naming
 * nothing ("...نشان نمی‌دهند: ." with an empty list would read as broken).
 * This pins the empty case explicitly: the guard lives in the client target
 * (`targetFeatures.client.tsx`), and this is the only test that renders it.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UNAVAILABLE_DOMAINS } from "@/domains/shared/unavailableDomains";
import { LoginSourceNotice } from "@/targets/targetFeatures.client";

afterEach(cleanup);

describe("client login disclosure with an empty unavailable list", () => {
  it("renders no note instead of a sentence naming nothing", () => {
    expect(UNAVAILABLE_DOMAINS).toHaveLength(0);

    const { container } = render(<LoginSourceNotice />);

    expect(screen.queryByRole("note", { name: "اعلام منبع داده" })).toBeNull();
    expect(container.textContent ?? "").not.toContain("نشان نمی‌دهند");
  });
});
