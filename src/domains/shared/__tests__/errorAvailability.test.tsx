// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";
import { ErrorState } from "@/components/ds/states";
import { blockingFailure, classifyError } from "@/domains/shared/errorAvailability";
import { domainUnavailableError } from "@/domains/shared/unavailableRepository";

afterEach(cleanup);

const unavailable = domainUnavailableError("gallery", "گالری");
const policy = new ApiError({
  kind: "authorization",
  status: 403,
  code: "OWNER_DECISION_REQUIRED_PB3",
  message: "این بخش در این نسخه از سامانه در دسترس نیست.",
});
const serverFailure = new ApiError({ kind: "server", status: 500, message: "خطای تست سرور" });
const network = new ApiError({ kind: "network", message: "قطع ارتباط" });

describe("classifyError", () => {
  it("separates a missing capability, a policy refusal and a real failure", () => {
    expect(classifyError(unavailable)).toBe("unavailable");
    expect(classifyError(policy)).toBe("policy");
    expect(classifyError(serverFailure)).toBe("failure");
    expect(classifyError(network)).toBe("failure");
    expect(classifyError(null)).toBe("failure");
  });

  it("blockingFailure lets an optional read degrade unless it really failed", () => {
    expect(blockingFailure(unavailable)).toBeNull();
    expect(blockingFailure(policy)).toBeNull();
    expect(blockingFailure(null)).toBeNull();
    expect(blockingFailure(serverFailure)).toBe(serverFailure);
  });
});

describe("ErrorState with an error", () => {
  const retry = () => {};

  it("an unavailable capability says so: no 'load failed', no domain id, no retry", () => {
    render(<ErrorState title="بارگذاری گالری ناموفق بود" error={unavailable} onRetry={retry} />);
    expect(screen.getByText("این بخش در این نسخه در دسترس نیست")).toBeTruthy();
    expect(screen.queryByText(/ناموفق بود/)).toBeNull();
    expect(screen.queryByText(/gallery/)).toBeNull();
    expect(screen.queryByRole("button", { name: /تلاش دوباره/ })).toBeNull();
  });

  it("a policy refusal is not described as a missing or failed server, and has no retry", () => {
    render(<ErrorState title="بارگذاری اتاق‌ها ناموفق بود" error={policy} onRetry={retry} />);
    expect(screen.getByText("این درخواست مجاز نیست")).toBeTruthy();
    expect(screen.getByText(policy.message)).toBeTruthy();
    expect(screen.queryByText(/ناموفق بود/)).toBeNull();
    expect(screen.queryByText(/متصل نیست/)).toBeNull();
    expect(screen.queryByRole("button", { name: /تلاش دوباره/ })).toBeNull();
  });

  it("a real failure keeps the caller's title, the error's own message and the retry", () => {
    render(<ErrorState title="بارگذاری کلاس‌ها ناموفق بود" error={serverFailure} onRetry={retry} />);
    expect(screen.getByText("بارگذاری کلاس‌ها ناموفق بود")).toBeTruthy();
    expect(screen.getByText("خطای تست سرور")).toBeTruthy();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
  });

  it("an explicit description still wins for a real failure, and no error means the old behaviour", () => {
    render(<ErrorState title="عنوان" description="توضیح صریح" error={network} onRetry={retry} />);
    expect(screen.getByText("توضیح صریح")).toBeTruthy();
    cleanup();
    render(<ErrorState title="عنوان" description="توضیح" onRetry={retry} />);
    expect(screen.getByText("توضیح")).toBeTruthy();
    expect(screen.getByRole("button", { name: /تلاش دوباره/ })).toBeTruthy();
  });
});